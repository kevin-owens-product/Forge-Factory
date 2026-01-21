/**
 * @package @forge/roles
 * @description Role management with inheritance support
 */

import { ErrorCode, ForgeError } from '@forge/errors';
import {
  Role,
  CreateRoleInput,
  UpdateRoleInput,
  UserRoleAssignment,
  AssignRoleInput,
  SYSTEM_ROLES,
} from './roles.types';

/**
 * Role manager class
 */
export class RoleManager {
  private roles: Map<string, Role> = new Map();
  private assignments: Map<string, UserRoleAssignment[]> = new Map();
  private maxInheritanceDepth: number;

  constructor(maxInheritanceDepth: number = 10) {
    this.maxInheritanceDepth = maxInheritanceDepth;
  }

  /**
   * Create a new role
   */
  createRole(input: CreateRoleInput): Role {
    const id = input.id || this.generateId();

    // Validate input
    this.validateRoleInput(input);

    // Check for duplicate
    if (this.roles.has(this.getKey(id, input.tenantId))) {
      throw new ForgeError({
        code: ErrorCode.CONFLICT,
        message: `Role with ID '${id}' already exists`,
        statusCode: 409,
      });
    }

    // Validate parent roles exist and check for circular inheritance
    if (input.parentRoles && input.parentRoles.length > 0) {
      this.validateParentRoles(input.parentRoles, id, input.tenantId);
    }

    const now = new Date();
    const role: Role = {
      id,
      name: input.name,
      description: input.description,
      permissions: input.permissions || [],
      parentRoles: input.parentRoles,
      isSystem: input.isSystem || false,
      maxAssignments: input.maxAssignments,
      metadata: input.metadata,
      tenantId: input.tenantId,
      createdAt: now,
      updatedAt: now,
    };

    this.roles.set(this.getKey(id, input.tenantId), role);
    return role;
  }

  /**
   * Get a role by ID
   */
  getRole(id: string, tenantId?: string): Role | null {
    return this.roles.get(this.getKey(id, tenantId)) || null;
  }

  /**
   * Get all roles (optionally filtered by tenant)
   */
  getRoles(tenantId?: string): Role[] {
    const roles: Role[] = [];
    for (const role of this.roles.values()) {
      if (!tenantId || role.tenantId === tenantId) {
        roles.push(role);
      }
    }
    return roles;
  }

  /**
   * Update a role
   */
  updateRole(
    id: string,
    updates: UpdateRoleInput,
    tenantId?: string
  ): Role | null {
    const key = this.getKey(id, tenantId);
    const existing = this.roles.get(key);

    if (!existing) {
      return null;
    }

    // Check if it's a system role
    if (existing.isSystem && (updates.name || updates.permissions)) {
      throw new ForgeError({
        code: ErrorCode.FORBIDDEN,
        message: 'Cannot modify core properties of system roles',
        statusCode: 403,
      });
    }

    // Validate parent roles if being updated
    if (updates.parentRoles) {
      this.validateParentRoles(updates.parentRoles, id, tenantId);
    }

    const updated: Role = {
      ...existing,
      ...updates,
      id: existing.id,
      tenantId: existing.tenantId,
      isSystem: existing.isSystem,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    };

    this.roles.set(key, updated);
    return updated;
  }

  /**
   * Delete a role
   */
  deleteRole(id: string, tenantId?: string): boolean {
    const key = this.getKey(id, tenantId);
    const role = this.roles.get(key);

    if (!role) {
      return false;
    }

    // Check if it's a system role
    if (role.isSystem) {
      throw new ForgeError({
        code: ErrorCode.FORBIDDEN,
        message: 'Cannot delete system roles',
        statusCode: 403,
      });
    }

    // Check if any other roles inherit from this role
    for (const r of this.roles.values()) {
      if (r.parentRoles?.includes(id)) {
        throw new ForgeError({
          code: ErrorCode.CONFLICT,
          message: `Cannot delete role '${id}' as it is inherited by role '${r.id}'`,
          statusCode: 409,
        });
      }
    }

    // Remove all assignments for this role
    for (const [userId, userAssignments] of this.assignments.entries()) {
      const filtered = userAssignments.filter(
        (a) => !(a.roleId === id && a.tenantId === (tenantId || a.tenantId))
      );
      if (filtered.length !== userAssignments.length) {
        this.assignments.set(userId, filtered);
      }
    }

    return this.roles.delete(key);
  }

  /**
   * Add permission to role
   */
  addPermissionToRole(
    roleId: string,
    permissionId: string,
    tenantId?: string
  ): Role | null {
    const role = this.getRole(roleId, tenantId);
    if (!role) {
      return null;
    }

    if (!role.permissions.includes(permissionId)) {
      return this.updateRole(
        roleId,
        { permissions: [...role.permissions, permissionId] },
        tenantId
      );
    }

    return role;
  }

