/**
 * @package @forge/auth
 * @description OAuth authentication provider base
 */

import { ErrorCode, ForgeError } from '@forge/errors';
import {
  AuthResult,
  Credentials,
  UserIdentity,
  AuthProviderConfig,
  OAuthProviderConfig,
  OAuthAuthorizationResult,
  OAuthCallbackResult,
} from '../auth.types';
import { BaseAuthProvider } from './base';

/**
 * OAuth state data stored during auth flow
 */
export interface OAuthStateData {
  state: string;
  codeVerifier?: string;
  redirectUri: string;
  tenantId: string;
  createdAt: Date;
  expiresAt: Date;
}

/**
 * OAuth token response
 */
export interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  id_token?: string;
}

/**
 * OAuth user info (generic)
 */
export interface OAuthUserInfo {
  id: string;
  email?: string;
  name?: string;
  picture?: string;
  [key: string]: unknown;
}

/**
 * User provisioning callback
 */
export type OAuthUserProvisionCallback = (
  userInfo: OAuthUserInfo,
  tenantId: string,
  providerId: string
) => Promise<UserIdentity | null>;

/**
 * OAuth provider configuration
 */
export interface OAuthProviderOptions {
  /** Provider ID */
  id: string;
  /** Provider display name */
  name: string;
  /** Whether provider is enabled */
  enabled: boolean;
  /** OAuth settings */
  settings: OAuthProviderConfig['settings'];
  /** User provisioning callback */
  userProvisioner: OAuthUserProvisionCallback;
  /** State storage duration in seconds */
  stateDurationSeconds?: number;
}

/**
 * Base OAuth authentication provider
 */
export class OAuthProvider extends BaseAuthProvider {
  readonly type = 'oauth' as const;
  readonly id: string;
  readonly name: string;
  readonly enabled: boolean;

  protected settings: OAuthProviderConfig['settings'];
  protected userProvisioner: OAuthUserProvisionCallback;
  protected stateDurationSeconds: number;
  protected stateStorage: Map<string, OAuthStateData> = new Map();

  constructor(options: OAuthProviderOptions) {
    super();
    this.id = options.id;
    this.name = options.name;
    this.enabled = options.enabled;
    this.settings = options.settings;
    this.userProvisioner = options.userProvisioner;
    this.stateDurationSeconds = options.stateDurationSeconds ?? 600; // 10 minutes
  }

  /**
   * OAuth providers don't authenticate directly via credentials
   */
  async authenticate(_credentials: Credentials, _tenantId: string): Promise<AuthResult> {
    return {
      success: false,
      error: 'OAuth providers require redirect-based authentication',
      errorCode: ErrorCode.VALIDATION_FAILED,
    };
  }

  /**
   * OAuth providers don't handle password credentials
   */
  canHandle(_credentials: Credentials): boolean {
    return false;
  }

  /**
   * Get authorization URL for OAuth flow
   */
  getAuthorizationUrl(tenantId: string, options: {
    redirectUri?: string;
    scopes?: string[];
    state?: string;
  } = {}): OAuthAuthorizationResult {
    const state = options.state ?? this.generateState();
    const redirectUri = options.redirectUri ?? this.settings.redirectUri;
    const scopes = options.scopes ?? this.settings.scopes;

    // Generate PKCE code verifier and challenge (optional)
    const { codeVerifier, codeChallenge } = this.generatePkce();

    // Store state data
    const stateData: OAuthStateData = {
      state,
      codeVerifier,
      redirectUri,
      tenantId,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.stateDurationSeconds * 1000),
    };
    this.stateStorage.set(state, stateData);

    // Build authorization URL
    const params = new URLSearchParams({
      client_id: this.settings.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopes.join(' '),
      state,
    });

    if (codeChallenge) {
      params.set('code_challenge', codeChallenge);
      params.set('code_challenge_method', 'S256');
    }

    const authorizationUrl = `${this.settings.authorizationUrl}?${params.toString()}`;

