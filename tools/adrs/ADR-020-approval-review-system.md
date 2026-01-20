# ADR-020: Approval & Review System

## Status
Accepted

## Context

With non-technical users (PMs, analysts) initiating refactoring via ADR-019, we need robust approval workflows to ensure:
- **Code Quality**: Technical changes reviewed by developers
- **Risk Mitigation**: High-risk changes require multiple approvals
- **Compliance**: Audit trail for all approvals (SOC 2, ISO 27001)
- **Flexibility**: Different approval requirements per organization

### Requirements
- **Multi-Step Approvals**: Support 1-5 approval steps
- **Role-Based**: Different approvers based on user role
- **Conditional**: Auto-approve low-risk, require approval for high-risk
- **Parallel vs. Sequential**: Support both approval flows
- **Delegation**: Approvers can delegate to others
- **Audit Trail**: Track every approval/rejection with timestamp

### Use Cases

**Case 1: PM-Initiated Refactoring (Requires Dev Approval)**
```
PM starts refactoring → Auto-analysis for risk
  → Low risk: Auto-approved
  → High risk: Requires Senior Dev approval → Deploy
```

**Case 2: Large-Scale Change (Multiple Approvals)**
```
Dev starts major refactoring → Tech Lead approval
  → CTO approval → Security team review → Deploy
```

**Case 3: Automated Refactoring (Auto-Approved)**
```
Analysis detects simple fixes → Auto-fix → Run tests
  → Tests pass: Auto-deploy → Tests fail: Rollback
```

## Decision

Implement **Flexible Approval Workflow Engine** with:

### 1. **Risk-Based Auto-Routing** (AI-Powered Classification)
### 2. **Configurable Approval Chains** (Per Organization)
### 3. **Parallel & Sequential Approvals**
### 4. **Time-Based Auto-Escalation**
### 5. **Audit & Compliance Tracking**

## Architecture

```typescript
┌─────────────────────────────────────────────────────────────┐
│              Approval Workflow Architecture                  │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Refactoring Request (PM/Dev)                                │
│           │                                                   │
│           ▼                                                   │
│  Risk Analysis (AI-Powered)                                  │
│  ┌──────────────────────────────────────────────┐           │
│  │ Analyze changes:                              │           │
│  │ - Files changed (1 vs. 100)                   │           │
│  │ - Complexity delta (small vs. large)          │           │
│  │ - Test coverage impact                        │           │
│  │ - Security implications                       │           │
│  │                                               │           │
│  │ Output: Risk Score (0-100)                    │           │
│  └──────────────────────────────────────────────┘           │
│           │                                                   │
│           ▼                                                   │
│  Route to Approval Workflow                                  │
│  ┌──────────────────────────────────────────────┐           │
│  │ Risk 0-30 (Low):      Auto-approved          │           │
│  │ Risk 31-70 (Medium):  1 approval required    │           │
│  │ Risk 71-100 (High):   2+ approvals required  │           │
│  └──────────────────────────────────────────────┘           │
│           │                                                   │
│           ▼                                                   │
│  Approval Chain (Configurable)                               │
│  ┌──────────────────────────────────────────────┐           │
│  │ Step 1: Tech Lead (required)                 │           │
│  │         [Approve] [Reject] [Request Changes] │           │
│  │           │                                   │           │
│  │           ▼                                   │           │
│  │ Step 2: Security Team (if security-related)  │           │
│  │         [Approve] [Reject]                    │           │
│  │           │                                   │           │
│  │           ▼                                   │           │
│  │ Step 3: CTO (if major change)                │           │
│  │         [Approve] [Reject]                    │           │
│  └──────────────────────────────────────────────┘           │
│           │                                                   │
│           ▼                                                   │
│  All Approvals Received → Deploy                             │
│                                                               │
│  If Rejected → Notify Requester → End                        │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Implementation

### 1. Risk Analysis (AI-Powered)

**Risk Scoring Algorithm**:
```typescript
// lib/risk-analyzer.ts
export async function analyzeRisk(refactoring: Refactoring): Promise<RiskScore> {
  const factors = {
    // File count (1-5 files = low, 50+ = high)
    fileCount: calculateFileCountRisk(refactoring.filesChanged),

    // Complexity delta (small improvement = low, major restructure = high)
    complexityDelta: calculateComplexityRisk(refactoring.complexityChange),

    // Test coverage impact (improved = low, reduced = high)
    testCoverage: calculateTestCoverageRisk(refactoring.coverageChange),

    // Security implications (cosmetic = low, auth/crypto changes = high)
    security: await analyzeSecurityRisk(refactoring.changes),

    // Critical path (non-critical = low, core logic = high)
    criticalPath: analyzeCriticalPathRisk(refactoring.affectedModules),
  }

  // Weighted average
  const riskScore =
    factors.fileCount * 0.2 +
    factors.complexityDelta * 0.25 +
    factors.testCoverage * 0.2 +
    factors.security * 0.25 +
    factors.criticalPath * 0.1

  return {
    score: Math.round(riskScore), // 0-100
    level: riskScore < 30 ? 'low' : riskScore < 70 ? 'medium' : 'high',
    factors,
    recommendation: generateRecommendation(riskScore),
  }
}

