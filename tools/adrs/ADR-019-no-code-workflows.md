# ADR-019: No-Code Analysis & Refactoring Workflows

## Status
Accepted

## Context

Forge Factory currently requires technical knowledge to:
- Configure and run code analysis
- Review refactoring suggestions
- Approve and deploy changes

This limits adoption among:
- **Product Managers**: Want to analyze code quality without technical setup
- **Business Analysts**: Need to track technical debt metrics
- **Project Managers**: Want visibility into refactoring progress
- **Executives**: Need high-level insights without developer involvement

### Requirements
- **Zero Code**: No command-line, no Git commands, no IDE required
- **Guided Workflows**: Step-by-step wizards for common tasks
- **Visual Feedback**: Clear visualizations of code quality and changes
- **Approval Flows**: Multi-step approval for changes before deployment
- **Audit Trail**: Track who requested/approved each change
- **Self-Service**: Enable non-technical users independently

### Target Users
- **Sarah (Product Manager)**: Wants to analyze feature code quality
- **Michael (Business Analyst)**: Tracks technical debt KPIs
- **Lisa (Project Manager)**: Monitors refactoring sprint progress
- **David (Executive)**: Reviews ROI of code improvements

## Decision

Implement **3-tier no-code workflow system**:

### 1. **Visual Analysis Workflow** (No-Code Repository Analysis)
### 2. **Interactive Refactoring Workflow** (Point-and-Click Approvals)
### 3. **One-Click Deployment** (Automated PR Creation and Merge)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│            No-Code User Journey (Analyst/PM)                 │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Step 1: Select Repository (Dropdown)                        │
│  ┌──────────────────────────────────────────────┐           │
│  │ "Which repository do you want to analyze?"   │           │
│  │ [Dropdown: acme-corp/api-service ▼]          │           │
│  │ [Button: Analyze Now]                         │           │
│  └──────────────────────────────────────────────┘           │
│           │                                                   │
│           ▼                                                   │
│  Step 2: Analysis Running (Progress Bar)                     │
│  ┌──────────────────────────────────────────────┐           │
│  │ Analyzing code quality...                     │           │
│  │ [████████████░░░░░░░░] 65%                   │           │
│  │ 📊 Checking complexity... ✓                   │           │
│  │ 📝 Analyzing documentation... (in progress)   │           │
│  └──────────────────────────────────────────────┘           │
│           │                                                   │
│           ▼                                                   │
│  Step 3: Results Dashboard (Visual)                          │
│  ┌──────────────────────────────────────────────┐           │
│  │ AI-Readiness Score: 62/100 ⚠️                │           │
│  │                                               │           │
│  │ [Pie Chart: Code Quality Breakdown]          │           │
│  │ [Bar Chart: Issues by Severity]              │           │
│  │                                               │           │
│  │ Top 5 Recommendations:                        │           │
│  │ 1. ⚠️  Reduce complexity in auth.ts           │           │
│  │    Impact: +8 points | Effort: 2 hours       │           │
│  │    [Button: Start Refactoring]                │           │
│  │                                               │           │
│  │ 2. 📝 Add docstrings to 47 functions         │           │
│  │    Impact: +12 points | Effort: 4 hours      │           │
│  │    [Button: Start Refactoring]                │           │
│  └──────────────────────────────────────────────┘           │
│           │                                                   │
│           ▼                                                   │
│  Step 4: Start Refactoring (Wizard)                          │
│  ┌──────────────────────────────────────────────┐           │
│  │ Refactoring Wizard                            │           │
│  │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━    │           │
│  │                                               │           │
│  │ Configure Refactoring:                        │           │
│  │ □ Auto-fix simple issues (safe)              │           │
│  │ □ Request approval for complex changes       │           │
│  │ □ Create separate PR for each file           │           │
│  │                                               │           │
│  │ Assign Reviewers:                             │           │
│  │ [Select: John Doe (Tech Lead) ▼]             │           │
│  │                                               │           │
│  │ [Button: Start Refactoring]                   │           │
│  └──────────────────────────────────────────────┘           │
│           │                                                   │
│           ▼                                                   │
│  Step 5: Review Changes (Side-by-Side Diff)                  │
│  ┌──────────────────────────────────────────────┐           │
│  │ File: src/auth.ts                             │           │
│  │ ┌────────────────┬────────────────────────┐  │           │
│  │ │ Before         │ After (Refactored)     │  │           │
│  │ ├────────────────┼────────────────────────┤  │           │
│  │ │ function auth()│ /**                    │  │           │
│  │ │ {              │  * Authenticates user  │  │           │
│  │ │   if (user)    │  */                    │  │           │
│  │ │     return true│ function auth() {      │  │           │
│  │ │ }              │   if (!user) return    │  │           │
│  │ │                │   return true          │  │           │
│  │ │                │ }                      │  │           │
│  │ └────────────────┴────────────────────────┘  │           │
│  │                                               │           │
│  │ Impact: Reduces complexity by 3 points       │           │
│  │ Risk: Low ✅                                  │           │
│  │                                               │           │
│  │ [Button: Approve] [Button: Reject]           │           │
│  └──────────────────────────────────────────────┘           │
│           │                                                   │
│           ▼                                                   │
│  Step 6: One-Click Deployment                                │
│  ┌──────────────────────────────────────────────┐           │
│  │ Ready to Deploy?                              │           │
│  │                                               │           │
│  │ ✓ 5 files refactored                          │           │
│  │ ✓ AI-Readiness Score: 62 → 78 (+16)          │           │
│  │ ✓ All tests passing                           │           │
│  │ ✓ Security scan clean                         │           │
│  │                                               │           │
│  │ Deployment Options:                           │           │
│  │ ○ Create PR for review (recommended)         │           │
│  │ ○ Deploy to staging immediately               │           │
│  │ ○ Schedule deployment for later               │           │
│  │                                               │           │
│  │ [Button: Deploy Now]                          │           │
│  └──────────────────────────────────────────────┘           │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Detailed Implementation

