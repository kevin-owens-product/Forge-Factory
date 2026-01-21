/**
 * @package @forge/roles
 * @description Main RBAC service
 */

import {
  Permission,
  CreatePermissionInput,
  UpdatePermissionInput,
  Role,
  CreateRoleInput,
  UpdateRoleInput,
  UserRoleAssignment,
  AssignRoleInput,
  Policy,
  CreatePolicyInput,
  UpdatePolicyInput,
  AuthorizationContext,
  AuthorizationResult,
  BatchAuthorizationRequest,
  BatchAuthorizationResult,
  RbacConfig,
  RbacAuditEvent,
  RbacEventHandler,
} from './roles.types';
import { PermissionManager, getPermissionManager, resetPermissionManager } from './permission';
import { RoleManager, getRoleManager, resetRoleManager } from './role';
import { PolicyEngine, getPolicyEngine, resetPolicyEngine } from './policy';

/**
 * Cache options interface
 */
interface CacheOptions {
  ttl?: number;
}

/**
 * Cache interface for optional caching
 */
interface CacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, options?: CacheOptions): Promise<void>;
  delete(key: string): Promise<boolean>;
  deleteMany?(keys: string[]): Promise<number>;
}

/**
 * Main RBAC service
 */
export class RbacService {
  private config: RbacConfig;
  private permissionManager: PermissionManager;
  private roleManager: RoleManager;
  private policyEngine: PolicyEngine;
  private cache?: CacheService;
  private eventHandler?: RbacEventHandler;

  constructor(config: RbacConfig = {}, cache?: CacheService) {
    this.config = {
      enableCaching: config.enableCaching ?? false,
      cacheTtlMs: config.cacheTtlMs ?? 300000, // 5 minutes
      defaultEffect: config.defaultEffect ?? 'deny',
      maxInheritanceDepth: config.maxInheritanceDepth ?? 10,
      enableAuditLog: config.enableAuditLog ?? true,
      customEvaluator: config.customEvaluator,
    };

    this.permissionManager = getPermissionManager();
    this.roleManager = getRoleManager(this.config.maxInheritanceDepth);
    this.policyEngine = getPolicyEngine(this.permissionManager);
    this.cache = cache;
  }

  /**
   * Set event handler for audit logging
   */
  setEventHandler(handler: RbacEventHandler): void {
    this.eventHandler = handler;
  }

  /**
   * Register event handler (alias for setEventHandler)
   */
  onEvent(handler: RbacEventHandler): void {
    this.eventHandler = handler;
  }

  /**
   * Set cache service
   */
  setCache(cache: CacheService): void {
    this.cache = cache;
  }

  // ===================
  // Permission Methods
  // ===================

  /**
   * Create a new permission
   */
  async createPermission(input: CreatePermissionInput): Promise<Permission> {
    const permission = this.permissionManager.createPermission(input);

    await this.emitEvent({
      type: 'permission_created',
      timestamp: new Date(),
      tenantId: input.tenantId,
      entityType: 'permission',
      entityId: permission.id,
      newState: permission,
    });

    await this.invalidateCache(`permissions:${input.tenantId || 'global'}`);

    return permission;
  }

  /**
   * Get a permission by ID
   */
  async getPermission(id: string, tenantId?: string): Promise<Permission | null> {
    return this.permissionManager.getPermission(id, tenantId);
  }

  /**
   * Get all permissions
   */
  async getPermissions(tenantId?: string): Promise<Permission[]> {
    return this.permissionManager.getPermissions(tenantId);
  }

  /**
   * Update a permission
   */
  async updatePermission(
    id: string,
    updates: UpdatePermissionInput,
    tenantId?: string
  ): Promise<Permission | null> {
    const existing = this.permissionManager.getPermission(id, tenantId);
    const updated = this.permissionManager.updatePermission(id, updates, tenantId);

    if (updated) {
      await this.emitEvent({
        type: 'permission_updated',
        timestamp: new Date(),
        tenantId,
        entityType: 'permission',
        entityId: id,
        previousState: existing,
        newState: updated,
      });

      await this.invalidateCache(`permissions:${tenantId || 'global'}`);
    }

    return updated;
  }