function calculateFileCountRisk(fileCount: number): number {
  if (fileCount <= 5) return 10
  if (fileCount <= 20) return 40
  if (fileCount <= 50) return 70
  return 100
}

function calculateComplexityRisk(delta: number): number {
  // Negative delta = complexity reduced = low risk
  if (delta <= -10) return 5
  if (delta <= 0) return 20
  if (delta <= 10) return 60
  return 90
}

function calculateTestCoverageRisk(coverageChange: number): number {
  // Positive change = coverage improved = low risk
  if (coverageChange >= 10) return 5
  if (coverageChange >= 0) return 20
  if (coverageChange >= -5) return 50
  return 90
}

async function analyzeSecurityRisk(changes: Change[]): Promise<number> {
  const securityKeywords = ['auth', 'crypto', 'password', 'token', 'secret', 'key']

  const hasSecurityChanges = changes.some((change) =>
    securityKeywords.some((keyword) => change.path.toLowerCase().includes(keyword))
  )

  if (!hasSecurityChanges) return 10

  // Run security scanner (Semgrep)
  const scanResults = await runSecurityScan(changes)

  if (scanResults.critical > 0) return 95
  if (scanResults.high > 0) return 70
  if (scanResults.medium > 0) return 40
  return 20
}
```

### 2. Approval Workflow Configuration

**Organization-Level Config**:
```typescript
// Database schema
interface ApprovalPolicy {
  id: string
  organizationId: string
  name: string
  rules: ApprovalRule[]
}

interface ApprovalRule {
  condition: RiskCondition
  approvers: Approver[]
  mode: 'sequential' | 'parallel' // All in order, or any can approve
  timeoutHours: number // Auto-escalate after X hours
  autoApprove: boolean // Skip if conditions met
}

interface Approver {
  role: 'tech_lead' | 'senior_dev' | 'security' | 'cto'
  userId?: string // Optional: specific user
  required: boolean
}

