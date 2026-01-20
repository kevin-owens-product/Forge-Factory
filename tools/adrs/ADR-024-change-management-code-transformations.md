# ADR-024: Change Management for Code Transformations

## Status
Proposed

## Context

Code transformations (AI-driven refactoring, modernization, quality improvements) are powerful but **high-risk operations** that modify production codebases at scale. Unlike manual code changes reviewed line-by-line, transformations can affect hundreds of files simultaneously.

### Current State Challenges

**Lack of Governance:**
- No approval workflow for large-scale transformations
- No visibility into who applied what transformation, when
- No rollback mechanism for failed transformations
- No impact assessment before applying changes

**Enterprise Requirements:**
Enterprise customers (see ADR-019) require:
- **Compliance**: SOC 2, ISO 27001 demand change approval workflows
- **Auditability**: Financial services need full audit trail (who, what, when, why)
- **Risk Management**: Healthcare/fintech cannot tolerate untested changes in production
- **Separation of Duties**: Developers propose, architects approve, ops deploy

### Risk Scenarios

1. **Junior Developer Applies Breaking Refactoring**:
   - Developer runs "Convert to TypeScript" on entire 500-file codebase
   - Build breaks, tests fail
   - No way to undo (Git history polluted with mass changes)
   - **Impact**: Production deployment blocked for 2 days

2. **Unauthorized Security Change**:
   - Developer applies "Update Deprecated Crypto" transformation
   - No security review
   - Introduces subtle encryption vulnerability
   - **Impact**: SOC 2 audit failure, customer data at risk

3. **No Change Tracking**:
   - Team applies 50 transformations over 6 months
   - No record of which transformations were applied
   - Can't correlate performance regression to specific change
   - **Impact**: Debugging nightmare, lost developer hours

### Industry Standards

Change management best practices from ITIL, COBIT:
- **Change Request**: All changes start with a request
- **Impact Assessment**: Risk, scope, affected systems
- **Approval Workflow**: Multi-level approval (developer → architect → ops)
- **Testing Gate**: All changes tested before production
- **Rollback Plan**: One-click undo for failed changes
- **Audit Trail**: Immutable log of all changes

### Target Users

1. **Enterprise Development Teams**:
   - 50-500 developers
   - Strict compliance requirements (SOC 2, HIPAA, ISO 27001)
   - Regulated industries (finance, healthcare, government)

2. **Platform Engineering Teams**:
   - Responsible for codebase health across 10-100 microservices
   - Need governance without blocking developer productivity

3. **Security Teams**:
   - Must approve all security-related transformations
   - Need visibility into potential vulnerabilities introduced

## Decision

Implement **Enterprise Change Management System** for code transformations with multi-level approval, impact assessment, testing gates, and full audit trail.

### Architecture Overview

