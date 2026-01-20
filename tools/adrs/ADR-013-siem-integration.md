# ADR-013: SIEM Integration

## Status
Accepted

## Context
Enterprise customers require Security Information and Event Management (SIEM) integration for:
- Compliance (SOC 2, ISO 27001, PCI-DSS)
- Security monitoring and incident response
- Centralized log aggregation
- Threat detection and analysis
- Regulatory audit requirements
- Correlation with other security events

Customers use various SIEM platforms:
- Splunk (most common)
- Datadog
- Sumo Logic
- Elastic Security
- Azure Sentinel
- Custom solutions

## Decision
We will implement **audit log export to SIEM platforms** supporting multiple formats (JSON, CEF, LEEF) with configurable event filtering, batching, and delivery mechanisms.

## SIEM Configuration Model

```typescript
interface SiemConfig {
  tenantId: TenantId;
  enabled: boolean;

  // Destination
  destination: SiemDestination;

  // Filtering
  eventTypes: AuditEventType[];   // Which events to export
  minSeverity: 'info' | 'warning' | 'critical';

  // Format
  format: 'json' | 'cef' | 'leef';
  includeRawPayload: boolean;

  // Delivery
  deliveryMethod: 'push' | 'pull';
  batchSize: number;
  flushIntervalSeconds: number;

  // Status
  lastExportAt?: Date;
  lastExportStatus: 'success' | 'error';
  lastError?: string;
  eventsExported: number;

  createdAt: Date;
  updatedAt: Date;
}

type SiemDestination =
  | { type: 'splunk'; url: string; token: string; index: string; sourcetype?: string }
  | { type: 'datadog'; apiKey: string; site: string }
  | { type: 'sumo_logic'; url: string }
  | { type: 'elastic'; url: string; apiKey: string; index: string }
  | { type: 'azure_sentinel'; workspaceId: string; sharedKey: string; logType: string }
  | { type: 's3'; bucket: string; prefix: string; region: string }
  | { type: 'webhook'; url: string; headers: Record<string, string> };
```

## Audit Event Types

```typescript
type AuditEventType =
  // === Authentication ===
  | 'auth.login'
  | 'auth.logout'
  | 'auth.login_failed'
  | 'auth.mfa_enabled'
  | 'auth.mfa_disabled'
  | 'auth.password_changed'
  | 'auth.password_reset'
  | 'auth.session_revoked'

  // === Authorization ===
  | 'authz.permission_denied'
  | 'authz.role_assigned'
  | 'authz.role_removed'

  // === Users ===
  | 'user.created'
  | 'user.updated'
  | 'user.deleted'
  | 'user.invited'
  | 'user.suspended'
  | 'user.activated'

  // === Organizations ===
  | 'organization.created'
  | 'organization.updated'
  | 'organization.deleted'
  | 'organization.archived'

  // === API Keys ===
  | 'api_key.created'
  | 'api_key.deleted'
  | 'api_key.used'
  | 'api_key.rotated'

  // === Settings ===
  | 'settings.updated'
  | 'sso.configured'
  | 'sso.updated'
  | 'sso.deleted'

  // === Data ===
  | 'data.exported'
  | 'data.imported'
  | 'data.deleted'

  // === Billing ===
  | 'billing.subscription_created'
  | 'billing.subscription_cancelled'
  | 'billing.plan_changed'
  | 'billing.payment_succeeded'
  | 'billing.payment_failed'

  // === Admin ===
  | 'admin.impersonation_started'
  | 'admin.impersonation_ended'
  | 'admin.tenant_suspended'
  | 'admin.tenant_reactivated'

  // === Security ===
  | 'security.ip_blocked'
  | 'security.rate_limited'
  | 'security.suspicious_activity'
  | 'security.brute_force_detected';
```

## Audit Event Format

