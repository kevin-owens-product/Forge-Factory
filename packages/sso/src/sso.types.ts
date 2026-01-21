/**
 * @package @forge/sso
 * @description TypeScript interfaces for SSO (SAML/OIDC)
 */

import { UserIdentity } from '@forge/auth';

// ============================================================================
// Base SSO Types
// ============================================================================

/**
 * SSO provider type
 */
export type SsoProviderType = 'saml' | 'oidc';

/**
 * SSO configuration
 */
export interface SsoConfig {
  /** List of configured providers */
  providers: SsoProviderConfig[];
  /** Session duration in milliseconds */
  sessionDurationMs?: number;
  /** Enable audit logging */
  enableAuditLog?: boolean;
}

/**
 * SSO session configuration
 */
export interface SsoSessionConfig {
  /** Session duration in seconds */
  durationSeconds: number;
  /** Bind to SSO session (logout when SSO session ends) */
  bindToSsoSession: boolean;
  /** Session cookie name */
  cookieName: string;
}

// ============================================================================
// SSO Provider Types
// ============================================================================

/**
 * Base SSO provider configuration
 */
export interface SsoProviderConfig {
  /** Provider type */
  type: SsoProviderType;
  /** Unique provider ID */
  id: string;
  /** Display name */
  name: string;
  /** Whether provider is enabled */
  enabled: boolean;
  /** Tenant ID this provider belongs to */
  tenantId: string;
  /** Provider-specific settings */
  settings: SamlSettings | OidcSettings;
}

/**
 * SSO authentication request
 */
export interface SsoAuthRequest {
  /** Return URL (relay state) */
  returnUrl: string;
  /** Relay state (additional state to return) */
  relayState?: string;
  /** Force re-authentication */
  forceAuthn?: boolean;
  /** Requested authentication context */
  authnContext?: string;
  /** Login hint (pre-fill email) */
  loginHint?: string;
}

/**
 * SSO authentication response
 */
export interface SsoAuthResponse {
  /** Whether authentication was successful */
  success: boolean;
  /** User identity (if successful) */
  user?: UserIdentity;
  /** Relay state (return URL) */
  relayState?: string;
  /** SSO session ID (from IdP) */
  ssoSessionId?: string;
  /** SSO session expiry */
  ssoSessionExpiry?: string;
  /** Access token (OIDC) */
  accessToken?: string;
  /** Refresh token (OIDC) */
  refreshToken?: string;
  /** Token expiry in seconds (OIDC) */
  expiresIn?: number;
  /** Error message */
  error?: string;
  /** Error code */
  errorCode?: string;
  /** Raw assertion/token data (for debugging) */
  rawData?: unknown;
}

/**
 * SSO logout request
 */
export interface SsoLogoutRequest {
  /** User ID to logout */
  userId: string;
  /** Return URL after logout */
  returnUrl: string;
  /** SSO session ID */
  ssoSessionId?: string;
  /** Relay state (return URL after logout) */
  relayState?: string;
  /** ID token (for OIDC logout) */
  idToken?: string;
}

/**
 * SSO logout response
 */
export interface SsoLogoutResponse {
  /** Whether logout was successful */
  success: boolean;
  /** Logout URL to redirect user (for IdP-initiated logout) */
  logoutUrl?: string;
  /** Relay state */
  relayState?: string;
  /** Error message */
  error?: string;
}

// ============================================================================
// SAML Types
// ============================================================================

/**
 * SAML provider configuration
 */
export interface SamlProviderConfig extends Omit<SsoProviderConfig, 'settings'> {
  type: 'saml';
  settings: SamlSettings;
}

/**
 * SAML settings
 */
