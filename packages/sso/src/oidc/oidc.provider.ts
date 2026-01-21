/**
 * @package @forge/sso
 * @description OIDC/OAuth 2.0 Relying Party implementation
 */

import { ErrorCode, ForgeError } from '@forge/errors';
import { UserIdentity } from '@forge/auth';
import {
  OidcProviderConfig,
  OidcSettings,
  SsoAuthRequest,
  SsoAuthResponse,
  SsoLogoutRequest,
  SsoLogoutResponse,
  SsoUserProfile,
  DEFAULT_OIDC_ATTRIBUTE_MAPPING,
  UserProvisioningCallback,
  OidcIdTokenClaims,
} from '../sso.types';
import { OidcDiscoveryService, getOidcDiscoveryService } from './oidc.discovery';
import { OidcTokenService, getOidcTokenService } from './oidc.tokens';
import { randomBytes, createHash } from 'crypto';

/**
 * OIDC state entry for tracking authorization requests
 */
interface OidcStateEntry {
  nonce: string;
  codeVerifier?: string;
  state: string;
  createdAt: Date;
  expiresAt: Date;
  relayState?: string;
}

/**
 * OIDC provider class
 */
export class OidcProvider {
  readonly type = 'oidc' as const;
  readonly id: string;
  readonly name: string;
  readonly enabled: boolean;
  readonly tenantId: string;

  private settings: OidcSettings;
  private discoveryService: OidcDiscoveryService;
  private tokenService: OidcTokenService;
  private userProvisioner?: UserProvisioningCallback;
  private stateStore: Map<string, OidcStateEntry> = new Map();
  private stateExpiryMs: number = 600000; // 10 minutes

  constructor(config: OidcProviderConfig) {
    this.id = config.id;
    this.name = config.name;
    this.enabled = config.enabled;
    this.tenantId = config.tenantId;
    this.settings = config.settings;
    this.discoveryService = getOidcDiscoveryService();
    this.tokenService = getOidcTokenService();
  }

  /**
   * Initialize the provider (fetch discovery document if needed)
   */
  async initialize(): Promise<void> {
    if (this.settings.discoveryUrl && !this.settings.authorizationEndpoint) {
      const document = await this.discoveryService.fetchDiscoveryDocument(
        this.settings.discoveryUrl
      );

      // Update settings from discovery document
      this.settings = {
        ...this.settings,
        authorizationEndpoint: document.authorization_endpoint,
        tokenEndpoint: document.token_endpoint,
        userInfoEndpoint: document.userinfo_endpoint,
        jwksUri: document.jwks_uri,
        endSessionEndpoint: document.end_session_endpoint,
        usePkce: document.code_challenge_methods_supported?.includes('S256') ?? this.settings.usePkce,
      };
    }
  }

  /**
   * Set user provisioner callback
   */
  setUserProvisioner(callback: UserProvisioningCallback): void {
    this.userProvisioner = callback;
  }

