/**
 * @package @forge/auth
 * @description Main authentication service
 */

import { ErrorCode, ForgeError } from '@forge/errors';
import {
  AuthConfig,
  AuthResult,
  Credentials,
  UserIdentity,
  TokenPair,
  Session,
  MfaSetupResult,
  AuthAuditEvent,
  AuthAuditEventType,
  AuditLogCallback,
  UserLookupCallback,
  UserUpdateCallback,
  TenantContext,
  DEFAULT_AUTH_CONFIG,
} from './auth.types';
import { TokenService, getTokenService, resetTokenService } from './token';
import { PasswordService, getPasswordService, resetPasswordService } from './password';
import { SessionService, SessionStorage, InMemorySessionStorage, getSessionService, resetSessionService } from './session';
import { MfaService, MfaChallengeManager, getMfaService, resetMfaService } from './mfa';
import {
  AuthProvider,
  AuthProviderRegistry,
  getProviderRegistry,
  resetProviderRegistry,
  createLocalProvider,
} from './providers';

/**
 * Authentication service options
 */
export interface AuthServiceOptions {
  /** Configuration */
  config?: Partial<AuthConfig>;
  /** Session storage */
  sessionStorage?: SessionStorage;
  /** User lookup callback */
  userLookup?: UserLookupCallback;
  /** User update callback */
  userUpdate?: UserUpdateCallback;
  /** Audit log callback */
  auditLog?: AuditLogCallback;
}

/**
 * Main authentication service class
 */
export class AuthService {
  private config: AuthConfig;
  private tokenService: TokenService;
  private passwordService: PasswordService;
  private sessionService: SessionService;
  private mfaService: MfaService;
  private mfaChallengeManager: MfaChallengeManager;
  private providerRegistry: AuthProviderRegistry;
  private userLookup?: UserLookupCallback;
  private userUpdate?: UserUpdateCallback;
  private auditLog?: AuditLogCallback;
  private initialized: boolean = false;

  constructor(options: AuthServiceOptions = {}) {
    this.config = { ...DEFAULT_AUTH_CONFIG, ...options.config };
    this.userLookup = options.userLookup;
    this.userUpdate = options.userUpdate;
    this.auditLog = options.auditLog;

    // Initialize services
    this.tokenService = getTokenService(this.config.jwt);
    this.passwordService = getPasswordService(this.config.password);
    this.sessionService = getSessionService(
      options.sessionStorage ?? new InMemorySessionStorage(),
      this.config.session
    );
    this.mfaService = getMfaService(this.config.mfa);
    this.mfaChallengeManager = new MfaChallengeManager();
    this.providerRegistry = getProviderRegistry();
  }

  /**
   * Initialize the auth service (load dependencies)
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await Promise.all([
      this.tokenService.initialize(),
      this.passwordService.initialize(),
      this.mfaService.initialize(),
    ]);

    // Register default local provider if user lookup is configured
    if (this.userLookup) {
      const localProvider = createLocalProvider(this.userLookup, {
        userUpdate: this.userUpdate,
        rateLimit: this.config.rateLimit,
        passwordService: this.passwordService,
      });
      this.providerRegistry.register(localProvider);
    }

    this.initialized = true;
  }

  /**
   * Authenticate a user
   */
  async authenticate(
    credentials: Credentials,
    context: TenantContext
  ): Promise<AuthResult> {
    this.ensureInitialized();

    // Find appropriate provider
    const provider = this.providerRegistry.findProvider(credentials);
    if (!provider) {
      return {
        success: false,
        error: 'No authentication provider found for credentials',
        errorCode: ErrorCode.VALIDATION_FAILED,
      };
    }

    // Authenticate with provider
    const result = await provider.authenticate(credentials, context.tenantId);

    // Handle MFA requirement (comes before general failure check)
    if (result.mfaRequired && result.user) {
      const challenge = this.mfaChallengeManager.createChallenge(
        result.user.id,
        context.tenantId
      );
      return {
        success: false,
        mfaRequired: true,
        mfaChallengeId: challenge.id,
        user: result.user,
      };
    }

    // Handle authentication failure
    if (!result.success) {
      await this.logAuditEvent('login_failure', context, {
        identifier: credentials.identifier,
        error: result.error,
        providerId: provider.id,
      });
      return result;
    }

    // Generate tokens and session
    if (result.user) {
      const session = await this.sessionService.createSession(
        result.user.id,
        context.tenantId,
        { extendedDuration: credentials.rememberMe }
      );

      const tokens = this.tokenService.generateTokenPair(result.user, session.id);

      await this.logAuditEvent('login_success', context, {
        userId: result.user.id,
        providerId: provider.id,
        sessionId: session.id,
      });

      return {
        success: true,
        user: result.user,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        sessionId: session.id,
        expiresAt: tokens.accessTokenExpiresAt,
      };
    }

    return result;
  }

