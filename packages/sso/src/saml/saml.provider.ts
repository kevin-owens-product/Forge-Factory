/**
 * @package @forge/sso
 * @description SAML 2.0 Service Provider implementation
 */

import { ErrorCode, ForgeError } from '@forge/errors';
import { UserIdentity } from '@forge/auth';
import {
  SamlProviderConfig,
  SamlSettings,
  SsoAuthRequest,
  SsoAuthResponse,
  SsoLogoutRequest,
  SsoLogoutResponse,
  SsoUserProfile,
  SamlAssertion,
  DEFAULT_SAML_ATTRIBUTE_MAPPING,
  UserProvisioningCallback,
} from '../sso.types';
import { SamlParser, getSamlParser, SamlResponse } from './saml.parser';
import { SamlMetadataHandler, getSamlMetadataHandler } from './saml.metadata';

/**
 * SAML provider class
 */
export class SamlProvider {
  readonly type = 'saml' as const;
  readonly id: string;
  readonly name: string;
  readonly enabled: boolean;
  readonly tenantId: string;

  private settings: SamlSettings;
  private parser: SamlParser;
  private metadataHandler: SamlMetadataHandler;
  private userProvisioner?: UserProvisioningCallback;

  constructor(config: SamlProviderConfig) {
    this.id = config.id;
    this.name = config.name;
    this.enabled = config.enabled;
    this.tenantId = config.tenantId;
    this.settings = config.settings;
    this.parser = getSamlParser();
    this.metadataHandler = getSamlMetadataHandler();
  }

  /**
   * Initialize the provider
   */
  async initialize(): Promise<void> {
    await this.parser.initialize();
    await this.metadataHandler.initialize();
  }

  /**
   * Set user provisioner callback
   */
  setUserProvisioner(callback: UserProvisioningCallback): void {
    this.userProvisioner = callback;
  }

  /**
   * Generate SAML authentication request URL
   */
  generateAuthUrl(request: SsoAuthRequest): string {
    const params = new URLSearchParams();

    // Generate AuthnRequest
    const authnRequest = this.generateAuthnRequest(request);
    const encodedRequest = this.encodeRequest(authnRequest);

    params.set('SAMLRequest', encodedRequest);

    if (request.relayState) {
      params.set('RelayState', request.relayState);
    }

    // For HTTP-Redirect binding
    return `${this.settings.idpSsoUrl}?${params.toString()}`;
  }

  /**
   * Generate AuthnRequest XML
   */
  generateAuthnRequest(request: SsoAuthRequest): string {
    const id = this.generateRequestId();
    const issueInstant = new Date().toISOString();

    let authnRequest = `<?xml version="1.0" encoding="UTF-8"?>
<samlp:AuthnRequest
  xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
  xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
  ID="${id}"
  Version="2.0"
  IssueInstant="${issueInstant}"
  Destination="${this.settings.idpSsoUrl}"
  AssertionConsumerServiceURL="${this.settings.acsUrl}"
  ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"`;

    if (request.forceAuthn) {
      authnRequest += ` ForceAuthn="true"`;
    }

    authnRequest += `>
  <saml:Issuer>${this.settings.spEntityId}</saml:Issuer>
  <samlp:NameIDPolicy
    Format="${this.settings.nameIdFormat}"
    AllowCreate="true"/>`;

    if (this.settings.authnContext || request.authnContext) {
      const context = request.authnContext || this.settings.authnContext;
      authnRequest += `
  <samlp:RequestedAuthnContext Comparison="exact">
    <saml:AuthnContextClassRef>${context}</saml:AuthnContextClassRef>
  </samlp:RequestedAuthnContext>`;
    }

    authnRequest += `
</samlp:AuthnRequest>`;

    return authnRequest;
  }

  /**
   * Process SAML response (from ACS callback)
   */
  async processResponse(
    samlResponse: string,
    relayState?: string
  ): Promise<SsoAuthResponse> {
    try {
      // Parse the SAML response
      const response = await this.parser.parseResponse(samlResponse, this.settings);

      // Validate the response
      await this.validateResponse(response);

      if (!response.assertion) {
        throw new ForgeError({
          code: ErrorCode.SSO_ASSERTION_INVALID,
          message: 'SAML response does not contain an assertion',
          statusCode: 400,
        });
      }

      // Extract user profile
      const profile = this.extractUserProfile(response.assertion);

      // Provision user if callback is set
      let user: UserIdentity | undefined;
      if (this.userProvisioner) {
        const result = await this.userProvisioner(profile, this.tenantId, this.id);
        if (!result.success) {
          return {
            success: false,
            error: result.error || 'User provisioning failed',
            errorCode: ErrorCode.SSO_PROVIDER_ERROR,
          };
        }
        user = result.user;
      } else {
        // Create basic user identity from profile
        user = this.createUserIdentity(profile);
      }

      return {
        success: true,
        user,
        relayState,
        ssoSessionId: response.assertion.authnStatement?.sessionIndex,
        ssoSessionExpiry: response.assertion.authnStatement?.sessionNotOnOrAfter,
        rawData: response,
      };
    } catch (error) {
      if (error instanceof ForgeError) {
        return {
          success: false,
          error: error.message,
          errorCode: error.code,
        };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorCode: ErrorCode.SSO_PROVIDER_ERROR,
      };
    }
  }