```
┌────────────────────────────────────────────────────────────────┐
│           Change Management for Code Transformations           │
├────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Developer           Architect          Security      Ops       │
│  ┌──────────┐      ┌──────────┐      ┌──────────┐  ┌────────┐ │
│  │ Propose  │      │ Review   │      │ Security │  │ Deploy │ │
│  │ Change   │ ───► │ Impact   │ ───► │ Review   │─►│ to Prod│ │
│  │          │      │ Approve  │      │ Approve  │  │        │ │
│  └──────────┘      └──────────┘      └──────────┘  └────────┘ │
│       │                  │                 │            │       │
│       └──────────────────┴─────────────────┴────────────┘       │
│                            ▼                                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Change Request Workflow Engine               │  │
│  │                                                            │  │
│  │  States: DRAFT → PENDING → APPROVED → TESTING →          │  │
│  │          DEPLOYED → VERIFIED                              │  │
│  │                                                            │  │
│  │  Auto-transitions:                                        │  │
│  │  - TESTING → DEPLOYED (if tests pass)                    │  │
│  │  - DEPLOYED → ROLLBACK (if metrics degrade)              │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            ▼                                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   Approval Policies                        │  │
│  │                                                            │  │
│  │  Low Risk (< 10 files):                                   │  │
│  │    ✓ Auto-approve if tests pass                           │  │
│  │                                                            │  │
│  │  Medium Risk (10-50 files):                               │  │
│  │    ✓ Requires 1 architect approval                        │  │
│  │                                                            │  │
│  │  High Risk (> 50 files OR security-related):              │  │
│  │    ✓ Requires architect + security approval               │  │
│  │                                                            │  │
│  │  Critical (production, database migrations):              │  │
│  │    ✓ Requires architect + security + ops approval         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            ▼                                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                 Impact Assessment Engine                   │  │
│  │                                                            │  │
│  │  - Blast Radius: How many files/modules affected?         │  │
│  │  - Dependency Impact: Breaking API changes?               │  │
│  │  - Test Coverage: Are changed files tested?               │  │
│  │  - Risk Score: 0-100 (low to critical)                    │  │
│  │  - Rollback Plan: Automated undo strategy                 │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            ▼                                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   Testing Gate                             │  │
│  │                                                            │  │
│  │  Pre-merge checks:                                        │  │
│  │  ✓ Unit tests pass                                        │  │
│  │  ✓ Integration tests pass                                 │  │
│  │  ✓ Security scan (Semgrep, Snyk)                          │  │
│  │  ✓ Performance benchmarks (no regression)                 │  │
│  │  ✓ Build succeeds                                          │  │
│  │                                                            │  │
│  │  If any check fails → ROLLBACK                            │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            ▼                                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Audit Trail                             │  │
│  │                                                            │  │
│  │  Immutable log of:                                        │  │
│  │  - Who proposed the change                                │  │
│  │  - Who approved (or rejected)                             │  │
│  │  - Impact assessment results                              │  │
│  │  - Test results                                            │  │
│  │  - Deployment timestamp                                    │  │
│  │  - Rollback events                                         │  │
│  │  - Compliance snapshots (before/after code)               │  │
│  │                                                            │  │
│  │  Retention: 7 years (SOC 2, HIPAA compliance)             │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└────────────────────────────────────────────────────────────────┘
```

## Data Model