  /**
   * Verify MFA and complete authentication
   */
  async verifyMfa(
    challengeId: string,
    token: string,
    context: TenantContext,
    options: { rememberMe?: boolean } = {}
  ): Promise<AuthResult> {
    this.ensureInitialized();

    // Get challenge
    const challenge = this.mfaChallengeManager.getChallenge(challengeId);
    if (!challenge) {
      return {
        success: false,
        error: 'Invalid or expired MFA challenge',
        errorCode: ErrorCode.MFA_INVALID,
      };
    }

    // Record attempt
    const { allowed, remainingAttempts } = this.mfaChallengeManager.recordAttempt(challengeId);
    if (!allowed) {
      await this.logAuditEvent('mfa_failed', context, {
        userId: challenge.userId,
        reason: 'Max attempts exceeded',
      });
      return {
        success: false,
        error: 'Maximum MFA attempts exceeded',
        errorCode: ErrorCode.MFA_INVALID,
      };
    }

    // Get user MFA secret
    if (!this.userLookup) {
      return {
        success: false,
        error: 'User lookup not configured',
        errorCode: ErrorCode.VALIDATION_FAILED,
      };
    }

    const user = await this.userLookup(challenge.userId, context.tenantId);
    if (!user || !user.mfaSecret) {
      return {
        success: false,
        error: 'MFA not configured for user',
        errorCode: ErrorCode.MFA_INVALID,
      };
    }

    // Verify token
    const verification = this.mfaService.verifyToken(token, user.mfaSecret);
    if (!verification.valid) {
      await this.logAuditEvent('mfa_failed', context, {
        userId: challenge.userId,
        remainingAttempts,
      });
      return {
        success: false,
        error: verification.error ?? `Invalid MFA token. ${remainingAttempts} attempts remaining.`,
        errorCode: ErrorCode.MFA_INVALID,
      };
    }

    // Mark challenge as verified
    this.mfaChallengeManager.verifyChallenge(challengeId);
    this.mfaChallengeManager.deleteChallenge(challengeId);

    // Create session and tokens
    const userIdentity: UserIdentity = {
      id: user.id,
      email: user.email,
      username: user.username,
      tenantId: user.tenantId,
      roles: user.roles,
      permissions: user.permissions,
      emailVerified: user.emailVerified,
      mfaEnabled: user.mfaEnabled,
    };

    const session = await this.sessionService.createSession(
      user.id,
      context.tenantId,
      { extendedDuration: options.rememberMe }
    );

    const tokens = this.tokenService.generateTokenPair(userIdentity, session.id);

    await this.logAuditEvent('mfa_verified', context, {
      userId: user.id,
      sessionId: session.id,
    });

    await this.logAuditEvent('login_success', context, {
      userId: user.id,
      sessionId: session.id,
      mfaVerified: true,
    });

    return {
      success: true,
      user: userIdentity,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      sessionId: session.id,
      expiresAt: tokens.accessTokenExpiresAt,
    };
  }

