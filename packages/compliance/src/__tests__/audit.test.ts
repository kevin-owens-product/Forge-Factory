/**
 * @package @forge/compliance
 * @description Tests for audit log manager
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  AuditLogManager,
  getAuditLogManager,
  resetAuditLogManager,
} from '../audit';
import {
  CreateAuditEventInput,
  AuditEvent,
  AuditQueryFilters,
} from '../compliance.types';

describe('AuditLogManager', () => {
  let manager: AuditLogManager;

  beforeEach(() => {
    manager = new AuditLogManager();
  });

  afterEach(() => {
    manager.clear();
    resetAuditLogManager();
  });

  const createInput = (overrides: Partial<CreateAuditEventInput> = {}): CreateAuditEventInput => ({
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
      ipAddress: '192.168.1.1',
    },
    action: 'User logged in',
    message: 'Successful login from Chrome browser',
    ...overrides,
  });

  describe('log', () => {
    it('should create an audit event', async () => {
      const input = createInput();
      const event = await manager.log(input);

      expect(event.id).toBeDefined();
      expect(event.type).toBe('AUTH');
      expect(event.subtype).toBe('LOGIN');
      expect(event.severity).toBe('LOW');
      expect(event.outcome).toBe('SUCCESS');
      expect(event.tenantId).toBe('tenant-1');
      expect(event.actor.id).toBe('user-1');
      expect(event.action).toBe('User logged in');
      expect(event.hash).toBeDefined();
      expect(event.timestamp).toBeInstanceOf(Date);
    });

    it('should use default values for severity and outcome', async () => {
      const input = createInput();
      delete (input as any).severity;
      delete (input as any).outcome;

      const event = await manager.log(input);

      expect(event.severity).toBe('LOW');
      expect(event.outcome).toBe('SUCCESS');
    });

    it('should chain hashes for same tenant', async () => {
      const event1 = await manager.log(createInput());
      const event2 = await manager.log(createInput());
      const event3 = await manager.log(createInput());

      expect(event1.previousHash).toBeUndefined();
      expect(event2.previousHash).toBe(event1.hash);
      expect(event3.previousHash).toBe(event2.hash);
    });

    it('should maintain separate chains per tenant', async () => {
      const event1 = await manager.log(createInput({ tenantId: 'tenant-1' }));
      const event2 = await manager.log(createInput({ tenantId: 'tenant-2' }));
      const event3 = await manager.log(createInput({ tenantId: 'tenant-1' }));

      expect(event1.previousHash).toBeUndefined();
      expect(event2.previousHash).toBeUndefined();
      expect(event3.previousHash).toBe(event1.hash);
    });

    it('should generate unique IDs', async () => {
      const events = await Promise.all([
        manager.log(createInput()),
        manager.log(createInput()),
        manager.log(createInput()),
      ]);

      const ids = events.map((e) => e.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(3);
    });

    it('should include target information', async () => {
      const input = createInput({
        target: {
          id: 'doc-123',
          type: 'DOCUMENT',
          name: 'Important File',
        },
      });

      const event = await manager.log(input);

      expect(event.target?.id).toBe('doc-123');
      expect(event.target?.type).toBe('DOCUMENT');
      expect(event.target?.name).toBe('Important File');
    });

    it('should include context information', async () => {
      const input = createInput({
        context: {
          requestId: 'req-123',
          endpoint: '/api/login',
          method: 'POST',
          sourceApp: 'web-client',
        },
      });

      const event = await manager.log(input);

      expect(event.context?.requestId).toBe('req-123');
      expect(event.context?.endpoint).toBe('/api/login');
    });

    it('should include metadata', async () => {
      const input = createInput({
        metadata: {
          browser: 'Chrome',
          version: '120.0',
        },
      });

      const event = await manager.log(input);

      expect(event.metadata?.browser).toBe('Chrome');
      expect(event.metadata?.version).toBe('120.0');
    });

    it('should include tags', async () => {
      const input = createInput({
        tags: ['security', 'authentication'],
      });

      const event = await manager.log(input);

      expect(event.tags).toContain('security');
      expect(event.tags).toContain('authentication');
    });

    it('should notify event handlers', async () => {
      const handler = vi.fn();
      manager.onEvent(handler);

      const event = await manager.log(createInput());

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(event);
    });

    it('should continue on handler error', async () => {
      const errorHandler = vi.fn().mockRejectedValue(new Error('Handler error'));
      const successHandler = vi.fn();

      manager.onEvent(errorHandler);
      manager.onEvent(successHandler);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const event = await manager.log(createInput());

      expect(errorHandler).toHaveBeenCalled();
      expect(successHandler).toHaveBeenCalledWith(event);
      consoleSpy.mockRestore();
    });
  });

  describe('getEvent', () => {
    it('should return event by ID', async () => {
      const event = await manager.log(createInput());
      const retrieved = manager.getEvent(event.id);

      expect(retrieved).toEqual(event);
    });

    it('should return null for non-existent ID', () => {
      const retrieved = manager.getEvent('non-existent');

      expect(retrieved).toBeNull();
    });
  });

  describe('query', () => {
    beforeEach(async () => {
      // Create test events
      await manager.log(createInput({ type: 'AUTH', severity: 'LOW', tenantId: 'tenant-1' }));
      await manager.log(createInput({ type: 'ACCESS', severity: 'MEDIUM', tenantId: 'tenant-1' }));
      await manager.log(createInput({ type: 'DATA_CHANGE', severity: 'HIGH', tenantId: 'tenant-1' }));
      await manager.log(createInput({ type: 'SECURITY', severity: 'CRITICAL', tenantId: 'tenant-2' }));
    });

    it('should return all events when no filter', () => {
      const result = manager.query({});

      expect(result.events.length).toBe(4);
      expect(result.total).toBe(4);
    });

    it('should filter by tenant', () => {
      const result = manager.query({ tenantId: 'tenant-1' });

      expect(result.events.length).toBe(3);
      expect(result.events.every((e) => e.tenantId === 'tenant-1')).toBe(true);
    });

    it('should filter by types', () => {
      const result = manager.query({ types: ['AUTH', 'ACCESS'] });

      expect(result.events.length).toBe(2);
      expect(result.events.every((e) => ['AUTH', 'ACCESS'].includes(e.type))).toBe(true);
    });

    it('should filter by severities', () => {
      const result = manager.query({ severities: ['HIGH', 'CRITICAL'] });

      expect(result.events.length).toBe(2);
      expect(result.events.every((e) => ['HIGH', 'CRITICAL'].includes(e.severity))).toBe(true);
    });

    it('should filter by outcomes', async () => {
      await manager.log(createInput({ outcome: 'FAILURE' }));

      const result = manager.query({ outcomes: ['FAILURE'] });

      expect(result.events.length).toBe(1);
      expect(result.events[0].outcome).toBe('FAILURE');
    });

    it('should filter by actor ID', () => {
      const result = manager.query({ actorId: 'user-1' });

      expect(result.events.length).toBe(4);
    });

    it('should filter by actor type', async () => {
      await manager.log(createInput({ actor: { id: 'svc-1', type: 'SERVICE' } }));

      const result = manager.query({ actorType: 'SERVICE' });

      expect(result.events.length).toBe(1);
      expect(result.events[0].actor.type).toBe('SERVICE');
    });

    it('should filter by target ID', async () => {
      await manager.log(createInput({ target: { id: 'target-1', type: 'DOC' } }));

      const result = manager.query({ targetId: 'target-1' });

      expect(result.events.length).toBe(1);
    });

    it('should filter by target type', async () => {
      await manager.log(createInput({ target: { id: 't-1', type: 'DOCUMENT' } }));

      const result = manager.query({ targetType: 'DOCUMENT' });

      expect(result.events.length).toBe(1);
    });

    it('should filter by IP address', () => {
      const result = manager.query({ ipAddress: '192.168.1.1' });

      expect(result.events.length).toBe(4);
    });

    it('should filter by time range', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const result = manager.query({ startTime: yesterday, endTime: tomorrow });

      expect(result.events.length).toBe(4);
    });

    it('should filter by tags', async () => {
      await manager.log(createInput({ tags: ['important', 'security'] }));

      const result = manager.query({ tags: ['important'] });

      expect(result.events.length).toBe(1);
    });

    it('should filter by search term', async () => {
      await manager.log(createInput({
        action: 'Password reset requested',
        message: 'User requested password reset',
      }));

      const result = manager.query({ search: 'password' });

      expect(result.events.length).toBe(1);
    });

    it('should filter by subtypes', async () => {
      const result = manager.query({ subtypes: ['LOGIN'] });

      expect(result.events.length).toBe(4);
    });

    it('should support pagination', () => {
      const result1 = manager.query({}, { limit: 2 });
      const result2 = manager.query({}, { limit: 2, offset: 2 });

      expect(result1.events.length).toBe(2);
      expect(result1.hasMore).toBe(true);
      expect(result2.events.length).toBe(2);
      expect(result2.hasMore).toBe(false);
    });

    it('should sort by timestamp ascending', () => {
      const result = manager.query({}, { sortBy: 'timestamp', sortOrder: 'asc' });

      for (let i = 1; i < result.events.length; i++) {
        expect(result.events[i].timestamp.getTime()).toBeGreaterThanOrEqual(
          result.events[i - 1].timestamp.getTime()
        );
      }
    });

    it('should sort by timestamp descending', () => {
      const result = manager.query({}, { sortBy: 'timestamp', sortOrder: 'desc' });

      for (let i = 1; i < result.events.length; i++) {
        expect(result.events[i].timestamp.getTime()).toBeLessThanOrEqual(
          result.events[i - 1].timestamp.getTime()
        );
      }
    });

    it('should sort by severity', () => {
      const result = manager.query({}, { sortBy: 'severity', sortOrder: 'desc' });

      expect(result.events[0].severity).toBe('CRITICAL');
    });

    it('should sort by type', () => {
      const result = manager.query({}, { sortBy: 'type', sortOrder: 'asc' });

      expect(result.events[0].type).toBe('ACCESS');
    });

    it('should exclude expired events by default', async () => {
      const event = await manager.log(createInput());
      event.expiresAt = new Date(Date.now() - 1000);

      const result = manager.query({});

      expect(result.events.find((e) => e.id === event.id)).toBeUndefined();
    });

    it('should include expired events when requested', async () => {
      const event = await manager.log(createInput());
      event.expiresAt = new Date(Date.now() - 1000);

      const result = manager.query({}, { includeExpired: true });

      expect(result.events.find((e) => e.id === event.id)).toBeDefined();
    });

    it('should respect max query limit', () => {
      const result = manager.query({}, { limit: 100000 });

      expect(result.events.length).toBeLessThanOrEqual(10000);
    });

    it('should include query time', () => {
      const result = manager.query({});

      expect(result.queryTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getEventsByTenant', () => {
    it('should return events for a specific tenant', async () => {
      await manager.log(createInput({ tenantId: 'tenant-1' }));
      await manager.log(createInput({ tenantId: 'tenant-2' }));
      await manager.log(createInput({ tenantId: 'tenant-1' }));

      const events = manager.getEventsByTenant('tenant-1');

      expect(events.length).toBe(2);
      expect(events.every((e) => e.tenantId === 'tenant-1')).toBe(true);
    });

    it('should return empty array for non-existent tenant', () => {
      const events = manager.getEventsByTenant('non-existent');

      expect(events).toEqual([]);
    });
  });

  describe('getStatistics', () => {
    beforeEach(async () => {
      await manager.log(createInput({ type: 'AUTH', severity: 'LOW', outcome: 'SUCCESS' }));
      await manager.log(createInput({ type: 'AUTH', severity: 'MEDIUM', outcome: 'FAILURE' }));
      await manager.log(createInput({ type: 'ACCESS', severity: 'HIGH', outcome: 'SUCCESS' }));
      await manager.log(createInput({ type: 'SECURITY', severity: 'CRITICAL', outcome: 'FAILURE', tenantId: 'tenant-2' }));
    });

    it('should return overall statistics', () => {
      const stats = manager.getStatistics();

      expect(stats.totalEvents).toBe(4);
      expect(stats.byType.AUTH).toBe(2);
      expect(stats.byType.ACCESS).toBe(1);
      expect(stats.byType.SECURITY).toBe(1);
      expect(stats.bySeverity.LOW).toBe(1);
      expect(stats.bySeverity.MEDIUM).toBe(1);
      expect(stats.bySeverity.HIGH).toBe(1);
      expect(stats.bySeverity.CRITICAL).toBe(1);
      expect(stats.byOutcome.SUCCESS).toBe(2);
      expect(stats.byOutcome.FAILURE).toBe(2);
    });

    it('should return statistics for specific tenant', () => {
      const stats = manager.getStatistics('tenant-1');

      expect(stats.totalEvents).toBe(3);
      expect(stats.byType.SECURITY).toBe(0);
    });

    it('should include last 24 hours count', () => {
      const stats = manager.getStatistics();

      expect(stats.last24Hours).toBe(4);
    });

    it('should include last 7 days count', () => {
      const stats = manager.getStatistics();

      expect(stats.last7Days).toBe(4);
    });

    it('should include oldest and newest event timestamps', () => {
      const stats = manager.getStatistics();

      expect(stats.oldestEvent).toBeInstanceOf(Date);
      expect(stats.newestEvent).toBeInstanceOf(Date);
      expect(stats.newestEvent!.getTime()).toBeGreaterThanOrEqual(stats.oldestEvent!.getTime());
    });
  });

  describe('verifyIntegrity', () => {
    it('should return valid for unmodified chain', async () => {
      await manager.log(createInput({ tenantId: 'tenant-1' }));
      await manager.log(createInput({ tenantId: 'tenant-1' }));
      await manager.log(createInput({ tenantId: 'tenant-1' }));

      const result = manager.verifyIntegrity('tenant-1');

      expect(result.valid).toBe(true);
      expect(result.totalChecked).toBe(3);
      expect(result.validCount).toBe(3);
      expect(result.invalidCount).toBe(0);
      expect(result.firstInvalidEvent).toBeUndefined();
    });

    it('should detect modified hash', async () => {
      await manager.log(createInput({ tenantId: 'tenant-1' }));
      const event = await manager.log(createInput({ tenantId: 'tenant-1' }));
      await manager.log(createInput({ tenantId: 'tenant-1' }));

      // Tamper with the hash
      (event as any).hash = 'tampered-hash';

      const result = manager.verifyIntegrity('tenant-1');

      expect(result.valid).toBe(false);
      expect(result.invalidCount).toBeGreaterThan(0);
      expect(result.firstInvalidEvent).toBeDefined();
    });

    it('should return empty result for non-existent tenant', () => {
      const result = manager.verifyIntegrity('non-existent');

      expect(result.valid).toBe(true);
      expect(result.totalChecked).toBe(0);
    });

    it('should include duration', async () => {
      await manager.log(createInput({ tenantId: 'tenant-1' }));

      const result = manager.verifyIntegrity('tenant-1');

      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('event handlers', () => {
    it('should register and unregister handlers', async () => {
      const handler = vi.fn();

      manager.onEvent(handler);
      await manager.log(createInput());
      expect(handler).toHaveBeenCalledTimes(1);

      manager.offEvent(handler);
      await manager.log(createInput());
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple handlers', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      manager.onEvent(handler1);
      manager.onEvent(handler2);
      await manager.log(createInput());

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });
  });

  describe('deleteEvent', () => {
    it('should delete an event by ID', async () => {
      const event = await manager.log(createInput());

      const deleted = manager.deleteEvent(event.id);

      expect(deleted).toBe(true);
      expect(manager.getEvent(event.id)).toBeNull();
    });

    it('should return false for non-existent ID', () => {
      const deleted = manager.deleteEvent('non-existent');

      expect(deleted).toBe(false);
    });

    it('should remove from tenant index', async () => {
      const event = await manager.log(createInput({ tenantId: 'tenant-1' }));

      manager.deleteEvent(event.id);
      const events = manager.getEventsByTenant('tenant-1');

      expect(events.find((e) => e.id === event.id)).toBeUndefined();
    });
  });

  describe('deleteEvents', () => {
    it('should delete events matching filter', async () => {
      await manager.log(createInput({ type: 'AUTH' }));
      await manager.log(createInput({ type: 'ACCESS' }));
      await manager.log(createInput({ type: 'AUTH' }));

      const deleted = manager.deleteEvents((e) => e.type === 'AUTH');

      expect(deleted).toBe(2);
      expect(manager.getEventCount()).toBe(1);
    });
  });

  describe('getEventsMatching', () => {
    it('should return events matching filter', async () => {
      await manager.log(createInput({ type: 'AUTH' }));
      await manager.log(createInput({ type: 'ACCESS' }));
      await manager.log(createInput({ type: 'AUTH' }));

      const events = manager.getEventsMatching((e) => e.type === 'AUTH');

      expect(events.length).toBe(2);
    });
  });

  describe('importEvents', () => {
    it('should import events', () => {
      const events: AuditEvent[] = [
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
        {
          id: 'imported-2',
          type: 'AUTH',
          severity: 'LOW',
          outcome: 'SUCCESS',
          timestamp: new Date(),
          tenantId: 'tenant-1',
          actor: { id: 'user-1', type: 'USER' },
          action: 'Test',
          hash: 'hash-2',
          previousHash: 'hash-1',
        },
      ];

      manager.importEvents(events);

      expect(manager.getEvent('imported-1')).toBeDefined();
      expect(manager.getEvent('imported-2')).toBeDefined();
      expect(manager.getEventsByTenant('tenant-1').length).toBe(2);
    });
  });

  describe('getAllEvents', () => {
    it('should return all events', async () => {
      await manager.log(createInput({ tenantId: 'tenant-1' }));
      await manager.log(createInput({ tenantId: 'tenant-2' }));

      const events = manager.getAllEvents();

      expect(events.length).toBe(2);
    });
  });

  describe('getEventCount', () => {
    it('should return total event count', async () => {
      await manager.log(createInput({ tenantId: 'tenant-1' }));
      await manager.log(createInput({ tenantId: 'tenant-2' }));

      expect(manager.getEventCount()).toBe(2);
    });

    it('should return count for specific tenant', async () => {
      await manager.log(createInput({ tenantId: 'tenant-1' }));
      await manager.log(createInput({ tenantId: 'tenant-2' }));
      await manager.log(createInput({ tenantId: 'tenant-1' }));

      expect(manager.getEventCount('tenant-1')).toBe(2);
    });
  });

  describe('clear', () => {
    it('should remove all data', async () => {
      await manager.log(createInput());
      await manager.log(createInput({ tenantId: 'tenant-2' }));

      manager.clear();

      expect(manager.getAllEvents()).toEqual([]);
      expect(manager.getEventsByTenant('tenant-1')).toEqual([]);
    });
  });

  describe('singleton', () => {
    it('should return same instance', () => {
      const instance1 = getAuditLogManager();
      const instance2 = getAuditLogManager();

      expect(instance1).toBe(instance2);
    });

    it('should reset instance', () => {
      const instance1 = getAuditLogManager();
      resetAuditLogManager();
      const instance2 = getAuditLogManager();

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('hash algorithm', () => {
    it('should use specified hash algorithm', async () => {
      const sha512Manager = new AuditLogManager('sha512');
      const event = await sha512Manager.log(createInput());

      expect(event.hash.length).toBe(128); // SHA-512 hex is 128 chars
    });

    it('should use SHA-256 by default', async () => {
      const event = await manager.log(createInput());

      expect(event.hash.length).toBe(64); // SHA-256 hex is 64 chars
    });
  });
});
