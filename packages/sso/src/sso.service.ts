/**
 * @package @forge/sso
 * @description Main SSO service for managing providers and authentication flows
 */

import { ErrorCode, ForgeError } from '@forge/errors';
import {
  SsoConfig,
  SsoProviderConfig,
  SamlProviderConfig,
  OidcProviderConfig,
  SsoAuthRequest,
  SsoAuthResponse,
  SsoLogoutRequest,
  SsoLogoutResponse,
  SsoSession,
  SsoAuditEvent,
  UserProvisioningCallback,
} from './sso.types';
import { SamlProvider, createSamlProvider } from './saml/saml.provider';
import { OidcProvider, createOidcProvider } from './oidc/oidc.provider';

/**
 * SSO service event handler types
 */
export interface SsoEventHandlers {
  onAuthSuccess?: (event: SsoAuthSuccessEvent) => void | Promise<void>;
  onAuthFailure?: (event: SsoAuthFailureEvent) => void | Promise<void>;
  onLogout?: (event: SsoLogoutEvent) => void | Promise<void>;
  onAudit?: (event: SsoAuditEvent) => void | Promise<void>;
}

export interface SsoAuthSuccessEvent {
  userId: string;
  tenantId: string;
  providerId: string;
  providerType: 'saml' | 'oidc';
  sessionId?: string;
  timestamp: Date;
}

export interface SsoAuthFailureEvent {
  tenantId: string;
  providerId: string;
  providerType: 'saml' | 'oidc';
  error: string;
  errorCode?: string;
  timestamp: Date;
}

export interface SsoLogoutEvent {
  userId: string;
  tenantId: string;
  providerId?: string;
  sessionId?: string;
  timestamp: Date;
}

/**
 * Session store interface for custom implementations
 */
export interface SsoSessionStore {
  get(sessionId: string): Promise<SsoSession | null>;
  set(session: SsoSession): Promise<void>;
  delete(sessionId: string): Promise<void>;
  deleteByUserId(userId: string, tenantId: string): Promise<void>;
  findByUserId(userId: string, tenantId: string): Promise<SsoSession[]>;
}

/**
 * Default in-memory session store (for development/testing)
 */
export class InMemorySsoSessionStore implements SsoSessionStore {
  private sessions: Map<string, SsoSession> = new Map();

  async get(sessionId: string): Promise<SsoSession | null> {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    // Check expiration
    if (session.expiresAt && new Date() > session.expiresAt) {
      this.sessions.delete(sessionId);
      return null;
    }

    return session;
  }

  async set(session: SsoSession): Promise<void> {
    this.sessions.set(session.id, session);
  }

  async delete(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  async deleteByUserId(userId: string, tenantId: string): Promise<void> {
    for (const [id, session] of this.sessions.entries()) {
      if (session.userId === userId && session.tenantId === tenantId) {
        this.sessions.delete(id);
      }
    }
  }

  async findByUserId(userId: string, tenantId: string): Promise<SsoSession[]> {
    const result: SsoSession[] = [];
    const now = new Date();

    for (const session of this.sessions.values()) {
      if (session.userId === userId && session.tenantId === tenantId) {
        if (!session.expiresAt || now <= session.expiresAt) {
          result.push(session);
        }
      }
    }

    return result;
  }

  // For testing
  clear(): void {
    this.sessions.clear();
  }
}

/**
 * Main SSO service
 */
export class SsoService {
  private config: SsoConfig;
  private providers: Map<string, SamlProvider | OidcProvider> = new Map();
  private sessionStore: SsoSessionStore;
  private eventHandlers: SsoEventHandlers = {};
  private userProvisioner?: UserProvisioningCallback;

  constructor(config: SsoConfig, sessionStore?: SsoSessionStore) {
    this.config = config;
    this.sessionStore = sessionStore || new InMemorySsoSessionStore();
  }

  /**
   * Initialize the service and all providers
   */
  async initialize(): Promise<void> {
    // Initialize providers from config
    for (const providerConfig of this.config.providers) {
      await this.registerProvider(providerConfig);
    }
  }

  /**
   * Register a provider
   */
  async registerProvider(config: SsoProviderConfig): Promise<void> {
    let provider: SamlProvider | OidcProvider;

    if (config.type === 'saml') {
      provider = createSamlProvider(config as SamlProviderConfig);
    } else if (config.type === 'oidc') {
      provider = createOidcProvider(config as OidcProviderConfig);
    } else {
      throw new ForgeError({
        code: ErrorCode.SSO_CONFIG_INVALID,
        message: `Unknown provider type: ${(config as SsoProviderConfig).type}`,
        statusCode: 400,
      });
    }

    // Set user provisioner if configured
    if (this.userProvisioner) {
      provider.setUserProvisioner(this.userProvisioner);
    }

    // Initialize provider
    await provider.initialize();

    this.providers.set(config.id, provider);

    // Emit audit event
    await this.emitAudit({
      type: 'sso_provider_configured',
      tenantId: config.tenantId,
      providerId: config.id,
      timestamp: new Date(),
      metadata: {
        providerType: config.type,
        providerName: config.name,
      },
    });
  }

