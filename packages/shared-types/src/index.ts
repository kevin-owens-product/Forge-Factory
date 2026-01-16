/**
 * @package @forge/shared-types
 * @description Shared TypeScript types and branded types
 */

// ============================================
// Branded Types for Type Safety
// ============================================

/**
 * Branded type helper
 */
export type Brand<T, B> = T & { __brand: B };

/**
 * Tenant identifier
 */
export type TenantId = Brand<string, 'TenantId'>;

/**
 * User identifier
 */
export type UserId = Brand<string, 'UserId'>;

/**
 * Session identifier
 */
export type SessionId = Brand<string, 'SessionId'>;

/**
 * API Key identifier
 */
export type ApiKeyId = Brand<string, 'ApiKeyId'>;

/**
 * Role identifier
 */
export type RoleId = Brand<string, 'RoleId'>;

/**
 * Permission string
 */
export type Permission = Brand<string, 'Permission'>;

/**
 * Organization identifier
 */
export type OrganizationId = Brand<string, 'OrganizationId'>;

// ============================================
// Region Types
// ============================================

export type Region = 'us-east-1' | 'eu-west-1' | 'eu-central-1' | 'ap-southeast-1';

export interface RegionInfo {
  id: Region;
  name: string;
  location: string;
  flag: string;
  compliance: string[];
  isDefault?: boolean;
}

export const REGIONS: Record<Region, RegionInfo> = {
  'us-east-1': {
    id: 'us-east-1',
    name: 'US East',
    location: 'N. Virginia',
    flag: '🇺🇸',
    compliance: ['SOC2', 'HIPAA'],
    isDefault: true,
  },
  'eu-west-1': {
    id: 'eu-west-1',
    name: 'EU West',
    location: 'Ireland',
    flag: '🇪🇺',
    compliance: ['SOC2', 'GDPR'],
  },
  'eu-central-1': {
    id: 'eu-central-1',
    name: 'EU Central',
    location: 'Frankfurt',
    flag: '🇩🇪',
    compliance: ['SOC2', 'GDPR'],
  },
  'ap-southeast-1': {
    id: 'ap-southeast-1',
    name: 'Asia Pacific',
    location: 'Singapore',
    flag: '🇸🇬',
    compliance: ['SOC2'],
  },
};

// ============================================
// Request Context
// ============================================

export interface RequestContext {
  tenantId: TenantId;
  userId: UserId;
  sessionId: SessionId;
  permissions: Permission[];
  roles: RoleId[];
  authMethod: 'jwt' | 'api_key' | 'oauth' | 'saml';
  impersonatedBy?: UserId;
  apiKeyId?: ApiKeyId;
  scopes?: string[];
  locale: string;
  timezone: string;
  region: Region;
}

// ============================================
// Pagination
// ============================================

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

// ============================================
// Common Response Types
// ============================================

export interface SuccessResponse<T = void> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T = void> = SuccessResponse<T> | ErrorResponse;

// ============================================
// Audit Types
// ============================================

export type AuditEventType =
  // Authentication
  | 'auth.login'
  | 'auth.logout'
  | 'auth.login_failed'
  | 'auth.mfa_enabled'
  | 'auth.mfa_disabled'
  | 'auth.password_changed'
  | 'auth.password_reset'
  | 'auth.session_revoked'
  // Authorization
  | 'authz.permission_denied'
  | 'authz.role_assigned'
  | 'authz.role_removed'
  // Users
  | 'user.created'
  | 'user.updated'
  | 'user.deleted'
  | 'user.invited'
  | 'user.suspended'
  // Organizations
  | 'organization.created'
  | 'organization.updated'
  | 'organization.deleted'
  | 'organization.archived'
  // API Keys
  | 'api_key.created'
  | 'api_key.deleted'
  | 'api_key.used'
  // Settings
  | 'settings.updated'
  | 'sso.configured'
  | 'sso.updated'
  // Data
  | 'data.exported'
  | 'data.imported'
  | 'data.deleted'
  // Billing
  | 'billing.subscription_created'
  | 'billing.subscription_cancelled'
  | 'billing.plan_changed'
  | 'billing.payment_failed'
  // Admin
  | 'admin.impersonation_started'
  | 'admin.impersonation_ended'
  | 'admin.tenant_suspended'
  // Security
  | 'security.ip_blocked'
  | 'security.rate_limited'
  | 'security.suspicious_activity';

export interface AuditEvent {
  id: string;
  tenantId: TenantId;
  eventType: AuditEventType;
  severity: 'info' | 'warning' | 'critical';
  timestamp: Date;
  actor: {
    type: 'user' | 'api_key' | 'system' | 'admin';
    id: string;
    email?: string;
    ipAddress?: string;
    userAgent?: string;
  };
  resource: {
    type: string;
    id: string;
    name?: string;
  };
  action: string;
  outcome: 'success' | 'failure';
  changes?: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  };
  requestId: string;
  sessionId?: string;
  geoLocation?: {
    country: string;
    region: string;
    city: string;
  };
  rawPayload?: unknown;
}

// ============================================
// Utility Types
// ============================================

/**
 * Make all properties optional except specified ones
 */
export type PartialExcept<T, K extends keyof T> = Partial<T> & Pick<T, K>;

/**
 * Make all properties required except specified ones
 */
export type RequiredExcept<T, K extends keyof T> = Required<T> & Partial<Pick<T, K>>;

/**
 * Extract promise type
 */
export type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;

/**
 * Make properties nullable
 */
export type Nullable<T> = T | null;

/**
 * Deep partial type
 */
export type DeepPartial<T> = T extends object ? {
  [P in keyof T]?: DeepPartial<T[P]>;
} : T;
