/**
 * @package @forge/roles
 * @description Tests for RbacService
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  RbacService,
  createRbacService,
  resetRbacService,
} from '../roles.service';
import { resetPermissionManager } from '../permission';
import { resetRoleManager } from '../role';
import { resetPolicyEngine } from '../policy';
import {
  AuthorizationContext,
  BatchAuthorizationRequest,
  RbacAuditEvent,
} from '../roles.types';

describe('RbacService', () => {
  let service: RbacService;

  beforeEach(() => {
    resetRbacService();
    resetPermissionManager();
    resetRoleManager();
    resetPolicyEngine();
    service = createRbacService();
  });

  describe('permission operations', () => {
    it('should create a permission', async () => {
      const permission = await service.createPermission({
        name: 'Read Documents',
        resource: 'documents',
        actions: ['read'],
        tenantId: 'tenant-1',
      });

      expect(permission.name).toBe('Read Documents');
      expect(permission.resource).toBe('documents');
    });

    it('should get a permission', async () => {
      await service.createPermission({
        id: 'perm-1',
        name: 'Test',
        resource: 'test',
        actions: ['read'],
        tenantId: 'tenant-1',
      });

      const permission = await service.getPermission('perm-1', 'tenant-1');
      expect(permission?.id).toBe('perm-1');
    });

    it('should get all permissions', async () => {
      await service.createPermission({
        name: 'Permission 1',
        resource: 'test',
        actions: ['read'],
        tenantId: 'tenant-1',
      });
      await service.createPermission({
        name: 'Permission 2',
        resource: 'test',
        actions: ['write'],
        tenantId: 'tenant-1',
      });

      const permissions = await service.getPermissions('tenant-1');
      expect(permissions.length).toBe(2);
    });

    it('should update a permission', async () => {
      await service.createPermission({
        id: 'perm-1',
        name: 'Original',
        resource: 'test',
        actions: ['read'],
        tenantId: 'tenant-1',
      });

      const updated = await service.updatePermission('perm-1', {
        name: 'Updated',
      }, 'tenant-1');

      expect(updated?.name).toBe('Updated');
    });

    it('should delete a permission', async () => {
      await service.createPermission({
        id: 'perm-1',
        name: 'Test',
        resource: 'test',
        actions: ['read'],
        tenantId: 'tenant-1',
      });

      const result = await service.deletePermission('perm-1', 'tenant-1');
      expect(result).toBe(true);

      const permission = await service.getPermission('perm-1', 'tenant-1');
      expect(permission).toBeNull();
    });
  });

  describe('role operations', () => {
    it('should create a role', async () => {
      const role = await service.createRole({
        name: 'Editor',
        permissions: ['perm-1'],
        tenantId: 'tenant-1',
      });

      expect(role.name).toBe('Editor');
      expect(role.permissions).toContain('perm-1');
    });

    it('should get a role', async () => {
      await service.createRole({
        id: 'role-1',
        name: 'Test',
        tenantId: 'tenant-1',
      });

      const role = await service.getRole('role-1', 'tenant-1');
      expect(role?.id).toBe('role-1');
    });

    it('should get all roles', async () => {
      await service.createRole({ name: 'Role 1', tenantId: 'tenant-1' });
      await service.createRole({ name: 'Role 2', tenantId: 'tenant-1' });

      const roles = await service.getRoles('tenant-1');
      expect(roles.length).toBe(2);
    });

    it('should update a role', async () => {
      await service.createRole({
        id: 'role-1',
        name: 'Original',
        tenantId: 'tenant-1',
      });

      const updated = await service.updateRole('role-1', {
        name: 'Updated',
      }, 'tenant-1');

      expect(updated?.name).toBe('Updated');
    });

    it('should delete a role', async () => {
      await service.createRole({
        id: 'role-1',
        name: 'Test',
        tenantId: 'tenant-1',
      });

      const result = await service.deleteRole('role-1', 'tenant-1');
      expect(result).toBe(true);

      const role = await service.getRole('role-1', 'tenant-1');
      expect(role).toBeNull();
    });

    it('should add permission to role', async () => {
      await service.createRole({
        id: 'role-1',
        name: 'Test',
        permissions: [],
        tenantId: 'tenant-1',
      });

      const updated = await service.addPermissionToRole('role-1', 'perm-1', 'tenant-1');
      expect(updated?.permissions).toContain('perm-1');
    });

    it('should remove permission from role', async () => {
      await service.createRole({
        id: 'role-1',
        name: 'Test',
        permissions: ['perm-1'],
        tenantId: 'tenant-1',
      });

      const updated = await service.removePermissionFromRole('role-1', 'perm-1', 'tenant-1');
      expect(updated?.permissions).not.toContain('perm-1');
    });

    it('should get effective permissions', async () => {
      await service.createRole({
        id: 'parent',
        name: 'Parent',
        permissions: ['perm-parent'],
        tenantId: 'tenant-1',
      });

      await service.createRole({
        id: 'child',
        name: 'Child',
        permissions: ['perm-child'],
        parentRoles: ['parent'],
        tenantId: 'tenant-1',
      });

      const permissions = await service.getEffectivePermissions('child', 'tenant-1');
      expect(permissions).toContain('perm-child');
      expect(permissions).toContain('perm-parent');
    });
  });

  describe('role assignment', () => {
    it('should assign a role', async () => {
      await service.createRole({
        id: 'role-1',
        name: 'Test',
        tenantId: 'tenant-1',
      });

      const assignment = await service.assignRole({
        userId: 'user-1',
        roleId: 'role-1',
        tenantId: 'tenant-1',
      });

      expect(assignment.userId).toBe('user-1');
      expect(assignment.roleId).toBe('role-1');
    });

    it('should unassign a role', async () => {
      await service.createRole({
        id: 'role-1',
        name: 'Test',
        tenantId: 'tenant-1',
      });

      await service.assignRole({
        userId: 'user-1',
        roleId: 'role-1',
        tenantId: 'tenant-1',
      });

      const result = await service.unassignRole('user-1', 'role-1', 'tenant-1');
      expect(result).toBe(true);
    });

    it('should get user roles', async () => {
      await service.createRole({ id: 'role-1', name: 'Role 1', tenantId: 'tenant-1' });
      await service.createRole({ id: 'role-2', name: 'Role 2', tenantId: 'tenant-1' });

      await service.assignRole({ userId: 'user-1', roleId: 'role-1', tenantId: 'tenant-1' });
      await service.assignRole({ userId: 'user-1', roleId: 'role-2', tenantId: 'tenant-1' });

      const roles = await service.getUserRoles('user-1', 'tenant-1');
      expect(roles.length).toBe(2);
    });

    it('should check if user has role', async () => {
      await service.createRole({ id: 'role-1', name: 'Test', tenantId: 'tenant-1' });
      await service.assignRole({ userId: 'user-1', roleId: 'role-1', tenantId: 'tenant-1' });

      expect(await service.userHasRole('user-1', 'role-1', 'tenant-1')).toBe(true);
      expect(await service.userHasRole('user-1', 'role-2', 'tenant-1')).toBe(false);
    });

    it('should get user effective permissions', async () => {
      await service.createRole({
        id: 'role-1',
        name: 'Test',
        permissions: ['perm-1', 'perm-2'],
        tenantId: 'tenant-1',
      });

      await service.assignRole({ userId: 'user-1', roleId: 'role-1', tenantId: 'tenant-1' });

      const permissions = await service.getUserEffectivePermissions('user-1', 'tenant-1');
      expect(permissions).toContain('perm-1');
      expect(permissions).toContain('perm-2');
    });

    it('should get users with role', async () => {
      await service.createRole({ id: 'role-1', name: 'Test', tenantId: 'tenant-1' });

      await service.assignRole({ userId: 'user-1', roleId: 'role-1', tenantId: 'tenant-1' });
      await service.assignRole({ userId: 'user-2', roleId: 'role-1', tenantId: 'tenant-1' });

      const users = await service.getUsersWithRole('role-1', 'tenant-1');
      expect(users.length).toBe(2);
    });
  });

  describe('policy operations', () => {
    it('should create a policy', async () => {
      const policy = await service.createPolicy({
        name: 'Admin Policy',
        statements: [
          { effect: 'allow', actions: ['*'], resources: ['*'] },
        ],
        tenantId: 'tenant-1',
      });

      expect(policy.name).toBe('Admin Policy');
    });

    it('should get a policy', async () => {
      await service.createPolicy({
        id: 'policy-1',
        name: 'Test',
        statements: [
          { effect: 'allow', actions: ['read'], resources: ['*'] },
        ],
        tenantId: 'tenant-1',
      });

      const policy = await service.getPolicy('policy-1', 'tenant-1');
      expect(policy?.id).toBe('policy-1');
    });

    it('should get all policies', async () => {
      await service.createPolicy({
        name: 'Policy 1',
        statements: [{ effect: 'allow', actions: ['read'], resources: ['*'] }],
        tenantId: 'tenant-1',
      });
      await service.createPolicy({
        name: 'Policy 2',
        statements: [{ effect: 'allow', actions: ['write'], resources: ['*'] }],
        tenantId: 'tenant-1',
      });

      const policies = await service.getPolicies('tenant-1');
      expect(policies.length).toBe(2);
    });

    it('should update a policy', async () => {
      await service.createPolicy({
        id: 'policy-1',
        name: 'Original',
        statements: [{ effect: 'allow', actions: ['read'], resources: ['*'] }],
        tenantId: 'tenant-1',
      });

      const updated = await service.updatePolicy('policy-1', {
        name: 'Updated',
      }, 'tenant-1');

      expect(updated?.name).toBe('Updated');
    });

    it('should delete a policy', async () => {
      await service.createPolicy({
        id: 'policy-1',
        name: 'Test',
        statements: [{ effect: 'allow', actions: ['read'], resources: ['*'] }],
        tenantId: 'tenant-1',
      });

      const result = await service.deletePolicy('policy-1', 'tenant-1');
      expect(result).toBe(true);

      const policy = await service.getPolicy('policy-1', 'tenant-1');
      expect(policy).toBeNull();
    });
  });

  describe('authorization', () => {
    it('should authorize with policy', async () => {
      await service.createPolicy({
        name: 'Allow Read',
        statements: [
          { effect: 'allow', actions: ['read'], resources: ['documents'] },
        ],
        tenantId: 'tenant-1',
      });

      const context: AuthorizationContext = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        resource: 'documents',
        action: 'read',
      };

      const result = await service.authorize(context);
      expect(result.allowed).toBe(true);
    });

    it('should authorize with permission', async () => {
      await service.createPermission({
        id: 'perm-read',
        name: 'Read Documents',
        resource: 'documents',
        actions: ['read'],
        tenantId: 'tenant-1',
      });

      await service.createRole({
        id: 'role-reader',
        name: 'Reader',
        permissions: ['perm-read'],
        tenantId: 'tenant-1',
      });

      await service.assignRole({
        userId: 'user-1',
        roleId: 'role-reader',
        tenantId: 'tenant-1',
      });

      const context: AuthorizationContext = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        resource: 'documents',
        action: 'read',
      };

      const result = await service.authorize(context);
      expect(result.allowed).toBe(true);
    });

    it('should deny unauthorized access', async () => {
      const context: AuthorizationContext = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        resource: 'documents',
        action: 'read',
      };

      const result = await service.authorize(context);
      expect(result.allowed).toBe(false);
    });

    it('should authorize batch requests', async () => {
      await service.createPolicy({
        name: 'Allow Read Documents',
        statements: [
          { effect: 'allow', actions: ['read'], resources: ['documents'] },
        ],
        tenantId: 'tenant-1',
      });

      const request: BatchAuthorizationRequest = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        checks: [
          { resource: 'documents', action: 'read' },
          { resource: 'documents', action: 'write' },
          { resource: 'projects', action: 'read' },
        ],
      };

      const result = await service.authorizeBatch(request);
      expect(result.results.length).toBe(3);
      expect(result.results[0].allowed).toBe(true);
      expect(result.results[1].allowed).toBe(false);
      expect(result.results[2].allowed).toBe(false);
      expect(result.totalEvaluationTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should use can() helper', async () => {
      await service.createPermission({
        id: 'perm-read',
        name: 'Read Documents',
        resource: 'documents',
        actions: ['read'],
        tenantId: 'tenant-1',
      });

      await service.createRole({
        id: 'role-reader',
        name: 'Reader',
        permissions: ['perm-read'],
        tenantId: 'tenant-1',
      });

      await service.assignRole({
        userId: 'user-1',
        roleId: 'role-reader',
        tenantId: 'tenant-1',
      });

      expect(await service.can('user-1', 'tenant-1', 'documents', 'read')).toBe(true);
      expect(await service.can('user-1', 'tenant-1', 'documents', 'write')).toBe(false);
    });
  });

  describe('system roles', () => {
    it('should initialize system roles', async () => {
      const roles = await service.initializeSystemRoles('tenant-1');
      expect(roles.length).toBe(4);
    });
  });

  describe('event handling', () => {
    it('should emit events on operations', async () => {
      const events: RbacAuditEvent[] = [];
      service.onEvent((event) => {
        events.push(event);
      });

      await service.createPermission({
        name: 'Test',
        resource: 'test',
        actions: ['read'],
        tenantId: 'tenant-1',
      });

      expect(events.length).toBe(1);
      expect(events[0].type).toBe('permission_created');
    });

    it('should emit event on role creation', async () => {
      const events: RbacAuditEvent[] = [];
      service.onEvent((event) => {
        events.push(event);
      });

      await service.createRole({
        name: 'Test',
        tenantId: 'tenant-1',
      });

      expect(events.some(e => e.type === 'role_created')).toBe(true);
    });

    it('should emit event on role assignment', async () => {
      await service.createRole({
        id: 'role-1',
        name: 'Test',
        tenantId: 'tenant-1',
      });

      const events: RbacAuditEvent[] = [];
      service.onEvent((event) => {
        events.push(event);
      });

      await service.assignRole({
        userId: 'user-1',
        roleId: 'role-1',
        tenantId: 'tenant-1',
      });

      expect(events.some(e => e.type === 'role_assigned')).toBe(true);
    });

    it('should emit event on authorization', async () => {
      const events: RbacAuditEvent[] = [];
      service.onEvent((event) => {
        events.push(event);
      });

      await service.authorize({
        userId: 'user-1',
        tenantId: 'tenant-1',
        resource: 'documents',
        action: 'read',
      });

      expect(events.some(e => e.type === 'authorization_denied')).toBe(true);
    });

    it('should handle async event handlers', async () => {
      let handlerCalled = false;
      service.onEvent(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        handlerCalled = true;
      });

      await service.createPermission({
        name: 'Test',
        resource: 'test',
        actions: ['read'],
      });

      // Wait for async handler
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(handlerCalled).toBe(true);
    });
  });

  describe('caching', () => {
    it('should work without cache', async () => {
      // Service without cache should work normally
      await service.createPermission({
        id: 'perm-1',
        name: 'Test',
        resource: 'test',
        actions: ['read'],
        tenantId: 'tenant-1',
      });

      await service.createRole({
        id: 'role-1',
        name: 'Test',
        permissions: ['perm-1'],
        tenantId: 'tenant-1',
      });

      await service.assignRole({
        userId: 'user-1',
        roleId: 'role-1',
        tenantId: 'tenant-1',
      });

      const context: AuthorizationContext = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        resource: 'test',
        action: 'read',
      };

      const result = await service.authorize(context);
      expect(result.allowed).toBe(true);
    });

    it('should use cache when available', async () => {
      const mockCache = {
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(true),
      };

      const cachedService = createRbacService({ enableCaching: true }, mockCache as any);

      await cachedService.createRole({
        id: 'role-1',
        name: 'Test',
        tenantId: 'tenant-1',
      });

      await cachedService.assignRole({
        userId: 'user-1',
        roleId: 'role-1',
        tenantId: 'tenant-1',
      });

      // Call getUserEffectivePermissions to trigger cache lookup
      await cachedService.getUserEffectivePermissions('user-1', 'tenant-1');

      // Should attempt to get from cache
      expect(mockCache.get).toHaveBeenCalled();
    });

    it('should invalidate cache on role assignment', async () => {
      const mockCache = {
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(true),
      };

      const cachedService = createRbacService({ enableCaching: true }, mockCache as any);

      await cachedService.createRole({
        id: 'role-1',
        name: 'Test',
        tenantId: 'tenant-1',
      });

      await cachedService.assignRole({
        userId: 'user-1',
        roleId: 'role-1',
        tenantId: 'tenant-1',
      });

      // Should invalidate cache
      expect(mockCache.delete).toHaveBeenCalled();
    });

    it('should use cached permissions', async () => {
      const mockCache = {
        get: vi.fn().mockResolvedValue(['perm-1', 'perm-2']),
        set: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(true),
      };

      const cachedService = createRbacService({ enableCaching: true }, mockCache as any);

      const permissions = await cachedService.getUserEffectivePermissions('user-1', 'tenant-1');

      expect(permissions).toEqual(['perm-1', 'perm-2']);
      expect(mockCache.get).toHaveBeenCalledWith('user:tenant-1:user-1:permissions');
    });

    it('should cache computed permissions', async () => {
      const mockCache = {
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(true),
      };

      const cachedService = createRbacService({ enableCaching: true, cacheTtlMs: 60000 }, mockCache as any);

      await cachedService.createRole({
        id: 'role-1',
        name: 'Test',
        permissions: ['perm-1'],
        tenantId: 'tenant-1',
      });

      await cachedService.assignRole({
        userId: 'user-1',
        roleId: 'role-1',
        tenantId: 'tenant-1',
      });

      // Force cache miss and computation
      mockCache.get.mockResolvedValue(null);

      await cachedService.getUserEffectivePermissions('user-1', 'tenant-1');

      expect(mockCache.set).toHaveBeenCalledWith(
        'user:tenant-1:user-1:permissions',
        expect.any(Array),
        { ttl: 60000 }
      );
    });
  });

  describe('configuration', () => {
    it('should respect enableAuditLog config', async () => {
      const silentService = createRbacService({ enableAuditLog: false });
      const events: RbacAuditEvent[] = [];
      silentService.onEvent((event) => {
        events.push(event);
      });

      await silentService.createPermission({
        name: 'Test',
        resource: 'test',
        actions: ['read'],
      });

      expect(events.length).toBe(0);
    });

    it('should use custom evaluator', async () => {
      const customService = createRbacService({
        customEvaluator: async (context, _permission) => {
          // Custom logic: always allow if user is "admin"
          return context.userId === 'admin';
        },
      });

      await customService.createPermission({
        id: 'perm-1',
        name: 'Test',
        resource: 'test',
        actions: ['read'],
        tenantId: 'tenant-1',
      });

      await customService.createRole({
        id: 'role-1',
        name: 'Test',
        permissions: ['perm-1'],
        tenantId: 'tenant-1',
      });

      await customService.assignRole({
        userId: 'admin',
        roleId: 'role-1',
        tenantId: 'tenant-1',
      });

      // Admin should be allowed by custom evaluator
      expect(await customService.can('admin', 'tenant-1', 'test', 'read')).toBe(true);

      // User without any role/permission gets denied (no permissions to evaluate)
      expect(await customService.can('guest', 'tenant-1', 'test', 'read')).toBe(false);
    });
  });

  describe('reset', () => {
    it('should reset the singleton', () => {
      const service1 = createRbacService();
      resetRbacService();
      const service2 = createRbacService();
      expect(service1).not.toBe(service2);
    });
  });

  describe('complex scenarios', () => {
    it('should handle multi-tenant isolation', async () => {
      await service.createPermission({
        id: 'perm-read',
        name: 'Read',
        resource: 'documents',
        actions: ['read'],
        tenantId: 'tenant-1',
      });

      await service.createRole({
        id: 'role-1',
        name: 'Reader',
        permissions: ['perm-read'],
        tenantId: 'tenant-1',
      });

      await service.assignRole({
        userId: 'user-1',
        roleId: 'role-1',
        tenantId: 'tenant-1',
      });

      // User should have access in tenant-1
      expect(await service.can('user-1', 'tenant-1', 'documents', 'read')).toBe(true);

      // User should not have access in tenant-2
      expect(await service.can('user-1', 'tenant-2', 'documents', 'read')).toBe(false);
    });

    it('should handle role inheritance', async () => {
      await service.createPermission({
        id: 'perm-read',
        name: 'Read',
        resource: 'documents',
        actions: ['read'],
        tenantId: 'tenant-1',
      });

      await service.createPermission({
        id: 'perm-write',
        name: 'Write',
        resource: 'documents',
        actions: ['write'],
        tenantId: 'tenant-1',
      });

      await service.createRole({
        id: 'role-reader',
        name: 'Reader',
        permissions: ['perm-read'],
        tenantId: 'tenant-1',
      });

      await service.createRole({
        id: 'role-editor',
        name: 'Editor',
        permissions: ['perm-write'],
        parentRoles: ['role-reader'],
        tenantId: 'tenant-1',
      });

      await service.assignRole({
        userId: 'user-1',
        roleId: 'role-editor',
        tenantId: 'tenant-1',
      });

      // Editor should have both read and write access
      expect(await service.can('user-1', 'tenant-1', 'documents', 'read')).toBe(true);
      expect(await service.can('user-1', 'tenant-1', 'documents', 'write')).toBe(true);
    });

    it('should handle deny rules', async () => {
      await service.createPermission({
        id: 'perm-allow',
        name: 'Allow All',
        resource: '*',
        actions: ['*'],
        effect: 'allow',
        tenantId: 'tenant-1',
      });

      await service.createPermission({
        id: 'perm-deny',
        name: 'Deny Delete',
        resource: 'documents',
        actions: ['delete'],
        effect: 'deny',
        tenantId: 'tenant-1',
      });

      await service.createRole({
        id: 'role-1',
        name: 'Test',
        permissions: ['perm-allow', 'perm-deny'],
        tenantId: 'tenant-1',
      });

      await service.assignRole({
        userId: 'user-1',
        roleId: 'role-1',
        tenantId: 'tenant-1',
      });

      // Should be able to read
      expect(await service.can('user-1', 'tenant-1', 'documents', 'read')).toBe(true);

      // Should be denied delete
      expect(await service.can('user-1', 'tenant-1', 'documents', 'delete')).toBe(false);
    });

    it('should handle policy overrides', async () => {
      await service.createPermission({
        id: 'perm-allow',
        name: 'Allow All',
        resource: '*',
        actions: ['*'],
        effect: 'allow',
        tenantId: 'tenant-1',
      });

      await service.createRole({
        id: 'role-1',
        name: 'Test',
        permissions: ['perm-allow'],
        tenantId: 'tenant-1',
      });

      await service.assignRole({
        userId: 'user-1',
        roleId: 'role-1',
        tenantId: 'tenant-1',
      });

      // Create deny policy with higher priority
      await service.createPolicy({
        name: 'Deny Secrets',
        statements: [
          { effect: 'deny', actions: ['*'], resources: ['secrets'] },
        ],
        priority: 10,
        tenantId: 'tenant-1',
      });

      // Should be able to read documents
      expect(await service.can('user-1', 'tenant-1', 'documents', 'read')).toBe(true);

      // Should be denied access to secrets by policy
      expect(await service.can('user-1', 'tenant-1', 'secrets', 'read')).toBe(false);
    });

    it('should handle attribute-based conditions', async () => {
      await service.createPermission({
        id: 'perm-owner',
        name: 'Owner Access',
        resource: 'documents',
        actions: ['*'],
        effect: 'allow',
        conditions: [
          {
            field: 'resourceAttributes.ownerId',
            operator: 'equals',
            value: '${userId}',
            isVariable: true,
          },
        ],
        tenantId: 'tenant-1',
      });

      await service.createRole({
        id: 'role-1',
        name: 'Test',
        permissions: ['perm-owner'],
        tenantId: 'tenant-1',
      });

      await service.assignRole({
        userId: 'user-1',
        roleId: 'role-1',
        tenantId: 'tenant-1',
      });

      // Should be able to access own document
      const ownDoc = await service.authorize({
        userId: 'user-1',
        tenantId: 'tenant-1',
        resource: 'documents',
        resourceId: '123',
        action: 'update',
        resourceAttributes: { ownerId: 'user-1' },
      });
      expect(ownDoc.allowed).toBe(true);

      // Should not be able to access others' document
      const otherDoc = await service.authorize({
        userId: 'user-1',
        tenantId: 'tenant-1',
        resource: 'documents',
        resourceId: '456',
        action: 'update',
        resourceAttributes: { ownerId: 'user-2' },
      });
      expect(otherDoc.allowed).toBe(false);
    });
  });
});
