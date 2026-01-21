/**
 * @package @forge/compliance
 * @description TypeScript interfaces for compliance and audit logging
 */

/**
 * Audit event types
 */
export type AuditEventType =
  | 'AUTH'
  | 'ACCESS'
  | 'DATA_CHANGE'
  | 'ADMIN_ACTION'
  | 'SECURITY'
  | 'SYSTEM'
  | 'CUSTOM';

/**
 * Audit event severity levels
 */
export type AuditSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/**
 * Audit event outcome
 */
export type AuditOutcome = 'SUCCESS' | 'FAILURE' | 'PARTIAL' | 'UNKNOWN';

/**
 * Auth-specific event subtypes
 */
export type AuthEventSubtype =
  | 'LOGIN'
  | 'LOGOUT'
  | 'LOGIN_FAILED'
  | 'PASSWORD_CHANGE'
  | 'PASSWORD_RESET'
  | 'MFA_ENABLED'
  | 'MFA_DISABLED'
  | 'MFA_VERIFIED'
  | 'SESSION_CREATED'
  | 'SESSION_EXPIRED'
  | 'SESSION_REVOKED'
  | 'TOKEN_REFRESHED'
  | 'API_KEY_CREATED'
  | 'API_KEY_REVOKED';

/**
 * Access-specific event subtypes
 */
export type AccessEventSubtype =
  | 'RESOURCE_READ'
  | 'RESOURCE_WRITE'
  | 'RESOURCE_DELETE'
  | 'PERMISSION_GRANTED'
  | 'PERMISSION_DENIED'
  | 'ROLE_ASSIGNED'
  | 'ROLE_REMOVED';

/**
 * Data change event subtypes
 */
export type DataChangeEventSubtype =
  | 'RECORD_CREATED'
  | 'RECORD_UPDATED'
  | 'RECORD_DELETED'
  | 'BULK_IMPORT'
  | 'BULK_EXPORT'
  | 'DATA_MIGRATION';

/**
 * Admin action event subtypes
 */
export type AdminEventSubtype =
  | 'USER_CREATED'
  | 'USER_UPDATED'
  | 'USER_DELETED'
  | 'USER_SUSPENDED'
  | 'USER_ACTIVATED'
  | 'SETTINGS_CHANGED'
  | 'CONFIG_UPDATED'
  | 'INTEGRATION_ADDED'
  | 'INTEGRATION_REMOVED';

/**
 * Security event subtypes
 */
export type SecurityEventSubtype =
  | 'BRUTE_FORCE_DETECTED'
  | 'SUSPICIOUS_ACTIVITY'
  | 'IP_BLOCKED'
  | 'RATE_LIMIT_EXCEEDED'
  | 'INVALID_TOKEN'
  | 'PRIVILEGE_ESCALATION'
  | 'DATA_BREACH_ATTEMPT';

/**
 * All event subtypes
 */
export type AuditEventSubtype =
  | AuthEventSubtype
  | AccessEventSubtype
  | DataChangeEventSubtype
  | AdminEventSubtype
  | SecurityEventSubtype
  | string;

/**
 * Actor information (who performed the action)
 */
export interface AuditActor {
  /** Actor ID (user ID, service ID, etc.) */
  id: string;
  /** Actor type */
  type: 'USER' | 'SERVICE' | 'SYSTEM' | 'ANONYMOUS';
  /** Display name */
  name?: string;
  /** Email address */
  email?: string;
  /** IP address */
  ipAddress?: string;
  /** User agent string */
  userAgent?: string;
  /** Session ID */
  sessionId?: string;
  /** Additional actor attributes */
  attributes?: Record<string, unknown>;
}

/**
 * Target information (what was affected)
 */
export interface AuditTarget {
  /** Target ID */
  id: string;
  /** Target type (e.g., 'USER', 'DOCUMENT', 'SETTING') */
  type: string;
  /** Target name */
  name?: string;
  /** Previous state (for changes) */
  previousState?: unknown;
  /** New state (for changes) */
  newState?: unknown;
  /** Additional target attributes */
  attributes?: Record<string, unknown>;
}

/**
 * Request context information
 */
