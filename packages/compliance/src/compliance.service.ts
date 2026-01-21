/**
 * @package @forge/compliance
 * @description Main compliance service integrating audit, retention, and export
 */

import {
  AuditEvent,
  CreateAuditEventInput,
  AuditQueryFilters,
  AuditQueryOptions,
  AuditQueryResult,
  AuditStatistics,
  AuditEventHandler,
  IntegrityCheckResult,
  RetentionPolicy,
  CreateRetentionPolicyInput,
  UpdateRetentionPolicyInput,
  CleanupResult,
  ExportOptions,
  ExportResult,
  ComplianceConfig,
  DEFAULT_RETENTION_DAYS,
  DEFAULT_CLEANUP_BATCH_SIZE,
  DEFAULT_HASH_ALGORITHM,
} from './compliance.types';
import { AuditLogManager } from './audit';
import { RetentionPolicyManager } from './retention';
import { AuditExporter } from './export';

/**
 * Main compliance service
 */
export class ComplianceService {
  private auditManager: AuditLogManager;
  private retentionManager: RetentionPolicyManager;
  private exporter: AuditExporter;
  private config: ComplianceConfig;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;
  private archiveCallback?: (events: AuditEvent[], destination: string) => Promise<void>;

  constructor(config: ComplianceConfig = {}) {
    this.config = {
      defaultRetentionDays: config.defaultRetentionDays ?? DEFAULT_RETENTION_DAYS,
      enableHashChaining: config.enableHashChaining ?? true,
      hashAlgorithm: config.hashAlgorithm ?? DEFAULT_HASH_ALGORITHM,
      maxQueryLimit: config.maxQueryLimit ?? 10000,
      cleanupBatchSize: config.cleanupBatchSize ?? DEFAULT_CLEANUP_BATCH_SIZE,
      enableAutoCleanup: config.enableAutoCleanup ?? false,
      autoCleanupIntervalMs: config.autoCleanupIntervalMs ?? 24 * 60 * 60 * 1000, // 24 hours
      archiveStorage: config.archiveStorage,
    };

    this.auditManager = new AuditLogManager(this.config.hashAlgorithm);
    this.retentionManager = new RetentionPolicyManager(
      this.config.defaultRetentionDays,
      this.config.cleanupBatchSize
    );
    this.exporter = new AuditExporter(this.auditManager);

    // Start auto cleanup if enabled
    if (this.config.enableAutoCleanup) {
      this.startAutoCleanup();
    }
  }

  // ============================================
  // Audit Log Operations
  // ============================================

  /**
   * Log an audit event
   */
  async log(input: CreateAuditEventInput): Promise<AuditEvent> {
    const event = await this.auditManager.log(input);

    // Apply expiration based on retention policy
    const policy = this.retentionManager.findMatchingPolicy(event);
    if (policy) {
      event.expiresAt = this.retentionManager.calculateExpirationDate(event);
    }

    return event;
  }

  /**
   * Log multiple audit events
   */
  async logBatch(inputs: CreateAuditEventInput[]): Promise<AuditEvent[]> {
    const events: AuditEvent[] = [];
    for (const input of inputs) {
      events.push(await this.log(input));
    }
    return events;
  }

  /**
   * Get an audit event by ID
   */
  getEvent(id: string): AuditEvent | null {
    return this.auditManager.getEvent(id);
  }

  /**
   * Query audit events
   */
  query(filters: AuditQueryFilters, options?: AuditQueryOptions): AuditQueryResult {
    return this.auditManager.query(filters, options);
  }

  /**
   * Get events by tenant
   */
  getEventsByTenant(tenantId: string): AuditEvent[] {
    return this.auditManager.getEventsByTenant(tenantId);
  }

  /**
   * Get audit statistics
   */
  getStatistics(tenantId?: string): AuditStatistics {
    return this.auditManager.getStatistics(tenantId);
  }

  /**
   * Get event count
   */
  getEventCount(tenantId?: string): number {
    return this.auditManager.getEventCount(tenantId);
  }

  /**
   * Register event handler
   */
  onEvent(handler: AuditEventHandler): void {
    this.auditManager.onEvent(handler);
  }

  /**
   * Remove event handler
   */
  offEvent(handler: AuditEventHandler): void {
    this.auditManager.offEvent(handler);
  }

  // ============================================
  // Integrity Verification
  // ============================================

  /**
   * Verify integrity of audit chain for a tenant
   */
  verifyIntegrity(tenantId: string): IntegrityCheckResult {
    return this.auditManager.verifyIntegrity(tenantId);
  }

  /**
   * Verify integrity for all tenants
   */
  verifyAllIntegrity(): Map<string, IntegrityCheckResult> {
    const results = new Map<string, IntegrityCheckResult>();
    const tenantIds = this.getTenantIds();

    for (const tenantId of tenantIds) {
      results.set(tenantId, this.verifyIntegrity(tenantId));
    }

    return results;
  }

  // ============================================
  // Retention Policy Operations
  // ============================================

  /**
   * Create a retention policy
   */
  createRetentionPolicy(input: CreateRetentionPolicyInput): RetentionPolicy {
    return this.retentionManager.createPolicy(input);
  }