export interface SamlSettings {
  /** Service Provider Entity ID */
  spEntityId: string;
  /** Identity Provider Entity ID */
  idpEntityId: string;
  /** IdP SSO URL */
  idpSsoUrl: string;
  /** IdP SLO URL (optional) */
  idpSloUrl?: string;
  /** IdP Certificate (PEM format) */
  idpCertificate: string;
  /** SP Private Key (PEM format, for signing) */
  spPrivateKey?: string;
  /** SP Certificate (PEM format, for signing) */
  spCertificate?: string;
  /** Assertion Consumer Service URL */
  acsUrl: string;
  /** Single Logout Service URL */
  sloUrl?: string;
  /** Name ID format */
  nameIdFormat?: SamlNameIdFormat | string;
  /** Attribute mapping */
  attributeMapping?: SamlAttributeMapping;
  /** Sign authentication requests */
  signRequests?: boolean;
  /** Require signed assertions */
  requireSignedAssertions?: boolean;
  /** Require encrypted assertions */
  requireEncryptedAssertions?: boolean;
  /** Allowed clock skew in seconds */
  clockSkewSeconds?: number;
  /** Requested authentication context */
  authnContext?: SamlAuthnContext | string;
}

/**
 * SAML Name ID formats
 */
export type SamlNameIdFormat =
  | 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress'
  | 'urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified'
  | 'urn:oasis:names:tc:SAML:2.0:nameid-format:persistent'
  | 'urn:oasis:names:tc:SAML:2.0:nameid-format:transient';

/**
 * SAML authentication contexts
 */
export type SamlAuthnContext =
  | 'urn:oasis:names:tc:SAML:2.0:ac:classes:Password'
  | 'urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport'
  | 'urn:oasis:names:tc:SAML:2.0:ac:classes:X509'
  | 'urn:oasis:names:tc:SAML:2.0:ac:classes:Kerberos';

/**
 * SAML attribute mapping
 */
export interface SamlAttributeMapping {
  /** Attribute for user ID */
  userId?: string;
  /** Attribute for email */
  email: string;
  /** Attribute for first name */
  firstName?: string;
  /** Attribute for last name */
  lastName?: string;
  /** Attribute for display name */
  displayName?: string;
  /** Attribute for groups/roles */
  groups?: string;
  /** Custom attribute mappings */
  custom?: Record<string, string>;
}

/**
 * Default SAML attribute mapping
 */
export const DEFAULT_SAML_ATTRIBUTE_MAPPING: SamlAttributeMapping = {
  email: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
  firstName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname',
  lastName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname',
  displayName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name',
  groups: 'http://schemas.microsoft.com/ws/2008/06/identity/claims/groups',
};

/**
 * SAML assertion
 */
export interface SamlAssertion {
  /** Assertion ID */
  id?: string;
  /** Issuer (IdP Entity ID) */
  issuer: string;
  /** Issue instant */
  issueInstant?: Date;
  /** Subject */
  subject: SamlSubject;
  /** Conditions */
  conditions?: SamlConditions;
  /** Authentication statement */
  authnStatement?: SamlAuthnStatement;
  /** Attributes */
  attributes: Record<string, string | string[]>;
  /** Raw XML */
  rawXml?: string;
}

/**
 * SAML subject
 */
export interface SamlSubject {
  /** Name ID */
  nameId: string;
  /** Name ID format */
  nameIdFormat: string;
  /** Subject confirmation method */
  confirmationMethod?: string;
  /** Not on or after (for SubjectConfirmationData) */
  notOnOrAfter?: Date;
  /** Recipient */
  recipient?: string;
  /** In response to */
  inResponseTo?: string;
}

/**
 * SAML conditions
 */
export interface SamlConditions {
  /** Not before */
  notBefore?: string;
  /** Not on or after */
  notOnOrAfter?: string;
  /** Audience restrictions */
  audienceRestriction?: string[];
}

/**
 * SAML authentication statement
 */
export interface SamlAuthnStatement {
  /** Authentication instant */
  authnInstant?: Date;
  /** Session index */
  sessionIndex?: string;
  /** Session not on or after */
  sessionNotOnOrAfter?: string;
  /** Authentication context class */
  authnContextClass?: string;
}