```typescript
/**
 * @prompt-id forge-v4.1:change-management:data-model:001
 * @generated-at 2026-01-20T00:00:00Z
 * @model claude-sonnet-4-5
 */

// Change Request = Proposal to apply a code transformation
model ChangeRequest {
  id                  String   @id @default(cuid())
  organizationId      String
  organization        Organization @relation(fields: [organizationId], references: [id])

  // What transformation is being applied
  transformationId    String
  transformation      Transformation @relation(fields: [transformationId], references: [id])
  repositoryId        String
  repository          Repository @relation(fields: [repositoryId], references: [id])

  // Who proposed
  proposedBy          String
  proposer            User @relation("ChangeProposer", fields: [proposedBy], references: [id])

  // Change metadata
  title               String           // "Migrate to React 19"
  description         String           // Markdown description
  rationale           String           // Why this change?
  targetBranch        String @default("main")

  // Impact assessment
  impactAssessment    Json             // { filesAffected: 47, riskScore: 65, ... }
  blastRadius         BlastRadius      // LOW, MEDIUM, HIGH, CRITICAL

  // State machine
  status              ChangeStatus     // DRAFT, PENDING, APPROVED, TESTING, DEPLOYED, VERIFIED, REJECTED, ROLLBACK

  // Approval workflow
  approvals           Approval[]
  requiredApprovers   Json             // { architect: true, security: false, ops: false }

  // Testing
  testRuns            TestRun[]
  ciPipelineUrl       String?

  // Deployment
  deployedAt          DateTime?
  deployedBy          String?
  deployer            User? @relation("ChangeDeployer", fields: [deployedBy], references: [id])

  // Rollback
  rollbackPlan        Json             // { strategy: "git-revert", commitSha: "abc123" }
  rolledBackAt        DateTime?
  rolledBackBy        String?
  rollbackReason      String?

  // Audit trail
  auditEvents         AuditEvent[]

  // Metadata
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  @@index([organizationId])
  @@index([repositoryId])
  @@index([status])
  @@index([proposedBy])
}

enum ChangeStatus {
  DRAFT              // Being prepared by proposer
  PENDING            // Awaiting approval
  APPROVED           // Approved, ready for testing
  TESTING            // CI pipeline running
  DEPLOYED           // Merged to target branch
  VERIFIED           // Post-deployment verification passed
  REJECTED           // Approval rejected
  ROLLBACK           // Change rolled back due to issues
}

enum BlastRadius {
  LOW                // < 10 files, no breaking changes
  MEDIUM             // 10-50 files, minor breaking changes
  HIGH               // > 50 files, major breaking changes
  CRITICAL           // Production data, database migrations, security
}

// Approval from architect, security, ops
model Approval {
  id                  String   @id @default(cuid())
  changeRequestId     String
  changeRequest       ChangeRequest @relation(fields: [changeRequestId], references: [id])

  // Who approved
  approverId          String
  approver            User @relation(fields: [approverId], references: [id])
  approverRole        ApproverRole     // ARCHITECT, SECURITY, OPS, PRODUCT

  // Approval decision
  decision            ApprovalDecision // APPROVED, REJECTED, REQUEST_CHANGES
  comments            String?          // Feedback

  // Timestamp
  createdAt           DateTime @default(now())

  @@index([changeRequestId])
  @@index([approverId])
  @@unique([changeRequestId, approverRole])
}

enum ApproverRole {
  ARCHITECT          // Technical architecture review
  SECURITY           // Security review (for security-related changes)
  OPS                // Operations review (for deployment risk)
  PRODUCT            // Product review (for feature changes)
}

enum ApprovalDecision {
  APPROVED           // Change approved
  REJECTED           // Change rejected (blocked)
  REQUEST_CHANGES    // Requires modifications before approval
}

// Test run for a change request
model TestRun {
  id                  String   @id @default(cuid())
  changeRequestId     String
  changeRequest       ChangeRequest @relation(fields: [changeRequestId], references: [id])

  // Test metadata
  type                TestType         // UNIT, INTEGRATION, E2E, SECURITY, PERFORMANCE
  status              TestStatus       // PENDING, RUNNING, PASSED, FAILED

  // Results
  testsTotal          Int
  testsPassed         Int
  testsFailed         Int
  coverage            Float?           // 0-100

  // Performance benchmarks
  performanceBaseline Json?            // Before transformation
  performanceCurrent  Json?            // After transformation
  performanceRegression Boolean @default(false)

  // CI pipeline
  ciPipelineUrl       String?
  ciJobId             String?

  // Logs
  logs                String?          // Test output

  // Timestamps
  startedAt           DateTime
  completedAt         DateTime?

  @@index([changeRequestId])
}

enum TestType {
  UNIT
  INTEGRATION
  E2E
  SECURITY
  PERFORMANCE
}

enum TestStatus {
  PENDING
  RUNNING
  PASSED
  FAILED
  SKIPPED
}

// Audit event for compliance
model AuditEvent {
  id                  String   @id @default(cuid())
  changeRequestId     String
  changeRequest       ChangeRequest @relation(fields: [changeRequestId], references: [id])

  // Event metadata
  event               AuditEventType
  userId              String?
  user                User? @relation(fields: [userId], references: [id])

  // Event details
  metadata            Json             // Event-specific data
  ipAddress           String?
  userAgent           String?

  // Timestamp
  createdAt           DateTime @default(now())

  @@index([changeRequestId])
  @@index([event])
  @@index([createdAt])
}

enum AuditEventType {
  CHANGE_CREATED
  CHANGE_UPDATED
  APPROVAL_REQUESTED
  APPROVAL_GRANTED
  APPROVAL_REJECTED
  TESTING_STARTED
  TESTING_COMPLETED
  DEPLOYMENT_STARTED
  DEPLOYMENT_COMPLETED
  ROLLBACK_STARTED
  ROLLBACK_COMPLETED
  COMMENT_ADDED
}
```

