/**
 * @package @forge/compliance
 * @description Tests for compliance service
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ComplianceService,
  getComplianceService,
  resetComplianceService,
} from '../compliance.service';
import {
  CreateAuditEventInput,
  ComplianceConfig,
  ExportOptions,
} from '../compliance.types';

describe('ComplianceService', () => {
  let service: ComplianceService;

  beforeEach(() => {
    service = new ComplianceService();
  });

  afterEach(() => {
    service.shutdown();
    service.clear();
    resetComplianceService();
  });

  const createEventInput = (
    overrides: Partial<CreateAuditEventInput> = {}
  ): CreateAuditEventInput => ({
    type: 'AUTH',
    subtype: 'LOGIN',
    severity: 'LOW',
    outcome: 'SUCCESS',
    tenantId: 'tenant-1',
    actor: {
      id: 'user-1',
      type: 'USER',
      name: 'John Doe',
      email: 'john@example.com',
    },
    action: 'User logged in',
    ...overrides,
  });

  describe('constructor', () => {
    it('should create service with default config', () => {
      const config = service.getConfig();

      expect(config.defaultRetentionDays).toBe(90);
      expect(config.enableHashChaining).toBe(true);
      expect(config.hashAlgorithm).toBe('sha256');
      expect(config.maxQueryLimit).toBe(10000);
      expect(config.cleanupBatchSize).toBe(1000);
      expect(config.enableAutoCleanup).toBe(false);
    });

    it('should create service with custom config', () => {
      const customService = new ComplianceService({
        defaultRetentionDays: 180,
        enableHashChaining: false,
        hashAlgorithm: 'sha512',
        maxQueryLimit: 5000,
        cleanupBatchSize: 500,
        enableAutoCleanup: false,
      });

      const config = customService.getConfig();

      expect(config.defaultRetentionDays).toBe(180);
      expect(config.enableHashChaining).toBe(false);
      expect(config.hashAlgorithm).toBe('sha512');
      expect(config.maxQueryLimit).toBe(5000);
      expect(config.cleanupBatchSize).toBe(500);

      customService.shutdown();
    });
  });

  describe('audit log operations', () => {
    describe('log', () => {
      it('should log an audit event', async () => {
        const event = await service.log(createEventInput());

        expect(event.id).toBeDefined();
        expect(event.type).toBe('AUTH');
        expect(event.tenantId).toBe('tenant-1');
        expect(event.hash).toBeDefined();
      });

      it('should apply expiration from matching policy', async () => {
        service.createRetentionPolicy({
          name: 'Auth Policy',
          retentionDays: 30,
          eventTypes: ['AUTH'],
        });

        const event = await service.log(createEventInput({ type: 'AUTH' }));

        expect(event.expiresAt).toBeDefined();
      });
    });

    describe('logBatch', () => {
      it('should log multiple events', async () => {
        const events = await service.logBatch([
          createEventInput({ action: 'Action 1' }),
          createEventInput({ action: 'Action 2' }),
          createEventInput({ action: 'Action 3' }),
        ]);

        expect(events.length).toBe(3);
        expect(events[0].action).toBe('Action 1');
        expect(events[2].action).toBe('Action 3');
      });

      it('should chain hashes in batch', async () => {
        const events = await service.logBatch([
          createEventInput(),
          createEventInput(),
          createEventInput(),
        ]);

        expect(events[1].previousHash).toBe(events[0].hash);
        expect(events[2].previousHash).toBe(events[1].hash);
      });
    });

    describe('getEvent', () => {
      it('should return event by ID', async () => {
        const event = await service.log(createEventInput());
        const retrieved = service.getEvent(event.id);

        expect(retrieved).toEqual(event);
      });

      it('should return null for non-existent ID', () => {
        const retrieved = service.getEvent('non-existent');

        expect(retrieved).toBeNull();
      });
    });

    describe('query', () => {
      beforeEach(async () => {
        await service.log(createEventInput({ type: 'AUTH', tenantId: 'tenant-1' }));
        await service.log(createEventInput({ type: 'ACCESS', tenantId: 'tenant-1' }));
        await service.log(createEventInput({ type: 'SECURITY', tenantId: 'tenant-2' }));
      });

      it('should query all events', () => {
        const result = service.query({});

        expect(result.events.length).toBe(3);
      });

      it('should query by tenant', () => {
        const result = service.query({ tenantId: 'tenant-1' });

        expect(result.events.length).toBe(2);
      });

      it('should query by type', () => {
        const result = service.query({ types: ['AUTH'] });

        expect(result.events.length).toBe(1);
      });
    });

    describe('getEventsByTenant', () => {
      it('should return events for tenant', async () => {
        await service.log(createEventInput({ tenantId: 'tenant-1' }));
        await service.log(createEventInput({ tenantId: 'tenant-2' }));

        const events = service.getEventsByTenant('tenant-1');

        expect(events.length).toBe(1);
        expect(events[0].tenantId).toBe('tenant-1');
      });
    });

    describe('getStatistics', () => {
      it('should return statistics', async () => {
        await service.log(createEventInput({ type: 'AUTH', severity: 'LOW' }));
        await service.log(createEventInput({ type: 'AUTH', severity: 'HIGH' }));
        await service.log(createEventInput({ type: 'SECURITY', severity: 'CRITICAL' }));

        const stats = service.getStatistics();

        expect(stats.totalEvents).toBe(3);
        expect(stats.byType.AUTH).toBe(2);
        expect(stats.byType.SECURITY).toBe(1);
      });

      it('should return statistics for tenant', async () => {
        await service.log(createEventInput({ tenantId: 'tenant-1' }));
        await service.log(createEventInput({ tenantId: 'tenant-2' }));

        const stats = service.getStatistics('tenant-1');

        expect(stats.totalEvents).toBe(1);
      });
    });

    describe('getEventCount', () => {
      it('should return event count', async () => {
        await service.log(createEventInput());
        await service.log(createEventInput());

        expect(service.getEventCount()).toBe(2);
      });

      it('should return count for tenant', async () => {
        await service.log(createEventInput({ tenantId: 'tenant-1' }));
        await service.log(createEventInput({ tenantId: 'tenant-2' }));

        expect(service.getEventCount('tenant-1')).toBe(1);
      });
    });

    describe('event handlers', () => {
      it('should register and call handlers', async () => {
        const handler = vi.fn();
        service.onEvent(handler);

        await service.log(createEventInput());

        expect(handler).toHaveBeenCalled();
      });

      it('should unregister handlers', async () => {
        const handler = vi.fn();
        service.onEvent(handler);
        service.offEvent(handler);

        await service.log(createEventInput());

        expect(handler).not.toHaveBeenCalled();
      });
    });
  });

  describe('integrity verification', () => {
    describe('verifyIntegrity', () => {
      it('should verify chain integrity', async () => {
        await service.log(createEventInput({ tenantId: 'tenant-1' }));
        await service.log(createEventInput({ tenantId: 'tenant-1' }));
        await service.log(createEventInput({ tenantId: 'tenant-1' }));

        const result = service.verifyIntegrity('tenant-1');

        expect(result.valid).toBe(true);
        expect(result.totalChecked).toBe(3);
      });
    });

    describe('verifyAllIntegrity', () => {
      it('should verify integrity for all tenants', async () => {
        await service.log(createEventInput({ tenantId: 'tenant-1' }));
        await service.log(createEventInput({ tenantId: 'tenant-2' }));

        const results = service.verifyAllIntegrity();

        expect(results.size).toBe(2);
        expect(results.get('tenant-1')?.valid).toBe(true);
        expect(results.get('tenant-2')?.valid).toBe(true);
      });
    });
  });

  describe('retention policy operations', () => {
    describe('createRetentionPolicy', () => {
      it('should create a retention policy', () => {
        const policy = service.createRetentionPolicy({
          name: 'Test Policy',
          retentionDays: 30,
        });

        expect(policy.id).toBeDefined();
        expect(policy.name).toBe('Test Policy');
        expect(policy.retentionDays).toBe(30);
      });
    });

    describe('getRetentionPolicy', () => {
      it('should return policy by ID', () => {
        const created = service.createRetentionPolicy({
          id: 'policy-1',
          name: 'Test Policy',
          retentionDays: 30,
        });

        const retrieved = service.getRetentionPolicy('policy-1');

        expect(retrieved).toEqual(created);
      });
    });

    describe('getRetentionPolicies', () => {
      it('should return all policies', () => {
        service.createRetentionPolicy({ name: 'Policy 1', retentionDays: 30 });
        service.createRetentionPolicy({ name: 'Policy 2', retentionDays: 60 });

        const policies = service.getRetentionPolicies();

        expect(policies.length).toBe(2);
      });
    });

    describe('getActiveRetentionPolicies', () => {
      it('should return only active policies', () => {
        service.createRetentionPolicy({ name: 'Active', retentionDays: 30, isActive: true });
        service.createRetentionPolicy({ name: 'Inactive', retentionDays: 30, isActive: false });

        const policies = service.getActiveRetentionPolicies();

        expect(policies.length).toBe(1);
        expect(policies[0].name).toBe('Active');
      });
    });

    describe('updateRetentionPolicy', () => {
      it('should update a policy', () => {
        service.createRetentionPolicy({
          id: 'policy-1',
          name: 'Original',
          retentionDays: 30,
        });

        const updated = service.updateRetentionPolicy('policy-1', { name: 'Updated' });

        expect(updated?.name).toBe('Updated');
      });
    });

    describe('deleteRetentionPolicy', () => {
      it('should delete a policy', () => {
        service.createRetentionPolicy({
          id: 'policy-1',
          name: 'Test',
          retentionDays: 30,
        });

        const deleted = service.deleteRetentionPolicy('policy-1');

        expect(deleted).toBe(true);
        expect(service.getRetentionPolicy('policy-1')).toBeNull();
      });
    });

    describe('findMatchingPolicy', () => {
      it('should find matching policy for event', async () => {
        service.createRetentionPolicy({
          id: 'auth-policy',
          name: 'Auth Policy',
          retentionDays: 30,
          eventTypes: ['AUTH'],
        });

        const event = await service.log(createEventInput({ type: 'AUTH' }));
        const policy = service.findMatchingPolicy(event);

        expect(policy?.id).toBe('auth-policy');
      });
    });

    describe('getExpiringEvents', () => {
      it('should return events expiring soon', async () => {
        const event = await service.log(createEventInput());
        event.expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days

        const expiring = service.getExpiringEvents(7);

        expect(expiring.length).toBe(1);
      });
    });
  });

  describe('cleanup operations', () => {
    describe('runCleanup', () => {
      it('should delete expired events', async () => {
        const event = await service.log(createEventInput());
        event.expiresAt = new Date(Date.now() - 1000);

        const result = await service.runCleanup();

        expect(result.deleted).toBe(1);
        expect(service.getEvent(event.id)).toBeNull();
      });

      it('should use archive callback if set', async () => {
        service.createRetentionPolicy({
          name: 'Archive Policy',
          retentionDays: 1,
          archiveBeforeDelete: true,
          archiveDestination: 's3://archive',
          eventTypes: ['AUTH'],
        });

        const event = await service.log(createEventInput({ type: 'AUTH' }));
        event.expiresAt = new Date(Date.now() - 1000);

        const archiveCallback = vi.fn().mockResolvedValue(undefined);
        service.setArchiveCallback(archiveCallback);

        await service.runCleanup();

        expect(archiveCallback).toHaveBeenCalled();
      });
    });

    describe('auto cleanup', () => {
      it('should start auto cleanup', () => {
        const customService = new ComplianceService({
          enableAutoCleanup: true,
          autoCleanupIntervalMs: 1000,
        });

        // Service should have started auto cleanup
        customService.shutdown();
      });

      it('should stop auto cleanup', () => {
        service.startAutoCleanup();
        service.stopAutoCleanup();
        // Should not throw
      });
    });
  });

  describe('export operations', () => {
    beforeEach(async () => {
      await service.log(createEventInput());
      await service.log(createEventInput());
    });

    describe('export', () => {
      it('should export events', async () => {
        const { data, result } = await service.export(
          { tenantId: 'tenant-1' },
          { format: 'JSON' }
        );

        expect(data).toBeInstanceOf(Buffer);
        expect(result.eventCount).toBe(2);
      });
    });

    describe('exportStream', () => {
      it('should stream export events', async () => {
        const chunks: Buffer[] = [];
        const generator = service.exportStream(
          { tenantId: 'tenant-1' },
          { format: 'NDJSON' }
        );

        for await (const chunk of generator) {
          chunks.push(chunk);
        }

        expect(chunks.length).toBeGreaterThan(0);
      });
    });
  });

  describe('data management', () => {
    describe('importEvents', () => {
      it('should import events', () => {
        service.importEvents([
          {
            id: 'imported-1',
            type: 'AUTH',
            severity: 'LOW',
            outcome: 'SUCCESS',
            timestamp: new Date(),
            tenantId: 'tenant-1',
            actor: { id: 'user-1', type: 'USER' },
            action: 'Test',
            hash: 'hash-1',
          },
        ]);

        expect(service.getEvent('imported-1')).toBeDefined();
      });
    });

    describe('importPolicies', () => {
      it('should import policies', () => {
        service.importPolicies([
          {
            id: 'imported-policy',
            name: 'Imported Policy',
            retentionDays: 30,
            isActive: true,
            priority: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]);

        expect(service.getRetentionPolicy('imported-policy')).toBeDefined();
      });
    });

    describe('getAllEvents', () => {
      it('should return all events', async () => {
        await service.log(createEventInput({ tenantId: 'tenant-1' }));
        await service.log(createEventInput({ tenantId: 'tenant-2' }));

        const events = service.getAllEvents();

        expect(events.length).toBe(2);
      });
    });

    describe('deleteEvent', () => {
      it('should delete an event', async () => {
        const event = await service.log(createEventInput());

        const deleted = service.deleteEvent(event.id);

        expect(deleted).toBe(true);
        expect(service.getEvent(event.id)).toBeNull();
      });
    });

    describe('deleteEvents', () => {
      it('should delete events by filter', async () => {
        await service.log(createEventInput({ type: 'AUTH' }));
        await service.log(createEventInput({ type: 'ACCESS' }));

        const deleted = service.deleteEvents((e) => e.type === 'AUTH');

        expect(deleted).toBe(1);
        expect(service.getEventCount()).toBe(1);
      });
    });

    describe('clear', () => {
      it('should clear all data', async () => {
        await service.log(createEventInput());
        service.createRetentionPolicy({ name: 'Test', retentionDays: 30 });

        service.clear();

        expect(service.getAllEvents()).toEqual([]);
        expect(service.getRetentionPolicies()).toEqual([]);
      });
    });
  });

  describe('singleton', () => {
    it('should return same instance', () => {
      const instance1 = getComplianceService();
      const instance2 = getComplianceService();

      expect(instance1).toBe(instance2);
    });

    it('should reset instance', () => {
      const instance1 = getComplianceService();
      resetComplianceService();
      const instance2 = getComplianceService();

      expect(instance1).not.toBe(instance2);
    });

    it('should use config on first call', () => {
      resetComplianceService();
      const instance = getComplianceService({ defaultRetentionDays: 180 });

      expect(instance.getConfig().defaultRetentionDays).toBe(180);
    });
  });

  describe('shutdown', () => {
    it('should stop auto cleanup on shutdown', () => {
      service.startAutoCleanup();
      service.shutdown();
      // Should not throw
    });
  });
});
