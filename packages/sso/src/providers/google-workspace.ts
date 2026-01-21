/**
 * @package @forge/sso
 * @description Google Workspace SSO provider integration
 */

import {
  OidcProviderConfig,
  OidcSettings,
  SamlProviderConfig,
  OidcAttributeMapping,
  SamlAttributeMapping,
} from '../sso.types';
import { OidcProvider, createOidcSettings } from '../oidc/oidc.provider';
import { SamlProvider, createSamlSettings } from '../saml/saml.provider';
import { OidcDiscoveryService } from '../oidc/oidc.discovery';

/**
 * Google-specific configuration
 */
export interface GoogleConfig {
  /**
   * Application tenant ID for multi-tenant support
   */
  tenantId: string;

  /**
   * Provider name for display
   */
  name?: string;

  /**
   * Whether the provider is enabled
   */
  enabled?: boolean;

  /**
   * Google Workspace domain for hosted domain (hd) parameter
   * If set, restricts login to this domain
   */
  hostedDomain?: string;
}

/**
 * Google OIDC-specific configuration
 */
export interface GoogleOidcConfig extends GoogleConfig {
  /**
   * Google OAuth client ID
   */
  clientId: string;

  /**
   * Google OAuth client secret
   */
  clientSecret: string;

  /**
   * OAuth callback URL
   */
  redirectUri: string;

  /**
   * Post-logout redirect URL (Google doesn't support standard logout)
   */
  postLogoutRedirectUri?: string;

  /**
   * OAuth scopes to request
   */
  scopes?: string[];

  /**
   * Whether to use PKCE (recommended)
   */
  usePkce?: boolean;

  /**
   * Custom attribute mapping
   */
  attributeMapping?: OidcAttributeMapping;

  /**
   * Access type (offline for refresh tokens)
   */
  accessType?: 'online' | 'offline';

  /**
   * Force approval prompt
   */
  prompt?: 'none' | 'consent' | 'select_account';
}

/**
 * Google SAML-specific configuration (via Google Workspace Admin)
 */
export interface GoogleSamlConfig extends GoogleConfig {
  /**
   * SP Entity ID
   */
  spEntityId: string;

  /**
   * Assertion Consumer Service URL
   */
  acsUrl: string;

  /**
   * Single Logout URL
   */
  sloUrl?: string;

  /**
   * IdP SSO URL from Google Workspace
   */
  idpSsoUrl: string;

  /**
   * IdP SLO URL from Google Workspace
   */
  idpSloUrl?: string;

  /**
   * IdP certificate from Google Workspace
   */
  idpCertificate: string;

  /**
   * SP private key for signing
   */
  spPrivateKey?: string;

  /**
   * SP certificate for signing
   */
  spCertificate?: string;

  /**
   * NameID format
   */
  nameIdFormat?: string;

  /**
   * Custom attribute mapping
   */
  attributeMapping?: SamlAttributeMapping;
}

/**
 * Google OIDC discovery URL
 */
export const GOOGLE_OIDC_DISCOVERY_URL =
  'https://accounts.google.com/.well-known/openid-configuration';

/**
 * Default Google OIDC attribute mapping
 */
export const GOOGLE_OIDC_ATTRIBUTE_MAPPING: OidcAttributeMapping = {
  email: 'email',
  firstName: 'given_name',
  lastName: 'family_name',
  displayName: 'name',
  // Google doesn't provide groups via OIDC by default
  // Groups require Google Workspace Admin SDK
};

/**
 * Default Google SAML attribute mapping
 */
export const GOOGLE_SAML_ATTRIBUTE_MAPPING: SamlAttributeMapping = {
  email: 'email',
  firstName: 'firstName',
  lastName: 'lastName',
  displayName: 'displayName',
  // Groups can be configured in Google Workspace Admin
};

/**
 * Create a Google OIDC provider
 */
