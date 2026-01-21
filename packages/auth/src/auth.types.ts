/**
 * @package @forge/auth
 * @description TypeScript interfaces for authentication
 */

/**
 * Authentication configuration
 */
export interface AuthConfig {
  /** JWT configuration */
  jwt: JwtConfig;
  /** Session configuration */
  session: SessionConfig;
  /** Password configuration */
  password: PasswordConfig;
  /** MFA configuration */
  mfa: MfaConfig;
  /** Rate limiting configuration */
  rateLimit: RateLimitConfig;
  /** Enable logging */
  enableLogging: boolean;
  /** Environment */
  environment: 'development' | 'production' | 'test';
}

/**
 * JWT configuration
 */
export interface JwtConfig {
  /** Secret key for signing tokens */
  secret: string;
  /** Access token expiry (e.g., '15m', '1h') */
  accessTokenExpiry: string;
  /** Refresh token expiry (e.g., '7d', '30d') */
  refreshTokenExpiry: string;
  /** Token issuer */
  issuer: string;
  /** Token audience */
  audience: string;
  /** Signing algorithm */
  algorithm: 'HS256' | 'HS384' | 'HS512' | 'RS256' | 'RS384' | 'RS512';
}

/**
 * Session configuration
 */
export interface SessionConfig {
  /** Session duration in seconds */
  durationSeconds: number;
  /** Enable sliding sessions (extend on activity) */
  slidingSession: boolean;
  /** Maximum concurrent sessions per user (0 = unlimited) */
  maxConcurrentSessions: number;
  /** Session cookie name */
  cookieName: string;
  /** Secure cookie (HTTPS only) */
  secureCookie: boolean;
  /** HTTP only cookie */
  httpOnlyCookie: boolean;
  /** Cookie same site policy */
  sameSite: 'strict' | 'lax' | 'none';
}

/**
 * Password configuration
 */
export interface PasswordConfig {
  /** Minimum password length */
  minLength: number;
  /** Maximum password length */
  maxLength: number;
  /** Require uppercase letter */
  requireUppercase: boolean;
  /** Require lowercase letter */
  requireLowercase: boolean;
  /** Require number */
  requireNumber: boolean;
  /** Require special character */
  requireSpecialChar: boolean;
  /** Bcrypt rounds for hashing */
  hashRounds: number;
  /** Password history to prevent reuse (0 = disabled) */
  historyCount: number;
}

/**
 * MFA configuration
 */
export interface MfaConfig {
  /** Enable MFA */
  enabled: boolean;
  /** TOTP issuer name (shown in authenticator app) */
  issuer: string;
  /** TOTP token digits */
  digits: number;
  /** TOTP step in seconds */
  stepSeconds: number;
  /** Window for token verification (steps) */
  window: number;
  /** Backup codes count */
  backupCodesCount: number;
}

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /** Max login attempts before lockout */
  maxLoginAttempts: number;
  /** Lockout duration in seconds */
  lockoutDurationSeconds: number;
  /** Window for counting attempts in seconds */
  windowSeconds: number;
}

/**
 * Default authentication configuration
 */
export const DEFAULT_AUTH_CONFIG: AuthConfig = {
  jwt: {
    secret: '',
    accessTokenExpiry: '15m',
    refreshTokenExpiry: '7d',
    issuer: 'forge',
    audience: 'forge-app',
    algorithm: 'HS256',
  },
  session: {
    durationSeconds: 86400, // 24 hours
    slidingSession: true,
    maxConcurrentSessions: 5,
    cookieName: 'forge_session',
    secureCookie: true,
    httpOnlyCookie: true,
    sameSite: 'lax',
  },
  password: {
    minLength: 8,
    maxLength: 128,
    requireUppercase: true,
    requireLowercase: true,
    requireNumber: true,
    requireSpecialChar: true,
    hashRounds: 12,
    historyCount: 5,
  },
  mfa: {
    enabled: false,
    issuer: 'Forge',
    digits: 6,
    stepSeconds: 30,
    window: 1,
    backupCodesCount: 10,
  },
  rateLimit: {
    maxLoginAttempts: 5,
    lockoutDurationSeconds: 900, // 15 minutes
    windowSeconds: 900,
  },
  enableLogging: false,
  environment: 'production',
};