export interface AuditRequestContext {
  /** Request ID */
  requestId?: string;
  /** API endpoint */
  endpoint?: string;
  /** HTTP method */
  method?: string;
  /** Source application */
  sourceApp?: string;
  /** Geographic location */
  location?: {
    country?: string;
    region?: string;
    city?: string;
    coordinates?: { lat: number; lng: number };
  };
  /** Additional context */
  metadata?: Record<string, unknown>;
}

/**
 * Audit event record
 */
export interface AuditEvent {
  /** Unique event ID */
  id: string;
  /** Event type */
  type: AuditEventType;
  /** Event subtype for more specific categorization */
  subtype?: AuditEventSubtype;
  /** Severity level */
  severity: AuditSeverity;
  /** Event outcome */
  outcome: AuditOutcome;
  /** Event timestamp */
  timestamp: Date;
  /** Tenant ID */
  tenantId: string;
  /** Actor (who performed the action) */
  actor: AuditActor;
  /** Target (what was affected) */
  target?: AuditTarget;
  /** Action description */
  action: string;
  /** Detailed message */
  message?: string;
  /** Request context */
  context?: AuditRequestContext;
  /** Hash of previous event (for chain integrity) */
  previousHash?: string;
  /** Hash of this event */
  hash: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Tags for categorization */
  tags?: string[];
  /** Expiration timestamp (based on retention policy) */
  expiresAt?: Date;
}

/**
 * Create audit event input
 */
