/**
 * @package @forge/roles
 * @description Role-Based Access Control (RBAC) system for Forge
 *
 * Features:
 * - Role management with inheritance
 * - Permission management with conditions
 * - Policy evaluation engine (IAM-style)
 * - Attribute-based access control (ABAC)
 * - Time-based conditions
 * - Multi-tenant support
 * - Caching integration
 * - Audit logging
 */

// Main service
export { RbacService, createRbacService, resetRbacService } from './roles.service';

// Managers
export {
  PermissionManager,
  getPermissionManager,
  resetPermissionManager
} from './permission';

export {
  RoleManager,
  getRoleManager,
  resetRoleManager
} from './role';

export {
  PolicyEngine,
  getPolicyEngine,
  resetPolicyEngine
} from './policy';

// Types - Core
export type {
  Permission,
  CreatePermissionInput,
  UpdatePermissionInput,
  PermissionAction,
  PermissionEffect,
  PermissionCondition,
  ConditionOperator,
  TimeCondition,
} from './roles.types';

export type {
  Role,
  CreateRoleInput,
  UpdateRoleInput,
  UserRoleAssignment,
  AssignRoleInput,
} from './roles.types';

export type {
  Policy,
  PolicyStatement,
  CreatePolicyInput,
  UpdatePolicyInput,
} from './roles.types';

// Types - Authorization
export type {
  AuthorizationContext,
  AuthorizationResult,
  BatchAuthorizationRequest,
  BatchAuthorizationResult,
} from './roles.types';

// Types - Configuration
export type {
  RbacConfig,
  RbacStore,
  RbacAuditEvent,
  RbacAuditEventType,
  RbacEventHandler,
} from './roles.types';

// Constants
export {
  DEFAULT_PERMISSION_PRIORITY,
  SYSTEM_ROLES,
  RESOURCE_WILDCARD,
  ACTION_WILDCARD,
} from './roles.types';
