/**
 * @package @forge/sso
 * @description SAML metadata handling (parsing and generation)
 */

import { ErrorCode, ForgeError } from '@forge/errors';
import {
  SamlMetadata,
  SamlSsoService,
  SamlSloService,
  SamlOrganization,
  SamlContact,
  SamlSettings,
} from '../sso.types';
import { XmlParser } from './saml.parser';

/**
 * XML builder interface for dependency injection
 */
export interface XmlBuilder {
  create(options?: { version?: string; encoding?: string }): XmlBuilderNode;
}

/**
 * XML builder node interface
 */
export interface XmlBuilderNode {
  ele(name: string, attributes?: Record<string, string>): XmlBuilderNode;
  txt(text: string): XmlBuilderNode;
  up(): XmlBuilderNode;
  end(options?: { prettyPrint?: boolean }): string;
}

/**
 * SAML metadata handler
 */
export class SamlMetadataHandler {
  private xmlParser: XmlParser | null = null;
  private xmlBuilder: XmlBuilder | null = null;

  /**
   * Initialize dependencies
   */
  async initialize(): Promise<void> {
    if (!this.xmlParser) {
      try {
        const xml2js = await import('xml2js');
        this.xmlParser = new xml2js.Parser({
          explicitArray: false,
          ignoreAttrs: false,
          tagNameProcessors: [(name: string) => name.replace(/^.*:/, '')],
        });
      } catch {
        throw new ForgeError({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'xml2js module not available. Please install xml2js package.',
          statusCode: 500,
        });
      }
    }

    if (!this.xmlBuilder) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const xmlbuilder2 = await import('xmlbuilder2' as any) as { create: XmlBuilder['create'] };
        this.xmlBuilder = { create: xmlbuilder2.create };
      } catch {
        // xmlbuilder2 is optional - SP metadata generation will be unavailable
        this.xmlBuilder = null;
      }
    }
  }

  /**
   * Set XML parser (for testing)
   */
  setXmlParser(parser: XmlParser): void {
    this.xmlParser = parser;
  }

  /**
   * Set XML builder (for testing)
   */
  setXmlBuilder(builder: XmlBuilder): void {
    this.xmlBuilder = builder;
  }

  /**
   * Parse IdP metadata from URL
   */
  async parseMetadataFromUrl(url: string): Promise<SamlMetadata> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new ForgeError({
        code: ErrorCode.SSO_PROVIDER_ERROR,
        message: `Failed to fetch IdP metadata: ${response.status}`,
        statusCode: 400,
      });
    }

    const xml = await response.text();
    return this.parseMetadata(xml);
  }

  /**
   * Parse IdP metadata from XML string
   */
  async parseMetadata(xml: string): Promise<SamlMetadata> {
    if (!this.xmlParser) {
      throw new ForgeError({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'Metadata handler not initialized. Call initialize() first.',
        statusCode: 500,
      });
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = (await this.xmlParser.parseStringPromise(xml)) as Record<string, unknown>;
    } catch (error) {
      throw new ForgeError({
        code: ErrorCode.SSO_CONFIG_INVALID,
        message: 'Failed to parse IdP metadata XML',
        statusCode: 400,
        details: error,
      });
    }

    // Extract EntityDescriptor
    const entityDescriptor = this.extractEntityDescriptor(parsed);
    if (!entityDescriptor) {
      throw new ForgeError({
        code: ErrorCode.SSO_CONFIG_INVALID,
        message: 'Invalid IdP metadata: missing EntityDescriptor',
        statusCode: 400,
      });
    }

    const entityId = this.getAttribute(entityDescriptor, 'entityID');
    if (!entityId) {
      throw new ForgeError({
        code: ErrorCode.SSO_CONFIG_INVALID,
        message: 'Invalid IdP metadata: missing entityID',
        statusCode: 400,
      });
    }

    // Extract IDPSSODescriptor
    const idpDescriptor = this.extractIdpDescriptor(entityDescriptor);
    if (!idpDescriptor) {
      throw new ForgeError({
        code: ErrorCode.SSO_CONFIG_INVALID,
        message: 'Invalid IdP metadata: missing IDPSSODescriptor',
        statusCode: 400,
      });
    }

    return {
      entityId,
      ssoServices: this.extractSsoServices(idpDescriptor),
      sloServices: this.extractSloServices(idpDescriptor),
      signingCertificates: this.extractCertificates(idpDescriptor, 'signing'),
      encryptionCertificates: this.extractCertificates(idpDescriptor, 'encryption'),
      nameIdFormats: this.extractNameIdFormats(idpDescriptor),
      organization: this.extractOrganization(entityDescriptor),
      contacts: this.extractContacts(entityDescriptor),
    };
  }

  /**
   * Generate SP metadata XML
   */
  generateSpMetadata(settings: SamlSettings): string {
    if (!this.xmlBuilder) {
      throw new ForgeError({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'XML builder not available. Please install xmlbuilder2 package.',
        statusCode: 500,
      });
    }

    const doc = this.xmlBuilder.create({ version: '1.0', encoding: 'UTF-8' });

    // EntityDescriptor
    const entityDescriptor = doc.ele('md:EntityDescriptor', {
      'xmlns:md': 'urn:oasis:names:tc:SAML:2.0:metadata',
      'xmlns:ds': 'http://www.w3.org/2000/09/xmldsig#',
      entityID: settings.spEntityId,
    });

    // SPSSODescriptor
    const spDescriptor = entityDescriptor.ele('md:SPSSODescriptor', {
      AuthnRequestsSigned: settings.signRequests ? 'true' : 'false',
      WantAssertionsSigned: settings.requireSignedAssertions ? 'true' : 'false',
      protocolSupportEnumeration: 'urn:oasis:names:tc:SAML:2.0:protocol',
    });

    // NameIDFormat
    const nameIdFormat = settings.nameIdFormat || 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress';
    spDescriptor.ele('md:NameIDFormat').txt(nameIdFormat).up();

    // AssertionConsumerService
    spDescriptor.ele('md:AssertionConsumerService', {
      Binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
      Location: settings.acsUrl,
      index: '0',
      isDefault: 'true',
    });

    // SingleLogoutService (if configured)
    if (settings.sloUrl) {
      spDescriptor.ele('md:SingleLogoutService', {
        Binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
        Location: settings.sloUrl,
      });
      spDescriptor.ele('md:SingleLogoutService', {
        Binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect',
        Location: settings.sloUrl,
      });
    }

    // Signing Certificate (if available)
    if (settings.spCertificate) {
      const keyDescriptor = spDescriptor.ele('md:KeyDescriptor', { use: 'signing' });
      const keyInfo = keyDescriptor.ele('ds:KeyInfo');
      const x509Data = keyInfo.ele('ds:X509Data');
      x509Data.ele('ds:X509Certificate').txt(this.cleanCertificate(settings.spCertificate));
    }

    return doc.end({ prettyPrint: true });
  }

  /**
   * Extract settings from IdP metadata
   */
  extractSettingsFromMetadata(
    metadata: SamlMetadata,
    spSettings: {
      spEntityId: string;
      acsUrl: string;
      sloUrl?: string;
      spPrivateKey?: string;
      spCertificate?: string;
    }
  ): Partial<SamlSettings> {
    // Find preferred SSO service (POST binding preferred)
    const ssoService =
      metadata.ssoServices.find(
        (s) => s.binding === 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST'
      ) || metadata.ssoServices[0];

    // Find SLO service
    const sloService = metadata.sloServices?.find(
      (s) => s.binding === 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST'
    ) || metadata.sloServices?.[0];

    return {
      spEntityId: spSettings.spEntityId,
      idpEntityId: metadata.entityId,
      idpSsoUrl: ssoService?.location || '',
      idpSloUrl: sloService?.location,
      idpCertificate: metadata.signingCertificates[0] || '',
      spPrivateKey: spSettings.spPrivateKey,
      spCertificate: spSettings.spCertificate,
      acsUrl: spSettings.acsUrl,
      sloUrl: spSettings.sloUrl,
      nameIdFormat: (metadata.nameIdFormats[0] as SamlSettings['nameIdFormat']) ||
        'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
    };
  }

  /**
   * Extract EntityDescriptor from parsed XML
   */
  private extractEntityDescriptor(parsed: Record<string, unknown>): Record<string, unknown> | null {
    return (
      (parsed['EntityDescriptor'] as Record<string, unknown>) ||
      (parsed['md:EntityDescriptor'] as Record<string, unknown>) ||
      null
    );
  }

  /**
   * Extract IDPSSODescriptor from EntityDescriptor
   */
  private extractIdpDescriptor(entityDescriptor: Record<string, unknown>): Record<string, unknown> | null {
    return (
      (entityDescriptor['IDPSSODescriptor'] as Record<string, unknown>) ||
      (entityDescriptor['md:IDPSSODescriptor'] as Record<string, unknown>) ||
      null
    );
  }

  /**
   * Get attribute from element
   */
  private getAttribute(element: Record<string, unknown>, name: string): string | undefined {
    const attrs = element['$'] as Record<string, string> | undefined;
    return attrs?.[name];
  }

  /**
   * Extract SSO services from descriptor
   */
  private extractSsoServices(descriptor: Record<string, unknown>): SamlSsoService[] {
    const services =
      descriptor['SingleSignOnService'] || descriptor['md:SingleSignOnService'];

    if (!services) return [];

    const serviceArray = Array.isArray(services) ? services : [services];
    return serviceArray
      .filter((s): s is Record<string, unknown> => typeof s === 'object' && s !== null)
      .map((s) => ({
        binding: this.getAttribute(s, 'Binding') as SamlSsoService['binding'],
        location: this.getAttribute(s, 'Location') || '',
      }));
  }

  /**
   * Extract SLO services from descriptor
   */
  private extractSloServices(descriptor: Record<string, unknown>): SamlSloService[] | undefined {
    const services =
      descriptor['SingleLogoutService'] || descriptor['md:SingleLogoutService'];

    if (!services) return undefined;

    const serviceArray = Array.isArray(services) ? services : [services];
    return serviceArray
      .filter((s): s is Record<string, unknown> => typeof s === 'object' && s !== null)
      .map((s) => ({
        binding: this.getAttribute(s, 'Binding') as SamlSloService['binding'],
        location: this.getAttribute(s, 'Location') || '',
      }));
  }

  /**
   * Extract certificates from descriptor
   */
  private extractCertificates(
    descriptor: Record<string, unknown>,
    use: 'signing' | 'encryption'
  ): string[] {
    const keyDescriptors =
      descriptor['KeyDescriptor'] || descriptor['md:KeyDescriptor'];

    if (!keyDescriptors) return [];

    const descriptorArray = Array.isArray(keyDescriptors)
      ? keyDescriptors
      : [keyDescriptors];

    return descriptorArray
      .filter((kd): kd is Record<string, unknown> => {
        if (typeof kd !== 'object' || kd === null) return false;
        const kdUse = this.getAttribute(kd, 'use');
        // If no use specified, assume it can be used for both
        return !kdUse || kdUse === use;
      })
      .map((kd) => {
        const keyInfo = kd['KeyInfo'] || kd['ds:KeyInfo'];
        if (!keyInfo || typeof keyInfo !== 'object') return '';

        const x509Data =
          (keyInfo as Record<string, unknown>)['X509Data'] ||
          (keyInfo as Record<string, unknown>)['ds:X509Data'];
        if (!x509Data || typeof x509Data !== 'object') return '';

        const cert =
          (x509Data as Record<string, unknown>)['X509Certificate'] ||
          (x509Data as Record<string, unknown>)['ds:X509Certificate'];

        if (typeof cert === 'string') {
          return this.cleanCertificate(cert);
        }
        if (typeof cert === 'object' && cert !== null) {
          return this.cleanCertificate((cert as Record<string, unknown>)['_'] as string || '');
        }
        return '';
      })
      .filter((cert) => cert.length > 0);
  }

  /**
   * Extract NameIDFormats from descriptor
   */
  private extractNameIdFormats(descriptor: Record<string, unknown>): string[] {
    const formats =
      descriptor['NameIDFormat'] || descriptor['md:NameIDFormat'];

    if (!formats) return [];

    const formatArray = Array.isArray(formats) ? formats : [formats];
    return formatArray
      .map((f) => {
        if (typeof f === 'string') return f;
        if (typeof f === 'object' && f !== null) {
          return (f as Record<string, unknown>)['_'] as string || '';
        }
        return '';
      })
      .filter((f) => f.length > 0);
  }

  /**
   * Extract organization from EntityDescriptor
   */
  private extractOrganization(entityDescriptor: Record<string, unknown>): SamlOrganization | undefined {
    const org =
      entityDescriptor['Organization'] || entityDescriptor['md:Organization'];

    if (!org || typeof org !== 'object') return undefined;

    const orgObj = org as Record<string, unknown>;
    const name = this.extractLocalizedValue(orgObj, 'OrganizationName');
    const displayName = this.extractLocalizedValue(orgObj, 'OrganizationDisplayName');
    const url = this.extractLocalizedValue(orgObj, 'OrganizationURL');

    if (!name) return undefined;

    return {
      name,
      displayName: displayName || name,
      url: url || '',
    };
  }

  /**
   * Extract localized value (prefers English)
   */
  private extractLocalizedValue(obj: Record<string, unknown>, elementName: string): string | undefined {
    const element = obj[elementName] || obj[`md:${elementName}`];
    if (!element) return undefined;

    if (typeof element === 'string') return element;

    const elementArray = Array.isArray(element) ? element : [element];
    for (const e of elementArray) {
      if (typeof e === 'string') return e;
      if (typeof e === 'object' && e !== null) {
        const attrs = (e as Record<string, unknown>)['$'] as Record<string, string> | undefined;
        const lang = attrs?.['xml:lang'];
        if (lang === 'en' || !lang) {
          return (e as Record<string, unknown>)['_'] as string || '';
        }
      }
    }

    // Return first value if no English found
    const first = elementArray[0];
    if (typeof first === 'object' && first !== null) {
      return (first as Record<string, unknown>)['_'] as string || '';
    }
    return undefined;
  }

  /**
   * Extract contacts from EntityDescriptor
   */
  private extractContacts(entityDescriptor: Record<string, unknown>): SamlContact[] | undefined {
    const contacts =
      entityDescriptor['ContactPerson'] || entityDescriptor['md:ContactPerson'];

    if (!contacts) return undefined;

    const contactArray = Array.isArray(contacts) ? contacts : [contacts];
    return contactArray
      .filter((c): c is Record<string, unknown> => typeof c === 'object' && c !== null)
      .map((c) => ({
        type: this.getAttribute(c, 'contactType') as SamlContact['type'],
        company: this.getElementText(c, 'Company'),
        givenName: this.getElementText(c, 'GivenName'),
        surName: this.getElementText(c, 'SurName'),
        email: this.getElementText(c, 'EmailAddress'),
      }));
  }

  /**
   * Get text content of an element
   */
  private getElementText(obj: Record<string, unknown>, elementName: string): string | undefined {
    const element = obj[elementName] || obj[`md:${elementName}`];
    if (!element) return undefined;

    if (typeof element === 'string') return element;
    if (typeof element === 'object' && element !== null) {
      return (element as Record<string, unknown>)['_'] as string;
    }
    return undefined;
  }

  /**
   * Clean certificate (remove headers/footers and whitespace)
   */
  private cleanCertificate(cert: string): string {
    return cert
      .replace(/-----BEGIN CERTIFICATE-----/g, '')
      .replace(/-----END CERTIFICATE-----/g, '')
      .replace(/\s+/g, '');
  }
}

// Singleton instance
let metadataHandlerInstance: SamlMetadataHandler | null = null;

/**
 * Get the singleton metadata handler instance
 */
export function getSamlMetadataHandler(): SamlMetadataHandler {
  if (!metadataHandlerInstance) {
    metadataHandlerInstance = new SamlMetadataHandler();
  }
  return metadataHandlerInstance;
}

/**
 * Reset the singleton metadata handler instance (for testing)
 */
export function resetSamlMetadataHandler(): void {
  metadataHandlerInstance = null;
}