    return {
      authorizationUrl,
      state,
      codeVerifier,
    };
  }

  /**
   * Handle OAuth callback
   */
  async handleCallback(
    code: string,
    state: string,
    options: { redirectUri?: string } = {}
  ): Promise<OAuthCallbackResult> {
    // Verify state
    const stateData = this.stateStorage.get(state);
    if (!stateData) {
      return {
        success: false,
        error: 'Invalid or expired state parameter',
      };
    }

    // Check state expiry
    if (new Date() > stateData.expiresAt) {
      this.stateStorage.delete(state);
      return {
        success: false,
        error: 'State parameter has expired',
      };
    }

    // Clean up state
    this.stateStorage.delete(state);

    try {
      // Exchange code for tokens
      const tokens = await this.exchangeCodeForTokens(
        code,
        options.redirectUri ?? stateData.redirectUri,
        stateData.codeVerifier
      );

      // Get user info
      const userInfo = await this.getUserInfo(tokens.access_token);

      // Provision user
      const user = await this.userProvisioner(userInfo, stateData.tenantId, this.id);
      if (!user) {
        return {
          success: false,
          error: 'Failed to provision user',
        };
      }

      return {
        success: true,
        user,
        providerAccessToken: tokens.access_token,
        providerRefreshToken: tokens.refresh_token,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'OAuth callback failed',
      };
    }
  }

  /**
   * Exchange authorization code for tokens
   */
  protected async exchangeCodeForTokens(
    code: string,
    redirectUri: string,
    codeVerifier?: string
  ): Promise<OAuthTokenResponse> {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.settings.clientId,
      client_secret: this.settings.clientSecret,
      code,
      redirect_uri: redirectUri,
    });

    if (codeVerifier) {
      params.set('code_verifier', codeVerifier);
    }

    const response = await fetch(this.settings.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new ForgeError({
        code: ErrorCode.UNAUTHENTICATED,
        message: `Token exchange failed: ${errorText}`,
        statusCode: response.status,
      });
    }

    return response.json() as Promise<OAuthTokenResponse>;
  }

  /**
   * Get user info from OAuth provider
   */
  protected async getUserInfo(accessToken: string): Promise<OAuthUserInfo> {
    const response = await fetch(this.settings.userInfoUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new ForgeError({
        code: ErrorCode.UNAUTHENTICATED,
        message: 'Failed to get user info',
        statusCode: response.status,
      });
    }

    return response.json() as Promise<OAuthUserInfo>;
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
      settings: {
        // Only expose safe settings
        clientId: this.settings.clientId,
        authorizationUrl: this.settings.authorizationUrl,
        scopes: this.settings.scopes,
        redirectUri: this.settings.redirectUri,
      } as OAuthProviderConfig['settings'],
    };
  }

  /**
   * Generate random state parameter
   */
  protected generateState(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Generate PKCE code verifier and challenge
   */
  protected generatePkce(): { codeVerifier?: string; codeChallenge?: string } {
    // Generate code verifier
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const codeVerifier = this.base64UrlEncode(array);

    // Generate code challenge (SHA-256 hash)
    // Note: In browser/Node environments, use SubtleCrypto
    // For simplicity, return verifier only (server should compute challenge)
    return { codeVerifier, codeChallenge: undefined };
  }

  /**
   * Base64 URL encode
   */
  protected base64UrlEncode(buffer: Uint8Array): string {
    const base64 = btoa(String.fromCharCode(...buffer));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  /**
   * Refresh OAuth access token
   */
  async refreshAccessToken(refreshToken: string): Promise<OAuthTokenResponse | null> {
    try {
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: this.settings.clientId,
        client_secret: this.settings.clientSecret,
        refresh_token: refreshToken,
      });

      const response = await fetch(this.settings.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        return null;
      }

      return response.json() as Promise<OAuthTokenResponse>;
    } catch {
      return null;
    }
  }

  /**
   * Revoke OAuth token
   */
  async revokeToken(token: string, tokenType: 'access_token' | 'refresh_token' = 'access_token'): Promise<boolean> {
    // Note: Revocation endpoint varies by provider
    // This is a generic implementation that may need customization
    try {
      const params = new URLSearchParams({
        token,
        token_type_hint: tokenType,
        client_id: this.settings.clientId,
        client_secret: this.settings.clientSecret,
      });

      // Construct revocation URL (typically same host as token URL)
      const tokenUrlObj = new URL(this.settings.tokenUrl);
      const revokeUrl = `${tokenUrlObj.origin}${tokenUrlObj.pathname.replace('/token', '/revoke')}`;

      const response = await fetch(revokeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Clean up expired state data
   */
  cleanupExpiredStates(): number {
    const now = new Date();
    let cleaned = 0;

    for (const [state, data] of this.stateStorage.entries()) {
      if (now > data.expiresAt) {
        this.stateStorage.delete(state);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Set user provisioner (for testing)
   */
  setUserProvisioner(provisioner: OAuthUserProvisionCallback): void {
    this.userProvisioner = provisioner;
  }

  /**
   * Clear state storage (for testing)
   */
  clearStateStorage(): void {
    this.stateStorage.clear();
  }
}

/**
 * Create a Google OAuth provider
 */
export function createGoogleProvider(
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  userProvisioner: OAuthUserProvisionCallback,
  options: { id?: string; name?: string; enabled?: boolean } = {}
): OAuthProvider {
  return new OAuthProvider({
    id: options.id ?? 'google',
    name: options.name ?? 'Google',
    enabled: options.enabled ?? true,
    settings: {
      clientId,
      clientSecret,
      authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
      scopes: ['openid', 'email', 'profile'],
      redirectUri,
    },
    userProvisioner,
  });
}

/**
 * Create a GitHub OAuth provider
 */
export function createGitHubProvider(
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  userProvisioner: OAuthUserProvisionCallback,
  options: { id?: string; name?: string; enabled?: boolean } = {}
): OAuthProvider {
  return new OAuthProvider({
    id: options.id ?? 'github',
    name: options.name ?? 'GitHub',
    enabled: options.enabled ?? true,
    settings: {
      clientId,
      clientSecret,
      authorizationUrl: 'https://github.com/login/oauth/authorize',
      tokenUrl: 'https://github.com/login/oauth/access_token',
      userInfoUrl: 'https://api.github.com/user',
      scopes: ['read:user', 'user:email'],
      redirectUri,
    },
    userProvisioner,
  });
}

/**
 * Create a Microsoft OAuth provider
 */
export function createMicrosoftProvider(
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  userProvisioner: OAuthUserProvisionCallback,
  options: { id?: string; name?: string; enabled?: boolean; tenantId?: string } = {}
): OAuthProvider {
  const tenantId = options.tenantId ?? 'common';
  return new OAuthProvider({
    id: options.id ?? 'microsoft',
    name: options.name ?? 'Microsoft',
    enabled: options.enabled ?? true,
    settings: {
      clientId,
      clientSecret,
      authorizationUrl: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`,
      tokenUrl: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
      scopes: ['openid', 'email', 'profile', 'User.Read'],
      redirectUri,
    },
    userProvisioner,
  });
}
