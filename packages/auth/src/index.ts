/**
 * @package @forge/auth
 * @description Authentication library for Forge applications
 *
 * Features:
 * - JWT token generation and validation
 * - Password hashing and validation
 * - Session management
 * - Multi-factor authentication (TOTP)
 * - Multiple auth providers (local, OAuth)
 * - Multi-tenant support
 */

// Main service
export { AuthService, AuthServiceOptions, getAuthService, resetAuthService } from './auth.service';

// Types
export {
  // Configuration types
  AuthConfig,
  JwtConfig,
  SessionConfig,
  PasswordConfig,
  MfaConfig,
  RateLimitConfig,
  DEFAULT_AUTH_CONFIG,

  // Identity types
  UserIdentity,
  Credentials,
  StoredUser,

  // Result types
  AuthResult,
  TokenPair,
  TokenPayload,
  PasswordValidationResult,
  PasswordHashResult,
  MfaSetupResult,
  MfaVerificationResult,
  TokenRefreshResult,

  // Session types
  Session,
  DeviceInfo,

  // OAuth types
  OAuthProviderConfig,
  OAuthAuthorizationResult,
  OAuthCallbackResult,
  AuthProviderConfig,
  AuthProviderType,

  // Audit types
  AuthAuditEvent,
  AuthAuditEventType,
  LoginAttempt,
  LockoutStatus,

  // Request types
  PasswordResetRequest,
  EmailVerificationRequest,

  // Callback types
  AuditLogCallback,
  UserLookupCallback,
  UserUpdateCallback,
  RateLimitCallback,
  AuthEventListener,
  AuthEvent,

  // Context types
  TenantContext,
} from './auth.types';

// Token service
export {
  TokenService,
  TokenVerificationResult,
  JwtInterface,
  JwtSignOptions,
  JwtVerifyOptions,
  JwtPayload,
  JwtDecoded,
  getTokenService,
  resetTokenService,
} from './token';

// Password service
export {
  PasswordService,
  BcryptInterface,
  getPasswordService,
  resetPasswordService,
} from './password';

// Session service
export {
  SessionService,
  SessionStorage,
  InMemorySessionStorage,
  SessionCookieOptions,
  getSessionCookieOptions,
  getClearSessionCookieOptions,
  getSessionService,
  resetSessionService,
} from './session';

// MFA service
export {
  MfaService,
  MfaChallengeManager,
  MfaChallenge,
  OtpAuthenticator,
  QrCodeGenerator,
  getMfaService,
  resetMfaService,
} from './mfa';

// Providers
export {
  // Base provider
  AuthProvider,
  BaseAuthProvider,
  AuthProviderRegistry,
  getProviderRegistry,
  resetProviderRegistry,

  // Local provider
  LocalAuthProvider,
  LocalProviderConfig,
  createLocalProvider,

  // OAuth provider
  OAuthProvider,
  OAuthProviderOptions,
  OAuthStateData,
  OAuthTokenResponse,
  OAuthUserInfo,
  OAuthUserProvisionCallback,
  createGoogleProvider,
  createGitHubProvider,
  createMicrosoftProvider,
} from './providers';
