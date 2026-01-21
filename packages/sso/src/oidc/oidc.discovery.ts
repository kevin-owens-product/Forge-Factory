/**
 * @package @forge/sso
 * @description OIDC discovery document handling
 */

import { ErrorCode, ForgeError } from '@forge/errors';
import {
  OidcDiscoveryDocument,
  OidcJwks,
  OidcJwk,
  OidcSettings,
} from '../sso.types';

/**
 * Discovery cache entry
 */
interface DiscoveryCacheEntry {
  document: OidcDiscoveryDocument;
  fetchedAt: Date;
  expiresAt: Date;
}

/**
 * JWKS cache entry
 */
interface JwksCacheEntry {
  jwks: OidcJwks;
  fetchedAt: Date;
  expiresAt: Date;
}

/**
 * OIDC discovery service
 */
export class OidcDiscoveryService {
  private discoveryCache: Map<string, DiscoveryCacheEntry> = new Map();
  private jwksCache: Map<string, JwksCacheEntry> = new Map();
  private cacheDurationMs: number;

  constructor(options: { cacheDurationMs?: number } = {}) {
    this.cacheDurationMs = options.cacheDurationMs ?? 3600000; // 1 hour default
  }

  /**
   * Fetch discovery document
   */
  async fetchDiscoveryDocument(discoveryUrl: string): Promise<OidcDiscoveryDocument> {
    // Check cache
    const cached = this.discoveryCache.get(discoveryUrl);
    if (cached && new Date() < cached.expiresAt) {
      return cached.document;
    }

    // Fetch document
    const response = await fetch(discoveryUrl);
    if (!response.ok) {
      throw new ForgeError({
        code: ErrorCode.SSO_PROVIDER_ERROR,
        message: `Failed to fetch OIDC discovery document: ${response.status}`,
        statusCode: 400,
      });
    }

    const document = (await response.json()) as OidcDiscoveryDocument;

    // Validate required fields
    this.validateDiscoveryDocument(document);

    // Cache the document
    const now = new Date();
    this.discoveryCache.set(discoveryUrl, {
      document,
      fetchedAt: now,
      expiresAt: new Date(now.getTime() + this.cacheDurationMs),
    });

    return document;
  }

  /**
   * Fetch JWKS from URI
   */
  async fetchJwks(jwksUri: string): Promise<OidcJwks> {
    // Check cache
    const cached = this.jwksCache.get(jwksUri);
    if (cached && new Date() < cached.expiresAt) {
      return cached.jwks;
    }

    // Fetch JWKS
    const response = await fetch(jwksUri);
    if (!response.ok) {
      throw new ForgeError({
        code: ErrorCode.SSO_PROVIDER_ERROR,
        message: `Failed to fetch JWKS: ${response.status}`,
        statusCode: 400,
      });
    }

    const jwks = (await response.json()) as OidcJwks;

    // Validate JWKS
    if (!jwks.keys || !Array.isArray(jwks.keys)) {
      throw new ForgeError({
        code: ErrorCode.SSO_CONFIG_INVALID,
        message: 'Invalid JWKS: missing keys array',
        statusCode: 400,
      });
    }

    // Cache the JWKS
    const now = new Date();
    this.jwksCache.set(jwksUri, {
      jwks,
      fetchedAt: now,
      expiresAt: new Date(now.getTime() + this.cacheDurationMs),
    });

    return jwks;
  }

  /**
   * Get a specific key from JWKS
   */
  async getKey(jwksUri: string, kid?: string): Promise<OidcJwk | undefined> {
    const jwks = await this.fetchJwks(jwksUri);

    if (kid) {
      return jwks.keys.find((key) => key.kid === kid);
    }

    // Return first signing key if no kid specified
    return jwks.keys.find((key) => key.use === 'sig' || !key.use);
  }

  /**
   * Build discovery URL from issuer
   */
  static buildDiscoveryUrl(issuer: string): string {
    // Remove trailing slash
    const baseUrl = issuer.replace(/\/$/, '');
    return `${baseUrl}/.well-known/openid-configuration`;
  }

  /**
   * Extract settings from discovery document
   */
  extractSettingsFromDiscovery(
    document: OidcDiscoveryDocument,
    clientSettings: {
      clientId: string;
      clientSecret: string;
      redirectUri: string;
      postLogoutRedirectUri?: string;
      scopes?: string[];
    }
  ): Partial<OidcSettings> {
    return {
      clientId: clientSettings.clientId,
      clientSecret: clientSettings.clientSecret,
      authorizationEndpoint: document.authorization_endpoint,
      tokenEndpoint: document.token_endpoint,
      userInfoEndpoint: document.userinfo_endpoint,
      jwksUri: document.jwks_uri,
      endSessionEndpoint: document.end_session_endpoint,
      redirectUri: clientSettings.redirectUri,
      postLogoutRedirectUri: clientSettings.postLogoutRedirectUri,
      scopes: clientSettings.scopes || ['openid', 'profile', 'email'],
      usePkce: document.code_challenge_methods_supported?.includes('S256') ?? false,
    };
  }

  /**
   * Validate discovery document
   */
  private validateDiscoveryDocument(document: OidcDiscoveryDocument): void {
    const requiredFields = [
      'issuer',
      'authorization_endpoint',
      'token_endpoint',
      'jwks_uri',
      'response_types_supported',
      'subject_types_supported',
      'id_token_signing_alg_values_supported',
    ];

    for (const field of requiredFields) {
      if (!(field in document)) {
        throw new ForgeError({
          code: ErrorCode.SSO_CONFIG_INVALID,
          message: `Invalid OIDC discovery document: missing ${field}`,
          statusCode: 400,
        });
      }
    }
  }

  /**
   * Clear discovery cache
   */
  clearDiscoveryCache(): void {
    this.discoveryCache.clear();
  }

  /**
   * Clear JWKS cache
   */
  clearJwksCache(): void {
    this.jwksCache.clear();
  }

  /**
   * Clear all caches
   */
  clearAllCaches(): void {
    this.discoveryCache.clear();
    this.jwksCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    discoveryEntries: number;
    jwksEntries: number;
  } {
    return {
      discoveryEntries: this.discoveryCache.size,
      jwksEntries: this.jwksCache.size,
    };
  }
}

// Singleton instance
let discoveryServiceInstance: OidcDiscoveryService | null = null;

/**
 * Get the singleton discovery service instance
 */
export function getOidcDiscoveryService(
  options?: { cacheDurationMs?: number }
): OidcDiscoveryService {
  if (!discoveryServiceInstance) {
    discoveryServiceInstance = new OidcDiscoveryService(options);
  }
  return discoveryServiceInstance;
}

/**
 * Reset the singleton discovery service instance (for testing)
 */
export function resetOidcDiscoveryService(): void {
  discoveryServiceInstance?.clearAllCaches();
  discoveryServiceInstance = null;
}
