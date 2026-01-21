/**
 * @package @forge/roles
 * @description Permission management and validation
 */

import { ErrorCode, ForgeError } from '@forge/errors';
import {
  Permission,
  CreatePermissionInput,
  UpdatePermissionInput,
  PermissionCondition,
  TimeCondition,
  AuthorizationContext,
  ConditionOperator,
  DEFAULT_PERMISSION_PRIORITY,
  RESOURCE_WILDCARD,
  ACTION_WILDCARD,
} from './roles.types';

/**
 * Permission manager class
 */
export class PermissionManager {
  private permissions: Map<string, Permission> = new Map();

  /**
   * Create a new permission
   */
  createPermission(input: CreatePermissionInput): Permission {
    const id = input.id || this.generateId();

    // Validate input
    this.validatePermissionInput(input);

    // Check for duplicate
    if (this.permissions.has(this.getKey(id, input.tenantId))) {
      throw new ForgeError({
        code: ErrorCode.CONFLICT,
        message: `Permission with ID '${id}' already exists`,
        statusCode: 409,
      });
    }

    const now = new Date();
    const permission: Permission = {
      id,
      name: input.name,
      description: input.description,
      resource: input.resource,
      actions: input.actions,
      effect: input.effect || 'allow',
      conditions: input.conditions,
      timeConditions: input.timeConditions,
      priority: input.priority ?? DEFAULT_PERMISSION_PRIORITY,
      metadata: input.metadata,
      tenantId: input.tenantId,
      createdAt: now,
      updatedAt: now,
    };

    this.permissions.set(this.getKey(id, input.tenantId), permission);
    return permission;
  }

  /**
   * Get a permission by ID
   */
  getPermission(id: string, tenantId?: string): Permission | null {
    return this.permissions.get(this.getKey(id, tenantId)) || null;
  }

  /**
   * Get all permissions (optionally filtered by tenant)
   */
  getPermissions(tenantId?: string): Permission[] {
    const permissions: Permission[] = [];
    for (const permission of this.permissions.values()) {
      if (!tenantId || permission.tenantId === tenantId) {
        permissions.push(permission);
      }
    }
    return permissions;
  }

  /**
   * Update a permission
   */
  updatePermission(
    id: string,
    updates: UpdatePermissionInput,
    tenantId?: string
  ): Permission | null {
    const key = this.getKey(id, tenantId);
    const existing = this.permissions.get(key);

    if (!existing) {
      return null;
    }

    // Validate updates
    if (updates.resource || updates.actions) {
      this.validatePermissionInput({
        ...existing,
        ...updates,
        name: updates.name || existing.name,
        resource: updates.resource || existing.resource,
        actions: updates.actions || existing.actions,
      });
    }

    const updated: Permission = {
      ...existing,
      ...updates,
      id: existing.id,
      tenantId: existing.tenantId,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    };

    this.permissions.set(key, updated);
    return updated;
  }

  /**
   * Delete a permission
   */
  deletePermission(id: string, tenantId?: string): boolean {
    return this.permissions.delete(this.getKey(id, tenantId));
  }