### 1. Visual Analysis Workflow (FF-008)

**Repository Selection**:
```typescript
// apps/portal/app/analysis/new/page.tsx
export default function NewAnalysisPage() {
  const { data: repos } = useRepositories()
  const [selectedRepo, setSelectedRepo] = useState(null)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Analyze Repository</CardTitle>
        <CardDescription>
          Select a repository to analyze code quality and get AI-powered recommendations
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Label>Repository</Label>
        <Select value={selectedRepo} onValueChange={setSelectedRepo}>
          {repos?.map((repo) => (
            <SelectItem key={repo.id} value={repo.id}>
              <div className="flex items-center gap-2">
                <GitBranchIcon className="h-4 w-4" />
                <span>{repo.name}</span>
                <Badge>{repo.language}</Badge>
                <span className="text-sm text-slate-500">
                  {repo.linesOfCode.toLocaleString()} LOC
                </span>
              </div>
            </SelectItem>
          ))}
        </Select>

        <Button
          onClick={() => startAnalysis(selectedRepo)}
          disabled={!selectedRepo}
          className="mt-4"
        >
          Analyze Now
        </Button>
      </CardContent>
    </Card>
  )
}
```

**Progress Tracking**:
```typescript
// apps/portal/app/analysis/[id]/progress/page.tsx
export default function AnalysisProgressPage({ params }: { params: { id: string } }) {
  const { data: analysis } = useAnalysisProgress(params.id)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Analyzing Code Quality...</CardTitle>
      </CardHeader>
      <CardContent>
        <Progress value={analysis?.progress || 0} className="mb-6" />

        <div className="space-y-3">
          <ChecklistItem
            status={analysis?.progress > 10 ? 'complete' : 'pending'}
            text="Repository cloned"
          />
          <ChecklistItem
            status={analysis?.progress > 30 ? 'complete' : analysis?.progress > 10 ? 'in_progress' : 'pending'}
            text="Analyzing code complexity"
          />
          <ChecklistItem
            status={analysis?.progress > 60 ? 'complete' : analysis?.progress > 30 ? 'in_progress' : 'pending'}
            text="Checking documentation coverage"
          />
          <ChecklistItem
            status={analysis?.progress > 85 ? 'complete' : analysis?.progress > 60 ? 'in_progress' : 'pending'}
            text="Generating recommendations"
          />
        </div>

        <p className="text-sm text-slate-600 mt-4">
          Estimated time remaining: {estimatedTime(analysis?.progress)}
        </p>
      </CardContent>
    </Card>
  )
}
```

