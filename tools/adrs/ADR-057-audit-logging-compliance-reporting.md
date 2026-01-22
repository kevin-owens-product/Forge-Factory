# ADR-057: Audit Logging & Compliance Reporting

**Status:** Accepted
**Date:** 2026-01-21
**Priority:** P1 - Enterprise Ready
**Complexity:** High

---

## Context

Enterprise customers require **comprehensive audit trails** for compliance with SOC 2, ISO 27001, HIPAA, and PCI-DSS. Every action in Forge Factory must be logged, stored securely, and available for compliance reporting.

### Business Requirements

- **Completeness:** Log all security-relevant events
- **Immutability:** Logs cannot be modified or deleted
- **Retention:** 7-year retention for compliance
- **Search:** Fast query capability across billions of records
- **Reporting:** Automated compliance reports
- **Real-time:** Stream events for security monitoring

### Compliance Framework Requirements

| Framework | Logging Requirements | Retention | Access |
|-----------|---------------------|-----------|--------|
| SOC 2 | All access, changes | 7 years | Auditors |
| ISO 27001 | Security events | 3+ years | ISMS |
| HIPAA | PHI access | 6 years | Covered entities |
| PCI-DSS | Cardholder data | 1+ year | QSA |
| GDPR | Data processing | Varies | DPO |

### Event Categories

1. **Authentication** - Login, logout, MFA, password changes
2. **Authorization** - Permission changes, role assignments
3. **Data Access** - Read, create, update, delete operations
4. **Configuration** - System settings changes
5. **Security** - Failed attempts, suspicious activity
6. **Transformation** - Code analysis, changes, deployments

---

## Decision

We will implement a **comprehensive audit logging system** with:

1. **Event Capture** - Intercept all auditable actions
2. **Secure Storage** - Immutable, tamper-proof storage
3. **Query Engine** - Fast search across audit logs
4. **Compliance Reports** - Automated report generation
5. **Real-time Streaming** - SIEM integration

### Architecture Overview

```typescript
interface AuditLoggingSystem {
  // Logging
  log(event: AuditEvent): Promise<void>;
  logBatch(events: AuditEvent[]): Promise<void>;

  // Query
  query(query: AuditQuery): Promise<AuditQueryResult>;
  stream(query: AuditQuery): AsyncIterator<AuditEvent>;

  // Reporting
  generateReport(type: ReportType, period: DateRange): Promise<ComplianceReport>;

  // Export
  export(query: AuditQuery, format: ExportFormat): Promise<ExportResult>;
}

interface AuditEvent {
  // Identity
  id: string;
  timestamp: Date;
  version: string;

  // Actor
  actorId: string;
  actorType: 'user' | 'service' | 'system';
  actorEmail?: string;
  actorIp?: string;
  actorUserAgent?: string;

  // Action
  action: AuditAction;
  category: AuditCategory;
  outcome: 'success' | 'failure' | 'pending';

  // Resource
  resourceType: string;
  resourceId: string;
  resourceName?: string;

  // Context
  organizationId: string;
  projectId?: string;
  sessionId?: string;
  requestId?: string;

  // Details
  details: Record<string, any>;
  changes?: {
    before: Record<string, any>;
    after: Record<string, any>;
  };

  // Compliance
  piiAccessed: boolean;
  sensitiveData: boolean;
  complianceFlags: string[];
}

type AuditAction =
  // Authentication
  | 'auth.login' | 'auth.logout' | 'auth.mfa_enabled' | 'auth.password_changed'
  | 'auth.session_created' | 'auth.session_revoked'
  // Authorization
  | 'authz.role_assigned' | 'authz.role_revoked' | 'authz.permission_granted'
  // Data
  | 'data.created' | 'data.read' | 'data.updated' | 'data.deleted' | 'data.exported'
  // Transformation
  | 'transform.started' | 'transform.completed' | 'transform.failed' | 'transform.approved'
  // Configuration
  | 'config.updated' | 'config.secret_accessed' | 'config.integration_added'
  // Security
  | 'security.alert' | 'security.incident' | 'security.vulnerability_found';
```

### Component 1: Event Capture

