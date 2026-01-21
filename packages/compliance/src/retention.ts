/**
 * @package @forge/compliance
 * @description Data retention policy management
 */

import { ErrorCode, ForgeError } from '@forge/errors';
import {
  RetentionPolicy,
  CreateRetentionPolicyInput,
  UpdateRetentionPolicyInput,
  CleanupResult,
  AuditEvent,
  DEFAULT_RETENTION_DAYS,
  DEFAULT_CLEANUP_BATCH_SIZE,
} from './compliance.types';
import { AuditLogManager } from './audit';

/**
 * Retention policy manager
 */
export class RetentionPolicyManager {
  private policies: Map<string, RetentionPolicy> = new Map();
  private defaultRetentionDays: number;
  private cleanupBatchSize: number;

  constructor(
    defaultRetentionDays: number = DEFAULT_RETENTION_DAYS,
    cleanupBatchSize: number = DEFAULT_CLEANUP_BATCH_SIZE
  ) {
    this.defaultRetentionDays = defaultRetentionDays;
    this.cleanupBatchSize = cleanupBatchSize;
  }

  /**
   * Create a new retention policy
   */
  createPolicy(input: CreateRetentionPolicyInput): RetentionPolicy {
    const id = input.id || this.generateId();

    // Validate input
    this.validatePolicyInput(input);

    // Check for duplicate
    const key = this.getKey(id, input.tenantId);
    if (this.policies.has(key)) {
      throw new ForgeError({
        code: ErrorCode.CONFLICT,
        message: `Retention policy with ID '${id}' already exists`,
        statusCode: 409,
      });
    }

    const now = new Date();
    const policy: RetentionPolicy = {
      id,
      name: input.name,
      description: input.description,
      eventTypes: input.eventTypes,
      severities: input.severities,
      tags: input.tags,
      retentionDays: input.retentionDays,
      archiveBeforeDelete: input.archiveBeforeDelete ?? false,
      archiveDestination: input.archiveDestination,
      isActive: input.isActive ?? true,
      priority: input.priority ?? 0,
      tenantId: input.tenantId,
      createdAt: now,
      updatedAt: now,
    };

    this.policies.set(key, policy);
    return policy;
  }

  /**
   * Get a policy by ID
   */
  getPolicy(id: string, tenantId?: string): RetentionPolicy | null {
    return this.policies.get(this.getKey(id, tenantId)) || null;
  }

  /**
   * Get all policies
   */
  getPolicies(tenantId?: string): RetentionPolicy[] {
    const policies: RetentionPolicy[] = [];
    for (const policy of this.policies.values()) {
      if (!tenantId || policy.tenantId === tenantId || !policy.tenantId) {
        policies.push(policy);
      }
    }
    // Sort by priority descending
    return policies.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  }

  /**
   * Get active policies
   */
  getActivePolicies(tenantId?: string): RetentionPolicy[] {
    return this.getPolicies(tenantId).filter((p) => p.isActive);
  }

  /**
   * Update a policy
   */
  updatePolicy(
    id: string,
    updates: UpdateRetentionPolicyInput,
    tenantId?: string
  ): RetentionPolicy | null {
    const key = this.getKey(id, tenantId);
    const existing = this.policies.get(key);

    if (!existing) {
      return null;
    }

    // Validate updates
    if (updates.retentionDays !== undefined && updates.retentionDays <= 0) {
      throw new ForgeError({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'Retention days must be positive',
        statusCode: 400,
      });
    }

    const updated: RetentionPolicy = {
      ...existing,
      ...updates,
      id: existing.id,
      tenantId: existing.tenantId,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    };

    this.policies.set(key, updated);
    return updated;
  }

  /**
   * Delete a policy
   */
  deletePolicy(id: string, tenantId?: string): boolean {
    return this.policies.delete(this.getKey(id, tenantId));
  }

  /**
   * Find the matching policy for an event
   */
  findMatchingPolicy(event: AuditEvent): RetentionPolicy | null {
    // Get active policies, sorted by priority
    const policies = this.getActivePolicies(event.tenantId);

    for (const policy of policies) {
      if (this.policyMatchesEvent(policy, event)) {
        return policy;
      }
    }

    return null;
  }

  /**
   * Calculate expiration date for an event
   */
  calculateExpirationDate(event: AuditEvent): Date {
    const policy = this.findMatchingPolicy(event);
    const retentionDays = policy?.retentionDays ?? this.defaultRetentionDays;

    const expirationDate = new Date(event.timestamp);
    expirationDate.setDate(expirationDate.getDate() + retentionDays);

    return expirationDate;
  }

