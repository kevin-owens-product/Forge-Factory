# ADR-030: Project Governance, Compliance & Quality Gates

## Status
Accepted

## Context

With hundreds of transformation projects across multiple organizations, we need robust governance and compliance controls to ensure projects meet quality standards, comply with regulations (GDPR, SOC2, HIPAA), and maintain security posture. This requires automated quality gates, compliance checks, and governance workflows that scale to enterprise requirements.

### Requirements

**Governance Requirements:**
- Project approval workflows
- Budget tracking and limits
- Resource allocation approval
- Change management processes
- Audit trails for all actions
- Role-based access control (RBAC)

**Compliance Requirements:**
- Support multiple compliance frameworks (GDPR, SOC2, HIPAA, ISO27001)
- Automated compliance scanning
- Data residency requirements
- Encryption at rest and in transit
- Audit logging (immutable, 7-year retention)
- Right to be forgotten (GDPR)
- Data access tracking

**Quality Gates:**
- Code quality thresholds
- Security scanning (SAST, DAST, SCA)
- Test coverage requirements
- Performance benchmarks
- Accessibility compliance
- Breaking change detection

**Scale Requirements:**
- Support 1000+ projects under governance
- Process 100K+ audit events per day
- Real-time compliance monitoring
- Multi-tenant compliance isolation

### Current Challenges

1. **No Governance Framework:** Projects created without oversight
2. **Manual Compliance:** Compliance checks done manually
3. **No Quality Standards:** Inconsistent quality across projects
4. **Audit Gaps:** Incomplete audit trails
5. **Regulatory Risk:** Non-compliance could result in fines

## Decision

We will implement a **Multi-Layered Governance Framework** with **Automated Quality Gates**, **Continuous Compliance Monitoring**, and **Immutable Audit Logging**.

### Governance Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  Governance Layer                            │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Approval   │  │    Budget    │  │     RBAC     │      │
│  │   Workflows  │  │   Controls   │  │   Policies   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                  Compliance Layer                            │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │     GDPR     │  │    SOC2      │  │    HIPAA     │      │
│  │   Controls   │  │   Controls   │  │   Controls   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   Quality Gates                              │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Security   │  │   Quality    │  │ Performance  │      │
│  │   Scanning   │  │   Metrics    │  │  Benchmarks  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### Database Schema

