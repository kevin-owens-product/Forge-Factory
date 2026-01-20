# ADR-020: Super Admin Portal & Platform Administration

## Status
Accepted

## Context

With the introduction of enterprise customers (ADR-019), Forge Factory Platform Admins (Super Admins) need enhanced capabilities beyond the existing admin portal (ADR-014). Enterprise customers require:

### Current Platform Admin Capabilities (ADR-014)

The existing platform admin dashboard provides:
- ✅ View all tenants (global view)
- ✅ Impersonate tenants for support
- ✅ System health monitoring (uptime, errors, performance)
- ✅ Platform-wide analytics (MRR, churn, growth)
- ✅ Basic feature flag management
- ✅ Billing issue handling

### New Requirements for Enterprise Support

1. **Enterprise-Specific Administration**:
   - Manage enterprise contracts (create, modify, renew)
   - Configure dedicated infrastructure (single-tenant databases)
   - Override limits (API rate limits, storage quotas)
   - Emergency access (break-glass access to customer data)
   - White-label configuration (custom domains, branding)

2. **Advanced Compliance Management**:
   - Track compliance certifications per customer (SOC 2, HIPAA, ISO 27001)
   - Manage compliance audit trails
   - Generate compliance reports automatically
   - Data residency enforcement (EU, US, APAC)
   - GDPR/CCPA data deletion workflows

3. **Enhanced Monitoring & Alerting**:
   - Enterprise customer-specific SLA monitoring
   - Proactive alerting (SLA violations, quota approaching)
   - Security incident response workflows
   - Tenant isolation breach detection
   - Resource utilization forecasting

4. **Advanced Support Tools**:
   - Support ticket management (enterprise priority)
   - Incident management (SEV1/SEV2/SEV3)
   - Root cause analysis tools
   - Customer impact assessment
   - Communication templates (status pages, email)

5. **Platform Operations**:
   - Database migration management
   - Feature rollout control (gradual rollouts, kill switches)
   - Performance tuning per tenant
   - Cost optimization dashboard
   - Capacity planning tools

### Enterprise SLA Requirements

Enterprise contracts (ADR-019) include SLAs:
- **Uptime**: 99.95%+ (26 minutes downtime/month max)
- **Latency**: P99 < 100ms
- **Support Response**: 1 hour for critical issues
- **Data Recovery**: RPO < 1 hour, RTO < 4 hours

Platform admins must monitor and enforce these SLAs.

### Current Pain Points