Intercept and enrich audit events.

```typescript
class AuditEventCapture {
  private enrichers: EventEnricher[] = [];
  private filters: EventFilter[] = [];

  constructor(
    private logger: AuditLogger,
    private config: AuditConfig
  ) {
    this.setupEnrichers();
    this.setupFilters();
  }

  async capture(event: Partial<AuditEvent>): Promise<void> {
    // Generate event ID
    const auditEvent: AuditEvent = {
      id: generateUUID(),
      timestamp: new Date(),
      version: '1.0',
      ...event,
    } as AuditEvent;

    // Enrich event
    for (const enricher of this.enrichers) {
      await enricher.enrich(auditEvent);
    }

    // Apply filters
    for (const filter of this.filters) {
      if (!filter.shouldLog(auditEvent)) {
        return; // Skip logging
      }
    }

    // Validate event
    this.validateEvent(auditEvent);

    // Log event
    await this.logger.log(auditEvent);
  }

  private setupEnrichers(): void {
    // Add IP geolocation
    this.enrichers.push({
      enrich: async (event) => {
        if (event.actorIp) {
          event.details = {
            ...event.details,
            geoLocation: await this.geolocate(event.actorIp),
          };
        }
      },
    });

    // Add compliance flags
    this.enrichers.push({
      enrich: async (event) => {
        event.complianceFlags = this.determineComplianceFlags(event);
      },
    });

    // Add PII detection
    this.enrichers.push({
      enrich: async (event) => {
        event.piiAccessed = this.detectPII(event);
        event.sensitiveData = this.detectSensitiveData(event);
      },
    });
  }

  private determineComplianceFlags(event: AuditEvent): string[] {
    const flags: string[] = [];

    // SOC 2 - Security events
    if (event.category === 'security' || event.category === 'authentication') {
      flags.push('SOC2');
    }

    // HIPAA - PHI access
    if (event.piiAccessed && event.resourceType.includes('health')) {
      flags.push('HIPAA');
    }

    // PCI-DSS - Payment data
    if (event.resourceType.includes('payment') || event.resourceType.includes('card')) {
      flags.push('PCI-DSS');
    }

    // GDPR - EU data
    if (event.details?.region === 'EU' || event.details?.gdprRelevant) {
      flags.push('GDPR');
    }

    return flags;
  }
}

// Middleware for automatic audit logging
class AuditMiddleware {
  constructor(private auditCapture: AuditEventCapture) {}

  middleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();

      // Capture request info
      const requestInfo = {
        method: req.method,
        path: req.path,
        query: req.query,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      };

      // Continue with request
      res.on('finish', async () => {
        // Determine if this request should be audited
        if (this.shouldAudit(req, res)) {
          await this.auditCapture.capture({
            actorId: req.user?.id || 'anonymous',
            actorType: req.user ? 'user' : 'system',
            actorEmail: req.user?.email,
            actorIp: req.ip,
            actorUserAgent: req.headers['user-agent'],

            action: this.mapRequestToAction(req),
            category: this.mapRequestToCategory(req),
            outcome: res.statusCode < 400 ? 'success' : 'failure',

            resourceType: this.extractResourceType(req),
            resourceId: req.params.id || '',

            organizationId: req.user?.organizationId || '',
            sessionId: req.session?.id,
            requestId: req.id,

            details: {
              ...requestInfo,
              statusCode: res.statusCode,
              duration: Date.now() - startTime,
              responseSize: res.get('content-length'),
            },
          });
        }
      });

      next();
    };
  }

  private shouldAudit(req: Request, res: Response): boolean {
    // Always audit write operations
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      return true;
    }

    // Audit sensitive reads
    if (req.path.includes('/users') || req.path.includes('/secrets')) {
      return true;
    }

    // Audit failed requests
    if (res.statusCode >= 400) {
      return true;
    }

    return false;
  }
}
```

### Component 2: Secure Storage

Immutable, tamper-proof audit log storage.