```prisma
// Governance & Compliance Schema

model GovernancePolicy {
  id                String   @id @default(cuid())
  organizationId    String?  // Null = platform-wide
  organization      Organization? @relation(fields: [organizationId], references: [id])

  name              String
  description       String
  type              PolicyType

  // Policy definition
  rules             Json     // Policy rules in JSON
  enforcementLevel  EnforcementLevel

  // Applicability
  appliesTo         Json     // Project filters

  status            PolicyStatus @default(ACTIVE)

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  createdBy         String

  violations        PolicyViolation[]

  @@index([organizationId, type, status])
}

enum PolicyType {
  APPROVAL_WORKFLOW    // Require approvals
  BUDGET_CONTROL       // Budget limits
  SECURITY_BASELINE    // Security requirements
  QUALITY_GATE         // Quality thresholds
  COMPLIANCE_RULE      // Regulatory compliance
  RESOURCE_QUOTA       // Resource limits
}

enum EnforcementLevel {
  ADVISORY        // Warn only
  BLOCKING        // Block action
  ENFORCED        // Automatically enforce
}

enum PolicyStatus {
  DRAFT
  ACTIVE
  DEPRECATED
}

model PolicyViolation {
  id                String   @id @default(cuid())
  policyId          String
  policy            GovernancePolicy @relation(fields: [policyId], references: [id])

  projectId         String
  project           TransformationProject @relation(fields: [projectId], references: [id])

  // Violation details
  severity          ViolationSeverity
  description       String
  detectedAt        DateTime @default(now())

  // Resolution
  status            ViolationStatus @default(OPEN)
  resolvedAt        DateTime?
  resolvedBy        String?
  resolution        String?  @db.Text

  // Metadata
  metadata          Json?

  @@index([projectId, status])
  @@index([policyId, status])
  @@index([severity, status])
}

enum ViolationSeverity {
  INFO
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

enum ViolationStatus {
  OPEN
  ACKNOWLEDGED
  IN_PROGRESS
  RESOLVED
  ACCEPTED_RISK
  FALSE_POSITIVE
}

model ComplianceFramework {
  id                String   @id @default(cuid())
  name              String   @unique // GDPR, SOC2, HIPAA, ISO27001
  version           String
  description       String

  controls          ComplianceControl[]

  organizationCompliance OrganizationCompliance[]

  createdAt         DateTime @default(now())
}

model ComplianceControl {
  id                String   @id @default(cuid())
  frameworkId       String
  framework         ComplianceFramework @relation(fields: [frameworkId], references: [id])

  controlId         String   // e.g., "GDPR-7.1", "SOC2-CC6.1"
  name              String
  description       String   @db.Text
  category          String

  // Implementation
  automatedCheck    Boolean  @default(false)
  checkScript       String?  @db.Text
  checkFrequency    String?  // Cron expression

  // Evidence
  evidenceRequired  String[] // Types of evidence needed

  assessments       ComplianceAssessment[]

  @@unique([frameworkId, controlId])
  @@index([frameworkId, category])
}

model OrganizationCompliance {
  id                String   @id @default(cuid())
  organizationId    String   @unique
  organization      Organization @relation(fields: [organizationId], references: [id])

  frameworkId       String
  framework         ComplianceFramework @relation(fields: [frameworkId], references: [id])

  // Configuration
  enabled           Boolean  @default(true)
  dataResidency     String[] // Allowed regions
  encryptionRequired Boolean @default(true)

  // Status
  overallStatus     ComplianceStatus
  lastAssessmentDate DateTime?

  assessments       ComplianceAssessment[]

  @@index([frameworkId, overallStatus])
}

enum ComplianceStatus {
  COMPLIANT
  PARTIAL
  NON_COMPLIANT
  NOT_ASSESSED
}

model ComplianceAssessment {
  id                String   @id @default(cuid())
  organizationComplianceId String
  orgCompliance     OrganizationCompliance @relation(fields: [organizationComplianceId], references: [id])

  controlId         String
  control           ComplianceControl @relation(fields: [controlId], references: [id])

  projectId         String?  // Null for org-wide
  project           TransformationProject? @relation(fields: [projectId], references: [id])

  // Assessment
  status            ComplianceStatus
  assessedAt        DateTime @default(now())
  assessedBy        String

  findings          String?  @db.Text
  evidence          Json?    // Links to evidence
  gaps              String[] // Identified gaps

  // Remediation
  remediationRequired Boolean @default(false)
  remediationPlan   String?  @db.Text
  remediationDueDate DateTime?

  @@index([organizationComplianceId, status])
  @@index([controlId, status])
}

model QualityGate {
  id                String   @id @default(cuid())
  name              String
  description       String

  organizationId    String?  // Null = platform default
  organization      Organization? @relation(fields: [organizationId], references: [id])

  // Gate definition
  type              QualityGateType
  threshold         Json     // Threshold configuration

  blocking          Boolean  @default(true)
  enabled           Boolean  @default(true)

  // Applicability
  lifecycle         ProjectStatus[] // Which lifecycle stages

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  evaluations       QualityGateEvaluation[]

  @@index([organizationId, type])
}

enum QualityGateType {
  CODE_COVERAGE       // Min test coverage %
  SECURITY_SCAN       // Max vulnerabilities
  CODE_QUALITY        // SonarQube score
  PERFORMANCE         // Load test results
  ACCESSIBILITY       // WCAG compliance
  BUNDLE_SIZE         // Max bundle size
  BREAKING_CHANGES    // No breaking changes
  DEPENDENCY_AUDIT    // No vulnerable dependencies
}

model QualityGateEvaluation {
  id                String   @id @default(cuid())
  gateId            String
  gate              QualityGate @relation(fields: [gateId], references: [id])

  projectId         String
  project           TransformationProject @relation(fields: [projectId], references: [id])

  // Evaluation
  passed            Boolean
  score             Float?
  threshold         Float?

  // Context
  triggeredBy       String   // deployment, commit, manual
  evaluatedAt       DateTime @default(now())

  // Results
  results           Json     // Detailed results
  recommendations   String[] // Improvement suggestions

  @@index([projectId, evaluatedAt])
  @@index([gateId, passed])
}

// Audit Logging (Immutable)
model AuditLog {
  id                String   @id @default(cuid())

  // Actor
  userId            String?
  serviceAccountId  String?
  ipAddress         String
  userAgent         String?

  // Target
  organizationId    String?
  projectId         String?

  // Action
  action            String   // e.g., "project.created", "user.deleted"
  resource          String   // Resource type
  resourceId        String   // Resource ID

  // Details
  changes           Json?    // Before/after for updates
  metadata          Json?    // Additional context

  // Outcome
  success           Boolean
  errorMessage      String?

  // Timestamp
  timestamp         DateTime @default(now())

  // Immutability
  checksum          String   // SHA-256 of log entry

  @@index([organizationId, timestamp])
  @@index([projectId, timestamp])
  @@index([userId, timestamp])
  @@index([action, timestamp])
  @@index([timestamp]) // For retention cleanup
}
```

