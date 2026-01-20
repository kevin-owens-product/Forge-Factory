# ADR-021: Multi-Compliance Framework Support

## Status
Accepted

## Context

Forge Factory must support **multiple compliance frameworks** simultaneously to serve enterprise customers in regulated industries (Healthcare, Finance, Government). Different customers require different certifications:

### Compliance Framework Requirements

1. **SOC 2 Type II**:
   - **Required By**: All enterprise customers (baseline)
   - **Scope**: Security, Availability, Confidentiality controls
   - **Audit Frequency**: Annual
   - **Cost**: $50K-$150K per audit
   - **Duration**: 6-12 months for first certification
   - **Requirements**: 64 AICPA Trust Services Criteria

2. **HIPAA** (Health Insurance Portability and Accountability Act):
   - **Required By**: Healthcare customers (hospitals, pharma, health tech)
   - **Scope**: Protected Health Information (PHI) handling
   - **Audit Frequency**: Annual + ad-hoc
   - **Penalty for Violation**: Up to $1.5M per violation
   - **Requirements**: 45+ technical and administrative safeguards
   - **Key Controls**: Encryption, access controls, audit logs, BAA (Business Associate Agreement)

3. **ISO 27001** (Information Security Management):
   - **Required By**: European enterprise customers
   - **Scope**: Information Security Management System (ISMS)
   - **Audit Frequency**: Annual surveillance + 3-year re-certification
   - **Requirements**: 114 controls across 14 domains
   - **Key Controls**: Risk assessment, incident response, business continuity

4. **GDPR** (General Data Protection Regulation):
   - **Required By**: All customers with EU users
   - **Scope**: Personal data processing
   - **Penalty for Violation**: Up to €20M or 4% of annual revenue
   - **Requirements**: Lawful basis, consent, data subject rights
   - **Key Rights**: Access, rectification, erasure, portability, restriction

5. **FedRAMP** (Federal Risk and Authorization Management Program):
   - **Required By**: US government customers
   - **Scope**: Cloud services for federal agencies
   - **Audit Frequency**: Annual + continuous monitoring
   - **Requirements**: 325 NIST 800-53 controls
   - **Timeline**: 12-18 months for initial authorization
   - **Cost**: $250K-$500K

6. **PCI DSS** (Payment Card Industry Data Security Standard):
   - **Required By**: Customers processing credit cards
   - **Scope**: Cardholder data environment
   - **Requirements**: 12 requirements, 78 sub-requirements
   - **Key Controls**: Encryption, network segmentation, vulnerability management

7. **CCPA/CPRA** (California Consumer Privacy Act):
   - **Required By**: Customers with California residents
   - **Scope**: Personal information of California consumers
   - **Penalty**: $2,500-$7,500 per violation
   - **Key Rights**: Know, delete, opt-out, correct

### Current State

- ✅ Basic audit logs (90 days retention)
- ✅ Encryption at rest (AES-256)
- ✅ RBAC (4 roles)
- ✅ HTTPS/TLS 1.3

**Missing**:
- ❌ Framework-specific controls
- ❌ Evidence collection automation
- ❌ Continuous compliance monitoring
- ❌ Data residency enforcement
- ❌ Data subject rights workflows (GDPR)
- ❌ BAA management (HIPAA)
- ❌ Audit-ready reporting

### Customer Segmentation

Based on Year 1 projections:

| Framework | Customers | ARR/Customer | Total ARR | Priority |
|-----------|-----------|--------------|-----------|----------|
| SOC 2     | 15        | $150K        | $2.25M    | P0       |
| GDPR      | 10        | $120K        | $1.2M     | P0       |
| ISO 27001 | 5         | $180K        | $900K     | P1       |
| HIPAA     | 3         | $200K        | $600K     | P1       |
| FedRAMP   | 1         | $500K        | $500K     | P2       |
| PCI DSS   | 2         | $100K        | $200K     | P2       |

**Total**: $5.65M ARR dependent on compliance

### Challenges

1. **Overlapping Requirements**:
   - 80% of controls overlap across frameworks
   - Need to map controls to avoid duplication
   - Evidence should satisfy multiple frameworks

2. **Framework-Specific Controls**:
   - HIPAA requires PHI encryption labels
   - GDPR requires consent management
   - FedRAMP requires continuous monitoring
   - ISO 27001 requires risk assessment process

3. **Audit Preparation**:
   - Manual evidence collection takes 4-6 weeks
   - Auditors request 100+ documents per framework
   - Evidence must be version-controlled and timestamped

4. **Continuous Compliance**:
   - Controls can drift out of compliance
   - Need real-time monitoring
   - Automated alerting for control failures

5. **Data Subject Rights** (GDPR/CCPA):
   - Right to access: Export all user data
   - Right to erasure: Delete all user data
   - Right to portability: Machine-readable format
   - Must respond within 30 days

## Decision

We will build a **Compliance Automation Platform** that:

1. **Centralizes compliance requirements** across all frameworks
2. **Automates evidence collection** for audit readiness
3. **Monitors controls continuously** with alerting
4. **Implements framework-specific features** (BAA, consent, data residency)
5. **Provides audit-ready reports** on-demand

### Architecture Overview

