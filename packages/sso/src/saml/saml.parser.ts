/**
 * @package @forge/sso
 * @description SAML response and assertion parser
 */

import { ErrorCode, ForgeError } from '@forge/errors';
import {
  SamlAssertion,
  SamlSubject,
  SamlConditions,
  SamlAuthnStatement,
  SamlSettings,
  SamlAttributeMapping,
  DEFAULT_SAML_ATTRIBUTE_MAPPING,
} from '../sso.types';

/**
 * XML parser interface for dependency injection
 */
export interface XmlParser {
  parseStringPromise(xml: string): Promise<unknown>;
}

/**
 * SAML response structure
 */
export interface SamlResponse {
  /** Response ID */
  id: string;
  /** In response to (request ID) */
  inResponseTo?: string;
  /** Issue instant */
  issueInstant: Date;
  /** Destination */
  destination?: string;
  /** Issuer */
  issuer: string;
  /** Status code */
  statusCode: string;
  /** Status message */
  statusMessage?: string;
  /** Assertion */
  assertion?: SamlAssertion;
  /** Raw XML */
  rawXml: string;
}

/**
 * SAML parser class
 */
export class SamlParser {
  private xmlParser: XmlParser | null = null;

  /**
   * Initialize XML parser
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
  }

  /**
   * Set XML parser (for testing)
   */
  setXmlParser(parser: XmlParser): void {
    this.xmlParser = parser;
  }

  /**
   * Get XML parser
   */
  private getXmlParser(): XmlParser {
    if (!this.xmlParser) {
      throw new ForgeError({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'SAML parser not initialized. Call initialize() first.',
        statusCode: 500,
      });
    }
    return this.xmlParser;
  }

  /**
   * Parse a SAML response
   */
  async parseResponse(
    samlResponse: string,
    settings: SamlSettings
  ): Promise<SamlResponse> {
    const parser = this.getXmlParser();

    // Decode base64 if needed
    const xml = this.decodeResponse(samlResponse);

    // Parse XML
    let parsed: Record<string, unknown>;
    try {
      parsed = (await parser.parseStringPromise(xml)) as Record<string, unknown>;
    } catch (error) {
      throw new ForgeError({
        code: ErrorCode.SSO_ASSERTION_INVALID,
        message: 'Failed to parse SAML response XML',
        statusCode: 400,
        details: error,
      });
    }

    // Extract response element
    const response = this.extractResponseElement(parsed);
    if (!response) {
      throw new ForgeError({
        code: ErrorCode.SSO_ASSERTION_INVALID,
        message: 'Invalid SAML response: missing Response element',
        statusCode: 400,
      });
    }

    // Parse response
    const result: SamlResponse = {
      id: this.getAttribute(response, 'ID') || '',
      inResponseTo: this.getAttribute(response, 'InResponseTo'),
      issueInstant: this.parseDateTime(this.getAttribute(response, 'IssueInstant')),
      destination: this.getAttribute(response, 'Destination'),
      issuer: this.extractIssuer(response),
      statusCode: this.extractStatusCode(response),
      statusMessage: this.extractStatusMessage(response),
      rawXml: xml,
    };

    // Check status
    if (result.statusCode !== 'urn:oasis:names:tc:SAML:2.0:status:Success') {
      throw new ForgeError({
        code: ErrorCode.SSO_ASSERTION_INVALID,
        message: `SAML authentication failed: ${result.statusMessage || result.statusCode}`,
        statusCode: 400,
        details: { statusCode: result.statusCode, statusMessage: result.statusMessage },
      });
    }

    // Parse assertion
    const assertionElement = this.extractAssertionElement(response);
    if (assertionElement) {
      result.assertion = this.parseAssertion(assertionElement, settings.attributeMapping);
    }

    return result;
  }

  /**
   * Parse a SAML assertion
   */
  parseAssertion(
    assertionElement: Record<string, unknown>,
    attributeMapping: SamlAttributeMapping = DEFAULT_SAML_ATTRIBUTE_MAPPING
  ): SamlAssertion {
    const assertion: SamlAssertion = {
      id: this.getAttribute(assertionElement, 'ID') || '',
      issuer: this.extractIssuer(assertionElement),
      issueInstant: this.parseDateTime(this.getAttribute(assertionElement, 'IssueInstant')),
      subject: this.extractSubject(assertionElement),
      conditions: this.extractConditions(assertionElement),
      authnStatement: this.extractAuthnStatement(assertionElement),
      attributes: this.extractAttributes(assertionElement, attributeMapping),
    };

    return assertion;
  }