  /**
   * Remove permission from role
   */
  removePermissionFromRole(
    roleId: string,
    permissionId: string,
    tenantId?: string
  ): Role | null {
    const role = this.getRole(roleId, tenantId);
    if (!role) {
      return null;
    }

    const newPermissions = role.permissions.filter((p) => p !== permissionId);
    if (newPermissions.length !== role.permissions.length) {
      return this.updateRole(roleId, { permissions: newPermissions }, tenantId);
    }

    return role;
  }

  /**
   * Get all permissions for a role (including inherited)
   */
  getEffectivePermissions(roleId: string, tenantId?: string): string[] {
    return this.collectPermissions(roleId, tenantId, new Set(), 0);
  }

  /**
   * Recursively collect permissions from role and parents
   */
  private collectPermissions(
    roleId: string,
    tenantId: string | undefined,
    visited: Set<string>,
    depth: number
  ): string[] {
    if (depth > this.maxInheritanceDepth) {
      throw new ForgeError({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Maximum role inheritance depth exceeded',
        statusCode: 500,
      });
    }

    const key = this.getKey(roleId, tenantId);
    if (visited.has(key)) {
      return []; // Circular reference, skip
    }
    visited.add(key);

    const role = this.roles.get(key);
    if (!role) {
      return [];
    }

    const permissions = new Set<string>(role.permissions);

    // Collect from parent roles
    if (role.parentRoles) {
      for (const parentId of role.parentRoles) {
        const parentPermissions = this.collectPermissions(
          parentId,
          tenantId,
          visited,
          depth + 1
        );
        for (const perm of parentPermissions) {
          permissions.add(perm);
        }
      }
    }

    return Array.from(permissions);
  }

  /**
   * Assign a role to a user
   */
  assignRole(input: AssignRoleInput): UserRoleAssignment {
    // Validate role exists
    const role = this.getRole(input.roleId, input.tenantId);
    if (!role) {
      throw new ForgeError({
        code: ErrorCode.NOT_FOUND,
        message: `Role '${input.roleId}' not found`,
        statusCode: 404,
      });
    }

    // Check max assignments
    if (role.maxAssignments !== undefined) {
      const currentCount = this.getUsersWithRole(input.roleId, input.tenantId).length;
      if (currentCount >= role.maxAssignments) {
        throw new ForgeError({
          code: ErrorCode.FORBIDDEN,
          message: `Role '${input.roleId}' has reached maximum assignments (${role.maxAssignments})`,
          statusCode: 403,
        });
      }
    }

    // Check if already assigned
    const userAssignments = this.assignments.get(input.userId) || [];
    const existing = userAssignments.find(
      (a) =>
        a.roleId === input.roleId &&
        a.tenantId === input.tenantId &&
        a.scope === input.scope
    );

    if (existing) {
      throw new ForgeError({
        code: ErrorCode.CONFLICT,
        message: `User '${input.userId}' already has role '${input.roleId}'`,
        statusCode: 409,
      });
    }

    const assignment: UserRoleAssignment = {
      userId: input.userId,
      roleId: input.roleId,
      tenantId: input.tenantId,
      scope: input.scope,
      expiresAt: input.expiresAt,
      metadata: input.metadata,
      assignedBy: input.assignedBy,
      assignedAt: new Date(),
    };

    userAssignments.push(assignment);
    this.assignments.set(input.userId, userAssignments);

    return assignment;
  }

  /**
   * Unassign a role from a user
   */
  unassignRole(
    userId: string,
    roleId: string,
    tenantId: string,
    scope?: string
  ): boolean {
    const userAssignments = this.assignments.get(userId);
    if (!userAssignments) {
      return false;
    }

    const filtered = userAssignments.filter(
      (a) =>
        !(
          a.roleId === roleId &&
          a.tenantId === tenantId &&
          (scope === undefined || a.scope === scope)
        )
    );

    if (filtered.length === userAssignments.length) {
      return false;
    }

    this.assignments.set(userId, filtered);
    return true;
  }

  /**
   * Get user's role assignments
   */
  getUserRoles(userId: string, tenantId: string): UserRoleAssignment[] {
    const userAssignments = this.assignments.get(userId) || [];
    const now = new Date();

    // Filter by tenant and check expiration
    return userAssignments.filter(
      (a) =>
        a.tenantId === tenantId &&
        (!a.expiresAt || a.expiresAt > now)
    );
  }

  /**
   * Get all users with a specific role
   */
  getUsersWithRole(roleId: string, tenantId: string): UserRoleAssignment[] {
    const result: UserRoleAssignment[] = [];
    const now = new Date();

    for (const userAssignments of this.assignments.values()) {
      for (const assignment of userAssignments) {
        if (
          assignment.roleId === roleId &&
          assignment.tenantId === tenantId &&
          (!assignment.expiresAt || assignment.expiresAt > now)
        ) {
          result.push(assignment);
        }
      }
    }

    return result;
  }

