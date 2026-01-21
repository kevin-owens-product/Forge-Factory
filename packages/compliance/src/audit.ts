/**
 * @package @forge/compliance
 * @description Audit event logging with hash chaining
 */

import { createHash } from 'crypto';
import {
  AuditEvent,
  CreateAuditEventInput,
  AuditQueryFilters,
  AuditQueryOptions,
  AuditQueryResult,
  AuditStatistics,
  AuditEventHandler,
  IntegrityCheckResult,
  AuditEventType,
  AuditSeverity,
  AuditOutcome,
  DEFAULT_QUERY_LIMIT,
  DEFAULT_HASH_ALGORITHM,
  MAX_QUERY_LIMIT,
} from './compliance.types';

/**
 * Audit log manager
 */
export class AuditLogManager {
  private events: Map<string, AuditEvent> = new Map();
  private eventsByTenant: Map<string, string[]> = new Map();
  private lastHashByTenant: Map<string, string> = new Map();
  private hashAlgorithm: string;
  private eventHandlers: AuditEventHandler[] = [];

  constructor(hashAlgorithm: string = DEFAULT_HASH_ALGORITHM) {
    this.hashAlgorithm = hashAlgorithm;
  }

  /**
   * Log an audit event
   */
  async log(input: CreateAuditEventInput): Promise<AuditEvent> {
    const id = this.generateId();
    const timestamp = new Date();

    // Get the previous hash for this tenant's chain
    const previousHash = this.lastHashByTenant.get(input.tenantId) || '';

    // Create the event without hash first
    const eventData = {
      id,
      type: input.type,
      subtype: input.subtype,
      severity: input.severity || 'LOW',
      outcome: input.outcome || 'SUCCESS',
      timestamp,
      tenantId: input.tenantId,
      actor: input.actor,
      target: input.target,
      action: input.action,
      message: input.message,
      context: input.context,
      previousHash: previousHash || undefined,
      metadata: input.metadata,
      tags: input.tags,
    };

    // Calculate hash
    const hash = this.calculateHash(eventData);

    const event: AuditEvent = {
      ...eventData,
      hash,
    };

    // Store the event
    this.events.set(id, event);

    // Update tenant index
    const tenantEvents = this.eventsByTenant.get(input.tenantId) || [];
    tenantEvents.push(id);
    this.eventsByTenant.set(input.tenantId, tenantEvents);

    // Update last hash for tenant
    this.lastHashByTenant.set(input.tenantId, hash);

    // Notify handlers
    await this.notifyHandlers(event);

    return event;
  }

  /**
   * Get an event by ID
   */
  getEvent(id: string): AuditEvent | null {
    return this.events.get(id) || null;
  }