  /**
   * Validate assertion timing
   */
  validateAssertionTiming(
    assertion: SamlAssertion,
    clockSkewSeconds: number = 60
  ): { valid: boolean; error?: string } {
    const now = new Date();
    const skewMs = clockSkewSeconds * 1000;

    // Check NotBefore
    if (assertion.conditions?.notBefore) {
      const notBeforeDate = new Date(assertion.conditions.notBefore);
      const notBefore = new Date(notBeforeDate.getTime() - skewMs);
      if (now < notBefore) {
        return { valid: false, error: 'Assertion is not yet valid (NotBefore)' };
      }
    }

    // Check NotOnOrAfter
    if (assertion.conditions?.notOnOrAfter) {
      const notOnOrAfterDate = new Date(assertion.conditions.notOnOrAfter);
      const notOnOrAfter = new Date(notOnOrAfterDate.getTime() + skewMs);
      if (now >= notOnOrAfter) {
        return { valid: false, error: 'Assertion has expired (NotOnOrAfter)' };
      }
    }

    // Check Subject confirmation NotOnOrAfter
    if (assertion.subject.notOnOrAfter) {
      const subjectNotOnOrAfter = new Date(assertion.subject.notOnOrAfter.getTime() + skewMs);
      if (now >= subjectNotOnOrAfter) {
        return { valid: false, error: 'Subject confirmation has expired' };
      }
    }

    return { valid: true };
  }

  /**
   * Validate audience restriction
   */
  validateAudienceRestriction(
    assertion: SamlAssertion,
    expectedAudience: string
  ): { valid: boolean; error?: string } {
    const audiences = assertion.conditions?.audienceRestriction;
    if (!audiences || audiences.length === 0) {
      return { valid: true }; // No audience restriction
    }

    if (!audiences.includes(expectedAudience)) {
      return {
        valid: false,
        error: `Audience mismatch. Expected: ${expectedAudience}, Got: ${audiences.join(', ')}`,
      };
    }

    return { valid: true };
  }

  /**
   * Decode SAML response (base64)
   */
  decodeResponse(samlResponse: string): string {
    // Check if it's already XML
    if (samlResponse.trim().startsWith('<')) {
      return samlResponse;
    }
    // Check if it looks like valid base64 (only contains valid base64 characters)
    const base64Pattern = /^[A-Za-z0-9+/=]+$/;
    if (!base64Pattern.test(samlResponse.replace(/\s/g, ''))) {
      // Contains invalid base64 characters, return as-is
      return samlResponse;
    }
    // Try to decode base64
    try {
      const decoded = Buffer.from(samlResponse, 'base64').toString('utf-8');
      // Check if the decoded result looks like valid XML (should start with <)
      // If not, it might be corrupted or not actually base64-encoded XML
      if (decoded.trim().startsWith('<')) {
        return decoded;
      }
      // If we got something that's not XML, return original
      return samlResponse;
    } catch {
      return samlResponse;
    }
  }

  /**
   * Extract attributes from an attribute statement (public wrapper for testing)
   */
  extractAttributesFromStatement(
    attributeStatement: Record<string, unknown> | null
  ): Record<string, string | string[]> {
    if (!attributeStatement || typeof attributeStatement !== 'object') {
      return {};
    }

    const attributes = attributeStatement['Attribute'] || attributeStatement['saml:Attribute'] || attributeStatement['saml2:Attribute'];

    if (!attributes) {
      return {};
    }

    const result: Record<string, string | string[]> = {};
    const attrArray = Array.isArray(attributes) ? attributes : [attributes];

    for (const attr of attrArray) {
      if (typeof attr !== 'object' || attr === null) continue;

      const attrObj = attr as Record<string, unknown>;
      const name = this.getAttribute(attrObj, 'Name');
      if (!name) continue;

      const values =
        attrObj['AttributeValue'] || attrObj['saml:AttributeValue'] || attrObj['saml2:AttributeValue'];

      if (!values) continue;

      const valueArray = Array.isArray(values) ? values : [values];
      const extractedValues: string[] = [];

      for (const value of valueArray) {
        if (typeof value === 'string') {
          extractedValues.push(value);
        } else if (typeof value === 'object' && value !== null) {
          const vObj = value as Record<string, unknown>;
          extractedValues.push((vObj['_'] as string) || '');
        }
      }

      result[name] = extractedValues.length === 1 ? extractedValues[0] : extractedValues;
    }

    return result;
  }

  /**
   * Extract response element from parsed XML
   */
  private extractResponseElement(parsed: Record<string, unknown>): Record<string, unknown> | null {
    // Handle different possible root element names
    return (
      (parsed['Response'] as Record<string, unknown>) ||
      (parsed['samlp:Response'] as Record<string, unknown>) ||
      (parsed['saml2p:Response'] as Record<string, unknown>) ||
      null
    );
  }