  /**
   * Unregister a provider
   */
  unregisterProvider(providerId: string): boolean {
    return this.providers.delete(providerId);
  }

  /**
   * Get a provider by ID
   */
  getProvider(providerId: string): SamlProvider | OidcProvider | undefined {
    return this.providers.get(providerId);
  }

  /**
   * Get all providers for a tenant
   */
  getProvidersForTenant(tenantId: string): (SamlProvider | OidcProvider)[] {
    return Array.from(this.providers.values()).filter(
      (p) => p.tenantId === tenantId && p.enabled
    );
  }

  /**
   * Get all enabled providers
   */
  getEnabledProviders(): (SamlProvider | OidcProvider)[] {
    return Array.from(this.providers.values()).filter((p) => p.enabled);
  }

  /**
   * Set global user provisioner
   */
  setUserProvisioner(callback: UserProvisioningCallback): void {
    this.userProvisioner = callback;

    // Update all existing providers
    for (const provider of this.providers.values()) {
      provider.setUserProvisioner(callback);
    }
  }

  /**
   * Set event handlers
   */
  setEventHandlers(handlers: SsoEventHandlers): void {
    this.eventHandlers = { ...this.eventHandlers, ...handlers };
  }

  /**
   * Set custom session store
   */
  setSessionStore(store: SsoSessionStore): void {
    this.sessionStore = store;
  }

  /**
   * Generate authentication URL for a provider
   */
  generateAuthUrl(providerId: string, request: SsoAuthRequest): string {
    const provider = this.getProvider(providerId);
    if (!provider) {
      throw new ForgeError({
        code: ErrorCode.SSO_PROVIDER_ERROR,
        message: `Provider not found: ${providerId}`,
        statusCode: 404,
      });
    }

    if (!provider.enabled) {
      throw new ForgeError({
        code: ErrorCode.SSO_PROVIDER_ERROR,
        message: `Provider is disabled: ${providerId}`,
        statusCode: 400,
      });
    }

    return provider.generateAuthUrl(request);
  }

  /**
   * Process SAML response
   */
  async processSamlResponse(
    providerId: string,
    samlResponse: string,
    relayState?: string
  ): Promise<SsoAuthResponse> {
    const provider = this.getProvider(providerId);
    if (!provider || provider.type !== 'saml') {
      return {
        success: false,
        error: `SAML provider not found: ${providerId}`,
        errorCode: ErrorCode.SSO_PROVIDER_ERROR,
      };
    }

    const response = await (provider as SamlProvider).processResponse(
      samlResponse,
      relayState
    );

    // Handle success/failure events
    if (response.success && response.user) {
      await this.handleAuthSuccess(provider, response);
    } else {
      await this.handleAuthFailure(provider, response);
    }

    return response;
  }

  /**
   * Process OIDC callback
   */
  async processOidcCallback(
    providerId: string,
    code: string,
    state: string
  ): Promise<SsoAuthResponse> {
    const provider = this.getProvider(providerId);
    if (!provider || provider.type !== 'oidc') {
      return {
        success: false,
        error: `OIDC provider not found: ${providerId}`,
        errorCode: ErrorCode.SSO_PROVIDER_ERROR,
      };
    }

    const response = await (provider as OidcProvider).processCallback(code, state);

    // Handle success/failure events
    if (response.success && response.user) {
      await this.handleAuthSuccess(provider, response);
    } else {
      await this.handleAuthFailure(provider, response);
    }

    return response;
  }

  /**
   * Generate logout URL
   */
  generateLogoutUrl(
    providerId: string,
    request: SsoLogoutRequest
  ): SsoLogoutResponse {
    const provider = this.getProvider(providerId);
    if (!provider) {
      return {
        success: false,
        error: `Provider not found: ${providerId}`,
      };
    }

    return provider.generateLogoutUrl(request);
  }