```typescript
interface AuditEvent {
  // Identity
  id: string;
  tenantId: TenantId;
  timestamp: Date;

  // Event
  eventType: AuditEventType;
  severity: 'info' | 'warning' | 'critical';
  category: EventCategory;

  // Actor
  actor: {
    type: 'user' | 'api_key' | 'system' | 'admin';
    id: string;
    email?: string;
    ipAddress?: string;
    userAgent?: string;
  };

  // Resource
  resource: {
    type: string;
    id: string;
    name?: string;
  };

  // Details
  action: string;
  outcome: 'success' | 'failure';
  changes?: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  };

  // Context
  requestId: string;
  sessionId?: string;
  region?: string;
  geoLocation?: {
    country: string;
    region: string;
    city: string;
  };

  // Raw payload (optional)
  rawPayload?: unknown;
}

type EventCategory =
  | 'authentication'
  | 'authorization'
  | 'data_access'
  | 'data_modification'
  | 'administrative'
  | 'security';
```

## Export Formats

### JSON Format
```json
{
  "id": "evt_abc123",
  "tenant_id": "tenant_xyz",
  "timestamp": "2024-01-16T14:30:00Z",
  "event_type": "user.deleted",
  "severity": "warning",
  "category": "administrative",
  "actor": {
    "type": "user",
    "id": "user_123",
    "email": "admin@company.com",
    "ip_address": "192.168.1.1",
    "user_agent": "Mozilla/5.0..."
  },
  "resource": {
    "type": "user",
    "id": "user_456",
    "name": "John Doe"
  },
  "action": "delete_user",
  "outcome": "success",
  "request_id": "req_789"
}
```

### CEF (Common Event Format)
```
CEF:0|Forge Factory|SaaS Platform|1.0|user.deleted|User Deleted|5|
src=192.168.1.1 suser=admin@company.com outcome=success
duser=john.doe@company.com rt=Jan 16 2024 14:30:00 requestContext=req_789
```

### LEEF (Log Event Extended Format)
```
LEEF:1.0|Forge Factory|SaaS Platform|1.0|user.deleted|
src=192.168.1.1 usrName=admin@company.com devTime=Jan 16 2024 14:30:00
cat=administrative sev=5 identSrc=192.168.1.1
```

## Export Mechanisms

### 1. Push to Splunk HEC
```typescript
async function exportToSplunk(
  events: AuditEvent[],
  config: SplunkDestination
): Promise<void> {
  const payload = events.map(event => ({
    time: event.timestamp.getTime() / 1000,
    host: 'forge-factory',
    source: 'audit-log',
    sourcetype: config.sourcetype || 'forge:audit',
    index: config.index,
    event: formatEventForSiem(event, 'json'),
  }));

  await fetch(config.url, {
    method: 'POST',
    headers: {
      'Authorization': `Splunk ${config.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}
```

### 2. Push to Datadog
```typescript
async function exportToDatadog(
  events: AuditEvent[],
  config: DatadogDestination
): Promise<void> {
  const logs = events.map(event => ({
    ddsource: 'forge-factory',
    ddtags: `env:production,tenant:${event.tenantId}`,
    hostname: 'forge-factory-api',
    message: JSON.stringify(formatEventForSiem(event, 'json')),
    service: 'audit-log',
  }));

  await fetch(`https://http-intake.logs.${config.site}/v1/input`, {
    method: 'POST',
    headers: {
      'DD-API-KEY': config.apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(logs),
  });
}
```

### 3. Export to S3
```typescript
async function exportToS3(
  events: AuditEvent[],
  config: S3Destination
): Promise<void> {
  const filename = `${config.prefix}/${new Date().toISOString()}.json`;

  await s3.putObject({
    Bucket: config.bucket,
    Key: filename,
    Body: JSON.stringify(events, null, 2),
    ContentType: 'application/json',
    ServerSideEncryption: 'AES256',
  });
}
```

### 4. Webhook
```typescript
async function exportToWebhook(
  events: AuditEvent[],
  config: WebhookDestination
): Promise<void> {
  await fetch(config.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...config.headers,
    },
    body: JSON.stringify({
      events: events.map(e => formatEventForSiem(e, 'json')),
      metadata: {
        source: 'forge-factory',
        version: '1.0',
        exportedAt: new Date().toISOString(),
      }
    }),
  });
}
```

## Batching & Delivery

### Batch Collection
```typescript
class SiemExporter {
  private batches: Map<TenantId, AuditEvent[]> = new Map();