```typescript
class AuditLogStorage {
  constructor(
    private primaryStore: AuditStore,
    private archiveStore: ArchiveStore,
    private integrityService: IntegrityService
  ) {}

  async store(event: AuditEvent): Promise<void> {
    // Add integrity hash
    const eventWithHash = {
      ...event,
      hash: this.calculateHash(event),
      previousHash: await this.getLastHash(),
    };

    // Store in primary (hot storage)
    await this.primaryStore.insert(eventWithHash);

    // Async replication to archive
    this.replicateToArchive(eventWithHash);
  }

  private calculateHash(event: AuditEvent): string {
    const content = JSON.stringify({
      id: event.id,
      timestamp: event.timestamp,
      action: event.action,
      actorId: event.actorId,
      resourceId: event.resourceId,
      details: event.details,
    });

    return crypto.createHash('sha256').update(content).digest('hex');
  }

  async verifyIntegrity(startDate: Date, endDate: Date): Promise<IntegrityResult> {
    const events = await this.primaryStore.query({
      startDate,
      endDate,
      orderBy: 'timestamp',
    });

    let previousHash = '';
    const violations: IntegrityViolation[] = [];

    for (const event of events) {
      // Verify hash chain
      if (event.previousHash !== previousHash) {
        violations.push({
          eventId: event.id,
          type: 'chain_broken',
          expected: previousHash,
          actual: event.previousHash,
        });
      }

      // Verify event hash
      const calculatedHash = this.calculateHash(event);
      if (event.hash !== calculatedHash) {
        violations.push({
          eventId: event.id,
          type: 'hash_mismatch',
          expected: event.hash,
          actual: calculatedHash,
        });
      }

      previousHash = event.hash;
    }

    return {
      verified: violations.length === 0,
      eventsChecked: events.length,
      violations,
    };
  }

  async archiveOldLogs(retentionDays: number): Promise<ArchiveResult> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    // Move to cold storage (S3 Glacier, etc.)
    const events = await this.primaryStore.query({
      endDate: cutoffDate,
      limit: 100000,
    });

    // Compress and encrypt
    const archive = await this.compressAndEncrypt(events);

    // Store in archive
    const archiveId = await this.archiveStore.store(archive);

    // Verify archive integrity
    await this.verifyArchive(archiveId);

    // Remove from hot storage (keep reference)
    await this.primaryStore.markArchived(events.map(e => e.id), archiveId);

    return {
      eventsArchived: events.length,
      archiveId,
      archiveSize: archive.size,
    };
  }
}

class AuditStore {
  constructor(private db: Database) {}

  async insert(event: AuditEventWithHash): Promise<void> {
    await this.db.query(`
      INSERT INTO audit_logs (
        id, timestamp, version, actor_id, actor_type, actor_email,
        actor_ip, actor_user_agent, action, category, outcome,
        resource_type, resource_id, organization_id, project_id,
        session_id, request_id, details, changes, pii_accessed,
        sensitive_data, compliance_flags, hash, previous_hash
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
        $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24
      )
    `, [
      event.id,
      event.timestamp,
      event.version,
      event.actorId,
      event.actorType,
      event.actorEmail,
      event.actorIp,
      event.actorUserAgent,
      event.action,
      event.category,
      event.outcome,
      event.resourceType,
      event.resourceId,
      event.organizationId,
      event.projectId,
      event.sessionId,
      event.requestId,
      JSON.stringify(event.details),
      JSON.stringify(event.changes),
      event.piiAccessed,
      event.sensitiveData,
      event.complianceFlags,
      event.hash,
      event.previousHash,
    ]);
  }

  async query(query: AuditQuery): Promise<AuditEvent[]> {
    let sql = 'SELECT * FROM audit_logs WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (query.startDate) {
      sql += ` AND timestamp >= $${paramIndex++}`;
      params.push(query.startDate);
    }

    if (query.endDate) {
      sql += ` AND timestamp <= $${paramIndex++}`;
      params.push(query.endDate);
    }

    if (query.actorId) {
      sql += ` AND actor_id = $${paramIndex++}`;
      params.push(query.actorId);
    }

    if (query.action) {
      sql += ` AND action = $${paramIndex++}`;
      params.push(query.action);
    }

    if (query.resourceType) {
      sql += ` AND resource_type = $${paramIndex++}`;
      params.push(query.resourceType);
    }

    if (query.organizationId) {
      sql += ` AND organization_id = $${paramIndex++}`;
      params.push(query.organizationId);
    }

    if (query.complianceFlags?.length) {
      sql += ` AND compliance_flags && $${paramIndex++}`;
      params.push(query.complianceFlags);
    }

    sql += ` ORDER BY ${query.orderBy || 'timestamp'} DESC`;

    if (query.limit) {
      sql += ` LIMIT $${paramIndex++}`;
      params.push(query.limit);
    }

    const result = await this.db.query(sql, params);
    return result.rows.map(this.mapRowToEvent);
  }
}
```