  /**
   * Run cleanup to delete/archive expired events
   */
  async runCleanup(
    auditManager: AuditLogManager,
    archiveCallback?: (events: AuditEvent[], destination: string) => Promise<void>
  ): Promise<CleanupResult> {
    const startTime = Date.now();
    const now = new Date();

    let deleted = 0;
    let archived = 0;
    let failed = 0;
    const byTenant: Record<string, { deleted: number; archived: number }> = {};

    // Get all events
    const allEvents = auditManager.getAllEvents();

    // Group events by policy for batch processing
    const eventsToArchive: Map<string, AuditEvent[]> = new Map();
    const eventsToDelete: AuditEvent[] = [];

    for (const event of allEvents) {
      // Check if event has explicit expiration
      let isExpired = false;
      if (event.expiresAt) {
        isExpired = event.expiresAt <= now;
      } else {
        // Calculate expiration based on policy
        const expirationDate = this.calculateExpirationDate(event);
        isExpired = expirationDate <= now;
      }

      if (isExpired) {
        const policy = this.findMatchingPolicy(event);

        if (policy?.archiveBeforeDelete && policy.archiveDestination) {
          const archiveEvents = eventsToArchive.get(policy.archiveDestination) || [];
          archiveEvents.push(event);
          eventsToArchive.set(policy.archiveDestination, archiveEvents);
        } else {
          eventsToDelete.push(event);
        }
      }
    }

    // Archive events first
    if (archiveCallback) {
      for (const [destination, events] of eventsToArchive.entries()) {
        try {
          // Process in batches
          for (let i = 0; i < events.length; i += this.cleanupBatchSize) {
            const batch = events.slice(i, i + this.cleanupBatchSize);
            await archiveCallback(batch, destination);

            // Delete archived events
            for (const event of batch) {
              if (auditManager.deleteEvent(event.id)) {
                archived++;
                // Track by tenant
                if (!byTenant[event.tenantId]) {
                  byTenant[event.tenantId] = { deleted: 0, archived: 0 };
                }
                const tenantEntry = byTenant[event.tenantId];
                if (tenantEntry) {
                  tenantEntry.archived++;
                }
              } else {
                failed++;
              }
            }
          }
        } catch (error) {
          // Mark all events in this batch as failed
          failed += events.length;
        }
      }
    } else {
      // No archive callback, add to delete list
      for (const events of eventsToArchive.values()) {
        eventsToDelete.push(...events);
      }
    }

    // Delete events
    for (const event of eventsToDelete) {
      if (auditManager.deleteEvent(event.id)) {
        deleted++;
        // Track by tenant
        if (!byTenant[event.tenantId]) {
          byTenant[event.tenantId] = { deleted: 0, archived: 0 };
        }
        const tenantEntry = byTenant[event.tenantId];
        if (tenantEntry) {
          tenantEntry.deleted++;
        }
      } else {
        failed++;
      }
    }

    return {
      deleted,
      archived,
      failed,
      durationMs: Date.now() - startTime,
      byTenant: Object.keys(byTenant).length > 0 ? byTenant : undefined,
    };
  }

  /**
   * Apply expiration dates to events
   */
  applyExpirationDates(auditManager: AuditLogManager): number {
    let updated = 0;
    const allEvents = auditManager.getAllEvents();

    for (const event of allEvents) {
      if (!event.expiresAt) {
        const expirationDate = this.calculateExpirationDate(event);
        // Note: This would require the audit manager to support updating events
        // For now, this is a placeholder for the pattern
        event.expiresAt = expirationDate;
        updated++;
      }
    }

    return updated;
  }

  /**
   * Get events that will expire within a given number of days
   */
  getExpiringEvents(
    auditManager: AuditLogManager,
    withinDays: number,
    tenantId?: string
  ): AuditEvent[] {
    const now = new Date();
    const futureDate = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000);

    const events = tenantId
      ? auditManager.getEventsByTenant(tenantId)
      : auditManager.getAllEvents();

    return events.filter((event) => {
      const expirationDate = event.expiresAt || this.calculateExpirationDate(event);
      return expirationDate <= futureDate && expirationDate > now;
    });
  }

  /**
   * Clear all policies (for testing)
   */
  clear(): void {
    this.policies.clear();
  }

  /**
   * Import policies
   */
  importPolicies(policies: RetentionPolicy[]): void {
    for (const policy of policies) {
      this.policies.set(this.getKey(policy.id, policy.tenantId), policy);
    }
  }

  /**
   * Check if a policy matches an event
   */
  private policyMatchesEvent(policy: RetentionPolicy, event: AuditEvent): boolean {
    // Check tenant match (global policies match all tenants)
    if (policy.tenantId && policy.tenantId !== event.tenantId) {
      return false;
    }

    // Check event types
    if (policy.eventTypes && policy.eventTypes.length > 0) {
      if (!policy.eventTypes.includes(event.type)) {
        return false;
      }
    }

    // Check severities
    if (policy.severities && policy.severities.length > 0) {
      if (!policy.severities.includes(event.severity)) {
        return false;
      }
    }

    // Check tags
    if (policy.tags && policy.tags.length > 0) {
      if (!event.tags || !policy.tags.some((tag) => event.tags?.includes(tag))) {
        return false;
      }
    }

    return true;
  }

  /**
   * Validate policy input
   */
  private validatePolicyInput(input: CreateRetentionPolicyInput): void {
    if (!input.name || input.name.trim().length === 0) {
      throw new ForgeError({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'Policy name is required',
        statusCode: 400,
      });
    }

    if (input.retentionDays <= 0) {
      throw new ForgeError({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'Retention days must be positive',
        statusCode: 400,
      });
    }

    if (input.archiveBeforeDelete && !input.archiveDestination) {
      throw new ForgeError({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'Archive destination is required when archiveBeforeDelete is true',
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
    return `retention_${timestamp}_${random}`;
  }
}

/**
 * Singleton instance
 */
let retentionPolicyManagerInstance: RetentionPolicyManager | null = null;

/**
 * Get the singleton retention policy manager instance
 */
export function getRetentionPolicyManager(
  defaultRetentionDays?: number,
  cleanupBatchSize?: number
): RetentionPolicyManager {
  if (!retentionPolicyManagerInstance) {
    retentionPolicyManagerInstance = new RetentionPolicyManager(
      defaultRetentionDays,
      cleanupBatchSize
    );
  }
  return retentionPolicyManagerInstance;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetRetentionPolicyManager(): void {
  retentionPolicyManagerInstance = null;
}