Without enhanced platform admin tools:
- ❌ Manual contract management (error-prone, slow)
- ❌ Reactive compliance (manual audit prep takes weeks)
- ❌ Delayed SLA violation detection (no proactive alerts)
- ❌ Limited support context (can't see full customer health)
- ❌ No emergency access workflows (security risk)

### Target Scale (Year 1)

- **Total Organizations**: 1,000+
- **Enterprise Customers**: 10-15
- **Total Users**: 50,000+
- **Platform Admins**: 5-8
- **Support Tickets**: 2,000+/month
- **Incidents**: 10-15/month (SEV1: 1-2, SEV2: 3-5, SEV3: 6-8)

## Decision

We will build an **Enhanced Super Admin Portal** that extends ADR-014 with enterprise-specific administration, compliance management, and advanced support tools.

### Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│              Super Admin Portal Architecture (Extended)              │
├──────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  Platform Admin Routes (Extended from ADR-014)                        │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ (platform)/                                                     │  │
│  │   /tenants/                    # All tenants (ADR-014)          │  │
│  │   /health/                     # System health (ADR-014)        │  │
│  │   /analytics/                  # Platform metrics (ADR-014)     │  │
│  │   /feature-flags/              # Feature flags (ADR-022)        │  │
│  │                                                                  │  │
│  │   NEW: Enterprise Administration                                │  │
│  │   /enterprise/                                                   │  │
│  │     /contracts/                # Contract management            │  │
│  │     /dedicated-infra/          # Single-tenant infrastructure   │  │
│  │     /white-label/              # Custom domains, branding       │  │
│  │     /emergency-access/         # Break-glass access logs        │  │
│  │                                                                  │  │
│  │   NEW: Compliance Management                                    │  │
│  │   /compliance/                                                   │  │
│  │     /frameworks/               # SOC2, HIPAA, ISO, GDPR         │  │
│  │     /audits/                   # Audit preparation & reports    │  │
│  │     /certifications/           # Certificate tracking           │  │
│  │     /data-residency/           # Region enforcement             │  │
│  │     /data-deletion/            # GDPR/CCPA workflows            │  │
│  │                                                                  │  │
│  │   NEW: SLA Monitoring                                           │  │
│  │   /sla/                                                          │  │
│  │     /overview/                 # All enterprise SLAs            │  │
│  │     /violations/               # SLA breach history             │  │
│  │     /alerts/                   # Proactive alerting config      │  │
│  │                                                                  │  │
│  │   NEW: Advanced Support                                         │  │
│  │   /support/                                                      │  │
│  │     /tickets/                  # Enhanced ticket management     │  │
│  │     /incidents/                # Incident management            │  │
│  │     /impact-analysis/          # Customer impact assessment     │  │
│  │     /communication/            # Status pages, templates        │  │
│  │                                                                  │  │
│  │   NEW: Platform Operations                                      │  │
│  │   /operations/                                                   │  │
│  │     /migrations/               # Database migration tracking    │  │
│  │     /rollouts/                 # Feature rollout control        │  │
│  │     /performance/              # Per-tenant performance tuning  │  │
│  │     /cost-optimization/        # Cost dashboard                 │  │
│  │     /capacity-planning/        # Resource forecasting           │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                   │                                   │
│                                   ▼                                   │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                    Backend Services                             │  │
│  │                                                                  │  │
│  │  Enterprise Management Service                                  │  │
│  │  ├─ Contract CRUD operations                                    │  │
│  │  ├─ Dedicated infrastructure provisioning                       │  │
│  │  ├─ Emergency access workflows                                  │  │
│  │  └─ White-label configuration                                   │  │
│  │                                                                  │  │
│  │  Compliance Service                                             │  │
│  │  ├─ Framework requirement tracking                              │  │
│  │  ├─ Audit report generation                                     │  │
│  │  ├─ Certificate management                                      │  │
│  │  ├─ Data residency enforcement                                  │  │
│  │  └─ Data deletion workflows                                     │  │
│  │                                                                  │  │
│  │  SLA Monitoring Service                                         │  │
│  │  ├─ Real-time SLA metric collection                             │  │
│  │  ├─ Violation detection & alerting                              │  │
│  │  ├─ Historical SLA reporting                                    │  │
│  │  └─ SLA credit calculation                                      │  │
│  │                                                                  │  │
│  │  Incident Management Service                                    │  │
│  │  ├─ Incident creation & escalation                              │  │
│  │  ├─ Impact assessment                                           │  │
│  │  ├─ Communication automation                                    │  │
│  │  └─ Post-mortem generation                                      │  │
│  │                                                                  │  │
│  │  Platform Operations Service                                    │  │
│  │  ├─ Migration orchestration                                     │  │
│  │  ├─ Rollout control (feature flags, kill switches)              │  │
│  │  ├─ Performance analytics                                       │  │
│  │  └─ Capacity forecasting                                        │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                   │                                   │
│                                   ▼                                   │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                  Database Schema (New Models)                   │  │
│  │                                                                  │  │
│  │  ComplianceFramework                                            │  │
│  │  ├─ name (SOC2, HIPAA, ISO27001, GDPR, FedRAMP)                │  │
│  │  ├─ requirements[] (array of requirements)                      │  │
│  │  └─ version                                                     │  │
│  │                                                                  │  │
│  │  ComplianceCertification                                        │  │
│  │  ├─ organizationId                                              │  │
│  │  ├─ frameworkId                                                 │  │
│  │  ├─ status (NOT_STARTED, IN_PROGRESS, CERTIFIED, EXPIRED)      │  │
│  │  ├─ certificationDate                                           │  │
│  │  ├─ expirationDate                                              │  │
│  │  ├─ auditReportUrl                                              │  │
│  │  └─ notes                                                       │  │
│  │                                                                  │  │
│  │  SLAMetric                                                      │  │
│  │  ├─ organizationId                                              │  │
│  │  ├─ metricType (UPTIME, LATENCY_P99, SUPPORT_RESPONSE)         │  │
│  │  ├─ target (e.g., 99.95 for uptime)                            │  │
│  │  ├─ actual (e.g., 99.97)                                       │  │
│  │  ├─ period (DAILY, MONTHLY, QUARTERLY)                         │  │
│  │  └─ timestamp                                                   │  │
│  │                                                                  │  │
│  │  SLAViolation                                                   │  │
│  │  ├─ organizationId                                              │  │
│  │  ├─ metricType                                                  │  │
│  │  ├─ target                                                      │  │
│  │  ├─ actual                                                      │  │
│  │  ├─ duration (minutes)                                          │  │
│  │  ├─ impact (MINOR, MAJOR, CRITICAL)                            │  │
│  │  ├─ creditAmount (in cents)                                    │  │
│  │  ├─ startTime                                                   │  │
│  │  ├─ endTime                                                     │  │
│  │  └─ postMortemUrl                                               │  │
│  │                                                                  │  │
│  │  Incident                                                       │  │
│  │  ├─ id                                                          │  │
│  │  ├─ title                                                       │  │
│  │  ├─ severity (SEV1, SEV2, SEV3)                                │  │
│  │  ├─ status (INVESTIGATING, IDENTIFIED, MONITORING, RESOLVED)   │  │
│  │  ├─ affectedOrganizations[] (array of org IDs)                 │  │
│  │  ├─ affectedUserCount                                           │  │
│  │  ├─ startTime                                                   │  │
│  │  ├─ resolvedTime                                                │  │
│  │  ├─ rootCause                                                   │  │
│  │  ├─ resolution                                                  │  │
│  │  ├─ postMortemUrl                                               │  │
│  │  └─ communicationUpdates[] (status page updates)               │  │
│  │                                                                  │  │
│  │  EmergencyAccess                                                │  │
│  │  ├─ organizationId                                              │  │
│  │  ├─ adminUserId                                                 │  │
│  │  ├─ reason                                                      │  │
│  │  ├─ approvedBy                                                  │  │
│  │  ├─ accessGrantedAt                                             │  │
│  │  ├─ accessRevokedAt                                             │  │
│  │  ├─ actionsPerformed[] (audit trail)                            │  │
│  │  └─ justification                                               │  │
│  │                                                                  │  │
│  │  DedicatedInfrastructure                                        │  │
│  │  ├─ organizationId                                              │  │
│  │  ├─ databaseHost                                                │  │
│  │  ├─ databaseName                                                │  │
│  │  ├─ region (US, EU, APAC)                                      │  │
│  │  ├─ computeInstance (server ID)                                │  │
│  │  ├─ provisionedAt                                               │  │
│  │  └─ resourceSpecs (JSON: CPU, RAM, disk)                       │  │
│  │                                                                  │  │
│  │  WhiteLabelConfig                                               │  │
│  │  ├─ organizationId                                              │  │
│  │  ├─ customDomain                                                │  │
│  │  ├─ logoUrl                                                     │  │
│  │  ├─ primaryColor                                                │  │
│  │  ├─ companyName                                                 │  │
│  │  └─ supportEmail                                                │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                        │
└──────────────────────────────────────────────────────────────────────┘
```

## Detailed Decisions

### 1. Enterprise Contract Management

**Requirement**: Platform admins need to create and manage enterprise contracts.

**Implementation**:

```tsx
// apps/admin/app/(platform)/enterprise/contracts/page.tsx

export default async function EnterpriseContractsPage() {
  const contracts = await db.enterpriseContract.findMany({
    include: {
      organization: true,
      csmUser: true,
    },
    orderBy: { renewalDate: 'asc' },
  })

  const upcomingRenewals = contracts.filter(c =>
    isWithinDays(c.renewalDate, 90) && c.status === 'ACTIVE'
  )

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Enterprise Contracts</h1>
        <CreateContractDialog />
      </div>

      {/* Renewal Alerts */}
      {upcomingRenewals.length > 0 && (
        <Alert variant="warning" className="mb-6">
          ⚠️ {upcomingRenewals.length} contracts renewing in next 90 days
        </Alert>
      )}

      {/* Contract Summary */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <MetricCard
          title="Active Contracts"
          value={contracts.filter(c => c.status === 'ACTIVE').length}
        />
        <MetricCard
          title="Total ARR"
          value={`$${contracts.reduce((sum, c) => sum + c.annualValue, 0).toLocaleString()}`}
        />
        <MetricCard
          title="Avg Contract Value"
          value={`$${Math.round(contracts.reduce((sum, c) => sum + c.annualValue, 0) / contracts.length).toLocaleString()}`}
        />
        <MetricCard
          title="Renewal Rate"
          value="95%"
          status="success"
        />
      </div>

      {/* Contracts Table */}
      <DataTable
        data={contracts}
        columns={[
          { key: 'organization.name', label: 'Customer', sortable: true },
          {
            key: 'annualValue',
            label: 'ARR',
            render: (row) => `$${(row.annualValue / 100).toLocaleString()}`,
            sortable: true,
          },
          {
            key: 'startDate',
            label: 'Start Date',
            render: (row) => formatDate(row.startDate),
            sortable: true,
          },
          {
            key: 'renewalDate',
            label: 'Renewal Date',
            render: (row) => {
              const daysUntil = differenceInDays(row.renewalDate, new Date())
              const urgent = daysUntil <= 30
              return (
                <div className={urgent ? 'text-orange-600 font-semibold' : ''}>
                  {formatDate(row.renewalDate)}
                  {urgent && ` (${daysUntil}d)`}
                </div>
              )
            },
            sortable: true,
          },
          {
            key: 'csmUser',
            label: 'CSM',
            render: (row) => row.csmUser?.name || 'Unassigned',
          },
          {
            key: 'status',
            label: 'Status',
            render: (row) => <ContractStatusBadge status={row.status} />,
          },
          {
            key: 'actions',
            label: '',
            render: (row) => (
              <DropdownMenu>
                <DropdownMenuItem onClick={() => viewContract(row.id)}>
                  View Details
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => editContract(row.id)}>
                  Edit Contract
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => generateInvoice(row.id)}>
                  Generate Invoice
                </DropdownMenuItem>
                {isWithinDays(row.renewalDate, 90) && (
                  <DropdownMenuItem onClick={() => initiateRenewal(row.id)}>
                    Start Renewal Process
                  </DropdownMenuItem>
                )}
              </DropdownMenu>
            ),
          },
        ]}
        filterable={{
          status: Object.values(ContractStatus),
        }}
        exportable
      />
    </div>
  )
}