**Results Dashboard**:
```typescript
// apps/portal/app/analysis/[id]/results/page.tsx
export default function AnalysisResultsPage({ params }: { params: { id: string } }) {
  const { data: analysis } = useAnalysis(params.id)

  return (
    <div className="space-y-6">
      {/* AI-Readiness Score */}
      <ScoreCard
        score={analysis.aiReadinessScore}
        previousScore={analysis.previousScore}
        trend={analysis.trend}
      />

      {/* Visual Breakdown */}
      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Code Quality Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <PieChart
              data={[
                { name: 'Excellent', value: 23, color: '#10b981' },
                { name: 'Good', value: 45, color: '#3b82f6' },
                { name: 'Needs Work', value: 32, color: '#f59e0b' },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Issues by Severity</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart
              data={[
                { severity: 'Critical', count: 3 },
                { severity: 'High', count: 12 },
                { severity: 'Medium', count: 28 },
                { severity: 'Low', count: 47 },
              ]}
            />
          </CardContent>
        </Card>
      </div>

      {/* Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle>Top Recommendations</CardTitle>
          <CardDescription>
            These changes will have the biggest impact on your AI-Readiness Score
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RecommendationList
            recommendations={analysis.recommendations}
            onStartRefactoring={(recommendation) => {
              router.push(`/refactoring/new?recommendation=${recommendation.id}`)
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}
```

### 2. Interactive Refactoring Workflow (FF-009)

