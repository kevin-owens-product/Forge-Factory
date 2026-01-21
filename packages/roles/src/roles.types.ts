/**
 * @package @forge/roles
 * @description TypeScript interfaces for RBAC system
 */

/**
 * Permission action types
 */
export type PermissionAction =
  | 'create'
  | 'read'
  | 'write'
  | 'update'
  | 'delete'
  | 'list'
  | 'execute'
  | 'manage'
  | '*';

/**
 * Permission effect (allow or deny)
 */
export type PermissionEffect = 'allow' | 'deny';

/**
 * Permission condition operators
 */
export type ConditionOperator =
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'notContains'
  | 'startsWith'
  | 'endsWith'
  | 'greaterThan'
  | 'lessThan'
  | 'greaterThanOrEqual'
  | 'lessThanOrEqual'
  | 'in'
  | 'notIn'
  | 'exists'
  | 'notExists'
  | 'between'
  | 'regex';

/**
 * Permission condition
 */
export interface PermissionCondition {
  /** Field/attribute to evaluate */
  field: string;
  /** Operator to use */
  operator: ConditionOperator;
  /** Value to compare against */
  value: unknown;
  /** Whether this is a context variable (e.g., ${user.id}) */
  isVariable?: boolean;
}

/**
 * Time-based condition
 */
export interface TimeCondition {
  /** Start time (ISO 8601 or cron-like pattern) */
  startTime?: string;
  /** End time (ISO 8601) */
  endTime?: string;
  /** Days of week (0-6, 0=Sunday) */
  daysOfWeek?: number[];
  /** Hours of day (0-23) */
  hoursOfDay?: number[];
  /** Timezone (e.g., 'America/New_York') */
  timezone?: string;
}

/**
 * Permission definition
 */
export interface Permission {
  /** Unique permission ID */
  id: string;
  /** Permission name */
  name: string;
  /** Description */
  description?: string;
  /** Resource type this permission applies to */
  resource: string;
  /** Action(s) allowed */
  actions: PermissionAction[];
  /** Effect (allow or deny) */
  effect: PermissionEffect;
  /** Resource conditions (attribute-based) */
  conditions?: PermissionCondition[];
  /** Time-based conditions */
  timeConditions?: TimeCondition;
  /** Priority (higher priority evaluated first) */
  priority?: number;
  /** Metadata */
  metadata?: Record<string, unknown>;
  /** Tenant ID (for multi-tenant) */
  tenantId?: string;
  /** Created timestamp */
  createdAt: Date;
  /** Updated timestamp */
  updatedAt: Date;
}

/**
 * Create permission input
 */
export interface CreatePermissionInput {
  id?: string;
  name: string;
  description?: string;
  resource: string;
  actions: PermissionAction[];
  effect?: PermissionEffect;
  conditions?: PermissionCondition[];
  timeConditions?: TimeCondition;
  priority?: number;
  metadata?: Record<string, unknown>;
  tenantId?: string;
}

/**
 * Update permission input
 */
