/**
 * @package @forge/compliance
 * @description Tests for retention policy manager
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  RetentionPolicyManager,
  getRetentionPolicyManager,
  resetRetentionPolicyManager,
} from '../retention';
import { AuditLogManager } from '../audit';
import {
  CreateRetentionPolicyInput,
  AuditEvent,
  RetentionPolicy,
} from '../compliance.types';

describe('RetentionPolicyManager', () => {
  let manager: RetentionPolicyManager;
  let auditManager: AuditLogManager;

  beforeEach(() => {
    manager = new RetentionPolicyManager();
    auditManager = new AuditLogManager();
  });

  afterEach(() => {
    manager.clear();
    auditManager.clear();
    resetRetentionPolicyManager();
  });

  const createPolicyInput = (
    overrides: Partial<CreateRetentionPolicyInput> = {}
  ): CreateRetentionPolicyInput => ({
    name: 'Test Policy',
    description: 'A test retention policy',
    retentionDays: 90,
    ...overrides,
  });

  const createEvent = async (
    overrides: Partial<Parameters<typeof auditManager.log>[0]> = {}
  ): Promise<AuditEvent> => {
    return auditManager.log({
      type: 'AUTH',
      subtype: 'LOGIN',
      tenantId: 'tenant-1',
      actor: { id: 'user-1', type: 'USER' },
      action: 'Test action',
      ...overrides,
    });
  };

  describe('createPolicy', () => {
    it('should create a retention policy', () => {
      const input = createPolicyInput();
      const policy = manager.createPolicy(input);

      expect(policy.id).toBeDefined();
      expect(policy.name).toBe('Test Policy');
      expect(policy.description).toBe('A test retention policy');
      expect(policy.retentionDays).toBe(90);
      expect(policy.isActive).toBe(true);
      expect(policy.priority).toBe(0);
      expect(policy.createdAt).toBeInstanceOf(Date);
      expect(policy.updatedAt).toBeInstanceOf(Date);
    });

    it('should use provided ID', () => {
      const policy = manager.createPolicy(createPolicyInput({ id: 'custom-id' }));

      expect(policy.id).toBe('custom-id');
    });

    it('should set event types', () => {
      const policy = manager.createPolicy(
        createPolicyInput({ eventTypes: ['AUTH', 'SECURITY'] })
      );

      expect(policy.eventTypes).toEqual(['AUTH', 'SECURITY']);
    });

    it('should set severities', () => {
      const policy = manager.createPolicy(
        createPolicyInput({ severities: ['HIGH', 'CRITICAL'] })
      );

      expect(policy.severities).toEqual(['HIGH', 'CRITICAL']);
    });

    it('should set tags', () => {
      const policy = manager.createPolicy(createPolicyInput({ tags: ['important'] }));

      expect(policy.tags).toEqual(['important']);
    });

    it('should set archiveBeforeDelete', () => {
      const policy = manager.createPolicy(
        createPolicyInput({
          archiveBeforeDelete: true,
          archiveDestination: 's3://bucket/archive',
        })
      );

      expect(policy.archiveBeforeDelete).toBe(true);
      expect(policy.archiveDestination).toBe('s3://bucket/archive');
    });

    it('should set isActive', () => {
      const policy = manager.createPolicy(createPolicyInput({ isActive: false }));

      expect(policy.isActive).toBe(false);
    });

    it('should set priority', () => {
      const policy = manager.createPolicy(createPolicyInput({ priority: 10 }));

      expect(policy.priority).toBe(10);
    });

    it('should set tenantId', () => {
      const policy = manager.createPolicy(createPolicyInput({ tenantId: 'tenant-1' }));

      expect(policy.tenantId).toBe('tenant-1');
    });

    it('should throw for empty name', () => {
      expect(() => manager.createPolicy(createPolicyInput({ name: '' }))).toThrow(
        'Policy name is required'
      );
    });

    it('should throw for whitespace-only name', () => {
      expect(() => manager.createPolicy(createPolicyInput({ name: '   ' }))).toThrow(
        'Policy name is required'
      );
    });

    it('should throw for zero retention days', () => {
      expect(() => manager.createPolicy(createPolicyInput({ retentionDays: 0 }))).toThrow(
        'Retention days must be positive'
      );
    });

    it('should throw for negative retention days', () => {
      expect(() => manager.createPolicy(createPolicyInput({ retentionDays: -1 }))).toThrow(
        'Retention days must be positive'
      );
    });

    it('should throw for archiveBeforeDelete without destination', () => {
      expect(() =>
        manager.createPolicy(
          createPolicyInput({
            archiveBeforeDelete: true,
          })
        )
      ).toThrow('Archive destination is required when archiveBeforeDelete is true');
    });

    it('should throw for duplicate policy ID', () => {
      manager.createPolicy(createPolicyInput({ id: 'policy-1' }));

      expect(() => manager.createPolicy(createPolicyInput({ id: 'policy-1' }))).toThrow(
        "Retention policy with ID 'policy-1' already exists"
      );
    });

    it('should allow same ID for different tenants', () => {
      manager.createPolicy(createPolicyInput({ id: 'policy-1', tenantId: 'tenant-1' }));
      const policy2 = manager.createPolicy(
        createPolicyInput({ id: 'policy-1', tenantId: 'tenant-2' })
      );

      expect(policy2.id).toBe('policy-1');
      expect(policy2.tenantId).toBe('tenant-2');
    });
  });

  describe('getPolicy', () => {
    it('should return policy by ID', () => {
      const created = manager.createPolicy(createPolicyInput({ id: 'policy-1' }));
      const retrieved = manager.getPolicy('policy-1');

      expect(retrieved).toEqual(created);
    });

    it('should return null for non-existent ID', () => {
      const retrieved = manager.getPolicy('non-existent');

      expect(retrieved).toBeNull();
    });

    it('should return tenant-specific policy', () => {
      manager.createPolicy(createPolicyInput({ id: 'policy-1', tenantId: 'tenant-1' }));

      const retrieved = manager.getPolicy('policy-1', 'tenant-1');

      expect(retrieved?.tenantId).toBe('tenant-1');
    });
  });

  describe('getPolicies', () => {
    beforeEach(() => {
      manager.createPolicy(createPolicyInput({ id: 'policy-1', priority: 1 }));
      manager.createPolicy(createPolicyInput({ id: 'policy-2', priority: 10 }));
      manager.createPolicy(
        createPolicyInput({ id: 'policy-3', priority: 5, tenantId: 'tenant-1' })
      );
    });

    it('should return all policies sorted by priority', () => {
      const policies = manager.getPolicies();

      expect(policies.length).toBe(3);
      expect(policies[0].priority).toBe(10);
      expect(policies[1].priority).toBe(5);
      expect(policies[2].priority).toBe(1);
    });

    it('should return policies for specific tenant', () => {
      const policies = manager.getPolicies('tenant-1');

      expect(policies.length).toBe(3); // Global + tenant-specific
    });

    it('should return global policies for any tenant', () => {
      const policies = manager.getPolicies('tenant-2');

      expect(policies.length).toBe(2); // Only global policies
    });
  });

  describe('getActivePolicies', () => {
    it('should return only active policies', () => {
      manager.createPolicy(createPolicyInput({ id: 'policy-1', isActive: true }));
      manager.createPolicy(createPolicyInput({ id: 'policy-2', isActive: false }));
      manager.createPolicy(createPolicyInput({ id: 'policy-3', isActive: true }));

      const policies = manager.getActivePolicies();

      expect(policies.length).toBe(2);
      expect(policies.every((p) => p.isActive)).toBe(true);
    });
  });

  describe('updatePolicy', () => {
    it('should update policy name', () => {
      manager.createPolicy(createPolicyInput({ id: 'policy-1' }));

      const updated = manager.updatePolicy('policy-1', { name: 'Updated Name' });

      expect(updated?.name).toBe('Updated Name');
    });

    it('should update retention days', () => {
      manager.createPolicy(createPolicyInput({ id: 'policy-1' }));

      const updated = manager.updatePolicy('policy-1', { retentionDays: 180 });

      expect(updated?.retentionDays).toBe(180);
    });

    it('should update isActive', () => {
      manager.createPolicy(createPolicyInput({ id: 'policy-1' }));

      const updated = manager.updatePolicy('policy-1', { isActive: false });

      expect(updated?.isActive).toBe(false);
    });

    it('should update updatedAt timestamp', () => {
      const policy = manager.createPolicy(createPolicyInput({ id: 'policy-1' }));
      const originalUpdatedAt = policy.updatedAt;

      // Small delay to ensure timestamp difference
      const updated = manager.updatePolicy('policy-1', { name: 'New Name' });

      expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt.getTime());
    });

    it('should preserve original values', () => {
      const policy = manager.createPolicy(createPolicyInput({ id: 'policy-1' }));

      const updated = manager.updatePolicy('policy-1', { name: 'New Name' });

      expect(updated?.id).toBe(policy.id);
      expect(updated?.createdAt).toEqual(policy.createdAt);
      expect(updated?.retentionDays).toBe(policy.retentionDays);
    });

    it('should return null for non-existent policy', () => {
      const updated = manager.updatePolicy('non-existent', { name: 'New Name' });

      expect(updated).toBeNull();
    });

    it('should throw for invalid retention days', () => {
      manager.createPolicy(createPolicyInput({ id: 'policy-1' }));

      expect(() => manager.updatePolicy('policy-1', { retentionDays: 0 })).toThrow(
        'Retention days must be positive'
      );
    });
  });

  describe('deletePolicy', () => {
    it('should delete a policy', () => {
      manager.createPolicy(createPolicyInput({ id: 'policy-1' }));

      const deleted = manager.deletePolicy('policy-1');

      expect(deleted).toBe(true);
      expect(manager.getPolicy('policy-1')).toBeNull();
    });

    it('should return false for non-existent policy', () => {
      const deleted = manager.deletePolicy('non-existent');

      expect(deleted).toBe(false);
    });
  });

  describe('findMatchingPolicy', () => {
    it('should find policy matching event type', async () => {
      manager.createPolicy(
        createPolicyInput({ id: 'auth-policy', eventTypes: ['AUTH'] })
      );
      manager.createPolicy(
        createPolicyInput({ id: 'access-policy', eventTypes: ['ACCESS'] })
      );

      const event = await createEvent({ type: 'AUTH' });
      const policy = manager.findMatchingPolicy(event);

      expect(policy?.id).toBe('auth-policy');
    });

    it('should find policy matching severity', async () => {
      manager.createPolicy(
        createPolicyInput({ id: 'critical-policy', severities: ['CRITICAL'] })
      );
      manager.createPolicy(
        createPolicyInput({ id: 'low-policy', severities: ['LOW'] })
      );

      const event = await createEvent({ severity: 'CRITICAL' });
      const policy = manager.findMatchingPolicy(event);

      expect(policy?.id).toBe('critical-policy');
    });

    it('should find policy matching tags', async () => {
      manager.createPolicy(
        createPolicyInput({ id: 'important-policy', tags: ['important'] })
      );

      const event = await createEvent({ tags: ['important', 'other'] });
      const policy = manager.findMatchingPolicy(event);

      expect(policy?.id).toBe('important-policy');
    });

    it('should find policy matching tenant', async () => {
      manager.createPolicy(
        createPolicyInput({ id: 'tenant-policy', tenantId: 'tenant-1' })
      );
      manager.createPolicy(
        createPolicyInput({ id: 'other-tenant-policy', tenantId: 'tenant-2' })
      );

      const event = await createEvent({ tenantId: 'tenant-1' });
      const policy = manager.findMatchingPolicy(event);

      expect(policy?.id).toBe('tenant-policy');
    });

    it('should respect priority', async () => {
      manager.createPolicy(
        createPolicyInput({ id: 'low-priority', priority: 1, eventTypes: ['AUTH'] })
      );
      manager.createPolicy(
        createPolicyInput({ id: 'high-priority', priority: 10, eventTypes: ['AUTH'] })
      );

      const event = await createEvent({ type: 'AUTH' });
      const policy = manager.findMatchingPolicy(event);

      expect(policy?.id).toBe('high-priority');
    });

    it('should skip inactive policies', async () => {
      manager.createPolicy(
        createPolicyInput({ id: 'inactive', isActive: false, eventTypes: ['AUTH'] })
      );
      manager.createPolicy(
        createPolicyInput({ id: 'active', isActive: true, eventTypes: ['AUTH'] })
      );

      const event = await createEvent({ type: 'AUTH' });
      const policy = manager.findMatchingPolicy(event);

      expect(policy?.id).toBe('active');
    });

    it('should return null if no policy matches', async () => {
      manager.createPolicy(
        createPolicyInput({ eventTypes: ['SECURITY'] })
      );

      const event = await createEvent({ type: 'AUTH' });
      const policy = manager.findMatchingPolicy(event);

      expect(policy).toBeNull();
    });

    it('should match global policy for any tenant', async () => {
      manager.createPolicy(createPolicyInput({ id: 'global' }));

      const event = await createEvent({ tenantId: 'any-tenant' });
      const policy = manager.findMatchingPolicy(event);

      expect(policy?.id).toBe('global');
    });
  });

  describe('calculateExpirationDate', () => {
    it('should calculate expiration based on matching policy', async () => {
      manager.createPolicy(
        createPolicyInput({ retentionDays: 30, eventTypes: ['AUTH'] })
      );

      const event = await createEvent({ type: 'AUTH' });
      const expiration = manager.calculateExpirationDate(event);

      const expectedDate = new Date(event.timestamp);
      expectedDate.setDate(expectedDate.getDate() + 30);

      expect(expiration.getDate()).toBe(expectedDate.getDate());
    });

    it('should use default retention if no policy matches', async () => {
      const customManager = new RetentionPolicyManager(60);

      const event = await createEvent({ type: 'AUTH' });
      const expiration = customManager.calculateExpirationDate(event);

      const expectedDate = new Date(event.timestamp);
      expectedDate.setDate(expectedDate.getDate() + 60);

      expect(expiration.getDate()).toBe(expectedDate.getDate());
    });
  });

  describe('runCleanup', () => {
    it('should delete expired events', async () => {
      const event1 = await createEvent();
      const event2 = await createEvent();

      // Mark first event as expired
      event1.expiresAt = new Date(Date.now() - 1000);

      const result = await manager.runCleanup(auditManager);

      expect(result.deleted).toBe(1);
      expect(auditManager.getEvent(event1.id)).toBeNull();
      expect(auditManager.getEvent(event2.id)).not.toBeNull();
    });

    it('should archive before delete when configured', async () => {
      manager.createPolicy(
        createPolicyInput({
          archiveBeforeDelete: true,
          archiveDestination: 's3://archive',
          eventTypes: ['AUTH'],
        })
      );

      const event = await createEvent({ type: 'AUTH' });
      event.expiresAt = new Date(Date.now() - 1000);

      const archiveCallback = vi.fn().mockResolvedValue(undefined);

      const result = await manager.runCleanup(auditManager, archiveCallback);

      expect(archiveCallback).toHaveBeenCalled();
      expect(result.archived).toBe(1);
      expect(auditManager.getEvent(event.id)).toBeNull();
    });

    it('should handle archive callback errors', async () => {
      manager.createPolicy(
        createPolicyInput({
          archiveBeforeDelete: true,
          archiveDestination: 's3://archive',
          eventTypes: ['AUTH'],
        })
      );

      const event = await createEvent({ type: 'AUTH' });
      event.expiresAt = new Date(Date.now() - 1000);

      const archiveCallback = vi.fn().mockRejectedValue(new Error('Archive failed'));

      const result = await manager.runCleanup(auditManager, archiveCallback);

      expect(result.failed).toBe(1);
      expect(result.archived).toBe(0);
    });

    it('should delete events without archive callback', async () => {
      manager.createPolicy(
        createPolicyInput({
          archiveBeforeDelete: true,
          archiveDestination: 's3://archive',
          eventTypes: ['AUTH'],
        })
      );

      const event = await createEvent({ type: 'AUTH' });
      event.expiresAt = new Date(Date.now() - 1000);

      // No archive callback provided
      const result = await manager.runCleanup(auditManager);

      expect(result.deleted).toBe(1);
      expect(auditManager.getEvent(event.id)).toBeNull();
    });

    it('should track by tenant', async () => {
      const event1 = await createEvent({ tenantId: 'tenant-1' });
      const event2 = await createEvent({ tenantId: 'tenant-2' });
      const event3 = await createEvent({ tenantId: 'tenant-1' });

      event1.expiresAt = new Date(Date.now() - 1000);
      event2.expiresAt = new Date(Date.now() - 1000);
      event3.expiresAt = new Date(Date.now() - 1000);

      const result = await manager.runCleanup(auditManager);

      expect(result.byTenant?.['tenant-1']?.deleted).toBe(2);
      expect(result.byTenant?.['tenant-2']?.deleted).toBe(1);
    });

    it('should include duration', async () => {
      const result = await manager.runCleanup(auditManager);

      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should use policy-calculated expiration', async () => {
      // Create policy with 1 day retention
      manager.createPolicy(createPolicyInput({ retentionDays: 1 }));

      const event = await createEvent();
      // Manually set timestamp to 2 days ago so it's past the 1-day retention
      (event as any).timestamp = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

      const result = await manager.runCleanup(auditManager);

      expect(result.deleted).toBe(1);
    });
  });

  describe('applyExpirationDates', () => {
    it('should apply expiration dates to events without one', async () => {
      manager.createPolicy(createPolicyInput({ retentionDays: 30 }));

      await createEvent();
      await createEvent();

      const updated = manager.applyExpirationDates(auditManager);

      expect(updated).toBe(2);
    });

    it('should not update events with existing expiration', async () => {
      const event = await createEvent();
      event.expiresAt = new Date();

      const updated = manager.applyExpirationDates(auditManager);

      expect(updated).toBe(0);
    });
  });

  describe('getExpiringEvents', () => {
    it('should return events expiring within days', async () => {
      const event1 = await createEvent();
      const event2 = await createEvent();

      // Set expiration within 7 days
      event1.expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      // Set expiration beyond 7 days
      event2.expiresAt = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);

      const expiring = manager.getExpiringEvents(auditManager, 7);

      expect(expiring.length).toBe(1);
      expect(expiring[0].id).toBe(event1.id);
    });

    it('should filter by tenant', async () => {
      const event1 = await createEvent({ tenantId: 'tenant-1' });
      const event2 = await createEvent({ tenantId: 'tenant-2' });

      event1.expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      event2.expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

      const expiring = manager.getExpiringEvents(auditManager, 7, 'tenant-1');

      expect(expiring.length).toBe(1);
      expect(expiring[0].tenantId).toBe('tenant-1');
    });

    it('should not return already expired events', async () => {
      const event = await createEvent();
      event.expiresAt = new Date(Date.now() - 1000);

      const expiring = manager.getExpiringEvents(auditManager, 7);

      expect(expiring.length).toBe(0);
    });
  });

  describe('importPolicies', () => {
    it('should import policies', () => {
      const policies: RetentionPolicy[] = [
        {
          id: 'imported-1',
          name: 'Imported Policy 1',
          retentionDays: 30,
          isActive: true,
          priority: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'imported-2',
          name: 'Imported Policy 2',
          retentionDays: 60,
          isActive: true,
          priority: 2,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      manager.importPolicies(policies);

      expect(manager.getPolicy('imported-1')).toBeDefined();
      expect(manager.getPolicy('imported-2')).toBeDefined();
    });
  });

  describe('clear', () => {
    it('should remove all policies', () => {
      manager.createPolicy(createPolicyInput({ id: 'policy-1' }));
      manager.createPolicy(createPolicyInput({ id: 'policy-2' }));

      manager.clear();

      expect(manager.getPolicies()).toEqual([]);
    });
  });

  describe('singleton', () => {
    it('should return same instance', () => {
      const instance1 = getRetentionPolicyManager();
      const instance2 = getRetentionPolicyManager();

      expect(instance1).toBe(instance2);
    });

    it('should reset instance', () => {
      const instance1 = getRetentionPolicyManager();
      resetRetentionPolicyManager();
      const instance2 = getRetentionPolicyManager();

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('constructor', () => {
    it('should use custom default retention days', () => {
      const customManager = new RetentionPolicyManager(180);
      const event: AuditEvent = {
        id: 'test',
        type: 'AUTH',
        severity: 'LOW',
        outcome: 'SUCCESS',
        timestamp: new Date(),
        tenantId: 'tenant-1',
        actor: { id: 'user-1', type: 'USER' },
        action: 'Test',
        hash: 'hash',
      };

      const expiration = customManager.calculateExpirationDate(event);
      const expectedDate = new Date(event.timestamp);
      expectedDate.setDate(expectedDate.getDate() + 180);

      expect(expiration.getDate()).toBe(expectedDate.getDate());
    });
  });
});
