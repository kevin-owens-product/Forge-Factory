/**
 * @package @forge/compliance
 * @description Compliance and audit logging system for Forge Factory
 *
 * Features:
 * - Audit event logging with hash chaining for tamper-evidence
 * - Data retention policies with automatic cleanup
 * - Export to multiple formats (JSON, CSV, NDJSON)
 * - Multi-tenant support with isolation
 * - Integrity verification
 */

// Main service
export {
  ComplianceService,
  getComplianceService,
  resetComplianceService,
} from './compliance.service';

// Audit logging
export {
  AuditLogManager,
  getAuditLogManager,
  resetAuditLogManager,
} from './audit';

// Retention policies
export {
  RetentionPolicyManager,
  getRetentionPolicyManager,
  resetRetentionPolicyManager,
} from './retention';

// Export functionality
export { AuditExporter, createAuditExporter } from './export';

// Types
export type {
  // Event types
  AuditEventType,
  AuditSeverity,
  AuditOutcome,
  AuditEventSubtype,
  AuthEventSubtype,
  AccessEventSubtype,
  DataChangeEventSubtype,
  AdminEventSubtype,
  SecurityEventSubtype,
  // Audit event
  AuditEvent,
  AuditActor,
  AuditTarget,
  AuditRequestContext,
  CreateAuditEventInput,
  // Query
  AuditQueryFilters,
  AuditQueryOptions,
  AuditQueryResult,
  // Retention
  RetentionPolicy,
  CreateRetentionPolicyInput,
  UpdateRetentionPolicyInput,
  CleanupResult,
  // Export
  ExportFormat,
  ExportOptions,
  ExportResult,
  // Other
  IntegrityCheckResult,
  ComplianceConfig,
  AuditStatistics,
  AuditEventHandler,
} from './compliance.types';

// Constants
export {
  DEFAULT_RETENTION_DAYS,
  DEFAULT_QUERY_LIMIT,
  DEFAULT_CLEANUP_BATCH_SIZE,
  DEFAULT_HASH_ALGORITHM,
  MAX_QUERY_LIMIT,
} from './compliance.types';