export interface UpdatePermissionInput {
  name?: string;
  description?: string;
  resource?: string;
  actions?: PermissionAction[];
  effect?: PermissionEffect;
  conditions?: PermissionCondition[];
  timeConditions?: TimeCondition;
  priority?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Role definition
 */
export interface Role {
  /** Unique role ID */
  id: string;
  /** Role name */
  name: string;
  /** Description */
  description?: string;
  /** Permissions assigned to this role */
  permissions: string[];
  /** Parent roles (for inheritance) */
  parentRoles?: string[];
  /** Whether this is a system role (cannot be deleted) */
  isSystem?: boolean;
  /** Maximum users that can have this role */
  maxAssignments?: number;
  /** Metadata */
  metadata?: Record<string, unknown>;
  /** Tenant ID (for multi-tenant) */
  tenantId?: string;
  /** Created timestamp */
  createdAt: Date;
  /** Updated timestamp */
  updatedAt: Date;
}

/**
 * Create role input
 */
export interface CreateRoleInput {
  id?: string;
  name: string;
  description?: string;
  permissions?: string[];
  parentRoles?: string[];
  isSystem?: boolean;
  maxAssignments?: number;
  metadata?: Record<string, unknown>;
  tenantId?: string;
}

/**
 * Update role input
 */
export interface UpdateRoleInput {
  name?: string;
  description?: string;
  permissions?: string[];
  parentRoles?: string[];
  maxAssignments?: number;
  metadata?: Record<string, unknown>;
}

/**
 * User role assignment
 */
export interface UserRoleAssignment {
  /** User ID */
  userId: string;
  /** Role ID */
  roleId: string;
  /** Tenant ID */
  tenantId: string;
  /** Assignment scope (e.g., resource ID for scoped assignments) */
  scope?: string;
  /** Expiration timestamp */
  expiresAt?: Date;
  /** Metadata */
  metadata?: Record<string, unknown>;
  /** Assigned by user ID */
  assignedBy?: string;
  /** Assignment timestamp */
  assignedAt: Date;
}

/**
 * Assign role input
 */
export interface AssignRoleInput {
  userId: string;
  roleId: string;
  tenantId: string;
  scope?: string;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
  assignedBy?: string;
}

/**
 * Policy definition (combines multiple permissions with logic)
 */
export interface Policy {
  /** Unique policy ID */
  id: string;
  /** Policy name */
  name: string;
  /** Description */
  description?: string;
  /** Policy version */
  version: string;
  /** Policy statements */
  statements: PolicyStatement[];
  /** Whether this policy is active */
  isActive: boolean;
  /** Priority (higher priority evaluated first) */
  priority?: number;
  /** Tenant ID */
  tenantId?: string;
  /** Created timestamp */
  createdAt: Date;
  /** Updated timestamp */
  updatedAt: Date;
}

/**
 * Policy statement
 */
export interface PolicyStatement {
  /** Statement ID */
  sid?: string;
  /** Effect */
  effect: PermissionEffect;
  /** Principals (user IDs, role IDs, or wildcards) */
  principals?: string[];
  /** Not principals (exclude these) */
  notPrincipals?: string[];
  /** Actions */
  actions: string[];
  /** Not actions (exclude these) */
  notActions?: string[];
  /** Resources (resource patterns) */
  resources: string[];
  /** Not resources (exclude these) */
  notResources?: string[];
  /** Conditions */
  conditions?: PermissionCondition[];
}

/**
 * Create policy input
 */
export interface CreatePolicyInput {
  id?: string;
  name: string;
  description?: string;
  version?: string;
  statements: PolicyStatement[];
  isActive?: boolean;
  priority?: number;
  tenantId?: string;
}

/**
 * Update policy input
 */
export interface UpdatePolicyInput {
  name?: string;
  description?: string;
  version?: string;
  statements?: PolicyStatement[];
  isActive?: boolean;
  priority?: number;
}

/**
 * Authorization request context
 */
export interface AuthorizationContext {
  /** User ID */
  userId: string;
  /** Tenant ID */
  tenantId: string;
  /** Resource type */
  resource: string;
  /** Action being performed */
  action: PermissionAction;
  /** Resource ID (if applicable) */
  resourceId?: string;
  /** Resource attributes (for ABAC) */
  resourceAttributes?: Record<string, unknown>;
  /** User attributes (for ABAC) */
  userAttributes?: Record<string, unknown>;
  /** Request context (IP, timestamp, etc.) */
  requestContext?: Record<string, unknown>;
  /** Environment variables */
  environment?: Record<string, unknown>;
}

/**
 * Authorization result
 */
export interface AuthorizationResult {
  /** Whether access is allowed */
  allowed: boolean;
  /** Reason for decision */
  reason?: string;
  /** Which permission/policy made the decision */
  decidedBy?: string;
  /** Matching permissions that contributed to decision */
  matchingPermissions?: string[];
  /** Denied permissions (if applicable) */
  deniedBy?: string[];
  /** Evaluation duration in ms */
  evaluationTimeMs?: number;
}

/**
 * Batch authorization request
 */
export interface BatchAuthorizationRequest {
  /** User ID */
  userId: string;
  /** Tenant ID */
  tenantId: string;
  /** Resource-action pairs to check */
  checks: Array<{
    resource: string;
    action: PermissionAction;
    resourceId?: string;
    resourceAttributes?: Record<string, unknown>;
  }>;
  /** User attributes */
  userAttributes?: Record<string, unknown>;
  /** Request context */
  requestContext?: Record<string, unknown>;
}

/**
 * Batch authorization result
 */
export interface BatchAuthorizationResult {
  /** Results for each check (in order) */
  results: AuthorizationResult[];
  /** Total evaluation duration */
  totalEvaluationTimeMs: number;
}

/**
 * RBAC service configuration
 */
export interface RbacConfig {
  /** Enable permission caching */
  enableCaching?: boolean;
  /** Cache TTL in milliseconds */
  cacheTtlMs?: number;
  /** Default permission effect (when no rules match) */
  defaultEffect?: PermissionEffect;
  /** Maximum role inheritance depth */
  maxInheritanceDepth?: number;
  /** Enable audit logging */
  enableAuditLog?: boolean;
  /** Custom permission evaluator */
  customEvaluator?: (
    context: AuthorizationContext,
    permission: Permission
  ) => boolean | Promise<boolean>;
}

/**
 * RBAC store interface (for custom storage implementations)
 */
export interface RbacStore {
  // Permission operations
  getPermission(id: string, tenantId?: string): Promise<Permission | null>;
  getPermissions(tenantId?: string): Promise<Permission[]>;
  createPermission(permission: Permission): Promise<Permission>;
  updatePermission(id: string, updates: UpdatePermissionInput, tenantId?: string): Promise<Permission | null>;
  deletePermission(id: string, tenantId?: string): Promise<boolean>;