/**
 * User identity
 */
export interface UserIdentity {
  /** User ID */
  id: string;
  /** Email address */
  email: string;
  /** Username (optional) */
  username?: string;
  /** Tenant ID for multi-tenancy */
  tenantId: string;
  /** User roles */
  roles: string[];
  /** User permissions */
  permissions: string[];
  /** Whether email is verified */
  emailVerified: boolean;
  /** Whether MFA is enabled */
  mfaEnabled: boolean;
  /** User metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Authentication credentials
 */
export interface Credentials {
  /** Email or username */
  identifier: string;
  /** Password */
  password: string;
  /** MFA token (if MFA enabled) */
  mfaToken?: string;
  /** Remember me (extended session) */
  rememberMe?: boolean;
}

/**
 * Authentication result
 */
export interface AuthResult {
  /** Whether authentication was successful */
  success: boolean;
  /** User identity (if successful) */
  user?: UserIdentity;
  /** Access token */
  accessToken?: string;
  /** Refresh token */
  refreshToken?: string;
  /** Session ID */
  sessionId?: string;
  /** Token expiry timestamp */
  expiresAt?: Date;
  /** Whether MFA is required */
  mfaRequired?: boolean;
  /** MFA challenge ID (for MFA flow) */
  mfaChallengeId?: string;
  /** Error message (if failed) */
  error?: string;
  /** Error code */
  errorCode?: string;
}

/**
 * Token payload
 */
export interface TokenPayload {
  /** Subject (user ID) */
  sub: string;
  /** Email */
  email: string;
  /** Tenant ID */
  tenantId: string;
  /** Roles */
  roles: string[];
  /** Permissions */
  permissions: string[];
  /** Session ID */
  sessionId?: string;
  /** Token type */
  type: 'access' | 'refresh';
  /** Issued at timestamp */
  iat?: number;
  /** Expiry timestamp */
  exp?: number;
  /** Issuer */
  iss?: string;
  /** Audience */
  aud?: string;
  /** JWT ID */
  jti?: string;
}

/**
 * Token pair
 */
export interface TokenPair {
  /** Access token */
  accessToken: string;
  /** Refresh token */
  refreshToken: string;
  /** Access token expiry */
  accessTokenExpiresAt: Date;
  /** Refresh token expiry */
  refreshTokenExpiresAt: Date;
}

/**
 * Session data
 */
export interface Session {
  /** Session ID */
  id: string;
  /** User ID */
  userId: string;
  /** Tenant ID */
  tenantId: string;
  /** Session creation time */
  createdAt: Date;
  /** Last activity time */
  lastActivityAt: Date;
  /** Session expiry time */
  expiresAt: Date;
  /** IP address */
  ipAddress?: string;
  /** User agent */
  userAgent?: string;
  /** Device info */
  deviceInfo?: DeviceInfo;
  /** Whether session is active */
  isActive: boolean;
  /** Session metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Device information
 */
export interface DeviceInfo {
  /** Device type */
  type: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  /** Operating system */
  os?: string;
  /** Browser */
  browser?: string;
  /** Device name/model */
  name?: string;
}

/**
 * Password validation result
 */
export interface PasswordValidationResult {
  /** Whether password is valid */
  valid: boolean;
  /** Validation errors */
  errors: string[];
  /** Password strength score (0-100) */
  strength: number;
  /** Strength label */
  strengthLabel: 'weak' | 'fair' | 'good' | 'strong' | 'very-strong';
}

/**
 * Password hash result
 */
export interface PasswordHashResult {
  /** Hashed password */
  hash: string;
  /** Salt used (if applicable) */
  salt?: string;
}

/**
 * MFA setup result
 */
export interface MfaSetupResult {
  /** Secret key */
  secret: string;
  /** QR code data URL */
  qrCodeDataUrl: string;
  /** Manual entry key (formatted) */
  manualEntryKey: string;
  /** Backup codes */
  backupCodes: string[];
  /** URI for authenticator apps */
  otpauthUri: string;
}

/**
 * MFA verification result
 */
export interface MfaVerificationResult {
  /** Whether verification was successful */
  valid: boolean;
  /** Whether a backup code was used */
  usedBackupCode?: boolean;
  /** Error message */
  error?: string;
}

/**
 * Login attempt record
 */
export interface LoginAttempt {
  /** Attempt ID */
  id: string;
  /** Identifier used (email/username) */
  identifier: string;
  /** IP address */
  ipAddress: string;
  /** Whether attempt was successful */
  successful: boolean;
  /** Failure reason (if failed) */
  failureReason?: string;
  /** Timestamp */
  timestamp: Date;
  /** User agent */
  userAgent?: string;
}

/**
 * Account lockout status
 */
export interface LockoutStatus {
  /** Whether account is locked */
  isLocked: boolean;
  /** Number of failed attempts */
  failedAttempts: number;
  /** Lockout end time (if locked) */
  lockoutEndsAt?: Date;
  /** Remaining lockout seconds */
  remainingSeconds?: number;
}

/**
 * Authentication provider type
 */
export type AuthProviderType = 'local' | 'oauth' | 'saml' | 'oidc' | 'ldap';

/**
 * Authentication provider configuration
 */
export interface AuthProviderConfig {
  /** Provider type */
  type: AuthProviderType;
  /** Provider ID */
  id: string;
  /** Provider display name */
  name: string;
  /** Whether provider is enabled */
  enabled: boolean;
  /** Provider-specific settings */
  settings: Record<string, unknown>;
}

/**
 * OAuth provider configuration
 */
export interface OAuthProviderConfig extends AuthProviderConfig {
  type: 'oauth';
  settings: {
    /** Client ID */
    clientId: string;
    /** Client secret */
    clientSecret: string;
    /** Authorization URL */
    authorizationUrl: string;
    /** Token URL */
    tokenUrl: string;
    /** User info URL */
    userInfoUrl: string;
    /** Scopes to request */
    scopes: string[];
    /** Redirect URI */
    redirectUri: string;
  };
}

/**
 * OAuth authorization result
 */
export interface OAuthAuthorizationResult {
  /** Authorization URL to redirect to */
  authorizationUrl: string;
  /** State parameter for CSRF protection */
  state: string;
  /** Code verifier for PKCE */
  codeVerifier?: string;
}

/**
 * OAuth callback result
 */
export interface OAuthCallbackResult {
  /** Whether callback was successful */
  success: boolean;
  /** User identity (if successful) */
  user?: UserIdentity;
  /** Access token from OAuth provider */
  providerAccessToken?: string;
  /** Refresh token from OAuth provider */
  providerRefreshToken?: string;
  /** Error message */
  error?: string;
}

/**
 * Token refresh result
 */
export interface TokenRefreshResult {
  /** Whether refresh was successful */
  success: boolean;
  /** New token pair */
  tokens?: TokenPair;
  /** Error message */
  error?: string;
}

/**
 * Password reset request
 */
export interface PasswordResetRequest {
  /** Request ID */
  id: string;
  /** User ID */
  userId: string;
  /** Reset token (hashed) */
  tokenHash: string;
  /** Request creation time */
  createdAt: Date;
  /** Request expiry time */
  expiresAt: Date;
  /** Whether request has been used */
  used: boolean;
  /** IP address of requester */
  ipAddress?: string;
}

/**
 * Email verification request
 */
export interface EmailVerificationRequest {
  /** Request ID */
  id: string;
  /** User ID */
  userId: string;
  /** Email to verify */
  email: string;
  /** Verification token (hashed) */
  tokenHash: string;
  /** Request creation time */
  createdAt: Date;
  /** Request expiry time */
  expiresAt: Date;
  /** Whether request has been used */
  used: boolean;
}

/**
 * Audit event types
 */
export type AuthAuditEventType =
  | 'login_success'
  | 'login_failure'
  | 'logout'
  | 'token_refresh'
  | 'password_change'
  | 'password_reset_request'
  | 'password_reset_complete'
  | 'mfa_enabled'
  | 'mfa_disabled'
  | 'mfa_verified'
  | 'mfa_failed'
  | 'session_created'
  | 'session_invalidated'
  | 'account_locked'
  | 'account_unlocked'
  | 'email_verification_sent'
  | 'email_verified';

/**
 * Audit event
 */
export interface AuthAuditEvent {
  /** Event ID */
  id: string;
  /** Event type */
  type: AuthAuditEventType;
  /** User ID (if applicable) */
  userId?: string;
  /** Tenant ID */
  tenantId?: string;
  /** Session ID */
  sessionId?: string;
  /** IP address */
  ipAddress?: string;
  /** User agent */
  userAgent?: string;
  /** Event timestamp */
  timestamp: Date;
  /** Event details */
  details?: Record<string, unknown>;
  /** Whether event indicates a security concern */
  securityConcern?: boolean;
}

/**
 * Audit log callback
 */
export type AuditLogCallback = (event: AuthAuditEvent) => void | Promise<void>;

/**
 * Rate limit callback (for external rate limiting)
 */
export type RateLimitCallback = (
  identifier: string,
  ipAddress: string
) => Promise<LockoutStatus>;

/**
 * User lookup callback
 */
export type UserLookupCallback = (identifier: string, tenantId?: string) => Promise<StoredUser | null>;

/**
 * User update callback
 */
export type UserUpdateCallback = (userId: string, updates: Partial<StoredUser>) => Promise<void>;

/**
 * Stored user (for persistence layer)
 */
export interface StoredUser {
  /** User ID */
  id: string;
  /** Email address */
  email: string;
  /** Username */
  username?: string;
  /** Password hash */
  passwordHash: string;
  /** Tenant ID */
  tenantId: string;
  /** Roles */
  roles: string[];
  /** Permissions */
  permissions: string[];
  /** Whether email is verified */
  emailVerified: boolean;
  /** MFA secret (encrypted) */
  mfaSecret?: string;
  /** Whether MFA is enabled */
  mfaEnabled: boolean;
  /** MFA backup codes (hashed) */
  mfaBackupCodes?: string[];
  /** Password history (hashes) */
  passwordHistory?: string[];
  /** Account status */
  status: 'active' | 'inactive' | 'suspended' | 'pending';
  /** Account creation time */
  createdAt: Date;
  /** Last update time */
  updatedAt: Date;
  /** Last login time */
  lastLoginAt?: Date;
  /** Failed login attempts */
  failedLoginAttempts: number;
  /** Lockout end time */
  lockoutEndsAt?: Date;
  /** User metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Authentication events
 */
export type AuthEvent =
  | 'login'
  | 'logout'
  | 'token_refresh'
  | 'session_created'
  | 'session_invalidated'
  | 'mfa_challenge'
  | 'mfa_verified'
  | 'password_changed'
  | 'account_locked'
  | 'account_unlocked';

/**
 * Event listener callback
 */
export type AuthEventListener = (event: AuthEvent, data?: Record<string, unknown>) => void;

/**
 * Tenant context
 */
export interface TenantContext {
  /** Tenant ID */
  tenantId: string;
  /** User ID */
  userId?: string;
  /** Correlation ID for tracing */
  correlationId?: string;
}