  /**
   * Query events with filters
   */
  query(
    filters: AuditQueryFilters,
    options: AuditQueryOptions = {}
  ): AuditQueryResult {
    const startTime = Date.now();
    const limit = Math.min(options.limit || DEFAULT_QUERY_LIMIT, MAX_QUERY_LIMIT);
    const offset = options.offset || 0;

    // Get events to search
    let eventIds: string[];
    if (filters.tenantId) {
      eventIds = this.eventsByTenant.get(filters.tenantId) || [];
    } else {
      eventIds = Array.from(this.events.keys());
    }

    // Filter events
    let filteredEvents = eventIds
      .map((id) => this.events.get(id))
      .filter((event): event is AuditEvent => event !== undefined)
      .filter((event) => this.matchesFilters(event, filters, options.includeExpired));

    // Sort events
    const sortBy = options.sortBy || 'timestamp';
    const sortOrder = options.sortOrder || 'desc';
    filteredEvents.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'timestamp') {
        comparison = a.timestamp.getTime() - b.timestamp.getTime();
      } else if (sortBy === 'severity') {
        comparison = this.severityOrder(a.severity) - this.severityOrder(b.severity);
      } else if (sortBy === 'type') {
        comparison = a.type.localeCompare(b.type);
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    const total = filteredEvents.length;

    // Apply pagination
    const paginatedEvents = filteredEvents.slice(offset, offset + limit);

    return {
      events: paginatedEvents,
      total,
      hasMore: offset + limit < total,
      queryTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Get events by tenant
   */
  getEventsByTenant(tenantId: string): AuditEvent[] {
    const eventIds = this.eventsByTenant.get(tenantId) || [];
    return eventIds
      .map((id) => this.events.get(id))
      .filter((event): event is AuditEvent => event !== undefined);
  }

  /**
   * Get statistics
   */
  getStatistics(tenantId?: string): AuditStatistics {
    let events: AuditEvent[];
    if (tenantId) {
      events = this.getEventsByTenant(tenantId);
    } else {
      events = Array.from(this.events.values());
    }

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const byType: Record<AuditEventType, number> = {
      AUTH: 0,
      ACCESS: 0,
      DATA_CHANGE: 0,
      ADMIN_ACTION: 0,
      SECURITY: 0,
      SYSTEM: 0,
      CUSTOM: 0,
    };

    const bySeverity: Record<AuditSeverity, number> = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 0,
    };

    const byOutcome: Record<AuditOutcome, number> = {
      SUCCESS: 0,
      FAILURE: 0,
      PARTIAL: 0,
      UNKNOWN: 0,
    };

    let oldestEvent: Date | undefined;
    let newestEvent: Date | undefined;
    let last24Hours = 0;
    let last7Days = 0;

    for (const event of events) {
      byType[event.type] = (byType[event.type] || 0) + 1;
      bySeverity[event.severity] = (bySeverity[event.severity] || 0) + 1;
      byOutcome[event.outcome] = (byOutcome[event.outcome] || 0) + 1;

      if (!oldestEvent || event.timestamp < oldestEvent) {
        oldestEvent = event.timestamp;
      }
      if (!newestEvent || event.timestamp > newestEvent) {
        newestEvent = event.timestamp;
      }

      if (event.timestamp >= oneDayAgo) {
        last24Hours++;
      }
      if (event.timestamp >= sevenDaysAgo) {
        last7Days++;
      }
    }

    return {
      totalEvents: events.length,
      byType,
      bySeverity,
      byOutcome,
      last24Hours,
      last7Days,
      oldestEvent,
      newestEvent,
    };
  }

  /**
   * Verify integrity of the audit chain
   */
  verifyIntegrity(tenantId: string): IntegrityCheckResult {
    const startTime = Date.now();
    const events = this.getEventsByTenant(tenantId);

    // Sort by timestamp to verify chain order
    events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    let validCount = 0;
    let invalidCount = 0;
    let firstInvalidEvent: IntegrityCheckResult['firstInvalidEvent'];
    let previousHash = '';

    for (const event of events) {
      // Verify the event's hash
      const expectedHash = this.calculateHash({
        id: event.id,
        type: event.type,
        subtype: event.subtype,
        severity: event.severity,
        outcome: event.outcome,
        timestamp: event.timestamp,
        tenantId: event.tenantId,
        actor: event.actor,
        target: event.target,
        action: event.action,
        message: event.message,
        context: event.context,
        previousHash: event.previousHash || undefined,
        metadata: event.metadata,
        tags: event.tags,
      });

      const hashValid = event.hash === expectedHash;
      const chainValid = !event.previousHash || event.previousHash === previousHash;

      if (hashValid && chainValid) {
        validCount++;
      } else {
        invalidCount++;
        if (!firstInvalidEvent) {
          firstInvalidEvent = {
            id: event.id,
            timestamp: event.timestamp,
            expectedHash,
            actualHash: event.hash,
          };
        }
      }

      previousHash = event.hash;
    }

    return {
      valid: invalidCount === 0,
      totalChecked: events.length,
      validCount,
      invalidCount,
      firstInvalidEvent,
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Register event handler
   */
  onEvent(handler: AuditEventHandler): void {
    this.eventHandlers.push(handler);
  }

  /**
   * Remove event handler
   */
  offEvent(handler: AuditEventHandler): void {
    const index = this.eventHandlers.indexOf(handler);
    if (index !== -1) {
      this.eventHandlers.splice(index, 1);
    }
  }

  /**
   * Delete an event by ID
   */
  deleteEvent(id: string): boolean {
    const event = this.events.get(id);
    if (!event) {
      return false;
    }

    // Remove from main store
    this.events.delete(id);

    // Remove from tenant index
    const tenantEvents = this.eventsByTenant.get(event.tenantId);
    if (tenantEvents) {
      const index = tenantEvents.indexOf(id);
      if (index !== -1) {
        tenantEvents.splice(index, 1);
      }
    }

    return true;
  }

  /**
   * Delete events by filter (for cleanup)
   */
  deleteEvents(filter: (event: AuditEvent) => boolean): number {
    let deleted = 0;
    const toDelete: string[] = [];

    for (const [id, event] of this.events.entries()) {
      if (filter(event)) {
        toDelete.push(id);
      }
    }

    for (const id of toDelete) {
      if (this.deleteEvent(id)) {
        deleted++;
      }
    }

    return deleted;
  }

  /**
   * Get events that match a filter (for export/archival)
   */
  getEventsMatching(filter: (event: AuditEvent) => boolean): AuditEvent[] {
    const matching: AuditEvent[] = [];
    for (const event of this.events.values()) {
      if (filter(event)) {
        matching.push(event);
      }
    }
    return matching;
  }

  /**
   * Clear all events (for testing)
   */
  clear(): void {
    this.events.clear();
    this.eventsByTenant.clear();
    this.lastHashByTenant.clear();
  }

  /**
   * Import events (for initialization/recovery)
   */
  importEvents(events: AuditEvent[]): void {
    // Sort by timestamp to maintain chain order
    const sorted = [...events].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );

    for (const event of sorted) {
      this.events.set(event.id, event);

      const tenantEvents = this.eventsByTenant.get(event.tenantId) || [];
      tenantEvents.push(event.id);
      this.eventsByTenant.set(event.tenantId, tenantEvents);

      // Update last hash
      this.lastHashByTenant.set(event.tenantId, event.hash);
    }
  }

  /**
   * Get all events (for export)
   */
  getAllEvents(): AuditEvent[] {
    return Array.from(this.events.values());
  }

  /**
   * Get event count
   */
  getEventCount(tenantId?: string): number {
    if (tenantId) {
      return this.eventsByTenant.get(tenantId)?.length || 0;
    }
    return this.events.size;
  }

  /**
   * Check if filters match an event
   */
  private matchesFilters(
    event: AuditEvent,
    filters: AuditQueryFilters,
    includeExpired?: boolean
  ): boolean {
    // Check expiration
    if (!includeExpired && event.expiresAt && event.expiresAt <= new Date()) {
      return false;
    }

    // Check tenant
    if (filters.tenantId && event.tenantId !== filters.tenantId) {
      return false;
    }

    // Check types
    if (filters.types && filters.types.length > 0) {
      if (!filters.types.includes(event.type)) {
        return false;
      }
    }

    // Check subtypes
    if (filters.subtypes && filters.subtypes.length > 0) {
      if (!event.subtype || !filters.subtypes.includes(event.subtype)) {
        return false;
      }
    }

    // Check severities
    if (filters.severities && filters.severities.length > 0) {
      if (!filters.severities.includes(event.severity)) {
        return false;
      }
    }

    // Check outcomes
    if (filters.outcomes && filters.outcomes.length > 0) {
      if (!filters.outcomes.includes(event.outcome)) {
        return false;
      }
    }

    // Check actor ID
    if (filters.actorId && event.actor.id !== filters.actorId) {
      return false;
    }

    // Check actor type
    if (filters.actorType && event.actor.type !== filters.actorType) {
      return false;
    }

    // Check target ID
    if (filters.targetId && event.target?.id !== filters.targetId) {
      return false;
    }

    // Check target type
    if (filters.targetType && event.target?.type !== filters.targetType) {
      return false;
    }

    // Check IP address
    if (filters.ipAddress && event.actor.ipAddress !== filters.ipAddress) {
      return false;
    }

    // Check time range
    if (filters.startTime && event.timestamp < filters.startTime) {
      return false;
    }
    if (filters.endTime && event.timestamp > filters.endTime) {
      return false;
    }

    // Check tags
    if (filters.tags && filters.tags.length > 0) {
      if (!event.tags || !filters.tags.some((tag) => event.tags?.includes(tag))) {
        return false;
      }
    }

    // Check search term
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const searchableText = [
        event.action,
        event.message,
        event.actor.name,
        event.actor.email,
        event.target?.name,
        event.target?.type,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      if (!searchableText.includes(searchLower)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Calculate hash for an event
   */
  private calculateHash(eventData: Omit<AuditEvent, 'hash' | 'expiresAt'>): string {
    const dataToHash = JSON.stringify({
      id: eventData.id,
      type: eventData.type,
      subtype: eventData.subtype,
      severity: eventData.severity,
      outcome: eventData.outcome,
      timestamp: eventData.timestamp.toISOString(),
      tenantId: eventData.tenantId,
      actor: eventData.actor,
      target: eventData.target,
      action: eventData.action,
      message: eventData.message,
      context: eventData.context,
      previousHash: eventData.previousHash,
      metadata: eventData.metadata,
      tags: eventData.tags,
    });

    return createHash(this.hashAlgorithm).update(dataToHash).digest('hex');
  }

  /**
   * Get severity order for sorting
   */
  private severityOrder(severity: AuditSeverity): number {
    const order: Record<AuditSeverity, number> = {
      LOW: 1,
      MEDIUM: 2,
      HIGH: 3,
      CRITICAL: 4,
    };
    return order[severity] || 0;
  }

  /**
   * Notify event handlers
   */
  private async notifyHandlers(event: AuditEvent): Promise<void> {
    for (const handler of this.eventHandlers) {
      try {
        await handler(event);
      } catch (error) {
        // Log but don't fail
        console.error('Audit event handler error:', error);
      }
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `audit_${timestamp}_${random}`;
  }
}

/**
 * Singleton instance
 */
let auditLogManagerInstance: AuditLogManager | null = null;

/**
 * Get the singleton audit log manager instance
 */
export function getAuditLogManager(hashAlgorithm?: string): AuditLogManager {
  if (!auditLogManagerInstance) {
    auditLogManagerInstance = new AuditLogManager(hashAlgorithm);
  }
  return auditLogManagerInstance;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetAuditLogManager(): void {
  auditLogManagerInstance = null;
}
