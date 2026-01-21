/**
 * @package @forge/sso
 * @description Okta SSO provider integration
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
 * Okta-specific configuration
 */
export interface OktaConfig {
  /**
   * Okta organization domain (e.g., 'mycompany.okta.com')
   */
  domain: string;

  /**
   * Tenant ID for multi-tenant support
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
}

/**
 * Okta OIDC-specific configuration
 */
export interface OktaOidcConfig extends OktaConfig {
  /**
   * Okta application client ID
   */
  clientId: string;

  /**
   * Okta application client secret
   */
  clientSecret: string;

  /**
   * OAuth callback URL
   */
  redirectUri: string;

  /**
   * Post-logout redirect URL
   */
  postLogoutRedirectUri?: string;

  /**
   * OAuth scopes to request
   */
  scopes?: string[];

  /**
   * Whether to use PKCE
   */
  usePkce?: boolean;

  /**
   * Custom attribute mapping
   */
  attributeMapping?: OidcAttributeMapping;

  /**
   * Okta authorization server ID (default: 'default')
   */
  authorizationServerId?: string;
}

/**
 * Okta SAML-specific configuration
 */
export interface OktaSamlConfig extends OktaConfig {
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
   * IdP SSO URL from Okta
   */
  idpSsoUrl: string;

  /**
   * IdP SLO URL from Okta
   */
  idpSloUrl?: string;

  /**
   * IdP certificate from Okta
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
 * Default Okta OIDC attribute mapping
 */
export const OKTA_OIDC_ATTRIBUTE_MAPPING: OidcAttributeMapping = {
  email: 'email',
  firstName: 'given_name',
  lastName: 'family_name',
  displayName: 'name',
  groups: 'groups',
};

/**
 * Default Okta SAML attribute mapping
 */
export const OKTA_SAML_ATTRIBUTE_MAPPING: SamlAttributeMapping = {
  email: 'email',
  firstName: 'firstName',
  lastName: 'lastName',
  displayName: 'displayName',
  groups: 'groups',
};

/**
 * Create an Okta OIDC provider
 */
export function createOktaOidcProvider(config: OktaOidcConfig): OidcProvider {
  const authServerId = config.authorizationServerId || 'default';
  const baseUrl = `https://${config.domain}`;
  const discoveryUrl = `${baseUrl}/oauth2/${authServerId}/.well-known/openid-configuration`;

  const settings = createOidcSettings({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    redirectUri: config.redirectUri,
    postLogoutRedirectUri: config.postLogoutRedirectUri,
    discoveryUrl,
    scopes: config.scopes || ['openid', 'profile', 'email', 'groups'],
    usePkce: config.usePkce ?? true,
    attributeMapping: config.attributeMapping || OKTA_OIDC_ATTRIBUTE_MAPPING,
  });

  const providerConfig: OidcProviderConfig = {
    type: 'oidc',
    id: `okta-oidc-${config.tenantId}`,
    name: config.name || 'Okta',
    enabled: config.enabled ?? true,
    tenantId: config.tenantId,
    settings,
  };

  return new OidcProvider(providerConfig);
}

/**
 * Create an Okta SAML provider
 */
export function createOktaSamlProvider(config: OktaSamlConfig): SamlProvider {
  const settings = createSamlSettings({
    spEntityId: config.spEntityId,
    idpEntityId: `http://www.okta.com/${config.domain}`,
    idpSsoUrl: config.idpSsoUrl,
    idpSloUrl: config.idpSloUrl,
    idpCertificate: config.idpCertificate,
    spPrivateKey: config.spPrivateKey,
    spCertificate: config.spCertificate,
    acsUrl: config.acsUrl,
    sloUrl: config.sloUrl,
    nameIdFormat: config.nameIdFormat || 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
    attributeMapping: config.attributeMapping || OKTA_SAML_ATTRIBUTE_MAPPING,
  });

  const providerConfig: SamlProviderConfig = {
    type: 'saml',
    id: `okta-saml-${config.tenantId}`,
    name: config.name || 'Okta',
    enabled: config.enabled ?? true,
    tenantId: config.tenantId,
    settings,
  };

  return new SamlProvider(providerConfig);
}

/**
 * Build Okta OIDC discovery URL
 */
export function buildOktaDiscoveryUrl(
  domain: string,
  authorizationServerId: string = 'default'
): string {
  return `https://${domain}/oauth2/${authorizationServerId}/.well-known/openid-configuration`;
}

/**
 * Fetch Okta OIDC settings from discovery
 */
export async function fetchOktaOidcSettings(
  domain: string,
  clientSettings: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    postLogoutRedirectUri?: string;
    scopes?: string[];
  },
  authorizationServerId: string = 'default'
): Promise<OidcSettings> {
  const discoveryUrl = buildOktaDiscoveryUrl(domain, authorizationServerId);
  const discoveryService = new OidcDiscoveryService();
  const document = await discoveryService.fetchDiscoveryDocument(discoveryUrl);

  return createOidcSettings({
    ...clientSettings,
    discoveryUrl,
    authorizationEndpoint: document.authorization_endpoint,
    tokenEndpoint: document.token_endpoint,
    userInfoEndpoint: document.userinfo_endpoint,
    jwksUri: document.jwks_uri,
    endSessionEndpoint: document.end_session_endpoint,
    scopes: clientSettings.scopes || ['openid', 'profile', 'email', 'groups'],
    usePkce: document.code_challenge_methods_supported?.includes('S256') ?? true,
    attributeMapping: OKTA_OIDC_ATTRIBUTE_MAPPING,
  });
}
