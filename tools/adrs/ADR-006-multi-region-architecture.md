# ADR-006: Multi-Region Architecture

## Status
Accepted

## Context
As a global SaaS platform, we must comply with data residency regulations (GDPR, CCPA, data localization laws) while providing low-latency access to users worldwide. We need to decide:
- How to distribute data across regions
- Which data can cross regional boundaries
- How to route users to their data
- How to handle global vs. regional services

## Decision
We will implement a **regional data residency model** where tenant data stays in the assigned region, with global services for authentication, billing, and feature flags.

## Regional Architecture

```
┌─────────────────────────────────────────────────────┐
│            Global Services (Multi-Region)            │
│  • Auth0 (Authentication)                           │
│  • Stripe (Billing)                                 │
│  • CloudFront (CDN)                                 │
│  • Route53 (DNS)                                    │
│  • Unleash (Feature Flags)                          │
└─────────────────────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   US-EAST-1  │  │  EU-WEST-1   │  │AP-SOUTHEAST-1│
│   (Primary)  │  │    (GDPR)    │  │   (APAC)     │
│              │  │              │  │              │
│ • API        │  │ • API        │  │ • API        │
│ • Portal     │  │ • Portal     │  │ • Portal     │
│ • Admin      │  │ • Admin      │  │ • Admin      │
│ • PostgreSQL │  │ • PostgreSQL │  │ • PostgreSQL │
│ • Redis      │  │ • Redis      │  │ • Redis      │
│ • S3         │  │ • S3         │  │ • S3         │
└──────────────┘  └──────────────┘  └──────────────┘
```

## Regions

### Primary Region: US-EAST-1 (N. Virginia)
- **Location**: United States (East Coast)
- **Compliance**: SOC 2, HIPAA
- **Purpose**: Default region, US customers
- **Flag**: 🇺🇸

### EU Region: EU-WEST-1 (Ireland)
- **Location**: European Union (Ireland)
- **Compliance**: SOC 2, GDPR
- **Purpose**: EU customers (data residency)
- **Flag**: 🇪🇺

### APAC Region: AP-SOUTHEAST-1 (Singapore)
- **Location**: Asia Pacific (Singapore)
- **Compliance**: SOC 2
- **Purpose**: APAC customers (low latency)
- **Flag**: 🇸🇬

## Data Classification

### Regional Data (Stays in Region)
| Data Type | Storage | Replication |
|-----------|---------|-------------|
| **User PII** | PostgreSQL | No |
| **Tenant data** | PostgreSQL | No |
| **File uploads** | S3 | No |
| **Session data** | Redis | No |
| **Audit logs** | PostgreSQL + S3 | Read replicas only |

### Global Data (Shared Across Regions)
| Data Type | Storage | Replication |
|-----------|---------|-------------|
| **Authentication** | Auth0 | Multi-region |
| **Billing** | Stripe | Global |
| **Feature flags** | Unleash | Full sync |
| **CDN cache** | CloudFront | Edge locations |

## Region Assignment

### On Sign-Up
```typescript
async function assignRegion(email: string, ipAddress: string): Promise<Region> {
  // 1. Check email domain country
  const emailCountry = await getCountryFromEmail(email);

  // 2. Check IP geolocation
  const ipCountry = await getCountryFromIP(ipAddress);

  // 3. Apply residency rules
  if (isEUCountry(emailCountry) || isEUCountry(ipCountry)) {
    return 'eu-west-1';
  } else if (isAPACCountry(emailCountry) || isAPACCountry(ipCountry)) {
    return 'ap-southeast-1';
  } else {
    return 'us-east-1';  // Default
  }
}
```

### Manual Override (Enterprise)
Enterprise customers can choose their region:
```typescript
interface TenantRegion {
  tenantId: TenantId;
  region: Region;
  assignedAt: Date;
  canMigrate: boolean;  // Enterprise only
}
```

### Region Immutability
Once assigned, region **cannot** be changed (except via support for enterprise):
- Prevents accidental data export
- Ensures compliance
- Simplifies architecture

## Request Routing

### DNS-Based Routing
```
app.forge.io (Route53)
  ↓
  ├─ US users → us-east-1.app.forge.io
  ├─ EU users → eu-west-1.app.forge.io
  └─ APAC users → ap-southeast-1.app.forge.io
```

### API Routing
```typescript
// Client stores region in local storage
const region = localStorage.getItem('region');
const apiUrl = `https://${region}.api.forge.io`;

// All API calls go to assigned region
const response = await fetch(`${apiUrl}/api/v1/organizations`);
```

### Subdomain Pattern
```
https://app.forge.io          # Global (redirects to region)
https://us.app.forge.io       # US region
https://eu.app.forge.io       # EU region
https://ap.app.forge.io       # APAC region
```

## Cross-Region Operations

### Allowed
- **Authentication**: Auth0 is global
- **Billing**: Stripe is global
- **Feature flags**: Synced globally
- **CDN**: CloudFront serves from edge

### Prohibited
- **User data queries**: Must stay in region
- **File downloads**: Must stay in region
- **Exports**: Must stay in region

## Database Architecture

### Per-Region Database
Each region has:
```sql
-- Tenant assignment (replicated globally for routing)
tenants (
  id uuid PRIMARY KEY,
  name text,
  region text NOT NULL,  -- 'us-east-1', 'eu-west-1', 'ap-southeast-1'
  created_at timestamptz
);

-- Regional data (stays in region)
users (
  id uuid PRIMARY KEY,
  tenant_id uuid REFERENCES tenants(id),
  email text,
  name text,
  -- ... PII data
);