## Implementation

### 1. Change Request Creation

```typescript
// apps/api/src/modules/change-management/change-request.controller.ts

@Controller('api/v1/change-requests')
export class ChangeRequestController {

  @Post()
  async createChangeRequest(@Body() dto: CreateChangeRequestDto) {
    // 1. Analyze impact
    const impactAssessment = await this.analyzeImpact({
      transformationId: dto.transformationId,
      repositoryId: dto.repositoryId,
    })

    // 2. Determine blast radius
    const blastRadius = this.calculateBlastRadius(impactAssessment)

    // 3. Determine required approvers
    const requiredApprovers = this.getRequiredApprovers(blastRadius, dto.transformationId)

    // 4. Create change request
    const changeRequest = await this.db.changeRequest.create({
      data: {
        organizationId: dto.organizationId,
        transformationId: dto.transformationId,
        repositoryId: dto.repositoryId,
        proposedBy: dto.userId,
        title: dto.title,
        description: dto.description,
        rationale: dto.rationale,
        impactAssessment,
        blastRadius,
        requiredApprovers,
        status: 'DRAFT',
      },
    })

    // 5. Audit log
    await this.auditLog.log({
      event: 'CHANGE_CREATED',
      changeRequestId: changeRequest.id,
      userId: dto.userId,
      metadata: { impactAssessment, blastRadius },
    })

    return changeRequest
  }

  @Post(':id/submit')
  async submitForApproval(@Param('id') id: string, @User() user: User) {
    const changeRequest = await this.db.changeRequest.findUniqueOrThrow({
      where: { id },
    })

    // Transition: DRAFT → PENDING
    await this.db.changeRequest.update({
      where: { id },
      data: { status: 'PENDING' },
    })

    // Send approval requests
    await this.notificationService.sendApprovalRequests(changeRequest)

    await this.auditLog.log({
      event: 'APPROVAL_REQUESTED',
      changeRequestId: id,
      userId: user.id,
    })

    return changeRequest
  }
}
```

### 2. Impact Assessment

```typescript
// Impact analysis before applying transformation

class ImpactAssessmentService {
  async analyzeImpact({ transformationId, repositoryId }: {
    transformationId: string
    repositoryId: string
  }) {
    const transformation = await this.db.transformation.findUnique({
      where: { id: transformationId },
    })

    const repository = await this.db.repository.findUnique({
      where: { id: repositoryId },
      include: { files: true },
    })

    // Simulate transformation (dry-run)
    const dryRun = await this.transformationEngine.preview({
      transformation,
      repository,
    })

    return {
      // Files
      filesAffected: dryRun.filesChanged.length,
      linesAdded: dryRun.stats.linesAdded,
      linesDeleted: dryRun.stats.linesDeleted,
      filesCreated: dryRun.filesCreated.length,
      filesDeleted: dryRun.filesDeleted.length,

      // Dependencies
      breakingChanges: dryRun.breakingChanges,
      dependenciesAffected: dryRun.dependenciesAffected,

      // Testing
      testCoverage: await this.getTestCoverage(dryRun.filesChanged),
      untested: dryRun.filesChanged.filter(f => !this.isTested(f)),

      // Risk score (0-100)
      riskScore: this.calculateRiskScore({
        filesAffected: dryRun.filesChanged.length,
        breakingChanges: dryRun.breakingChanges.length,
        testCoverage: await this.getTestCoverage(dryRun.filesChanged),
      }),

      // Rollback
      rollbackPlan: {
        strategy: 'git-revert',
        commitSha: dryRun.baseCommit,
        automated: true,
      },
    }
  }

  calculateRiskScore({ filesAffected, breakingChanges, testCoverage }: {
    filesAffected: number
    breakingChanges: number
    testCoverage: number
  }): number {
    let score = 0

    // Files affected (0-40 points)
    if (filesAffected < 10) score += 10
    else if (filesAffected < 50) score += 25
    else score += 40

    // Breaking changes (0-30 points)
    score += Math.min(breakingChanges * 10, 30)

    // Test coverage (0-30 points, inverse)
    score += Math.max(0, 30 - testCoverage * 0.3)

    return Math.min(score, 100)
  }

  calculateBlastRadius(impact: ImpactAssessment): BlastRadius {
    if (impact.riskScore >= 80) return 'CRITICAL'
    if (impact.riskScore >= 60) return 'HIGH'
    if (impact.riskScore >= 30) return 'MEDIUM'
    return 'LOW'
  }
}
```