```
┌────────────────────────────────────────────────────────────────────────┐
│              Compliance Automation Platform Architecture               │
├────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Application Layer                                                      │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │ User Portal                Admin Portal          Platform Admin│    │
│  │ ┌─────────────┐          ┌─────────────┐       ┌─────────────┐│    │
│  │ │ Consent     │          │ Compliance  │       │ Framework   ││    │
│  │ │ Management  │          │ Dashboard   │       │ Management  ││    │
│  │ │             │          │             │       │             ││    │
│  │ │ • Cookie    │          │ • Cert      │       │ • Add       ││    │
│  │ │   Consent   │          │   Status    │       │   Frameworks││    │
│  │ │ • Data      │          │ • Progress  │       │ • Map       ││    │
│  │ │   Requests  │          │ • Evidence  │       │   Controls  ││    │
│  │ │ • Privacy   │          │ • Reports   │       │ • Evidence  ││    │
│  │ │   Policy    │          │             │       │   Rules     ││    │
│  │ └─────────────┘          └─────────────┘       └─────────────┘│    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                   │                                     │
│                                   ▼                                     │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │                  Compliance Services Layer                      │    │
│  │                                                                  │    │
│  │  FrameworkService                                               │    │
│  │  ├─ defineFramework(name, version, requirements)                │    │
│  │  ├─ mapControlsToFramework(controlIds, frameworkId)             │    │
│  │  └─ getFrameworkGaps(organizationId, frameworkId)               │    │
│  │                                                                  │    │
│  │  EvidenceCollectionService                                      │    │
│  │  ├─ collectEvidence(controlId) → Evidence[]                     │    │
│  │  ├─ scheduleCollection(controlId, cron)                         │    │
│  │  └─ generateAuditPackage(frameworkId) → PDF                     │    │
│  │                                                                  │    │
│  │  ControlMonitoringService                                       │    │
│  │  ├─ evaluateControl(controlId) → Pass/Fail                      │    │
│  │  ├─ scheduleMonitoring(controlId, frequency)                    │    │
│  │  └─ alertOnFailure(controlId, recipients)                       │    │
│  │                                                                  │    │
│  │  DataSubjectRightsService                                       │    │
│  │  ├─ handleAccessRequest(userId) → DataExport                    │    │
│  │  ├─ handleErasureRequest(userId) → DeletionReport               │    │
│  │  ├─ handlePortabilityRequest(userId) → JSON                     │    │
│  │  └─ trackRequestStatus(requestId)                               │    │
│  │                                                                  │    │
│  │  ConsentManagementService                                       │    │
│  │  ├─ recordConsent(userId, purposes, lawfulBasis)                │    │
│  │  ├─ withdrawConsent(userId, purpose)                            │    │
│  │  ├─ getConsentHistory(userId) → Consent[]                       │    │
│  │  └─ enforceConsent(userId, operation)                           │    │
│  │                                                                  │    │
│  │  DataResidencyService                                           │    │
│  │  ├─ assignRegion(organizationId, region)                        │    │
│  │  ├─ enforceResidency(organizationId) → boolean                  │    │
│  │  └─ migrateData(organizationId, fromRegion, toRegion)           │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                   │                                     │
│                                   ▼                                     │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │                  Database Schema (Compliance)                   │    │
│  │                                                                  │    │
│  │  ComplianceControl                                              │    │
│  │  ├─ id                                                          │    │
│  │  ├─ code (e.g., "CC6.1", "164.312(a)")                         │    │
│  │  ├─ category                                                    │    │
│  │  ├─ description                                                 │    │
│  │  ├─ implementationGuidance                                      │    │
│  │  ├─ evidenceRequirements[]                                      │    │
│  │  ├─ automationLevel (MANUAL, SEMI_AUTO, FULLY_AUTO)            │    │
│  │  └─ frameworks[] (many-to-many)                                 │    │
│  │                                                                  │    │
│  │  ControlImplementation                                          │    │
│  │  ├─ id                                                          │    │
│  │  ├─ organizationId                                              │    │
│  │  ├─ controlId                                                   │    │
│  │  ├─ status (NOT_IMPLEMENTED, IN_PROGRESS, IMPLEMENTED)         │    │
│  │  ├─ implementationDate                                          │    │
│  │  ├─ owner (userId)                                              │    │
│  │  ├─ evidence[] (many-to-many)                                   │    │
│  │  ├─ lastReviewed                                                │    │
│  │  └─ nextReviewDate                                              │    │
│  │                                                                  │    │
│  │  Evidence                                                       │    │
│  │  ├─ id                                                          │    │
│  │  ├─ controlImplementationId                                     │    │
│  │  ├─ type (DOCUMENT, SCREENSHOT, LOG_EXPORT, CONFIG_FILE)       │    │
│  │  ├─ fileUrl                                                     │    │
│  │  ├─ collectedAt                                                 │    │
│  │  ├─ collectionMethod (MANUAL, AUTOMATED)                        │    │
│  │  ├─ expiresAt (for time-sensitive evidence)                     │    │
│  │  ├─ hash (SHA-256 for integrity)                                │    │
│  │  └─ metadata (JSON)                                             │    │
│  │                                                                  │    │
│  │  ControlMonitor                                                 │    │
│  │  ├─ id                                                          │    │
│  │  ├─ controlId                                                   │    │
│  │  ├─ evaluationScript (SQL/code to check compliance)             │    │
│  │  ├─ frequency (HOURLY, DAILY, WEEKLY, MONTHLY)                 │    │
│  │  ├─ lastEvaluatedAt                                             │    │
│  │  ├─ currentStatus (COMPLIANT, NON_COMPLIANT, DEGRADED)         │    │
│  │  ├─ failureCount                                                │    │
│  │  └─ alertRecipients[]                                           │    │
│  │                                                                  │    │
│  │  DataSubjectRequest                                             │    │
│  │  ├─ id                                                          │    │
│  │  ├─ userId                                                      │    │
│  │  ├─ requestType (ACCESS, ERASURE, PORTABILITY, RECTIFICATION)  │    │
│  │  ├─ status (PENDING, IN_PROGRESS, COMPLETED, DENIED)           │    │
│  │  ├─ requestedAt                                                 │    │
│  │  ├─ completedAt                                                 │    │
│  │  ├─ dueDate (requestedAt + 30 days for GDPR)                   │    │
│  │  ├─ responseUrl (download link for exports)                     │    │
│  │  ├─ denialReason                                                │    │
│  │  └─ handlerUserId                                               │    │
│  │                                                                  │    │
│  │  UserConsent                                                    │    │
│  │  ├─ id                                                          │    │
│  │  ├─ userId                                                      │    │
│  │  ├─ purpose (ANALYTICS, MARKETING, FUNCTIONAL, NECESSARY)      │    │
│  │  ├─ lawfulBasis (CONSENT, CONTRACT, LEGITIMATE_INTEREST)       │    │
│  │  ├─ granted (boolean)                                           │    │
│  │  ├─ grantedAt                                                   │    │
│  │  ├─ withdrawnAt                                                 │    │
│  │  ├─ ipAddress                                                   │    │
│  │  ├─ userAgent                                                   │    │
│  │  └─ consentText (versioned text user agreed to)                │    │
│  │                                                                  │    │
│  │  DataResidencyConfig                                            │    │
│  │  ├─ organizationId                                              │    │
│  │  ├─ region (US, EU, APAC, UK, CA)                              │    │
│  │  ├─ databaseHost (region-specific)                              │    │
│  │  ├─ storageRegion (S3 bucket region)                            │    │
│  │  ├─ enforcementLevel (STRICT, BEST_EFFORT)                     │    │
│  │  └─ lastValidatedAt                                             │    │
│  │                                                                  │    │
│  │  BusinessAssociateAgreement (HIPAA)                             │    │
│  │  ├─ organizationId                                              │    │
│  │  ├─ signedAt                                                    │    │
│  │  ├─ expiresAt                                                   │    │
│  │  ├─ documentUrl                                                 │    │
│  │  ├─ status (PENDING, ACTIVE, EXPIRED)                          │    │
│  │  └─ phiCategories[] (types of PHI covered)                     │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │              Evidence Collection Automations                    │    │
│  │                                                                  │    │
│  │  Automated Evidence Collectors:                                 │    │
│  │                                                                  │    │
│  │  1. Access Control Evidence (CC6.1, 164.312(a))                │    │
│  │     - Export IAM policies weekly                                │    │
│  │     - Screenshot MFA enforcement                                │    │
│  │     - User access review reports                                │    │
│  │     - Failed login attempts log                                 │    │
│  │                                                                  │    │
│  │  2. Encryption Evidence (CC6.7, 164.312(a)(2))                 │    │
│  │     - Database encryption status                                │    │
│  │     - TLS certificate validity                                  │    │
│  │     - Encryption key rotation logs                              │    │
│  │     - Backup encryption verification                            │    │
│  │                                                                  │    │
│  │  3. Audit Log Evidence (CC7.2, 164.312(b))                     │    │
│  │     - Audit log retention policy                                │    │
│  │     - Sample audit logs (last 90 days)                          │    │
│  │     - Audit log integrity checks                                │    │
│  │     - Access to audit logs (restricted)                         │    │
│  │                                                                  │    │
│  │  4. Vulnerability Management (CC7.1, 164.308(a)(1))            │    │
│  │     - Vulnerability scan reports                                │    │
│  │     - Patch management records                                  │    │
│  │     - Dependency update history                                 │    │
│  │     - Penetration test reports                                  │    │
│  │                                                                  │    │
│  │  5. Backup & DR Evidence (CC5.1, 164.308(a)(7))                │    │
│  │     - Backup success logs                                       │    │
│  │     - Backup restore tests                                      │    │
│  │     - Disaster recovery plan                                    │    │
│  │     - RPO/RTO metrics                                           │    │
│  │                                                                  │    │
│  │  6. Change Management (CC8.1)                                   │    │
│  │     - Git commit history                                        │    │
│  │     - Code review records (GitHub PR approvals)                 │    │
│  │     - Deployment logs (CI/CD)                                   │    │
│  │     - Change approval workflows                                 │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└────────────────────────────────────────────────────────────────────────┘
```