  /**
   * Delete a permission
   */
  async deletePermission(id: string, tenantId?: string): Promise<boolean> {
    const existing = this.permissionManager.getPermission(id, tenantId);
    const deleted = this.permissionManager.deletePermission(id, tenantId);

    if (deleted) {
      await this.emitEvent({
        type: 'permission_deleted',
        timestamp: new Date(),
        tenantId,
        entityType: 'permission',
        entityId: id,
        previousState: existing,
      });

      await this.invalidateCache(`permissions:${tenantId || 'global'}`);
    }

    return deleted;
  }

  // ===================
  // Role Methods
  // ===================

  /**
   * Create a new role
   */
  async createRole(input: CreateRoleInput): Promise<Role> {
    const role = this.roleManager.createRole(input);

    await this.emitEvent({
      type: 'role_created',
      timestamp: new Date(),
      tenantId: input.tenantId,
      entityType: 'role',
      entityId: role.id,
      newState: role,
    });

    await this.invalidateCache(`roles:${input.tenantId || 'global'}`);

    return role;
  }

  /**
   * Get a role by ID
   */
  async getRole(id: string, tenantId?: string): Promise<Role | null> {
    return this.roleManager.getRole(id, tenantId);
  }

  /**
   * Get all roles
   */
  async getRoles(tenantId?: string): Promise<Role[]> {
    return this.roleManager.getRoles(tenantId);
  }

  /**
   * Update a role
   */
  async updateRole(
    id: string,
    updates: UpdateRoleInput,
    tenantId?: string
  ): Promise<Role | null> {
    const existing = this.roleManager.getRole(id, tenantId);
    const updated = this.roleManager.updateRole(id, updates, tenantId);

    if (updated) {
      await this.emitEvent({
        type: 'role_updated',
        timestamp: new Date(),
        tenantId,
        entityType: 'role',
        entityId: id,
        previousState: existing,
        newState: updated,
      });

      await this.invalidateCache(`roles:${tenantId || 'global'}`);
      await this.invalidateUserCaches(tenantId);
    }

    return updated;
  }

  /**
   * Delete a role
   */
  async deleteRole(id: string, tenantId?: string): Promise<boolean> {
    const existing = this.roleManager.getRole(id, tenantId);
    const deleted = this.roleManager.deleteRole(id, tenantId);

    if (deleted) {
      await this.emitEvent({
        type: 'role_deleted',
        timestamp: new Date(),
        tenantId,
        entityType: 'role',
        entityId: id,
        previousState: existing,
      });

      await this.invalidateCache(`roles:${tenantId || 'global'}`);
      await this.invalidateUserCaches(tenantId);
    }

    return deleted;
  }

  /**
   * Add permission to role
   */
  async addPermissionToRole(
    roleId: string,
    permissionId: string,
    tenantId?: string
  ): Promise<Role | null> {
    const updated = this.roleManager.addPermissionToRole(roleId, permissionId, tenantId);

    if (updated) {
      await this.invalidateCache(`roles:${tenantId || 'global'}`);
      await this.invalidateUserCaches(tenantId);
    }

    return updated;
  }

  /**
   * Remove permission from role
   */
  async removePermissionFromRole(
    roleId: string,
    permissionId: string,
    tenantId?: string
  ): Promise<Role | null> {
    const updated = this.roleManager.removePermissionFromRole(roleId, permissionId, tenantId);

    if (updated) {
      await this.invalidateCache(`roles:${tenantId || 'global'}`);
      await this.invalidateUserCaches(tenantId);
    }

    return updated;
  }

  /**
   * Get effective permissions for a role (including inherited)
   */
  async getEffectivePermissions(roleId: string, tenantId?: string): Promise<string[]> {
    return this.roleManager.getEffectivePermissions(roleId, tenantId);
  }

  // ===================
  // Assignment Methods
  // ===================

  /**
   * Assign a role to a user
   */
  async assignRole(input: AssignRoleInput): Promise<UserRoleAssignment> {
    const assignment = this.roleManager.assignRole(input);

    await this.emitEvent({
      type: 'role_assigned',
      timestamp: new Date(),
      actorId: input.assignedBy,
      tenantId: input.tenantId,
      entityType: 'assignment',
      entityId: `${input.userId}:${input.roleId}`,
      newState: assignment,
      metadata: { userId: input.userId, roleId: input.roleId },
    });

    await this.invalidateUserCache(input.userId, input.tenantId);

    return assignment;
  }