### 3. Approval Workflow

```typescript
// Approval policies

class ApprovalPolicyService {
  getRequiredApprovers(blastRadius: BlastRadius, transformationId: string) {
    const transformation = await this.db.transformation.findUnique({
      where: { id: transformationId },
    })

    const policy = {
      architect: false,
      security: false,
      ops: false,
    }

    // Low risk: auto-approve
    if (blastRadius === 'LOW') {
      return policy
    }

    // Medium risk: architect approval
    if (blastRadius === 'MEDIUM') {
      policy.architect = true
    }

    // High risk: architect + security
    if (blastRadius === 'HIGH') {
      policy.architect = true
      policy.security = true
    }

    // Critical: all approvers
    if (blastRadius === 'CRITICAL') {
      policy.architect = true
      policy.security = true
      policy.ops = true
    }

    // Security transformations always require security review
    if (transformation.category === 'SECURITY') {
      policy.security = true
    }

    return policy
  }

  async approve(changeRequestId: string, approverId: string, role: ApproverRole) {
    const approval = await this.db.approval.create({
      data: {
        changeRequestId,
        approverId,
        approverRole: role,
        decision: 'APPROVED',
      },
    })

    // Check if all required approvals received
    const changeRequest = await this.db.changeRequest.findUnique({
      where: { id: changeRequestId },
      include: { approvals: true },
    })

    const allApproved = this.checkAllApproved(changeRequest)

    if (allApproved) {
      // Transition: PENDING → APPROVED
      await this.db.changeRequest.update({
        where: { id: changeRequestId },
        data: { status: 'APPROVED' },
      })

      // Auto-start testing
      await this.testingService.startTests(changeRequestId)
    }

    return approval
  }
}
```

### 4. Testing Gate

```typescript
// Automated testing before deployment

class TestingGateService {
  async startTests(changeRequestId: string) {
    const changeRequest = await this.db.changeRequest.findUnique({
      where: { id: changeRequestId },
      include: { transformation: true, repository: true },
    })

    // Transition: APPROVED → TESTING
    await this.db.changeRequest.update({
      where: { id: changeRequestId },
      data: { status: 'TESTING' },
    })

    // Run test suite
    const testRun = await this.db.testRun.create({
      data: {
        changeRequestId,
        type: 'INTEGRATION',
        status: 'RUNNING',
        startedAt: new Date(),
      },
    })

    // Trigger CI pipeline
    const ciPipeline = await this.ciService.triggerPipeline({
      repository: changeRequest.repository,
      branch: `change-request/${changeRequestId}`,
      tests: ['unit', 'integration', 'security', 'performance'],
    })

    // Update test run with CI info
    await this.db.testRun.update({
      where: { id: testRun.id },
      data: {
        ciPipelineUrl: ciPipeline.url,
        ciJobId: ciPipeline.jobId,
      },
    })

    return testRun
  }

  async handleTestResults(testRunId: string, results: TestResults) {
    const testRun = await this.db.testRun.update({
      where: { id: testRunId },
      data: {
        status: results.passed ? 'PASSED' : 'FAILED',
        testsTotal: results.total,
        testsPassed: results.passed,
        testsFailed: results.failed,
        coverage: results.coverage,
        performanceCurrent: results.performance,
        performanceRegression: this.detectRegression(results.performance),
        completedAt: new Date(),
      },
      include: { changeRequest: true },
    })

    if (testRun.status === 'PASSED' && !testRun.performanceRegression) {
      // Transition: TESTING → DEPLOYED
      await this.deploymentService.deploy(testRun.changeRequest.id)
    } else {
      // Tests failed → notify proposer
      await this.notificationService.notifyTestFailure(testRun.changeRequest)
    }
  }
}
```