/**
 * SAML metadata
 */
export interface SamlMetadata {
  /** Entity ID */
  entityId: string;
  /** SSO services */
  ssoServices: SamlSsoService[];
  /** SLO services */
  sloServices?: SamlSloService[];
  /** Signing certificates */
  signingCertificates: string[];
  /** Encryption certificates */
  encryptionCertificates?: string[];
  /** Name ID formats */
  nameIdFormats: string[];
  /** Organization info */
  organization?: SamlOrganization;
  /** Contact persons */
  contacts?: SamlContact[];
}

/**
 * SAML SSO service
 */
export interface SamlSsoService {
  /** Binding type */
  binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST' | 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect';
  /** Location URL */
  location: string;
}

/**
 * SAML SLO service
 */
export interface SamlSloService {
  /** Binding type */
  binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST' | 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect';
  /** Location URL */
  location: string;
}

/**
 * SAML organization
 */
export interface SamlOrganization {
  /** Name */
  name: string;
  /** Display name */
  displayName: string;
  /** URL */
  url: string;
}

/**
 * SAML contact
 */
export interface SamlContact {
  /** Contact type */
  type: 'technical' | 'support' | 'administrative';
  /** Company */
  company?: string;
  /** Given name */
  givenName?: string;
  /** Surname */
  surName?: string;
  /** Email */
  email?: string;
}

// ============================================================================
// OIDC Types
// ============================================================================

/**
 * OIDC provider configuration
 */
export interface OidcProviderConfig extends Omit<SsoProviderConfig, 'settings'> {
  type: 'oidc';
  settings: OidcSettings;
}

/**
 * OIDC settings
 */
export interface OidcSettings {
  /** Client ID */
  clientId: string;
  /** Client secret */
  clientSecret: string;
  /** Discovery URL (well-known endpoint) */
  discoveryUrl?: string;
  /** Authorization endpoint (if not using discovery) */
  authorizationEndpoint?: string;
  /** Token endpoint (if not using discovery) */
  tokenEndpoint?: string;
  /** UserInfo endpoint (if not using discovery) */
  userInfoEndpoint?: string;
  /** JWKS URI (if not using discovery) */
  jwksUri?: string;
  /** End session endpoint (if not using discovery) */
  endSessionEndpoint?: string;
  /** Redirect URI */
  redirectUri: string;
  /** Post logout redirect URI */
  postLogoutRedirectUri?: string;
  /** Scopes to request */
  scopes?: string[];
  /** Use PKCE */
  usePkce?: boolean;
  /** Attribute/claim mapping */
  attributeMapping?: OidcAttributeMapping;
  /** ACR values */
  acrValues?: string[];
  /** Additional authorization parameters */
  additionalParams?: Record<string, string>;
}

/**
 * OIDC attribute mapping (alias for claim mapping)
 */
export interface OidcAttributeMapping {
  /** Attribute for email */
  email?: string;
  /** Attribute for first name */
  firstName?: string;
  /** Attribute for last name */
  lastName?: string;
  /** Attribute for display name */
  displayName?: string;
  /** Attribute for groups/roles */
  groups?: string;
}

/**
 * Default OIDC attribute mapping
 */
export const DEFAULT_OIDC_ATTRIBUTE_MAPPING: OidcAttributeMapping = {
  email: 'email',
  firstName: 'given_name',
  lastName: 'family_name',
  displayName: 'name',
  groups: 'groups',
};

/**
 * OIDC discovery document
 */
