/**
 * @prompt-id forge-v4.1:feature:admin:001
 * @generated-at 2026-01-21T00:00:00Z
 * @model claude-opus-4-5
 */

/**
 * Route paths for type-safe navigation
 */
export const ROUTES = {
  HOME: '/',
  DASHBOARD: '/dashboard',
  USERS: '/users',
  TENANTS: '/tenants',
  SETTINGS: '/settings',
  AUDIT_LOG: '/audit-log',
} as const;

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];

/**
 * Default page sizes for data tables
 */
export const PAGE_SIZES = [10, 25, 50, 100] as const;

export const DEFAULT_PAGE_SIZE = 25;

/**
 * User status labels
 */
export const USER_STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  suspended: 'Suspended',
  pending: 'Pending',
  inactive: 'Inactive',
};

/**
 * Tenant status labels
 */
export const TENANT_STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  suspended: 'Suspended',
  trial: 'Trial',
  cancelled: 'Cancelled',
};

/**
 * Tenant plan labels
 */
export const TENANT_PLAN_LABELS: Record<string, string> = {
  free: 'Free',
  starter: 'Starter',
  professional: 'Professional',
  enterprise: 'Enterprise',
};

/**
 * Audit event type labels
 */
export const AUDIT_TYPE_LABELS: Record<string, string> = {
  AUTH: 'Authentication',
  ACCESS: 'Access Control',
  DATA_CHANGE: 'Data Change',
  ADMIN_ACTION: 'Admin Action',
  SECURITY: 'Security',
  SYSTEM: 'System',
  CUSTOM: 'Custom',
};

/**
 * Audit severity labels
 */
export const AUDIT_SEVERITY_LABELS: Record<string, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
};