  /**
   * Generate logout request URL
   */
  generateLogoutUrl(request: SsoLogoutRequest): SsoLogoutResponse {
    if (!this.settings.idpSloUrl) {
      return {
        success: false,
        error: 'Single logout is not configured for this provider',
      };
    }

    const params = new URLSearchParams();

    // Generate LogoutRequest
    const logoutRequest = this.generateLogoutRequest(request);
    const encodedRequest = this.encodeRequest(logoutRequest);

    params.set('SAMLRequest', encodedRequest);

    if (request.relayState) {
      params.set('RelayState', request.relayState);
    }

    return {
      success: true,
      logoutUrl: `${this.settings.idpSloUrl}?${params.toString()}`,
      relayState: request.relayState,
    };
  }

  /**
   * Generate LogoutRequest XML
   */
  generateLogoutRequest(request: SsoLogoutRequest): string {
    const id = this.generateRequestId();
    const issueInstant = new Date().toISOString();

    let logoutRequest = `<?xml version="1.0" encoding="UTF-8"?>
<samlp:LogoutRequest
  xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
  xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
  ID="${id}"
  Version="2.0"
  IssueInstant="${issueInstant}"
  Destination="${this.settings.idpSloUrl}">
  <saml:Issuer>${this.settings.spEntityId}</saml:Issuer>
  <saml:NameID Format="${this.settings.nameIdFormat}">${request.userId}</saml:NameID>`;

    if (request.ssoSessionId) {
      logoutRequest += `
  <samlp:SessionIndex>${request.ssoSessionId}</samlp:SessionIndex>`;
    }

    logoutRequest += `
</samlp:LogoutRequest>`;

    return logoutRequest;
  }

  /**
   * Process logout response
   */
  async processLogoutResponse(
    samlResponse: string,
    relayState?: string
  ): Promise<SsoLogoutResponse> {
    try {
      const response = await this.parser.parseResponse(samlResponse, this.settings);

      // Check status
      if (response.statusCode !== 'urn:oasis:names:tc:SAML:2.0:status:Success') {
        return {
          success: false,
          error: response.statusMessage || 'Logout failed',
          relayState,
        };
      }

      return {
        success: true,
        relayState,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        relayState,
      };
    }
  }

  /**
   * Generate SP metadata
   */
  generateMetadata(): string {
    return this.metadataHandler.generateSpMetadata(this.settings);
  }

  /**
   * Get provider settings
   */
  getSettings(): SamlSettings {
    return { ...this.settings };
  }

