# ADR-021: One-Click Deployment Pipeline

## Status
Accepted

## Context

After refactoring is approved (ADR-020), non-technical users need a simple way to deploy changes without:
- Writing Git commands
- Understanding CI/CD pipelines
- SSH access to servers
- Knowledge of deployment processes

### Requirements
- **One-Click Deploy**: Single button to deploy all changes
- **Safety Checks**: Automated tests, security scans, rollback plan
- **Deployment Options**: Staging, production, scheduled
- **Zero Downtime**: Blue-green or canary deployments
- **Rollback**: One-click rollback if issues detected
- **Status Tracking**: Real-time deployment progress

### User Personas
- **Product Manager**: Wants to deploy feature after approval
- **Project Manager**: Schedules deployments for off-hours
- **Executive**: Emergency rollback if production issues
- **Analyst**: Deploys data pipeline changes

## Decision

Implement **Automated Deployment Pipeline** with:

### 1. **Pre-Deployment Checks** (Automated Safety Net)
### 2. **Multiple Deployment Strategies** (Staging, Blue-Green, Canary)
### 3. **One-Click Deploy Button** (UI-Driven)
### 4. **Real-Time Progress Tracking** (WebSocket Updates)
### 5. **Automated Rollback** (One-Click Undo)

## Architecture

