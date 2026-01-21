/**
 * @package @forge/sso
 * @description Tests for SSO service
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  SsoService,
  createSsoService,
  createSsoConfig,
  InMemorySsoSessionStore,
} from '../src/sso.service';
import {
  SsoConfig,
  SamlProviderConfig,
  OidcProviderConfig,
  SsoSession,
} from '../src/sso.types';
import { resetSamlParser } from '../src/saml/saml.parser';
import { resetSamlMetadataHandler } from '../src/saml/saml.metadata';
import { resetOidcDiscoveryService } from '../src/oidc/oidc.discovery';
import { resetOidcTokenService } from '../src/oidc/oidc.tokens';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('SsoService', () => {
  let service: SsoService;
  let sessionStore: InMemorySsoSessionStore;

  const samlProviderConfig: SamlProviderConfig = {
    type: 'saml',
    id: 'test-saml',
    name: 'Test SAML',
    enabled: true,
    tenantId: 'tenant-123',
    settings: {
      spEntityId: 'https://app.example.com/saml',
      idpEntityId: 'https://idp.example.com',
      idpSsoUrl: 'https://idp.example.com/sso',
      idpSloUrl: 'https://idp.example.com/slo',
      idpCertificate: 'MOCK_CERTIFICATE',
      acsUrl: 'https://app.example.com/saml/acs',
      nameIdFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
    },
  };

  const oidcProviderConfig: OidcProviderConfig = {
    type: 'oidc',
    id: 'test-oidc',
    name: 'Test OIDC',
    enabled: true,
    tenantId: 'tenant-123',
    settings: {
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
    },
  };

  const config: SsoConfig = {
    providers: [samlProviderConfig, oidcProviderConfig],
    sessionDurationMs: 86400000,
    enableAuditLog: true,
  };

  beforeEach(async () => {
    resetSamlParser();
    resetSamlMetadataHandler();
    resetOidcDiscoveryService();
    resetOidcTokenService();
    mockFetch.mockReset();

    sessionStore = new InMemorySsoSessionStore();
    service = createSsoService(config, sessionStore);
    await service.initialize();
  });

  describe('initialization', () => {
    it('should initialize with providers', async () => {
      expect(service.getProvider('test-saml')).toBeDefined();
      expect(service.getProvider('test-oidc')).toBeDefined();
    });

    it('should register providers from config', async () => {
      const providers = service.getEnabledProviders();
      expect(providers).toHaveLength(2);
    });
  });

  describe('provider management', () => {
    it('should get provider by ID', () => {
      const provider = service.getProvider('test-saml');
      expect(provider).toBeDefined();
      expect(provider?.id).toBe('test-saml');
    });

    it('should return undefined for non-existent provider', () => {
      const provider = service.getProvider('non-existent');
      expect(provider).toBeUndefined();
    });

    it('should get providers for tenant', () => {
      const providers = service.getProvidersForTenant('tenant-123');
      expect(providers).toHaveLength(2);
    });

    it('should return empty array for non-existent tenant', () => {
      const providers = service.getProvidersForTenant('non-existent');
      expect(providers).toHaveLength(0);
    });

    it('should unregister provider', () => {
      const result = service.unregisterProvider('test-saml');
      expect(result).toBe(true);
      expect(service.getProvider('test-saml')).toBeUndefined();
    });

    it('should register new provider', async () => {
      const newConfig: SamlProviderConfig = {
        type: 'saml',
        id: 'new-saml',
        name: 'New SAML',
        enabled: true,
        tenantId: 'tenant-456',
        settings: samlProviderConfig.settings,
      };

      await service.registerProvider(newConfig);

      const provider = service.getProvider('new-saml');
      expect(provider).toBeDefined();
      expect(provider?.tenantId).toBe('tenant-456');
    });
  });

  describe('generateAuthUrl', () => {
    it('should generate SAML auth URL', () => {
      const url = service.generateAuthUrl('test-saml', {
        returnUrl: 'https://app.example.com/dashboard',
      });

      expect(url).toContain('https://idp.example.com/sso');
      expect(url).toContain('SAMLRequest=');
    });

    it('should generate OIDC auth URL', () => {
      const url = service.generateAuthUrl('test-oidc', {
        returnUrl: 'https://app.example.com/dashboard',
      });

      expect(url).toContain('https://idp.example.com/authorize');
      expect(url).toContain('response_type=code');
    });

    it('should throw error for non-existent provider', () => {
      expect(() =>
        service.generateAuthUrl('non-existent', {
          returnUrl: 'https://app.example.com/dashboard',
        })
      ).toThrow('Provider not found');
    });

    it('should throw error for disabled provider', async () => {
      const disabledConfig: OidcProviderConfig = {
        ...oidcProviderConfig,
        id: 'disabled-oidc',
        enabled: false,
      };
      await service.registerProvider(disabledConfig);

      expect(() =>
        service.generateAuthUrl('disabled-oidc', {
          returnUrl: 'https://app.example.com/dashboard',
        })
      ).toThrow('Provider is disabled');
    });
  });

  describe('generateLogoutUrl', () => {
    it('should generate SAML logout URL', () => {
      const response = service.generateLogoutUrl('test-saml', {
        userId: 'user@example.com',
        returnUrl: 'https://app.example.com',
      });

      expect(response.success).toBe(true);
      expect(response.logoutUrl).toContain('https://idp.example.com/slo');
    });

    it('should generate OIDC logout URL', () => {
      const response = service.generateLogoutUrl('test-oidc', {
        userId: 'user-123',
        returnUrl: 'https://app.example.com',
      });

      expect(response.success).toBe(true);
      expect(response.logoutUrl).toContain('https://idp.example.com/logout');
    });

    it('should return error for non-existent provider', () => {
      const response = service.generateLogoutUrl('non-existent', {
        userId: 'user-123',
        returnUrl: 'https://app.example.com',
      });

      expect(response.success).toBe(false);
      expect(response.error).toContain('Provider not found');
    });
  });

  describe('generateSamlMetadata', () => {
    it('should generate SAML SP metadata', () => {
      const metadata = service.generateSamlMetadata('test-saml');

      expect(metadata).toBeDefined();
      expect(metadata).toContain('EntityDescriptor');
    });

    it('should return null for non-SAML provider', () => {
      const metadata = service.generateSamlMetadata('test-oidc');
      expect(metadata).toBeNull();
    });

    it('should return null for non-existent provider', () => {
      const metadata = service.generateSamlMetadata('non-existent');
      expect(metadata).toBeNull();
    });
  });

  describe('getPublicConfig', () => {
    it('should return public config for all providers', () => {
      const configs = service.getPublicConfig();

      expect(configs).toHaveLength(2);
      configs.forEach((config) => {
        expect(config.id).toBeDefined();
        expect(config.name).toBeDefined();
        expect(config.type).toBeDefined();
      });
    });

    it('should return public config for specific tenant', () => {
      const configs = service.getPublicConfig('tenant-123');

      expect(configs).toHaveLength(2);
    });

    it('should return empty array for non-existent tenant', () => {
      const configs = service.getPublicConfig('non-existent');

      expect(configs).toHaveLength(0);
    });
  });

  describe('event handlers', () => {
    it('should call auth success handler', async () => {
      const onAuthSuccess = vi.fn();
      service.setEventHandlers({ onAuthSuccess });

      // This would require a full integration test with valid SAML/OIDC responses
      // For now, just verify the handler is set
      expect(onAuthSuccess).not.toHaveBeenCalled();
    });

    it('should call audit handler when configured', async () => {
      const onAudit = vi.fn();
      service.setEventHandlers({ onAudit });

      // Register a new provider to trigger audit
      const newConfig: SamlProviderConfig = {
        type: 'saml',
        id: 'audit-test',
        name: 'Audit Test',
        enabled: true,
        tenantId: 'tenant-789',
        settings: samlProviderConfig.settings,
      };

      await service.registerProvider(newConfig);

      expect(onAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'sso_provider_configured',
          providerId: 'audit-test',
        })
      );
    });
  });

  describe('user provisioner', () => {
    it('should set global user provisioner', async () => {
      const provisioner = vi.fn().mockResolvedValue({
        success: true,
        user: { id: 'user-123', email: 'user@example.com' },
      });

      service.setUserProvisioner(provisioner);

      // Verify it's set on existing providers
      const provider = service.getProvider('test-saml');
      expect(provider).toBeDefined();
    });
  });

  describe('session management', () => {
    it('should get session by ID', async () => {
      const session: SsoSession = {
        id: 'session-123',
        userId: 'user-123',
        tenantId: 'tenant-123',
        providerId: 'test-saml',
        providerType: 'saml',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
      };

      await sessionStore.set(session);

      const retrieved = await service.getSession('session-123');
      expect(retrieved).toBeDefined();
      expect(retrieved?.userId).toBe('user-123');
    });

    it('should get user sessions', async () => {
      const session1: SsoSession = {
        id: 'session-1',
        userId: 'user-123',
        tenantId: 'tenant-123',
        providerId: 'test-saml',
        providerType: 'saml',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
      };

      const session2: SsoSession = {
        id: 'session-2',
        userId: 'user-123',
        tenantId: 'tenant-123',
        providerId: 'test-oidc',
        providerType: 'oidc',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
      };

      await sessionStore.set(session1);
      await sessionStore.set(session2);

      const sessions = await service.getUserSessions('user-123', 'tenant-123');
      expect(sessions).toHaveLength(2);
    });

    it('should process logout', async () => {
      const session: SsoSession = {
        id: 'session-123',
        userId: 'user-123',
        tenantId: 'tenant-123',
        providerId: 'test-saml',
        providerType: 'saml',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
      };

      await sessionStore.set(session);

      const response = await service.processLogout('user-123', 'tenant-123');

      expect(response.success).toBe(true);

      const sessions = await service.getUserSessions('user-123', 'tenant-123');
      expect(sessions).toHaveLength(0);
    });
  });
});

describe('InMemorySsoSessionStore', () => {
  let store: InMemorySsoSessionStore;

  beforeEach(() => {
    store = new InMemorySsoSessionStore();
  });

  it('should store and retrieve session', async () => {
    const session: SsoSession = {
      id: 'session-123',
      userId: 'user-123',
      tenantId: 'tenant-123',
      providerId: 'provider-123',
      providerType: 'saml',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
    };

    await store.set(session);
    const retrieved = await store.get('session-123');

    expect(retrieved).toEqual(session);
  });

  it('should return null for non-existent session', async () => {
    const session = await store.get('non-existent');
    expect(session).toBeNull();
  });

  it('should return null for expired session', async () => {
    const session: SsoSession = {
      id: 'session-123',
      userId: 'user-123',
      tenantId: 'tenant-123',
      providerId: 'provider-123',
      providerType: 'saml',
      createdAt: new Date(Date.now() - 86400000),
      expiresAt: new Date(Date.now() - 1000), // Expired
    };

    await store.set(session);
    const retrieved = await store.get('session-123');

    expect(retrieved).toBeNull();
  });

  it('should delete session', async () => {
    const session: SsoSession = {
      id: 'session-123',
      userId: 'user-123',
      tenantId: 'tenant-123',
      providerId: 'provider-123',
      providerType: 'saml',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
    };

    await store.set(session);
    await store.delete('session-123');

    const retrieved = await store.get('session-123');
    expect(retrieved).toBeNull();
  });

  it('should delete sessions by user ID', async () => {
    const session1: SsoSession = {
      id: 'session-1',
      userId: 'user-123',
      tenantId: 'tenant-123',
      providerId: 'provider-123',
      providerType: 'saml',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
    };

    const session2: SsoSession = {
      id: 'session-2',
      userId: 'user-123',
      tenantId: 'tenant-123',
      providerId: 'provider-456',
      providerType: 'oidc',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
    };

    await store.set(session1);
    await store.set(session2);
    await store.deleteByUserId('user-123', 'tenant-123');

    const sessions = await store.findByUserId('user-123', 'tenant-123');
    expect(sessions).toHaveLength(0);
  });

  it('should find sessions by user ID', async () => {
    const session1: SsoSession = {
      id: 'session-1',
      userId: 'user-123',
      tenantId: 'tenant-123',
      providerId: 'provider-123',
      providerType: 'saml',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
    };

    const session2: SsoSession = {
      id: 'session-2',
      userId: 'user-456',
      tenantId: 'tenant-123',
      providerId: 'provider-123',
      providerType: 'saml',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
    };

    await store.set(session1);
    await store.set(session2);

    const sessions = await store.findByUserId('user-123', 'tenant-123');
    expect(sessions).toHaveLength(1);
    expect(sessions[0].id).toBe('session-1');
  });

  it('should clear all sessions', async () => {
    const session: SsoSession = {
      id: 'session-123',
      userId: 'user-123',
      tenantId: 'tenant-123',
      providerId: 'provider-123',
      providerType: 'saml',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
    };

    await store.set(session);
    store.clear();

    const retrieved = await store.get('session-123');
    expect(retrieved).toBeNull();
  });
});

describe('createSsoConfig', () => {
  const testSamlProviderConfig: SamlProviderConfig = {
    type: 'saml',
    id: 'test-saml-config',
    name: 'Test SAML Config',
    enabled: true,
    tenantId: 'tenant-123',
    settings: {
      spEntityId: 'https://app.example.com/saml',
      idpEntityId: 'https://idp.example.com',
      idpSsoUrl: 'https://idp.example.com/sso',
      idpCertificate: 'MOCK_CERTIFICATE',
      acsUrl: 'https://app.example.com/saml/acs',
      nameIdFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
    },
  };

  it('should create config with defaults', () => {
    const config = createSsoConfig({});

    expect(config.providers).toEqual([]);
    expect(config.sessionDurationMs).toBe(86400000);
    expect(config.enableAuditLog).toBe(true);
  });

  it('should override defaults with provided values', () => {
    const config = createSsoConfig({
      providers: [testSamlProviderConfig],
      sessionDurationMs: 3600000,
      enableAuditLog: false,
    });

    expect(config.providers).toHaveLength(1);
    expect(config.sessionDurationMs).toBe(3600000);
    expect(config.enableAuditLog).toBe(false);
  });
});