### 5. Deployment & Rollback

```typescript
// Deployment with automated rollback

class DeploymentService {
  async deploy(changeRequestId: string) {
    const changeRequest = await this.db.changeRequest.findUnique({
      where: { id: changeRequestId },
      include: { transformation: true, repository: true },
    })

    // Transition: TESTING → DEPLOYED
    await this.db.changeRequest.update({
      where: { id: changeRequestId },
      data: { status: 'DEPLOYED', deployedAt: new Date() },
    })

    // Apply transformation to repository
    await this.transformationEngine.apply({
      transformation: changeRequest.transformation,
      repository: changeRequest.repository,
      branch: changeRequest.targetBranch,
    })

    // Create Git commit
    const commit = await this.gitService.commit({
      message: `[Change Request #${changeRequestId}] ${changeRequest.title}`,
      files: changeRequest.transformation.affectedFiles,
    })

    // Update rollback plan with commit SHA
    await this.db.changeRequest.update({
      where: { id: changeRequestId },
      data: {
        rollbackPlan: {
          strategy: 'git-revert',
          commitSha: commit.sha,
          automated: true,
        },
      },
    })

    // Monitor metrics for 15 minutes
    await this.monitoringService.watchMetrics({
      changeRequestId,
      duration: 15 * 60 * 1000, // 15 minutes
      onRegression: () => this.rollback(changeRequestId, 'Metrics regression detected'),
    })
  }

  async rollback(changeRequestId: string, reason: string) {
    const changeRequest = await this.db.changeRequest.findUnique({
      where: { id: changeRequestId },
    })

    const rollbackPlan = changeRequest.rollbackPlan as any

    // Revert Git commit
    await this.gitService.revert(rollbackPlan.commitSha)

    // Transition: DEPLOYED → ROLLBACK
    await this.db.changeRequest.update({
      where: { id: changeRequestId },
      data: {
        status: 'ROLLBACK',
        rolledBackAt: new Date(),
        rollbackReason: reason,
      },
    })

    // Notify stakeholders
    await this.notificationService.notifyRollback(changeRequest, reason)

    // Audit log
    await this.auditLog.log({
      event: 'ROLLBACK_COMPLETED',
      changeRequestId,
      metadata: { reason, rollbackPlan },
    })
  }
}
```

## UI Components

### Change Request Dashboard

```tsx
// apps/admin/app/(tenant)/change-management/requests/page.tsx

