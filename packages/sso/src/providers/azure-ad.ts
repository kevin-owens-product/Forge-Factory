/**
 * @package @forge/sso
 * @description Azure AD (Entra ID) SSO provider integration
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
 * Azure AD tenant types
 */
export type AzureAdTenantType = 'common' | 'organizations' | 'consumers' | string;

/**
 * Azure AD-specific configuration
 */
export interface AzureAdConfig {
  /**
   * Azure AD Tenant ID or type
   * - 'common': Both work and personal accounts
   * - 'organizations': Work/school accounts only
   * - 'consumers': Personal accounts only
   * - UUID: Specific tenant
   */
  azureTenantId: AzureAdTenantType;

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
}

/**
 * Azure AD OIDC-specific configuration
 */
export interface AzureAdOidcConfig extends AzureAdConfig {
  /**
   * Azure AD application (client) ID
   */
  clientId: string;

  /**
   * Azure AD client secret
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
   * Use v2.0 endpoints (default: true)
   */
  useV2Endpoints?: boolean;
}

/**
 * Azure AD SAML-specific configuration
 */
export interface AzureAdSamlConfig extends AzureAdConfig {
  /**
   * SP Entity ID (Application ID URI in Azure)
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
   * IdP SSO URL from Azure AD
   */
  idpSsoUrl: string;

  /**
   * IdP SLO URL from Azure AD
   */
  idpSloUrl?: string;

  /**
   * IdP certificate from Azure AD
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
 * Default Azure AD OIDC attribute mapping
 */
export const AZURE_AD_OIDC_ATTRIBUTE_MAPPING: OidcAttributeMapping = {
  email: 'email',
  firstName: 'given_name',
  lastName: 'family_name',
  displayName: 'name',
  groups: 'groups',
};

/**
 * Default Azure AD SAML attribute mapping
 */
export const AZURE_AD_SAML_ATTRIBUTE_MAPPING: SamlAttributeMapping = {
  email: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
  firstName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname',
  lastName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname',
  displayName: 'http://schemas.microsoft.com/identity/claims/displayname',
  groups: 'http://schemas.microsoft.com/ws/2008/06/identity/claims/groups',
};

/**
 * Create an Azure AD OIDC provider
 */
export function createAzureAdOidcProvider(config: AzureAdOidcConfig): OidcProvider {
  const useV2 = config.useV2Endpoints ?? true;
  const baseUrl = `https://login.microsoftonline.com/${config.azureTenantId}`;
  const discoveryUrl = useV2
    ? `${baseUrl}/v2.0/.well-known/openid-configuration`
    : `${baseUrl}/.well-known/openid-configuration`;

  // Azure AD v2.0 requires adding resource scopes with full URLs
  const defaultScopes = useV2
    ? ['openid', 'profile', 'email', 'User.Read']
    : ['openid', 'profile', 'email'];

  const settings = createOidcSettings({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    redirectUri: config.redirectUri,
    postLogoutRedirectUri: config.postLogoutRedirectUri,
    discoveryUrl,
    scopes: config.scopes || defaultScopes,
    usePkce: config.usePkce ?? true,
    attributeMapping: config.attributeMapping || AZURE_AD_OIDC_ATTRIBUTE_MAPPING,
  });

  const providerConfig: OidcProviderConfig = {
    type: 'oidc',
    id: `azure-ad-oidc-${config.tenantId}`,
    name: config.name || 'Microsoft',
    enabled: config.enabled ?? true,
    tenantId: config.tenantId,
    settings,
  };

  return new OidcProvider(providerConfig);
}

/**
 * Create an Azure AD SAML provider
 */
export function createAzureAdSamlProvider(config: AzureAdSamlConfig): SamlProvider {
  const settings = createSamlSettings({
    spEntityId: config.spEntityId,
    idpEntityId: `https://sts.windows.net/${config.azureTenantId}/`,
    idpSsoUrl: config.idpSsoUrl,
    idpSloUrl: config.idpSloUrl,
    idpCertificate: config.idpCertificate,
    spPrivateKey: config.spPrivateKey,
    spCertificate: config.spCertificate,
    acsUrl: config.acsUrl,
    sloUrl: config.sloUrl,
    nameIdFormat: config.nameIdFormat || 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
    attributeMapping: config.attributeMapping || AZURE_AD_SAML_ATTRIBUTE_MAPPING,
  });

  const providerConfig: SamlProviderConfig = {
    type: 'saml',
    id: `azure-ad-saml-${config.tenantId}`,
    name: config.name || 'Microsoft',
    enabled: config.enabled ?? true,
    tenantId: config.tenantId,
    settings,
  };

  return new SamlProvider(providerConfig);
}

/**
 * Build Azure AD OIDC discovery URL
 */
export function buildAzureAdDiscoveryUrl(
  azureTenantId: AzureAdTenantType,
  useV2Endpoints: boolean = true
): string {
  const baseUrl = `https://login.microsoftonline.com/${azureTenantId}`;
  return useV2Endpoints
    ? `${baseUrl}/v2.0/.well-known/openid-configuration`
    : `${baseUrl}/.well-known/openid-configuration`;
}

/**
 * Fetch Azure AD OIDC settings from discovery
 */
export async function fetchAzureAdOidcSettings(
  azureTenantId: AzureAdTenantType,
  clientSettings: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    postLogoutRedirectUri?: string;
    scopes?: string[];
  },
  useV2Endpoints: boolean = true
): Promise<OidcSettings> {
  const discoveryUrl = buildAzureAdDiscoveryUrl(azureTenantId, useV2Endpoints);
  const discoveryService = new OidcDiscoveryService();
  const document = await discoveryService.fetchDiscoveryDocument(discoveryUrl);

  const defaultScopes = useV2Endpoints
    ? ['openid', 'profile', 'email', 'User.Read']
    : ['openid', 'profile', 'email'];

  return createOidcSettings({
    ...clientSettings,
    discoveryUrl,
    authorizationEndpoint: document.authorization_endpoint,
    tokenEndpoint: document.token_endpoint,
    userInfoEndpoint: document.userinfo_endpoint,
    jwksUri: document.jwks_uri,
    endSessionEndpoint: document.end_session_endpoint,
    scopes: clientSettings.scopes || defaultScopes,
    usePkce: document.code_challenge_methods_supported?.includes('S256') ?? true,
    attributeMapping: AZURE_AD_OIDC_ATTRIBUTE_MAPPING,
  });
}

/**
 * Build Azure AD SAML metadata URL
 */
export function buildAzureAdSamlMetadataUrl(azureTenantId: string): string {
  return `https://login.microsoftonline.com/${azureTenantId}/federationmetadata/2007-06/federationmetadata.xml`;
}