organizations (
  id uuid PRIMARY KEY,
  tenant_id uuid REFERENCES tenants(id),
  -- ... organizational data
);
```

### Global Routing Table
Small read-only table replicated to all regions:
```sql
CREATE TABLE tenant_regions (
  tenant_id uuid PRIMARY KEY,
  region text NOT NULL,
  updated_at timestamptz NOT NULL
);

-- Read from local replica
SELECT region FROM tenant_regions WHERE tenant_id = $1;
```

## Audit Logs

### Write Locally, Read Globally
```typescript
// Audit logs written to regional PostgreSQL
await prisma.auditLog.create({
  data: {
    tenantId,
    userId,
    action: 'organization.updated',
    // ...
  }
});

// Audit logs replicated to central S3 for SIEM
await s3.putObject({
  Bucket: 'forge-audit-logs-global',
  Key: `${region}/${tenantId}/${timestamp}.json`,
  Body: JSON.stringify(auditLog)
});
```

Enterprise customers can query audit logs across regions via S3.

## Region Migration (Enterprise Only)

### Migration Process
```typescript
async function migrateRegion(
  tenantId: TenantId,
  fromRegion: Region,
  toRegion: Region
): Promise<MigrationJob> {
  // 1. Create migration job
  const job = await createMigrationJob(tenantId, fromRegion, toRegion);

  // 2. Export data from source region
  const exportPath = await exportTenantData(tenantId, fromRegion);

  // 3. Validate export
  await validateExport(exportPath);

  // 4. Import to target region
  await importTenantData(tenantId, toRegion, exportPath);

  // 5. Validate import
  await validateImport(tenantId, toRegion);

  // 6. Update routing table
  await updateTenantRegion(tenantId, toRegion);

  // 7. Mark old data for deletion (30-day grace period)
  await scheduleDataDeletion(tenantId, fromRegion, Date.now() + 30 * 86400000);

  return job;
}
```

### Migration Downtime
- **Planned outage**: 1-4 hours depending on data size
- **Communication**: 7-day notice to customer
- **Rollback window**: 30 days

## Compliance by Region

### US-EAST-1
- ✅ SOC 2 Type II
- ✅ HIPAA
- ✅ CCPA

### EU-WEST-1
- ✅ SOC 2 Type II
- ✅ GDPR
- ✅ ISO 27001
- ✅ Data residency (EU)

### AP-SOUTHEAST-1
- ✅ SOC 2 Type II
- ⚠️ Regional data residency (varies by country)

## Infrastructure Cost per Region

### Fixed Costs (Monthly)
```
ECS Cluster:              $150
RDS PostgreSQL:           $400
ElastiCache Redis:        $150
S3 Storage (10TB):        $230
Data Transfer (5TB):      $450
Monitoring:               $100
──────────────────────────────
Total per Region:       $1,480

Total (3 Regions):      $4,440
```

### Scaling Strategy
- Start with all 3 regions (compliance requirement)
- Scale resources per region based on tenant count

## Disaster Recovery

### Per-Region DR
Each region has:
- **RTO**: 4 hours
- **RPO**: 1 hour
- **DR Region**: Within same compliance zone
  - US-EAST-1 → US-WEST-2
  - EU-WEST-1 → EU-CENTRAL-1
  - AP-SOUTHEAST-1 → AP-NORTHEAST-1

### Global Failover
If entire region fails:
1. Update DNS to route to DR region
2. Promote read replica to primary
3. Restore from backup if needed
4. Communicate to affected customers

## Monitoring

### Per-Region Metrics
```typescript
// Prometheus metrics
api_requests_total{region="us-east-1"}
database_connections{region="us-east-1"}
redis_memory_bytes{region="us-east-1"}
```

### Cross-Region Dashboards
- Regional health status
- Tenant distribution by region
- Cross-region latency
- Replication lag (routing table)

## Consequences

### Positive
- **Compliance**: GDPR, data residency requirements met
- **Performance**: Low latency for global users
- **Isolation**: Regional failures don't affect others
- **Scalability**: Can add regions independently

### Negative
- **Complexity**: 3x infrastructure to manage
- **Cost**: 3x base infrastructure cost
- **Cross-region features**: Harder to implement
- **Migrations**: Complex and risky

### Mitigations
- **Infrastructure as Code**: Terraform modules for consistency
- **Unified monitoring**: Centralized observability
- **Clear policies**: Document what can/cannot cross regions
- **Enterprise-only migrations**: Reduce migration burden

## Alternatives Considered

### 1. Single Global Region
**Rejected**: GDPR non-compliant, poor latency for EU/APAC

### 2. Customer-Managed Regions
**Rejected**: Too complex for customers to choose

### 3. Dynamic Data Routing
**Rejected**: Too complex, risk of data leakage

## Future Expansion

### Additional Regions (When Needed)
- **EU-CENTRAL-1** (Frankfurt): German data residency
- **CA-CENTRAL-1** (Canada): Canadian data residency
- **AP-NORTHEAST-1** (Tokyo): Japan data residency

### Criteria for New Region
- 100+ customers in that geography
- Regulatory requirement
- Latency > 200ms to nearest region

## References
- [GDPR Data Residency](https://gdpr.eu/data-residency/)
- [AWS Multi-Region](https://aws.amazon.com/blogs/architecture/disaster-recovery-dr-architecture-on-aws-part-i-strategies-for-recovery-in-the-cloud/)
- [Stripe Global Infrastructure](https://stripe.com/docs/security/stripe)

## Review Date
2024-04-16 (3 months)
