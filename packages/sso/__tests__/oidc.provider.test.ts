/**
 * @package @forge/sso
 * @description Tests for OIDC provider
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  OidcProvider,
  createOidcProvider,
  createOidcSettings,
} from '../src/oidc/oidc.provider';
import { OidcProviderConfig, OidcSettings } from '../src/sso.types';
import { OidcTokenService, resetOidcTokenService } from '../src/oidc/oidc.tokens';
import { OidcDiscoveryService, resetOidcDiscoveryService } from '../src/oidc/oidc.discovery';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('OidcProvider', () => {
  let provider: OidcProvider;

  const mockSettings: OidcSettings = {
    clientId: 'client-123',
    clientSecret: 'secret-123',
    authorizationEndpoint: 'https://idp.example.com/authorize',
    tokenEndpoint: 'https://idp.example.com/token',
    userInfoEndpoint: 'https://idp.example.com/userinfo',
    jwksUri: 'https://idp.example.com/jwks',
    endSessionEndpoint: 'https://idp.example.com/logout',
    redirectUri: 'https://app.example.com/callback',
    postLogoutRedirectUri: 'https://app.example.com',
    scopes: ['openid', 'profile', 'email'],
    usePkce: true,
  };

  const mockConfig: OidcProviderConfig = {
    type: 'oidc',
    id: 'test-oidc-provider',
    name: 'Test OIDC Provider',
    enabled: true,
    tenantId: 'tenant-123',
    settings: mockSettings,
  };

  beforeEach(async () => {
    resetOidcTokenService();
    resetOidcDiscoveryService();
    mockFetch.mockReset();
    provider = createOidcProvider(mockConfig);
    await provider.initialize();
  });

  afterEach(() => {
    provider.clearStateStore();
  });

  describe('constructor', () => {
    it('should create provider with correct properties', () => {
      expect(provider.type).toBe('oidc');
      expect(provider.id).toBe('test-oidc-provider');
      expect(provider.name).toBe('Test OIDC Provider');
      expect(provider.enabled).toBe(true);
      expect(provider.tenantId).toBe('tenant-123');
    });
  });

  describe('generateAuthUrl', () => {
    it('should generate valid authorization URL', () => {
      const url = provider.generateAuthUrl({
        returnUrl: 'https://app.example.com/dashboard',
      });

      expect(url).toContain('https://idp.example.com/authorize');
      expect(url).toContain('response_type=code');
      expect(url).toContain('client_id=client-123');
      expect(url).toContain('redirect_uri=');
      expect(url).toContain('scope=openid+profile+email');
      expect(url).toContain('state=');
      expect(url).toContain('nonce=');
    });

    it('should include PKCE parameters when enabled', () => {
      const url = provider.generateAuthUrl({
        returnUrl: 'https://app.example.com/dashboard',
      });

      expect(url).toContain('code_challenge=');
      expect(url).toContain('code_challenge_method=S256');
    });

    it('should not include PKCE when disabled', async () => {
      const noPkceSettings = { ...mockSettings, usePkce: false };
      const noPkceConfig = { ...mockConfig, settings: noPkceSettings };
      const noPkceProvider = createOidcProvider(noPkceConfig);
      await noPkceProvider.initialize();

      const url = noPkceProvider.generateAuthUrl({
        returnUrl: 'https://app.example.com/dashboard',
      });

      expect(url).not.toContain('code_challenge=');
      expect(url).not.toContain('code_challenge_method=');
    });

    it('should include login hint when provided', () => {
      const url = provider.generateAuthUrl({
        returnUrl: 'https://app.example.com/dashboard',
        loginHint: 'user@example.com',
      });

      expect(url).toContain('login_hint=user%40example.com');
    });

    it('should include prompt=login when forceAuthn is true', () => {
      const url = provider.generateAuthUrl({
        returnUrl: 'https://app.example.com/dashboard',
        forceAuthn: true,
      });

      expect(url).toContain('prompt=login');
    });

    it('should throw error when authorization endpoint not configured', async () => {
      const noAuthSettings = { ...mockSettings, authorizationEndpoint: undefined };
      const noAuthConfig = { ...mockConfig, settings: noAuthSettings };
      const noAuthProvider = createOidcProvider(noAuthConfig);
      await noAuthProvider.initialize();

      expect(() =>
        noAuthProvider.generateAuthUrl({
          returnUrl: 'https://app.example.com/dashboard',
        })
      ).toThrow('Authorization endpoint not configured');
    });
  });

  describe('processCallback', () => {
    const mockTokenResponse = {
      access_token: 'access-token-123',
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: 'refresh-token-123',
      id_token: '',
    };

    beforeEach(() => {
      // Generate a valid ID token
      const now = Math.floor(Date.now() / 1000);
      const payload = {
        iss: 'https://idp.example.com',
        sub: 'user-123',
        aud: 'client-123',
        exp: now + 3600,
        iat: now,
        nonce: '', // Will be set dynamically
        email: 'user@example.com',
        name: 'John Doe',
        given_name: 'John',
        family_name: 'Doe',
      };

      mockTokenResponse.id_token = `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;
    });

    it('should return error for invalid state', async () => {
      const response = await provider.processCallback('code-123', 'invalid-state');

      expect(response.success).toBe(false);
      expect(response.error).toContain('Invalid or expired state');
    });

    it('should exchange code for tokens on valid state', async () => {
      // Generate auth URL to create state entry
      const authUrl = provider.generateAuthUrl({
        returnUrl: 'https://app.example.com/dashboard',
      });

      // Extract state from URL
      const url = new URL(authUrl);
      const state = url.searchParams.get('state')!;
      const nonce = url.searchParams.get('nonce')!;

      // Update ID token with correct nonce and valid JWT header
      const now = Math.floor(Date.now() / 1000);
      const header = {
        alg: 'RS256',
        typ: 'JWT',
        kid: 'key-1',
      };
      const payload = {
        iss: 'https://idp.example.com',
        sub: 'user-123',
        aud: 'client-123',
        exp: now + 3600,
        iat: now,
        nonce,
        email: 'user@example.com',
        name: 'John Doe',
      };

      const tokenResponse = {
        ...mockTokenResponse,
        id_token: `${Buffer.from(JSON.stringify(header)).toString('base64url')}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`,
      };

      // Mock JWKS response for signature validation
      const jwksResponse = {
        keys: [
          {
            kty: 'RSA',
            kid: 'key-1',
            alg: 'RS256',
            use: 'sig',
            n: 'test-modulus',
            e: 'AQAB',
          },
        ],
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(tokenResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(jwksResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              sub: 'user-123',
              email: 'user@example.com',
              name: 'John Doe',
            }),
        });

      const response = await provider.processCallback('code-123', state);

      expect(response.success).toBe(true);
      expect(response.user).toBeDefined();
      expect(response.accessToken).toBe('access-token-123');
    });

    it('should handle token exchange failure', async () => {
      // Generate auth URL to create state entry
      const authUrl = provider.generateAuthUrl({
        returnUrl: 'https://app.example.com/dashboard',
      });

      const url = new URL(authUrl);
      const state = url.searchParams.get('state')!;

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve('invalid_grant'),
      });

      const response = await provider.processCallback('invalid-code', state);

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
    });
  });

  describe('generateLogoutUrl', () => {
    it('should generate logout URL', () => {
      const response = provider.generateLogoutUrl({
        userId: 'user-123',
        returnUrl: 'https://app.example.com',
        idToken: 'id-token-123',
      });

      expect(response.success).toBe(true);
      expect(response.logoutUrl).toContain('https://idp.example.com/logout');
      expect(response.logoutUrl).toContain('id_token_hint=id-token-123');
      expect(response.logoutUrl).toContain('post_logout_redirect_uri=');
    });

    it('should include relay state when provided', () => {
      const response = provider.generateLogoutUrl({
        userId: 'user-123',
        returnUrl: 'https://app.example.com',
        relayState: 'custom-state',
      });

      expect(response.success).toBe(true);
      expect(response.logoutUrl).toContain('state=custom-state');
    });

    it('should return error when end session endpoint not configured', async () => {
      const noLogoutSettings = { ...mockSettings, endSessionEndpoint: undefined };
      const noLogoutConfig = { ...mockConfig, settings: noLogoutSettings };
      const noLogoutProvider = createOidcProvider(noLogoutConfig);
      await noLogoutProvider.initialize();

      const response = noLogoutProvider.generateLogoutUrl({
        userId: 'user-123',
        returnUrl: 'https://app.example.com',
      });

      expect(response.success).toBe(false);
      expect(response.error).toContain('End session endpoint not configured');
    });
  });

  describe('refreshAccessToken', () => {
    it('should refresh access token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: 'new-access-token',
            token_type: 'Bearer',
            expires_in: 3600,
            refresh_token: 'new-refresh-token',
          }),
      });

      const response = await provider.refreshAccessToken('refresh-token-123');

      expect(response.success).toBe(true);
      expect(response.accessToken).toBe('new-access-token');
    });

    it('should handle refresh failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
      });

      const response = await provider.refreshAccessToken('expired-refresh-token');

      expect(response.success).toBe(false);
    });
  });

  describe('getSettings', () => {
    it('should return a copy of settings', () => {
      const settings = provider.getSettings();

      expect(settings).toEqual(mockSettings);
      expect(settings).not.toBe(mockSettings);
    });
  });

  describe('getPublicConfig', () => {
    it('should return safe public configuration', () => {
      const config = provider.getPublicConfig();

      expect(config.type).toBe('oidc');
      expect(config.id).toBe('test-oidc-provider');
      expect(config.name).toBe('Test OIDC Provider');
      expect(config.enabled).toBe(true);
      expect(config.tenantId).toBe('tenant-123');

      // Should include safe settings
      const settings = config.settings as OidcSettings;
      expect(settings.clientId).toBe(mockSettings.clientId);
      expect(settings.scopes).toEqual(mockSettings.scopes);

      // Should not include secret
      expect(settings.clientSecret).toBeUndefined();
    });
  });
});

describe('createOidcSettings', () => {
  it('should create settings with defaults', () => {
    const settings = createOidcSettings({
      clientId: 'client-123',
      clientSecret: 'secret-123',
      redirectUri: 'https://app.example.com/callback',
    });

    expect(settings.clientId).toBe('client-123');
    expect(settings.clientSecret).toBe('secret-123');
    expect(settings.redirectUri).toBe('https://app.example.com/callback');
    expect(settings.scopes).toEqual(['openid', 'profile', 'email']);
    expect(settings.usePkce).toBe(true);
  });

  it('should override defaults with provided values', () => {
    const settings = createOidcSettings({
      clientId: 'client-123',
      clientSecret: 'secret-123',
      redirectUri: 'https://app.example.com/callback',
      scopes: ['openid', 'profile', 'email', 'groups'],
      usePkce: false,
    });

    expect(settings.scopes).toEqual(['openid', 'profile', 'email', 'groups']);
    expect(settings.usePkce).toBe(false);
  });
});