  /**
   * Extract assertion element from response
   */
  private extractAssertionElement(response: Record<string, unknown>): Record<string, unknown> | null {
    return (
      (response['Assertion'] as Record<string, unknown>) ||
      (response['saml:Assertion'] as Record<string, unknown>) ||
      (response['saml2:Assertion'] as Record<string, unknown>) ||
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
   * Extract issuer from element
   */
  private extractIssuer(element: Record<string, unknown>): string {
    const issuer = element['Issuer'] || element['saml:Issuer'] || element['saml2:Issuer'];
    if (typeof issuer === 'string') {
      return issuer;
    }
    if (typeof issuer === 'object' && issuer !== null) {
      return (issuer as Record<string, unknown>)['_'] as string || '';
    }
    return '';
  }

  /**
   * Extract status code from response
   */
  private extractStatusCode(response: Record<string, unknown>): string {
    const status = response['Status'] || response['samlp:Status'] || response['saml2p:Status'];
    if (!status || typeof status !== 'object') {
      return '';
    }

    const statusObj = status as Record<string, unknown>;
    const statusCode = statusObj['StatusCode'] || statusObj['samlp:StatusCode'] || statusObj['saml2p:StatusCode'];
    if (!statusCode || typeof statusCode !== 'object') {
      return '';
    }

    return this.getAttribute(statusCode as Record<string, unknown>, 'Value') || '';
  }

  /**
   * Extract status message from response
   */
  private extractStatusMessage(response: Record<string, unknown>): string | undefined {
    const status = response['Status'] || response['samlp:Status'] || response['saml2p:Status'];
    if (!status || typeof status !== 'object') {
      return undefined;
    }

    const statusObj = status as Record<string, unknown>;
    const statusMessage = statusObj['StatusMessage'] || statusObj['samlp:StatusMessage'];
    if (typeof statusMessage === 'string') {
      return statusMessage;
    }
    return undefined;
  }

  /**
   * Extract subject from assertion
   */
  private extractSubject(assertion: Record<string, unknown>): SamlSubject {
    const subject = assertion['Subject'] || assertion['saml:Subject'] || assertion['saml2:Subject'];
    if (!subject || typeof subject !== 'object') {
      return { nameId: '', nameIdFormat: '' };
    }

    const subjectObj = subject as Record<string, unknown>;
    const nameId = subjectObj['NameID'] || subjectObj['saml:NameID'] || subjectObj['saml2:NameID'];

    let nameIdValue = '';
    let nameIdFormat = '';

    if (typeof nameId === 'string') {
      nameIdValue = nameId;
    } else if (typeof nameId === 'object' && nameId !== null) {
      const nameIdObj = nameId as Record<string, unknown>;
      nameIdValue = (nameIdObj['_'] as string) || '';
      nameIdFormat = this.getAttribute(nameIdObj, 'Format') || '';
    }

    // Extract SubjectConfirmation data
    const subjectConfirmation = subjectObj['SubjectConfirmation'] || subjectObj['saml:SubjectConfirmation'];
    let notOnOrAfter: Date | undefined;
    let recipient: string | undefined;
    let inResponseTo: string | undefined;
    let confirmationMethod: string | undefined;

    if (subjectConfirmation && typeof subjectConfirmation === 'object') {
      const scObj = subjectConfirmation as Record<string, unknown>;
      confirmationMethod = this.getAttribute(scObj, 'Method');

      const scData = scObj['SubjectConfirmationData'] || scObj['saml:SubjectConfirmationData'];
      if (scData && typeof scData === 'object') {
        const scDataObj = scData as Record<string, unknown>;
        const notOnOrAfterStr = this.getAttribute(scDataObj, 'NotOnOrAfter');
        if (notOnOrAfterStr) {
          notOnOrAfter = this.parseDateTime(notOnOrAfterStr);
        }
        recipient = this.getAttribute(scDataObj, 'Recipient');
        inResponseTo = this.getAttribute(scDataObj, 'InResponseTo');
      }
    }

    return {
      nameId: nameIdValue,
      nameIdFormat,
      confirmationMethod,
      notOnOrAfter,
      recipient,
      inResponseTo,
    };
  }

  /**
   * Extract conditions from assertion
   */
  private extractConditions(assertion: Record<string, unknown>): SamlConditions {
    const conditions = assertion['Conditions'] || assertion['saml:Conditions'] || assertion['saml2:Conditions'];
    if (!conditions || typeof conditions !== 'object') {
      return {};
    }

    const conditionsObj = conditions as Record<string, unknown>;
    const notBeforeStr = this.getAttribute(conditionsObj, 'NotBefore');
    const notOnOrAfterStr = this.getAttribute(conditionsObj, 'NotOnOrAfter');

    // Extract audience restriction
    const audienceRestriction =
      conditionsObj['AudienceRestriction'] ||
      conditionsObj['saml:AudienceRestriction'] ||
      conditionsObj['saml2:AudienceRestriction'];

    let audiences: string[] | undefined;
    if (audienceRestriction && typeof audienceRestriction === 'object') {
      const arObj = audienceRestriction as Record<string, unknown>;
      const audience = arObj['Audience'] || arObj['saml:Audience'] || arObj['saml2:Audience'];
      if (typeof audience === 'string') {
        audiences = [audience];
      } else if (Array.isArray(audience)) {
        audiences = audience.map((a) => (typeof a === 'string' ? a : (a as Record<string, unknown>)['_'] as string));
      } else if (typeof audience === 'object' && audience !== null) {
        audiences = [(audience as Record<string, unknown>)['_'] as string];
      }
    }

    return {
      notBefore: notBeforeStr,
      notOnOrAfter: notOnOrAfterStr,
      audienceRestriction: audiences,
    };
  }

  /**
   * Extract authentication statement from assertion
   */
  private extractAuthnStatement(assertion: Record<string, unknown>): SamlAuthnStatement | undefined {
    const authnStatement =
      assertion['AuthnStatement'] ||
      assertion['saml:AuthnStatement'] ||
      assertion['saml2:AuthnStatement'];

    if (!authnStatement || typeof authnStatement !== 'object') {
      return undefined;
    }

    const asObj = authnStatement as Record<string, unknown>;
    const authnInstantStr = this.getAttribute(asObj, 'AuthnInstant');
    const sessionNotOnOrAfterStr = this.getAttribute(asObj, 'SessionNotOnOrAfter');

    // Extract AuthnContext
    const authnContext = asObj['AuthnContext'] || asObj['saml:AuthnContext'] || asObj['saml2:AuthnContext'];
    let authnContextClass: string | undefined;
    if (authnContext && typeof authnContext === 'object') {
      const acObj = authnContext as Record<string, unknown>;
      const classRef = acObj['AuthnContextClassRef'] || acObj['saml:AuthnContextClassRef'];
      if (typeof classRef === 'string') {
        authnContextClass = classRef;
      } else if (typeof classRef === 'object' && classRef !== null) {
        authnContextClass = (classRef as Record<string, unknown>)['_'] as string;
      }
    }

    return {
      authnInstant: authnInstantStr ? this.parseDateTime(authnInstantStr) : new Date(),
      sessionIndex: this.getAttribute(asObj, 'SessionIndex'),
      sessionNotOnOrAfter: sessionNotOnOrAfterStr,
      authnContextClass,
    };
  }

  /**
   * Extract attributes from assertion
   */
  private extractAttributes(
    assertion: Record<string, unknown>,
    _mapping: SamlAttributeMapping
  ): Record<string, string | string[]> {
    const attributeStatement =
      assertion['AttributeStatement'] ||
      assertion['saml:AttributeStatement'] ||
      assertion['saml2:AttributeStatement'];

    if (!attributeStatement || typeof attributeStatement !== 'object') {
      return {};
    }

    const asObj = attributeStatement as Record<string, unknown>;
    const attributes = asObj['Attribute'] || asObj['saml:Attribute'] || asObj['saml2:Attribute'];

    if (!attributes) {
      return {};
    }

    const result: Record<string, string | string[]> = {};
    const attrArray = Array.isArray(attributes) ? attributes : [attributes];

    for (const attr of attrArray) {
      if (typeof attr !== 'object' || attr === null) continue;

      const attrObj = attr as Record<string, unknown>;
      const name = this.getAttribute(attrObj, 'Name');
      if (!name) continue;

      const values =
        attrObj['AttributeValue'] || attrObj['saml:AttributeValue'] || attrObj['saml2:AttributeValue'];

      if (!values) continue;

      const valueArray = Array.isArray(values) ? values : [values];
      const extractedValues: string[] = [];

      for (const value of valueArray) {
        if (typeof value === 'string') {
          extractedValues.push(value);
        } else if (typeof value === 'object' && value !== null) {
          const vObj = value as Record<string, unknown>;
          extractedValues.push((vObj['_'] as string) || '');
        }
      }

      result[name] = extractedValues.length === 1 ? extractedValues[0] : extractedValues;
    }

    return result;
  }

  /**
   * Parse ISO 8601 datetime string
   */
  private parseDateTime(dateStr: string | undefined): Date {
    if (!dateStr) {
      return new Date();
    }
    return new Date(dateStr);
  }
}

// Singleton instance
let samlParserInstance: SamlParser | null = null;

/**
 * Get the singleton SAML parser instance
 */
export function getSamlParser(): SamlParser {
  if (!samlParserInstance) {
    samlParserInstance = new SamlParser();
  }
  return samlParserInstance;
}

/**
 * Reset the singleton SAML parser instance (for testing)
 */
export function resetSamlParser(): void {
  samlParserInstance = null;
}