  /**
   * Refresh tokens
   */
  async refreshTokens(
    refreshToken: string,
    context: TenantContext
  ): Promise<{ tokens?: TokenPair; error?: string }> {
    this.ensureInitialized();

    const result = this.tokenService.verifyRefreshToken(refreshToken);
    if (!result.valid || !result.payload) {
      return { error: result.error ?? 'Invalid refresh token' };
    }

    // Verify session is still valid
    if (result.payload.sessionId) {
      const sessionValid = await this.sessionService.validateSession(result.payload.sessionId);
      if (!sessionValid.valid) {
        return { error: 'Session is no longer valid' };
      }

      // Refresh the session
      await this.sessionService.refreshSession(result.payload.sessionId);
    }

    // Generate new token pair
    const user = this.tokenService.extractUserFromPayload(result.payload);
    const tokens = this.tokenService.generateTokenPair(user, result.payload.sessionId);

    await this.logAuditEvent('token_refresh', context, {
      userId: result.payload.sub,
      sessionId: result.payload.sessionId,
    });

    return { tokens };
  }

  /**
   * Logout (invalidate session)
   */
  async logout(sessionId: string, context: TenantContext): Promise<boolean> {
    this.ensureInitialized();

    const success = await this.sessionService.invalidateSession(sessionId);

    if (success) {
      await this.logAuditEvent('logout', context, { sessionId });
    }

    return success;
  }

  /**
   * Logout from all sessions
   */
  async logoutAll(
    userId: string,
    context: TenantContext,
    options: { exceptSessionId?: string } = {}
  ): Promise<number> {
    this.ensureInitialized();

    const count = await this.sessionService.invalidateUserSessions(
      userId,
      context.tenantId,
      options
    );

    await this.logAuditEvent('session_invalidated', context, {
      userId,
      sessionCount: count,
      exceptSessionId: options.exceptSessionId,
    });

    return count;
  }

  /**
   * Setup MFA for a user
   */
  async setupMfa(userId: string, userEmail: string): Promise<MfaSetupResult> {
    this.ensureInitialized();
    return this.mfaService.generateSetup(userId, userEmail);
  }

  /**
   * Enable MFA for a user after verification
   */
  async enableMfa(
    userId: string,
    secret: string,
    token: string,
    backupCodes: string[],
    context: TenantContext
  ): Promise<{ success: boolean; error?: string }> {
    this.ensureInitialized();

    // Verify the token first
    const verification = this.mfaService.verifyToken(token, secret);
    if (!verification.valid) {
      return { success: false, error: verification.error ?? 'Invalid token' };
    }

    // Hash backup codes
    const hashedBackupCodes = await this.mfaService.hashBackupCodes(
      backupCodes,
      (code) => this.passwordService.hashResetToken(code)
    );

    // Update user
    if (this.userUpdate) {
      await this.userUpdate(userId, {
        mfaEnabled: true,
        mfaSecret: secret, // Should be encrypted before storage
        mfaBackupCodes: hashedBackupCodes,
      });
    }

    await this.logAuditEvent('mfa_enabled', context, { userId });

    return { success: true };
  }

  /**
   * Disable MFA for a user
   */
  async disableMfa(
    userId: string,
    password: string,
    context: TenantContext
  ): Promise<{ success: boolean; error?: string }> {
    this.ensureInitialized();

    // Verify password
    if (!this.userLookup) {
      return { success: false, error: 'User lookup not configured' };
    }

    const user = await this.userLookup(userId, context.tenantId);
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    const isValid = await this.passwordService.verify(password, user.passwordHash);
    if (!isValid) {
      return { success: false, error: 'Invalid password' };
    }

    // Disable MFA
    if (this.userUpdate) {
      await this.userUpdate(userId, {
        mfaEnabled: false,
        mfaSecret: undefined,
        mfaBackupCodes: undefined,
      });
    }

    await this.logAuditEvent('mfa_disabled', context, { userId });

    return { success: true };
  }