// Example policy
const defaultPolicy: ApprovalPolicy = {
  id: 'policy_123',
  organizationId: 'org_xyz',
  name: 'Standard Approval Policy',
  rules: [
    {
      condition: { riskLevel: 'low' },
      approvers: [],
      mode: 'parallel',
      timeoutHours: 0,
      autoApprove: true, // Auto-approve low risk
    },
    {
      condition: { riskLevel: 'medium' },
      approvers: [{ role: 'tech_lead', required: true }],
      mode: 'parallel',
      timeoutHours: 24,
      autoApprove: false,
    },
    {
      condition: { riskLevel: 'high' },
      approvers: [
        { role: 'tech_lead', required: true },
        { role: 'security', required: true },
      ],
      mode: 'sequential', // Tech lead first, then security
      timeoutHours: 48,
      autoApprove: false,
    },
  ],
}
```

**Apply Policy**:
```typescript
// lib/approval-engine.ts
export async function createApprovalWorkflow(
  refactoring: Refactoring,
  policy: ApprovalPolicy
): Promise<ApprovalWorkflow> {
  // Analyze risk
  const risk = await analyzeRisk(refactoring)

  // Find matching rule
  const rule = policy.rules.find((r) => matchesCondition(r.condition, risk))

  if (!rule) {
    throw new Error('No matching approval rule')
  }

  // Auto-approve if configured
  if (rule.autoApprove) {
    await db.refactoring.update({
      where: { id: refactoring.id },
      data: { status: 'approved', approvedAt: new Date(), approvedBy: 'system' },
    })

    return { status: 'auto_approved', steps: [] }
  }

  // Create approval steps
  const steps = rule.approvers.map((approver, index) => ({
    id: `step_${index}`,
    approver,
    status: 'pending',
    order: rule.mode === 'sequential' ? index : 0, // Parallel = all order 0
    deadline: new Date(Date.now() + rule.timeoutHours * 60 * 60 * 1000),
  }))

  // Save workflow
  const workflow = await db.approvalWorkflow.create({
    data: {
      refactoringId: refactoring.id,
      policyId: policy.id,
      riskScore: risk.score,
      riskLevel: risk.level,
      steps,
      status: 'pending',
    },
  })

  // Notify approvers
  await notifyApprovers(workflow)

  return workflow
}
```

### 3. Approval Actions

**Approve**:
```typescript
// apps/api/src/features/approvals/routes.ts
fastify.post('/approvals/:id/approve', {
  onRequest: [fastify.authenticate],
  schema: {
    body: {
      type: 'object',
      properties: {
        comment: { type: 'string' },
      },
    },
  },
}, async (request, reply) => {
  const { id } = request.params
  const { comment } = request.body
  const { user } = request

  // Get approval step
  const step = await db.approvalStep.findUnique({
    where: { id },
    include: { workflow: true },
  })

  // Check if user is authorized
  const canApprove = await checkApprovalPermission(user, step)
  if (!canApprove) {
    return reply.code(403).send({ error: 'Not authorized to approve' })
  }

  // Approve step
  await db.approvalStep.update({
    where: { id },
    data: {
      status: 'approved',
      approvedBy: user.id,
      approvedAt: new Date(),
      comment,
    },
  })

  // Check if all steps approved
  const allApproved = await checkAllStepsApproved(step.workflowId)

  if (allApproved) {
    // Mark workflow as approved
    await db.approvalWorkflow.update({
      where: { id: step.workflowId },
      data: { status: 'approved', completedAt: new Date() },
    })

    // Mark refactoring as approved
    await db.refactoring.update({
      where: { id: step.workflow.refactoringId },
      data: { status: 'approved', approvedAt: new Date() },
    })

    // Trigger deployment (if configured)
    await triggerDeployment(step.workflow.refactoringId)
  }

  return { status: 'approved', allApproved }
})
```

**Reject**:
```typescript
fastify.post('/approvals/:id/reject', {
  onRequest: [fastify.authenticate],
  schema: {
    body: {
      type: 'object',
      required: ['reason'],
      properties: {
        reason: { type: 'string' },
      },
    },
  },
}, async (request, reply) => {
  const { id } = request.params
  const { reason } = request.body
  const { user } = request

  const step = await db.approvalStep.findUnique({
    where: { id },
    include: { workflow: true },
  })

  // Reject step
  await db.approvalStep.update({
    where: { id },
    data: {
      status: 'rejected',
      rejectedBy: user.id,
      rejectedAt: new Date(),
      rejectionReason: reason,
    },
  })

  // Reject entire workflow
  await db.approvalWorkflow.update({
    where: { id: step.workflowId },
    data: { status: 'rejected', completedAt: new Date() },
  })

  // Reject refactoring
  await db.refactoring.update({
    where: { id: step.workflow.refactoringId },
    data: { status: 'rejected' },
  })

  // Notify requester
  await notifyRequester(step.workflow.refactoringId, user, reason)

  return { status: 'rejected' }
})
```

**Request Changes**:
```typescript
fastify.post('/approvals/:id/request-changes', {
  onRequest: [fastify.authenticate],
  schema: {
    body: {
      type: 'object',
      required: ['changes'],
      properties: {
        changes: { type: 'array', items: { type: 'string' } },
      },
    },
  },
}, async (request, reply) => {
  const { id } = request.params
  const { changes } = request.body
  const { user } = request

  await db.approvalStep.update({
    where: { id },
    data: {
      status: 'changes_requested',
      requestedBy: user.id,
      requestedAt: new Date(),
      requestedChanges: changes,
    },
  })

  // Notify requester
  await notifyRequester(step.workflow.refactoringId, user, changes.join(', '))

  return { status: 'changes_requested' }
})
```

### 4. Time-Based Auto-Escalation

**Background Job** (runs every hour):
```typescript
// workers/approval-escalation.ts
import { Queue, Worker } from 'bullmq'