export interface OidcDiscoveryDocument {
  /** Issuer */
  issuer: string;
  /** Authorization endpoint */
  authorization_endpoint: string;
  /** Token endpoint */
  token_endpoint: string;
  /** UserInfo endpoint */
  userinfo_endpoint?: string;
  /** JWKS URI */
  jwks_uri: string;
  /** End session endpoint */
  end_session_endpoint?: string;
  /** Registration endpoint */
  registration_endpoint?: string;
  /** Revocation endpoint */
  revocation_endpoint?: string;
  /** Introspection endpoint */
  introspection_endpoint?: string;
  /** Scopes supported */
  scopes_supported?: string[];
  /** Response types supported */
  response_types_supported: string[];
  /** Response modes supported */
  response_modes_supported?: string[];
  /** Grant types supported */
  grant_types_supported?: string[];
  /** Subject types supported */
  subject_types_supported: string[];
  /** ID token signing alg values supported */
  id_token_signing_alg_values_supported: string[];
  /** Token endpoint auth methods supported */
  token_endpoint_auth_methods_supported?: string[];
  /** Claims supported */
  claims_supported?: string[];
  /** Code challenge methods supported (for PKCE) */
  code_challenge_methods_supported?: string[];
}

/**
 * OIDC token response
 */
export interface OidcTokenResponse {
  /** Access token */
  access_token: string;
  /** Token type */
  token_type: string;
  /** Expires in (seconds) */
  expires_in?: number;
  /** Refresh token */
  refresh_token?: string;
  /** ID token */
  id_token?: string;
  /** Scope */
  scope?: string;
}

/**
 * OIDC ID token claims
 */
export interface OidcIdTokenClaims {
  /** Issuer */
  iss: string;
  /** Subject (user ID) */
  sub: string;
  /** Audience */
  aud: string | string[];
  /** Expiration time */
  exp: number;
  /** Issued at */
  iat: number;
  /** Authentication time */
  auth_time?: number;
  /** Nonce */
  nonce?: string;
  /** Authentication context class reference */
  acr?: string;
  /** Authentication methods references */
  amr?: string[];
  /** Authorized party */
  azp?: string;
  /** Session ID */
  sid?: string;
  /** Email */
  email?: string;
  /** Name */
  name?: string;
  /** Additional claims */
  [key: string]: unknown;
}

/**
 * OIDC UserInfo response
 */
export interface OidcUserInfo {
  /** Subject */
  sub: string;
  /** Name */
  name?: string;
  /** Given name */
  given_name?: string;
  /** Family name */
  family_name?: string;
  /** Middle name */
  middle_name?: string;
  /** Nickname */
  nickname?: string;
  /** Preferred username */
  preferred_username?: string;
  /** Profile URL */
  profile?: string;
  /** Picture URL */
  picture?: string;
  /** Website */
  website?: string;
  /** Email */
  email?: string;
  /** Email verified */
  email_verified?: boolean;
  /** Gender */
  gender?: string;
  /** Birthdate */
  birthdate?: string;
  /** Timezone */
  zoneinfo?: string;
  /** Locale */
  locale?: string;
  /** Phone number */
  phone_number?: string;
  /** Phone number verified */
  phone_number_verified?: boolean;
  /** Address */
  address?: OidcAddress;
  /** Updated at */
  updated_at?: number;
  /** Additional claims */
  [key: string]: unknown;
}

/**
 * OIDC address claim
 */
export interface OidcAddress {
  /** Formatted address */
  formatted?: string;
  /** Street address */
  street_address?: string;
  /** Locality (city) */
  locality?: string;
  /** Region (state/province) */
  region?: string;
  /** Postal code */
  postal_code?: string;
  /** Country */
  country?: string;
}

/**
 * OIDC JWKS
 */
export interface OidcJwks {
  /** Keys */
  keys: OidcJwk[];
}

/**
 * OIDC JWK (JSON Web Key)
 */