## Detailed Decisions

### 1. Control Mapping Across Frameworks

**Decision**: Create a unified control library with many-to-many mapping to frameworks.

**Implementation**:

```typescript
// Seed data: Control mapping
const CONTROL_MAPPINGS = [
  {
    control: {
      code: 'ACCESS_CONTROL_MFA',
      category: 'Access Control',
      description: 'Multi-factor authentication required for all user accounts',
      implementationGuidance: `
        1. Enable MFA enforcement in auth provider (Auth0, Okta)
        2. Block logins without MFA
        3. Support TOTP, SMS, hardware tokens
        4. Require MFA re-authentication for sensitive operations
      `,
      evidenceRequirements: [
        'Screenshot of MFA enforcement policy',
        'User MFA enrollment report (>95%)',
        'Failed login due to missing MFA logs',
        'MFA provider configuration export',
      ],
      automationLevel: 'SEMI_AUTO',
    },
    frameworks: [
      { code: 'CC6.1', framework: 'SOC2_TYPE2' },
      { code: '164.312(a)(2)(i)', framework: 'HIPAA' },
      { code: 'A.9.4.2', framework: 'ISO27001' },
      { code: 'AC-2', framework: 'FedRAMP' },
    ],
  },
  {
    control: {
      code: 'ENCRYPTION_AT_REST',
      category: 'Cryptography',
      description: 'All data encrypted at rest using AES-256',
      implementationGuidance: `
        1. Enable database encryption (PostgreSQL, MySQL)
        2. Enable S3 bucket encryption (SSE-S3 or SSE-KMS)
        3. Encrypt backups
        4. Document encryption key management
      `,
      evidenceRequirements: [
        'Database encryption status (pg_encryption)',
        'S3 bucket encryption policy',
        'Backup encryption verification',
        'Key rotation schedule',
      ],
      automationLevel: 'FULLY_AUTO',
    },
    frameworks: [
      { code: 'CC6.7', framework: 'SOC2_TYPE2' },
      { code: '164.312(a)(2)(iv)', framework: 'HIPAA' },
      { code: 'A.10.1.1', framework: 'ISO27001' },
      { code: 'SC-28', framework: 'FedRAMP' },
      { code: 'Requirement 3.4', framework: 'PCI_DSS' },
    ],
  },
  {
    control: {
      code: 'AUDIT_LOGGING',
      category: 'Logging & Monitoring',
      description: 'Comprehensive audit logging of all security-relevant events',
      implementationGuidance: `
        1. Log all authentication events (login, logout, MFA)
        2. Log all authorization changes (role changes, permission grants)
        3. Log all data access (read, write, delete)
        4. Retain logs for minimum 1 year
        5. Encrypt logs in transit and at rest
        6. Restrict access to logs (admin only)
      `,
      evidenceRequirements: [
        'Audit log retention policy',
        'Sample audit logs (last 90 days)',
        'Audit log access controls',
        'Log integrity verification (hash)',
      ],
      automationLevel: 'FULLY_AUTO',
    },
    frameworks: [
      { code: 'CC7.2', framework: 'SOC2_TYPE2' },
      { code: '164.312(b)', framework: 'HIPAA' },
      { code: 'A.12.4.1', framework: 'ISO27001' },
      { code: 'AU-2', framework: 'FedRAMP' },
      { code: 'Article 30', framework: 'GDPR' }, // Records of processing
    ],
  },
  // ... 50+ more controls
]

// Database seeding
async function seedComplianceControls() {
  for (const mapping of CONTROL_MAPPINGS) {
    const control = await db.complianceControl.create({
      data: mapping.control,
    })

    for (const frameworkMapping of mapping.frameworks) {
      await db.controlFrameworkMapping.create({
        data: {
          controlId: control.id,
          frameworkId: await getFrameworkId(frameworkMapping.framework),
          frameworkControlCode: frameworkMapping.code,
        },
      })
    }
  }
}
```

