/**
 * @package @forge/sso
 * @description Tests for OIDC token service
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  OidcTokenService,
  getOidcTokenService,
  resetOidcTokenService,
} from '../src/oidc/oidc.tokens';
import { OidcSettings, OidcIdTokenClaims } from '../src/sso.types';
import { OidcDiscoveryService, resetOidcDiscoveryService } from '../src/oidc/oidc.discovery';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('OidcTokenService', () => {
  let service: OidcTokenService;

  const mockSettings: OidcSettings = {
    clientId: 'client-123',
    clientSecret: 'secret-123',
    authorizationEndpoint: 'https://idp.example.com/authorize',
    tokenEndpoint: 'https://idp.example.com/token',
    userInfoEndpoint: 'https://idp.example.com/userinfo',
    jwksUri: 'https://idp.example.com/jwks',
    endSessionEndpoint: 'https://idp.example.com/logout',
    redirectUri: 'https://app.example.com/callback',
    scopes: ['openid', 'profile', 'email'],
    usePkce: true,
  };

  const mockTokenResponse = {
    access_token: 'access-token-123',
    token_type: 'Bearer',
    expires_in: 3600,
    refresh_token: 'refresh-token-123',
    id_token: 'header.payload.signature',
  };

  beforeEach(() => {
    resetOidcTokenService();
    resetOidcDiscoveryService();
    service = getOidcTokenService();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('singleton', () => {
    it('should return singleton instance', () => {
      const service1 = getOidcTokenService();
      const service2 = getOidcTokenService();
      expect(service1).toBe(service2);
    });

    it('should reset singleton instance', () => {
      const service1 = getOidcTokenService();
      resetOidcTokenService();
      const service2 = getOidcTokenService();
      expect(service1).not.toBe(service2);
    });
  });

  describe('exchangeCode', () => {
    it('should exchange authorization code for tokens', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTokenResponse),
      });

      const response = await service.exchangeCode(mockSettings, 'auth-code-123');

      expect(response).toEqual(mockTokenResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        mockSettings.tokenEndpoint,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded',
          }),
        })
      );

      // Check body contains expected parameters
      const call = mockFetch.mock.calls[0];
      const body = call[1].body as string;
      expect(body).toContain('grant_type=authorization_code');
      expect(body).toContain('client_id=client-123');
      expect(body).toContain('code=auth-code-123');
    });

    it('should include code verifier when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTokenResponse),
      });

      await service.exchangeCode(mockSettings, 'auth-code-123', 'code-verifier-123');

      const call = mockFetch.mock.calls[0];
      const body = call[1].body as string;
      expect(body).toContain('code_verifier=code-verifier-123');
    });

    it('should throw error when token endpoint not configured', async () => {
      const settingsWithoutToken = { ...mockSettings, tokenEndpoint: undefined };

      await expect(
        service.exchangeCode(settingsWithoutToken, 'auth-code-123')
      ).rejects.toThrow('Token endpoint not configured');
    });

    it('should throw error on exchange failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve('invalid_grant'),
      });

      await expect(
        service.exchangeCode(mockSettings, 'invalid-code')
      ).rejects.toThrow('Token exchange failed');
    });
  });

  describe('refreshToken', () => {
    it('should refresh access token', async () => {
      const refreshedResponse = {
        ...mockTokenResponse,
        access_token: 'new-access-token',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(refreshedResponse),
      });

      const response = await service.refreshToken(mockSettings, 'refresh-token-123');

      expect(response.access_token).toBe('new-access-token');

      const call = mockFetch.mock.calls[0];
      const body = call[1].body as string;
      expect(body).toContain('grant_type=refresh_token');
      expect(body).toContain('refresh_token=refresh-token-123');
    });

    it('should throw error on refresh failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
      });

      await expect(
        service.refreshToken(mockSettings, 'expired-token')
      ).rejects.toThrow('Token refresh failed');
    });
  });

  describe('fetchUserInfo', () => {
    it('should fetch user info', async () => {
      const userInfo = {
        sub: 'user-123',
        email: 'user@example.com',
        name: 'John Doe',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(userInfo),
      });

      const response = await service.fetchUserInfo(mockSettings, 'access-token-123');

      expect(response).toEqual(userInfo);
      expect(mockFetch).toHaveBeenCalledWith(
        mockSettings.userInfoEndpoint,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer access-token-123',
          }),
        })
      );
    });

    it('should throw error when userinfo endpoint not configured', async () => {
      const settingsWithoutUserInfo = { ...mockSettings, userInfoEndpoint: undefined };

      await expect(
        service.fetchUserInfo(settingsWithoutUserInfo, 'access-token-123')
      ).rejects.toThrow('UserInfo endpoint not configured');
    });

    it('should throw error on fetch failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      await expect(
        service.fetchUserInfo(mockSettings, 'invalid-token')
      ).rejects.toThrow('Failed to fetch user info');
    });
  });

  describe('decodeIdToken', () => {
    it('should decode valid ID token', () => {
      const payload = {
        iss: 'https://idp.example.com',
        sub: 'user-123',
        aud: 'client-123',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        email: 'user@example.com',
      };

      const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
      const idToken = `header.${encodedPayload}.signature`;

      const claims = service.decodeIdToken(idToken);

      expect(claims).toBeDefined();
      expect(claims?.iss).toBe('https://idp.example.com');
      expect(claims?.sub).toBe('user-123');
      expect(claims?.email).toBe('user@example.com');
    });

    it('should return null for invalid token format', () => {
      const claims = service.decodeIdToken('invalid-token');
      expect(claims).toBeNull();
    });

    it('should return null for invalid JSON payload', () => {
      const invalidPayload = Buffer.from('not-json').toString('base64url');
      const idToken = `header.${invalidPayload}.signature`;

      const claims = service.decodeIdToken(idToken);
      expect(claims).toBeNull();
    });
  });

  describe('validateClaims', () => {
    it('should validate valid claims', () => {
      const now = Math.floor(Date.now() / 1000);
      const claims: OidcIdTokenClaims = {
        iss: 'https://idp.example.com',
        sub: 'user-123',
        aud: 'client-123',
        exp: now + 3600,
        iat: now,
      };

      const result = service.validateClaims(claims, mockSettings);

      expect(result.valid).toBe(true);
      expect(result.claims).toEqual(claims);
    });

    it('should reject expired token', () => {
      const now = Math.floor(Date.now() / 1000);
      const claims: OidcIdTokenClaims = {
        iss: 'https://idp.example.com',
        sub: 'user-123',
        aud: 'client-123',
        exp: now - 3600, // Expired
        iat: now - 7200,
      };

      const result = service.validateClaims(claims, mockSettings);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('expired');
    });

    it('should reject token issued in the future', () => {
      const now = Math.floor(Date.now() / 1000);
      const claims: OidcIdTokenClaims = {
        iss: 'https://idp.example.com',
        sub: 'user-123',
        aud: 'client-123',
        exp: now + 7200,
        iat: now + 600, // Too far in the future
      };

      const result = service.validateClaims(claims, mockSettings);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('future');
    });

    it('should reject audience mismatch', () => {
      const now = Math.floor(Date.now() / 1000);
      const claims: OidcIdTokenClaims = {
        iss: 'https://idp.example.com',
        sub: 'user-123',
        aud: 'wrong-client',
        exp: now + 3600,
        iat: now,
      };

      const result = service.validateClaims(claims, mockSettings);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Audience mismatch');
    });

    it('should handle multiple audiences', () => {
      const now = Math.floor(Date.now() / 1000);
      const claims: OidcIdTokenClaims = {
        iss: 'https://idp.example.com',
        sub: 'user-123',
        aud: ['client-123', 'other-client'],
        exp: now + 3600,
        iat: now,
        azp: 'client-123',
      };

      const result = service.validateClaims(claims, mockSettings);

      expect(result.valid).toBe(true);
    });

    it('should reject azp mismatch with multiple audiences', () => {
      const now = Math.floor(Date.now() / 1000);
      const claims: OidcIdTokenClaims = {
        iss: 'https://idp.example.com',
        sub: 'user-123',
        aud: ['client-123', 'other-client'],
        exp: now + 3600,
        iat: now,
        azp: 'wrong-client',
      };

      const result = service.validateClaims(claims, mockSettings);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Authorized party mismatch');
    });

    it('should validate nonce when expected', () => {
      const now = Math.floor(Date.now() / 1000);
      const claims: OidcIdTokenClaims = {
        iss: 'https://idp.example.com',
        sub: 'user-123',
        aud: 'client-123',
        exp: now + 3600,
        iat: now,
        nonce: 'expected-nonce',
      };

      const result = service.validateClaims(claims, mockSettings, 'expected-nonce');
      expect(result.valid).toBe(true);
    });

    it('should reject nonce mismatch', () => {
      const now = Math.floor(Date.now() / 1000);
      const claims: OidcIdTokenClaims = {
        iss: 'https://idp.example.com',
        sub: 'user-123',
        aud: 'client-123',
        exp: now + 3600,
        iat: now,
        nonce: 'wrong-nonce',
      };

      const result = service.validateClaims(claims, mockSettings, 'expected-nonce');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Nonce mismatch');
    });
  });

  describe('revokeToken', () => {
    it('should revoke token successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
      });

      const result = await service.revokeToken(mockSettings, 'token-123', 'access_token');

      expect(result).toBe(true);

      const call = mockFetch.mock.calls[0];
      const body = call[1].body as string;
      expect(body).toContain('token=token-123');
      expect(body).toContain('token_type_hint=access_token');
    });

    it('should return false on revocation failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
      });

      const result = await service.revokeToken(mockSettings, 'invalid-token', 'access_token');

      expect(result).toBe(false);
    });

    it('should return false when no revocation endpoint', async () => {
      const settingsWithoutToken = { ...mockSettings, tokenEndpoint: undefined };

      const result = await service.revokeToken(settingsWithoutToken, 'token-123', 'access_token');

      expect(result).toBe(false);
    });
  });
});
