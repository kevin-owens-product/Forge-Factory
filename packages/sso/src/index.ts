/**
 * @package @forge/sso
 * @description Single Sign-On (SSO) support for Forge applications
 *
 * This package provides SAML 2.0 and OIDC/OAuth 2.0 integration with support for:
 * - SAML 2.0 Service Provider implementation
 * - OIDC/OAuth 2.0 Relying Party implementation
 * - Identity provider discovery (SAML metadata, OIDC well-known)
 * - Assertion/token validation and parsing
 * - User provisioning hooks (JIT provisioning)
 * - Attribute mapping for user profiles
 * - Session binding to SSO sessions
 * - Single logout (SLO) support
 * - Pre-built integrations (Okta, Azure AD, Google Workspace)
 * - Multi-tenant support
 */

// Types
export * from './sso.types';

// Main service
export {
  SsoService,
  createSsoService,
  createSsoConfig,
  SsoEventHandlers,
  SsoAuthSuccessEvent,
  SsoAuthFailureEvent,
  SsoLogoutEvent,
  SsoSessionStore,
  InMemorySsoSessionStore,
} from './sso.service';

// SAML exports
export {
  SamlParser,
  SamlResponse,
  getSamlParser,
  resetSamlParser,
} from './saml/saml.parser';

export {
  SamlMetadataHandler,
  getSamlMetadataHandler,
  resetSamlMetadataHandler,
} from './saml/saml.metadata';

export {
  SamlProvider,
  createSamlProvider,
  createSamlSettings,
} from './saml/saml.provider';

// OIDC exports
export {
  OidcDiscoveryService,
  getOidcDiscoveryService,
  resetOidcDiscoveryService,
} from './oidc/oidc.discovery';

export {
  OidcTokenService,
  TokenValidationResult,
  getOidcTokenService,
  resetOidcTokenService,
} from './oidc/oidc.tokens';

export {
  OidcProvider,
  createOidcProvider,
  createOidcSettings,
} from './oidc/oidc.provider';

// Pre-built provider integrations
export {
  // Okta
  OktaConfig,
  OktaOidcConfig,
  OktaSamlConfig,
  OKTA_OIDC_ATTRIBUTE_MAPPING,
  OKTA_SAML_ATTRIBUTE_MAPPING,
  createOktaOidcProvider,
  createOktaSamlProvider,
  buildOktaDiscoveryUrl,
  fetchOktaOidcSettings,
} from './providers/okta';

export {
  // Azure AD
  AzureAdTenantType,
  AzureAdConfig,
  AzureAdOidcConfig,
  AzureAdSamlConfig,
  AZURE_AD_OIDC_ATTRIBUTE_MAPPING,
  AZURE_AD_SAML_ATTRIBUTE_MAPPING,
  createAzureAdOidcProvider,
  createAzureAdSamlProvider,
  buildAzureAdDiscoveryUrl,
  fetchAzureAdOidcSettings,
  buildAzureAdSamlMetadataUrl,
} from './providers/azure-ad';

export {
  // Google
  GoogleConfig,
  GoogleOidcConfig,
  GoogleSamlConfig,
  GOOGLE_OIDC_DISCOVERY_URL,
  GOOGLE_OIDC_ATTRIBUTE_MAPPING,
  GOOGLE_SAML_ATTRIBUTE_MAPPING,
  createGoogleOidcProvider,
  createGoogleSamlProvider,
  fetchGoogleOidcSettings,
  validateGoogleDomain,
} from './providers/google-workspace';