  async queueEvent(event: AuditEvent): Promise<void> {
    const config = await this.getSiemConfig(event.tenantId);

    if (!config || !config.enabled) {
      return;
    }

    // Filter by event type and severity
    if (!this.shouldExport(event, config)) {
      return;
    }

    // Add to batch
    const batch = this.batches.get(event.tenantId) || [];
    batch.push(event);
    this.batches.set(event.tenantId, batch);

    // Flush if batch size reached
    if (batch.length >= config.batchSize) {
      await this.flush(event.tenantId);
    }
  }

  private shouldExport(event: AuditEvent, config: SiemConfig): boolean {
    // Check event type
    if (!config.eventTypes.includes(event.eventType)) {
      return false;
    }

    // Check severity
    const severityOrder = { info: 0, warning: 1, critical: 2 };
    if (severityOrder[event.severity] < severityOrder[config.minSeverity]) {
      return false;
    }

    return true;
  }
}
```

### Periodic Flush
```typescript
@Cron('*/5 * * * *')  // Every 5 minutes
async function flushSiemBatches() {
  const tenants = await getTenantIdsWithSiem();

  for (const tenantId of tenants) {
    try {
      await siemExporter.flush(tenantId);
    } catch (error) {
      logger.error('SIEM export failed', { tenantId, error });

      // Update last error
      await updateSiemConfig(tenantId, {
        lastExportStatus: 'error',
        lastError: error.message,
      });
    }
  }
}

async function flush(tenantId: TenantId): Promise<void> {
  const batch = this.batches.get(tenantId);

  if (!batch || batch.length === 0) {
    return;
  }

  const config = await this.getSiemConfig(tenantId);

  // Export to destination
  switch (config.destination.type) {
    case 'splunk':
      await exportToSplunk(batch, config.destination);
      break;
    case 'datadog':
      await exportToDatadog(batch, config.destination);
      break;
    case 's3':
      await exportToS3(batch, config.destination);
      break;
    case 'webhook':
      await exportToWebhook(batch, config.destination);
      break;
  }

  // Update stats
  await updateSiemConfig(tenantId, {
    lastExportAt: new Date(),
    lastExportStatus: 'success',
    eventsExported: { increment: batch.length },
  });

  // Clear batch
  this.batches.delete(tenantId);
}
```

## SIEM Configuration UI

### Setup Form
```typescript
function SiemConfigForm({ tenantId }: { tenantId: TenantId }) {
  const [destination, setDestination] = useState<SiemDestinationType>('splunk');

  return (
    <form>
      <h2>SIEM Integration</h2>

      {/* Destination Selection */}
      <Select
        label="SIEM Platform"
        options={['Splunk', 'Datadog', 'Sumo Logic', 'Elastic', 'Azure Sentinel', 'S3', 'Webhook']}
        value={destination}
        onChange={setDestination}
      />

      {/* Destination-Specific Config */}
      {destination === 'splunk' && (
        <>
          <Input label="HEC URL" placeholder="https://splunk.company.com:8088/services/collector" />
          <Input label="HEC Token" type="password" />
          <Input label="Index" placeholder="forge_audit" />
        </>
      )}

      {destination === 'datadog' && (
        <>
          <Input label="API Key" type="password" />
          <Select label="Site" options={['US1', 'US3', 'US5', 'EU1', 'AP1']} />
        </>
      )}

      {/* Event Filtering */}
      <h3>Event Filtering</h3>

      <MultiSelect
        label="Event Types"
        options={AUDIT_EVENT_TYPES}
        groupBy="category"
      />

      <Select
        label="Minimum Severity"
        options={['Info', 'Warning', 'Critical']}
      />

      {/* Format */}
      <Select
        label="Export Format"
        options={['JSON', 'CEF', 'LEEF']}
      />

      {/* Delivery Settings */}
      <h3>Delivery Settings</h3>

      <Input
        label="Batch Size"
        type="number"
        defaultValue={100}
        min={1}
        max={1000}
      />

      <Input
        label="Flush Interval (seconds)"
        type="number"
        defaultValue={300}
        min={60}
        max={3600}
      />

      {/* Test Connection */}
      <Button onClick={handleTestConnection}>
        Test Connection
      </Button>

      <Button type="submit">Save Configuration</Button>
    </form>
  );
}
```

### Test Connection
```typescript
async function testSiemConnection(config: SiemConfig): Promise<TestResult> {
  try {
    // Send a test event
    const testEvent: AuditEvent = {
      id: 'test_' + Date.now(),
      tenantId: config.tenantId,
      timestamp: new Date(),
      eventType: 'security.test',
      severity: 'info',
      category: 'administrative',
      actor: { type: 'system', id: 'test' },
      resource: { type: 'test', id: 'test' },
      action: 'siem_connection_test',
      outcome: 'success',
      requestId: 'test',
    };

    await exportEvent(testEvent, config);

    return {
      success: true,
      message: 'Test event sent successfully',
    };
  } catch (error) {
    return {
      success: false,
      message: error.message,
    };
  }
}
```

## Real-Time Streaming (Enterprise)

### WebSocket Stream
```typescript
// For customers needing real-time events
app.get('/siem/stream', async (req, res) => {
  const tenantId = await validateApiKey(req.headers.authorization);

  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  // Subscribe to audit log stream
  const subscription = await auditLog.subscribe(tenantId, (event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  });

  req.on('close', () => {
    subscription.unsubscribe();
  });
});
```

## Monitoring & Alerts

### Metrics
```typescript
// Prometheus metrics
siem_exports_total{tenant_id, destination, status}
siem_export_duration_seconds{tenant_id, destination}
siem_batch_size{tenant_id, destination}
siem_export_errors_total{tenant_id, destination, error_type}
```

### Alerts
```yaml
- alert: SiemExportFailing
  expr: rate(siem_export_errors_total[5m]) > 0.1
  annotations:
    summary: SIEM export failing for {{ $labels.tenant_id }}