export interface OidcJwk {
  /** Key type */
  kty: 'RSA' | 'EC' | 'oct';
  /** Key use */
  use?: 'sig' | 'enc';
  /** Key operations */
  key_ops?: string[];
  /** Algorithm */
  alg?: string;
  /** Key ID */
  kid?: string;
  /** X.509 URL */
  x5u?: string;
  /** X.509 certificate chain */
  x5c?: string[];
  /** X.509 certificate SHA-1 thumbprint */
  x5t?: string;
  /** X.509 certificate SHA-256 thumbprint */
  'x5t#S256'?: string;
  /** RSA modulus (for RSA keys) */
  n?: string;
  /** RSA exponent (for RSA keys) */
  e?: string;
  /** EC curve (for EC keys) */
  crv?: string;
  /** EC x coordinate (for EC keys) */
  x?: string;
  /** EC y coordinate (for EC keys) */
  y?: string;
}

// ============================================================================
// User Provisioning Types
// ============================================================================

/**
 * User provisioning result
 */
export interface UserProvisioningResult {
  /** Whether provisioning was successful */
  success: boolean;
  /** User identity */
  user?: UserIdentity;
  /** Whether user was created (vs updated) */
  created?: boolean;
  /** Error message */
  error?: string;
}

/**
 * User provisioning callback
 */
export type UserProvisioningCallback = (
  profile: SsoUserProfile,
  tenantId: string,
  providerId: string
) => Promise<UserProvisioningResult>;

/**
 * SSO user profile (normalized from SAML/OIDC)
 */
export interface SsoUserProfile {
  /** External user ID (from IdP) */
  externalId: string;
  /** Email address */
  email: string;
  /** Whether email is verified */
  emailVerified?: boolean;
  /** First name */
  firstName?: string;
  /** Last name */
  lastName?: string;
  /** Display name */
  displayName?: string;
  /** Profile picture URL */
  pictureUrl?: string;
  /** Groups/roles from IdP */
  groups?: string[];
  /** Raw attributes/claims */
  rawAttributes: Record<string, unknown>;
  /** Provider ID */
  providerId: string;
  /** Provider type */
  providerType: SsoProviderType;
}

/**
 * Role mapping configuration
 */
export interface RoleMappingConfig {
  /** Map IdP groups to application roles */
  groupToRole: Record<string, string[]>;
  /** Default roles for all SSO users */
  defaultRoles: string[];
  /** Sync roles on every login (vs only on first login) */
  syncOnLogin: boolean;
}

// ============================================================================
// SSO Session Types
// ============================================================================

/**
 * SSO session
 */
export interface SsoSession {
  /** Session ID */
  id: string;
  /** User ID */
  userId: string;
  /** Tenant ID */
  tenantId: string;
  /** Provider ID */
  providerId: string;
  /** Provider type */
  providerType: SsoProviderType;
  /** SSO session ID (from IdP) */
  ssoSessionId?: string;
  /** Created at */
  createdAt: Date;
  /** Expires at */
  expiresAt?: Date;
  /** Access token (OIDC) */
  accessToken?: string;
  /** Refresh token (OIDC) */
  refreshToken?: string;
}

// ============================================================================
// Audit Types
// ============================================================================

/**
 * SSO audit event types
 */
export type SsoAuditEventType =
  | 'sso_login_initiated'
  | 'sso_login_success'
  | 'sso_login_failure'
  | 'sso_logout_initiated'
  | 'sso_logout_success'
  | 'sso_logout_failure'
  | 'sso_user_provisioned'
  | 'sso_user_updated'
  | 'sso_assertion_invalid'
  | 'sso_signature_invalid'
  | 'sso_session_expired'
  | 'sso_provider_configured';

/**
 * SSO audit event
 */
export interface SsoAuditEvent {
  /** Event type */
  type: SsoAuditEventType;
  /** User ID */
  userId?: string;
  /** Tenant ID */
  tenantId: string;
  /** Provider ID */
  providerId?: string;
  /** Timestamp */
  timestamp: Date;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Audit log callback
 */
export type SsoAuditLogCallback = (event: SsoAuditEvent) => void | Promise<void>;