```typescript
┌─────────────────────────────────────────────────────────────┐
│              One-Click Deployment Pipeline                   │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  User Clicks "Deploy"                                        │
│           │                                                   │
│           ▼                                                   │
│  Pre-Deployment Checks (Automated)                           │
│  ┌──────────────────────────────────────────────┐           │
│  │ 1. Run unit tests (Jest, Go test)            │           │
│  │ 2. Run integration tests (Playwright)        │           │
│  │ 3. Security scan (Snyk, Semgrep)             │           │
│  │ 4. Lint check (ESLint, Prettier)             │           │
│  │ 5. Type check (TypeScript strict)            │           │
│  │ 6. Build verification (Next.js, Go)          │           │
│  │                                               │           │
│  │ All Pass? → Continue                          │           │
│  │ Any Fail? → Block + Notify User              │           │
│  └──────────────────────────────────────────────┘           │
│           │                                                   │
│           ▼                                                   │
│  Create Pull Request (GitHub)                                │
│  ┌──────────────────────────────────────────────┐           │
│  │ Title: "Refactoring: Improve code quality"   │           │
│  │ Body: Summary of changes, AI score impact    │           │
│  │ Labels: "refactoring", "ai-generated"        │           │
│  │                                               │           │
│  │ Status Checks (GitHub Actions):              │           │
│  │ ✓ Tests pass                                  │           │
│  │ ✓ Security scan clean                         │           │
│  │ ✓ Build succeeds                              │           │
│  └──────────────────────────────────────────────┘           │
│           │                                                   │
│           ▼                                                   │
│  Deployment Strategy Selection                               │
│  ┌──────────────────────────────────────────────┐           │
│  │ Option 1: Merge to Staging (default)         │           │
│  │ Option 2: Blue-Green Deploy to Production    │           │
│  │ Option 3: Canary Deploy (10% traffic)        │           │
│  │ Option 4: Schedule for Later                 │           │
│  └──────────────────────────────────────────────┘           │
│           │                                                   │
│           ▼                                                   │
│  Deploy (CI/CD Pipeline Triggered)                           │
│  ┌──────────────────────────────────────────────┐           │
│  │ GitHub Actions Workflow:                      │           │
│  │                                               │           │
│  │ 1. Checkout code                              │           │
│  │ 2. Build Docker image                         │           │
│  │ 3. Push to ECR (AWS Container Registry)      │           │
│  │ 4. Update ECS task definition                │           │
│  │ 5. Deploy to ECS cluster                      │           │
│  │ 6. Run smoke tests                            │           │
│  │ 7. Health check                                │           │
│  │                                               │           │
│  │ Success? → Complete                           │           │
│  │ Failure? → Auto-rollback                      │           │
│  └──────────────────────────────────────────────┘           │
│           │                                                   │
│           ▼                                                   │
│  Post-Deployment Verification                                │
│  ┌──────────────────────────────────────────────┐           │
│  │ 1. Smoke tests (critical paths work)         │           │
│  │ 2. Health check (all services responding)    │           │
│  │ 3. Error rate (< 1% threshold)                │           │
│  │ 4. Latency check (P95 < 500ms)                │           │
│  │                                               │           │
│  │ All Pass? → Mark as successful                │           │
│  │ Any Fail? → Auto-rollback                     │           │
│  └──────────────────────────────────────────────┘           │
│           │                                                   │
│           ▼                                                   │
│  Deployment Complete ✓                                       │
│  - Notify user via email, Slack                              │
│  - Update deployment history                                 │
│  - Track metrics (duration, success rate)                    │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Implementation

### 1. Pre-Deployment Checks

**Automated Safety Net**:
```typescript
// lib/pre-deployment-checks.ts
export async function runPreDeploymentChecks(
  refactoringId: string
): Promise<CheckResults> {
  const results = {
    tests: { status: 'pending', message: '' },
    security: { status: 'pending', message: '' },
    lint: { status: 'pending', message: '' },
    typeCheck: { status: 'pending', message: '' },
    build: { status: 'pending', message: '' },
  }

  // 1. Run unit tests
  try {
    await execAsync('npm run test')
    results.tests = { status: 'passed', message: 'All tests passed' }
  } catch (err) {
    results.tests = { status: 'failed', message: err.message }
    return results // Stop on first failure
  }

  // 2. Security scan
  try {
    const scanResults = await execAsync('npm run security:scan')
    if (scanResults.includes('vulnerabilities: 0')) {
      results.security = { status: 'passed', message: 'No vulnerabilities found' }
    } else {
      results.security = {
        status: 'failed',
        message: 'Vulnerabilities detected. Run `npm run security:scan` for details.',
      }
      return results
    }
  } catch (err) {
    results.security = { status: 'failed', message: err.message }
    return results
  }

  // 3. Lint check
  try {
    await execAsync('npm run lint')
    results.lint = { status: 'passed', message: 'Lint check passed' }
  } catch (err) {
    results.lint = {
      status: 'failed',
      message: 'Lint errors found. Run `npm run lint:fix` to auto-fix.',
    }
    return results
  }

  // 4. Type check
  try {
    await execAsync('npm run type-check')
    results.typeCheck = { status: 'passed', message: 'Type check passed' }
  } catch (err) {
    results.typeCheck = { status: 'failed', message: err.message }
    return results
  }

  // 5. Build verification
  try {
    await execAsync('npm run build')
    results.build = { status: 'passed', message: 'Build succeeded' }
  } catch (err) {
    results.build = { status: 'failed', message: err.message }
    return results
  }

  return results
}
```

**Check Status UI**:
```typescript
// apps/portal/app/refactoring/[id]/deploy/page.tsx
export default function DeployPage({ params }: { params: { id: string } }) {
  const { data: checks } = usePreDeploymentChecks(params.id)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pre-Deployment Checks</CardTitle>
        <CardDescription>
          Automated safety checks before deployment
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <CheckItem
            status={checks?.tests.status}
            text="Unit & Integration Tests"
            message={checks?.tests.message}
          />
          <CheckItem
            status={checks?.security.status}
            text="Security Scan"
            message={checks?.security.message}
          />
          <CheckItem
            status={checks?.lint.status}
            text="Lint Check"
            message={checks?.lint.message}
          />
          <CheckItem
            status={checks?.typeCheck.status}
            text="Type Check"
            message={checks?.typeCheck.message}
          />
          <CheckItem
            status={checks?.build.status}
            text="Build Verification"
            message={checks?.build.message}
          />
        </div>

        {allChecksPassed(checks) && (
          <Button onClick={deploy} className="mt-6">
            Deploy to Staging
          </Button>
        )}

        {anyCheckFailed(checks) && (
          <Alert variant="destructive" className="mt-6">
            <AlertCircleIcon className="h-4 w-4" />
            <AlertTitle>Deployment Blocked</AlertTitle>
            <AlertDescription>
              Fix the issues above before deploying.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}
```

### 2. Pull Request Creation

**Auto-Create PR**:
```typescript
// lib/github.ts
export async function createRefactoringPR(
  refactoring: Refactoring
): Promise<PullRequest> {
  const { repositoryId, branch, changes } = refactoring

  // Get repository details
  const repo = await db.repository.findUnique({ where: { id: repositoryId } })

  // Create PR via GitHub API
  const pr = await octokit.pulls.create({
    owner: repo.owner,
    repo: repo.name,
    title: `Refactoring: ${refactoring.title}`,
    head: branch,
    base: 'main',
    body: generatePRBody(refactoring),
  })

  // Add labels
  await octokit.issues.addLabels({
    owner: repo.owner,
    repo: repo.name,
    issue_number: pr.data.number,
    labels: ['refactoring', 'ai-generated', 'forge-factory'],
  })

  // Request reviews
  if (refactoring.reviewers.length > 0) {
    await octokit.pulls.requestReviewers({
      owner: repo.owner,
      repo: repo.name,
      pull_number: pr.data.number,
      reviewers: refactoring.reviewers.map((r) => r.githubUsername),
    })
  }

  return pr.data
}

function generatePRBody(refactoring: Refactoring): string {
  return `
## Summary

This PR contains refactoring changes generated by Forge Factory to improve code quality.

## Impact

- **AI-Readiness Score**: ${refactoring.scoreBefore} → ${refactoring.scoreAfter} (+${refactoring.scoreDelta})
- **Files Changed**: ${refactoring.filesChanged}
- **Lines Changed**: +${refactoring.linesAdded} -${refactoring.linesRemoved}

## Changes

${refactoring.changes.map((c) => `- ${c.description}`).join('\n')}

## Risk Analysis

- **Risk Level**: ${refactoring.riskLevel}
- **Test Coverage**: ${refactoring.testCoverage}%
- **Security Scan**: ${refactoring.securityScanClean ? '✓ Clean' : '⚠️ Issues detected'}

## Approvals

${refactoring.approvals.map((a) => `- ✓ Approved by ${a.user.name} on ${formatDate(a.approvedAt)}`).join('\n')}

---

Generated by [Forge Factory](https://forgefactory.dev) | [View Analysis](https://app.forgefactory.dev/refactoring/${refactoring.id})
`
}
```

### 3. Deployment Strategies

**Option 1: Staging Deployment** (Default):
```yaml
# .github/workflows/deploy-staging.yml
name: Deploy to Staging

on:
  push:
    branches: [staging]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Run tests
        run: npm run test

      - name: Build
        run: npm run build

      - name: Deploy to Staging (AWS ECS)
        run: |
          aws ecs update-service \
            --cluster forge-staging \
            --service api \
            --force-new-deployment
```

**Option 2: Blue-Green Deployment** (Zero Downtime):
```typescript
// lib/deployment/blue-green.ts
export async function blueGreenDeploy(deploymentId: string) {
  // 1. Deploy to "green" environment (new version)
  await deployToEnvironment('green', deploymentId)

  // 2. Run smoke tests on green
  const smokeTestsPass = await runSmokeTests('green')

  if (!smokeTestsPass) {
    await rollback('green')
    throw new Error('Smoke tests failed on green environment')
  }

  // 3. Switch traffic from blue → green
  await switchTraffic('blue', 'green')

  // 4. Monitor error rates for 5 minutes
  await monitorErrorRates('green', { duration: 5 * 60 * 1000 })

  // 5. If stable, mark blue as standby (for rollback)
  await markAsStandby('blue')

  // 6. After 24 hours, decommission blue
  setTimeout(() => decommissionEnvironment('blue'), 24 * 60 * 60 * 1000)
}
```

**Option 3: Canary Deployment** (Gradual Rollout):
```typescript
// lib/deployment/canary.ts
export async function canaryDeploy(deploymentId: string) {
  // 1. Deploy new version
  await deployToEnvironment('canary', deploymentId)

  // 2. Route 10% of traffic to canary
  await updateTrafficSplit({ canary: 0.1, main: 0.9 })
  await monitorMetrics({ duration: 10 * 60 * 1000 }) // 10 min

  // 3. If metrics look good, increase to 25%
  await updateTrafficSplit({ canary: 0.25, main: 0.75 })
  await monitorMetrics({ duration: 10 * 60 * 1000 })

  // 4. Increase to 50%
  await updateTrafficSplit({ canary: 0.5, main: 0.5 })
  await monitorMetrics({ duration: 10 * 60 * 1000 })

  // 5. If all good, complete rollout to 100%
  await updateTrafficSplit({ canary: 1.0, main: 0 })

  // 6. Decommission old version
  await decommissionEnvironment('main')
}
```

### 4. Real-Time Progress Tracking

**WebSocket Updates**:
```typescript
// workers/deployment-worker.ts
import { io } from '../lib/socket-io'

async function deployToStaging(deploymentId: string) {
  const deployment = await db.deployment.findUnique({ where: { id: deploymentId } })

  // Emit progress updates via WebSocket
  io.to(`deployment:${deploymentId}`).emit('deployment:progress', {
    deploymentId,
    progress: 10,
    status: 'running_tests',
    message: 'Running unit tests...',
  })

  // Run tests
  await runTests()

  io.to(`deployment:${deploymentId}`).emit('deployment:progress', {
    deploymentId,
    progress: 30,
    status: 'building',
    message: 'Building Docker image...',
  })

  // Build image
  await buildDockerImage()

  io.to(`deployment:${deploymentId}`).emit('deployment:progress', {
    deploymentId,
    progress: 60,
    status: 'deploying',
    message: 'Deploying to ECS cluster...',
  })

  // Deploy
  await deployToECS()

  io.to(`deployment:${deploymentId}`).emit('deployment:progress', {
    deploymentId,
    progress: 90,
    status: 'verifying',
    message: 'Running health checks...',
  })

  // Health check
  await healthCheck()

  io.to(`deployment:${deploymentId}`).emit('deployment:progress', {
    deploymentId,
    progress: 100,
    status: 'completed',
    message: 'Deployment complete!',
  })
}
```

**Progress UI**:
```typescript
// apps/portal/app/refactoring/[id]/deployment/[deploymentId]/page.tsx
export default function DeploymentProgressPage({ params }) {
  const { data: deployment } = useDeploymentProgress(params.deploymentId)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Deployment in Progress...</CardTitle>
      </CardHeader>
      <CardContent>
        <Progress value={deployment?.progress || 0} className="mb-6" />

        <div className="space-y-3">
          <DeploymentStep
            status={deployment?.progress > 10 ? 'complete' : deployment?.progress > 0 ? 'in_progress' : 'pending'}
            text="Running tests"
          />
          <DeploymentStep
            status={deployment?.progress > 30 ? 'complete' : deployment?.progress > 10 ? 'in_progress' : 'pending'}
            text="Building Docker image"
          />
          <DeploymentStep
            status={deployment?.progress > 60 ? 'complete' : deployment?.progress > 30 ? 'in_progress' : 'pending'}
            text="Deploying to cluster"
          />
          <DeploymentStep
            status={deployment?.progress > 90 ? 'complete' : deployment?.progress > 60 ? 'in_progress' : 'pending'}
            text="Running health checks"
          />
        </div>

        {deployment?.status === 'completed' && (
          <Alert variant="success" className="mt-6">
            <CheckCircleIcon className="h-4 w-4" />
            <AlertTitle>Deployment Successful!</AlertTitle>
            <AlertDescription>
              Your changes are now live in staging.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}
```

### 5. One-Click Rollback

**Rollback Button**:
```typescript
// apps/portal/app/deployments/[id]/page.tsx
export default function DeploymentDetailPage({ params }) {
  const { data: deployment } = useDeployment(params.id)

  const rollback = async () => {
    if (!confirm('Are you sure you want to rollback this deployment?')) return

    await apiClient.deployments.rollback(deployment.id)
    toast.success('Rollback initiated')
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Deployment #{deployment?.id}</CardTitle>
          {deployment?.status === 'completed' && (
            <Button variant="destructive" onClick={rollback}>
              Rollback
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <dl className="space-y-2">
          <dt className="font-semibold">Status</dt>
          <dd><StatusBadge status={deployment?.status} /></dd>

          <dt className="font-semibold">Deployed At</dt>
          <dd>{formatDateTime(deployment?.deployedAt)}</dd>

          <dt className="font-semibold">Deployed By</dt>
          <dd>{deployment?.deployedBy.name}</dd>
        </dl>
      </CardContent>
    </Card>
  )
}
```

**Rollback Implementation**:
```typescript
// lib/deployment/rollback.ts
export async function rollbackDeployment(deploymentId: string) {
  const deployment = await db.deployment.findUnique({
    where: { id: deploymentId },
    include: { previousDeployment: true },
  })

  if (!deployment.previousDeployment) {
    throw new Error('No previous deployment to rollback to')
  }

  // 1. Get previous Docker image
  const previousImage = deployment.previousDeployment.dockerImage

  // 2. Update ECS task definition
  await updateECSTaskDefinition({
    cluster: 'forge-production',
    service: 'api',
    image: previousImage,
  })

  // 3. Force new deployment
  await forceNewDeployment('forge-production', 'api')

  // 4. Monitor health
  await monitorHealth({ timeout: 5 * 60 * 1000 }) // 5 min

  // 5. Mark as rolled back
  await db.deployment.update({
    where: { id: deploymentId },
    data: {
      status: 'rolled_back',
      rolledBackAt: new Date(),
    },
  })

  // 6. Notify team
  await sendSlackNotification(
    `🔄 Deployment #${deploymentId} rolled back to version ${deployment.previousDeployment.version}`
  )
}
```

## Metrics & Monitoring

**Deployment Metrics**:
```typescript
// Track deployment success rate
await datadog.increment('deployment.completed', 1, {
  status: 'success',
  environment: 'staging',
})

// Track deployment duration
await datadog.histogram('deployment.duration', durationSeconds, {
  environment: 'staging',
})

// Track rollback rate
await datadog.increment('deployment.rollback', 1)
```

## Consequences

### Positive
- **Accessibility**: Non-technical users can deploy
- **Safety**: Automated checks prevent bad deployments
- **Speed**: One-click vs. manual 30-minute process
- **Reliability**: Automated rollback if issues detected
- **Audit Trail**: Every deployment logged

### Negative
- **Abstraction**: Hides complexity (users don't learn Git/CI/CD)
- **Risk**: Automated deployments can fail spectacularly
- **Cost**: More infrastructure for staging/canary

### Mitigations
- **Training**: Provide optional Git/CI/CD training
- **Monitoring**: Comprehensive health checks and alerts
- **Gradual Rollout**: Canary deployments reduce blast radius

## References
- ADR-019: No-Code Workflows (initiating deployment)
- ADR-020: Approval System (pre-deployment approvals)
- FF-010: Deployment Pipeline UI
- [AWS ECS Deployments](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/deployment-types.html)

---

**Document Version**: 1.0
**Last Updated**: 2026-01-20
**Authors**: DevOps Team, Engineering Team
**Approved By**: CTO, VP of Engineering
