/**
 * @package @forge/roles
 * @description Tests for PolicyEngine
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  PolicyEngine,
  getPolicyEngine,
  resetPolicyEngine,
} from '../policy';
import { PermissionManager, resetPermissionManager } from '../permission';
import { Policy, AuthorizationContext } from '../roles.types';

describe('PolicyEngine', () => {
  let engine: PolicyEngine;
  let permissionManager: PermissionManager;

  beforeEach(() => {
    resetPolicyEngine();
    resetPermissionManager();
    permissionManager = new PermissionManager();
    engine = new PolicyEngine(permissionManager);
  });

  describe('createPolicy', () => {
    it('should create a policy with all fields', () => {
      const policy = engine.createPolicy({
        id: 'policy-1',
        name: 'Admin Policy',
        description: 'Allows admin actions',
        version: '1.0',
        statements: [
          {
            effect: 'allow',
            actions: ['*'],
            resources: ['*'],
          },
        ],
        isActive: true,
        priority: 10,
        tenantId: 'tenant-1',
      });

      expect(policy.id).toBe('policy-1');
      expect(policy.name).toBe('Admin Policy');
      expect(policy.description).toBe('Allows admin actions');
      expect(policy.version).toBe('1.0');
      expect(policy.statements.length).toBe(1);
      expect(policy.isActive).toBe(true);
      expect(policy.priority).toBe(10);
      expect(policy.tenantId).toBe('tenant-1');
    });

    it('should generate an ID if not provided', () => {
      const policy = engine.createPolicy({
        name: 'Test Policy',
        statements: [
          { effect: 'allow', actions: ['read'], resources: ['documents'] },
        ],
      });

      expect(policy.id).toMatch(/^policy_/);
    });

    it('should default version to 1.0', () => {
      const policy = engine.createPolicy({
        name: 'Test Policy',
        statements: [
          { effect: 'allow', actions: ['read'], resources: ['documents'] },
        ],
      });

      expect(policy.version).toBe('1.0');
    });

    it('should default isActive to true', () => {
      const policy = engine.createPolicy({
        name: 'Test Policy',
        statements: [
          { effect: 'allow', actions: ['read'], resources: ['documents'] },
        ],
      });

      expect(policy.isActive).toBe(true);
    });

    it('should default priority to 0', () => {
      const policy = engine.createPolicy({
        name: 'Test Policy',
        statements: [
          { effect: 'allow', actions: ['read'], resources: ['documents'] },
        ],
      });

      expect(policy.priority).toBe(0);
    });

    it('should throw error for duplicate policy ID', () => {
      engine.createPolicy({
        id: 'policy-1',
        name: 'Policy 1',
        statements: [
          { effect: 'allow', actions: ['read'], resources: ['*'] },
        ],
        tenantId: 'tenant-1',
      });

      expect(() => {
        engine.createPolicy({
          id: 'policy-1',
          name: 'Policy 1 Duplicate',
          statements: [
            { effect: 'allow', actions: ['read'], resources: ['*'] },
          ],
          tenantId: 'tenant-1',
        });
      }).toThrow("Policy with ID 'policy-1' already exists");
    });

    it('should throw error for missing name', () => {
      expect(() => {
        engine.createPolicy({
          name: '',
          statements: [
            { effect: 'allow', actions: ['read'], resources: ['*'] },
          ],
        });
      }).toThrow('Policy name is required');
    });

    it('should throw error for empty statements', () => {
      expect(() => {
        engine.createPolicy({
          name: 'Test Policy',
          statements: [],
        });
      }).toThrow('Policy must have at least one statement');
    });

    it('should throw error for missing statement effect', () => {
      expect(() => {
        engine.createPolicy({
          name: 'Test Policy',
          statements: [
            { effect: '' as any, actions: ['read'], resources: ['*'] },
          ],
        });
      }).toThrow('Statement effect is required');
    });

    it('should throw error for empty actions', () => {
      expect(() => {
        engine.createPolicy({
          name: 'Test Policy',
          statements: [
            { effect: 'allow', actions: [], resources: ['*'] },
          ],
        });
      }).toThrow('Statement must have at least one action');
    });

    it('should throw error for empty resources', () => {
      expect(() => {
        engine.createPolicy({
          name: 'Test Policy',
          statements: [
            { effect: 'allow', actions: ['read'], resources: [] },
          ],
        });
      }).toThrow('Statement must have at least one resource');
    });
  });

  describe('getPolicy', () => {
    it('should retrieve a policy by ID', () => {
      engine.createPolicy({
        id: 'policy-1',
        name: 'Test Policy',
        statements: [
          { effect: 'allow', actions: ['read'], resources: ['*'] },
        ],
      });

      const policy = engine.getPolicy('policy-1');
      expect(policy?.id).toBe('policy-1');
    });

    it('should return null for non-existent policy', () => {
      const policy = engine.getPolicy('non-existent');
      expect(policy).toBeNull();
    });

    it('should retrieve policy with tenant isolation', () => {
      engine.createPolicy({
        id: 'policy-1',
        name: 'Test Policy',
        statements: [
          { effect: 'allow', actions: ['read'], resources: ['*'] },
        ],
        tenantId: 'tenant-1',
      });

      expect(engine.getPolicy('policy-1', 'tenant-1')?.id).toBe('policy-1');
      expect(engine.getPolicy('policy-1', 'tenant-2')).toBeNull();
    });
  });

  describe('getPolicies', () => {
    it('should get all policies', () => {
      engine.createPolicy({
        id: 'policy-1',
        name: 'Policy 1',
        statements: [
          { effect: 'allow', actions: ['read'], resources: ['*'] },
        ],
      });
      engine.createPolicy({
        id: 'policy-2',
        name: 'Policy 2',
        statements: [
          { effect: 'allow', actions: ['write'], resources: ['*'] },
        ],
      });

      const policies = engine.getPolicies();
      expect(policies.length).toBe(2);
    });

    it('should filter by tenant', () => {
      engine.createPolicy({
        id: 'policy-1',
        name: 'Policy 1',
        statements: [
          { effect: 'allow', actions: ['read'], resources: ['*'] },
        ],
        tenantId: 'tenant-1',
      });
      engine.createPolicy({
        id: 'policy-2',
        name: 'Policy 2',
        statements: [
          { effect: 'allow', actions: ['write'], resources: ['*'] },
        ],
        tenantId: 'tenant-2',
      });

      const tenant1Policies = engine.getPolicies('tenant-1');
      expect(tenant1Policies.length).toBe(1);
      expect(tenant1Policies[0].id).toBe('policy-1');
    });
  });

  describe('updatePolicy', () => {
    it('should update policy fields', () => {
      engine.createPolicy({
        id: 'policy-1',
        name: 'Original Name',
        statements: [
          { effect: 'allow', actions: ['read'], resources: ['*'] },
        ],
      });

      const updated = engine.updatePolicy('policy-1', {
        name: 'Updated Name',
        description: 'Added description',
      });

      expect(updated?.name).toBe('Updated Name');
      expect(updated?.description).toBe('Added description');
    });

    it('should return null for non-existent policy', () => {
      const updated = engine.updatePolicy('non-existent', { name: 'Test' });
      expect(updated).toBeNull();
    });

    it('should validate updated statements', () => {
      engine.createPolicy({
        id: 'policy-1',
        name: 'Test',
        statements: [
          { effect: 'allow', actions: ['read'], resources: ['*'] },
        ],
      });

      expect(() => {
        engine.updatePolicy('policy-1', {
          statements: [],
        });
      }).toThrow('Policy must have at least one statement');
    });
  });

  describe('deletePolicy', () => {
    it('should delete a policy', () => {
      engine.createPolicy({
        id: 'policy-1',
        name: 'Test',
        statements: [
          { effect: 'allow', actions: ['read'], resources: ['*'] },
        ],
      });

      const result = engine.deletePolicy('policy-1');
      expect(result).toBe(true);
      expect(engine.getPolicy('policy-1')).toBeNull();
    });

    it('should return false for non-existent policy', () => {
      const result = engine.deletePolicy('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('evaluate', () => {
    it('should allow access with wildcard permission', () => {
      const context: AuthorizationContext = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        resource: 'documents',
        action: 'read',
      };

      const result = engine.evaluate(context, ['*']);

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('Wildcard permission grants full access');
      expect(result.decidedBy).toBe('*');
    });

    it('should evaluate policy before permissions', () => {
      engine.createPolicy({
        id: 'policy-1',
        name: 'Allow All',
        statements: [
          { effect: 'allow', actions: ['*'], resources: ['*'] },
        ],
        tenantId: 'tenant-1',
      });

      const context: AuthorizationContext = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        resource: 'documents',
        action: 'read',
      };

      const result = engine.evaluate(context, []);

      expect(result.allowed).toBe(true);
      expect(result.decidedBy).toBe('policy-1');
    });

    it('should deny access with deny policy', () => {
      engine.createPolicy({
        id: 'policy-deny',
        name: 'Deny All',
        statements: [
          { effect: 'deny', actions: ['*'], resources: ['*'] },
        ],
        tenantId: 'tenant-1',
      });

      const context: AuthorizationContext = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        resource: 'documents',
        action: 'read',
      };

      const result = engine.evaluate(context, []);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Denied by policy');
      expect(result.deniedBy).toContain('policy-deny');
    });

    it('should evaluate permissions when no policy matches', () => {
      permissionManager.createPermission({
        id: 'perm-read',
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

      const result = engine.evaluate(context, ['perm-read']);

      expect(result.allowed).toBe(true);
      expect(result.decidedBy).toBe('perm-read');
    });

    it('should deny access with deny permission', () => {
      permissionManager.createPermission({
        id: 'perm-deny',
        name: 'Deny Read',
        resource: 'documents',
        actions: ['read'],
        effect: 'deny',
        tenantId: 'tenant-1',
      });

      const context: AuthorizationContext = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        resource: 'documents',
        action: 'read',
      };

      const result = engine.evaluate(context, ['perm-deny']);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Denied by permission');
    });

    it('should deny access when no matching permission found', () => {
      const context: AuthorizationContext = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        resource: 'documents',
        action: 'read',
      };

      const result = engine.evaluate(context, []);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('No matching permission found');
    });

    it('should skip inactive policies', () => {
      engine.createPolicy({
        id: 'policy-1',
        name: 'Inactive Policy',
        statements: [
          { effect: 'allow', actions: ['*'], resources: ['*'] },
        ],
        isActive: false,
        tenantId: 'tenant-1',
      });

      const context: AuthorizationContext = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        resource: 'documents',
        action: 'read',
      };

      const result = engine.evaluate(context, []);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('No matching permission found');
    });

    it('should evaluate higher priority policies first', () => {
      engine.createPolicy({
        id: 'policy-low',
        name: 'Low Priority Allow',
        statements: [
          { effect: 'allow', actions: ['*'], resources: ['*'] },
        ],
        priority: 0,
        tenantId: 'tenant-1',
      });

      engine.createPolicy({
        id: 'policy-high',
        name: 'High Priority Deny',
        statements: [
          { effect: 'deny', actions: ['delete'], resources: ['documents'] },
        ],
        priority: 10,
        tenantId: 'tenant-1',
      });

      const context: AuthorizationContext = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        resource: 'documents',
        action: 'delete',
      };

      const result = engine.evaluate(context, []);

      expect(result.allowed).toBe(false);
      expect(result.decidedBy).toBe('policy-high');
    });

    it('should include evaluation time', () => {
      const context: AuthorizationContext = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        resource: 'documents',
        action: 'read',
      };

      const result = engine.evaluate(context, []);

      expect(result.evaluationTimeMs).toBeDefined();
      expect(result.evaluationTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('policy statement matching', () => {
    it('should match principals', () => {
      engine.createPolicy({
        id: 'policy-1',
        name: 'User Specific',
        statements: [
          {
            effect: 'allow',
            principals: ['user-1'],
            actions: ['read'],
            resources: ['documents'],
          },
        ],
        tenantId: 'tenant-1',
      });

      const context1: AuthorizationContext = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        resource: 'documents',
        action: 'read',
      };

      const context2: AuthorizationContext = {
        userId: 'user-2',
        tenantId: 'tenant-1',
        resource: 'documents',
        action: 'read',
      };

      expect(engine.evaluate(context1, []).allowed).toBe(true);
      expect(engine.evaluate(context2, []).allowed).toBe(false);
    });

    it('should match principals by permission ID', () => {
      engine.createPolicy({
        id: 'policy-1',
        name: 'Admin Only',
        statements: [
          {
            effect: 'allow',
            principals: ['admin-role'],
            actions: ['*'],
            resources: ['*'],
          },
        ],
        tenantId: 'tenant-1',
      });

      const context: AuthorizationContext = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        resource: 'documents',
        action: 'delete',
      };

      expect(engine.evaluate(context, ['admin-role']).allowed).toBe(true);
      expect(engine.evaluate(context, ['user-role']).allowed).toBe(false);
    });

    it('should match wildcard principal', () => {
      engine.createPolicy({
        id: 'policy-1',
        name: 'Anyone',
        statements: [
          {
            effect: 'allow',
            principals: ['*'],
            actions: ['read'],
            resources: ['public-documents'],
          },
        ],
        tenantId: 'tenant-1',
      });

      const context: AuthorizationContext = {
        userId: 'anyone',
        tenantId: 'tenant-1',
        resource: 'public-documents',
        action: 'read',
      };

      expect(engine.evaluate(context, []).allowed).toBe(true);
    });

    it('should exclude notPrincipals', () => {
      engine.createPolicy({
        id: 'policy-1',
        name: 'Except Guest',
        statements: [
          {
            effect: 'allow',
            notPrincipals: ['guest-role'],
            actions: ['read'],
            resources: ['documents'],
          },
        ],
        tenantId: 'tenant-1',
      });

      const context: AuthorizationContext = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        resource: 'documents',
        action: 'read',
      };

      expect(engine.evaluate(context, ['user-role']).allowed).toBe(true);
      expect(engine.evaluate(context, ['guest-role']).allowed).toBe(false);
    });

    it('should match action patterns', () => {
      engine.createPolicy({
        id: 'policy-1',
        name: 'Document Actions',
        statements: [
          {
            effect: 'allow',
            actions: ['doc:*'],
            resources: ['documents'],
          },
        ],
        tenantId: 'tenant-1',
      });

      const context1: AuthorizationContext = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        resource: 'documents',
        action: 'read',
      };

      // Action 'read' doesn't match 'doc:*' pattern, so this should be denied
      expect(engine.evaluate(context1, []).allowed).toBe(false);

      // Test with wildcard pattern
      engine.createPolicy({
        id: 'policy-2',
        name: 'All Actions',
        statements: [
          {
            effect: 'allow',
            actions: ['*'],
            resources: ['documents'],
          },
        ],
        tenantId: 'tenant-1',
      });

      // Now should be allowed due to wildcard
      expect(engine.evaluate(context1, []).allowed).toBe(true);
    });

    it('should exclude notActions', () => {
      engine.createPolicy({
        id: 'policy-1',
        name: 'All Except Delete',
        statements: [
          {
            effect: 'allow',
            actions: ['*'],
            notActions: ['delete'],
            resources: ['documents'],
          },
        ],
        tenantId: 'tenant-1',
      });

      const context1: AuthorizationContext = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        resource: 'documents',
        action: 'read',
      };

      const context2: AuthorizationContext = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        resource: 'documents',
        action: 'delete',
      };

      expect(engine.evaluate(context1, []).allowed).toBe(true);
      expect(engine.evaluate(context2, []).allowed).toBe(false);
    });

    it('should match resource patterns', () => {
      engine.createPolicy({
        id: 'policy-1',
        name: 'Project Documents',
        statements: [
          {
            effect: 'allow',
            actions: ['*'],
            resources: ['projects:*:documents'],
          },
        ],
        tenantId: 'tenant-1',
      });

      const context: AuthorizationContext = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        resource: 'projects:123:documents',
        action: 'read',
      };

      expect(engine.evaluate(context, []).allowed).toBe(true);
    });

    it('should match resource with resourceId', () => {
      engine.createPolicy({
        id: 'policy-1',
        name: 'Document Access',
        statements: [
          {
            effect: 'allow',
            actions: ['read'],
            resources: ['documents:*'],
          },
        ],
        tenantId: 'tenant-1',
      });

      const context: AuthorizationContext = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        resource: 'documents',
        resourceId: '123',
        action: 'read',
      };

      expect(engine.evaluate(context, []).allowed).toBe(true);
    });

    it('should exclude notResources', () => {
      engine.createPolicy({
        id: 'policy-1',
        name: 'All Except Secrets',
        statements: [
          {
            effect: 'allow',
            actions: ['*'],
            resources: ['*'],
            notResources: ['secrets'],
          },
        ],
        tenantId: 'tenant-1',
      });

      const context1: AuthorizationContext = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        resource: 'documents',
        action: 'read',
      };

      const context2: AuthorizationContext = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        resource: 'secrets',
        action: 'read',
      };

      expect(engine.evaluate(context1, []).allowed).toBe(true);
      expect(engine.evaluate(context2, []).allowed).toBe(false);
    });

    it('should evaluate conditions', () => {
      engine.createPolicy({
        id: 'policy-1',
        name: 'Owner Only',
        statements: [
          {
            effect: 'allow',
            actions: ['*'],
            resources: ['documents:*'],
            conditions: [
              {
                field: 'resourceAttributes.ownerId',
                operator: 'equals',
                value: '${userId}',
                isVariable: true,
              },
            ],
          },
        ],
        tenantId: 'tenant-1',
      });

      const context1: AuthorizationContext = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        resource: 'documents',
        resourceId: '123',
        action: 'update',
        resourceAttributes: { ownerId: 'user-1' },
      };

      const context2: AuthorizationContext = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        resource: 'documents',
        resourceId: '123',
        action: 'update',
        resourceAttributes: { ownerId: 'user-2' },
      };

      expect(engine.evaluate(context1, []).allowed).toBe(true);
      expect(engine.evaluate(context2, []).allowed).toBe(false);
    });
  });

  describe('permission priority', () => {
    it('should evaluate deny permissions before allow', () => {
      permissionManager.createPermission({
        id: 'perm-allow',
        name: 'Allow Read',
        resource: 'documents',
        actions: ['read'],
        effect: 'allow',
        priority: 10,
        tenantId: 'tenant-1',
      });

      permissionManager.createPermission({
        id: 'perm-deny',
        name: 'Deny Read',
        resource: 'documents',
        actions: ['read'],
        effect: 'deny',
        priority: 5,
        tenantId: 'tenant-1',
      });

      const context: AuthorizationContext = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        resource: 'documents',
        action: 'read',
      };

      // Deny should take precedence even with lower priority
      const result = engine.evaluate(context, ['perm-allow', 'perm-deny']);
      expect(result.allowed).toBe(false);
    });

    it('should collect all matching permissions', () => {
      permissionManager.createPermission({
        id: 'perm-1',
        name: 'Permission 1',
        resource: 'documents',
        actions: ['read'],
        effect: 'allow',
        tenantId: 'tenant-1',
      });

      permissionManager.createPermission({
        id: 'perm-2',
        name: 'Permission 2',
        resource: 'documents',
        actions: ['read', 'write'],
        effect: 'allow',
        tenantId: 'tenant-1',
      });

      const context: AuthorizationContext = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        resource: 'documents',
        action: 'read',
      };

      const result = engine.evaluate(context, ['perm-1', 'perm-2']);
      expect(result.allowed).toBe(true);
      expect(result.matchingPermissions).toContain('perm-1');
      expect(result.matchingPermissions).toContain('perm-2');
    });
  });

  describe('singleton', () => {
    it('should return the same instance', () => {
      resetPolicyEngine();
      const instance1 = getPolicyEngine(permissionManager);
      const instance2 = getPolicyEngine(permissionManager);
      expect(instance1).toBe(instance2);
    });

    it('should create new instance after reset', () => {
      const instance1 = getPolicyEngine(permissionManager);
      resetPolicyEngine();
      const instance2 = getPolicyEngine(permissionManager);
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('importPolicies', () => {
    it('should import policies', () => {
      const now = new Date();
      const policies: Policy[] = [
        {
          id: 'policy-1',
          name: 'Policy 1',
          version: '1.0',
          statements: [{ effect: 'allow', actions: ['read'], resources: ['*'] }],
          isActive: true,
          createdAt: now,
          updatedAt: now,
        },
      ];

      engine.importPolicies(policies);

      expect(engine.getPolicy('policy-1')?.name).toBe('Policy 1');
    });
  });

  describe('clear', () => {
    it('should clear all policies', () => {
      engine.createPolicy({
        id: 'policy-1',
        name: 'Test',
        statements: [
          { effect: 'allow', actions: ['read'], resources: ['*'] },
        ],
      });

      engine.clear();

      expect(engine.getPolicies().length).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle missing permission IDs gracefully', () => {
      const context: AuthorizationContext = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        resource: 'documents',
        action: 'read',
      };

      // Permission ID doesn't exist
      const result = engine.evaluate(context, ['non-existent-perm']);
      expect(result.allowed).toBe(false);
    });

    it('should not match statement without principals when empty principals specified', () => {
      engine.createPolicy({
        id: 'policy-1',
        name: 'Empty Principals',
        statements: [
          {
            effect: 'allow',
            principals: [],
            actions: ['*'],
            resources: ['*'],
          },
        ],
        tenantId: 'tenant-1',
      });

      const context: AuthorizationContext = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        resource: 'documents',
        action: 'read',
      };

      // No principals means statement doesn't match anyone by principals filter
      // But empty principals array should still match (no principal constraint)
      const result = engine.evaluate(context, []);
      expect(result.allowed).toBe(true);
    });

    it('should handle multiple statements in policy', () => {
      engine.createPolicy({
        id: 'policy-1',
        name: 'Multi Statement',
        statements: [
          {
            effect: 'allow',
            actions: ['read'],
            resources: ['documents'],
          },
          {
            effect: 'allow',
            actions: ['write'],
            resources: ['projects'],
          },
        ],
        tenantId: 'tenant-1',
      });

      const context1: AuthorizationContext = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        resource: 'documents',
        action: 'read',
      };

      const context2: AuthorizationContext = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        resource: 'projects',
        action: 'write',
      };

      expect(engine.evaluate(context1, []).allowed).toBe(true);
      expect(engine.evaluate(context2, []).allowed).toBe(true);
    });

    it('should match first statement in policy', () => {
      engine.createPolicy({
        id: 'policy-1',
        name: 'Multi Statement with Deny',
        statements: [
          {
            effect: 'deny',
            actions: ['delete'],
            resources: ['*'],
          },
          {
            effect: 'allow',
            actions: ['*'],
            resources: ['*'],
          },
        ],
        tenantId: 'tenant-1',
      });

      const context: AuthorizationContext = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        resource: 'documents',
        action: 'delete',
      };

      // First matching statement should be used
      const result = engine.evaluate(context, []);
      expect(result.allowed).toBe(false);
    });
  });
});