export function createGoogleOidcProvider(config: GoogleOidcConfig): OidcProvider {
  // Build additional parameters for Google-specific options
  const additionalParams: Record<string, string> = {};

  if (config.hostedDomain) {
    additionalParams['hd'] = config.hostedDomain;
  }

  if (config.accessType) {
    additionalParams['access_type'] = config.accessType;
  }

  if (config.prompt) {
    additionalParams['prompt'] = config.prompt;
  }

  const settings = createOidcSettings({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    redirectUri: config.redirectUri,
    postLogoutRedirectUri: config.postLogoutRedirectUri,
    discoveryUrl: GOOGLE_OIDC_DISCOVERY_URL,
    scopes: config.scopes || ['openid', 'profile', 'email'],
    usePkce: config.usePkce ?? true,
    attributeMapping: config.attributeMapping || GOOGLE_OIDC_ATTRIBUTE_MAPPING,
    additionalParams: Object.keys(additionalParams).length > 0 ? additionalParams : undefined,
  });

  const providerConfig: OidcProviderConfig = {
    type: 'oidc',
    id: `google-oidc-${config.tenantId}`,
    name: config.name || 'Google',
    enabled: config.enabled ?? true,
    tenantId: config.tenantId,
    settings,
  };

  return new OidcProvider(providerConfig);
}

/**
 * Create a Google SAML provider (for Google Workspace)
 */
export function createGoogleSamlProvider(config: GoogleSamlConfig): SamlProvider {
  const settings = createSamlSettings({
    spEntityId: config.spEntityId,
    idpEntityId: 'https://accounts.google.com/o/saml2',
    idpSsoUrl: config.idpSsoUrl,
    idpSloUrl: config.idpSloUrl,
    idpCertificate: config.idpCertificate,
    spPrivateKey: config.spPrivateKey,
    spCertificate: config.spCertificate,
    acsUrl: config.acsUrl,
    sloUrl: config.sloUrl,
    nameIdFormat: config.nameIdFormat || 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
    attributeMapping: config.attributeMapping || GOOGLE_SAML_ATTRIBUTE_MAPPING,
  });

  const providerConfig: SamlProviderConfig = {
    type: 'saml',
    id: `google-saml-${config.tenantId}`,
    name: config.name || 'Google Workspace',
    enabled: config.enabled ?? true,
    tenantId: config.tenantId,
    settings,
  };

  return new SamlProvider(providerConfig);
}

/**
 * Fetch Google OIDC settings from discovery
 */
export async function fetchGoogleOidcSettings(
  clientSettings: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    postLogoutRedirectUri?: string;
    scopes?: string[];
  },
  googleOptions?: {
    hostedDomain?: string;
    accessType?: 'online' | 'offline';
    prompt?: 'none' | 'consent' | 'select_account';
  }
): Promise<OidcSettings> {
  const discoveryService = new OidcDiscoveryService();
  const document = await discoveryService.fetchDiscoveryDocument(GOOGLE_OIDC_DISCOVERY_URL);

  // Build additional parameters
  const additionalParams: Record<string, string> = {};

  if (googleOptions?.hostedDomain) {
    additionalParams['hd'] = googleOptions.hostedDomain;
  }

  if (googleOptions?.accessType) {
    additionalParams['access_type'] = googleOptions.accessType;
  }

  if (googleOptions?.prompt) {
    additionalParams['prompt'] = googleOptions.prompt;
  }

  return createOidcSettings({
    ...clientSettings,
    discoveryUrl: GOOGLE_OIDC_DISCOVERY_URL,
    authorizationEndpoint: document.authorization_endpoint,
    tokenEndpoint: document.token_endpoint,
    userInfoEndpoint: document.userinfo_endpoint,
    jwksUri: document.jwks_uri,
    // Google doesn't have a standard end_session_endpoint
    endSessionEndpoint: undefined,
    scopes: clientSettings.scopes || ['openid', 'profile', 'email'],
    usePkce: document.code_challenge_methods_supported?.includes('S256') ?? true,
    attributeMapping: GOOGLE_OIDC_ATTRIBUTE_MAPPING,
    additionalParams: Object.keys(additionalParams).length > 0 ? additionalParams : undefined,
  });
}

/**
 * Validate that a Google account belongs to a specific domain
 * This is useful for enforcing Workspace domain restrictions
 */
export function validateGoogleDomain(email: string, allowedDomains: string[]): boolean {
  if (!email || allowedDomains.length === 0) {
    return true;
  }

  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) {
    return false;
  }

  return allowedDomains.some((allowed) => allowed.toLowerCase() === domain);
}