### Quality Gate Implementation

```typescript
// apps/core/src/lib/services/quality-gates/

class QualityGateService {
  async evaluateGates(projectId: string, context: GateContext): Promise<GateResults> {
    const project = await db.transformationProject.findUnique({
      where: { id: projectId },
    });

    // Get applicable quality gates
    const gates = await this.getApplicableGates(project);

    // Evaluate all gates
    const results = await Promise.all(
      gates.map((gate) => this.evaluateGate(gate, project, context))
    );

    // Check for blocking failures
    const blockingFailures = results.filter((r) => !r.passed && r.gate.blocking);

    const overall = {
      passed: blockingFailures.length === 0,
      total: results.length,
      passed_count: results.filter((r) => r.passed).length,
      failed_count: results.filter((r) => !r.passed).length,
      blocking_failures: blockingFailures.length,
      results,
    };

    return overall;
  }

  private async evaluateGate(
    gate: QualityGate,
    project: TransformationProject,
    context: GateContext
  ): Promise<GateEvaluationResult> {
    const evaluators = {
      [QualityGateType.CODE_COVERAGE]: () => this.evaluateCodeCoverage(project, gate),
      [QualityGateType.SECURITY_SCAN]: () => this.evaluateSecurityScan(project, gate),
      [QualityGateType.CODE_QUALITY]: () => this.evaluateCodeQuality(project, gate),
      [QualityGateType.PERFORMANCE]: () => this.evaluatePerformance(project, gate),
      [QualityGateType.BUNDLE_SIZE]: () => this.evaluateBundleSize(project, gate),
      [QualityGateType.DEPENDENCY_AUDIT]: () => this.evaluateDependencies(project, gate),
    };

    const evaluator = evaluators[gate.type];
    if (!evaluator) {
      throw new Error(`No evaluator for gate type: ${gate.type}`);
    }

    const result = await evaluator();

    // Store evaluation
    await db.qualityGateEvaluation.create({
      data: {
        gateId: gate.id,
        projectId: project.id,
        passed: result.passed,
        score: result.score,
        threshold: gate.threshold.value,
        triggeredBy: context.triggeredBy,
        results: result.details,
        recommendations: result.recommendations,
      },
    });

    return {
      gate,
      ...result,
    };
  }

  private async evaluateCodeCoverage(
    project: TransformationProject,
    gate: QualityGate
  ): Promise<EvaluationResult> {
    // Read coverage report from project
    const coverage = await this.readCoverageReport(project);

    const threshold = gate.threshold.minimum_coverage; // e.g., 80
    const passed = coverage.overall >= threshold;

    return {
      passed,
      score: coverage.overall,
      details: {
        overall: coverage.overall,
        statements: coverage.statements,
        branches: coverage.branches,
        functions: coverage.functions,
        lines: coverage.lines,
      },
      recommendations: passed
        ? []
        : [
            `Increase test coverage from ${coverage.overall}% to ${threshold}%`,
            `Focus on uncovered branches (${coverage.branches}%)`,
          ],
    };
  }

  private async evaluateSecurityScan(
    project: TransformationProject,
    gate: QualityGate
  ): Promise<EvaluationResult> {
    const vulnerabilities = await db.securityVulnerability.findMany({
      where: {
        dependency: {
          projectId: project.id,
        },
        status: VulnerabilityStatus.OPEN,
      },
    });

    const critical = vulnerabilities.filter(
      (v) => v.severity === VulnerabilitySeverity.CRITICAL
    ).length;
    const high = vulnerabilities.filter(
      (v) => v.severity === VulnerabilitySeverity.HIGH
    ).length;

    const maxCritical = gate.threshold.max_critical || 0;
    const maxHigh = gate.threshold.max_high || 0;

    const passed = critical <= maxCritical && high <= maxHigh;

    return {
      passed,
      score: passed ? 100 : Math.max(0, 100 - critical * 50 - high * 10),
      details: {
        critical,
        high,
        total: vulnerabilities.length,
      },
      recommendations: passed
        ? []
        : [
            `Fix ${critical} critical vulnerabilities`,
            `Fix ${high} high severity vulnerabilities`,
            'Run npm audit fix or update vulnerable dependencies',
          ],
    };
  }

  private async evaluateCodeQuality(
    project: TransformationProject,
    gate: QualityGate
  ): Promise<EvaluationResult> {
    // Integrate with SonarQube or similar
    const analysis = await this.runStaticAnalysis(project);

    const threshold = gate.threshold.min_quality_score || 80;
    const passed = analysis.score >= threshold;

    return {
      passed,
      score: analysis.score,
      details: {
        bugs: analysis.bugs,
        vulnerabilities: analysis.vulnerabilities,
        code_smells: analysis.codeSmells,
        technical_debt: analysis.technicalDebt,
      },
      recommendations: passed
        ? []
        : [
            `Fix ${analysis.bugs} bugs`,
            `Resolve ${analysis.codeSmells} code smells`,
            `Reduce technical debt: ${analysis.technicalDebt}`,
          ],
    };
  }
}

interface GateContext {
  triggeredBy: string; // deployment, commit, manual
  commitSha?: string;
  deploymentId?: string;
}

interface GateEvaluationResult {
  gate: QualityGate;
  passed: boolean;
  score?: number;
  details: any;
  recommendations: string[];
}
```