- alert: SiemExportLag
  expr: time() - siem_last_export_timestamp > 3600
  annotations:
    summary: SIEM export lagging for {{ $labels.tenant_id }}
```

## Compliance

### Retention
```typescript
// Audit logs retained for compliance
const RETENTION_POLICIES = {
  soc2: 365,        // 1 year
  hipaa: 2555,      // 7 years
  pci_dss: 365,     // 1 year
  gdpr: 2555,       // 7 years (if legal requirement)
};

// Automatically delete old audit logs
@Cron('0 4 * * *')  // 4 AM daily
async function cleanupOldAuditLogs() {
  const tenants = await getTenants();

  for (const tenant of tenants) {
    const retention = RETENTION_POLICIES[tenant.complianceStandard] || 365;
    const cutoffDate = new Date(Date.now() - retention * 86400000);

    await prisma.auditLog.deleteMany({
      where: {
        tenantId: tenant.id,
        createdAt: { lt: cutoffDate }
      }
    });
  }
}
```

## Consequences

### Positive
- **Compliance**: SOC 2, ISO 27001 requirements met
- **Security**: Centralized monitoring
- **Flexibility**: Multiple SIEM platforms supported
- **Performance**: Batching reduces load
- **Audit**: Complete trail for investigations

### Negative
- **Complexity**: Multiple integrations to maintain
- **Cost**: SIEM platforms can be expensive
- **Latency**: Batching delays export
- **Dependencies**: External SIEM availability

### Mitigations
- **Retry logic**: Handle SIEM downtime
- **S3 fallback**: Export to S3 if SIEM fails
- **Monitoring**: Track export success rates
- **Documentation**: Clear setup guides

## Alternatives Considered

### 1. No SIEM Integration
**Rejected**: Enterprise compliance requirement

### 2. File-Based Export Only
**Rejected**: Manual process, poor UX

### 3. Single SIEM Platform
**Rejected**: Customers use different platforms

## References
- [CEF Format](https://www.microfocus.com/documentation/arcsight/arcsight-smartconnectors-8.3/cef-implementation-standard/)
- [LEEF Format](https://www.ibm.com/docs/en/dsm?topic=overview-leef-event-components)
- [Splunk HEC](https://docs.splunk.com/Documentation/Splunk/latest/Data/UsetheHTTPEventCollector)

## Review Date
2024-04-16 (3 months)