export default async function ChangeRequestsPage() {
  const orgId = await getCurrentTenantId()
  const requests = await db.changeRequest.findMany({
    where: { organizationId: orgId },
    include: {
      proposer: true,
      approvals: { include: { approver: true } },
      testRuns: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Change Requests</h1>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending ({requests.filter(r => r.status === 'PENDING').length})</TabsTrigger>
          <TabsTrigger value="approved">Approved ({requests.filter(r => r.status === 'APPROVED').length})</TabsTrigger>
          <TabsTrigger value="deployed">Deployed ({requests.filter(r => r.status === 'DEPLOYED').length})</TabsTrigger>
          <TabsTrigger value="all">All ({requests.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <DataTable
            data={requests.filter(r => r.status === 'PENDING')}
            columns={[
              {
                key: 'title',
                label: 'Change Request',
                render: (row) => (
                  <div>
                    <p className="font-semibold">{row.title}</p>
                    <p className="text-sm text-slate-600">Proposed by {row.proposer.name}</p>
                  </div>
                ),
              },
              {
                key: 'blastRadius',
                label: 'Risk',
                render: (row) => <BlastRadiusBadge radius={row.blastRadius} />,
              },
              {
                key: 'approvals',
                label: 'Approvals',
                render: (row) => (
                  <div className="flex gap-1">
                    {row.requiredApprovers.architect && (
                      <ApprovalBadge
                        role="architect"
                        approved={row.approvals.some(a => a.approverRole === 'ARCHITECT' && a.decision === 'APPROVED')}
                      />
                    )}
                    {row.requiredApprovers.security && (
                      <ApprovalBadge
                        role="security"
                        approved={row.approvals.some(a => a.approverRole === 'SECURITY' && a.decision === 'APPROVED')}
                      />
                    )}
                    {row.requiredApprovers.ops && (
                      <ApprovalBadge
                        role="ops"
                        approved={row.approvals.some(a => a.approverRole === 'OPS' && a.decision === 'APPROVED')}
                      />
                    )}
                  </div>
                ),
              },
              {
                key: 'actions',
                label: '',
                render: (row) => (
                  <Button variant="ghost" onClick={() => viewDetails(row.id)}>
                    Review →
                  </Button>
                ),
              },
            ]}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

## Consequences

### Positive

1. **Compliance**: Meets SOC 2, ISO 27001, HIPAA requirements for change management
2. **Risk Reduction**: Impact assessment prevents catastrophic failures
3. **Auditability**: Full audit trail for all changes (required for financial services)
4. **Faster Rollback**: One-click rollback reduces MTTR (Mean Time To Recovery)
5. **Developer Confidence**: Developers can propose bold transformations knowing there's oversight

### Negative

1. **Slower Deployments**: Approval workflow adds 2-24 hours delay
2. **Approval Bottlenecks**: If architects are busy, changes pile up
3. **Complexity**: 4 new database models, complex state machine
4. **False Positives**: Low-risk changes may trigger unnecessary approvals

### Mitigations

1. **Auto-Approve Low Risk**: Changes affecting < 10 files auto-approved if tests pass
2. **Escalation**: If approver doesn't respond in 24h, auto-escalate to backup
3. **Bypass for Hotfixes**: Emergency bypass workflow (requires justification)
4. **Metrics**: Track approval wait time, optimize policies

## Metrics & Success Criteria

### Adoption
- **Target**: 100% of high-risk transformations go through change management
- **Approval Time**: < 4 hours median time from submission to approval
- **Auto-Approval Rate**: 60%+ of low-risk changes auto-approved

### Risk Reduction
- **Rollback Rate**: < 5% of changes rolled back
- **Production Incidents**: 80% reduction in transformation-related incidents
- **MTTR**: < 15 minutes to rollback failed change

### Compliance
- **Audit Readiness**: 100% of changes auditable
- **SOC 2 Compliance**: Pass all change management controls
- **Retention**: 7-year audit trail maintained

## References

- [ITIL Change Management](https://www.axelos.com/certifications/itil-service-management/itil-4-foundation)
- [SOC 2 Change Management Requirements](https://www.vanta.com/resources/soc-2-change-management)
- [GitHub Protected Branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- ADR-019: Enterprise Customer Management
- ADR-023: Version History & Time Travel UI

## Review Date
April 2026 (3 months)

---

**Document Version**: 1.0
**Last Updated**: 2026-01-20
**Authors**: Engineering & Compliance Team
**Approved By**: CTO, CISO, Head of Compliance