  /**
   * Check if a permission matches a context
   */
  matchesContext(
    permission: Permission,
    context: AuthorizationContext
  ): boolean {
    // Check resource match
    if (!this.matchesResource(permission.resource, context.resource)) {
      return false;
    }

    // Check action match
    if (!this.matchesAction(permission.actions, context.action)) {
      return false;
    }

    // Check tenant match
    if (permission.tenantId && permission.tenantId !== context.tenantId) {
      return false;
    }

    // Check attribute conditions
    if (permission.conditions && permission.conditions.length > 0) {
      if (!this.evaluateConditions(permission.conditions, context)) {
        return false;
      }
    }

    // Check time conditions
    if (permission.timeConditions) {
      if (!this.evaluateTimeCondition(permission.timeConditions)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if a resource pattern matches a resource
   */
  matchesResource(pattern: string, resource: string): boolean {
    if (pattern === RESOURCE_WILDCARD) {
      return true;
    }

    // Support glob patterns (e.g., "documents:*", "projects:123:*")
    if (pattern.includes('*')) {
      const regexPattern = pattern
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*');
      return new RegExp(`^${regexPattern}$`).test(resource);
    }

    return pattern === resource;
  }

  /**
   * Check if actions include the requested action
   */
  matchesAction(
    permittedActions: string[],
    requestedAction: string
  ): boolean {
    if (permittedActions.includes(ACTION_WILDCARD)) {
      return true;
    }
    return permittedActions.includes(requestedAction);
  }

  /**
   * Evaluate attribute-based conditions
   */
  evaluateConditions(
    conditions: PermissionCondition[],
    context: AuthorizationContext
  ): boolean {
    // All conditions must be true (AND logic)
    return conditions.every((condition) =>
      this.evaluateCondition(condition, context)
    );
  }

  /**
   * Evaluate a single condition
   */
  evaluateCondition(
    condition: PermissionCondition,
    context: AuthorizationContext
  ): boolean {
    // Get the field value from context
    const fieldValue = this.getFieldValue(condition.field, context);
    let compareValue = condition.value;

    // Resolve variable references
    if (condition.isVariable && typeof compareValue === 'string') {
      compareValue = this.resolveVariable(compareValue, context);
    }

    return this.evaluateOperator(
      condition.operator,
      fieldValue,
      compareValue
    );
  }

  /**
   * Get field value from context
   */
  private getFieldValue(field: string, context: AuthorizationContext): unknown {
    const parts = field.split('.');
    let value: unknown = context;

    for (const part of parts) {
      if (value === null || value === undefined) {
        return undefined;
      }
      if (typeof value === 'object') {
        value = (value as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Resolve variable reference (e.g., ${user.id})
   */
  private resolveVariable(variable: string, context: AuthorizationContext): unknown {
    const match = variable.match(/^\$\{(.+)\}$/);
    if (!match) {
      return variable;
    }
    return this.getFieldValue(match[1], context);
  }

  /**
   * Evaluate operator
   */
  private evaluateOperator(
    operator: ConditionOperator,
    fieldValue: unknown,
    compareValue: unknown
  ): boolean {
    switch (operator) {
      case 'equals':
        return fieldValue === compareValue;

      case 'notEquals':
        return fieldValue !== compareValue;

      case 'contains':
        if (typeof fieldValue === 'string' && typeof compareValue === 'string') {
          return fieldValue.includes(compareValue);
        }
        if (Array.isArray(fieldValue)) {
          return fieldValue.includes(compareValue);
        }
        return false;

      case 'notContains':
        if (typeof fieldValue === 'string' && typeof compareValue === 'string') {
          return !fieldValue.includes(compareValue);
        }
        if (Array.isArray(fieldValue)) {
          return !fieldValue.includes(compareValue);
        }
        return true;

      case 'startsWith':
        if (typeof fieldValue === 'string' && typeof compareValue === 'string') {
          return fieldValue.startsWith(compareValue);
        }
        return false;

      case 'endsWith':
        if (typeof fieldValue === 'string' && typeof compareValue === 'string') {
          return fieldValue.endsWith(compareValue);
        }
        return false;

      case 'greaterThan':
        return Number(fieldValue) > Number(compareValue);

      case 'lessThan':
        return Number(fieldValue) < Number(compareValue);

      case 'greaterThanOrEqual':
        return Number(fieldValue) >= Number(compareValue);

      case 'lessThanOrEqual':
        return Number(fieldValue) <= Number(compareValue);

      case 'in':
        if (Array.isArray(compareValue)) {
          return compareValue.includes(fieldValue);
        }
        return false;

      case 'notIn':
        if (Array.isArray(compareValue)) {
          return !compareValue.includes(fieldValue);
        }
        return true;

      case 'exists':
        return fieldValue !== undefined && fieldValue !== null;

      case 'notExists':
        return fieldValue === undefined || fieldValue === null;

      case 'between':
        if (Array.isArray(compareValue) && compareValue.length === 2) {
          const numValue = Number(fieldValue);
          return numValue >= Number(compareValue[0]) && numValue <= Number(compareValue[1]);
        }
        return false;

      case 'regex':
        if (typeof fieldValue === 'string' && typeof compareValue === 'string') {
          try {
            return new RegExp(compareValue).test(fieldValue);
          } catch {
            return false;
          }
        }
        return false;

      default:
        return false;
    }
  }

  /**
   * Evaluate time-based condition
   */
  evaluateTimeCondition(condition: TimeCondition): boolean {
    const now = new Date();

    // Get time in the specified timezone
    let currentTime = now;
    if (condition.timezone) {
      try {
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: condition.timezone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        });
        const parts = formatter.formatToParts(now);
        const getPart = (type: string) =>
          parts.find((p) => p.type === type)?.value || '0';
        currentTime = new Date(
          `${getPart('year')}-${getPart('month')}-${getPart('day')}T${getPart('hour')}:${getPart('minute')}:${getPart('second')}`
        );
      } catch {
        // Invalid timezone, use UTC
      }
    }

    // Check start time
    if (condition.startTime) {
      const startTime = new Date(condition.startTime);
      if (currentTime < startTime) {
        return false;
      }
    }

    // Check end time
    if (condition.endTime) {
      const endTime = new Date(condition.endTime);
      if (currentTime > endTime) {
        return false;
      }
    }

    // Check days of week
    if (condition.daysOfWeek && condition.daysOfWeek.length > 0) {
      const currentDay = currentTime.getDay();
      if (!condition.daysOfWeek.includes(currentDay)) {
        return false;
      }
    }

    // Check hours of day
    if (condition.hoursOfDay && condition.hoursOfDay.length > 0) {
      const currentHour = currentTime.getHours();
      if (!condition.hoursOfDay.includes(currentHour)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Validate permission input
   */
  private validatePermissionInput(input: CreatePermissionInput): void {
    if (!input.name || input.name.trim().length === 0) {
      throw new ForgeError({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'Permission name is required',
        statusCode: 400,
      });
    }

    if (!input.resource || input.resource.trim().length === 0) {
      throw new ForgeError({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'Permission resource is required',
        statusCode: 400,
      });
    }

    if (!input.actions || input.actions.length === 0) {
      throw new ForgeError({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'Permission must have at least one action',
        statusCode: 400,
      });
    }

    // Validate conditions
    if (input.conditions) {
      for (const condition of input.conditions) {
        if (!condition.field) {
          throw new ForgeError({
            code: ErrorCode.VALIDATION_FAILED,
            message: 'Condition field is required',
            statusCode: 400,
          });
        }
        if (!condition.operator) {
          throw new ForgeError({
            code: ErrorCode.VALIDATION_FAILED,
            message: 'Condition operator is required',
            statusCode: 400,
          });
        }
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
    return `perm_${timestamp}_${random}`;
  }

  /**
   * Clear all permissions (for testing)
   */
  clear(): void {
    this.permissions.clear();
  }

  /**
   * Import permissions (for initialization)
   */
  importPermissions(permissions: Permission[]): void {
    for (const permission of permissions) {
      this.permissions.set(
        this.getKey(permission.id, permission.tenantId),
        permission
      );
    }
  }
}

/**
 * Singleton instance
 */
let permissionManagerInstance: PermissionManager | null = null;

/**
 * Get the singleton permission manager instance
 */
export function getPermissionManager(): PermissionManager {
  if (!permissionManagerInstance) {
    permissionManagerInstance = new PermissionManager();
  }
  return permissionManagerInstance;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetPermissionManager(): void {
  permissionManagerInstance = null;
}