  /**
   * Unassign a role from a user
   */
  async unassignRole(
    userId: string,
    roleId: string,
    tenantId: string,
    actorId?: string
  ): Promise<boolean> {
    const removed = this.roleManager.unassignRole(userId, roleId, tenantId);

    if (removed) {
      await this.emitEvent({
        type: 'role_unassigned',
        timestamp: new Date(),
        actorId,
        tenantId,
        entityType: 'assignment',
        entityId: `${userId}:${roleId}`,
        metadata: { userId, roleId },
      });

      await this.invalidateUserCache(userId, tenantId);
    }

    return removed;
  }

  /**
   * Get user's role assignments
   */
  async getUserRoles(userId: string, tenantId: string): Promise<UserRoleAssignment[]> {
    return this.roleManager.getUserRoles(userId, tenantId);
  }

  /**
   * Get all users with a specific role
   */
  async getUsersWithRole(roleId: string, tenantId: string): Promise<UserRoleAssignment[]> {
    return this.roleManager.getUsersWithRole(roleId, tenantId);
  }

  /**
   * Check if user has a specific role
   */
  async userHasRole(
    userId: string,
    roleId: string,
    tenantId: string,
    scope?: string
  ): Promise<boolean> {
    return this.roleManager.userHasRole(userId, roleId, tenantId, scope);
  }