  /**
   * Generate OIDC authorization URL
   */
  generateAuthUrl(request: SsoAuthRequest): string {
    const authEndpoint = this.settings.authorizationEndpoint;
    if (!authEndpoint) {
      throw new ForgeError({
        code: ErrorCode.SSO_CONFIG_INVALID,
        message: 'Authorization endpoint not configured',
        statusCode: 400,
      });
    }

    // Generate state and nonce
    const state = this.generateRandomString(32);
    const nonce = this.generateRandomString(32);

    // Generate PKCE code verifier and challenge if enabled
    let codeVerifier: string | undefined;
    let codeChallenge: string | undefined;

    if (this.settings.usePkce) {
      codeVerifier = this.generateCodeVerifier();
      codeChallenge = this.generateCodeChallenge(codeVerifier);
    }

    // Store state for validation
    const now = new Date();
    this.stateStore.set(state, {
      nonce,
      codeVerifier,
      state,
      createdAt: now,
      expiresAt: new Date(now.getTime() + this.stateExpiryMs),
      relayState: request.relayState,
    });

    // Clean up expired states
    this.cleanupExpiredStates();

    // Build authorization URL
    const scopes = this.settings.scopes || ['openid', 'profile', 'email'];
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.settings.clientId,
      redirect_uri: this.settings.redirectUri,
      scope: scopes.join(' '),
      state,
      nonce,
    });

    if (codeChallenge) {
      params.set('code_challenge', codeChallenge);
      params.set('code_challenge_method', 'S256');
    }

    if (request.forceAuthn) {
      params.set('prompt', 'login');
    }

    if (request.loginHint) {
      params.set('login_hint', request.loginHint);
    }

    if (this.settings.acrValues) {
      params.set('acr_values', this.settings.acrValues.join(' '));
    }

    // Add custom parameters
    if (this.settings.additionalParams) {
      for (const [key, value] of Object.entries(this.settings.additionalParams)) {
        params.set(key, value);
      }
    }

    return `${authEndpoint}?${params.toString()}`;
  }

  /**
   * Process OIDC callback (authorization code exchange)
   */
  async processCallback(
    code: string,
    state: string
  ): Promise<SsoAuthResponse> {
    try {
      // Validate state
      const stateEntry = this.stateStore.get(state);
      if (!stateEntry) {
        return {
          success: false,
          error: 'Invalid or expired state parameter',
          errorCode: ErrorCode.SSO_STATE_INVALID,
        };
      }

      // Check if state has expired
      if (new Date() > stateEntry.expiresAt) {
        this.stateStore.delete(state);
        return {
          success: false,
          error: 'State parameter has expired',
          errorCode: ErrorCode.SSO_STATE_INVALID,
        };
      }

      // Remove state entry (one-time use)
      this.stateStore.delete(state);

      // Exchange code for tokens
      const tokenResponse = await this.tokenService.exchangeCode(
        this.settings,
        code,
        stateEntry.codeVerifier
      );

      // Validate ID token if present
      let claims: OidcIdTokenClaims | undefined;
      if (tokenResponse.id_token) {
        const validation = await this.tokenService.validateIdToken(
          tokenResponse.id_token,
          this.settings,
          stateEntry.nonce
        );

        if (!validation.valid) {
          return {
            success: false,
            error: validation.error || 'ID token validation failed',
            errorCode: ErrorCode.SSO_TOKEN_INVALID,
          };
        }

        claims = validation.claims;
      }

      // Fetch user info if needed
      let userInfo: Record<string, unknown> = {};
      if (tokenResponse.access_token && this.settings.userInfoEndpoint) {
        try {
          userInfo = await this.tokenService.fetchUserInfo(
            this.settings,
            tokenResponse.access_token
          );
        } catch {
          // User info fetch is optional, continue without it
        }
      }

      // Extract user profile
      const profile = this.extractUserProfile(claims, userInfo);

      // Provision user if callback is set
      let user: UserIdentity | undefined;
      if (this.userProvisioner) {
        const result = await this.userProvisioner(profile, this.tenantId, this.id);
        if (!result.success) {
          return {
            success: false,
            error: result.error || 'User provisioning failed',
            errorCode: ErrorCode.SSO_PROVIDER_ERROR,
          };
        }
        user = result.user;
      } else {
        // Create basic user identity from profile
        user = this.createUserIdentity(profile);
      }

      return {
        success: true,
        user,
        relayState: stateEntry.relayState,
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
        expiresIn: tokenResponse.expires_in,
        rawData: {
          tokenResponse,
          claims,
          userInfo,
        },
      };
    } catch (error) {
      if (error instanceof ForgeError) {
        return {
          success: false,
          error: error.message,
          errorCode: error.code,
        };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorCode: ErrorCode.SSO_PROVIDER_ERROR,
      };
    }
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken: string): Promise<SsoAuthResponse> {
    try {
      const tokenResponse = await this.tokenService.refreshToken(
        this.settings,
        refreshToken
      );

      return {
        success: true,
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
        expiresIn: tokenResponse.expires_in,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Token refresh failed',
        errorCode: ErrorCode.SSO_TOKEN_INVALID,
      };
    }
  }

  /**
   * Generate logout URL
   */
  generateLogoutUrl(request: SsoLogoutRequest): SsoLogoutResponse {
    const endSessionEndpoint = this.settings.endSessionEndpoint;
    if (!endSessionEndpoint) {
      return {
        success: false,
        error: 'End session endpoint not configured',
      };
    }

    const params = new URLSearchParams();

    if (request.idToken) {
      params.set('id_token_hint', request.idToken);
    }

    if (this.settings.postLogoutRedirectUri) {
      params.set('post_logout_redirect_uri', this.settings.postLogoutRedirectUri);
    }

    if (request.relayState) {
      params.set('state', request.relayState);
    }

    params.set('client_id', this.settings.clientId);

    return {
      success: true,
      logoutUrl: `${endSessionEndpoint}?${params.toString()}`,
      relayState: request.relayState,
    };
  }

  /**
   * Revoke tokens
   */
  async revokeTokens(
    accessToken?: string,
    refreshToken?: string
  ): Promise<boolean> {
    let success = true;

    if (accessToken) {
      const revoked = await this.tokenService.revokeToken(
        this.settings,
        accessToken,
        'access_token'
      );
      success = success && revoked;
    }

    if (refreshToken) {
      const revoked = await this.tokenService.revokeToken(
        this.settings,
        refreshToken,
        'refresh_token'
      );
      success = success && revoked;
    }

    return success;
  }

  /**
   * Get provider settings
   */
  getSettings(): OidcSettings {
    return { ...this.settings };
  }

  /**
   * Get public configuration (safe to expose to clients)
   */
  getPublicConfig(): Partial<OidcProviderConfig> {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      enabled: this.enabled,
      tenantId: this.tenantId,
      settings: {
        clientId: this.settings.clientId,
        authorizationEndpoint: this.settings.authorizationEndpoint,
        redirectUri: this.settings.redirectUri,
        scopes: this.settings.scopes,
        usePkce: this.settings.usePkce,
      } as OidcSettings,
    };
  }

  /**
   * Extract user profile from claims and user info
   */
  private extractUserProfile(
    claims?: OidcIdTokenClaims,
    userInfo?: Record<string, unknown>
  ): SsoUserProfile {
    const mapping = this.settings.attributeMapping || DEFAULT_OIDC_ATTRIBUTE_MAPPING;
    const combined = { ...claims, ...userInfo };

    const getAttribute = (key: string | undefined): string | undefined => {
      if (!key) return undefined;
      const value = combined[key];
      return typeof value === 'string' ? value : undefined;
    };

    const getAttributes = (key: string | undefined): string[] | undefined => {
      if (!key) return undefined;
      const value = combined[key];
      if (!value) return undefined;
      if (Array.isArray(value)) {
        return value.filter((v): v is string => typeof v === 'string');
      }
      return typeof value === 'string' ? [value] : undefined;
    };

    return {
      externalId: claims?.sub || getAttribute('sub') || '',
      email: getAttribute(mapping.email) || claims?.email || '',
      firstName: getAttribute(mapping.firstName),
      lastName: getAttribute(mapping.lastName),
      displayName: getAttribute(mapping.displayName) || claims?.name,
      groups: getAttributes(mapping.groups),
      rawAttributes: combined,
      providerId: this.id,
      providerType: 'oidc',
    };
  }

  /**
   * Create user identity from profile
   */
  private createUserIdentity(profile: SsoUserProfile): UserIdentity {
    return {
      id: profile.externalId,
      email: profile.email,
      tenantId: this.tenantId,
      roles: profile.groups || [],
      permissions: [],
      emailVerified: true, // OIDC IdP verified email
      mfaEnabled: false,
      metadata: {
        ssoProvider: this.id,
        ssoProviderType: 'oidc',
        firstName: profile.firstName,
        lastName: profile.lastName,
        displayName: profile.displayName,
      },
    };
  }

  /**
   * Generate random string
   */
  private generateRandomString(length: number): string {
    return randomBytes(length).toString('base64url').slice(0, length);
  }

  /**
   * Generate PKCE code verifier
   */
  private generateCodeVerifier(): string {
    return randomBytes(32).toString('base64url');
  }

  /**
   * Generate PKCE code challenge from verifier
   */
  private generateCodeChallenge(verifier: string): string {
    const hash = createHash('sha256').update(verifier).digest();
    return hash.toString('base64url');
  }

  /**
   * Clean up expired state entries
   */
  private cleanupExpiredStates(): void {
    const now = new Date();
    for (const [key, entry] of this.stateStore.entries()) {
      if (now > entry.expiresAt) {
        this.stateStore.delete(key);
      }
    }
  }

  /**
   * Set discovery service (for testing)
   */
  setDiscoveryService(service: OidcDiscoveryService): void {
    this.discoveryService = service;
  }

  /**
   * Set token service (for testing)
   */
  setTokenService(service: OidcTokenService): void {
    this.tokenService = service;
  }

  /**
   * Clear state store (for testing)
   */
  clearStateStore(): void {
    this.stateStore.clear();
  }
}

/**
 * Create an OIDC provider from configuration
 */
export function createOidcProvider(config: OidcProviderConfig): OidcProvider {
  return new OidcProvider(config);
}

/**
 * Create OIDC settings with defaults
 */
export function createOidcSettings(
  settings: Partial<OidcSettings> & {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  }
): OidcSettings {
  return {
    clientId: settings.clientId,
    clientSecret: settings.clientSecret,
    discoveryUrl: settings.discoveryUrl,
    authorizationEndpoint: settings.authorizationEndpoint,
    tokenEndpoint: settings.tokenEndpoint,
    userInfoEndpoint: settings.userInfoEndpoint,
    jwksUri: settings.jwksUri,
    endSessionEndpoint: settings.endSessionEndpoint,
    redirectUri: settings.redirectUri,
    postLogoutRedirectUri: settings.postLogoutRedirectUri,
    scopes: settings.scopes || ['openid', 'profile', 'email'],
    usePkce: settings.usePkce ?? true,
    attributeMapping: settings.attributeMapping || DEFAULT_OIDC_ATTRIBUTE_MAPPING,
    acrValues: settings.acrValues,
    additionalParams: settings.additionalParams,
  };
}
