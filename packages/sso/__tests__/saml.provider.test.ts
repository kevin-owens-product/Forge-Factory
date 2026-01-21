/**
 * @package @forge/sso
 * @description Tests for SAML provider
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  SamlProvider,
  createSamlProvider,
  createSamlSettings,
} from '../src/saml/saml.provider';
import { SamlProviderConfig, SamlSettings } from '../src/sso.types';
import { SamlParser, getSamlParser, resetSamlParser } from '../src/saml/saml.parser';
import { getSamlMetadataHandler, resetSamlMetadataHandler } from '../src/saml/saml.metadata';

describe('SamlProvider', () => {
  let provider: SamlProvider;

  const mockSettings: SamlSettings = {
    spEntityId: 'https://app.example.com/saml',
    idpEntityId: 'https://idp.example.com',
    idpSsoUrl: 'https://idp.example.com/sso',
    idpSloUrl: 'https://idp.example.com/slo',
    idpCertificate: 'MOCK_CERTIFICATE',
    acsUrl: 'https://app.example.com/saml/acs',
    sloUrl: 'https://app.example.com/saml/slo',
    nameIdFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
    clockSkewSeconds: 60,
    requireSignedAssertions: true,
  };

  const mockConfig: SamlProviderConfig = {
    type: 'saml',
    id: 'test-saml-provider',
    name: 'Test SAML Provider',
    enabled: true,
    tenantId: 'tenant-123',
    settings: mockSettings,
  };

  beforeEach(async () => {
    resetSamlParser();
    resetSamlMetadataHandler();
    provider = createSamlProvider(mockConfig);
    await provider.initialize();
  });

  describe('constructor', () => {
    it('should create provider with correct properties', () => {
      expect(provider.type).toBe('saml');
      expect(provider.id).toBe('test-saml-provider');
      expect(provider.name).toBe('Test SAML Provider');
      expect(provider.enabled).toBe(true);
      expect(provider.tenantId).toBe('tenant-123');
    });
  });

  describe('generateAuthUrl', () => {
    it('should generate valid authentication URL', () => {
      const url = provider.generateAuthUrl({
        returnUrl: 'https://app.example.com/dashboard',
      });

      expect(url).toContain('https://idp.example.com/sso');
      expect(url).toContain('SAMLRequest=');
    });

    it('should include relay state when provided', () => {
      const url = provider.generateAuthUrl({
        returnUrl: 'https://app.example.com/dashboard',
        relayState: 'custom-state',
      });

      expect(url).toContain('RelayState=custom-state');
    });
  });

  describe('generateAuthnRequest', () => {
    it('should generate valid AuthnRequest XML', () => {
      const request = provider.generateAuthnRequest({
        returnUrl: 'https://app.example.com/dashboard',
      });

      expect(request).toContain('samlp:AuthnRequest');
      expect(request).toContain('Version="2.0"');
      expect(request).toContain(`Destination="${mockSettings.idpSsoUrl}"`);
      expect(request).toContain(`AssertionConsumerServiceURL="${mockSettings.acsUrl}"`);
      expect(request).toContain(mockSettings.spEntityId);
    });

    it('should include ForceAuthn when requested', () => {
      const request = provider.generateAuthnRequest({
        returnUrl: 'https://app.example.com/dashboard',
        forceAuthn: true,
      });

      expect(request).toContain('ForceAuthn="true"');
    });

    it('should include authn context when configured', () => {
      const request = provider.generateAuthnRequest({
        returnUrl: 'https://app.example.com/dashboard',
        authnContext: 'urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport',
      });

      expect(request).toContain('RequestedAuthnContext');
      expect(request).toContain('PasswordProtectedTransport');
    });
  });

  describe('generateLogoutUrl', () => {
    it('should generate logout URL when SLO is configured', () => {
      const response = provider.generateLogoutUrl({
        userId: 'user@example.com',
        returnUrl: 'https://app.example.com',
      });

      expect(response.success).toBe(true);
      expect(response.logoutUrl).toContain('https://idp.example.com/slo');
      expect(response.logoutUrl).toContain('SAMLRequest=');
    });

    it('should include relay state when provided', () => {
      const response = provider.generateLogoutUrl({
        userId: 'user@example.com',
        returnUrl: 'https://app.example.com',
        relayState: 'logout-state',
      });

      expect(response.success).toBe(true);
      expect(response.logoutUrl).toContain('RelayState=logout-state');
    });

    it('should return error when SLO is not configured', async () => {
      const noSloSettings = { ...mockSettings, idpSloUrl: undefined };
      const noSloConfig = { ...mockConfig, settings: noSloSettings };
      const noSloProvider = createSamlProvider(noSloConfig);
      await noSloProvider.initialize();

      const response = noSloProvider.generateLogoutUrl({
        userId: 'user@example.com',
        returnUrl: 'https://app.example.com',
      });

      expect(response.success).toBe(false);
      expect(response.error).toContain('not configured');
    });
  });

  describe('generateLogoutRequest', () => {
    it('should generate valid LogoutRequest XML', () => {
      const request = provider.generateLogoutRequest({
        userId: 'user@example.com',
        returnUrl: 'https://app.example.com',
      });

      expect(request).toContain('samlp:LogoutRequest');
      expect(request).toContain('Version="2.0"');
      expect(request).toContain(`Destination="${mockSettings.idpSloUrl}"`);
      expect(request).toContain(mockSettings.spEntityId);
      expect(request).toContain('user@example.com');
    });

    it('should include session index when provided', () => {
      const request = provider.generateLogoutRequest({
        userId: 'user@example.com',
        returnUrl: 'https://app.example.com',
        ssoSessionId: 'session-123',
      });

      expect(request).toContain('SessionIndex');
      expect(request).toContain('session-123');
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

      expect(config.type).toBe('saml');
      expect(config.id).toBe('test-saml-provider');
      expect(config.name).toBe('Test SAML Provider');
      expect(config.enabled).toBe(true);
      expect(config.tenantId).toBe('tenant-123');

      // Should not include sensitive settings
      const settings = config.settings as SamlSettings;
      expect(settings.spEntityId).toBe(mockSettings.spEntityId);
      expect(settings.idpCertificate).toBeUndefined();
      expect(settings.spPrivateKey).toBeUndefined();
    });
  });

  describe('generateMetadata', () => {
    it('should generate SP metadata', () => {
      const metadata = provider.generateMetadata();

      expect(metadata).toContain('EntityDescriptor');
      expect(metadata).toContain(mockSettings.spEntityId);
    });
  });

  describe('setUserProvisioner', () => {
    it('should set user provisioner callback', () => {
      const provisioner = vi.fn().mockResolvedValue({
        success: true,
        user: { id: 'user-123', email: 'user@example.com' },
      });

      provider.setUserProvisioner(provisioner);

      // Provisioner is used during processResponse, which requires a valid SAML response
      // Just verify it doesn't throw
      expect(() => provider.setUserProvisioner(provisioner)).not.toThrow();
    });
  });

  describe('processResponse', () => {
    it('should process valid SAML response with assertion', async () => {
      const mockParser = {
        initialize: vi.fn(),
        parseResponse: vi.fn().mockResolvedValue({
          id: '_response123',
          issuer: 'https://idp.example.com',
          statusCode: 'urn:oasis:names:tc:SAML:2.0:status:Success',
          assertion: {
            id: '_assertion123',
            issuer: 'https://idp.example.com',
            subject: {
              nameId: 'user@example.com',
              nameIdFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
            },
            conditions: {
              notBefore: new Date(Date.now() - 60000).toISOString(),
              notOnOrAfter: new Date(Date.now() + 300000).toISOString(),
              audienceRestriction: ['https://app.example.com/saml'],
            },
            attributes: {
              email: 'user@example.com',
              firstName: 'John',
              lastName: 'Doe',
            },
            authnStatement: {
              authnInstant: new Date(),
              sessionIndex: '_session123',
              sessionNotOnOrAfter: new Date(Date.now() + 3600000).toISOString(),
            },
          },
          rawXml: '<Response>...</Response>',
        }),
        validateAssertionTiming: vi.fn().mockReturnValue({ valid: true }),
        validateAudienceRestriction: vi.fn().mockReturnValue({ valid: true }),
      };

      provider.setParser(mockParser as unknown as SamlParser);

      const result = await provider.processResponse('mock-saml-response');

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user?.email).toBe('user@example.com');
      expect(result.ssoSessionId).toBe('_session123');
    });

    it('should return error when assertion is missing', async () => {
      const mockParser = {
        initialize: vi.fn(),
        parseResponse: vi.fn().mockResolvedValue({
          id: '_response123',
          issuer: 'https://idp.example.com',
          statusCode: 'urn:oasis:names:tc:SAML:2.0:status:Success',
          assertion: null,
          rawXml: '<Response>...</Response>',
        }),
        validateAssertionTiming: vi.fn().mockReturnValue({ valid: true }),
        validateAudienceRestriction: vi.fn().mockReturnValue({ valid: true }),
      };

      provider.setParser(mockParser as unknown as SamlParser);

      const result = await provider.processResponse('mock-saml-response');

      expect(result.success).toBe(false);
      expect(result.error).toContain('assertion');
    });

    it('should return error when timing validation fails', async () => {
      const mockParser = {
        initialize: vi.fn(),
        parseResponse: vi.fn().mockResolvedValue({
          id: '_response123',
          issuer: 'https://idp.example.com',
          statusCode: 'urn:oasis:names:tc:SAML:2.0:status:Success',
          assertion: {
            id: '_assertion123',
            issuer: 'https://idp.example.com',
            subject: { nameId: 'user@example.com', nameIdFormat: '' },
            conditions: {},
            attributes: {},
          },
          rawXml: '<Response>...</Response>',
        }),
        validateAssertionTiming: vi.fn().mockReturnValue({ valid: false, error: 'Assertion expired' }),
        validateAudienceRestriction: vi.fn().mockReturnValue({ valid: true }),
      };

      provider.setParser(mockParser as unknown as SamlParser);

      const result = await provider.processResponse('mock-saml-response');

      expect(result.success).toBe(false);
      expect(result.error).toContain('expired');
    });

    it('should return error when audience validation fails', async () => {
      const mockParser = {
        initialize: vi.fn(),
        parseResponse: vi.fn().mockResolvedValue({
          id: '_response123',
          issuer: 'https://idp.example.com',
          statusCode: 'urn:oasis:names:tc:SAML:2.0:status:Success',
          assertion: {
            id: '_assertion123',
            issuer: 'https://idp.example.com',
            subject: { nameId: 'user@example.com', nameIdFormat: '' },
            conditions: {},
            attributes: {},
          },
          rawXml: '<Response>...</Response>',
        }),
        validateAssertionTiming: vi.fn().mockReturnValue({ valid: true }),
        validateAudienceRestriction: vi.fn().mockReturnValue({ valid: false, error: 'Audience mismatch' }),
      };

      provider.setParser(mockParser as unknown as SamlParser);

      const result = await provider.processResponse('mock-saml-response');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Audience');
    });

    it('should return error when issuer validation fails', async () => {
      const mockParser = {
        initialize: vi.fn(),
        parseResponse: vi.fn().mockResolvedValue({
          id: '_response123',
          issuer: 'https://wrong-idp.example.com',
          statusCode: 'urn:oasis:names:tc:SAML:2.0:status:Success',
          assertion: {
            id: '_assertion123',
            issuer: 'https://wrong-idp.example.com',
            subject: { nameId: 'user@example.com', nameIdFormat: '' },
            conditions: {},
            attributes: {},
          },
          rawXml: '<Response>...</Response>',
        }),
        validateAssertionTiming: vi.fn().mockReturnValue({ valid: true }),
        validateAudienceRestriction: vi.fn().mockReturnValue({ valid: true }),
      };

      provider.setParser(mockParser as unknown as SamlParser);

      const result = await provider.processResponse('mock-saml-response');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Issuer mismatch');
    });

    it('should use user provisioner when set', async () => {
      const mockParser = {
        initialize: vi.fn(),
        parseResponse: vi.fn().mockResolvedValue({
          id: '_response123',
          issuer: 'https://idp.example.com',
          statusCode: 'urn:oasis:names:tc:SAML:2.0:status:Success',
          assertion: {
            id: '_assertion123',
            issuer: 'https://idp.example.com',
            subject: { nameId: 'user@example.com', nameIdFormat: '' },
            conditions: { audienceRestriction: ['https://app.example.com/saml'] },
            attributes: {},
          },
          rawXml: '<Response>...</Response>',
        }),
        validateAssertionTiming: vi.fn().mockReturnValue({ valid: true }),
        validateAudienceRestriction: vi.fn().mockReturnValue({ valid: true }),
      };

      const provisioner = vi.fn().mockResolvedValue({
        success: true,
        user: { id: 'provisioned-user', email: 'user@example.com' },
      });

      provider.setParser(mockParser as unknown as SamlParser);
      provider.setUserProvisioner(provisioner);

      const result = await provider.processResponse('mock-saml-response');

      expect(result.success).toBe(true);
      expect(provisioner).toHaveBeenCalled();
      expect(result.user?.id).toBe('provisioned-user');
    });

    it('should return error when user provisioner fails', async () => {
      const mockParser = {
        initialize: vi.fn(),
        parseResponse: vi.fn().mockResolvedValue({
          id: '_response123',
          issuer: 'https://idp.example.com',
          statusCode: 'urn:oasis:names:tc:SAML:2.0:status:Success',
          assertion: {
            id: '_assertion123',
            issuer: 'https://idp.example.com',
            subject: { nameId: 'user@example.com', nameIdFormat: '' },
            conditions: { audienceRestriction: ['https://app.example.com/saml'] },
            attributes: {},
          },
          rawXml: '<Response>...</Response>',
        }),
        validateAssertionTiming: vi.fn().mockReturnValue({ valid: true }),
        validateAudienceRestriction: vi.fn().mockReturnValue({ valid: true }),
      };

      const provisioner = vi.fn().mockResolvedValue({
        success: false,
        error: 'User account disabled',
      });

      provider.setParser(mockParser as unknown as SamlParser);
      provider.setUserProvisioner(provisioner);

      const result = await provider.processResponse('mock-saml-response');

      expect(result.success).toBe(false);
      expect(result.error).toBe('User account disabled');
    });

    it('should handle non-ForgeError exceptions', async () => {
      const mockParser = {
        initialize: vi.fn(),
        parseResponse: vi.fn().mockRejectedValue(new Error('Network error')),
      };

      provider.setParser(mockParser as unknown as SamlParser);

      const result = await provider.processResponse('mock-saml-response');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });

  describe('processLogoutResponse', () => {
    it('should process successful logout response', async () => {
      const mockParser = {
        initialize: vi.fn(),
        parseResponse: vi.fn().mockResolvedValue({
          statusCode: 'urn:oasis:names:tc:SAML:2.0:status:Success',
        }),
      };

      provider.setParser(mockParser as unknown as SamlParser);

      const result = await provider.processLogoutResponse('mock-logout-response', 'relay-state');

      expect(result.success).toBe(true);
      expect(result.relayState).toBe('relay-state');
    });

    it('should return error for failed logout', async () => {
      const mockParser = {
        initialize: vi.fn(),
        parseResponse: vi.fn().mockResolvedValue({
          statusCode: 'urn:oasis:names:tc:SAML:2.0:status:Requester',
          statusMessage: 'Session not found',
        }),
      };

      provider.setParser(mockParser as unknown as SamlParser);

      const result = await provider.processLogoutResponse('mock-logout-response');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Session not found');
    });

    it('should handle parse errors', async () => {
      const mockParser = {
        initialize: vi.fn(),
        parseResponse: vi.fn().mockRejectedValue(new Error('Invalid XML')),
      };

      provider.setParser(mockParser as unknown as SamlParser);

      const result = await provider.processLogoutResponse('invalid-response');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid XML');
    });
  });

  describe('setParser and setMetadataHandler', () => {
    it('should allow setting custom parser', () => {
      const mockParser = {
        initialize: vi.fn(),
        parseResponse: vi.fn(),
        validateAssertionTiming: vi.fn(),
        validateAudienceRestriction: vi.fn(),
      };

      expect(() => provider.setParser(mockParser as unknown as SamlParser)).not.toThrow();
    });

    it('should allow setting custom metadata handler', () => {
      const mockHandler = {
        initialize: vi.fn(),
        generateSpMetadata: vi.fn(),
      };

      expect(() => provider.setMetadataHandler(mockHandler as unknown as ReturnType<typeof getSamlMetadataHandler>)).not.toThrow();
    });
  });
});

describe('createSamlSettings', () => {
  it('should create settings with defaults', () => {
    const settings = createSamlSettings({
      spEntityId: 'https://app.example.com/saml',
      idpEntityId: 'https://idp.example.com',
      idpSsoUrl: 'https://idp.example.com/sso',
      idpCertificate: 'MOCK_CERTIFICATE',
      acsUrl: 'https://app.example.com/saml/acs',
    });

    expect(settings.spEntityId).toBe('https://app.example.com/saml');
    expect(settings.idpEntityId).toBe('https://idp.example.com');
    expect(settings.nameIdFormat).toBe('urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress');
    expect(settings.signRequests).toBe(false);
    expect(settings.requireSignedAssertions).toBe(true);
    expect(settings.requireEncryptedAssertions).toBe(false);
    expect(settings.clockSkewSeconds).toBe(60);
  });

  it('should override defaults with provided values', () => {
    const settings = createSamlSettings({
      spEntityId: 'https://app.example.com/saml',
      idpEntityId: 'https://idp.example.com',
      idpSsoUrl: 'https://idp.example.com/sso',
      idpCertificate: 'MOCK_CERTIFICATE',
      acsUrl: 'https://app.example.com/saml/acs',
      nameIdFormat: 'urn:oasis:names:tc:SAML:2.0:nameid-format:persistent',
      clockSkewSeconds: 120,
      requireEncryptedAssertions: true,
    });

    expect(settings.nameIdFormat).toBe('urn:oasis:names:tc:SAML:2.0:nameid-format:persistent');
    expect(settings.clockSkewSeconds).toBe(120);
    expect(settings.requireEncryptedAssertions).toBe(true);
  });
});
