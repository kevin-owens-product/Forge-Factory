/**
 * @package @forge/roles
 * @description Tests for PermissionManager
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  PermissionManager,
  getPermissionManager,
  resetPermissionManager,
} from '../permission';
import { Permission, AuthorizationContext } from '../roles.types';

describe('PermissionManager', () => {
  let manager: PermissionManager;

  beforeEach(() => {
    resetPermissionManager();
    manager = new PermissionManager();
  });

  describe('createPermission', () => {
    it('should create a permission with all fields', () => {
      const permission = manager.createPermission({
        id: 'perm-1',
        name: 'Read Documents',
        description: 'Allow reading documents',
        resource: 'documents',
        actions: ['read'],
        effect: 'allow',
        tenantId: 'tenant-1',
      });

      expect(permission.id).toBe('perm-1');
      expect(permission.name).toBe('Read Documents');
      expect(permission.description).toBe('Allow reading documents');
      expect(permission.resource).toBe('documents');
      expect(permission.actions).toEqual(['read']);
      expect(permission.effect).toBe('allow');
      expect(permission.tenantId).toBe('tenant-1');
      expect(permission.createdAt).toBeInstanceOf(Date);
      expect(permission.updatedAt).toBeInstanceOf(Date);
    });

    it('should generate an ID if not provided', () => {
      const permission = manager.createPermission({
        name: 'Test Permission',
        resource: 'test',
        actions: ['read'],
      });

      expect(permission.id).toMatch(/^perm_/);
    });

    it('should default effect to allow', () => {
      const permission = manager.createPermission({
        name: 'Test Permission',
        resource: 'test',
        actions: ['read'],
      });

      expect(permission.effect).toBe('allow');
    });

    it('should throw error for duplicate permission ID', () => {
      manager.createPermission({
        id: 'perm-1',
        name: 'Permission 1',
        resource: 'test',
        actions: ['read'],
        tenantId: 'tenant-1',
      });

      expect(() => {
        manager.createPermission({
          id: 'perm-1',
          name: 'Permission 1 Duplicate',
          resource: 'test',
          actions: ['read'],
          tenantId: 'tenant-1',
        });
      }).toThrow("Permission with ID 'perm-1' already exists");
    });

    it('should allow same ID in different tenants', () => {
      const perm1 = manager.createPermission({
        id: 'perm-1',
        name: 'Permission 1',
        resource: 'test',
        actions: ['read'],
        tenantId: 'tenant-1',
      });

      const perm2 = manager.createPermission({
        id: 'perm-1',
        name: 'Permission 1',
        resource: 'test',
        actions: ['read'],
        tenantId: 'tenant-2',
      });

      expect(perm1.tenantId).toBe('tenant-1');
      expect(perm2.tenantId).toBe('tenant-2');
    });

    it('should throw error for missing name', () => {
      expect(() => {
        manager.createPermission({
          name: '',
          resource: 'test',
          actions: ['read'],
        });
      }).toThrow('Permission name is required');
    });

    it('should throw error for missing resource', () => {
      expect(() => {
        manager.createPermission({
          name: 'Test',
          resource: '',
          actions: ['read'],
        });
      }).toThrow('Permission resource is required');
    });

    it('should throw error for empty actions', () => {
      expect(() => {
        manager.createPermission({
          name: 'Test',
          resource: 'test',
          actions: [],
        });
      }).toThrow('Permission must have at least one action');
    });

    it('should validate condition fields', () => {
      expect(() => {
        manager.createPermission({
          name: 'Test',
          resource: 'test',
          actions: ['read'],
          conditions: [{ field: '', operator: 'equals', value: 'test' }],
        });
      }).toThrow('Condition field is required');
    });

    it('should validate condition operators', () => {
      expect(() => {
        manager.createPermission({
          name: 'Test',
          resource: 'test',
          actions: ['read'],
          conditions: [{ field: 'test', operator: '' as any, value: 'test' }],
        });
      }).toThrow('Condition operator is required');
    });
  });

  describe('getPermission', () => {
    it('should retrieve a permission by ID', () => {
      manager.createPermission({
        id: 'perm-1',
        name: 'Test Permission',
        resource: 'test',
        actions: ['read'],
      });

      const permission = manager.getPermission('perm-1');
      expect(permission?.id).toBe('perm-1');
    });

    it('should return null for non-existent permission', () => {
      const permission = manager.getPermission('non-existent');
      expect(permission).toBeNull();
    });

    it('should retrieve permission with tenant isolation', () => {
      manager.createPermission({
        id: 'perm-1',
        name: 'Test Permission',
        resource: 'test',
        actions: ['read'],
        tenantId: 'tenant-1',
      });

      expect(manager.getPermission('perm-1', 'tenant-1')?.id).toBe('perm-1');
      expect(manager.getPermission('perm-1', 'tenant-2')).toBeNull();
    });
  });

  describe('getPermissions', () => {
    it('should get all permissions', () => {
      manager.createPermission({
        id: 'perm-1',
        name: 'Permission 1',
        resource: 'test',
        actions: ['read'],
      });
      manager.createPermission({
        id: 'perm-2',
        name: 'Permission 2',
        resource: 'test',
        actions: ['write'],
      });

      const permissions = manager.getPermissions();
      expect(permissions.length).toBe(2);
    });

    it('should filter by tenant', () => {
      manager.createPermission({
        id: 'perm-1',
        name: 'Permission 1',
        resource: 'test',
        actions: ['read'],
        tenantId: 'tenant-1',
      });
      manager.createPermission({
        id: 'perm-2',
        name: 'Permission 2',
        resource: 'test',
        actions: ['write'],
        tenantId: 'tenant-2',
      });

      const tenant1Permissions = manager.getPermissions('tenant-1');
      expect(tenant1Permissions.length).toBe(1);
      expect(tenant1Permissions[0].id).toBe('perm-1');
    });
  });

  describe('updatePermission', () => {
    it('should update permission fields', () => {
      manager.createPermission({
        id: 'perm-1',
        name: 'Original Name',
        resource: 'test',
        actions: ['read'],
      });

      const updated = manager.updatePermission('perm-1', {
        name: 'Updated Name',
        description: 'Added description',
      });

      expect(updated?.name).toBe('Updated Name');
      expect(updated?.description).toBe('Added description');
      expect(updated?.updatedAt.getTime()).toBeGreaterThan(
        updated!.createdAt.getTime() - 1
      );
    });

    it('should return null for non-existent permission', () => {
      const updated = manager.updatePermission('non-existent', { name: 'Test' });
      expect(updated).toBeNull();
    });

    it('should preserve immutable fields', () => {
      const original = manager.createPermission({
        id: 'perm-1',
        name: 'Test',
        resource: 'test',
        actions: ['read'],
        tenantId: 'tenant-1',
      });

      const updated = manager.updatePermission('perm-1', {
        name: 'Updated',
      }, 'tenant-1');

      expect(updated?.id).toBe(original.id);
      expect(updated?.tenantId).toBe(original.tenantId);
      expect(updated?.createdAt).toEqual(original.createdAt);
    });
  });

  describe('deletePermission', () => {
    it('should delete a permission', () => {
      manager.createPermission({
        id: 'perm-1',
        name: 'Test',
        resource: 'test',
        actions: ['read'],
      });

      const result = manager.deletePermission('perm-1');
      expect(result).toBe(true);
      expect(manager.getPermission('perm-1')).toBeNull();
    });

    it('should return false for non-existent permission', () => {
      const result = manager.deletePermission('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('matchesResource', () => {
    it('should match exact resource', () => {
      expect(manager.matchesResource('documents', 'documents')).toBe(true);
      expect(manager.matchesResource('documents', 'projects')).toBe(false);
    });

    it('should match wildcard resource', () => {
      expect(manager.matchesResource('*', 'documents')).toBe(true);
      expect(manager.matchesResource('*', 'anything')).toBe(true);
    });

    it('should match glob patterns', () => {
      expect(manager.matchesResource('documents:*', 'documents:123')).toBe(true);
      expect(manager.matchesResource('documents:*', 'documents:abc')).toBe(true);
      expect(manager.matchesResource('documents:*', 'projects:123')).toBe(false);
      expect(manager.matchesResource('projects:*:tasks', 'projects:123:tasks')).toBe(true);
    });
  });

  describe('matchesAction', () => {
    it('should match specific action', () => {
      expect(manager.matchesAction(['read'], 'read')).toBe(true);
      expect(manager.matchesAction(['read'], 'write')).toBe(false);
    });

    it('should match wildcard action', () => {
      expect(manager.matchesAction(['*'], 'read')).toBe(true);
      expect(manager.matchesAction(['*'], 'write')).toBe(true);
    });

    it('should match any of multiple actions', () => {
      expect(manager.matchesAction(['read', 'write'], 'read')).toBe(true);
      expect(manager.matchesAction(['read', 'write'], 'write')).toBe(true);
      expect(manager.matchesAction(['read', 'write'], 'delete')).toBe(false);
    });
  });

  describe('matchesContext', () => {
    it('should match permission to context', () => {
      const permission = manager.createPermission({
        id: 'perm-1',
        name: 'Read Documents',
        resource: 'documents',
        actions: ['read'],
        tenantId: 'tenant-1',
      });

      const context: AuthorizationContext = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        resource: 'documents',
        action: 'read',
      };

      expect(manager.matchesContext(permission, context)).toBe(true);
    });

    it('should not match different resource', () => {
      const permission = manager.createPermission({
        id: 'perm-1',
        name: 'Read Documents',
        resource: 'documents',
        actions: ['read'],
      });

      const context: AuthorizationContext = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        resource: 'projects',
        action: 'read',
      };

      expect(manager.matchesContext(permission, context)).toBe(false);
    });

    it('should not match different action', () => {
      const permission = manager.createPermission({
        id: 'perm-1',
        name: 'Read Documents',
        resource: 'documents',
        actions: ['read'],
      });

      const context: AuthorizationContext = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        resource: 'documents',
        action: 'write',
      };

      expect(manager.matchesContext(permission, context)).toBe(false);
    });

    it('should not match different tenant', () => {
      const permission = manager.createPermission({
        id: 'perm-1',
        name: 'Read Documents',
        resource: 'documents',
        actions: ['read'],
        tenantId: 'tenant-1',
      });

      const context: AuthorizationContext = {
        userId: 'user-1',
        tenantId: 'tenant-2',
        resource: 'documents',
        action: 'read',
      };

      expect(manager.matchesContext(permission, context)).toBe(false);
    });
  });

  describe('evaluateConditions', () => {
    it('should evaluate equals condition', () => {
      const context: AuthorizationContext = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        resource: 'documents',
        action: 'read',
        userAttributes: { department: 'engineering' },
      };

      const conditions = [
        { field: 'userAttributes.department', operator: 'equals' as const, value: 'engineering' },
      ];

      expect(manager.evaluateConditions(conditions, context)).toBe(true);
    });

    it('should evaluate notEquals condition', () => {
      const context: AuthorizationContext = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        resource: 'documents',
        action: 'read',
        userAttributes: { department: 'engineering' },
      };

      const conditions = [
        { field: 'userAttributes.department', operator: 'notEquals' as const, value: 'sales' },
      ];

      expect(manager.evaluateConditions(conditions, context)).toBe(true);
    });

    it('should evaluate contains condition for strings', () => {
      const context: AuthorizationContext = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        resource: 'documents',
        action: 'read',
        userAttributes: { email: 'user@example.com' },
      };

      const conditions = [
        { field: 'userAttributes.email', operator: 'contains' as const, value: 'example' },
      ];

      expect(manager.evaluateConditions(conditions, context)).toBe(true);
    });

    it('should evaluate contains condition for arrays', () => {
      const context: AuthorizationContext = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        resource: 'documents',
        action: 'read',
        userAttributes: { roles: ['admin', 'user'] },
      };

      const conditions = [
        { field: 'userAttributes.roles', operator: 'contains' as const, value: 'admin' },
      ];

      expect(manager.evaluateConditions(conditions, context)).toBe(true);
    });

    it('should evaluate notContains condition', () => {
      const context: AuthorizationContext = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        resource: 'documents',
        action: 'read',
        userAttributes: { email: 'user@example.com' },
      };

      const conditions = [
        { field: 'userAttributes.email', operator: 'notContains' as const, value: 'test' },
      ];

      expect(manager.evaluateConditions(conditions, context)).toBe(true);
    });

    it('should evaluate startsWith condition', () => {
      const context: AuthorizationContext = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        resource: 'documents',
        action: 'read',
        userAttributes: { path: '/home/user/docs' },
      };

      const conditions = [
        { field: 'userAttributes.path', operator: 'startsWith' as const, value: '/home' },
      ];

      expect(manager.evaluateConditions(conditions, context)).toBe(true);
    });

    it('should evaluate endsWith condition', () => {
      const context: AuthorizationContext = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        resource: 'documents',
        action: 'read',
        userAttributes: { filename: 'document.pdf' },
      };

      const conditions = [
        { field: 'userAttributes.filename', operator: 'endsWith' as const, value: '.pdf' },
      ];

      expect(manager.evaluateConditions(conditions, context)).toBe(true);
    });

    it('should evaluate greaterThan condition', () => {
      const context: AuthorizationContext = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        resource: 'documents',
        action: 'read',
        userAttributes: { accessLevel: 5 },
      };

      const conditions = [
        { field: 'userAttributes.accessLevel', operator: 'greaterThan' as const, value: 3 },
      ];

      expect(manager.evaluateConditions(conditions, context)).toBe(true);
    });

    it('should evaluate lessThan condition', () => {
      const context: AuthorizationContext = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        resource: 'documents',
        action: 'read',
        userAttributes: { accessLevel: 2 },
      };

      const conditions = [
        { field: 'userAttributes.accessLevel', operator: 'lessThan' as const, value: 5 },
      ];

      expect(manager.evaluateConditions(conditions, context)).toBe(true);
    });

    it('should evaluate greaterThanOrEqual condition', () => {
      const context: AuthorizationContext = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        resource: 'documents',
        action: 'read',
        userAttributes: { accessLevel: 5 },
      };

      expect(manager.evaluateConditions(
        [{ field: 'userAttributes.accessLevel', operator: 'greaterThanOrEqual', value: 5 }],
        context
      )).toBe(true);

      expect(manager.evaluateConditions(
        [{ field: 'userAttributes.accessLevel', operator: 'greaterThanOrEqual', value: 6 }],
        context
      )).toBe(false);
    });

    it('should evaluate lessThanOrEqual condition', () => {
      const context: AuthorizationContext = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        resource: 'documents',
        action: 'read',
        userAttributes: { accessLevel: 5 },
      };

      expect(manager.evaluateConditions(
        [{ field: 'userAttributes.accessLevel', operator: 'lessThanOrEqual', value: 5 }],
        context
      )).toBe(true);

      expect(manager.evaluateConditions(
        [{ field: 'userAttributes.accessLevel', operator: 'lessThanOrEqual', value: 4 }],
        context
      )).toBe(false);
    });

    it('should evaluate in condition', () => {
      const context: AuthorizationContext = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        resource: 'documents',
        action: 'read',
        userAttributes: { department: 'engineering' },
      };

      const conditions = [
        { field: 'userAttributes.department', operator: 'in' as const, value: ['engineering', 'product'] },
      ];

      expect(manager.evaluateConditions(conditions, context)).toBe(true);
    });

    it('should evaluate notIn condition', () => {
      const context: AuthorizationContext = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        resource: 'documents',
        action: 'read',
        userAttributes: { department: 'engineering' },
      };

      const conditions = [
        { field: 'userAttributes.department', operator: 'notIn' as const, value: ['sales', 'marketing'] },
      ];

      expect(manager.evaluateConditions(conditions, context)).toBe(true);
    });

    it('should evaluate exists condition', () => {
      const context: AuthorizationContext = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        resource: 'documents',
        action: 'read',
        userAttributes: { department: 'engineering' },
      };

      expect(manager.evaluateConditions(
        [{ field: 'userAttributes.department', operator: 'exists', value: true }],
        context
      )).toBe(true);

      expect(manager.evaluateConditions(
        [{ field: 'userAttributes.missing', operator: 'exists', value: true }],
        context
      )).toBe(false);
    });

    it('should evaluate notExists condition', () => {
      const context: AuthorizationContext = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        resource: 'documents',
        action: 'read',
        userAttributes: {},
      };

      expect(manager.evaluateConditions(
        [{ field: 'userAttributes.missing', operator: 'notExists', value: true }],
        context
      )).toBe(true);
    });

    it('should evaluate between condition', () => {
      const context: AuthorizationContext = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        resource: 'documents',
        action: 'read',
        userAttributes: { accessLevel: 5 },
      };

      expect(manager.evaluateConditions(
        [{ field: 'userAttributes.accessLevel', operator: 'between', value: [3, 7] }],
        context
      )).toBe(true);

      expect(manager.evaluateConditions(
        [{ field: 'userAttributes.accessLevel', operator: 'between', value: [6, 10] }],
        context
      )).toBe(false);
    });

    it('should evaluate regex condition', () => {
      const context: AuthorizationContext = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        resource: 'documents',
        action: 'read',
        userAttributes: { email: 'user@example.com' },
      };

      expect(manager.evaluateConditions(
        [{ field: 'userAttributes.email', operator: 'regex', value: '^[a-z]+@example\\.com$' }],
        context
      )).toBe(true);

      expect(manager.evaluateConditions(
        [{ field: 'userAttributes.email', operator: 'regex', value: '^admin@' }],
        context
      )).toBe(false);
    });

    it('should handle invalid regex gracefully', () => {
      const context: AuthorizationContext = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        resource: 'documents',
        action: 'read',
        userAttributes: { email: 'user@example.com' },
      };

      expect(manager.evaluateConditions(
        [{ field: 'userAttributes.email', operator: 'regex', value: '[invalid regex' }],
        context
      )).toBe(false);
    });

    it('should resolve variable references', () => {
      const context: AuthorizationContext = {
        userId: 'user-123',
        tenantId: 'tenant-1',
        resource: 'documents',
        action: 'read',
        resourceAttributes: { ownerId: 'user-123' },
      };

      const conditions = [
        { field: 'resourceAttributes.ownerId', operator: 'equals' as const, value: '${userId}', isVariable: true },
      ];

      expect(manager.evaluateConditions(conditions, context)).toBe(true);
    });

    it('should require all conditions to be true', () => {
      const context: AuthorizationContext = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        resource: 'documents',
        action: 'read',
        userAttributes: { department: 'engineering', accessLevel: 5 },
      };

      const conditions = [
        { field: 'userAttributes.department', operator: 'equals' as const, value: 'engineering' },
        { field: 'userAttributes.accessLevel', operator: 'greaterThan' as const, value: 3 },
      ];

      expect(manager.evaluateConditions(conditions, context)).toBe(true);

      const failingConditions = [
        { field: 'userAttributes.department', operator: 'equals' as const, value: 'engineering' },
        { field: 'userAttributes.accessLevel', operator: 'greaterThan' as const, value: 10 },
      ];

      expect(manager.evaluateConditions(failingConditions, context)).toBe(false);
    });
  });

  describe('evaluateTimeCondition', () => {
    it('should pass when no time conditions specified', () => {
      expect(manager.evaluateTimeCondition({})).toBe(true);
    });

    it('should check start time', () => {
      const pastTime = new Date(Date.now() - 86400000).toISOString();
      const futureTime = new Date(Date.now() + 86400000).toISOString();

      expect(manager.evaluateTimeCondition({ startTime: pastTime })).toBe(true);
      expect(manager.evaluateTimeCondition({ startTime: futureTime })).toBe(false);
    });

    it('should check end time', () => {
      const pastTime = new Date(Date.now() - 86400000).toISOString();
      const futureTime = new Date(Date.now() + 86400000).toISOString();

      expect(manager.evaluateTimeCondition({ endTime: futureTime })).toBe(true);
      expect(manager.evaluateTimeCondition({ endTime: pastTime })).toBe(false);
    });

    it('should check days of week', () => {
      const today = new Date().getDay();
      expect(manager.evaluateTimeCondition({ daysOfWeek: [today] })).toBe(true);
      expect(manager.evaluateTimeCondition({ daysOfWeek: [(today + 1) % 7] })).toBe(false);
    });

    it('should check hours of day', () => {
      const currentHour = new Date().getHours();
      expect(manager.evaluateTimeCondition({ hoursOfDay: [currentHour] })).toBe(true);
      expect(manager.evaluateTimeCondition({ hoursOfDay: [(currentHour + 12) % 24] })).toBe(false);
    });

    it('should handle timezone conversion', () => {
      const result = manager.evaluateTimeCondition({
        timezone: 'America/New_York',
      });
      expect(typeof result).toBe('boolean');
    });

    it('should handle invalid timezone gracefully', () => {
      const result = manager.evaluateTimeCondition({
        timezone: 'Invalid/Timezone',
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      });
      expect(typeof result).toBe('boolean');
    });
  });

  describe('singleton', () => {
    it('should return the same instance', () => {
      resetPermissionManager();
      const instance1 = getPermissionManager();
      const instance2 = getPermissionManager();
      expect(instance1).toBe(instance2);
    });

    it('should create new instance after reset', () => {
      const instance1 = getPermissionManager();
      resetPermissionManager();
      const instance2 = getPermissionManager();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('importPermissions', () => {
    it('should import permissions', () => {
      const now = new Date();
      const permissions: Permission[] = [
        {
          id: 'perm-1',
          name: 'Permission 1',
          resource: 'test',
          actions: ['read'],
          effect: 'allow',
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'perm-2',
          name: 'Permission 2',
          resource: 'test',
          actions: ['write'],
          effect: 'allow',
          createdAt: now,
          updatedAt: now,
        },
      ];

      manager.importPermissions(permissions);

      expect(manager.getPermission('perm-1')?.name).toBe('Permission 1');
      expect(manager.getPermission('perm-2')?.name).toBe('Permission 2');
    });
  });

  describe('clear', () => {
    it('should clear all permissions', () => {
      manager.createPermission({
        id: 'perm-1',
        name: 'Test',
        resource: 'test',
        actions: ['read'],
      });

      manager.clear();

      expect(manager.getPermissions().length).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle nested field access', () => {
      const context: AuthorizationContext = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        resource: 'documents',
        action: 'read',
        userAttributes: {
          profile: {
            settings: {
              theme: 'dark',
            },
          },
        },
      };

      expect(manager.evaluateConditions(
        [{ field: 'userAttributes.profile.settings.theme', operator: 'equals', value: 'dark' }],
        context
      )).toBe(true);
    });

    it('should handle missing nested fields', () => {
      const context: AuthorizationContext = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        resource: 'documents',
        action: 'read',
        userAttributes: {},
      };

      expect(manager.evaluateConditions(
        [{ field: 'userAttributes.profile.settings.theme', operator: 'exists', value: true }],
        context
      )).toBe(false);
    });

    it('should handle notContains with non-string/array', () => {
      const context: AuthorizationContext = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        resource: 'documents',
        action: 'read',
        userAttributes: { count: 5 },
      };

      expect(manager.evaluateConditions(
        [{ field: 'userAttributes.count', operator: 'notContains', value: 'test' }],
        context
      )).toBe(true);
    });

    it('should handle contains with non-string/array', () => {
      const context: AuthorizationContext = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        resource: 'documents',
        action: 'read',
        userAttributes: { count: 5 },
      };

      expect(manager.evaluateConditions(
        [{ field: 'userAttributes.count', operator: 'contains', value: 'test' }],
        context
      )).toBe(false);
    });

    it('should handle startsWith with non-string', () => {
      const context: AuthorizationContext = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        resource: 'documents',
        action: 'read',
        userAttributes: { count: 5 },
      };

      expect(manager.evaluateConditions(
        [{ field: 'userAttributes.count', operator: 'startsWith', value: 'test' }],
        context
      )).toBe(false);
    });

    it('should handle endsWith with non-string', () => {
      const context: AuthorizationContext = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        resource: 'documents',
        action: 'read',
        userAttributes: { count: 5 },
      };

      expect(manager.evaluateConditions(
        [{ field: 'userAttributes.count', operator: 'endsWith', value: 'test' }],
        context
      )).toBe(false);
    });

    it('should handle regex with non-string value', () => {
      const context: AuthorizationContext = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        resource: 'documents',
        action: 'read',
        userAttributes: { count: 5 },
      };

      expect(manager.evaluateConditions(
        [{ field: 'userAttributes.count', operator: 'regex', value: '\\d+' }],
        context
      )).toBe(false);
    });

    it('should handle between with invalid array', () => {
      const context: AuthorizationContext = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        resource: 'documents',
        action: 'read',
        userAttributes: { count: 5 },
      };

      expect(manager.evaluateConditions(
        [{ field: 'userAttributes.count', operator: 'between', value: [1] }],
        context
      )).toBe(false);
    });

    it('should handle in with non-array compare value', () => {
      const context: AuthorizationContext = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        resource: 'documents',
        action: 'read',
        userAttributes: { role: 'admin' },
      };

      expect(manager.evaluateConditions(
        [{ field: 'userAttributes.role', operator: 'in', value: 'admin' }],
        context
      )).toBe(false);
    });

    it('should handle notIn with non-array compare value', () => {
      const context: AuthorizationContext = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        resource: 'documents',
        action: 'read',
        userAttributes: { role: 'admin' },
      };

      expect(manager.evaluateConditions(
        [{ field: 'userAttributes.role', operator: 'notIn', value: 'admin' }],
        context
      )).toBe(true);
    });

    it('should handle unknown operator', () => {
      const context: AuthorizationContext = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        resource: 'documents',
        action: 'read',
        userAttributes: { role: 'admin' },
      };

      expect(manager.evaluateConditions(
        [{ field: 'userAttributes.role', operator: 'unknown' as any, value: 'admin' }],
        context
      )).toBe(false);
    });

    it('should handle variable that does not match pattern', () => {
      const context: AuthorizationContext = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        resource: 'documents',
        action: 'read',
        userAttributes: { ownerId: 'notAVariable' },
      };

      expect(manager.evaluateConditions(
        [{ field: 'userAttributes.ownerId', operator: 'equals', value: 'notAVariable', isVariable: true }],
        context
      )).toBe(true);
    });
  });
});