### Component 3: Query Engine

Fast search across audit logs.

```typescript
class AuditQueryEngine {
  constructor(
    private store: AuditStore,
    private searchIndex: SearchIndex,
    private cache: QueryCache
  ) {}

  async query(query: AuditQuery): Promise<AuditQueryResult> {
    // Check cache for common queries
    const cacheKey = this.generateCacheKey(query);
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Use search index for full-text queries
    if (query.search) {
      return this.searchWithIndex(query);
    }

    // Use database for structured queries
    const events = await this.store.query(query);
    const total = await this.store.count(query);

    const result: AuditQueryResult = {
      events,
      total,
      page: query.page || 1,
      pageSize: query.limit || 50,
      hasMore: events.length < total,
    };

    // Cache results
    await this.cache.set(cacheKey, result, 300); // 5 min cache

    return result;
  }

  async aggregate(query: AuditAggregateQuery): Promise<AuditAggregateResult> {
    const aggregations: AggregationResult[] = [];

    // Events by action
    if (query.groupBy.includes('action')) {
      const byAction = await this.store.aggregate({
        ...query,
        groupBy: 'action',
      });
      aggregations.push({ name: 'byAction', data: byAction });
    }

    // Events by actor
    if (query.groupBy.includes('actor')) {
      const byActor = await this.store.aggregate({
        ...query,
        groupBy: 'actor_id',
      });
      aggregations.push({ name: 'byActor', data: byActor });
    }

    // Events over time
    if (query.groupBy.includes('time')) {
      const byTime = await this.store.aggregateTimeSeries({
        ...query,
        interval: query.timeInterval || 'hour',
      });
      aggregations.push({ name: 'byTime', data: byTime });
    }

    // Events by outcome
    const byOutcome = await this.store.aggregate({
      ...query,
      groupBy: 'outcome',
    });
    aggregations.push({ name: 'byOutcome', data: byOutcome });

    return {
      aggregations,
      query,
      period: { start: query.startDate, end: query.endDate },
    };
  }

  async getActivityFeed(
    organizationId: string,
    options: ActivityFeedOptions
  ): Promise<ActivityFeed> {
    const events = await this.store.query({
      organizationId,
      startDate: options.since,
      limit: options.limit || 50,
      actions: options.actions,
    });

    // Group by day
    const grouped = this.groupByDay(events);

    // Summarize similar events
    const summarized = this.summarizeSimilarEvents(grouped);

    return {
      days: summarized,
      hasMore: events.length === options.limit,
    };
  }
}
```

### Component 4: Compliance Reports

Automated compliance report generation.

