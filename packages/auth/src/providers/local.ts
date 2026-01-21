/**
 * @package @forge/auth
 * @description Local (username/password) authentication provider
 */

import { ErrorCode } from '@forge/errors';
import {
  AuthResult,
  Credentials,
  StoredUser,
  AuthProviderConfig,
  UserLookupCallback,
  UserUpdateCallback,
  RateLimitConfig,
  LockoutStatus,
  DEFAULT_AUTH_CONFIG,
} from '../auth.types';
import { BaseAuthProvider } from './base';
import { PasswordService, getPasswordService } from '../password';

/**
 * Local provider configuration
 */
export interface LocalProviderConfig {
  /** Provider ID */
  id: string;
  /** Provider display name */
  name: string;
  /** Whether provider is enabled */
  enabled: boolean;
  /** User lookup callback */
  userLookup: UserLookupCallback;
  /** User update callback (for updating failed attempts, etc.) */
  userUpdate?: UserUpdateCallback;
  /** Rate limiting configuration */
  rateLimit?: RateLimitConfig;
  /** Password service instance */
  passwordService?: PasswordService;
}

/**
 * Local authentication provider (username/password)
 */
export class LocalAuthProvider extends BaseAuthProvider {
  readonly type = 'local' as const;
  readonly id: string;
  readonly name: string;
  readonly enabled: boolean;

  private userLookup: UserLookupCallback;
  private userUpdate?: UserUpdateCallback;
  private rateLimit: RateLimitConfig;
  private passwordService: PasswordService;

  constructor(config: LocalProviderConfig) {
    super();
    this.id = config.id;
    this.name = config.name;
    this.enabled = config.enabled;
    this.userLookup = config.userLookup;
    this.userUpdate = config.userUpdate;
    this.rateLimit = config.rateLimit ?? DEFAULT_AUTH_CONFIG.rateLimit;
    this.passwordService = config.passwordService ?? getPasswordService();
  }

  /**
   * Authenticate with username/password
   */
  async authenticate(credentials: Credentials, tenantId: string): Promise<AuthResult> {
    const { identifier, password } = credentials;

    // Look up user
    const user = await this.userLookup(identifier, tenantId);
    if (!user) {
      return {
        success: false,
        error: 'Invalid credentials',
        errorCode: ErrorCode.INVALID_CREDENTIALS,
      };
    }

    // Check account status
    if (!this.isAccountActive(user)) {
      return {
        success: false,
        error: `Account is ${user.status}`,
        errorCode: ErrorCode.UNAUTHENTICATED,
      };
    }

    // Check lockout
    if (this.isAccountLocked(user)) {
      const remainingSeconds = this.getLockoutRemainingSeconds(user);
      return {
        success: false,
        error: `Account is locked. Try again in ${Math.ceil(remainingSeconds / 60)} minutes.`,
        errorCode: ErrorCode.RATE_LIMIT_EXCEEDED,
      };
    }

    // Verify password
    const isValidPassword = await this.passwordService.verify(password, user.passwordHash);

    if (!isValidPassword) {
      // Record failed attempt
      await this.recordFailedAttempt(user);

      return {
        success: false,
        error: 'Invalid credentials',
        errorCode: ErrorCode.INVALID_CREDENTIALS,
      };
    }

    // Reset failed attempts on successful login
    if (user.failedLoginAttempts > 0 && this.userUpdate) {
      await this.userUpdate(user.id, {
        failedLoginAttempts: 0,
        lockoutEndsAt: undefined,
        lastLoginAt: new Date(),
      });
    } else if (this.userUpdate) {
      await this.userUpdate(user.id, {
        lastLoginAt: new Date(),
      });
    }

    // Check if MFA is required
    if (user.mfaEnabled) {
      return {
        success: false,
        mfaRequired: true,
        user: this.toUserIdentity(user),
      };
    }

    // Check email verification (optional enforcement)
    // Note: This is left to the application to decide

    return {
      success: true,
      user: this.toUserIdentity(user),
    };
  }

  /**
   * Record a failed login attempt
   */
  private async recordFailedAttempt(user: StoredUser): Promise<LockoutStatus> {
    if (!this.userUpdate) {
      return {
        isLocked: false,
        failedAttempts: user.failedLoginAttempts + 1,
      };
    }

    const newAttempts = user.failedLoginAttempts + 1;
    const isLocked = newAttempts >= this.rateLimit.maxLoginAttempts;

    const updates: Partial<StoredUser> = {
      failedLoginAttempts: newAttempts,
    };

    if (isLocked) {
      const lockoutEndsAt = new Date(
        Date.now() + this.rateLimit.lockoutDurationSeconds * 1000
      );
      updates.lockoutEndsAt = lockoutEndsAt;
    }

    await this.userUpdate(user.id, updates);

    return {
      isLocked,
      failedAttempts: newAttempts,
      lockoutEndsAt: updates.lockoutEndsAt,
      remainingSeconds: isLocked ? this.rateLimit.lockoutDurationSeconds : undefined,
    };
  }

  /**
   * Check if this provider can handle the credentials
   */
  canHandle(credentials: Credentials): boolean {
    // Local provider handles credentials with identifier and password
    return !!(credentials.identifier && credentials.password);
  }

  /**
   * Get public configuration
   */
  getPublicConfig(): Partial<AuthProviderConfig> {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      enabled: this.enabled,
    };
  }

  /**
   * Set user lookup callback (for testing)
   */
  setUserLookup(callback: UserLookupCallback): void {
    this.userLookup = callback;
  }

  /**
   * Set user update callback (for testing)
   */
  setUserUpdate(callback: UserUpdateCallback): void {
    this.userUpdate = callback;
  }

  /**
   * Set password service (for testing)
   */
  setPasswordService(service: PasswordService): void {
    this.passwordService = service;
  }

  /**
   * Get rate limit configuration
   */
  getRateLimitConfig(): RateLimitConfig {
    return { ...this.rateLimit };
  }
}

/**
 * Create a local auth provider with default settings
 */
export function createLocalProvider(
  userLookup: UserLookupCallback,
  options: {
    id?: string;
    name?: string;
    enabled?: boolean;
    userUpdate?: UserUpdateCallback;
    rateLimit?: RateLimitConfig;
    passwordService?: PasswordService;
  } = {}
): LocalAuthProvider {
  return new LocalAuthProvider({
    id: options.id ?? 'local',
    name: options.name ?? 'Email & Password',
    enabled: options.enabled ?? true,
    userLookup,
    userUpdate: options.userUpdate,
    rateLimit: options.rateLimit,
    passwordService: options.passwordService,
  });
}
