/**
 * @package @forge/auth
 * @description Base authentication provider interface
 */

import {
  AuthResult,
  Credentials,
  UserIdentity,
  StoredUser,
  AuthProviderConfig,
  AuthProviderType,
} from '../auth.types';

/**
 * Base authentication provider interface
 */
export interface AuthProvider {
  /** Provider type */
  readonly type: AuthProviderType;

  /** Provider ID */
  readonly id: string;

  /** Provider display name */
  readonly name: string;

  /** Whether provider is enabled */
  readonly enabled: boolean;

  /**
   * Authenticate a user with credentials
   */
  authenticate(credentials: Credentials, tenantId: string): Promise<AuthResult>;

  /**
   * Validate if this provider can handle the given credentials
   */
  canHandle(credentials: Credentials): boolean;

  /**
   * Get provider configuration (sanitized for client)
   */
  getPublicConfig(): Partial<AuthProviderConfig>;
}

/**
 * Base provider implementation
 */
export abstract class BaseAuthProvider implements AuthProvider {
  abstract readonly type: AuthProviderType;
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly enabled: boolean;

  abstract authenticate(credentials: Credentials, tenantId: string): Promise<AuthResult>;

  abstract canHandle(credentials: Credentials): boolean;

  abstract getPublicConfig(): Partial<AuthProviderConfig>;

  /**
   * Convert stored user to user identity
   */
  protected toUserIdentity(user: StoredUser): UserIdentity {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      tenantId: user.tenantId,
      roles: user.roles,
      permissions: user.permissions,
      emailVerified: user.emailVerified,
      mfaEnabled: user.mfaEnabled,
      metadata: user.metadata,
    };
  }

  /**
   * Check if account is locked
   */
  protected isAccountLocked(user: StoredUser): boolean {
    if (!user.lockoutEndsAt) {
      return false;
    }
    return new Date() < user.lockoutEndsAt;
  }

  /**
   * Get remaining lockout time in seconds
   */
  protected getLockoutRemainingSeconds(user: StoredUser): number {
    if (!user.lockoutEndsAt) {
      return 0;
    }
    const remaining = user.lockoutEndsAt.getTime() - Date.now();
    return Math.max(0, Math.ceil(remaining / 1000));
  }

  /**
   * Check if account is active
   */
  protected isAccountActive(user: StoredUser): boolean {
    return user.status === 'active';
  }
}

/**
 * Provider registry for managing multiple auth providers
 */
export class AuthProviderRegistry {
  private providers: Map<string, AuthProvider> = new Map();

  /**
   * Register a provider
   */
  register(provider: AuthProvider): void {
    this.providers.set(provider.id, provider);
  }

  /**
   * Unregister a provider
   */
  unregister(providerId: string): boolean {
    return this.providers.delete(providerId);
  }

  /**
   * Get a provider by ID
   */
  get(providerId: string): AuthProvider | undefined {
    return this.providers.get(providerId);
  }

  /**
   * Get all registered providers
   */
  getAll(): AuthProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Get all enabled providers
   */
  getEnabled(): AuthProvider[] {
    return this.getAll().filter((p) => p.enabled);
  }

  /**
   * Get providers by type
   */
  getByType(type: AuthProviderType): AuthProvider[] {
    return this.getAll().filter((p) => p.type === type);
  }

  /**
   * Find a provider that can handle the given credentials
   */
  findProvider(credentials: Credentials): AuthProvider | undefined {
    return this.getEnabled().find((p) => p.canHandle(credentials));
  }

  /**
   * Get public configurations for all enabled providers
   */
  getPublicConfigs(): Partial<AuthProviderConfig>[] {
    return this.getEnabled().map((p) => p.getPublicConfig());
  }

  /**
   * Clear all providers (for testing)
   */
  clear(): void {
    this.providers.clear();
  }
}

// Singleton registry instance
let registryInstance: AuthProviderRegistry | null = null;

/**
 * Get the singleton provider registry
 */
export function getProviderRegistry(): AuthProviderRegistry {
  if (!registryInstance) {
    registryInstance = new AuthProviderRegistry();
  }
  return registryInstance;
}

/**
 * Reset the singleton provider registry (for testing)
 */
export function resetProviderRegistry(): void {
  registryInstance?.clear();
  registryInstance = null;
}