### 2. Automated Evidence Collection

**Decision**: Build evidence collectors that run on schedules to auto-collect evidence.

**Implementation**:

```typescript
// packages/compliance/src/evidence-collectors/

// Base collector interface
interface EvidenceCollector {
  controlId: string
  schedule: string // cron expression
  collect(): Promise<Evidence>
}

// Example: MFA Enforcement Evidence Collector
@Injectable()
export class MFAEnforcementCollector implements EvidenceCollector {
  controlId = 'ACCESS_CONTROL_MFA'
  schedule = '0 0 * * 1' // Weekly on Monday

  async collect(): Promise<Evidence> {
    // 1. Get MFA policy from Auth0
    const policy = await this.auth0.getMFAPolicy()

    // 2. Get user MFA enrollment stats
    const users = await this.auth0.getUsers()
    const mfaEnabled = users.filter(u => u.mfaEnabled).length
    const mfaPercentage = (mfaEnabled / users.length) * 100

    // 3. Get failed login attempts (missing MFA)
    const failedLogins = await this.db.auditLog.count({
      where: {
        action: 'login.failed',
        metadata: { path: ['reason'], equals: 'mfa_required' },
        createdAt: { gte: subDays(new Date(), 7) },
      },
    })

    // 4. Generate evidence package
    const evidencePackage = {
      policy: JSON.stringify(policy, null, 2),
      stats: {
        totalUsers: users.length,
        mfaEnabled,
        mfaPercentage,
        failedLoginsDueToMFA: failedLogins,
      },
      timestamp: new Date(),
    }

    // 5. Upload to S3
    const fileUrl = await this.uploadEvidence(
      `mfa-enforcement-${format(new Date(), 'yyyy-MM-dd')}.json`,
      JSON.stringify(evidencePackage, null, 2)
    )

    // 6. Create evidence record
    return await this.db.evidence.create({
      data: {
        controlImplementationId: await this.getControlImplementationId(this.controlId),
        type: 'CONFIG_FILE',
        fileUrl,
        collectedAt: new Date(),
        collectionMethod: 'AUTOMATED',
        expiresAt: addMonths(new Date(), 3), // Evidence valid for 3 months
        hash: this.calculateHash(evidencePackage),
        metadata: {
          mfaPercentage,
          threshold: 95, // Required: >95% enrollment
          compliant: mfaPercentage >= 95,
        },
      },
    })
  }

  private async uploadEvidence(filename: string, content: string): Promise<string> {
    const key = `evidence/${this.controlId}/${filename}`
    await this.s3.putObject({
      Bucket: process.env.EVIDENCE_BUCKET,
      Key: key,
      Body: content,
      ServerSideEncryption: 'AES256',
    })
    return `s3://${process.env.EVIDENCE_BUCKET}/${key}`
  }

  private calculateHash(data: any): string {
    return createHash('sha256').update(JSON.stringify(data)).digest('hex')
  }
}