```typescript
class ComplianceReportGenerator {
  constructor(
    private queryEngine: AuditQueryEngine,
    private templateEngine: ReportTemplateEngine
  ) {}

  async generateReport(
    type: ComplianceReportType,
    period: DateRange,
    options: ReportOptions
  ): Promise<ComplianceReport> {
    switch (type) {
      case 'SOC2':
        return this.generateSOC2Report(period, options);
      case 'ISO27001':
        return this.generateISO27001Report(period, options);
      case 'HIPAA':
        return this.generateHIPAAReport(period, options);
      case 'PCI-DSS':
        return this.generatePCIDSSReport(period, options);
      case 'GDPR':
        return this.generateGDPRReport(period, options);
      default:
        throw new Error(`Unknown report type: ${type}`);
    }
  }

  private async generateSOC2Report(
    period: DateRange,
    options: ReportOptions
  ): Promise<ComplianceReport> {
    // SOC 2 Trust Service Criteria
    const criteria = [
      'CC1', // Control Environment
      'CC2', // Communication and Information
      'CC3', // Risk Assessment
      'CC4', // Monitoring Activities
      'CC5', // Control Activities
      'CC6', // Logical and Physical Access Controls
      'CC7', // System Operations
      'CC8', // Change Management
      'CC9', // Risk Mitigation
    ];

    const sections: ReportSection[] = [];

    // CC6 - Access Controls
    sections.push(await this.generateAccessControlSection(period));

    // CC7 - System Operations
    sections.push(await this.generateSystemOperationsSection(period));

    // CC8 - Change Management
    sections.push(await this.generateChangeManagementSection(period));

    // Security Incidents
    sections.push(await this.generateSecurityIncidentsSection(period));

    // User Activity Summary
    sections.push(await this.generateUserActivitySection(period));

    return {
      type: 'SOC2',
      period,
      generatedAt: new Date(),
      sections,
      summary: this.generateSOC2Summary(sections),
      evidence: await this.collectEvidence(period, 'SOC2'),
    };
  }

  private async generateAccessControlSection(period: DateRange): Promise<ReportSection> {
    // Query authentication events
    const authEvents = await this.queryEngine.query({
      startDate: period.start,
      endDate: period.end,
      category: 'authentication',
    });

    // Query authorization events
    const authzEvents = await this.queryEngine.query({
      startDate: period.start,
      endDate: period.end,
      category: 'authorization',
    });

    // Calculate metrics
    const metrics = {
      totalLogins: authEvents.events.filter(e => e.action === 'auth.login').length,
      failedLogins: authEvents.events.filter(e => e.action === 'auth.login' && e.outcome === 'failure').length,
      mfaAdoption: await this.calculateMFAAdoption(period),
      roleChanges: authzEvents.events.filter(e => e.action.startsWith('authz.')).length,
      uniqueUsers: new Set(authEvents.events.map(e => e.actorId)).size,
    };

    // Generate narrative
    const narrative = this.templateEngine.render('soc2-access-control', {
      period,
      metrics,
      events: authEvents.events.slice(0, 10), // Sample events
    });

    return {
      title: 'CC6 - Logical and Physical Access Controls',
      narrative,
      metrics,
      evidence: [
        { type: 'query', description: 'Authentication events', query: { category: 'authentication' } },
        { type: 'query', description: 'Authorization events', query: { category: 'authorization' } },
      ],
      findings: this.identifyAccessControlFindings(authEvents, authzEvents),
    };
  }

  private async generateChangeManagementSection(period: DateRange): Promise<ReportSection> {
    // Query transformation events
    const transformEvents = await this.queryEngine.query({
      startDate: period.start,
      endDate: period.end,
      category: 'transformation',
    });

    // Query configuration changes
    const configEvents = await this.queryEngine.query({
      startDate: period.start,
      endDate: period.end,
      category: 'configuration',
    });

    const metrics = {
      totalTransformations: transformEvents.events.length,
      approvedTransformations: transformEvents.events.filter(e => e.action === 'transform.approved').length,
      configChanges: configEvents.events.length,
      failedDeployments: transformEvents.events.filter(e => e.action === 'transform.failed').length,
    };

    return {
      title: 'CC8 - Change Management',
      narrative: this.templateEngine.render('soc2-change-management', { period, metrics }),
      metrics,
      evidence: [
        { type: 'query', description: 'Transformation events', query: { category: 'transformation' } },
        { type: 'query', description: 'Configuration changes', query: { category: 'configuration' } },
      ],
      findings: this.identifyChangeManagementFindings(transformEvents, configEvents),
    };
  }

  async exportReport(report: ComplianceReport, format: ExportFormat): Promise<Buffer> {
    switch (format) {
      case 'pdf':
        return this.exportToPDF(report);
      case 'excel':
        return this.exportToExcel(report);
      case 'json':
        return Buffer.from(JSON.stringify(report, null, 2));
      default:
        throw new Error(`Unknown export format: ${format}`);
    }
  }
}
```

