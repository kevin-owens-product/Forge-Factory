/**
 * @package @forge/sso
 * @description Tests for pre-built provider integrations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createOktaOidcProvider,
  createOktaSamlProvider,
  buildOktaDiscoveryUrl,
  OKTA_OIDC_ATTRIBUTE_MAPPING,
  OKTA_SAML_ATTRIBUTE_MAPPING,
} from '../src/providers/okta';
import {
  createAzureAdOidcProvider,
  createAzureAdSamlProvider,
  buildAzureAdDiscoveryUrl,
  buildAzureAdSamlMetadataUrl,
  AZURE_AD_OIDC_ATTRIBUTE_MAPPING,
  AZURE_AD_SAML_ATTRIBUTE_MAPPING,
} from '../src/providers/azure-ad';
import {
  createGoogleOidcProvider,
  createGoogleSamlProvider,
  validateGoogleDomain,
  GOOGLE_OIDC_DISCOVERY_URL,
  GOOGLE_OIDC_ATTRIBUTE_MAPPING,
  GOOGLE_SAML_ATTRIBUTE_MAPPING,
} from '../src/providers/google-workspace';
import { resetOidcDiscoveryService } from '../src/oidc/oidc.discovery';
import { resetOidcTokenService } from '../src/oidc/oidc.tokens';
import { resetSamlParser } from '../src/saml/saml.parser';
import { resetSamlMetadataHandler } from '../src/saml/saml.metadata';

describe('Okta Providers', () => {
  beforeEach(() => {
    resetOidcDiscoveryService();
    resetOidcTokenService();
    resetSamlParser();
    resetSamlMetadataHandler();
  });

  describe('createOktaOidcProvider', () => {
    it('should create Okta OIDC provider with correct configuration', async () => {
      const provider = createOktaOidcProvider({
        domain: 'mycompany.okta.com',
        tenantId: 'tenant-123',
        clientId: 'client-123',
        clientSecret: 'secret-123',
        redirectUri: 'https://app.example.com/callback',
      });

      expect(provider.type).toBe('oidc');
      expect(provider.id).toBe('okta-oidc-tenant-123');
      expect(provider.name).toBe('Okta');
      expect(provider.enabled).toBe(true);
      expect(provider.tenantId).toBe('tenant-123');

      const settings = provider.getSettings();
      expect(settings.clientId).toBe('client-123');
      expect(settings.discoveryUrl).toContain('mycompany.okta.com');
      expect(settings.scopes).toContain('groups');
    });

    it('should use custom authorization server', async () => {
      const provider = createOktaOidcProvider({
        domain: 'mycompany.okta.com',
        tenantId: 'tenant-123',
        clientId: 'client-123',
        clientSecret: 'secret-123',
        redirectUri: 'https://app.example.com/callback',
        authorizationServerId: 'custom-server',
      });

      const settings = provider.getSettings();
      expect(settings.discoveryUrl).toContain('oauth2/custom-server');
    });
  });

  describe('createOktaSamlProvider', () => {
    it('should create Okta SAML provider with correct configuration', async () => {
      const provider = createOktaSamlProvider({
        domain: 'mycompany.okta.com',
        tenantId: 'tenant-123',
        spEntityId: 'https://app.example.com/saml',
        acsUrl: 'https://app.example.com/saml/acs',
        idpSsoUrl: 'https://mycompany.okta.com/app/xxx/sso/saml',
        idpCertificate: 'MOCK_CERTIFICATE',
      });

      await provider.initialize();

      expect(provider.type).toBe('saml');
      expect(provider.id).toBe('okta-saml-tenant-123');
      expect(provider.name).toBe('Okta');
      expect(provider.enabled).toBe(true);
      expect(provider.tenantId).toBe('tenant-123');
    });
  });

  describe('buildOktaDiscoveryUrl', () => {
    it('should build discovery URL with default authorization server', () => {
      const url = buildOktaDiscoveryUrl('mycompany.okta.com');
      expect(url).toBe(
        'https://mycompany.okta.com/oauth2/default/.well-known/openid-configuration'
      );
    });

    it('should build discovery URL with custom authorization server', () => {
      const url = buildOktaDiscoveryUrl('mycompany.okta.com', 'custom-server');
      expect(url).toBe(
        'https://mycompany.okta.com/oauth2/custom-server/.well-known/openid-configuration'
      );
    });
  });

  describe('attribute mappings', () => {
    it('should have correct OIDC attribute mapping', () => {
      expect(OKTA_OIDC_ATTRIBUTE_MAPPING.email).toBe('email');
      expect(OKTA_OIDC_ATTRIBUTE_MAPPING.firstName).toBe('given_name');
      expect(OKTA_OIDC_ATTRIBUTE_MAPPING.lastName).toBe('family_name');
      expect(OKTA_OIDC_ATTRIBUTE_MAPPING.groups).toBe('groups');
    });

    it('should have correct SAML attribute mapping', () => {
      expect(OKTA_SAML_ATTRIBUTE_MAPPING.email).toBe('email');
      expect(OKTA_SAML_ATTRIBUTE_MAPPING.firstName).toBe('firstName');
      expect(OKTA_SAML_ATTRIBUTE_MAPPING.lastName).toBe('lastName');
    });
  });
});

describe('Azure AD Providers', () => {
  beforeEach(() => {
    resetOidcDiscoveryService();
    resetOidcTokenService();
    resetSamlParser();
    resetSamlMetadataHandler();
  });

  describe('createAzureAdOidcProvider', () => {
    it('should create Azure AD OIDC provider with correct configuration', async () => {
      const provider = createAzureAdOidcProvider({
        azureTenantId: 'tenant-id-123',
        tenantId: 'app-tenant-123',
        clientId: 'client-123',
        clientSecret: 'secret-123',
        redirectUri: 'https://app.example.com/callback',
      });

      expect(provider.type).toBe('oidc');
      expect(provider.id).toBe('azure-ad-oidc-app-tenant-123');
      expect(provider.name).toBe('Microsoft');
      expect(provider.enabled).toBe(true);

      const settings = provider.getSettings();
      expect(settings.discoveryUrl).toContain('login.microsoftonline.com');
      expect(settings.discoveryUrl).toContain('tenant-id-123');
      expect(settings.scopes).toContain('User.Read');
    });

    it('should use v1 endpoints when specified', async () => {
      const provider = createAzureAdOidcProvider({
        azureTenantId: 'tenant-id-123',
        tenantId: 'app-tenant-123',
        clientId: 'client-123',
        clientSecret: 'secret-123',
        redirectUri: 'https://app.example.com/callback',
        useV2Endpoints: false,
      });

      const settings = provider.getSettings();
      expect(settings.discoveryUrl).not.toContain('/v2.0/');
    });

    it('should support common tenant type', async () => {
      const provider = createAzureAdOidcProvider({
        azureTenantId: 'common',
        tenantId: 'app-tenant-123',
        clientId: 'client-123',
        clientSecret: 'secret-123',
        redirectUri: 'https://app.example.com/callback',
      });

      const settings = provider.getSettings();
      expect(settings.discoveryUrl).toContain('/common/');
    });
  });

  describe('createAzureAdSamlProvider', () => {
    it('should create Azure AD SAML provider with correct configuration', async () => {
      const provider = createAzureAdSamlProvider({
        azureTenantId: 'tenant-id-123',
        tenantId: 'app-tenant-123',
        spEntityId: 'https://app.example.com/saml',
        acsUrl: 'https://app.example.com/saml/acs',
        idpSsoUrl: 'https://login.microsoftonline.com/tenant-id-123/saml2',
        idpCertificate: 'MOCK_CERTIFICATE',
      });

      await provider.initialize();

      expect(provider.type).toBe('saml');
      expect(provider.id).toBe('azure-ad-saml-app-tenant-123');
      expect(provider.name).toBe('Microsoft');
    });
  });

  describe('buildAzureAdDiscoveryUrl', () => {
    it('should build v2 discovery URL', () => {
      const url = buildAzureAdDiscoveryUrl('tenant-id-123', true);
      expect(url).toBe(
        'https://login.microsoftonline.com/tenant-id-123/v2.0/.well-known/openid-configuration'
      );
    });

    it('should build v1 discovery URL', () => {
      const url = buildAzureAdDiscoveryUrl('tenant-id-123', false);
      expect(url).toBe(
        'https://login.microsoftonline.com/tenant-id-123/.well-known/openid-configuration'
      );
    });
  });

  describe('buildAzureAdSamlMetadataUrl', () => {
    it('should build SAML metadata URL', () => {
      const url = buildAzureAdSamlMetadataUrl('tenant-id-123');
      expect(url).toBe(
        'https://login.microsoftonline.com/tenant-id-123/federationmetadata/2007-06/federationmetadata.xml'
      );
    });
  });

  describe('attribute mappings', () => {
    it('should have correct OIDC attribute mapping', () => {
      expect(AZURE_AD_OIDC_ATTRIBUTE_MAPPING.email).toBe('email');
      expect(AZURE_AD_OIDC_ATTRIBUTE_MAPPING.firstName).toBe('given_name');
      expect(AZURE_AD_OIDC_ATTRIBUTE_MAPPING.groups).toBe('groups');
    });

    it('should have correct SAML attribute mapping with full URIs', () => {
      expect(AZURE_AD_SAML_ATTRIBUTE_MAPPING.email).toContain('claims/emailaddress');
      expect(AZURE_AD_SAML_ATTRIBUTE_MAPPING.firstName).toContain('claims/givenname');
      expect(AZURE_AD_SAML_ATTRIBUTE_MAPPING.groups).toContain('claims/groups');
    });
  });
});

describe('Google Workspace Providers', () => {
  beforeEach(() => {
    resetOidcDiscoveryService();
    resetOidcTokenService();
    resetSamlParser();
    resetSamlMetadataHandler();
  });

  describe('createGoogleOidcProvider', () => {
    it('should create Google OIDC provider with correct configuration', async () => {
      const provider = createGoogleOidcProvider({
        tenantId: 'tenant-123',
        clientId: 'client-123',
        clientSecret: 'secret-123',
        redirectUri: 'https://app.example.com/callback',
      });

      expect(provider.type).toBe('oidc');
      expect(provider.id).toBe('google-oidc-tenant-123');
      expect(provider.name).toBe('Google');
      expect(provider.enabled).toBe(true);

      const settings = provider.getSettings();
      expect(settings.discoveryUrl).toBe(GOOGLE_OIDC_DISCOVERY_URL);
    });

    it('should include hosted domain when specified', async () => {
      const provider = createGoogleOidcProvider({
        tenantId: 'tenant-123',
        clientId: 'client-123',
        clientSecret: 'secret-123',
        redirectUri: 'https://app.example.com/callback',
        hostedDomain: 'example.com',
      });

      const settings = provider.getSettings();
      expect(settings.additionalParams?.['hd']).toBe('example.com');
    });

    it('should include access type and prompt when specified', async () => {
      const provider = createGoogleOidcProvider({
        tenantId: 'tenant-123',
        clientId: 'client-123',
        clientSecret: 'secret-123',
        redirectUri: 'https://app.example.com/callback',
        accessType: 'offline',
        prompt: 'consent',
      });

      const settings = provider.getSettings();
      expect(settings.additionalParams?.['access_type']).toBe('offline');
      expect(settings.additionalParams?.['prompt']).toBe('consent');
    });
  });

  describe('createGoogleSamlProvider', () => {
    it('should create Google SAML provider with correct configuration', async () => {
      const provider = createGoogleSamlProvider({
        tenantId: 'tenant-123',
        spEntityId: 'https://app.example.com/saml',
        acsUrl: 'https://app.example.com/saml/acs',
        idpSsoUrl: 'https://accounts.google.com/o/saml2/idp?idpid=xxx',
        idpCertificate: 'MOCK_CERTIFICATE',
      });

      await provider.initialize();

      expect(provider.type).toBe('saml');
      expect(provider.id).toBe('google-saml-tenant-123');
      expect(provider.name).toBe('Google Workspace');
    });
  });

  describe('validateGoogleDomain', () => {
    it('should return true when domain matches', () => {
      expect(validateGoogleDomain('user@example.com', ['example.com'])).toBe(true);
    });

    it('should return true when domain matches one of multiple allowed', () => {
      expect(
        validateGoogleDomain('user@example.com', ['other.com', 'example.com'])
      ).toBe(true);
    });

    it('should return false when domain does not match', () => {
      expect(validateGoogleDomain('user@other.com', ['example.com'])).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(validateGoogleDomain('user@EXAMPLE.COM', ['example.com'])).toBe(true);
    });

    it('should return true when no allowed domains', () => {
      expect(validateGoogleDomain('user@any.com', [])).toBe(true);
    });

    it('should return false for invalid email', () => {
      expect(validateGoogleDomain('invalid-email', ['example.com'])).toBe(false);
    });
  });

  describe('constants', () => {
    it('should have correct discovery URL', () => {
      expect(GOOGLE_OIDC_DISCOVERY_URL).toBe(
        'https://accounts.google.com/.well-known/openid-configuration'
      );
    });

    it('should have correct OIDC attribute mapping', () => {
      expect(GOOGLE_OIDC_ATTRIBUTE_MAPPING.email).toBe('email');
      expect(GOOGLE_OIDC_ATTRIBUTE_MAPPING.firstName).toBe('given_name');
      expect(GOOGLE_OIDC_ATTRIBUTE_MAPPING.displayName).toBe('name');
    });

    it('should have correct SAML attribute mapping', () => {
      expect(GOOGLE_SAML_ATTRIBUTE_MAPPING.email).toBe('email');
      expect(GOOGLE_SAML_ATTRIBUTE_MAPPING.firstName).toBe('firstName');
    });
  });
});