  // Role operations
  getRole(id: string, tenantId?: string): Promise<Role | null>;
  getRoles(tenantId?: string): Promise<Role[]>;
  createRole(role: Role): Promise<Role>;
  updateRole(id: string, updates: UpdateRoleInput, tenantId?: string): Promise<Role | null>;
  deleteRole(id: string, tenantId?: string): Promise<boolean>;

  // Assignment operations
  getUserRoles(userId: string, tenantId: string): Promise<UserRoleAssignment[]>;
  assignRole(assignment: UserRoleAssignment): Promise<UserRoleAssignment>;
  unassignRole(userId: string, roleId: string, tenantId: string): Promise<boolean>;
  getUsersWithRole(roleId: string, tenantId: string): Promise<UserRoleAssignment[]>;

  // Policy operations
  getPolicy(id: string, tenantId?: string): Promise<Policy | null>;
  getPolicies(tenantId?: string): Promise<Policy[]>;
  createPolicy(policy: Policy): Promise<Policy>;
  updatePolicy(id: string, updates: UpdatePolicyInput, tenantId?: string): Promise<Policy | null>;
  deletePolicy(id: string, tenantId?: string): Promise<boolean>;
}

/**
 * Audit event types
 */
export type RbacAuditEventType =
  | 'permission_created'
  | 'permission_updated'
  | 'permission_deleted'
  | 'role_created'
  | 'role_updated'
  | 'role_deleted'
  | 'role_assigned'
  | 'role_unassigned'
  | 'policy_created'
  | 'policy_updated'
  | 'policy_deleted'
  | 'authorization_allowed'
  | 'authorization_denied';

/**
 * RBAC audit event
 */
export interface RbacAuditEvent {
  /** Event type */
  type: RbacAuditEventType;
  /** Timestamp */
  timestamp: Date;
  /** Actor (user who performed the action) */
  actorId?: string;
  /** Tenant ID */
  tenantId?: string;
  /** Target entity type */
  entityType?: 'permission' | 'role' | 'assignment' | 'policy';
  /** Target entity ID */
  entityId?: string;
  /** Previous state (for updates) */
  previousState?: unknown;
  /** New state (for creates/updates) */
  newState?: unknown;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Event handler type
 */
export type RbacEventHandler = (event: RbacAuditEvent) => void | Promise<void>;

/**
 * Default permission priority
 */
export const DEFAULT_PERMISSION_PRIORITY = 0;

/**
 * System role IDs
 */
export const SYSTEM_ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  USER: 'user',
  GUEST: 'guest',
} as const;

/**
 * Resource wildcard
 */
export const RESOURCE_WILDCARD = '*';

/**
 * Action wildcard
 */
export const ACTION_WILDCARD = '*';
