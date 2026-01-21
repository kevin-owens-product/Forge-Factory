/**
 * @package @forge/roles
 * @description Policy evaluation engine
 */

import { ErrorCode, ForgeError } from '@forge/errors';
import {
  Policy,
  PolicyStatement,
  CreatePolicyInput,
  UpdatePolicyInput,
  AuthorizationContext,
  AuthorizationResult,
  Permission,
  RESOURCE_WILDCARD,
  ACTION_WILDCARD,
} from './roles.types';
import { PermissionManager } from './permission';

/**
 * Policy evaluation engine
 */
export class PolicyEngine {
  private policies: Map<string, Policy> = new Map();
  private permissionManager: PermissionManager;

  constructor(permissionManager: PermissionManager) {
    this.permissionManager = permissionManager;
  }

  /**
   * Create a new policy
   */
  createPolicy(input: CreatePolicyInput): Policy {
    const id = input.id || this.generateId();

    // Validate input
    this.validatePolicyInput(input);

    // Check for duplicate
    if (this.policies.has(this.getKey(id, input.tenantId))) {
      throw new ForgeError({
        code: ErrorCode.CONFLICT,
        message: `Policy with ID '${id}' already exists`,
        statusCode: 409,
      });
    }

    const now = new Date();
    const policy: Policy = {
      id,
      name: input.name,
      description: input.description,
      version: input.version || '1.0',
      statements: input.statements,
      isActive: input.isActive ?? true,
      priority: input.priority ?? 0,
      tenantId: input.tenantId,
      createdAt: now,
      updatedAt: now,
    };

    this.policies.set(this.getKey(id, input.tenantId), policy);
    return policy;
  }

  /**
   * Get a policy by ID
   */
  getPolicy(id: string, tenantId?: string): Policy | null {
    return this.policies.get(this.getKey(id, tenantId)) || null;
  }

  /**
   * Get all policies (optionally filtered by tenant)
   */
  getPolicies(tenantId?: string): Policy[] {
    const policies: Policy[] = [];
    for (const policy of this.policies.values()) {
      if (!tenantId || policy.tenantId === tenantId) {
        policies.push(policy);
      }
    }
    return policies;
  }

  /**
   * Update a policy
   */
  updatePolicy(
    id: string,
    updates: UpdatePolicyInput,
    tenantId?: string
  ): Policy | null {
    const key = this.getKey(id, tenantId);
    const existing = this.policies.get(key);

    if (!existing) {
      return null;
    }

    // Validate statements if being updated
    if (updates.statements) {
      this.validatePolicyInput({ ...existing, ...updates, name: updates.name || existing.name });
    }

    const updated: Policy = {
      ...existing,
      ...updates,
      id: existing.id,
      tenantId: existing.tenantId,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    };

    this.policies.set(key, updated);
    return updated;
  }

  /**
   * Delete a policy
   */
  deletePolicy(id: string, tenantId?: string): boolean {
    return this.policies.delete(this.getKey(id, tenantId));
  }