// Contract creation dialog
function CreateContractDialog() {
  const form = useForm<CreateContractDto>()

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>+ Create Contract</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Enterprise Contract</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Customer</Label>
              <OrganizationPicker {...form.register('organizationId')} />
            </div>

            <div>
              <Label>Annual Contract Value</Label>
              <Input
                type="number"
                placeholder="150000"
                {...form.register('annualValue')}
              />
            </div>

            <div>
              <Label>Start Date</Label>
              <DatePicker {...form.register('startDate')} />
            </div>

            <div>
              <Label>Contract Term</Label>
              <Select {...form.register('contractTerm')}>
                <option value="12">12 months</option>
                <option value="24">24 months</option>
                <option value="36">36 months</option>
              </Select>
            </div>

            <div>
              <Label>Payment Terms</Label>
              <Select {...form.register('paymentTerms')}>
                <option value="NET_30">Net 30</option>
                <option value="NET_60">Net 60</option>
                <option value="NET_90">Net 90</option>
              </Select>
            </div>

            <div>
              <Label>Billing Cycle</Label>
              <Select {...form.register('billingCycle')}>
                <option value="MONTHLY">Monthly</option>
                <option value="QUARTERLY">Quarterly</option>
                <option value="ANNUAL">Annual</option>
              </Select>
            </div>
          </div>

          <div className="mt-6">
            <h3 className="font-semibold mb-4">SLA Commitments</h3>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Uptime SLA (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="99.95"
                  {...form.register('slaUptime')}
                />
              </div>

              <div>
                <Label>P99 Latency (ms)</Label>
                <Input
                  type="number"
                  placeholder="100"
                  {...form.register('slaLatencyP99')}
                />
              </div>

              <div>
                <Label>Support Level</Label>
                <Select {...form.register('slaSupport')}>
                  <option value="STANDARD">Standard</option>
                  <option value="PREMIUM">Premium</option>
                  <option value="ENTERPRISE">Enterprise</option>
                </Select>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <h3 className="font-semibold mb-4">Account Management</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Customer Success Manager</Label>
                <UserPicker
                  role="CSM"
                  {...form.register('csmUserId')}
                />
              </div>

              <div>
                <Label>Account Executive</Label>
                <Input {...form.register('accountExecutive')} />
              </div>
            </div>
          </div>

          <Button type="submit" className="mt-6">
            Create Contract
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

### 2. Compliance Management

**Requirement**: Track compliance certifications per customer and generate audit reports.

**Implementation**:

```typescript
// Database schema
model ComplianceFramework {
  id           String   @id @default(cuid())
  name         String   @unique  // SOC2_TYPE2, HIPAA, ISO27001, GDPR, FedRAMP
  displayName  String              // "SOC 2 Type II"
  description  String
  version      String

  // Requirements checklist
  requirements Json                 // Array of requirement objects

  certifications ComplianceCertification[]

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([name])
}

model ComplianceCertification {
  id              String   @id @default(cuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id])

  frameworkId     String
  framework       ComplianceFramework @relation(fields: [frameworkId], references: [id])

  status          CertificationStatus  // NOT_STARTED, IN_PROGRESS, CERTIFIED, EXPIRED

  // Certification details
  certificationDate DateTime?
  expirationDate    DateTime?
  auditReportUrl    String?
  auditorName       String?

  // Progress tracking
  completedRequirements Json           // Array of completed requirement IDs
  progressPercentage    Float @default(0)

  notes           String?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([organizationId, frameworkId])
  @@index([organizationId])
  @@index([status])
}

enum CertificationStatus {
  NOT_STARTED
  IN_PROGRESS
  AUDIT_SCHEDULED
  CERTIFIED
  EXPIRED
}

// Compliance frameworks seeded data
const COMPLIANCE_FRAMEWORKS = [
  {
    name: 'SOC2_TYPE2',
    displayName: 'SOC 2 Type II',
    version: '2017',
    requirements: [
      {
        id: 'CC1.1',
        category: 'Control Environment',
        description: 'COSO Principle 1: The entity demonstrates a commitment to integrity and ethical values',
        evidence: ['Code of conduct', 'Ethics training records'],
      },
      {
        id: 'CC6.1',
        category: 'Logical Access',
        description: 'Logical and physical access controls restrict access to authorized users',
        evidence: ['Access control policies', 'User access reviews', 'MFA enforcement'],
      },
      // ... 60+ more requirements
    ],
  },
  {
    name: 'HIPAA',
    displayName: 'HIPAA',
    version: '1996',
    requirements: [
      {
        id: '164.308(a)(1)',
        category: 'Security Management Process',
        description: 'Implement policies and procedures to prevent, detect, contain, and correct security violations',
        evidence: ['Risk assessment', 'Risk management plan'],
      },
      {
        id: '164.312(a)(1)',
        category: 'Access Control',
        description: 'Implement technical policies and procedures for electronic systems that maintain ePHI',
        evidence: ['Access control lists', 'Unique user identification'],
      },
      // ... 40+ more requirements
    ],
  },
  {
    name: 'ISO27001',
    displayName: 'ISO 27001',
    version: '2022',
    requirements: [
      {
        id: 'A.5.1',
        category: 'Information Security Policies',
        description: 'Management direction for information security',
        evidence: ['Information security policy', 'Policy review records'],
      },
      // ... 90+ more requirements
    ],
  },
  {
    name: 'GDPR',
    displayName: 'GDPR',
    version: '2016/679',
    requirements: [
      {
        id: 'Article 15',
        category: 'Right of Access',
        description: 'Data subject has the right to obtain confirmation and access to personal data',
        evidence: ['Data export functionality', 'Request handling process'],
      },
      {
        id: 'Article 17',
        category: 'Right to Erasure',
        description: 'Right to deletion of personal data without undue delay',
        evidence: ['Data deletion workflow', 'Deletion logs'],
      },
      // ... 50+ more requirements
    ],
  },
]
```

**Compliance Dashboard UI**:

```tsx
// apps/admin/app/(platform)/compliance/frameworks/page.tsx

export default async function ComplianceFrameworksPage() {
  const frameworks = await db.complianceFramework.findMany({
    include: {
      _count: { select: { certifications: true } },
    },
  })

  const enterpriseOrgs = await db.organization.count({
    where: { isEnterpriseCustomer: true },
  })

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Compliance Frameworks</h1>

      <Alert variant="info" className="mb-6">
        ℹ️ Track customer compliance certifications and generate audit reports.
        {enterpriseOrgs} enterprise customers require compliance management.
      </Alert>

      <div className="grid gap-6">
        {frameworks.map((framework) => (
          <Card key={framework.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{framework.displayName}</CardTitle>
                  <p className="text-sm text-slate-600">{framework.description}</p>
                </div>
                <Badge>{framework._count.certifications} customers</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">
                    {(framework.requirements as any[]).length} requirements
                  </p>
                  <p className="text-xs text-slate-500">Version {framework.version}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => viewRequirements(framework.id)}
                  >
                    View Requirements
                  </Button>
                  <Button onClick={() => manageCustomers(framework.id)}>
                    Manage Customers →
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

// Per-customer compliance view
export async function CustomerCompliancePage({ orgId }: { orgId: string }) {
  const org = await db.organization.findUniqueOrThrow({
    where: { id: orgId },
    include: {
      certifications: {
        include: { framework: true },
      },
    },
  })

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">
        Compliance: {org.name}
      </h1>

      {/* Active Certifications */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Active Certifications</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {org.certifications
              .filter(c => c.status === 'CERTIFIED')
              .map((cert) => (
                <div
                  key={cert.id}
                  className="border rounded p-4 flex items-center justify-between"
                >
                  <div>
                    <p className="font-semibold">{cert.framework.displayName}</p>
                    <p className="text-sm text-slate-600">
                      Expires: {formatDate(cert.expirationDate)}
                    </p>
                  </div>
                  <Badge variant="success">Certified</Badge>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* In Progress */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>In Progress</CardTitle>
        </CardHeader>
        <CardContent>
          {org.certifications
            .filter(c => c.status === 'IN_PROGRESS')
            .map((cert) => (
              <div key={cert.id} className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold">{cert.framework.displayName}</p>
                  <Badge>{cert.progressPercentage}% complete</Badge>
                </div>
                <Progress value={cert.progressPercentage} />
                <div className="mt-2 flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => viewProgress(cert.id)}
                  >
                    View Progress
                  </Button>
                  <Button onClick={() => generateAuditReport(cert.id)}>
                    Generate Report
                  </Button>
                </div>
              </div>
            ))}
        </CardContent>
      </Card>

      {/* Available Frameworks */}
      <Card>
        <CardHeader>
          <CardTitle>Add Certification</CardTitle>
        </CardHeader>
        <CardContent>
          <AddCertificationDialog orgId={orgId} />
        </CardContent>
      </Card>
    </div>
  )
}

// Audit report generation
async function generateAuditReport(certificationId: string) {
  const cert = await db.complianceCertification.findUniqueOrThrow({
    where: { id: certificationId },
    include: {
      framework: true,
      organization: true,
    },
  })

  const requirements = cert.framework.requirements as any[]
  const completed = cert.completedRequirements as string[]

  // Generate PDF report
  const report = await generatePDF({
    title: `${cert.framework.displayName} Audit Report`,
    organization: cert.organization.name,
    date: new Date(),
    sections: [
      {
        title: 'Executive Summary',
        content: `
          This report summarizes ${cert.organization.name}'s compliance with
          ${cert.framework.displayName}. As of ${formatDate(new Date())},
          ${completed.length} of ${requirements.length} requirements are complete
          (${cert.progressPercentage}%).
        `,
      },
      {
        title: 'Requirements Summary',
        content: requirements.map((req) => ({
          id: req.id,
          description: req.description,
          status: completed.includes(req.id) ? 'Complete' : 'Incomplete',
          evidence: req.evidence,
        })),
      },
      {
        title: 'Evidence Collected',
        content: await collectEvidence(cert.organizationId, requirements),
      },
    ],
  })

  // Upload to S3
  const reportUrl = await uploadToS3(report, `audit-reports/${cert.id}.pdf`)

  // Update certification
  await db.complianceCertification.update({
    where: { id: certificationId },
    data: { auditReportUrl: reportUrl },
  })

  return reportUrl
}
```

### 3. SLA Monitoring

**Requirement**: Monitor and enforce enterprise SLAs in real-time.

**Implementation**:

```typescript
// Database schema
model SLAMetric {
  id              String   @id @default(cuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id])

  metricType      SLAMetricType
  target          Float            // Target value (e.g., 99.95 for uptime)
  actual          Float            // Actual measured value
  period          SLAPeriod        // HOURLY, DAILY, MONTHLY
  timestamp       DateTime

  // Additional context
  metadata        Json?            // { region: 'us-east-1', endpoint: '/api/v1/...' }

  createdAt       DateTime @default(now())

  @@index([organizationId, timestamp])
  @@index([metricType, timestamp])
}

model SLAViolation {
  id              String   @id @default(cuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id])

  metricType      SLAMetricType
  target          Float
  actual          Float
  duration        Int              // Duration in minutes
  impact          ImpactLevel      // MINOR, MAJOR, CRITICAL

  // SLA credit calculation
  creditAmount    Int              // In cents
  creditIssued    Boolean @default(false)

  // Incident linkage
  incidentId      String?
  incident        Incident? @relation(fields: [incidentId], references: [id])

  startTime       DateTime
  endTime         DateTime?

  createdAt       DateTime @default(now())

  @@index([organizationId])
  @@index([metricType])
  @@index([startTime])
}

enum SLAMetricType {
  UPTIME
  LATENCY_P50
  LATENCY_P95
  LATENCY_P99
  ERROR_RATE
  SUPPORT_RESPONSE_TIME
}

enum SLAPeriod {
  HOURLY
  DAILY
  MONTHLY
  QUARTERLY
}

enum ImpactLevel {
  MINOR        // < 5 min downtime
  MAJOR        // 5-30 min downtime
  CRITICAL     // > 30 min downtime
}
```

**SLA Monitoring Service**:

```typescript
// packages/sla-monitoring/src/sla-monitor.service.ts

@Injectable()
export class SLAMonitorService {
  // Real-time SLA metric collection (runs every minute)
  @Cron('* * * * *')
  async collectSLAMetrics() {
    const enterpriseOrgs = await this.db.organization.findMany({
      where: {
        isEnterpriseCustomer: true,
        contract: {
          status: 'ACTIVE',
        },
      },
      include: { contract: true },
    })

    for (const org of enterpriseOrgs) {
      await this.collectOrgMetrics(org)
    }
  }

  private async collectOrgMetrics(org: Organization) {
    const contract = org.contract

    // Collect uptime
    const uptime = await this.measureUptime(org.id)
    await this.recordMetric(org.id, 'UPTIME', contract.slaUptime, uptime, 'HOURLY')

    if (uptime < contract.slaUptime) {
      await this.recordViolation(org.id, 'UPTIME', contract.slaUptime, uptime)
    }

    // Collect latency
    const latencyP99 = await this.measureLatencyP99(org.id)
    await this.recordMetric(org.id, 'LATENCY_P99', contract.slaLatencyP99, latencyP99, 'HOURLY')

    if (latencyP99 > contract.slaLatencyP99) {
      await this.recordViolation(org.id, 'LATENCY_P99', contract.slaLatencyP99, latencyP99)
    }

    // Collect error rate
    const errorRate = await this.measureErrorRate(org.id)
    await this.recordMetric(org.id, 'ERROR_RATE', 1.0, errorRate, 'HOURLY') // 1% max error rate

    if (errorRate > 1.0) {
      await this.recordViolation(org.id, 'ERROR_RATE', 1.0, errorRate)
    }
  }

  private async measureUptime(orgId: string): Promise<number> {
    // Query from Datadog or similar
    const result = await this.datadogAPI.query({
      query: `avg:system.uptime{organization_id:${orgId}}`,
      from: Date.now() - 3600000, // Last hour
      to: Date.now(),
    })

    return result.series[0].pointlist[0][1] * 100 // Convert to percentage
  }

  private async measureLatencyP99(orgId: string): Promise<number> {
    const result = await this.datadogAPI.query({
      query: `p99:trace.http.request.duration{organization_id:${orgId}}`,
      from: Date.now() - 3600000,
      to: Date.now(),
    })

    return result.series[0].pointlist[0][1] // In milliseconds
  }

  private async recordViolation(
    orgId: string,
    metricType: SLAMetricType,
    target: number,
    actual: number
  ) {
    const existingViolation = await this.db.sLAViolation.findFirst({
      where: {
        organizationId: orgId,
        metricType,
        endTime: null, // Ongoing violation
      },
    })

    if (existingViolation) {
      // Update duration
      const duration = differenceInMinutes(new Date(), existingViolation.startTime)
      await this.db.sLAViolation.update({
        where: { id: existingViolation.id },
        data: { duration },
      })
    } else {
      // Create new violation
      await this.db.sLAViolation.create({
        data: {
          organizationId: orgId,
          metricType,
          target,
          actual,
          duration: 1,
          impact: this.calculateImpact(metricType, target, actual),
          startTime: new Date(),
        },
      })

      // Alert CSM
      await this.alertCSM(orgId, metricType, target, actual)
    }
  }

  private calculateImpact(
    metricType: SLAMetricType,
    target: number,
    actual: number
  ): ImpactLevel {
    if (metricType === 'UPTIME') {
      const uptimeDiff = target - actual
      if (uptimeDiff > 0.1) return 'CRITICAL'  // > 0.1% downtime
      if (uptimeDiff > 0.05) return 'MAJOR'
      return 'MINOR'
    }

    if (metricType === 'LATENCY_P99') {
      const latencyDiff = actual - target
      if (latencyDiff > 200) return 'CRITICAL'  // > 200ms over target
      if (latencyDiff > 100) return 'MAJOR'
      return 'MINOR'
    }

    return 'MINOR'
  }

  private async alertCSM(
    orgId: string,
    metricType: SLAMetricType,
    target: number,
    actual: number
  ) {
    const org = await this.db.organization.findUnique({
      where: { id: orgId },
      include: { contract: { include: { csmUser: true } } },
    })

    if (org.contract.csmUser) {
      await this.emailService.send({
        to: org.contract.csmUser.email,
        subject: `🚨 SLA Violation: ${org.name}`,
        template: 'sla-violation',
        data: {
          customerName: org.name,
          metricType,
          target,
          actual,
          dashboardUrl: `${process.env.APP_URL}/admin/sla/violations/${orgId}`,
        },
      })

      // Also send Slack alert
      await this.slackService.sendMessage({
        channel: '#customer-success',
        text: `🚨 SLA Violation: ${org.name} - ${metricType} (Target: ${target}, Actual: ${actual})`,
      })
    }
  }
}
```

**SLA Dashboard UI**:

```tsx
// apps/admin/app/(platform)/sla/overview/page.tsx

export default async function SLAOverviewPage() {
  const enterpriseOrgs = await db.organization.findMany({
    where: { isEnterpriseCustomer: true },
    include: {
      contract: true,
      _count: {
        select: {
          slaViolations: {
            where: {
              createdAt: { gte: subDays(new Date(), 30) },
            },
          },
        },
      },
    },
  })

  const activeViolations = await db.sLAViolation.count({
    where: { endTime: null },
  })

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">SLA Monitoring</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <MetricCard
          title="Enterprise Customers"
          value={enterpriseOrgs.length}
        />
        <MetricCard
          title="Active Violations"
          value={activeViolations}
          status={activeViolations > 0 ? 'error' : 'success'}
        />
        <MetricCard
          title="Avg Uptime (30d)"
          value="99.97%"
          status="success"
        />
        <MetricCard
          title="SLA Credits Issued"
          value="$2,450"
        />
      </div>

      {/* Active Violations Alert */}
      {activeViolations > 0 && (
        <Alert variant="error" className="mb-6">
          🚨 {activeViolations} active SLA violations require immediate attention!
          <Button
            variant="ghost"
            onClick={() => router.push('/admin/sla/violations')}
            className="ml-4"
          >
            View Violations →
          </Button>
        </Alert>
      )}

      {/* Per-Customer SLA Status */}
      <Card>
        <CardHeader>
          <CardTitle>Customer SLA Status</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            data={enterpriseOrgs}
            columns={[
              { key: 'name', label: 'Customer', sortable: true },
              {
                key: 'contract.slaUptime',
                label: 'Uptime SLA',
                render: (row) => `${row.contract.slaUptime}%`,
              },
              {
                key: 'actualUptime',
                label: 'Actual Uptime (30d)',
                render: (row) => {
                  const actual = calculateActualUptime(row.id, 30)
                  const status = actual >= row.contract.slaUptime ? 'success' : 'error'
                  return (
                    <Badge variant={status}>
                      {actual.toFixed(2)}%
                    </Badge>
                  )
                },
              },
              {
                key: 'contract.slaLatencyP99',
                label: 'Latency SLA',
                render: (row) => `${row.contract.slaLatencyP99}ms`,
              },
              {
                key: 'actualLatency',
                label: 'Actual P99 (30d)',
                render: (row) => {
                  const actual = calculateActualLatency(row.id, 30)
                  const status = actual <= row.contract.slaLatencyP99 ? 'success' : 'error'
                  return (
                    <Badge variant={status}>
                      {actual}ms
                    </Badge>
                  )
                },
              },
              {
                key: '_count.slaViolations',
                label: 'Violations (30d)',
                render: (row) => {
                  const count = row._count.slaViolations
                  return (
                    <Badge variant={count > 0 ? 'warning' : 'success'}>
                      {count}
                    </Badge>
                  )
                },
                sortable: true,
              },
              {
                key: 'actions',
                label: '',
                render: (row) => (
                  <Button
                    variant="ghost"
                    onClick={() => viewSLADetails(row.id)}
                  >
                    View Details →
                  </Button>
                ),
              },
            ]}
            sortable
          />
        </CardContent>
      </Card>
    </div>
  )
}
```

### 4. Emergency Access (Break-Glass)

**Requirement**: Platform admins need emergency access to customer data with full audit trail.

**Implementation**:

```typescript
// Database schema
model EmergencyAccess {
  id                  String   @id @default(cuid())
  organizationId      String
  organization        Organization @relation(fields: [organizationId], references: [id])

  adminUserId         String
  adminUser           User @relation(fields: [adminUserId], references: [id])

  reason              String           // "Customer reported data loss"
  justification       String           // Detailed explanation
  approvedBy          String?          // Senior admin who approved
  approvalRequired    Boolean @default(true)

  accessGrantedAt     DateTime?
  accessRevokedAt     DateTime?
  duration            Int              // Max duration in minutes (default: 60)

  // Audit trail
  actionsPerformed    Json             // Array of actions
  dataAccessed        Json             // Array of resources accessed

  status              EmergencyAccessStatus

  createdAt           DateTime @default(now())

  @@index([organizationId])
  @@index([adminUserId])
  @@index([status])
}

enum EmergencyAccessStatus {
  REQUESTED
  APPROVED
  ACTIVE
  EXPIRED
  REVOKED
}
```

**Emergency Access UI**:

```tsx
// apps/admin/app/(platform)/enterprise/emergency-access/page.tsx

export default async function EmergencyAccessPage() {
  const requests = await db.emergencyAccess.findMany({
    include: {
      organization: true,
      adminUser: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  const activeAccess = requests.filter(r => r.status === 'ACTIVE')

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Emergency Access</h1>
        <RequestEmergencyAccessDialog />
      </div>

      <Alert variant="warning" className="mb-6">
        ⚠️ Emergency access grants full access to customer data. All actions are logged
        and audited. Use only when absolutely necessary for critical customer support.
      </Alert>

      {activeAccess.length > 0 && (
        <Alert variant="error" className="mb-6">
          🚨 {activeAccess.length} active emergency access sessions in progress
        </Alert>
      )}

      <DataTable
        data={requests}
        columns={[
          {
            key: 'createdAt',
            label: 'Requested',
            render: (row) => formatDateTime(row.createdAt),
            sortable: true,
          },
          { key: 'adminUser.name', label: 'Admin' },
          { key: 'organization.name', label: 'Customer' },
          { key: 'reason', label: 'Reason' },
          {
            key: 'status',
            label: 'Status',
            render: (row) => <EmergencyAccessStatusBadge status={row.status} />,
          },
          {
            key: 'duration',
            label: 'Duration',
            render: (row) => {
              if (row.status === 'ACTIVE') {
                const remaining = differenceInMinutes(
                  addMinutes(row.accessGrantedAt, row.duration),
                  new Date()
                )
                return <Badge variant="warning">{remaining}min remaining</Badge>
              }
              return `${row.duration}min`
            },
          },
          {
            key: 'actions',
            label: '',
            render: (row) => (
              <DropdownMenu>
                {row.status === 'REQUESTED' && (
                  <>
                    <DropdownMenuItem onClick={() => approveAccess(row.id)}>
                      ✅ Approve
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => denyAccess(row.id)} destructive>
                      ❌ Deny
                    </DropdownMenuItem>
                  </>
                )}
                {row.status === 'ACTIVE' && (
                  <DropdownMenuItem onClick={() => revokeAccess(row.id)} destructive>
                    🛑 Revoke Access
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => viewAuditTrail(row.id)}>
                  View Audit Trail
                </DropdownMenuItem>
              </DropdownMenu>
            ),
          },
        ]}
        filterable={{
          status: Object.values(EmergencyAccessStatus),
        }}
      />
    </div>
  )
}

function RequestEmergencyAccessDialog() {
  const form = useForm<RequestEmergencyAccessDto>()

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="destructive">🚨 Request Emergency Access</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request Emergency Access</DialogTitle>
          <p className="text-sm text-slate-600">
            This will grant you full access to customer data for troubleshooting.
            All actions will be logged and reviewed.
          </p>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <Label>Customer</Label>
          <OrganizationPicker {...form.register('organizationId')} />

          <Label>Reason</Label>
          <Select {...form.register('reason')}>
            <option value="data_loss">Customer reported data loss</option>
            <option value="service_disruption">Service disruption</option>
            <option value="security_incident">Security incident</option>
            <option value="billing_issue">Critical billing issue</option>
            <option value="other">Other (explain below)</option>
          </Select>

          <Label>Detailed Justification</Label>
          <Textarea
            placeholder="Explain why emergency access is needed..."
            {...form.register('justification')}
            required
            minLength={50}
          />

          <Label>Duration</Label>
          <Select {...form.register('duration')}>
            <option value="30">30 minutes</option>
            <option value="60">1 hour (default)</option>
            <option value="120">2 hours</option>
          </Select>

          <Alert variant="warning" className="mt-4">
            ⚠️ By submitting this request, you acknowledge that all actions
            will be logged and reviewed by senior management.
          </Alert>

          <Button type="submit" variant="destructive" className="mt-4">
            Submit Request
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

## Consequences

### Positive

1. **Enterprise Support Excellence**:
   - Contract management reduces manual work by 90%
   - SLA monitoring prevents violations proactively
   - Compliance tracking saves weeks during audits
   - Emergency access enables fast incident response

2. **Operational Efficiency**:
   - Self-service reduces support tickets by 80%
   - Automated alerts prevent SLA violations
   - Compliance reports generated in minutes vs days
   - Incident management reduces MTTR by 50%

3. **Regulatory Compliance**:
   - Audit trails for all admin actions (SOC 2 requirement)
   - Emergency access logs satisfy compliance auditors
   - Data residency enforcement prevents violations
   - Automated compliance reports reduce audit prep time

4. **Revenue Protection**:
   - Proactive SLA monitoring reduces churn
   - Contract renewal automation prevents missed renewals
   - Customer health tracking enables early intervention
   - Compliance support enables selling to regulated industries

### Negative

1. **Complexity**:
   - 8 new database models
   - Complex SLA calculation logic
   - Multiple compliance frameworks to support
   - Emergency access approval workflows

2. **Security Risks**:
   - Emergency access is powerful (can access all customer data)
   - Compliance data contains sensitive information
   - SLA monitoring requires access to metrics
   - Contract data includes pricing (confidential)

3. **Operational Overhead**:
   - CSMs must monitor SLA violations
   - Compliance certifications need manual updates
   - Emergency access requires approval process
   - Incident management requires on-call rotation

### Mitigations

1. **Complexity**:
   - **Action**: Comprehensive documentation and training
   - **Testing**: E2E tests for critical workflows
   - **Monitoring**: Dashboard alerts for admin errors

2. **Security**:
   - **Action**: All emergency access requires senior approval
   - **Audit**: Every action logged with full context
   - **Encryption**: Sensitive data encrypted at rest (AES-256)
   - **Alerts**: Slack notifications for emergency access requests

3. **Operational**:
   - **Action**: Automated SLA violation alerts
   - **Runbooks**: Step-by-step incident response guides
   - **Training**: Quarterly compliance training for admins
   - **On-call**: PagerDuty rotation for critical alerts

## Metrics & Success Criteria

### Operational Excellence
- **Contract Creation Time**: < 10 minutes (vs 2 hours manual)
- **SLA Violation Detection**: < 5 minutes (proactive vs reactive)
- **Emergency Access Approval**: < 15 minutes
- **Compliance Report Generation**: < 5 minutes (vs 2 days manual)

### Customer Satisfaction
- **CSAT for Enterprise Support**: > 4.5/5
- **SLA Violation Rate**: < 1% per quarter
- **Incident MTTR**: < 2 hours (SEV1), < 8 hours (SEV2)
- **Contract Renewal Rate**: > 95%

### Compliance
- **Audit Preparation Time**: < 2 weeks (vs 6 weeks)
- **Compliance Report Accuracy**: > 99%
- **Emergency Access Audit Pass Rate**: 100%
- **Data Deletion SLA**: < 30 days (GDPR requirement)

## References

### Research Sources
- [SLA Monitoring Best Practices](https://www.atlassian.com/incident-management/kpis/sla-vs-slo-vs-sli)
- [SOC 2 Compliance Requirements](https://www.aicpa.org/interestareas/frc/assuranceadvisoryservices/aicpasoc2report)
- [Emergency Access Controls](https://csrc.nist.gov/glossary/term/emergency_access)
- [GDPR Article 15 (Right of Access)](https://gdpr-info.eu/art-15-gdpr/)

### Internal References
- ADR-014: Admin Portal - Multi-Tenant Management
- ADR-019: Enterprise Customer Management
- ADR-021: Multi-Compliance Framework Support
- ADR-022: Feature Flagging System

## Review Date
April 2026 (3 months)

---

**Document Version**: 1.0
**Last Updated**: 2026-01-20
**Authors**: Engineering & Product Team
**Approved By**: CTO, Head of Customer Success, Chief Compliance Officer
