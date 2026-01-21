/**
 * @package @forge/sso
 * @description Tests for SAML metadata handling
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  SamlMetadataHandler,
  getSamlMetadataHandler,
  resetSamlMetadataHandler,
  XmlBuilder,
  XmlBuilderNode,
} from '../src/saml/saml.metadata';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('SamlMetadataHandler', () => {
  let handler: SamlMetadataHandler;

  beforeEach(async () => {
    resetSamlMetadataHandler();
    handler = getSamlMetadataHandler();
    await handler.initialize();
  });

  afterEach(() => {
    mockFetch.mockReset();
  });

  describe('constructor and initialization', () => {
    it('should create a handler instance', () => {
      expect(handler).toBeInstanceOf(SamlMetadataHandler);
    });

    it('should return singleton instance', () => {
      const handler2 = getSamlMetadataHandler();
      expect(handler2).toBe(handler);
    });

    it('should reset singleton instance', () => {
      resetSamlMetadataHandler();
      const handler2 = getSamlMetadataHandler();
      expect(handler2).not.toBe(handler);
    });
  });

  describe('parseMetadataFromUrl', () => {
    it('should fetch and parse metadata from URL', async () => {
      const mockMetadataXml = `<?xml version="1.0"?>
        <EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="https://idp.example.com">
          <IDPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
            <SingleSignOnService
              Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
              Location="https://idp.example.com/sso"/>
            <NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</NameIDFormat>
          </IDPSSODescriptor>
        </EntityDescriptor>`;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockMetadataXml),
      });

      const metadata = await handler.parseMetadataFromUrl('https://idp.example.com/metadata');

      expect(metadata.entityId).toBe('https://idp.example.com');
      expect(metadata.ssoServices).toHaveLength(1);
    });

    it('should throw error when fetch fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      await expect(
        handler.parseMetadataFromUrl('https://idp.example.com/metadata')
      ).rejects.toThrow('Failed to fetch IdP metadata');
    });
  });

  describe('parseMetadata', () => {
    it('should parse valid IdP metadata', async () => {
      const mockMetadataXml = `<?xml version="1.0"?>
        <EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="https://idp.example.com">
          <IDPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
            <KeyDescriptor use="signing">
              <KeyInfo xmlns="http://www.w3.org/2000/09/xmldsig#">
                <X509Data>
                  <X509Certificate>MIIC+DCCAeCgAwIBAgIGAYx...</X509Certificate>
                </X509Data>
              </KeyInfo>
            </KeyDescriptor>
            <SingleSignOnService
              Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
              Location="https://idp.example.com/sso/post"/>
            <SingleSignOnService
              Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"
              Location="https://idp.example.com/sso/redirect"/>
            <SingleLogoutService
              Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
              Location="https://idp.example.com/slo"/>
            <NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</NameIDFormat>
          </IDPSSODescriptor>
          <Organization>
            <OrganizationName>Example Organization</OrganizationName>
            <OrganizationDisplayName>Example Org</OrganizationDisplayName>
            <OrganizationURL>https://example.com</OrganizationURL>
          </Organization>
          <ContactPerson contactType="technical">
            <GivenName>John</GivenName>
            <SurName>Doe</SurName>
            <EmailAddress>john@example.com</EmailAddress>
          </ContactPerson>
        </EntityDescriptor>`;

      const metadata = await handler.parseMetadata(mockMetadataXml);

      expect(metadata.entityId).toBe('https://idp.example.com');
      expect(metadata.ssoServices).toHaveLength(2);
      expect(metadata.ssoServices[0].binding).toBe('urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST');
      expect(metadata.ssoServices[0].location).toBe('https://idp.example.com/sso/post');
      expect(metadata.sloServices).toHaveLength(1);
      expect(metadata.signingCertificates).toHaveLength(1);
      expect(metadata.nameIdFormats).toHaveLength(1);
      expect(metadata.organization).toBeDefined();
      expect(metadata.organization?.name).toBe('Example Organization');
      expect(metadata.contacts).toHaveLength(1);
      expect(metadata.contacts?.[0].givenName).toBe('John');
    });

    it('should throw error for invalid XML', async () => {
      await expect(
        handler.parseMetadata('not valid xml')
      ).rejects.toThrow('Failed to parse IdP metadata XML');
    });

    it('should throw error for missing EntityDescriptor', async () => {
      const invalidXml = `<?xml version="1.0"?><root></root>`;
      await expect(
        handler.parseMetadata(invalidXml)
      ).rejects.toThrow('Invalid IdP metadata: missing EntityDescriptor');
    });

    it('should throw error for missing entityID', async () => {
      const invalidXml = `<?xml version="1.0"?>
        <EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata">
          <IDPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
            <SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="https://idp.example.com/sso"/>
          </IDPSSODescriptor>
        </EntityDescriptor>`;
      await expect(
        handler.parseMetadata(invalidXml)
      ).rejects.toThrow('Invalid IdP metadata: missing entityID');
    });

    it('should throw error for missing IDPSSODescriptor', async () => {
      const invalidXml = `<?xml version="1.0"?>
        <EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="https://idp.example.com">
        </EntityDescriptor>`;
      await expect(
        handler.parseMetadata(invalidXml)
      ).rejects.toThrow('Invalid IdP metadata: missing IDPSSODescriptor');
    });

    it('should handle metadata without SLO services', async () => {
      const metadataXml = `<?xml version="1.0"?>
        <EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="https://idp.example.com">
          <IDPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
            <SingleSignOnService
              Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
              Location="https://idp.example.com/sso"/>
          </IDPSSODescriptor>
        </EntityDescriptor>`;

      const metadata = await handler.parseMetadata(metadataXml);
      expect(metadata.sloServices).toBeUndefined();
    });

    it('should handle metadata with encryption certificates', async () => {
      const metadataXml = `<?xml version="1.0"?>
        <EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="https://idp.example.com">
          <IDPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
            <KeyDescriptor use="encryption">
              <KeyInfo xmlns="http://www.w3.org/2000/09/xmldsig#">
                <X509Data>
                  <X509Certificate>MIIC+DCCAeCgAwIBAgIGAYx...</X509Certificate>
                </X509Data>
              </KeyInfo>
            </KeyDescriptor>
            <SingleSignOnService
              Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
              Location="https://idp.example.com/sso"/>
          </IDPSSODescriptor>
        </EntityDescriptor>`;

      const metadata = await handler.parseMetadata(metadataXml);
      expect(metadata.encryptionCertificates).toHaveLength(1);
    });
  });

  describe('generateSpMetadata', () => {
    it('should generate SP metadata when xmlbuilder2 is available', async () => {
      // Create a mock XML builder
      const mockNode: XmlBuilderNode = {
        ele: vi.fn().mockReturnThis(),
        txt: vi.fn().mockReturnThis(),
        up: vi.fn().mockReturnThis(),
        end: vi.fn().mockReturnValue('<?xml version="1.0"?><EntityDescriptor>...</EntityDescriptor>'),
      };

      const mockBuilder: XmlBuilder = {
        create: vi.fn().mockReturnValue(mockNode),
      };

      handler.setXmlBuilder(mockBuilder);

      const settings = {
        spEntityId: 'https://app.example.com/saml',
        idpEntityId: 'https://idp.example.com',
        idpSsoUrl: 'https://idp.example.com/sso',
        idpCertificate: 'MOCK_CERTIFICATE',
        acsUrl: 'https://app.example.com/saml/acs',
        nameIdFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress' as const,
      };

      const metadata = handler.generateSpMetadata(settings);

      expect(metadata).toContain('EntityDescriptor');
      expect(mockBuilder.create).toHaveBeenCalledWith({ version: '1.0', encoding: 'UTF-8' });
    });

    it('should include SLO service when configured', async () => {
      const mockNode: XmlBuilderNode = {
        ele: vi.fn().mockReturnThis(),
        txt: vi.fn().mockReturnThis(),
        up: vi.fn().mockReturnThis(),
        end: vi.fn().mockReturnValue('<EntityDescriptor/>'),
      };

      const mockBuilder: XmlBuilder = {
        create: vi.fn().mockReturnValue(mockNode),
      };

      handler.setXmlBuilder(mockBuilder);

      const settings = {
        spEntityId: 'https://app.example.com/saml',
        idpEntityId: 'https://idp.example.com',
        idpSsoUrl: 'https://idp.example.com/sso',
        idpCertificate: 'MOCK_CERTIFICATE',
        acsUrl: 'https://app.example.com/saml/acs',
        sloUrl: 'https://app.example.com/saml/slo',
        nameIdFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress' as const,
      };

      handler.generateSpMetadata(settings);

      // Should have called ele with SingleLogoutService twice (POST and Redirect bindings)
      expect(mockNode.ele).toHaveBeenCalledWith(
        'md:SingleLogoutService',
        expect.objectContaining({
          Binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
        })
      );
    });

    it('should include signing certificate when configured', async () => {
      const mockNode: XmlBuilderNode = {
        ele: vi.fn().mockReturnThis(),
        txt: vi.fn().mockReturnThis(),
        up: vi.fn().mockReturnThis(),
        end: vi.fn().mockReturnValue('<EntityDescriptor/>'),
      };

      const mockBuilder: XmlBuilder = {
        create: vi.fn().mockReturnValue(mockNode),
      };

      handler.setXmlBuilder(mockBuilder);

      const settings = {
        spEntityId: 'https://app.example.com/saml',
        idpEntityId: 'https://idp.example.com',
        idpSsoUrl: 'https://idp.example.com/sso',
        idpCertificate: 'MOCK_CERTIFICATE',
        acsUrl: 'https://app.example.com/saml/acs',
        spCertificate: '-----BEGIN CERTIFICATE-----\nMIIC+...\n-----END CERTIFICATE-----',
        nameIdFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress' as const,
      };

      handler.generateSpMetadata(settings);

      expect(mockNode.ele).toHaveBeenCalledWith('md:KeyDescriptor', { use: 'signing' });
    });

    it('should throw error when xmlbuilder is not available', async () => {
      // Create a new handler without xmlbuilder
      resetSamlMetadataHandler();
      const newHandler = new SamlMetadataHandler();

      const settings = {
        spEntityId: 'https://app.example.com/saml',
        idpEntityId: 'https://idp.example.com',
        idpSsoUrl: 'https://idp.example.com/sso',
        idpCertificate: 'MOCK_CERTIFICATE',
        acsUrl: 'https://app.example.com/saml/acs',
        nameIdFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress' as const,
      };

      expect(() => newHandler.generateSpMetadata(settings)).toThrow(
        'XML builder not available'
      );
    });
  });

  describe('extractSettingsFromMetadata', () => {
    it('should extract settings from metadata', async () => {
      const metadata = {
        entityId: 'https://idp.example.com',
        ssoServices: [
          {
            binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect' as const,
            location: 'https://idp.example.com/sso/redirect',
          },
          {
            binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST' as const,
            location: 'https://idp.example.com/sso/post',
          },
        ],
        sloServices: [
          {
            binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST' as const,
            location: 'https://idp.example.com/slo',
          },
        ],
        signingCertificates: ['MIIC+DCCAeCgAwIBAgIGAYx...'],
        encryptionCertificates: [],
        nameIdFormats: ['urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress'],
      };

      const settings = handler.extractSettingsFromMetadata(metadata, {
        spEntityId: 'https://app.example.com/saml',
        acsUrl: 'https://app.example.com/saml/acs',
        sloUrl: 'https://app.example.com/saml/slo',
      });

      expect(settings.idpEntityId).toBe('https://idp.example.com');
      // Should prefer POST binding
      expect(settings.idpSsoUrl).toBe('https://idp.example.com/sso/post');
      expect(settings.idpSloUrl).toBe('https://idp.example.com/slo');
      expect(settings.idpCertificate).toBe('MIIC+DCCAeCgAwIBAgIGAYx...');
      expect(settings.spEntityId).toBe('https://app.example.com/saml');
      expect(settings.acsUrl).toBe('https://app.example.com/saml/acs');
    });

    it('should handle metadata without SLO services', async () => {
      const metadata = {
        entityId: 'https://idp.example.com',
        ssoServices: [
          {
            binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST' as const,
            location: 'https://idp.example.com/sso',
          },
        ],
        signingCertificates: [],
        encryptionCertificates: [],
        nameIdFormats: [],
      };

      const settings = handler.extractSettingsFromMetadata(metadata, {
        spEntityId: 'https://app.example.com/saml',
        acsUrl: 'https://app.example.com/saml/acs',
      });

      expect(settings.idpSloUrl).toBeUndefined();
    });
  });

  describe('setXmlParser', () => {
    it('should allow setting custom XML parser', async () => {
      const mockParser = {
        parseStringPromise: vi.fn().mockResolvedValue({
          EntityDescriptor: {
            $: { entityID: 'https://custom.idp.com' },
            IDPSSODescriptor: {
              SingleSignOnService: {
                $: {
                  Binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
                  Location: 'https://custom.idp.com/sso',
                },
              },
            },
          },
        }),
      };

      handler.setXmlParser(mockParser);
      const metadata = await handler.parseMetadata('<xml>test</xml>');

      expect(metadata.entityId).toBe('https://custom.idp.com');
      expect(mockParser.parseStringPromise).toHaveBeenCalledWith('<xml>test</xml>');
    });
  });
});