  /**
   * Process logout for a user
   */
  async processLogout(
    userId: string,
    tenantId: string,
    providerId?: string
  ): Promise<SsoLogoutResponse> {
    try {
      // Find user's SSO sessions
      const sessions = await this.sessionStore.findByUserId(userId, tenantId);

      // Delete sessions
      await this.sessionStore.deleteByUserId(userId, tenantId);

      // Emit logout event
      await this.eventHandlers.onLogout?.({
        userId,
        tenantId,
        providerId,
        sessionId: sessions[0]?.id,
        timestamp: new Date(),
      });

      // Emit audit event
      await this.emitAudit({
        type: 'sso_logout_success',
        tenantId,
        providerId,
        userId,
        timestamp: new Date(),
        metadata: {
          sessionCount: sessions.length,
        },
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Logout failed',
      };
    }
  }

  /**
   * Get SSO session
   */
  async getSession(sessionId: string): Promise<SsoSession | null> {
    return this.sessionStore.get(sessionId);
  }

  /**
   * Get user's SSO sessions
   */
  async getUserSessions(userId: string, tenantId: string): Promise<SsoSession[]> {
    return this.sessionStore.findByUserId(userId, tenantId);
  }

  /**
   * Refresh OIDC tokens
   */
  async refreshOidcTokens(
    providerId: string,
    refreshToken: string
  ): Promise<SsoAuthResponse> {
    const provider = this.getProvider(providerId);
    if (!provider || provider.type !== 'oidc') {
      return {
        success: false,
        error: `OIDC provider not found: ${providerId}`,
        errorCode: ErrorCode.SSO_PROVIDER_ERROR,
      };
    }

    return (provider as OidcProvider).refreshAccessToken(refreshToken);
  }

  /**
   * Revoke OIDC tokens
   */
  async revokeOidcTokens(
    providerId: string,
    accessToken?: string,
    refreshToken?: string
  ): Promise<boolean> {
    const provider = this.getProvider(providerId);
    if (!provider || provider.type !== 'oidc') {
      return false;
    }

    return (provider as OidcProvider).revokeTokens(accessToken, refreshToken);
  }

  /**
   * Generate SAML SP metadata
   */
  generateSamlMetadata(providerId: string): string | null {
    const provider = this.getProvider(providerId);
    if (!provider || provider.type !== 'saml') {
      return null;
    }

    return (provider as SamlProvider).generateMetadata();
  }

  /**
   * Get public configuration for providers (safe to expose to clients)
   */
  getPublicConfig(tenantId?: string): Partial<SsoProviderConfig>[] {
    const providers = tenantId
      ? this.getProvidersForTenant(tenantId)
      : this.getEnabledProviders();

    return providers.map((p) => p.getPublicConfig());
  }

  /**
   * Handle successful authentication
   */
  private async handleAuthSuccess(
    provider: SamlProvider | OidcProvider,
    response: SsoAuthResponse
  ): Promise<void> {
    const user = response.user!;

    // Create SSO session
    const session: SsoSession = {
      id: this.generateSessionId(),
      userId: user.id,
      tenantId: provider.tenantId,
      providerId: provider.id,
      providerType: provider.type,
      createdAt: new Date(),
      expiresAt: response.ssoSessionExpiry
        ? new Date(response.ssoSessionExpiry)
        : new Date(Date.now() + (this.config.sessionDurationMs ?? 86400000)),
      ssoSessionId: response.ssoSessionId,
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
    };

    await this.sessionStore.set(session);

    // Update response with session ID
    response.ssoSessionId = session.id;

    // Emit success event
    await this.eventHandlers.onAuthSuccess?.({
      userId: user.id,
      tenantId: provider.tenantId,
      providerId: provider.id,
      providerType: provider.type,
      sessionId: session.id,
      timestamp: new Date(),
    });

    // Emit audit event
    await this.emitAudit({
      type: 'sso_login_success',
      tenantId: provider.tenantId,
      providerId: provider.id,
      userId: user.id,
      timestamp: new Date(),
      metadata: {
        sessionId: session.id,
        email: user.email,
      },
    });
  }

  /**
   * Handle authentication failure
   */
  private async handleAuthFailure(
    provider: SamlProvider | OidcProvider,
    response: SsoAuthResponse
  ): Promise<void> {
    // Emit failure event
    await this.eventHandlers.onAuthFailure?.({
      tenantId: provider.tenantId,
      providerId: provider.id,
      providerType: provider.type,
      error: response.error || 'Unknown error',
      errorCode: response.errorCode,
      timestamp: new Date(),
    });

    // Emit audit event
    await this.emitAudit({
      type: 'sso_login_failure',
      tenantId: provider.tenantId,
      providerId: provider.id,
      timestamp: new Date(),
      metadata: {
        error: response.error,
        errorCode: response.errorCode,
      },
    });
  }

  /**
   * Emit audit event
   */
  private async emitAudit(event: SsoAuditEvent): Promise<void> {
    if (this.eventHandlers.onAudit) {
      await this.eventHandlers.onAudit(event);
    }
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `sso_${timestamp}_${random}`;
  }
}

/**
 * Create SSO service from configuration
 */
export function createSsoService(
  config: SsoConfig,
  sessionStore?: SsoSessionStore
): SsoService {
  return new SsoService(config, sessionStore);
}

/**
 * Create default SSO configuration
 */
export function createSsoConfig(
  options: Partial<SsoConfig> & { providers?: SsoProviderConfig[] }
): SsoConfig {
  return {
    providers: options.providers || [],
    sessionDurationMs: options.sessionDurationMs || 86400000, // 24 hours
    enableAuditLog: options.enableAuditLog ?? true,
  };
}