### Compliance Automation

```typescript
// apps/core/src/lib/services/compliance/

class ComplianceMonitor {
  async runComplianceCheck(
    organizationId: string,
    frameworkId: string
  ): Promise<ComplianceReport> {
    const orgCompliance = await db.organizationCompliance.findUnique({
      where: {
        organizationId_frameworkId: {
          organizationId,
          frameworkId,
        },
      },
      include: {
        framework: {
          include: {
            controls: true,
          },
        },
      },
    });

    if (!orgCompliance) {
      throw new Error('Compliance framework not enabled for organization');
    }

    // Assess each control
    const assessments = await Promise.all(
      orgCompliance.framework.controls.map((control) =>
        this.assessControl(control, organizationId)
      )
    );

    const compliantCount = assessments.filter(
      (a) => a.status === ComplianceStatus.COMPLIANT
    ).length;
    const overallStatus =
      compliantCount === assessments.length
        ? ComplianceStatus.COMPLIANT
        : compliantCount > assessments.length / 2
        ? ComplianceStatus.PARTIAL
        : ComplianceStatus.NON_COMPLIANT;

    // Update organization compliance status
    await db.organizationCompliance.update({
      where: { id: orgCompliance.id },
      data: {
        overallStatus,
        lastAssessmentDate: new Date(),
      },
    });

    return {
      framework: orgCompliance.framework.name,
      status: overallStatus,
      controlsAssessed: assessments.length,
      compliant: compliantCount,
      nonCompliant: assessments.length - compliantCount,
      assessments,
    };
  }

  private async assessControl(
    control: ComplianceControl,
    organizationId: string
  ): Promise<ComplianceAssessment> {
    if (control.automatedCheck && control.checkScript) {
      // Run automated check
      const result = await this.runAutomatedCheck(control.checkScript, organizationId);

      return await db.complianceAssessment.create({
        data: {
          organizationComplianceId: organizationId,
          controlId: control.id,
          status: result.compliant
            ? ComplianceStatus.COMPLIANT
            : ComplianceStatus.NON_COMPLIANT,
          assessedBy: 'system',
          findings: result.findings,
          evidence: result.evidence,
          gaps: result.gaps,
          remediationRequired: !result.compliant,
          remediationPlan: result.remediationPlan,
        },
      });
    } else {
      // Manual assessment required
      return await db.complianceAssessment.create({
        data: {
          organizationComplianceId: organizationId,
          controlId: control.id,
          status: ComplianceStatus.NOT_ASSESSED,
          assessedBy: 'pending',
          findings: 'Manual assessment required',
        },
      });
    }
  }

  // GDPR-specific: Right to be forgotten
  async deleteUserData(userId: string, reason: string): Promise<void> {
    // 1. Audit the request
    await this.auditLog({
      action: 'gdpr.right_to_be_forgotten',
      userId,
      metadata: { reason },
    });

    // 2. Anonymize audit logs (keep for compliance, but anonymize PII)
    await db.auditLog.updateMany({
      where: { userId },
      data: {
        userId: '[DELETED]',
        ipAddress: '[REDACTED]',
        userAgent: '[REDACTED]',
      },
    });

    // 3. Delete user data
    await db.user.delete({
      where: { id: userId },
    });

    // 4. Record deletion certificate
    await db.deletionCertificate.create({
      data: {
        userId: '[DELETED]',
        deletedAt: new Date(),
        reason,
        verificationHash: await this.generateDeletionHash(userId),
      },
    });
  }
}
```