### Component 5: Real-time Streaming

Stream events to SIEM systems.

```typescript
class AuditEventStreamer {
  private subscribers: Map<string, StreamSubscriber> = new Map();

  constructor(
    private kafka: KafkaClient,
    private webhookService: WebhookService
  ) {}

  async stream(event: AuditEvent): Promise<void> {
    // Publish to Kafka for SIEM integration
    await this.kafka.publish('audit-events', {
      key: event.organizationId,
      value: JSON.stringify(event),
      headers: {
        action: event.action,
        category: event.category,
        timestamp: event.timestamp.toISOString(),
      },
    });

    // Send to webhook subscribers
    const orgSubscribers = this.subscribers.get(event.organizationId) || [];
    for (const subscriber of orgSubscribers) {
      if (this.matchesFilter(event, subscriber.filter)) {
        await this.webhookService.send(subscriber.url, {
          type: 'audit.event',
          event,
        });
      }
    }

    // Check for security alerts
    if (this.isSecurityAlert(event)) {
      await this.triggerSecurityAlert(event);
    }
  }

  private isSecurityAlert(event: AuditEvent): boolean {
    // Multiple failed login attempts
    if (event.action === 'auth.login' && event.outcome === 'failure') {
      return true;
    }

    // Suspicious activity patterns
    if (event.action === 'security.alert') {
      return true;
    }

    // Sensitive data access outside business hours
    if (event.piiAccessed && !this.isBusinessHours(event.timestamp)) {
      return true;
    }

    return false;
  }

  async subscribe(
    organizationId: string,
    subscriber: StreamSubscriber
  ): Promise<string> {
    const subscriptionId = generateId();

    const existing = this.subscribers.get(organizationId) || [];
    existing.push({ ...subscriber, id: subscriptionId });
    this.subscribers.set(organizationId, existing);

    return subscriptionId;
  }

  async unsubscribe(organizationId: string, subscriptionId: string): Promise<void> {
    const existing = this.subscribers.get(organizationId) || [];
    const updated = existing.filter(s => s.id !== subscriptionId);
    this.subscribers.set(organizationId, updated);
  }
}
```

---

## Consequences

### Positive

1. **Compliance:** Meet SOC 2, ISO 27001, HIPAA, PCI-DSS requirements
2. **Forensics:** Complete trail for incident investigation
3. **Transparency:** Full visibility into system activity
4. **Automation:** Reduce manual audit preparation
5. **Real-time:** Immediate security alerting

### Negative

1. **Storage Costs:** Long retention = significant storage
2. **Performance:** Logging adds latency
3. **Complexity:** Multiple compliance frameworks
4. **Privacy:** Logs may contain sensitive data

### Trade-offs

- **Completeness vs. Performance:** More logging = slower
- **Retention vs. Cost:** Longer retention = higher storage costs
- **Detail vs. Privacy:** More detail = more PII exposure risk

---

## Implementation Plan

### Phase 1: Event Capture (Week 1-2)
- Implement audit middleware
- Build event enrichment
- Add compliance flagging

### Phase 2: Secure Storage (Week 3-4)
- Implement immutable storage
- Build integrity verification
- Add archival system

### Phase 3: Query & Reporting (Week 5-6)
- Build query engine
- Implement compliance reports
- Add export functionality

### Phase 4: Streaming & Alerts (Week 7-8)
- Implement Kafka streaming
- Build webhook delivery
- Add security alerting

---

## References

- [SOC 2 Trust Service Criteria](https://www.aicpa.org/content/dam/aicpa/interestareas/frc/assuranceadvisoryservices/downloadabledocuments/trust-services-criteria.pdf)
- [ISO 27001 Annex A](https://www.iso.org/standard/54534.html)
- [HIPAA Security Rule](https://www.hhs.gov/hipaa/for-professionals/security/index.html)
- [PCI-DSS Requirements](https://www.pcisecuritystandards.org/document_library)

---

**Decision Maker:** Compliance Lead + Security Lead
**Approved By:** CISO
**Implementation Owner:** Platform Engineering Team