**Refactoring Wizard**:
```typescript
// apps/portal/app/refactoring/new/page.tsx
export default function NewRefactoringPage() {
  const [step, setStep] = useState(1)
  const [config, setConfig] = useState({
    autoFix: true,
    requireApproval: true,
    separatePRs: false,
    reviewer: null,
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Refactoring Wizard</CardTitle>
        <Progress value={(step / 4) * 100} />
      </CardHeader>
      <CardContent>
        {step === 1 && (
          <div className="space-y-4">
            <h3 className="font-semibold">Configure Refactoring</h3>

            <Checkbox
              checked={config.autoFix}
              onCheckedChange={(checked) => setConfig({ ...config, autoFix: checked })}
            >
              Auto-fix simple issues (safe)
            </Checkbox>

            <Checkbox
              checked={config.requireApproval}
              onCheckedChange={(checked) => setConfig({ ...config, requireApproval: checked })}
            >
              Request approval for complex changes
            </Checkbox>

            <Button onClick={() => setStep(2)}>Next</Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h3 className="font-semibold">Assign Reviewers</h3>

            <Label>Technical Reviewer</Label>
            <Select
              value={config.reviewer}
              onValueChange={(reviewer) => setConfig({ ...config, reviewer })}
            >
              <SelectItem value="user_123">John Doe (Tech Lead)</SelectItem>
              <SelectItem value="user_456">Jane Smith (Senior Dev)</SelectItem>
            </Select>

            <Button onClick={() => startRefactoring(config)}>
              Start Refactoring
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

**Change Review (Side-by-Side Diff)**:
```typescript
// apps/portal/app/refactoring/[id]/review/page.tsx
export default function RefactoringReviewPage({ params }: { params: { id: string } }) {
  const { data: refactoring } = useRefactoring(params.id)
  const [currentFileIndex, setCurrentFileIndex] = useState(0)

  const currentFile = refactoring.changes[currentFileIndex]

  return (
    <div className="space-y-6">
      {/* File Navigation */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Review Changes</h2>
          <p className="text-slate-600">
            File {currentFileIndex + 1} of {refactoring.changes.length}
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setCurrentFileIndex(currentFileIndex - 1)}
            disabled={currentFileIndex === 0}
          >
            ← Previous
          </Button>
          <Button
            variant="outline"
            onClick={() => setCurrentFileIndex(currentFileIndex + 1)}
            disabled={currentFileIndex === refactoring.changes.length - 1}
          >
            Next →
          </Button>
        </div>
      </div>

      {/* Side-by-Side Diff */}
      <Card>
        <CardHeader>
          <CardTitle>{currentFile.path}</CardTitle>
        </CardHeader>
        <CardContent>
          <DiffViewer
            oldCode={currentFile.before}
            newCode={currentFile.after}
            language={currentFile.language}
          />

          {/* Impact Summary */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h4 className="font-semibold mb-2">Impact Analysis</h4>
            <div className="grid grid-cols-3 gap-4">
              <MetricBadge
                label="Complexity"
                value={`-${currentFile.complexityReduction}`}
                positive
              />
              <MetricBadge
                label="Readability"
                value={`+${currentFile.readabilityGain}%`}
                positive
              />
              <MetricBadge
                label="Risk"
                value={currentFile.risk}
                variant={currentFile.risk === 'low' ? 'success' : 'warning'}
              />
            </div>
          </div>

          {/* Approval Actions */}
          <div className="flex gap-4 mt-6">
            <Button
              onClick={() => approveChange(currentFile.id)}
              variant="default"
            >
              ✓ Approve
            </Button>
            <Button
              onClick={() => rejectChange(currentFile.id)}
              variant="destructive"
            >
              ✗ Reject
            </Button>
            <Button
              onClick={() => requestModification(currentFile.id)}
              variant="outline"
            >
              Request Modification
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

### 3. One-Click Deployment (FF-010)

**Deployment Dashboard**:
```typescript
// apps/portal/app/refactoring/[id]/deploy/page.tsx
export default function DeploymentPage({ params }: { params: { id: string } }) {
  const { data: refactoring } = useRefactoring(params.id)
  const [deploymentOption, setDeploymentOption] = useState('create_pr')

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ready to Deploy?</CardTitle>
        <CardDescription>
          Your refactoring changes are ready. Choose how you want to deploy them.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Pre-Deployment Checks */}
        <div className="space-y-3 mb-6">
          <CheckItem status="complete" text={`${refactoring.filesChanged} files refactored`} />
          <CheckItem
            status="complete"
            text={`AI-Readiness Score: ${refactoring.scoreBefore} → ${refactoring.scoreAfter} (+${refactoring.scoreDelta})`}
          />
          <CheckItem status={refactoring.testsPass ? 'complete' : 'failed'} text="All tests passing" />
          <CheckItem status={refactoring.securityScanClean ? 'complete' : 'failed'} text="Security scan clean" />
        </div>

        {/* Deployment Options */}
        <RadioGroup value={deploymentOption} onValueChange={setDeploymentOption}>
          <div className="space-y-3">
            <RadioCard
              value="create_pr"
              title="Create Pull Request (Recommended)"
              description="Create a PR for team review before merging"
              recommended
            />
            <RadioCard
              value="deploy_staging"
              title="Deploy to Staging"
              description="Deploy changes to staging environment immediately"
            />
            <RadioCard
              value="schedule"
              title="Schedule Deployment"
              description="Choose a time to deploy (e.g., off-hours)"
            />
          </div>
        </RadioGroup>

        {/* Deploy Button */}
        <Button
          onClick={() => deploy(refactoring.id, deploymentOption)}
          className="mt-6"
          size="lg"
        >
          Deploy Now
        </Button>
      </CardContent>
    </Card>
  )
}
```

**Post-Deployment Confirmation**:
```typescript
// apps/portal/app/refactoring/[id]/deployed/page.tsx
export default function DeployedPage({ params }: { params: { id: string } }) {
  const { data: deployment } = useDeployment(params.id)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircleIcon className="h-6 w-6 text-green-500" />
          Successfully Deployed!
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p>Your refactoring changes have been deployed.</p>

          <div className="bg-green-50 p-4 rounded-lg">
            <h4 className="font-semibold mb-2">Impact Summary</h4>
            <ul className="space-y-2">
              <li>✓ AI-Readiness Score improved by {deployment.scoreDelta} points</li>
              <li>✓ {deployment.issuesResolved} issues resolved</li>
              <li>✓ {deployment.filesChanged} files improved</li>
            </ul>
          </div>

          {deployment.pullRequestUrl && (
            <Button
              variant="outline"
              onClick={() => window.open(deployment.pullRequestUrl)}
            >
              View Pull Request →
            </Button>
          )}

          <Button
            onClick={() => router.push('/analysis')}
          >
            Run Another Analysis
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
```

## User Permissions

**Role-Based Access**:
```typescript
// Different user types have different capabilities

const PERMISSIONS = {
  developer: {
    canAnalyze: true,
    canRefactor: true,
    canApprove: true,
    canDeploy: true,
    canReject: true,
  },
  product_manager: {
    canAnalyze: true,
    canRefactor: true, // Can initiate, but needs dev approval
    canApprove: false, // Can't approve technical changes
    canDeploy: false,  // Can't deploy without dev approval
    canReject: true,   // Can reject suggestions
  },
  analyst: {
    canAnalyze: true,
    canRefactor: false, // View-only
    canApprove: false,
    canDeploy: false,
    canReject: false,
  },
  executive: {
    canAnalyze: true,
    canRefactor: false, // View metrics only
    canApprove: false,
    canDeploy: false,
    canReject: false,
  },
}
```

## Audit Trail

**Track All Actions**:
```typescript
// Every action tracked for compliance
await db.auditLog.create({
  data: {
    userId: user.id,
    tenantId: user.currentTenantId,
    action: 'refactoring.approved',
    resourceType: 'refactoring',
    resourceId: refactoring.id,
    metadata: {
      filesChanged: 5,
      scoreDelta: 16,
      reviewer: 'user_123',
      timestamp: new Date(),
    },
  },
})
```

## Consequences

### Positive
- **Accessibility**: Non-technical users can drive code quality
- **Adoption**: PMs and analysts become active users
- **Velocity**: Reduce developer bottleneck for simple tasks
- **Visibility**: Executives get real-time insights
- **Compliance**: Complete audit trail for SOC 2

### Negative
- **Complexity**: More UI to build and maintain
- **Risk**: Non-technical users making technical decisions
- **Support**: More user education required

### Mitigations
- **Approval Workflows**: Require dev approval for complex changes (ADR-020)
- **Safety Checks**: Automated tests must pass before deployment
- **Education**: In-app tutorials and tooltips
- **Rollback**: Easy undo for any deployment

## References
- ADR-012: User Portal (base UI patterns)
- ADR-020: Approval & Review System (multi-step approvals)
- ADR-021: One-Click Deployment (automation)
- FF-008: Visual Analysis Workflow
- FF-009: Refactoring Approval System
- FF-010: Deployment Pipeline UI

---

**Document Version**: 1.0
**Last Updated**: 2026-01-20
**Authors**: Product Team, Engineering Team
**Approved By**: Head of Product, CTO
