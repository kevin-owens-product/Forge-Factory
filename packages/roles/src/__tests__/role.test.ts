/**
 * @package @forge/roles
 * @description Tests for RoleManager
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  RoleManager,
  getRoleManager,
  resetRoleManager,
} from '../role';
import { Role, UserRoleAssignment, SYSTEM_ROLES } from '../roles.types';

describe('RoleManager', () => {
  let manager: RoleManager;

  beforeEach(() => {
    resetRoleManager();
    manager = new RoleManager();
  });

  describe('createRole', () => {
    it('should create a role with all fields', () => {
      const role = manager.createRole({
        id: 'role-1',
        name: 'Editor',
        description: 'Can edit documents',
        permissions: ['perm-read', 'perm-write'],
        tenantId: 'tenant-1',
      });

      expect(role.id).toBe('role-1');
      expect(role.name).toBe('Editor');
      expect(role.description).toBe('Can edit documents');
      expect(role.permissions).toEqual(['perm-read', 'perm-write']);
      expect(role.tenantId).toBe('tenant-1');
      expect(role.createdAt).toBeInstanceOf(Date);
      expect(role.updatedAt).toBeInstanceOf(Date);
    });

    it('should generate an ID if not provided', () => {
      const role = manager.createRole({
        name: 'Test Role',
      });

      expect(role.id).toMatch(/^role_/);
    });

    it('should default permissions to empty array', () => {
      const role = manager.createRole({
        name: 'Test Role',
      });

      expect(role.permissions).toEqual([]);
    });

    it('should throw error for duplicate role ID', () => {
      manager.createRole({
        id: 'role-1',
        name: 'Role 1',
        tenantId: 'tenant-1',
      });

      expect(() => {
        manager.createRole({
          id: 'role-1',
          name: 'Role 1 Duplicate',
          tenantId: 'tenant-1',
        });
      }).toThrow("Role with ID 'role-1' already exists");
    });

    it('should allow same ID in different tenants', () => {
      const role1 = manager.createRole({
        id: 'role-1',
        name: 'Role 1',
        tenantId: 'tenant-1',
      });

      const role2 = manager.createRole({
        id: 'role-1',
        name: 'Role 1',
        tenantId: 'tenant-2',
      });

      expect(role1.tenantId).toBe('tenant-1');
      expect(role2.tenantId).toBe('tenant-2');
    });

    it('should throw error for missing name', () => {
      expect(() => {
        manager.createRole({
          name: '',
        });
      }).toThrow('Role name is required');
    });

    it('should create role with parent roles', () => {
      manager.createRole({
        id: 'parent-role',
        name: 'Parent',
      });

      const role = manager.createRole({
        id: 'child-role',
        name: 'Child',
        parentRoles: ['parent-role'],
      });

      expect(role.parentRoles).toEqual(['parent-role']);
    });

    it('should throw error for non-existent parent role', () => {
      expect(() => {
        manager.createRole({
          name: 'Child',
          parentRoles: ['non-existent-parent'],
        });
      }).toThrow("Parent role 'non-existent-parent' not found");
    });

    it('should throw error for circular inheritance', () => {
      manager.createRole({
        id: 'role-a',
        name: 'Role A',
      });

      expect(() => {
        manager.createRole({
          id: 'role-a',
          name: 'Role A Self Reference',
          parentRoles: ['role-a'],
        });
      }).toThrow("Role with ID 'role-a' already exists");
    });

    it('should detect circular inheritance through chain', () => {
      manager.createRole({ id: 'role-a', name: 'Role A' });
      manager.createRole({ id: 'role-b', name: 'Role B', parentRoles: ['role-a'] });
      manager.createRole({ id: 'role-c', name: 'Role C', parentRoles: ['role-b'] });

      // Now try to make role-a inherit from role-c (creating cycle)
      expect(() => {
        manager.updateRole('role-a', { parentRoles: ['role-c'] });
      }).toThrow('would create circular inheritance');
    });

    it('should create role with max assignments', () => {
      const role = manager.createRole({
        name: 'Limited Role',
        maxAssignments: 5,
      });

      expect(role.maxAssignments).toBe(5);
    });

    it('should create system role', () => {
      const role = manager.createRole({
        name: 'System Role',
        isSystem: true,
      });

      expect(role.isSystem).toBe(true);
    });
  });

  describe('getRole', () => {
    it('should retrieve a role by ID', () => {
      manager.createRole({
        id: 'role-1',
        name: 'Test Role',
      });

      const role = manager.getRole('role-1');
      expect(role?.id).toBe('role-1');
    });

    it('should return null for non-existent role', () => {
      const role = manager.getRole('non-existent');
      expect(role).toBeNull();
    });

    it('should retrieve role with tenant isolation', () => {
      manager.createRole({
        id: 'role-1',
        name: 'Test Role',
        tenantId: 'tenant-1',
      });

      expect(manager.getRole('role-1', 'tenant-1')?.id).toBe('role-1');
      expect(manager.getRole('role-1', 'tenant-2')).toBeNull();
    });
  });

  describe('getRoles', () => {
    it('should get all roles', () => {
      manager.createRole({ id: 'role-1', name: 'Role 1' });
      manager.createRole({ id: 'role-2', name: 'Role 2' });

      const roles = manager.getRoles();
      expect(roles.length).toBe(2);
    });

    it('should filter by tenant', () => {
      manager.createRole({ id: 'role-1', name: 'Role 1', tenantId: 'tenant-1' });
      manager.createRole({ id: 'role-2', name: 'Role 2', tenantId: 'tenant-2' });

      const tenant1Roles = manager.getRoles('tenant-1');
      expect(tenant1Roles.length).toBe(1);
      expect(tenant1Roles[0].id).toBe('role-1');
    });
  });

  describe('updateRole', () => {
    it('should update role fields', () => {
      manager.createRole({
        id: 'role-1',
        name: 'Original Name',
      });

      const updated = manager.updateRole('role-1', {
        name: 'Updated Name',
        description: 'Added description',
      });

      expect(updated?.name).toBe('Updated Name');
      expect(updated?.description).toBe('Added description');
    });

    it('should return null for non-existent role', () => {
      const updated = manager.updateRole('non-existent', { name: 'Test' });
      expect(updated).toBeNull();
    });

    it('should preserve immutable fields', () => {
      const original = manager.createRole({
        id: 'role-1',
        name: 'Test',
        tenantId: 'tenant-1',
      });

      const updated = manager.updateRole('role-1', {
        name: 'Updated',
        description: 'New description',
      }, 'tenant-1');

      expect(updated?.id).toBe(original.id);
      expect(updated?.tenantId).toBe(original.tenantId);
      expect(updated?.createdAt).toEqual(original.createdAt);
    });

    it('should throw error when modifying system role core properties', () => {
      manager.createRole({
        id: 'system-role',
        name: 'System Role',
        isSystem: true,
      });

      expect(() => {
        manager.updateRole('system-role', { name: 'New Name' });
      }).toThrow('Cannot modify core properties of system roles');

      expect(() => {
        manager.updateRole('system-role', { permissions: ['new-perm'] });
      }).toThrow('Cannot modify core properties of system roles');
    });

    it('should allow updating non-core properties of system role', () => {
      manager.createRole({
        id: 'system-role',
        name: 'System Role',
        isSystem: true,
      });

      const updated = manager.updateRole('system-role', {
        description: 'Updated description',
      });

      expect(updated?.description).toBe('Updated description');
    });
  });

  describe('deleteRole', () => {
    it('should delete a role', () => {
      manager.createRole({
        id: 'role-1',
        name: 'Test',
      });

      const result = manager.deleteRole('role-1');
      expect(result).toBe(true);
      expect(manager.getRole('role-1')).toBeNull();
    });

    it('should return false for non-existent role', () => {
      const result = manager.deleteRole('non-existent');
      expect(result).toBe(false);
    });

    it('should throw error when deleting system role', () => {
      manager.createRole({
        id: 'system-role',
        name: 'System Role',
        isSystem: true,
      });

      expect(() => {
        manager.deleteRole('system-role');
      }).toThrow('Cannot delete system roles');
    });

    it('should throw error when role is inherited by another role', () => {
      manager.createRole({ id: 'parent-role', name: 'Parent' });
      manager.createRole({ id: 'child-role', name: 'Child', parentRoles: ['parent-role'] });

      expect(() => {
        manager.deleteRole('parent-role');
      }).toThrow("Cannot delete role 'parent-role' as it is inherited by role 'child-role'");
    });

    it('should remove role assignments when deleting role', () => {
      manager.createRole({ id: 'role-1', name: 'Test', tenantId: 'tenant-1' });
      manager.assignRole({
        userId: 'user-1',
        roleId: 'role-1',
        tenantId: 'tenant-1',
      });

      expect(manager.getUserRoles('user-1', 'tenant-1').length).toBe(1);

      manager.deleteRole('role-1', 'tenant-1');

      expect(manager.getUserRoles('user-1', 'tenant-1').length).toBe(0);
    });
  });

  describe('addPermissionToRole', () => {
    it('should add permission to role', () => {
      manager.createRole({
        id: 'role-1',
        name: 'Test',
        permissions: [],
      });

      const updated = manager.addPermissionToRole('role-1', 'perm-1');
      expect(updated?.permissions).toContain('perm-1');
    });

    it('should not duplicate permission', () => {
      manager.createRole({
        id: 'role-1',
        name: 'Test',
        permissions: ['perm-1'],
      });

      const updated = manager.addPermissionToRole('role-1', 'perm-1');
      expect(updated?.permissions.filter(p => p === 'perm-1').length).toBe(1);
    });

    it('should return null for non-existent role', () => {
      const result = manager.addPermissionToRole('non-existent', 'perm-1');
      expect(result).toBeNull();
    });
  });

  describe('removePermissionFromRole', () => {
    it('should remove permission from role', () => {
      manager.createRole({
        id: 'role-1',
        name: 'Test',
        permissions: ['perm-1', 'perm-2'],
      });

      const updated = manager.removePermissionFromRole('role-1', 'perm-1');
      expect(updated?.permissions).not.toContain('perm-1');
      expect(updated?.permissions).toContain('perm-2');
    });

    it('should return role unchanged if permission not found', () => {
      manager.createRole({
        id: 'role-1',
        name: 'Test',
        permissions: ['perm-1'],
      });

      const updated = manager.removePermissionFromRole('role-1', 'perm-2');
      expect(updated?.permissions).toEqual(['perm-1']);
    });

    it('should return null for non-existent role', () => {
      const result = manager.removePermissionFromRole('non-existent', 'perm-1');
      expect(result).toBeNull();
    });
  });

  describe('getEffectivePermissions', () => {
    it('should get direct permissions', () => {
      manager.createRole({
        id: 'role-1',
        name: 'Test',
        permissions: ['perm-1', 'perm-2'],
      });

      const permissions = manager.getEffectivePermissions('role-1');
      expect(permissions).toContain('perm-1');
      expect(permissions).toContain('perm-2');
    });

    it('should include inherited permissions', () => {
      manager.createRole({
        id: 'parent-role',
        name: 'Parent',
        permissions: ['perm-parent'],
      });

      manager.createRole({
        id: 'child-role',
        name: 'Child',
        permissions: ['perm-child'],
        parentRoles: ['parent-role'],
      });

      const permissions = manager.getEffectivePermissions('child-role');
      expect(permissions).toContain('perm-child');
      expect(permissions).toContain('perm-parent');
    });

    it('should handle deep inheritance', () => {
      manager.createRole({
        id: 'grandparent-role',
        name: 'Grandparent',
        permissions: ['perm-grandparent'],
      });

      manager.createRole({
        id: 'parent-role',
        name: 'Parent',
        permissions: ['perm-parent'],
        parentRoles: ['grandparent-role'],
      });

      manager.createRole({
        id: 'child-role',
        name: 'Child',
        permissions: ['perm-child'],
        parentRoles: ['parent-role'],
      });

      const permissions = manager.getEffectivePermissions('child-role');
      expect(permissions).toContain('perm-child');
      expect(permissions).toContain('perm-parent');
      expect(permissions).toContain('perm-grandparent');
    });

    it('should deduplicate permissions', () => {
      manager.createRole({
        id: 'parent-role',
        name: 'Parent',
        permissions: ['perm-shared', 'perm-parent'],
      });

      manager.createRole({
        id: 'child-role',
        name: 'Child',
        permissions: ['perm-shared', 'perm-child'],
        parentRoles: ['parent-role'],
      });

      const permissions = manager.getEffectivePermissions('child-role');
      expect(permissions.filter(p => p === 'perm-shared').length).toBe(1);
    });

    it('should return empty array for non-existent role', () => {
      const permissions = manager.getEffectivePermissions('non-existent');
      expect(permissions).toEqual([]);
    });

    it('should throw error when max inheritance depth exceeded', () => {
      const managerWithLowDepth = new RoleManager(2);

      managerWithLowDepth.createRole({ id: 'role-1', name: 'Role 1', permissions: ['p1'] });
      managerWithLowDepth.createRole({ id: 'role-2', name: 'Role 2', parentRoles: ['role-1'] });
      managerWithLowDepth.createRole({ id: 'role-3', name: 'Role 3', parentRoles: ['role-2'] });
      managerWithLowDepth.createRole({ id: 'role-4', name: 'Role 4', parentRoles: ['role-3'] });

      expect(() => {
        managerWithLowDepth.getEffectivePermissions('role-4');
      }).toThrow('Maximum role inheritance depth exceeded');
    });

    it('should handle multiple parent roles', () => {
      manager.createRole({
        id: 'parent-1',
        name: 'Parent 1',
        permissions: ['perm-1'],
      });

      manager.createRole({
        id: 'parent-2',
        name: 'Parent 2',
        permissions: ['perm-2'],
      });

      manager.createRole({
        id: 'child-role',
        name: 'Child',
        permissions: ['perm-child'],
        parentRoles: ['parent-1', 'parent-2'],
      });

      const permissions = manager.getEffectivePermissions('child-role');
      expect(permissions).toContain('perm-child');
      expect(permissions).toContain('perm-1');
      expect(permissions).toContain('perm-2');
    });
  });

  describe('assignRole', () => {
    it('should assign a role to a user', () => {
      manager.createRole({
        id: 'role-1',
        name: 'Test',
        tenantId: 'tenant-1',
      });

      const assignment = manager.assignRole({
        userId: 'user-1',
        roleId: 'role-1',
        tenantId: 'tenant-1',
      });

      expect(assignment.userId).toBe('user-1');
      expect(assignment.roleId).toBe('role-1');
      expect(assignment.tenantId).toBe('tenant-1');
      expect(assignment.assignedAt).toBeInstanceOf(Date);
    });

    it('should throw error for non-existent role', () => {
      expect(() => {
        manager.assignRole({
          userId: 'user-1',
          roleId: 'non-existent',
          tenantId: 'tenant-1',
        });
      }).toThrow("Role 'non-existent' not found");
    });

    it('should throw error for duplicate assignment', () => {
      manager.createRole({
        id: 'role-1',
        name: 'Test',
        tenantId: 'tenant-1',
      });

      manager.assignRole({
        userId: 'user-1',
        roleId: 'role-1',
        tenantId: 'tenant-1',
      });

      expect(() => {
        manager.assignRole({
          userId: 'user-1',
          roleId: 'role-1',
          tenantId: 'tenant-1',
        });
      }).toThrow("User 'user-1' already has role 'role-1'");
    });

    it('should allow same role in different scopes', () => {
      manager.createRole({
        id: 'role-1',
        name: 'Test',
        tenantId: 'tenant-1',
      });

      manager.assignRole({
        userId: 'user-1',
        roleId: 'role-1',
        tenantId: 'tenant-1',
        scope: 'project-1',
      });

      const assignment2 = manager.assignRole({
        userId: 'user-1',
        roleId: 'role-1',
        tenantId: 'tenant-1',
        scope: 'project-2',
      });

      expect(assignment2.scope).toBe('project-2');
    });

    it('should enforce max assignments', () => {
      manager.createRole({
        id: 'role-1',
        name: 'Limited',
        maxAssignments: 2,
        tenantId: 'tenant-1',
      });

      manager.assignRole({ userId: 'user-1', roleId: 'role-1', tenantId: 'tenant-1' });
      manager.assignRole({ userId: 'user-2', roleId: 'role-1', tenantId: 'tenant-1' });

      expect(() => {
        manager.assignRole({ userId: 'user-3', roleId: 'role-1', tenantId: 'tenant-1' });
      }).toThrow("Role 'role-1' has reached maximum assignments (2)");
    });

    it('should include expiration time', () => {
      manager.createRole({
        id: 'role-1',
        name: 'Test',
        tenantId: 'tenant-1',
      });

      const expiresAt = new Date(Date.now() + 86400000);
      const assignment = manager.assignRole({
        userId: 'user-1',
        roleId: 'role-1',
        tenantId: 'tenant-1',
        expiresAt,
      });

      expect(assignment.expiresAt).toEqual(expiresAt);
    });

    it('should include assignedBy', () => {
      manager.createRole({
        id: 'role-1',
        name: 'Test',
        tenantId: 'tenant-1',
      });

      const assignment = manager.assignRole({
        userId: 'user-1',
        roleId: 'role-1',
        tenantId: 'tenant-1',
        assignedBy: 'admin-1',
      });

      expect(assignment.assignedBy).toBe('admin-1');
    });
  });

  describe('unassignRole', () => {
    it('should unassign a role from a user', () => {
      manager.createRole({
        id: 'role-1',
        name: 'Test',
        tenantId: 'tenant-1',
      });

      manager.assignRole({
        userId: 'user-1',
        roleId: 'role-1',
        tenantId: 'tenant-1',
      });

      const result = manager.unassignRole('user-1', 'role-1', 'tenant-1');
      expect(result).toBe(true);
      expect(manager.getUserRoles('user-1', 'tenant-1').length).toBe(0);
    });

    it('should return false for non-existent assignment', () => {
      const result = manager.unassignRole('user-1', 'role-1', 'tenant-1');
      expect(result).toBe(false);
    });

    it('should unassign specific scope', () => {
      manager.createRole({
        id: 'role-1',
        name: 'Test',
        tenantId: 'tenant-1',
      });

      manager.assignRole({
        userId: 'user-1',
        roleId: 'role-1',
        tenantId: 'tenant-1',
        scope: 'project-1',
      });

      manager.assignRole({
        userId: 'user-1',
        roleId: 'role-1',
        tenantId: 'tenant-1',
        scope: 'project-2',
      });

      manager.unassignRole('user-1', 'role-1', 'tenant-1', 'project-1');

      const roles = manager.getUserRoles('user-1', 'tenant-1');
      expect(roles.length).toBe(1);
      expect(roles[0].scope).toBe('project-2');
    });
  });

  describe('getUserRoles', () => {
    it('should get user role assignments', () => {
      manager.createRole({ id: 'role-1', name: 'Role 1', tenantId: 'tenant-1' });
      manager.createRole({ id: 'role-2', name: 'Role 2', tenantId: 'tenant-1' });

      manager.assignRole({ userId: 'user-1', roleId: 'role-1', tenantId: 'tenant-1' });
      manager.assignRole({ userId: 'user-1', roleId: 'role-2', tenantId: 'tenant-1' });

      const roles = manager.getUserRoles('user-1', 'tenant-1');
      expect(roles.length).toBe(2);
    });

    it('should filter by tenant', () => {
      manager.createRole({ id: 'role-1', name: 'Role 1', tenantId: 'tenant-1' });
      manager.createRole({ id: 'role-2', name: 'Role 2', tenantId: 'tenant-2' });

      manager.assignRole({ userId: 'user-1', roleId: 'role-1', tenantId: 'tenant-1' });
      manager.assignRole({ userId: 'user-1', roleId: 'role-2', tenantId: 'tenant-2' });

      const roles = manager.getUserRoles('user-1', 'tenant-1');
      expect(roles.length).toBe(1);
      expect(roles[0].roleId).toBe('role-1');
    });

    it('should filter out expired assignments', () => {
      manager.createRole({ id: 'role-1', name: 'Role 1', tenantId: 'tenant-1' });

      manager.assignRole({
        userId: 'user-1',
        roleId: 'role-1',
        tenantId: 'tenant-1',
        expiresAt: new Date(Date.now() - 86400000), // expired
      });

      const roles = manager.getUserRoles('user-1', 'tenant-1');
      expect(roles.length).toBe(0);
    });

    it('should include non-expired assignments', () => {
      manager.createRole({ id: 'role-1', name: 'Role 1', tenantId: 'tenant-1' });

      manager.assignRole({
        userId: 'user-1',
        roleId: 'role-1',
        tenantId: 'tenant-1',
        expiresAt: new Date(Date.now() + 86400000), // not expired
      });

      const roles = manager.getUserRoles('user-1', 'tenant-1');
      expect(roles.length).toBe(1);
    });
  });

  describe('getUsersWithRole', () => {
    it('should get users with specific role', () => {
      manager.createRole({ id: 'role-1', name: 'Role 1', tenantId: 'tenant-1' });

      manager.assignRole({ userId: 'user-1', roleId: 'role-1', tenantId: 'tenant-1' });
      manager.assignRole({ userId: 'user-2', roleId: 'role-1', tenantId: 'tenant-1' });

      const users = manager.getUsersWithRole('role-1', 'tenant-1');
      expect(users.length).toBe(2);
    });

    it('should filter out expired assignments', () => {
      manager.createRole({ id: 'role-1', name: 'Role 1', tenantId: 'tenant-1' });

      manager.assignRole({
        userId: 'user-1',
        roleId: 'role-1',
        tenantId: 'tenant-1',
        expiresAt: new Date(Date.now() - 86400000),
      });

      const users = manager.getUsersWithRole('role-1', 'tenant-1');
      expect(users.length).toBe(0);
    });
  });

  describe('userHasRole', () => {
    it('should return true when user has role', () => {
      manager.createRole({ id: 'role-1', name: 'Role 1', tenantId: 'tenant-1' });
      manager.assignRole({ userId: 'user-1', roleId: 'role-1', tenantId: 'tenant-1' });

      expect(manager.userHasRole('user-1', 'role-1', 'tenant-1')).toBe(true);
    });

    it('should return false when user does not have role', () => {
      manager.createRole({ id: 'role-1', name: 'Role 1', tenantId: 'tenant-1' });

      expect(manager.userHasRole('user-1', 'role-1', 'tenant-1')).toBe(false);
    });

    it('should check scope', () => {
      manager.createRole({ id: 'role-1', name: 'Role 1', tenantId: 'tenant-1' });
      manager.assignRole({
        userId: 'user-1',
        roleId: 'role-1',
        tenantId: 'tenant-1',
        scope: 'project-1',
      });

      expect(manager.userHasRole('user-1', 'role-1', 'tenant-1', 'project-1')).toBe(true);
      expect(manager.userHasRole('user-1', 'role-1', 'tenant-1', 'project-2')).toBe(false);
    });

    it('should match global scope when assignment has no scope', () => {
      manager.createRole({ id: 'role-1', name: 'Role 1', tenantId: 'tenant-1' });
      manager.assignRole({
        userId: 'user-1',
        roleId: 'role-1',
        tenantId: 'tenant-1',
      });

      expect(manager.userHasRole('user-1', 'role-1', 'tenant-1', 'project-1')).toBe(true);
    });
  });

  describe('getUserEffectivePermissions', () => {
    it('should get all effective permissions for user', () => {
      manager.createRole({
        id: 'role-1',
        name: 'Role 1',
        permissions: ['perm-1', 'perm-2'],
        tenantId: 'tenant-1',
      });

      manager.createRole({
        id: 'role-2',
        name: 'Role 2',
        permissions: ['perm-3'],
        tenantId: 'tenant-1',
      });

      manager.assignRole({ userId: 'user-1', roleId: 'role-1', tenantId: 'tenant-1' });
      manager.assignRole({ userId: 'user-1', roleId: 'role-2', tenantId: 'tenant-1' });

      const permissions = manager.getUserEffectivePermissions('user-1', 'tenant-1');
      expect(permissions).toContain('perm-1');
      expect(permissions).toContain('perm-2');
      expect(permissions).toContain('perm-3');
    });

    it('should include inherited permissions', () => {
      manager.createRole({
        id: 'parent-role',
        name: 'Parent',
        permissions: ['perm-parent'],
        tenantId: 'tenant-1',
      });

      manager.createRole({
        id: 'child-role',
        name: 'Child',
        permissions: ['perm-child'],
        parentRoles: ['parent-role'],
        tenantId: 'tenant-1',
      });

      manager.assignRole({ userId: 'user-1', roleId: 'child-role', tenantId: 'tenant-1' });

      const permissions = manager.getUserEffectivePermissions('user-1', 'tenant-1');
      expect(permissions).toContain('perm-child');
      expect(permissions).toContain('perm-parent');
    });

    it('should deduplicate permissions', () => {
      manager.createRole({
        id: 'role-1',
        name: 'Role 1',
        permissions: ['perm-shared'],
        tenantId: 'tenant-1',
      });

      manager.createRole({
        id: 'role-2',
        name: 'Role 2',
        permissions: ['perm-shared'],
        tenantId: 'tenant-1',
      });

      manager.assignRole({ userId: 'user-1', roleId: 'role-1', tenantId: 'tenant-1' });
      manager.assignRole({ userId: 'user-1', roleId: 'role-2', tenantId: 'tenant-1' });

      const permissions = manager.getUserEffectivePermissions('user-1', 'tenant-1');
      expect(permissions.filter(p => p === 'perm-shared').length).toBe(1);
    });
  });

  describe('createSystemRoles', () => {
    it('should create all system roles', () => {
      const systemRoles = manager.createSystemRoles('tenant-1');

      expect(systemRoles.length).toBe(4);
      expect(systemRoles.map(r => r.id)).toContain(SYSTEM_ROLES.SUPER_ADMIN);
      expect(systemRoles.map(r => r.id)).toContain(SYSTEM_ROLES.ADMIN);
      expect(systemRoles.map(r => r.id)).toContain(SYSTEM_ROLES.USER);
      expect(systemRoles.map(r => r.id)).toContain(SYSTEM_ROLES.GUEST);
    });

    it('should mark roles as system roles', () => {
      const systemRoles = manager.createSystemRoles();
      expect(systemRoles.every(r => r.isSystem)).toBe(true);
    });

    it('should not recreate existing system roles', () => {
      manager.createSystemRoles('tenant-1');
      const secondRoles = manager.createSystemRoles('tenant-1');

      expect(secondRoles.length).toBe(4);
      expect(manager.getRoles('tenant-1').length).toBe(4);
    });

    it('should give super admin wildcard permission', () => {
      const systemRoles = manager.createSystemRoles();
      const superAdmin = systemRoles.find(r => r.id === SYSTEM_ROLES.SUPER_ADMIN);

      expect(superAdmin?.permissions).toContain('*');
    });
  });

  describe('singleton', () => {
    it('should return the same instance', () => {
      resetRoleManager();
      const instance1 = getRoleManager();
      const instance2 = getRoleManager();
      expect(instance1).toBe(instance2);
    });

    it('should create new instance after reset', () => {
      const instance1 = getRoleManager();
      resetRoleManager();
      const instance2 = getRoleManager();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('importRoles', () => {
    it('should import roles', () => {
      const now = new Date();
      const roles: Role[] = [
        { id: 'role-1', name: 'Role 1', permissions: [], createdAt: now, updatedAt: now },
        { id: 'role-2', name: 'Role 2', permissions: [], createdAt: now, updatedAt: now },
      ];

      manager.importRoles(roles);

      expect(manager.getRole('role-1')?.name).toBe('Role 1');
      expect(manager.getRole('role-2')?.name).toBe('Role 2');
    });
  });

  describe('importAssignments', () => {
    it('should import assignments', () => {
      manager.createRole({ id: 'role-1', name: 'Test', tenantId: 'tenant-1' });

      const assignments: UserRoleAssignment[] = [
        {
          userId: 'user-1',
          roleId: 'role-1',
          tenantId: 'tenant-1',
          assignedAt: new Date(),
        },
      ];

      manager.importAssignments(assignments);

      expect(manager.getUserRoles('user-1', 'tenant-1').length).toBe(1);
    });
  });

  describe('clear', () => {
    it('should clear all roles and assignments', () => {
      manager.createRole({ id: 'role-1', name: 'Test', tenantId: 'tenant-1' });
      manager.assignRole({ userId: 'user-1', roleId: 'role-1', tenantId: 'tenant-1' });

      manager.clear();

      expect(manager.getRoles().length).toBe(0);
      expect(manager.getUserRoles('user-1', 'tenant-1').length).toBe(0);
    });
  });
});