// Example: Database Encryption Evidence Collector
@Injectable()
export class DatabaseEncryptionCollector implements EvidenceCollector {
  controlId = 'ENCRYPTION_AT_REST'
  schedule = '0 0 * * *' // Daily

  async collect(): Promise<Evidence> {
    // Check PostgreSQL encryption
    const encryptionStatus = await this.db.$queryRaw`
      SELECT datname, pg_is_in_recovery() as is_replica
      FROM pg_database
      WHERE datname = current_database()
    `

    // Check if encryption is enabled (via pgcrypto extension)
    const extensionCheck = await this.db.$queryRaw`
      SELECT * FROM pg_extension WHERE extname = 'pgcrypto'
    `

    // Check S3 bucket encryption
    const s3Encryption = await this.s3.getBucketEncryption({
      Bucket: process.env.S3_BUCKET,
    })

    const evidencePackage = {
      database: {
        encrypted: extensionCheck.length > 0,
        details: encryptionStatus,
      },
      storage: {
        encrypted: s3Encryption.ServerSideEncryptionConfiguration !== null,
        algorithm: s3Encryption.ServerSideEncryptionConfiguration?.Rules[0]
          ?.ApplyServerSideEncryptionByDefault?.SSEAlgorithm,
      },
      timestamp: new Date(),
    }

    const fileUrl = await this.uploadEvidence(
      `encryption-status-${format(new Date(), 'yyyy-MM-dd')}.json`,
      JSON.stringify(evidencePackage, null, 2)
    )

    return await this.db.evidence.create({
      data: {
        controlImplementationId: await this.getControlImplementationId(this.controlId),
        type: 'CONFIG_FILE',
        fileUrl,
        collectedAt: new Date(),
        collectionMethod: 'AUTOMATED',
        expiresAt: addDays(new Date(), 7), // Daily evidence, valid for 7 days
        hash: this.calculateHash(evidencePackage),
        metadata: {
          databaseEncrypted: evidencePackage.database.encrypted,
          storageEncrypted: evidencePackage.storage.encrypted,
          compliant: evidencePackage.database.encrypted && evidencePackage.storage.encrypted,
        },
      },
    })
  }
}

// Evidence collection scheduler
@Injectable()
export class EvidenceCollectionScheduler {
  private collectors: EvidenceCollector[] = [
    new MFAEnforcementCollector(),
    new DatabaseEncryptionCollector(),
    new AuditLogRetentionCollector(),
    new BackupVerificationCollector(),
    new VulnerabilityScanCollector(),
    // ... 20+ more collectors
  ]

  onModuleInit() {
    for (const collector of this.collectors) {
      // Schedule each collector based on its cron expression
      cron.schedule(collector.schedule, async () => {
        try {
          const evidence = await collector.collect()
          console.log(`[Evidence] Collected for ${collector.controlId}:`, evidence.id)

          // Evaluate control compliance
          await this.evaluateControlCompliance(collector.controlId, evidence)
        } catch (error) {
          console.error(`[Evidence] Failed to collect for ${collector.controlId}:`, error)
          await this.alertComplianceTeam(collector.controlId, error)
        }
      })
    }
  }

  private async evaluateControlCompliance(controlId: string, evidence: Evidence) {
    const compliant = evidence.metadata?.compliant as boolean

    await this.db.controlMonitor.update({
      where: { controlId },
      data: {
        lastEvaluatedAt: new Date(),
        currentStatus: compliant ? 'COMPLIANT' : 'NON_COMPLIANT',
        failureCount: compliant ? 0 : { increment: 1 },
      },
    })

    if (!compliant) {
      await this.alertComplianceTeam(controlId, new Error('Control non-compliant'))
    }
  }
}
```

### 3. Data Subject Rights Workflows (GDPR/CCPA)

**Decision**: Automated workflows for GDPR/CCPA data subject rights.

**Implementation**:

```typescript
// apps/api/src/modules/compliance/data-subject-rights.controller.ts

@Controller('api/v1/compliance/data-subject-requests')
export class DataSubjectRightsController {

  // Submit data access request (GDPR Article 15)
  @Post('access')
  async requestDataAccess(@CurrentUser() user: User) {
    const existingRequest = await this.db.dataSubjectRequest.findFirst({
      where: {
        userId: user.id,
        requestType: 'ACCESS',
        status: { in: ['PENDING', 'IN_PROGRESS'] },
      },
    })

    if (existingRequest) {
      throw new BadRequestException('You already have a pending access request')
    }

    const request = await this.db.dataSubjectRequest.create({
      data: {
        userId: user.id,
        requestType: 'ACCESS',
        status: 'IN_PROGRESS',
        requestedAt: new Date(),
        dueDate: addDays(new Date(), 30), // GDPR: 30 days
      },
    })

    // Start background job to collect data
    await this.queue.add('data-access-request', { requestId: request.id })

    return {
      requestId: request.id,
      status: 'IN_PROGRESS',
      estimatedCompletionDate: request.dueDate,
      message: 'Your data export is being prepared. You will receive an email when ready.',
    }
  }

