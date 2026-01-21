/**
 * @package @forge/sso
 * @description Tests for OIDC discovery service
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  OidcDiscoveryService,
  getOidcDiscoveryService,
  resetOidcDiscoveryService,
} from '../src/oidc/oidc.discovery';
import { OidcDiscoveryDocument, OidcJwks } from '../src/sso.types';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('OidcDiscoveryService', () => {
  let service: OidcDiscoveryService;

  const mockDiscoveryDocument: OidcDiscoveryDocument = {
    issuer: 'https://idp.example.com',
    authorization_endpoint: 'https://idp.example.com/authorize',
    token_endpoint: 'https://idp.example.com/token',
    userinfo_endpoint: 'https://idp.example.com/userinfo',
    jwks_uri: 'https://idp.example.com/jwks',
    end_session_endpoint: 'https://idp.example.com/logout',
    response_types_supported: ['code', 'token', 'id_token'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256'],
    scopes_supported: ['openid', 'profile', 'email'],
    claims_supported: ['sub', 'email', 'name'],
    code_challenge_methods_supported: ['S256'],
  };

  const mockJwks: OidcJwks = {
    keys: [
      {
        kty: 'RSA',
        kid: 'key-1',
        use: 'sig',
        alg: 'RS256',
        n: 'mock-modulus',
        e: 'AQAB',
      },
      {
        kty: 'RSA',
        kid: 'key-2',
        use: 'sig',
        alg: 'RS256',
        n: 'mock-modulus-2',
        e: 'AQAB',
      },
    ],
  };

  beforeEach(() => {
    resetOidcDiscoveryService();
    service = new OidcDiscoveryService({ cacheDurationMs: 3600000 });
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should create service with default cache duration', () => {
      const defaultService = new OidcDiscoveryService();
      expect(defaultService).toBeInstanceOf(OidcDiscoveryService);
    });

    it('should create service with custom cache duration', () => {
      const customService = new OidcDiscoveryService({ cacheDurationMs: 7200000 });
      expect(customService).toBeInstanceOf(OidcDiscoveryService);
    });
  });

  describe('singleton', () => {
    it('should return singleton instance', () => {
      const service1 = getOidcDiscoveryService();
      const service2 = getOidcDiscoveryService();
      expect(service1).toBe(service2);
    });

    it('should reset singleton instance', () => {
      const service1 = getOidcDiscoveryService();
      resetOidcDiscoveryService();
      const service2 = getOidcDiscoveryService();
      expect(service1).not.toBe(service2);
    });
  });

  describe('fetchDiscoveryDocument', () => {
    it('should fetch and return discovery document', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockDiscoveryDocument),
      });

      const document = await service.fetchDiscoveryDocument(
        'https://idp.example.com/.well-known/openid-configuration'
      );

      expect(document).toEqual(mockDiscoveryDocument);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://idp.example.com/.well-known/openid-configuration'
      );
    });

    it('should cache discovery document', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockDiscoveryDocument),
      });

      const url = 'https://idp.example.com/.well-known/openid-configuration';

      // First call - should fetch
      await service.fetchDiscoveryDocument(url);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      await service.fetchDiscoveryDocument(url);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should throw error on fetch failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      await expect(
        service.fetchDiscoveryDocument(
          'https://idp.example.com/.well-known/openid-configuration'
        )
      ).rejects.toThrow('Failed to fetch OIDC discovery document');
    });

    it('should throw error for invalid document', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ issuer: 'https://idp.example.com' }), // Missing required fields
      });

      await expect(
        service.fetchDiscoveryDocument(
          'https://idp.example.com/.well-known/openid-configuration'
        )
      ).rejects.toThrow('Invalid OIDC discovery document');
    });
  });

  describe('fetchJwks', () => {
    it('should fetch and return JWKS', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockJwks),
      });

      const jwks = await service.fetchJwks('https://idp.example.com/jwks');

      expect(jwks).toEqual(mockJwks);
      expect(mockFetch).toHaveBeenCalledWith('https://idp.example.com/jwks');
    });

    it('should cache JWKS', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockJwks),
      });

      const url = 'https://idp.example.com/jwks';

      // First call - should fetch
      await service.fetchJwks(url);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      await service.fetchJwks(url);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should throw error on fetch failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(
        service.fetchJwks('https://idp.example.com/jwks')
      ).rejects.toThrow('Failed to fetch JWKS');
    });

    it('should throw error for invalid JWKS', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ notKeys: [] }), // Missing keys array
      });

      await expect(
        service.fetchJwks('https://idp.example.com/jwks')
      ).rejects.toThrow('Invalid JWKS');
    });
  });

  describe('getKey', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockJwks),
      });
    });

    it('should get key by kid', async () => {
      const key = await service.getKey('https://idp.example.com/jwks', 'key-1');

      expect(key).toBeDefined();
      expect(key?.kid).toBe('key-1');
    });

    it('should return undefined for non-existent kid', async () => {
      const key = await service.getKey('https://idp.example.com/jwks', 'non-existent');

      expect(key).toBeUndefined();
    });

    it('should return first signing key when no kid specified', async () => {
      const key = await service.getKey('https://idp.example.com/jwks');

      expect(key).toBeDefined();
      expect(key?.use).toBe('sig');
    });
  });

  describe('buildDiscoveryUrl', () => {
    it('should build discovery URL from issuer', () => {
      const url = OidcDiscoveryService.buildDiscoveryUrl('https://idp.example.com');
      expect(url).toBe('https://idp.example.com/.well-known/openid-configuration');
    });

    it('should handle trailing slash', () => {
      const url = OidcDiscoveryService.buildDiscoveryUrl('https://idp.example.com/');
      expect(url).toBe('https://idp.example.com/.well-known/openid-configuration');
    });
  });

  describe('extractSettingsFromDiscovery', () => {
    it('should extract settings from discovery document', () => {
      const settings = service.extractSettingsFromDiscovery(mockDiscoveryDocument, {
        clientId: 'client-123',
        clientSecret: 'secret-123',
        redirectUri: 'https://app.example.com/callback',
      });

      expect(settings.clientId).toBe('client-123');
      expect(settings.clientSecret).toBe('secret-123');
      expect(settings.authorizationEndpoint).toBe(mockDiscoveryDocument.authorization_endpoint);
      expect(settings.tokenEndpoint).toBe(mockDiscoveryDocument.token_endpoint);
      expect(settings.userInfoEndpoint).toBe(mockDiscoveryDocument.userinfo_endpoint);
      expect(settings.jwksUri).toBe(mockDiscoveryDocument.jwks_uri);
      expect(settings.endSessionEndpoint).toBe(mockDiscoveryDocument.end_session_endpoint);
      expect(settings.usePkce).toBe(true);
    });

    it('should use custom scopes when provided', () => {
      const settings = service.extractSettingsFromDiscovery(mockDiscoveryDocument, {
        clientId: 'client-123',
        clientSecret: 'secret-123',
        redirectUri: 'https://app.example.com/callback',
        scopes: ['openid', 'profile', 'email', 'custom'],
      });

      expect(settings.scopes).toEqual(['openid', 'profile', 'email', 'custom']);
    });
  });

  describe('cache management', () => {
    it('should clear discovery cache', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockDiscoveryDocument),
      });

      const url = 'https://idp.example.com/.well-known/openid-configuration';

      await service.fetchDiscoveryDocument(url);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      service.clearDiscoveryCache();

      await service.fetchDiscoveryDocument(url);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should clear JWKS cache', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockJwks),
      });

      const url = 'https://idp.example.com/jwks';

      await service.fetchJwks(url);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      service.clearJwksCache();

      await service.fetchJwks(url);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should clear all caches', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockDiscoveryDocument),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockJwks),
        });

      await service.fetchDiscoveryDocument('https://idp.example.com/.well-known/openid-configuration');
      await service.fetchJwks('https://idp.example.com/jwks');

      const stats = service.getCacheStats();
      expect(stats.discoveryEntries).toBe(1);
      expect(stats.jwksEntries).toBe(1);

      service.clearAllCaches();

      const clearedStats = service.getCacheStats();
      expect(clearedStats.discoveryEntries).toBe(0);
      expect(clearedStats.jwksEntries).toBe(0);
    });
  });
});