  /**
   * Get a retention policy by ID
   */
  getRetentionPolicy(id: string, tenantId?: string): RetentionPolicy | null {
    return this.retentionManager.getPolicy(id, tenantId);
  }

  /**
   * Get all retention policies
   */
  getRetentionPolicies(tenantId?: string): RetentionPolicy[] {
    return this.retentionManager.getPolicies(tenantId);
  }

  /**
   * Get active retention policies
   */
  getActiveRetentionPolicies(tenantId?: string): RetentionPolicy[] {
    return this.retentionManager.getActivePolicies(tenantId);
  }

  /**
   * Update a retention policy
   */
  updateRetentionPolicy(
    id: string,
    updates: UpdateRetentionPolicyInput,
    tenantId?: string
  ): RetentionPolicy | null {
    return this.retentionManager.updatePolicy(id, updates, tenantId);
  }

  /**
   * Delete a retention policy
   */
  deleteRetentionPolicy(id: string, tenantId?: string): boolean {
    return this.retentionManager.deletePolicy(id, tenantId);
  }

  /**
   * Find matching policy for an event
   */
  findMatchingPolicy(event: AuditEvent): RetentionPolicy | null {
    return this.retentionManager.findMatchingPolicy(event);
  }

  /**
   * Get events expiring within a given number of days
   */
  getExpiringEvents(withinDays: number, tenantId?: string): AuditEvent[] {
    return this.retentionManager.getExpiringEvents(this.auditManager, withinDays, tenantId);
  }

  // ============================================
  // Cleanup Operations
  // ============================================

  /**
   * Run cleanup to delete/archive expired events
   */
  async runCleanup(): Promise<CleanupResult> {
    return this.retentionManager.runCleanup(this.auditManager, this.archiveCallback);
  }

  /**
   * Set archive callback for cleanup
   */
  setArchiveCallback(
    callback: (events: AuditEvent[], destination: string) => Promise<void>
  ): void {
    this.archiveCallback = callback;
  }

  /**
   * Start automatic cleanup
   */
  startAutoCleanup(): void {
    if (this.cleanupInterval) {
      return;
    }

    this.cleanupInterval = setInterval(async () => {
      try {
        await this.runCleanup();
      } catch (error) {
        console.error('Auto cleanup failed:', error);
      }
    }, this.config.autoCleanupIntervalMs);
  }

  /**
   * Stop automatic cleanup
   */
  stopAutoCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  // ============================================
  // Export Operations
  // ============================================

  /**
   * Export audit events
   */
  async export(
    filters: AuditQueryFilters,
    options: ExportOptions
  ): Promise<{ data: Buffer; result: ExportResult }> {
    return this.exporter.export(filters, options);
  }

  /**
   * Export audit events as a stream
   */
  exportStream(
    filters: AuditQueryFilters,
    options: ExportOptions,
    batchSize?: number
  ): AsyncGenerator<Buffer, ExportResult, undefined> {
    return this.exporter.exportStream(filters, options, batchSize);
  }

  // ============================================
  // Data Management
  // ============================================

  /**
   * Import audit events (for recovery/migration)
   */
  importEvents(events: AuditEvent[]): void {
    this.auditManager.importEvents(events);
  }

  /**
   * Import retention policies
   */
  importPolicies(policies: RetentionPolicy[]): void {
    this.retentionManager.importPolicies(policies);
  }

  /**
   * Get all audit events
   */
  getAllEvents(): AuditEvent[] {
    return this.auditManager.getAllEvents();
  }

  /**
   * Delete an event by ID
   */
  deleteEvent(id: string): boolean {
    return this.auditManager.deleteEvent(id);
  }

  /**
   * Delete events by filter
   */
  deleteEvents(filter: (event: AuditEvent) => boolean): number {
    return this.auditManager.deleteEvents(filter);
  }

  /**
   * Clear all data (for testing)
   */
  clear(): void {
    this.auditManager.clear();
    this.retentionManager.clear();
  }

  /**
   * Get configuration
   */
  getConfig(): ComplianceConfig {
    return { ...this.config };
  }

  /**
   * Shutdown service
   */
  shutdown(): void {
    this.stopAutoCleanup();
  }

  // ============================================
  // Helper Methods
  // ============================================

  /**
   * Get all tenant IDs with events
   */
  private getTenantIds(): string[] {
    const tenantIds = new Set<string>();
    for (const event of this.auditManager.getAllEvents()) {
      tenantIds.add(event.tenantId);
    }
    return Array.from(tenantIds);
  }
}

/**
 * Singleton instance
 */
let complianceServiceInstance: ComplianceService | null = null;

/**
 * Get the singleton compliance service instance
 */
export function getComplianceService(config?: ComplianceConfig): ComplianceService {
  if (!complianceServiceInstance) {
    complianceServiceInstance = new ComplianceService(config);
  }
  return complianceServiceInstance;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetComplianceService(): void {
  if (complianceServiceInstance) {
    complianceServiceInstance.shutdown();
    complianceServiceInstance = null;
  }
}