  // Submit data erasure request (GDPR Article 17 "Right to be Forgotten")
  @Post('erasure')
  async requestDataErasure(@CurrentUser() user: User) {
    const request = await this.db.dataSubjectRequest.create({
      data: {
        userId: user.id,
        requestType: 'ERASURE',
        status: 'PENDING',
        requestedAt: new Date(),
        dueDate: addDays(new Date(), 30),
      },
    })

    // Notify compliance team for manual review
    await this.notifyComplianceTeam({
      type: 'ERASURE_REQUEST',
      userId: user.id,
      requestId: request.id,
    })

    return {
      requestId: request.id,
      status: 'PENDING',
      message: 'Your deletion request is under review. We will contact you within 30 days.',
    }
  }

  // Submit data portability request (GDPR Article 20)
  @Post('portability')
  async requestDataPortability(@CurrentUser() user: User) {
    const request = await this.db.dataSubjectRequest.create({
      data: {
        userId: user.id,
        requestType: 'PORTABILITY',
        status: 'IN_PROGRESS',
        requestedAt: new Date(),
        dueDate: addDays(new Date(), 30),
      },
    })

    await this.queue.add('data-portability-request', { requestId: request.id })

    return {
      requestId: request.id,
      status: 'IN_PROGRESS',
      message: 'Your data export (JSON format) is being prepared.',
    }
  }

  // Get request status
  @Get(':requestId')
  async getRequestStatus(@Param('requestId') requestId: string, @CurrentUser() user: User) {
    const request = await this.db.dataSubjectRequest.findFirst({
      where: { id: requestId, userId: user.id },
    })

    if (!request) {
      throw new NotFoundException('Request not found')
    }

    return {
      requestId: request.id,
      requestType: request.requestType,
      status: request.status,
      requestedAt: request.requestedAt,
      completedAt: request.completedAt,
      dueDate: request.dueDate,
      downloadUrl: request.responseUrl,
    }
  }
}

// Background job: Data access request
@Processor('data-access-request')
export class DataAccessRequestProcessor {

  @Process()
  async handleDataAccessRequest(job: Job<{ requestId: string }>) {
    const request = await this.db.dataSubjectRequest.findUnique({
      where: { id: job.data.requestId },
      include: { user: true },
    })

    // Collect all user data from multiple sources
    const userData = await this.collectAllUserData(request.userId)

    // Generate PDF report
    const pdf = await this.generateDataReport(userData)

    // Upload to S3 with expiring link
    const downloadUrl = await this.uploadWithExpiringLink(pdf, request.userId)

    // Update request
    await this.db.dataSubjectRequest.update({
      where: { id: request.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        responseUrl: downloadUrl,
      },
    })

    // Send email notification
    await this.emailService.send({
      to: request.user.email,
      subject: 'Your data export is ready',
      template: 'data-export-ready',
      data: {
        downloadUrl,
        expiresAt: addDays(new Date(), 7), // Link valid for 7 days
      },
    })

    // Log for compliance audit
    await this.db.auditLog.create({
      data: {
        userId: request.userId,
        action: 'data.exported',
        metadata: {
          requestId: request.id,
          dataSize: userData.totalRecords,
        },
      },
    })
  }

  private async collectAllUserData(userId: string) {
    const [
      profile,
      organizations,
      repositories,
      auditLogs,
      apiKeys,
      sessions,
    ] = await Promise.all([
      this.db.user.findUnique({ where: { id: userId } }),
      this.db.organizationMember.findMany({ where: { userId } }),
      this.db.repository.findMany({ where: { ownerId: userId } }),
      this.db.auditLog.findMany({ where: { userId }, take: 1000 }),
      this.db.apiKey.findMany({ where: { userId } }),
      this.db.session.findMany({ where: { userId } }),
    ])

    return {
      profile,
      organizations,
      repositories: repositories.map(r => ({
        name: r.name,
        url: r.url,
        createdAt: r.createdAt,
      })),
      auditLogs: auditLogs.map(log => ({
        action: log.action,
        timestamp: log.createdAt,
        ipAddress: log.ipAddress,
      })),
      apiKeys: apiKeys.map(k => ({
        name: k.name,
        createdAt: k.createdAt,
        lastUsedAt: k.lastUsedAt,
      })),
      sessions: sessions.map(s => ({
        createdAt: s.createdAt,
        ipAddress: s.ipAddress,
        userAgent: s.userAgent,
      })),
      totalRecords:
        1 + // profile
        organizations.length +
        repositories.length +
        auditLogs.length +
        apiKeys.length +
        sessions.length,
    }
  }
}

// Background job: Data erasure request
@Processor('data-erasure-request')
export class DataErasureRequestProcessor {