export interface CreateAuditEventInput {
  type: AuditEventType;
  subtype?: AuditEventSubtype;
  severity?: AuditSeverity;
  outcome?: AuditOutcome;
  tenantId: string;
  actor: AuditActor;
  target?: AuditTarget;
  action: string;
  message?: string;
  context?: AuditRequestContext;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

/**
 * Audit query filters
 */
export interface AuditQueryFilters {
  /** Filter by tenant */
  tenantId?: string;
  /** Filter by event types */
  types?: AuditEventType[];
  /** Filter by subtypes */
  subtypes?: AuditEventSubtype[];
  /** Filter by severity levels */
  severities?: AuditSeverity[];
  /** Filter by outcomes */
  outcomes?: AuditOutcome[];
  /** Filter by actor ID */
  actorId?: string;
  /** Filter by actor type */
  actorType?: AuditActor['type'];
  /** Filter by target ID */
  targetId?: string;
  /** Filter by target type */
  targetType?: string;
  /** Filter by IP address */
  ipAddress?: string;
  /** Filter by start time */
  startTime?: Date;
  /** Filter by end time */
  endTime?: Date;
  /** Filter by tags */
  tags?: string[];
  /** Free text search */
  search?: string;
}

/**
 * Audit query options
 */
export interface AuditQueryOptions {
  /** Number of records to return */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  /** Sort field */
  sortBy?: 'timestamp' | 'severity' | 'type';
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
  /** Include expired events */
  includeExpired?: boolean;
}

/**
 * Audit query result
 */
export interface AuditQueryResult {
  /** Events matching the query */
  events: AuditEvent[];
  /** Total count (for pagination) */
  total: number;
  /** Whether there are more results */
  hasMore: boolean;
  /** Query execution time in ms */
  queryTimeMs: number;
}

/**
 * Retention policy definition
 */
export interface RetentionPolicy {
  /** Policy ID */
  id: string;
  /** Policy name */
  name: string;
  /** Description */
  description?: string;
  /** Event types this policy applies to */
  eventTypes?: AuditEventType[];
  /** Severity levels this policy applies to */
  severities?: AuditSeverity[];
  /** Tags this policy applies to */
  tags?: string[];
  /** Retention period in days */
  retentionDays: number;
  /** Archive before deletion? */
  archiveBeforeDelete?: boolean;
  /** Archive destination (storage key prefix) */
  archiveDestination?: string;
  /** Whether policy is active */
  isActive: boolean;
  /** Priority (higher priority policies take precedence) */
  priority: number;
  /** Tenant ID (null for global policies) */
  tenantId?: string;
  /** Created timestamp */
  createdAt: Date;
  /** Updated timestamp */
  updatedAt: Date;
}

/**
 * Create retention policy input
 */
export interface CreateRetentionPolicyInput {
  id?: string;
  name: string;
  description?: string;
  eventTypes?: AuditEventType[];
  severities?: AuditSeverity[];
  tags?: string[];
  retentionDays: number;
  archiveBeforeDelete?: boolean;
  archiveDestination?: string;
  isActive?: boolean;
  priority?: number;
  tenantId?: string;
}

/**
 * Update retention policy input
 */
export interface UpdateRetentionPolicyInput {
  name?: string;
  description?: string;
  eventTypes?: AuditEventType[];
  severities?: AuditSeverity[];
  tags?: string[];
  retentionDays?: number;
  archiveBeforeDelete?: boolean;
  archiveDestination?: string;
  isActive?: boolean;
  priority?: number;
}

/**
 * Cleanup result
 */
export interface CleanupResult {
  /** Number of events deleted */
  deleted: number;
  /** Number of events archived */
  archived: number;
  /** Number of events that failed cleanup */
  failed: number;
  /** Cleanup duration in ms */
  durationMs: number;
  /** Tenant cleanup details */
  byTenant?: Record<string, { deleted: number; archived: number }>;
}

/**
 * Export format options
 */
export type ExportFormat = 'JSON' | 'CSV' | 'NDJSON';

/**
 * Export options
 */
export interface ExportOptions {
  /** Export format */
  format: ExportFormat;
  /** Fields to include (null for all) */
  fields?: string[];
  /** Include hash chain verification */
  includeIntegrity?: boolean;
  /** Compress output */
  compress?: boolean;
  /** Pretty print (for JSON) */
  prettyPrint?: boolean;
  /** CSV delimiter */
  csvDelimiter?: string;
  /** Date format for CSV */
  dateFormat?: string;
}

/**
 * Export result
 */
export interface ExportResult {
  /** Export ID */
  id: string;
  /** Number of events exported */
  eventCount: number;
  /** Export size in bytes */
  sizeBytes: number;
  /** Export format used */
  format: ExportFormat;
  /** Storage key (if stored) */
  storageKey?: string;
  /** Download URL (if available) */
  downloadUrl?: string;
  /** Export duration in ms */
  durationMs: number;
  /** Integrity verification result */
  integrityVerified?: boolean;
  /** Created timestamp */
  createdAt: Date;
}

/**
 * Integrity verification result
 */
export interface IntegrityCheckResult {
  /** Overall integrity status */
  valid: boolean;
  /** Total events checked */
  totalChecked: number;
  /** Number of valid events */
  validCount: number;
  /** Number of invalid events */
  invalidCount: number;
  /** First invalid event (if any) */
  firstInvalidEvent?: {
    id: string;
    timestamp: Date;
    expectedHash: string;
    actualHash: string;
  };
  /** Check duration in ms */
  durationMs: number;
}

/**
 * Compliance service configuration
 */
export interface ComplianceConfig {
  /** Default retention days (if no policy matches) */
  defaultRetentionDays?: number;
  /** Enable hash chaining for integrity */
  enableHashChaining?: boolean;
  /** Hash algorithm to use */
  hashAlgorithm?: 'sha256' | 'sha384' | 'sha512';
  /** Maximum events per query */
  maxQueryLimit?: number;
  /** Batch size for cleanup operations */
  cleanupBatchSize?: number;
  /** Enable automatic cleanup */
  enableAutoCleanup?: boolean;
  /** Auto cleanup interval in ms */
  autoCleanupIntervalMs?: number;
  /** Storage service for archival */
  archiveStorage?: unknown;
}

/**
 * Audit statistics
 */
export interface AuditStatistics {
  /** Total events */
  totalEvents: number;
  /** Events by type */
  byType: Record<AuditEventType, number>;
  /** Events by severity */
  bySeverity: Record<AuditSeverity, number>;
  /** Events by outcome */
  byOutcome: Record<AuditOutcome, number>;
  /** Events in last 24 hours */
  last24Hours: number;
  /** Events in last 7 days */
  last7Days: number;
  /** Oldest event timestamp */
  oldestEvent?: Date;
  /** Newest event timestamp */
  newestEvent?: Date;
  /** Storage size estimate in bytes */
  storageSizeBytes?: number;
}

/**
 * Event handler for streaming events
 */
export type AuditEventHandler = (event: AuditEvent) => void | Promise<void>;

/**
 * Default values
 */
export const DEFAULT_RETENTION_DAYS = 90;
export const DEFAULT_QUERY_LIMIT = 100;
export const DEFAULT_CLEANUP_BATCH_SIZE = 1000;
export const DEFAULT_HASH_ALGORITHM = 'sha256';
export const MAX_QUERY_LIMIT = 10000;
