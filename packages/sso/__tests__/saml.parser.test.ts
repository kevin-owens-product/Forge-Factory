/**
 * @package @forge/sso
 * @description Tests for SAML parser
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  SamlParser,
  getSamlParser,
  resetSamlParser,
  SamlAssertion,
} from '../src/saml/saml.parser';
import { SamlSettings } from '../src/sso.types';

describe('SamlParser', () => {
  let parser: SamlParser;

  const mockSettings: SamlSettings = {
    spEntityId: 'https://app.example.com/saml',
    idpEntityId: 'https://idp.example.com',
    idpSsoUrl: 'https://idp.example.com/sso',
    idpCertificate: 'MOCK_CERTIFICATE',
    acsUrl: 'https://app.example.com/saml/acs',
    nameIdFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
  };

  beforeEach(async () => {
    resetSamlParser();
    parser = getSamlParser();
    await parser.initialize();
  });

  describe('constructor and initialization', () => {
    it('should create a parser instance', () => {
      expect(parser).toBeInstanceOf(SamlParser);
    });

    it('should return singleton instance', () => {
      const parser2 = getSamlParser();
      expect(parser2).toBe(parser);
    });

    it('should reset singleton instance', () => {
      resetSamlParser();
      const parser2 = getSamlParser();
      expect(parser2).not.toBe(parser);
    });
  });

  describe('decodeResponse', () => {
    it('should decode base64 SAML response', () => {
      const xml = '<samlp:Response>test</samlp:Response>';
      const encoded = Buffer.from(xml).toString('base64');

      const decoded = parser.decodeResponse(encoded);
      expect(decoded).toBe(xml);
    });

    it('should handle already decoded XML', () => {
      const xml = '<samlp:Response>test</samlp:Response>';
      const decoded = parser.decodeResponse(xml);
      expect(decoded).toBe(xml);
    });

    it('should handle invalid base64', () => {
      const invalid = 'not-valid-base64!!!';
      const decoded = parser.decodeResponse(invalid);
      expect(decoded).toBe(invalid);
    });
  });

  describe('validateAssertionTiming', () => {
    it('should return valid for non-expired assertion', () => {
      const now = new Date();
      const assertion: SamlAssertion = {
        issuer: 'https://idp.example.com',
        subject: {
          nameId: 'user@example.com',
          nameIdFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
        },
        conditions: {
          notBefore: new Date(now.getTime() - 60000).toISOString(),
          notOnOrAfter: new Date(now.getTime() + 300000).toISOString(),
        },
        attributes: {},
      };

      const result = parser.validateAssertionTiming(assertion);
      expect(result.valid).toBe(true);
    });

    it('should return invalid for expired assertion', () => {
      const now = new Date();
      const assertion: SamlAssertion = {
        issuer: 'https://idp.example.com',
        subject: {
          nameId: 'user@example.com',
          nameIdFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
        },
        conditions: {
          notBefore: new Date(now.getTime() - 600000).toISOString(),
          notOnOrAfter: new Date(now.getTime() - 60000).toISOString(),
        },
        attributes: {},
      };

      const result = parser.validateAssertionTiming(assertion);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('expired');
    });

    it('should return invalid for assertion not yet valid', () => {
      const now = new Date();
      const assertion: SamlAssertion = {
        issuer: 'https://idp.example.com',
        subject: {
          nameId: 'user@example.com',
          nameIdFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
        },
        conditions: {
          notBefore: new Date(now.getTime() + 300000).toISOString(),
          notOnOrAfter: new Date(now.getTime() + 600000).toISOString(),
        },
        attributes: {},
      };

      const result = parser.validateAssertionTiming(assertion);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('not yet valid');
    });

    it('should allow clock skew', () => {
      const now = new Date();
      const assertion: SamlAssertion = {
        issuer: 'https://idp.example.com',
        subject: {
          nameId: 'user@example.com',
          nameIdFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
        },
        conditions: {
          notBefore: new Date(now.getTime() + 30000).toISOString(), // 30 seconds in future
          notOnOrAfter: new Date(now.getTime() + 600000).toISOString(),
        },
        attributes: {},
      };

      // Without clock skew, should be invalid
      const result1 = parser.validateAssertionTiming(assertion, 0);
      expect(result1.valid).toBe(false);

      // With 60 second clock skew, should be valid
      const result2 = parser.validateAssertionTiming(assertion, 60);
      expect(result2.valid).toBe(true);
    });
  });

  describe('validateAudienceRestriction', () => {
    it('should return valid when audience matches', () => {
      const assertion: SamlAssertion = {
        issuer: 'https://idp.example.com',
        subject: {
          nameId: 'user@example.com',
          nameIdFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
        },
        conditions: {
          audienceRestriction: ['https://app.example.com/saml'],
        },
        attributes: {},
      };

      const result = parser.validateAudienceRestriction(
        assertion,
        'https://app.example.com/saml'
      );
      expect(result.valid).toBe(true);
    });

    it('should return invalid when audience does not match', () => {
      const assertion: SamlAssertion = {
        issuer: 'https://idp.example.com',
        subject: {
          nameId: 'user@example.com',
          nameIdFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
        },
        conditions: {
          audienceRestriction: ['https://other-app.example.com/saml'],
        },
        attributes: {},
      };

      const result = parser.validateAudienceRestriction(
        assertion,
        'https://app.example.com/saml'
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Audience mismatch');
    });

    it('should return valid when no audience restriction', () => {
      const assertion: SamlAssertion = {
        issuer: 'https://idp.example.com',
        subject: {
          nameId: 'user@example.com',
          nameIdFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
        },
        conditions: {},
        attributes: {},
      };

      const result = parser.validateAudienceRestriction(
        assertion,
        'https://app.example.com/saml'
      );
      expect(result.valid).toBe(true);
    });
  });

  describe('extractAttributesFromStatement', () => {
    it('should extract single-value attributes', () => {
      const attributeStatement = {
        Attribute: [
          {
            $: { Name: 'email' },
            AttributeValue: ['user@example.com'],
          },
          {
            $: { Name: 'firstName' },
            AttributeValue: ['John'],
          },
        ],
      };

      const result = parser.extractAttributesFromStatement(attributeStatement);
      expect(result).toEqual({
        email: 'user@example.com',
        firstName: 'John',
      });
    });

    it('should extract multi-value attributes', () => {
      const attributeStatement = {
        Attribute: [
          {
            $: { Name: 'groups' },
            AttributeValue: ['admin', 'users', 'developers'],
          },
        ],
      };

      const result = parser.extractAttributesFromStatement(attributeStatement);
      expect(result).toEqual({
        groups: ['admin', 'users', 'developers'],
      });
    });

    it('should handle empty attribute statement', () => {
      const result = parser.extractAttributesFromStatement(null);
      expect(result).toEqual({});
    });

    it('should handle single attribute (not array)', () => {
      const attributeStatement = {
        Attribute: {
          $: { Name: 'email' },
          AttributeValue: 'user@example.com',
        },
      };

      const result = parser.extractAttributesFromStatement(attributeStatement);
      expect(result).toEqual({
        email: 'user@example.com',
      });
    });

    it('should handle attribute with object value', () => {
      const attributeStatement = {
        Attribute: [
          {
            $: { Name: 'email' },
            AttributeValue: [{ _: 'user@example.com' }],
          },
        ],
      };

      const result = parser.extractAttributesFromStatement(attributeStatement);
      expect(result).toEqual({
        email: 'user@example.com',
      });
    });

    it('should handle saml prefixed attributes', () => {
      const attributeStatement = {
        'saml:Attribute': [
          {
            $: { Name: 'email' },
            'saml:AttributeValue': ['user@example.com'],
          },
        ],
      };

      const result = parser.extractAttributesFromStatement(attributeStatement);
      expect(result).toEqual({
        email: 'user@example.com',
      });
    });

    it('should skip attributes without name', () => {
      const attributeStatement = {
        Attribute: [
          {
            $: {},
            AttributeValue: ['value'],
          },
          {
            $: { Name: 'valid' },
            AttributeValue: ['valid-value'],
          },
        ],
      };

      const result = parser.extractAttributesFromStatement(attributeStatement);
      expect(result).toEqual({
        valid: 'valid-value',
      });
    });
  });

  describe('parseResponse', () => {
    it('should parse valid SAML response', async () => {
      const samlResponse = `<?xml version="1.0"?>
        <samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="_response123" IssueInstant="2024-01-01T00:00:00Z">
          <saml:Issuer xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">https://idp.example.com</saml:Issuer>
          <samlp:Status>
            <samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/>
          </samlp:Status>
          <saml:Assertion xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="_assertion123" IssueInstant="2024-01-01T00:00:00Z">
            <saml:Issuer>https://idp.example.com</saml:Issuer>
            <saml:Subject>
              <saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">user@example.com</saml:NameID>
            </saml:Subject>
            <saml:Conditions NotBefore="2024-01-01T00:00:00Z" NotOnOrAfter="2024-01-01T01:00:00Z">
              <saml:AudienceRestriction>
                <saml:Audience>https://app.example.com/saml</saml:Audience>
              </saml:AudienceRestriction>
            </saml:Conditions>
          </saml:Assertion>
        </samlp:Response>`;

      const response = await parser.parseResponse(samlResponse, mockSettings);

      expect(response.id).toBe('_response123');
      expect(response.issuer).toBe('https://idp.example.com');
      expect(response.statusCode).toBe('urn:oasis:names:tc:SAML:2.0:status:Success');
      expect(response.assertion).toBeDefined();
      expect(response.assertion?.issuer).toBe('https://idp.example.com');
    });

    it('should parse base64 encoded SAML response', async () => {
      const xml = `<?xml version="1.0"?>
        <samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="_resp" IssueInstant="2024-01-01T00:00:00Z">
          <saml:Issuer xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">https://idp.example.com</saml:Issuer>
          <samlp:Status>
            <samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/>
          </samlp:Status>
        </samlp:Response>`;
      const encoded = Buffer.from(xml).toString('base64');

      const response = await parser.parseResponse(encoded, mockSettings);

      expect(response.id).toBe('_resp');
      expect(response.statusCode).toBe('urn:oasis:names:tc:SAML:2.0:status:Success');
    });

    it('should throw error for failed SAML authentication', async () => {
      const samlResponse = `<?xml version="1.0"?>
        <samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="_response123" IssueInstant="2024-01-01T00:00:00Z">
          <saml:Issuer xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">https://idp.example.com</saml:Issuer>
          <samlp:Status>
            <samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Requester"/>
            <samlp:StatusMessage>Authentication failed</samlp:StatusMessage>
          </samlp:Status>
        </samlp:Response>`;

      await expect(parser.parseResponse(samlResponse, mockSettings)).rejects.toThrow(
        'SAML authentication failed'
      );
    });

    it('should throw error for invalid XML', async () => {
      await expect(parser.parseResponse('not valid xml', mockSettings)).rejects.toThrow(
        'Failed to parse SAML response XML'
      );
    });

    it('should throw error for missing Response element', async () => {
      const invalidResponse = `<?xml version="1.0"?><root></root>`;
      await expect(parser.parseResponse(invalidResponse, mockSettings)).rejects.toThrow(
        'Invalid SAML response: missing Response element'
      );
    });
  });

  describe('parseAssertion', () => {
    it('should parse assertion element', async () => {
      const assertionElement = {
        $: { ID: '_assertion123', IssueInstant: '2024-01-01T00:00:00Z' },
        Issuer: 'https://idp.example.com',
        Subject: {
          NameID: {
            _: 'user@example.com',
            $: { Format: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress' },
          },
          SubjectConfirmation: {
            $: { Method: 'urn:oasis:names:tc:SAML:2.0:cm:bearer' },
            SubjectConfirmationData: {
              $: {
                NotOnOrAfter: '2024-01-01T01:00:00Z',
                Recipient: 'https://app.example.com/saml/acs',
                InResponseTo: '_request123',
              },
            },
          },
        },
        Conditions: {
          $: { NotBefore: '2024-01-01T00:00:00Z', NotOnOrAfter: '2024-01-01T01:00:00Z' },
          AudienceRestriction: {
            Audience: 'https://app.example.com/saml',
          },
        },
        AuthnStatement: {
          $: { AuthnInstant: '2024-01-01T00:00:00Z', SessionIndex: '_session123' },
          AuthnContext: {
            AuthnContextClassRef: 'urn:oasis:names:tc:SAML:2.0:ac:classes:Password',
          },
        },
        AttributeStatement: {
          Attribute: [
            {
              $: { Name: 'email' },
              AttributeValue: 'user@example.com',
            },
          ],
        },
      };

      const assertion = parser.parseAssertion(assertionElement);

      expect(assertion.id).toBe('_assertion123');
      expect(assertion.issuer).toBe('https://idp.example.com');
      expect(assertion.subject.nameId).toBe('user@example.com');
      expect(assertion.subject.nameIdFormat).toBe('urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress');
      expect(assertion.subject.confirmationMethod).toBe('urn:oasis:names:tc:SAML:2.0:cm:bearer');
      expect(assertion.subject.recipient).toBe('https://app.example.com/saml/acs');
      expect(assertion.conditions?.notBefore).toBe('2024-01-01T00:00:00Z');
      expect(assertion.conditions?.audienceRestriction).toContain('https://app.example.com/saml');
      expect(assertion.authnStatement?.authnContextClass).toBe('urn:oasis:names:tc:SAML:2.0:ac:classes:Password');
    });
  });
});