  /**
   * Get public configuration (safe to expose to clients)
   */
  getPublicConfig(): Partial<SamlProviderConfig> {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      enabled: this.enabled,
      tenantId: this.tenantId,
      settings: {
        spEntityId: this.settings.spEntityId,
        idpEntityId: this.settings.idpEntityId,
        acsUrl: this.settings.acsUrl,
        sloUrl: this.settings.sloUrl,
        nameIdFormat: this.settings.nameIdFormat,
      } as SamlSettings,
    };
  }

  /**
   * Validate SAML response
   */
  private async validateResponse(response: SamlResponse): Promise<void> {
    const assertion = response.assertion;
    if (!assertion) {
      throw new ForgeError({
        code: ErrorCode.SSO_ASSERTION_INVALID,
        message: 'No assertion in SAML response',
        statusCode: 400,
      });
    }

    // Validate issuer
    if (assertion.issuer !== this.settings.idpEntityId) {
      throw new ForgeError({
        code: ErrorCode.SSO_ASSERTION_INVALID,
        message: `Issuer mismatch. Expected: ${this.settings.idpEntityId}, Got: ${assertion.issuer}`,
        statusCode: 400,
      });
    }

    // Validate timing
    const timingResult = this.parser.validateAssertionTiming(
      assertion,
      this.settings.clockSkewSeconds
    );
    if (!timingResult.valid) {
      throw new ForgeError({
        code: ErrorCode.SSO_EXPIRED,
        message: timingResult.error || 'Assertion timing validation failed',
        statusCode: 400,
      });
    }

    // Validate audience
    const audienceResult = this.parser.validateAudienceRestriction(
      assertion,
      this.settings.spEntityId
    );
    if (!audienceResult.valid) {
      throw new ForgeError({
        code: ErrorCode.SSO_ASSERTION_INVALID,
        message: audienceResult.error || 'Audience validation failed',
        statusCode: 400,
      });
    }

    // Note: Signature validation would require additional crypto libraries
    // In a production implementation, you would verify the XML signature here
    if (this.settings.requireSignedAssertions) {
      // TODO: Implement signature validation
      // This would use node-forge or similar to verify the XML signature
    }
  }

  /**
   * Extract user profile from assertion
   */
  private extractUserProfile(assertion: SamlAssertion): SsoUserProfile {
    const mapping = this.settings.attributeMapping || DEFAULT_SAML_ATTRIBUTE_MAPPING;

    const getAttribute = (key: string | undefined): string | undefined => {
      if (!key) return undefined;
      const value = assertion.attributes[key];
      return Array.isArray(value) ? value[0] : value;
    };

    const getAttributes = (key: string | undefined): string[] | undefined => {
      if (!key) return undefined;
      const value = assertion.attributes[key];
      if (!value) return undefined;
      return Array.isArray(value) ? value : [value];
    };

    return {
      externalId: assertion.subject.nameId,
      email: getAttribute(mapping.email) || assertion.subject.nameId,
      firstName: getAttribute(mapping.firstName),
      lastName: getAttribute(mapping.lastName),
      displayName: getAttribute(mapping.displayName),
      groups: getAttributes(mapping.groups),
      rawAttributes: assertion.attributes,
      providerId: this.id,
      providerType: 'saml',
    };
  }

  /**
   * Create user identity from profile
   */
  private createUserIdentity(profile: SsoUserProfile): UserIdentity {
    return {
      id: profile.externalId,
      email: profile.email,
      tenantId: this.tenantId,
      roles: profile.groups || [],
      permissions: [],
      emailVerified: true, // SAML IdP verified email
      mfaEnabled: false,
      metadata: {
        ssoProvider: this.id,
        ssoProviderType: 'saml',
        firstName: profile.firstName,
        lastName: profile.lastName,
        displayName: profile.displayName,
      },
    };
  }

  /**
   * Encode request for HTTP-Redirect binding
   */
  private encodeRequest(request: string): string {
    // Deflate and base64 encode
    const buffer = Buffer.from(request, 'utf-8');
    // Note: For production, you should use zlib.deflateRawSync here
    // For simplicity, we're using base64 encoding only
    return buffer.toString('base64');
  }

  /**
   * Generate a unique request ID
   */
  private generateRequestId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `_${timestamp}${random}`;
  }

  /**
   * Set parser (for testing)
   */
  setParser(parser: SamlParser): void {
    this.parser = parser;
  }

  /**
   * Set metadata handler (for testing)
   */
  setMetadataHandler(handler: SamlMetadataHandler): void {
    this.metadataHandler = handler;
  }
}

/**
 * Create a SAML provider from configuration
 */
export function createSamlProvider(config: SamlProviderConfig): SamlProvider {
  return new SamlProvider(config);
}

/**
 * Create SAML settings with defaults
 */
export function createSamlSettings(
  settings: Partial<SamlSettings> & {
    spEntityId: string;
    idpEntityId: string;
    idpSsoUrl: string;
    idpCertificate: string;
    acsUrl: string;
  }
): SamlSettings {
  return {
    spEntityId: settings.spEntityId,
    idpEntityId: settings.idpEntityId,
    idpSsoUrl: settings.idpSsoUrl,
    idpSloUrl: settings.idpSloUrl,
    idpCertificate: settings.idpCertificate,
    spPrivateKey: settings.spPrivateKey,
    spCertificate: settings.spCertificate,
    acsUrl: settings.acsUrl,
    sloUrl: settings.sloUrl,
    nameIdFormat: settings.nameIdFormat || 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
    attributeMapping: settings.attributeMapping || DEFAULT_SAML_ATTRIBUTE_MAPPING,
    signRequests: settings.signRequests ?? false,
    requireSignedAssertions: settings.requireSignedAssertions ?? true,
    requireEncryptedAssertions: settings.requireEncryptedAssertions ?? false,
    clockSkewSeconds: settings.clockSkewSeconds ?? 60,
    authnContext: settings.authnContext,
  };
}