  /**
   * Get all effective permissions for a user
   */
  async getUserEffectivePermissions(userId: string, tenantId: string): Promise<string[]> {
    const cacheKey = `user:${tenantId}:${userId}:permissions`;

    if (this.config.enableCaching && this.cache) {
      const cached = await this.cache.get<string[]>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const permissions = this.roleManager.getUserEffectivePermissions(userId, tenantId);

    if (this.config.enableCaching && this.cache) {
      await this.cache.set(cacheKey, permissions, { ttl: this.config.cacheTtlMs });
    }

    return permissions;
  }

  // ===================
  // Policy Methods
  // ===================

  /**
   * Create a new policy
   */
  async createPolicy(input: CreatePolicyInput): Promise<Policy> {
    const policy = this.policyEngine.createPolicy(input);

    await this.emitEvent({
      type: 'policy_created',
      timestamp: new Date(),
      tenantId: input.tenantId,
      entityType: 'policy',
      entityId: policy.id,
      newState: policy,
    });

    await this.invalidateCache(`policies:${input.tenantId || 'global'}`);

    return policy;
  }

  /**
   * Get a policy by ID
   */
  async getPolicy(id: string, tenantId?: string): Promise<Policy | null> {
    return this.policyEngine.getPolicy(id, tenantId);
  }

  /**
   * Get all policies
   */
  async getPolicies(tenantId?: string): Promise<Policy[]> {
    return this.policyEngine.getPolicies(tenantId);
  }

  /**
   * Update a policy
   */
  async updatePolicy(
    id: string,
    updates: UpdatePolicyInput,
    tenantId?: string
  ): Promise<Policy | null> {
    const existing = this.policyEngine.getPolicy(id, tenantId);
    const updated = this.policyEngine.updatePolicy(id, updates, tenantId);

    if (updated) {
      await this.emitEvent({
        type: 'policy_updated',
        timestamp: new Date(),
        tenantId,
        entityType: 'policy',
        entityId: id,
        previousState: existing,
        newState: updated,
      });

      await this.invalidateCache(`policies:${tenantId || 'global'}`);
    }

    return updated;
  }

  /**
   * Delete a policy
   */
  async deletePolicy(id: string, tenantId?: string): Promise<boolean> {
    const existing = this.policyEngine.getPolicy(id, tenantId);
    const deleted = this.policyEngine.deletePolicy(id, tenantId);

    if (deleted) {
      await this.emitEvent({
        type: 'policy_deleted',
        timestamp: new Date(),
        tenantId,
        entityType: 'policy',
        entityId: id,
        previousState: existing,
      });

      await this.invalidateCache(`policies:${tenantId || 'global'}`);
    }

    return deleted;
  }

  // ===================
  // Authorization Methods
  // ===================

  /**
   * Check if user is authorized for an action
   */
  async authorize(context: AuthorizationContext): Promise<AuthorizationResult> {
    // Get user's effective permissions
    const userPermissionIds = await this.getUserEffectivePermissions(
      context.userId,
      context.tenantId
    );

    // Use custom evaluator if provided
    if (this.config.customEvaluator) {
      for (const permId of userPermissionIds) {
        const permission = this.permissionManager.getPermission(permId, context.tenantId);
        if (permission) {
          const result = await this.config.customEvaluator(context, permission);
          if (result) {
            const authResult: AuthorizationResult = {
              allowed: true,
              reason: 'Allowed by custom evaluator',
              decidedBy: permission.id,
            };
            await this.emitAuthorizationEvent(context, authResult);
            return authResult;
          }
        }
      }
    }

    // Evaluate using policy engine
    const result = this.policyEngine.evaluate(context, userPermissionIds);

    // Apply default effect if no match
    if (!result.allowed && result.reason === 'No matching permission found') {
      result.allowed = this.config.defaultEffect === 'allow';
      result.reason = `Default effect: ${this.config.defaultEffect}`;
    }

    await this.emitAuthorizationEvent(context, result);

    return result;
  }

  /**
   * Check multiple authorizations at once
   */
  async authorizeBatch(request: BatchAuthorizationRequest): Promise<BatchAuthorizationResult> {
    const startTime = Date.now();
    const results: AuthorizationResult[] = [];

    // Get user's effective permissions once
    const userPermissionIds = await this.getUserEffectivePermissions(
      request.userId,
      request.tenantId
    );

    for (const check of request.checks) {
      const context: AuthorizationContext = {
        userId: request.userId,
        tenantId: request.tenantId,
        resource: check.resource,
        action: check.action,
        resourceId: check.resourceId,
        resourceAttributes: check.resourceAttributes,
        userAttributes: request.userAttributes,
        requestContext: request.requestContext,
      };

      const result = this.policyEngine.evaluate(context, userPermissionIds);

      // Apply default effect if no match
      if (!result.allowed && result.reason === 'No matching permission found') {
        result.allowed = this.config.defaultEffect === 'allow';
        result.reason = `Default effect: ${this.config.defaultEffect}`;
      }

      results.push(result);
    }

    return {
      results,
      totalEvaluationTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Check if user can perform action (convenience method)
   */
  async can(
    userId: string,
    tenantId: string,
    resource: string,
    action: string,
    resourceId?: string
  ): Promise<boolean> {
    const result = await this.authorize({
      userId,
      tenantId,
      resource,
      action: action as AuthorizationContext['action'],
      resourceId,
    });
    return result.allowed;
  }

  // ===================
  // Initialization Methods
  // ===================

  /**
   * Initialize system roles for a tenant
   */
  async initializeSystemRoles(tenantId?: string): Promise<Role[]> {
    return this.roleManager.createSystemRoles(tenantId);
  }

  // ===================
  // Private Methods
  // ===================

  /**
   * Emit audit event
   */
  private async emitEvent(event: RbacAuditEvent): Promise<void> {
    if (this.config.enableAuditLog && this.eventHandler) {
      await this.eventHandler(event);
    }
  }

  /**
   * Emit authorization event
   */
  private async emitAuthorizationEvent(
    context: AuthorizationContext,
    result: AuthorizationResult
  ): Promise<void> {
    await this.emitEvent({
      type: result.allowed ? 'authorization_allowed' : 'authorization_denied',
      timestamp: new Date(),
      actorId: context.userId,
      tenantId: context.tenantId,
      metadata: {
        resource: context.resource,
        action: context.action,
        resourceId: context.resourceId,
        decision: result,
      },
    });
  }

  /**
   * Invalidate cache key
   */
  private async invalidateCache(key: string): Promise<void> {
    if (this.config.enableCaching && this.cache) {
      await this.cache.delete(key);
    }
  }

  /**
   * Invalidate user-specific cache
   */
  private async invalidateUserCache(userId: string, tenantId: string): Promise<void> {
    if (this.config.enableCaching && this.cache) {
      await this.cache.delete(`user:${tenantId}:${userId}:permissions`);
    }
  }

  /**
   * Invalidate all user caches for a tenant
   */
  private async invalidateUserCaches(_tenantId?: string): Promise<void> {
    // In a real implementation, you would track user cache keys
    // and invalidate them selectively
  }
}

/**
 * Create RBAC service instance
 */
export function createRbacService(
  config?: RbacConfig,
  cache?: CacheService
): RbacService {
  return new RbacService(config, cache);
}

/**
 * Reset all singleton instances (for testing)
 */
export function resetRbacService(): void {
  resetPermissionManager();
  resetRoleManager();
  resetPolicyEngine();
}