  @Process()
  async handleDataErasureRequest(job: Job<{ requestId: string }>) {
    const request = await this.db.dataSubjectRequest.findUnique({
      where: { id: job.data.requestId },
      include: { user: true },
    })

    // Check if erasure is allowed (no active contracts, etc.)
    const canErase = await this.validateErasureEligibility(request.userId)

    if (!canErase.eligible) {
      await this.db.dataSubjectRequest.update({
        where: { id: request.id },
        data: {
          status: 'DENIED',
          denialReason: canErase.reason,
          completedAt: new Date(),
        },
      })

      await this.emailService.send({
        to: request.user.email,
        subject: 'Data erasure request denied',
        template: 'erasure-denied',
        data: { reason: canErase.reason },
      })

      return
    }

    // Perform deletion
    await this.performDataErasure(request.userId)

    // Update request
    await this.db.dataSubjectRequest.update({
      where: { id: request.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    })

    // Send confirmation
    await this.emailService.send({
      to: request.user.email,
      subject: 'Your data has been deleted',
      template: 'erasure-completed',
    })
  }

  private async validateErasureEligibility(userId: string) {
    // Check if user has active subscriptions
    const activeSubscriptions = await this.db.subscription.count({
      where: {
        userId,
        status: 'ACTIVE',
      },
    })

    if (activeSubscriptions > 0) {
      return {
        eligible: false,
        reason: 'You have active subscriptions. Please cancel them first.',
      }
    }

    // Check if user owes money
    const unpaidInvoices = await this.db.invoice.count({
      where: {
        userId,
        status: 'UNPAID',
      },
    })

    if (unpaidInvoices > 0) {
      return {
        eligible: false,
        reason: 'You have unpaid invoices. Please settle them first.',
      }
    }

    return { eligible: true }
  }

  private async performDataErasure(userId: string) {
    // Soft delete user (required for audit trail)
    await this.db.user.update({
      where: { id: userId },
      data: {
        email: `deleted-${userId}@deleted.local`,
        name: 'Deleted User',
        deletedAt: new Date(),
        // Keep audit logs for compliance (7 years)
      },
    })

    // Delete associated data
    await Promise.all([
      this.db.apiKey.deleteMany({ where: { userId } }),
      this.db.session.deleteMany({ where: { userId } }),
      this.db.userConsent.deleteMany({ where: { userId } }),
      // Note: Keep audit logs for legal reasons
    ])

    // Log deletion for compliance
    await this.db.auditLog.create({
      data: {
        userId,
        action: 'user.erased',
        metadata: {
          reason: 'GDPR Article 17 request',
          timestamp: new Date(),
        },
      },
    })
  }
}
```

### 4. Consent Management (GDPR)

**Decision**: Track user consent for data processing with lawful basis.

**Implementation**:

```tsx
// apps/portal/components/cookie-consent-banner.tsx

export function CookieConsentBanner() {
  const [showBanner, setShowBanner] = useState(false)
  const { mutate: recordConsent } = useRecordConsent()

  useEffect(() => {
    // Check if user has already given consent
    const hasConsent = localStorage.getItem('cookie-consent')
    if (!hasConsent) {
      setShowBanner(true)
    }
  }, [])

  const handleAcceptAll = async () => {
    await recordConsent({
      purposes: ['NECESSARY', 'FUNCTIONAL', 'ANALYTICS', 'MARKETING'],
      granted: true,
    })
    localStorage.setItem('cookie-consent', 'all')
    setShowBanner(false)
  }

  const handleRejectAll = async () => {
    await recordConsent({
      purposes: ['NECESSARY'],
      granted: true,
    })
    await recordConsent({
      purposes: ['FUNCTIONAL', 'ANALYTICS', 'MARKETING'],
      granted: false,
    })
    localStorage.setItem('cookie-consent', 'necessary-only')
    setShowBanner(false)
  }

  if (!showBanner) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-6 z-50">
      <div className="max-w-6xl mx-auto">
        <h3 className="text-lg font-semibold mb-2">Cookie Preferences</h3>
        <p className="text-sm text-slate-600 mb-4">
          We use cookies to improve your experience, analyze usage, and personalize content.
          You can choose which cookies to accept.
        </p>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="border rounded p-3">
            <div className="flex items-center justify-between mb-1">
              <p className="font-semibold text-sm">Necessary Cookies</p>
              <Badge>Required</Badge>
            </div>
            <p className="text-xs text-slate-600">
              Essential for the website to function (authentication, security).
            </p>
          </div>

          <div className="border rounded p-3">
            <div className="flex items-center justify-between mb-1">
              <p className="font-semibold text-sm">Analytics Cookies</p>
              <Toggle defaultChecked />
            </div>
            <p className="text-xs text-slate-600">
              Help us understand how you use the website (Google Analytics).
            </p>
          </div>

          <div className="border rounded p-3">
            <div className="flex items-center justify-between mb-1">
              <p className="font-semibold text-sm">Functional Cookies</p>
              <Toggle defaultChecked />
            </div>
            <p className="text-xs text-slate-600">
              Remember your preferences and settings.
            </p>
          </div>

          <div className="border rounded p-3">
            <div className="flex items-center justify-between mb-1">
              <p className="font-semibold text-sm">Marketing Cookies</p>
              <Toggle defaultChecked />
            </div>
            <p className="text-xs text-slate-600">
              Show you relevant ads and measure campaign effectiveness.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <Button onClick={handleAcceptAll}>
            Accept All
          </Button>
          <Button variant="outline" onClick={handleRejectAll}>
            Necessary Only
          </Button>
          <Button variant="ghost" onClick={() => setShowCustomize(true)}>
            Customize
          </Button>
        </div>
      </div>
    </div>
  )
}