### Audit Logging

```typescript
// apps/core/src/lib/services/audit/

class AuditLogger {
  async log(entry: AuditLogEntry): Promise<void> {
    // Calculate checksum for immutability
    const checksum = this.calculateChecksum(entry);

    await db.auditLog.create({
      data: {
        ...entry,
        checksum,
        timestamp: new Date(),
      },
    });

    // Also send to immutable storage (e.g., AWS S3 with Object Lock)
    await this.archiveToImmutableStorage(entry, checksum);
  }

  private calculateChecksum(entry: AuditLogEntry): string {
    const data = JSON.stringify(entry);
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  async verifyIntegrity(logId: string): Promise<boolean> {
    const log = await db.auditLog.findUnique({
      where: { id: logId },
    });

    if (!log) return false;

    const recalculated = this.calculateChecksum({
      userId: log.userId,
      action: log.action,
      resource: log.resource,
      resourceId: log.resourceId,
      changes: log.changes,
      timestamp: log.timestamp,
    });

    return recalculated === log.checksum;
  }
}
```

## Consequences

### Positive

1. **Compliance:** Automated compliance monitoring
2. **Quality:** Consistent quality standards across projects
3. **Governance:** Clear approval and oversight processes
4. **Auditability:** Complete, immutable audit trail
5. **Risk Reduction:** Early detection of issues
6. **Regulatory:** Meet regulatory requirements

### Negative

1. **Overhead:** Quality gates slow down deployments
2. **Storage:** Audit logs consume significant storage
3. **Complexity:** Multiple compliance frameworks to manage
4. **False Positives:** Automated checks may have false positives

### Mitigations

1. **Tunable Gates:** Gates can be adjusted per project
2. **Retention Policies:** Archive old audit logs to cold storage
3. **Framework Mapping:** Map controls across frameworks
4. **Review Process:** Manual review for false positives

## Alternatives Considered

### Alternative 1: Manual Governance

**Rejected Because:**
- Doesn't scale
- Inconsistent enforcement
- Human error

### Alternative 2: Third-Party Compliance Tools

**Rejected Because:**
- Expensive at scale
- Limited customization
- Vendor lock-in

## References

- [GDPR](https://gdpr.eu/)
- [SOC 2](https://www.aicpa.org/interestareas/frc/assuranceadvisoryservices/sorhome.html)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)

## Review Date

2026-04-20 (3 months)