  /**
   * Evaluate authorization request
   */
  evaluate(
    context: AuthorizationContext,
    userPermissionIds: string[]
  ): AuthorizationResult {
    const startTime = Date.now();

    // Get user's permissions
    const userPermissions: Permission[] = [];
    for (const permId of userPermissionIds) {
      const perm = this.permissionManager.getPermission(permId, context.tenantId);
      if (perm) {
        userPermissions.push(perm);
      }
    }

    // Check for wildcard permission (super admin)
    if (userPermissionIds.includes('*')) {
      return {
        allowed: true,
        reason: 'Wildcard permission grants full access',
        decidedBy: '*',
        evaluationTimeMs: Date.now() - startTime,
      };
    }

    // Evaluate policies first (they take precedence)
    const policyResult = this.evaluatePolicies(context, userPermissionIds);
    if (policyResult) {
      return {
        ...policyResult,
        evaluationTimeMs: Date.now() - startTime,
      };
    }

    // Evaluate permissions
    const permissionResult = this.evaluatePermissions(context, userPermissions);
    return {
      ...permissionResult,
      evaluationTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Evaluate policies
   */
  private evaluatePolicies(
    context: AuthorizationContext,
    userPermissionIds: string[]
  ): AuthorizationResult | null {
    // Get active policies sorted by priority (descending)
    const activePolicies = this.getPolicies(context.tenantId)
      .filter((p) => p.isActive)
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

    const matchingPermissions: string[] = [];

    for (const policy of activePolicies) {
      const result = this.evaluatePolicy(policy, context, userPermissionIds);

      if (result.matched) {
        if (result.effect === 'deny') {
          return {
            allowed: false,
            reason: `Denied by policy: ${policy.name}`,
            decidedBy: policy.id,
            deniedBy: [policy.id],
          };
        }
        matchingPermissions.push(policy.id);
      }
    }

    // If any policy allowed, return allowed
    if (matchingPermissions.length > 0) {
      return {
        allowed: true,
        reason: `Allowed by policy`,
        decidedBy: matchingPermissions[0],
        matchingPermissions,
      };
    }

    return null; // No policy matched, continue to permission evaluation
  }

  /**
   * Evaluate a single policy
   */
  private evaluatePolicy(
    policy: Policy,
    context: AuthorizationContext,
    userPermissionIds: string[]
  ): { matched: boolean; effect?: 'allow' | 'deny' } {
    for (const statement of policy.statements) {
      const match = this.evaluateStatement(statement, context, userPermissionIds);
      if (match) {
        return { matched: true, effect: statement.effect };
      }
    }
    return { matched: false };
  }

  /**
   * Evaluate a policy statement
   */
  private evaluateStatement(
    statement: PolicyStatement,
    context: AuthorizationContext,
    userPermissionIds: string[]
  ): boolean {
    // Check principals (if specified)
    if (statement.principals && statement.principals.length > 0) {
      const isPrincipalMatch = this.matchesPrincipal(
        statement.principals,
        context.userId,
        userPermissionIds
      );
      if (!isPrincipalMatch) {
        return false;
      }
    }

    // Check notPrincipals (if specified)
    if (statement.notPrincipals && statement.notPrincipals.length > 0) {
      const isNotPrincipalMatch = this.matchesPrincipal(
        statement.notPrincipals,
        context.userId,
        userPermissionIds
      );
      if (isNotPrincipalMatch) {
        return false;
      }
    }

    // Check actions
    const actionMatch = this.matchesStatementAction(
      statement.actions,
      statement.notActions,
      context.action
    );
    if (!actionMatch) {
      return false;
    }

    // Check resources
    const resourceMatch = this.matchesStatementResource(
      statement.resources,
      statement.notResources,
      context.resource,
      context.resourceId
    );
    if (!resourceMatch) {
      return false;
    }

    // Check conditions
    if (statement.conditions && statement.conditions.length > 0) {
      const conditionsMatch = this.permissionManager.evaluateConditions(
        statement.conditions,
        context
      );
      if (!conditionsMatch) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if principal matches
   */
  private matchesPrincipal(
    principals: string[],
    userId: string,
    userPermissionIds: string[]
  ): boolean {
    for (const principal of principals) {
      if (principal === '*') {
        return true;
      }
      if (principal === userId) {
        return true;
      }
      // Check if principal is a role/permission ID that user has
      if (userPermissionIds.includes(principal)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if action matches statement
   */
  private matchesStatementAction(
    actions: string[],
    notActions: string[] | undefined,
    requestedAction: string
  ): boolean {
    // Check notActions first
    if (notActions && notActions.length > 0) {
      for (const notAction of notActions) {
        if (
          notAction === ACTION_WILDCARD ||
          notAction === requestedAction ||
          this.matchesGlob(notAction, requestedAction)
        ) {
          return false;
        }
      }
    }

    // Check actions
    for (const action of actions) {
      if (
        action === ACTION_WILDCARD ||
        action === requestedAction ||
        this.matchesGlob(action, requestedAction)
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if resource matches statement
   */
  private matchesStatementResource(
    resources: string[],
    notResources: string[] | undefined,
    resourceType: string,
    resourceId?: string
  ): boolean {
    const resourceString = resourceId ? `${resourceType}:${resourceId}` : resourceType;

    // Check notResources first
    if (notResources && notResources.length > 0) {
      for (const notResource of notResources) {
        if (this.matchesResourcePattern(notResource, resourceString, resourceType)) {
          return false;
        }
      }
    }

    // Check resources
    for (const resource of resources) {
      if (this.matchesResourcePattern(resource, resourceString, resourceType)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Match resource pattern
   */
  private matchesResourcePattern(
    pattern: string,
    resourceString: string,
    resourceType: string
  ): boolean {
    if (pattern === RESOURCE_WILDCARD) {
      return true;
    }
    if (pattern === resourceString || pattern === resourceType) {
      return true;
    }
    return this.matchesGlob(pattern, resourceString);
  }

  /**
   * Match glob pattern
   */
  private matchesGlob(pattern: string, value: string): boolean {
    if (!pattern.includes('*')) {
      return pattern === value;
    }

    const regexPattern = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*');
    return new RegExp(`^${regexPattern}$`).test(value);
  }

  /**
   * Evaluate permissions (RBAC check)
   */
  private evaluatePermissions(
    context: AuthorizationContext,
    permissions: Permission[]
  ): AuthorizationResult {
    // Sort by priority (descending) and effect (deny first)
    const sortedPermissions = [...permissions].sort((a, b) => {
      // Deny rules have higher priority
      if (a.effect !== b.effect) {
        return a.effect === 'deny' ? -1 : 1;
      }
      // Then by priority
      return (b.priority ?? 0) - (a.priority ?? 0);
    });

    const matchingPermissions: string[] = [];

    for (const permission of sortedPermissions) {
      if (this.permissionManager.matchesContext(permission, context)) {
        if (permission.effect === 'deny') {
          return {
            allowed: false,
            reason: `Denied by permission: ${permission.name}`,
            decidedBy: permission.id,
            deniedBy: [permission.id],
          };
        }
        matchingPermissions.push(permission.id);
      }
    }

    if (matchingPermissions.length > 0) {
      return {
        allowed: true,
        reason: 'Allowed by permission',
        decidedBy: matchingPermissions[0],
        matchingPermissions,
      };
    }

    return {
      allowed: false,
      reason: 'No matching permission found',
      deniedBy: [],
    };
  }

  /**
   * Validate policy input
   */
  private validatePolicyInput(input: CreatePolicyInput): void {
    if (!input.name || input.name.trim().length === 0) {
      throw new ForgeError({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'Policy name is required',
        statusCode: 400,
      });
    }

    if (!input.statements || input.statements.length === 0) {
      throw new ForgeError({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'Policy must have at least one statement',
        statusCode: 400,
      });
    }

    for (const statement of input.statements) {
      if (!statement.effect) {
        throw new ForgeError({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'Statement effect is required',
          statusCode: 400,
        });
      }

      if (!statement.actions || statement.actions.length === 0) {
        throw new ForgeError({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'Statement must have at least one action',
          statusCode: 400,
        });
      }

      if (!statement.resources || statement.resources.length === 0) {
        throw new ForgeError({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'Statement must have at least one resource',
          statusCode: 400,
        });
      }
    }
  }

  /**
   * Get storage key
   */
  private getKey(id: string, tenantId?: string): string {
    return tenantId ? `${tenantId}:${id}` : id;
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `policy_${timestamp}_${random}`;
  }

  /**
   * Clear all policies (for testing)
   */
  clear(): void {
    this.policies.clear();
  }

  /**
   * Import policies (for initialization)
   */
  importPolicies(policies: Policy[]): void {
    for (const policy of policies) {
      this.policies.set(this.getKey(policy.id, policy.tenantId), policy);
    }
  }
}

/**
 * Singleton instance
 */
let policyEngineInstance: PolicyEngine | null = null;

/**
 * Get the singleton policy engine instance
 */
export function getPolicyEngine(permissionManager: PermissionManager): PolicyEngine {
  if (!policyEngineInstance) {
    policyEngineInstance = new PolicyEngine(permissionManager);
  }
  return policyEngineInstance;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetPolicyEngine(): void {
  policyEngineInstance = null;
}