// Consent API
@Controller('api/v1/compliance/consent')
export class ConsentController {

  @Post()
  async recordConsent(
    @CurrentUser() user: User,
    @Body() dto: RecordConsentDto,
    @Req() req: Request
  ) {
    const consents = dto.purposes.map((purpose) => ({
      userId: user.id,
      purpose,
      lawfulBasis: purpose === 'NECESSARY' ? 'CONTRACT' : 'CONSENT',
      granted: dto.granted,
      grantedAt: new Date(),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      consentText: this.getConsentText(purpose, dto.granted),
    }))

    await this.db.userConsent.createMany({ data: consents })

    return { success: true }
  }

  @Get('history')
  async getConsentHistory(@CurrentUser() user: User) {
    return await this.db.userConsent.findMany({
      where: { userId: user.id },
      orderBy: { grantedAt: 'desc' },
    })
  }

  @Delete(':purpose')
  async withdrawConsent(@CurrentUser() user: User, @Param('purpose') purpose: string) {
    await this.db.userConsent.create({
      data: {
        userId: user.id,
        purpose: purpose as ConsentPurpose,
        lawfulBasis: 'CONSENT',
        granted: false,
        withdrawnAt: new Date(),
      },
    })

    return { success: true }
  }
}
```

## Consequences

### Positive

1. **Multi-Framework Support**:
   - Single control can satisfy multiple frameworks (80% overlap)
   - Reduces audit preparation time from 6 weeks to 2 weeks
   - Evidence automatically collected for 20+ controls

2. **Continuous Compliance**:
   - Real-time monitoring detects control drift
   - Proactive alerts prevent compliance violations
   - Automated evidence collection reduces manual work by 90%

3. **Data Subject Rights**:
   - GDPR/CCPA compliance built-in
   - 30-day response time automated
   - Full audit trail for compliance

4. **Competitive Advantage**:
   - Faster time-to-certification (3-6 months vs 12 months)
   - Lower audit costs ($50K vs $150K)
   - Enables selling to regulated industries (healthcare, finance, government)

### Negative

1. **Complexity**:
   - 7 new database models
   - 20+ evidence collectors to maintain
   - Framework-specific logic (HIPAA BAA, GDPR consent)

2. **Maintenance Burden**:
   - Compliance frameworks change (GDPR updates, new ISO versions)
   - Evidence collectors need updates
   - Control mappings need periodic review

3. **Storage Costs**:
   - Evidence retention (1-7 years depending on framework)
   - Audit logs (10-year retention for some customers)
   - Data exports (GDPR: up to 100GB per user)

### Mitigations

1. **Complexity**:
   - **Action**: Comprehensive compliance documentation
   - **Training**: Quarterly compliance training for eng team
   - **Experts**: Hire compliance engineer (Year 2)

2. **Maintenance**:
   - **Action**: Subscribe to framework update notifications
   - **Process**: Quarterly compliance review meetings
   - **Testing**: Automated tests for evidence collectors

3. **Storage**:
   - **Action**: S3 lifecycle policies (transition to Glacier after 1 year)
   - **Optimization**: Compress evidence files (gzip)
   - **Budget**: $5K/month for compliance storage

## Metrics & Success Criteria

### Certification Speed
- **SOC 2**: 6 months (vs 12 months manual)
- **HIPAA**: 4 months (vs 8 months manual)
- **ISO 27001**: 9 months (vs 18 months manual)

### Audit Preparation
- **Evidence Collection**: < 2 weeks (vs 6 weeks manual)
- **Audit Package Generation**: < 1 hour (vs 40 hours manual)
- **Control Compliance Rate**: > 95%

### Data Subject Rights
- **Access Request Response**: < 7 days (GDPR allows 30)
- **Erasure Request Response**: < 14 days
- **Request Completion Rate**: > 99%

### Cost Savings
- **Audit Cost Reduction**: 50% ($75K vs $150K for SOC 2)
- **Compliance FTE Savings**: 1.5 FTE ($200K/year)
- **Evidence Collection Automation**: 90% time savings

## References

### Compliance Frameworks
- [SOC 2 Trust Services Criteria](https://www.aicpa.org/interestareas/frc/assuranceadvisoryservices/aicpasoc2report)
- [HIPAA Security Rule](https://www.hhs.gov/hipaa/for-professionals/security/index.html)
- [ISO 27001:2022 Standard](https://www.iso.org/standard/27001)
- [GDPR Official Text](https://gdpr-info.eu/)
- [FedRAMP Requirements](https://www.fedramp.gov/)
- [NIST 800-53 Controls](https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final)

### Best Practices
- [Automated Compliance Best Practices](https://www.vanta.com/resources/automated-compliance)
- [GDPR Compliance Checklist](https://gdpr.eu/checklist/)
- [Data Subject Rights Implementation](https://iapp.org/resources/article/how-to-handle-data-subject-requests/)

### Internal References
- ADR-002: Tenant Isolation Strategy
- ADR-019: Enterprise Customer Management
- ADR-020: Super Admin Portal
- [Security & Compliance](/docs/technical/security-compliance.md)

## Review Date
April 2026 (3 months)

---

**Document Version**: 1.0
**Last Updated**: 2026-01-20
**Authors**: Engineering, Product & Compliance Team
**Approved By**: CTO, Chief Compliance Officer, General Counsel