  /**
   * Check if user has a specific role
   */
  userHasRole(
    userId: string,
    roleId: string,
    tenantId: string,
    scope?: string
  ): boolean {
    const assignments = this.getUserRoles(userId, tenantId);
    return assignments.some(
      (a) =>
        a.roleId === roleId &&
        (scope === undefined || a.scope === scope || a.scope === undefined)
    );
  }

  /**
   * Get all effective permissions for a user
   */
  getUserEffectivePermissions(userId: string, tenantId: string): string[] {
    const assignments = this.getUserRoles(userId, tenantId);
    const permissions = new Set<string>();

    for (const assignment of assignments) {
      const rolePermissions = this.getEffectivePermissions(
        assignment.roleId,
        tenantId
      );
      for (const perm of rolePermissions) {
        permissions.add(perm);
      }
    }

    return Array.from(permissions);
  }

  /**
   * Validate parent roles and check for circular inheritance
   */
  private validateParentRoles(
    parentRoles: string[],
    roleId: string,
    tenantId?: string
  ): void {
    for (const parentId of parentRoles) {
      const parent = this.getRole(parentId, tenantId);
      if (!parent) {
        throw new ForgeError({
          code: ErrorCode.NOT_FOUND,
          message: `Parent role '${parentId}' not found`,
          statusCode: 404,
        });
      }

      // Check for circular inheritance
      if (this.wouldCreateCircularInheritance(parentId, roleId, tenantId)) {
        throw new ForgeError({
          code: ErrorCode.VALIDATION_FAILED,
          message: `Adding parent role '${parentId}' would create circular inheritance`,
          statusCode: 400,
        });
      }
    }
  }

  /**
   * Check if adding a parent would create circular inheritance
   */
  private wouldCreateCircularInheritance(
    parentId: string,
    childId: string,
    tenantId?: string,
    visited: Set<string> = new Set()
  ): boolean {
    if (parentId === childId) {
      return true;
    }

    const key = this.getKey(parentId, tenantId);
    if (visited.has(key)) {
      return false;
    }
    visited.add(key);

    const parent = this.roles.get(key);
    if (!parent || !parent.parentRoles) {
      return false;
    }

    for (const grandparentId of parent.parentRoles) {
      if (
        grandparentId === childId ||
        this.wouldCreateCircularInheritance(grandparentId, childId, tenantId, visited)
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Validate role input
   */
  private validateRoleInput(input: CreateRoleInput): void {
    if (!input.name || input.name.trim().length === 0) {
      throw new ForgeError({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'Role name is required',
        statusCode: 400,
      });
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
    return `role_${timestamp}_${random}`;
  }

  /**
   * Clear all data (for testing)
   */
  clear(): void {
    this.roles.clear();
    this.assignments.clear();
  }

  /**
   * Import roles (for initialization)
   */
  importRoles(roles: Role[]): void {
    for (const role of roles) {
      this.roles.set(this.getKey(role.id, role.tenantId), role);
    }
  }

  /**
   * Import assignments (for initialization)
   */
  importAssignments(assignments: UserRoleAssignment[]): void {
    for (const assignment of assignments) {
      const userAssignments = this.assignments.get(assignment.userId) || [];
      userAssignments.push(assignment);
      this.assignments.set(assignment.userId, userAssignments);
    }
  }

  /**
   * Create default system roles
   */
  createSystemRoles(tenantId?: string): Role[] {
    const now = new Date();
    const systemRoles: Role[] = [
      {
        id: SYSTEM_ROLES.SUPER_ADMIN,
        name: 'Super Administrator',
        description: 'Full system access',
        permissions: ['*'],
        isSystem: true,
        tenantId,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: SYSTEM_ROLES.ADMIN,
        name: 'Administrator',
        description: 'Administrative access',
        permissions: [],
        parentRoles: [],
        isSystem: true,
        tenantId,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: SYSTEM_ROLES.USER,
        name: 'User',
        description: 'Standard user access',
        permissions: [],
        isSystem: true,
        tenantId,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: SYSTEM_ROLES.GUEST,
        name: 'Guest',
        description: 'Limited guest access',
        permissions: [],
        isSystem: true,
        tenantId,
        createdAt: now,
        updatedAt: now,
      },
    ];

    for (const role of systemRoles) {
      const key = this.getKey(role.id, role.tenantId);
      if (!this.roles.has(key)) {
        this.roles.set(key, role);
      }
    }

    return systemRoles;
  }
}

/**
 * Singleton instance
 */
let roleManagerInstance: RoleManager | null = null;

/**
 * Get the singleton role manager instance
 */
export function getRoleManager(maxInheritanceDepth?: number): RoleManager {
  if (!roleManagerInstance) {
    roleManagerInstance = new RoleManager(maxInheritanceDepth);
  }
  return roleManagerInstance;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetRoleManager(): void {
  roleManagerInstance = null;
}