  /**
   * Change user password
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    context: TenantContext
  ): Promise<{ success: boolean; error?: string }> {
    this.ensureInitialized();

    if (!this.userLookup || !this.userUpdate) {
      return { success: false, error: 'User operations not configured' };
    }

    const user = await this.userLookup(userId, context.tenantId);
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    // Verify current password
    const isValid = await this.passwordService.verify(currentPassword, user.passwordHash);
    if (!isValid) {
      return { success: false, error: 'Current password is incorrect' };
    }

    // Validate new password
    const validation = this.passwordService.validate(newPassword);
    if (!validation.valid) {
      return { success: false, error: validation.errors.join(', ') };
    }

    // Check password history
    if (user.passwordHistory && user.passwordHistory.length > 0) {
      const inHistory = await this.passwordService.isInHistory(newPassword, user.passwordHistory);
      if (inHistory) {
        return { success: false, error: 'Cannot reuse a recent password' };
      }
    }

    // Hash new password
    const { hash } = await this.passwordService.hash(newPassword);

    // Update password history
    const history = user.passwordHistory ?? [];
    history.push(user.passwordHash);

    await this.userUpdate(userId, {
      passwordHash: hash,
      passwordHistory: history,
    });

    await this.logAuditEvent('password_change', context, { userId });

    return { success: true };
  }

  /**
   * Validate access token
   */
  validateAccessToken(token: string): {
    valid: boolean;
    user?: UserIdentity;
    error?: string;
  } {
    this.ensureInitialized();

    const result = this.tokenService.verifyAccessToken(token);
    if (!result.valid || !result.payload) {
      return { valid: false, error: result.error };
    }

    return {
      valid: true,
      user: this.tokenService.extractUserFromPayload(result.payload),
    };
  }

  /**
   * Get session
   */
  async getSession(sessionId: string): Promise<Session | null> {
    this.ensureInitialized();
    return this.sessionService.getSession(sessionId);
  }

  /**
   * Get user sessions
   */
  async getUserSessions(userId: string, tenantId: string): Promise<Session[]> {
    this.ensureInitialized();
    return this.sessionService.getUserSessions(userId, tenantId);
  }

  /**
   * Validate password against policy
   */
  validatePassword(password: string): {
    valid: boolean;
    errors: string[];
    strength: number;
  } {
    return this.passwordService.validate(password);
  }

  /**
   * Hash a password
   */
  async hashPassword(password: string): Promise<string> {
    this.ensureInitialized();
    const result = await this.passwordService.hash(password);
    return result.hash;
  }

  /**
   * Register an auth provider
   */
  registerProvider(provider: AuthProvider): void {
    this.providerRegistry.register(provider);
  }

  /**
   * Get registered providers
   */
  getProviders(): AuthProvider[] {
    return this.providerRegistry.getEnabled();
  }

  /**
   * Get configuration
   */
  getConfig(): AuthConfig {
    return { ...this.config };
  }

  /**
   * Set audit log callback
   */
  setAuditLog(callback: AuditLogCallback): void {
    this.auditLog = callback;
  }

  /**
   * Set user lookup callback
   */
  setUserLookup(callback: UserLookupCallback): void {
    this.userLookup = callback;
  }

  /**
   * Set user update callback
   */
  setUserUpdate(callback: UserUpdateCallback): void {
    this.userUpdate = callback;
  }

  /**
   * Log an audit event
   */
  private async logAuditEvent(
    type: AuthAuditEventType,
    context: TenantContext,
    details?: Record<string, unknown>
  ): Promise<void> {
    if (!this.auditLog || !this.config.enableLogging) {
      return;
    }

    const event: AuthAuditEvent = {
      id: this.generateEventId(),
      type,
      userId: context.userId,
      tenantId: context.tenantId,
      timestamp: new Date(),
      details,
    };

    try {
      await this.auditLog(event);
    } catch {
      // Silently fail - audit logging shouldn't break auth
    }
  }

  /**
   * Generate a unique event ID
   */
  private generateEventId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `evt_${timestamp}_${random}`;
  }

  /**
   * Ensure service is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new ForgeError({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'Auth service not initialized. Call initialize() first.',
        statusCode: 500,
      });
    }
  }
}

// Singleton instance
let authServiceInstance: AuthService | null = null;

/**
 * Get the singleton auth service instance
 */
export function getAuthService(options?: AuthServiceOptions): AuthService {
  if (!authServiceInstance) {
    authServiceInstance = new AuthService(options);
  }
  return authServiceInstance;
}

/**
 * Reset all singleton instances (for testing)
 */
export function resetAuthService(): void {
  authServiceInstance = null;
  resetTokenService();
  resetPasswordService();
  resetSessionService();
  resetMfaService();
  resetProviderRegistry();
}