const escalationWorker = new Worker('approval-escalation', async (job) => {
  // Find overdue approvals
  const overdueSteps = await db.approvalStep.findMany({
    where: {
      status: 'pending',
      deadline: { lt: new Date() },
    },
    include: { workflow: true, approver: true },
  })

  for (const step of overdueSteps) {
    // Escalate to next level (e.g., Tech Lead → CTO)
    const escalationTarget = await getEscalationTarget(step.approver)

    if (escalationTarget) {
      // Update step with new approver
      await db.approvalStep.update({
        where: { id: step.id },
        data: {
          approverId: escalationTarget.id,
          escalatedFrom: step.approverId,
          escalatedAt: new Date(),
          deadline: new Date(Date.now() + 24 * 60 * 60 * 1000), // +24 hours
        },
      })

      // Notify new approver
      await sendEscalationNotification(escalationTarget, step)

      // Log escalation
      await db.auditLog.create({
        data: {
          action: 'approval.escalated',
          userId: 'system',
          resourceType: 'approval_step',
          resourceId: step.id,
          metadata: {
            from: step.approverId,
            to: escalationTarget.id,
            reason: 'timeout',
          },
        },
      })
    } else {
      // No escalation target, auto-approve (fallback)
      await db.approvalStep.update({
        where: { id: step.id },
        data: {
          status: 'approved',
          approvedBy: 'system',
          approvedAt: new Date(),
          comment: 'Auto-approved due to timeout and no escalation target',
        },
      })
    }
  }
})

// Schedule every hour
await escalationQueue.add(
  'check-escalations',
  {},
  {
    repeat: {
      pattern: '0 * * * *', // Every hour
    },
  }
)
```

### 5. UI Components

**Approval Pending Badge**:
```typescript
// apps/portal/components/approval-badge.tsx
export function ApprovalBadge({ workflow }: { workflow: ApprovalWorkflow }) {
  const pendingSteps = workflow.steps.filter((s) => s.status === 'pending')

  if (pendingSteps.length === 0) {
    return <Badge variant="success">✓ Approved</Badge>
  }

  return (
    <Badge variant="warning">
      Pending: {pendingSteps.map((s) => s.approver.name).join(', ')}
    </Badge>
  )
}
```

**Approval Timeline**:
```typescript
// apps/portal/app/refactoring/[id]/approvals/page.tsx
export default function ApprovalsPage({ params }: { params: { id: string } }) {
  const { data: workflow } = useApprovalWorkflow(params.id)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Approval Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <Timeline>
          {workflow.steps.map((step, index) => (
            <TimelineItem
              key={step.id}
              status={step.status}
              title={step.approver.name}
              description={step.approver.role}
              timestamp={step.approvedAt || step.deadline}
              comment={step.comment}
              showConnector={index < workflow.steps.length - 1}
            />
          ))}
        </Timeline>
      </CardContent>
    </Card>
  )
}
```

## Audit & Compliance

**Track All Actions**:
```typescript
// Every approval action logged
await db.auditLog.create({
  data: {
    action: 'approval.approved',
    userId: user.id,
    tenantId: user.currentTenantId,
    resourceType: 'approval_step',
    resourceId: step.id,
    metadata: {
      refactoringId: workflow.refactoringId,
      riskLevel: workflow.riskLevel,
      comment,
      timestamp: new Date(),
    },
  },
})
```

**Compliance Reports**:
```typescript
// Generate SOC 2 compliance report
export async function generateApprovalReport(
  tenantId: string,
  startDate: Date,
  endDate: Date
) {
  const approvals = await db.approvalWorkflow.findMany({
    where: {
      tenantId,
      createdAt: { gte: startDate, lte: endDate },
    },
    include: { steps: true },
  })

  return {
    totalApprovals: approvals.length,
    autoApproved: approvals.filter((a) => a.status === 'auto_approved').length,
    manuallyApproved: approvals.filter((a) => a.status === 'approved').length,
    rejected: approvals.filter((a) => a.status === 'rejected').length,
    averageTimeToApprove: calculateAverageTime(approvals),
    complianceRate: (approvals.filter((a) => a.status !== 'rejected').length / approvals.length) * 100,
  }
}
```

## Consequences

### Positive
- **Risk Mitigation**: High-risk changes reviewed by multiple experts
- **Compliance**: Complete audit trail for SOC 2, ISO 27001
- **Flexibility**: Organizations customize approval policies
- **Automation**: Low-risk changes auto-approved (faster velocity)
- **Accountability**: Clear ownership of approvals

### Negative
- **Complexity**: Multi-step approvals slow down deployment
- **Bottlenecks**: Key approvers can become blockers
- **Overhead**: More process for simple changes

### Mitigations
- **Auto-Approval**: Low-risk changes skip manual approval
- **Escalation**: Timeouts prevent indefinite blocking
- **Delegation**: Approvers can delegate when unavailable
- **Parallel Approvals**: Multiple approvers can approve simultaneously

## References
- ADR-019: No-Code Workflows (initiating refactoring)
- ADR-021: One-Click Deployment (post-approval deployment)
- FF-009: Refactoring Approval System (UI implementation)

---

**Document Version**: 1.0
**Last Updated**: 2026-01-20
**Authors**: Engineering Team, Compliance Team
**Approved By**: CTO, Head of Compliance
