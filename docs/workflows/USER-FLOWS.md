# User Flow Diagrams: No-Code Analysis & Deployment

**Purpose**: Visual representations of non-technical user journeys through analysis, refactoring, and deployment workflows.
**Target Users**: Product Managers, Business Analysts, Executives
**Last Updated**: 2026-01-20

## Table of Contents

1. [Complete End-to-End Flow](#complete-end-to-end-flow)
2. [Visual Analysis Workflow](#visual-analysis-workflow)
3. [Refactoring Approval Workflow](#refactoring-approval-workflow)
4. [One-Click Deployment Workflow](#one-click-deployment-workflow)
5. [Error & Recovery Flows](#error--recovery-flows)
6. [User Personas & Journeys](#user-personas--journeys)

---

## Complete End-to-End Flow

### Overview: Analysis → Refactoring → Deployment

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        COMPLETE USER JOURNEY                             │
│                    (Product Manager / Analyst View)                      │
└─────────────────────────────────────────────────────────────────────────┘

     ┌──────────────┐
     │ User Login   │
     │ (Auth0 SSO)  │
     └──────┬───────┘
            │
            ▼
     ┌──────────────┐
     │  Dashboard   │ ◄──────────────────┐
     │  Home Page   │                    │
     └──────┬───────┘                    │
            │                            │
            │ "Analyze Repository"       │
            ▼                            │
┌───────────────────────┐                │
│ PHASE 1: ANALYSIS     │                │
├───────────────────────┤                │
│ 1. Select Repo        │                │
│    ↓                  │                │
│ 2. Click "Analyze"    │                │
│    ↓                  │                │
│ 3. Watch Progress     │                │
│    ├─ 0-100%          │                │
│    ├─ Live Updates    │                │
│    └─ ETA Counter     │                │
│    ↓                  │                │
│ 4. View Results       │                │
│    ├─ Score: 62/100   │                │
│    ├─ Charts          │                │
│    └─ Recommendations │                │
└───────┬───────────────┘                │
        │                                │
        │ Select "Start Refactoring"     │
        ▼                                │
┌───────────────────────┐                │
│ PHASE 2: REFACTORING  │                │
├───────────────────────┤                │
│ 1. Refactoring Wizard │                │
│    Step 1/4: Select   │                │
│    Step 2/4: Configure│                │
│    Step 3/4: Reviewers│                │
│    Step 4/4: Confirm  │                │
│    ↓                  │                │
│ 2. Auto Risk Analysis │                │
│    ├─ Low Risk (0-30) │────► Auto-Approve ────┐
│    ├─ Medium (31-70)  │────► 1 Approval       │
│    └─ High (71-100)   │────► 2+ Approvals     │
│    ↓                  │                        │
│ 3. Approval Process   │ ◄──────────────────────┘
│    ↓                  │
│ 4. Review Diff        │
│    ├─ Side-by-Side    │
│    ├─ Impact Metrics  │
│    └─ Comments        │
│    ↓                  │
│ 5. Approval Decision  │
│    ├─ Approve ✓       │
│    ├─ Reject ✗        │ ───► Notify Requester ──► Back to Dashboard
│    └─ Request Changes │ ───► Notify Requester ──► Back to Wizard
└───────┬───────────────┘
        │
        │ Approved ✓
        ▼
┌───────────────────────┐
│ PHASE 3: DEPLOYMENT   │
├───────────────────────┤
│ 1. Pre-Deploy Checks  │
│    ├─ Tests ✓         │
│    ├─ Security ✓      │
│    ├─ Lint ✓          │
│    ├─ Type Check ✓    │
│    └─ Build ✓         │
│    ↓                  │
│ 2. Select Strategy    │
│    ├─ Staging         │
│    ├─ Blue-Green      │
│    ├─ Canary          │
│    └─ Scheduled       │
│    ↓                  │
│ 3. Click "Deploy"     │
│    ↓                  │
│ 4. Watch Progress     │
│    ├─ Live Updates    │
│    ├─ Step-by-Step    │
│    └─ Logs            │
│    ↓                  │
│ 5. Deployment Success │
│    ├─ View Site       │
│    ├─ Run New Analysis│ ──► Back to Dashboard
│    └─ Rollback (if needed) ─► Restore Previous
└───────────────────────┘
```

---

## Visual Analysis Workflow

### User Story
> **As a Product Manager**, I want to analyze code quality without technical knowledge, so I can understand technical debt in my features.

### Flow Diagram

```
START: User clicks "New Analysis" from Dashboard
│
├─► [Repository Selection Screen]
│   │
│   ├─ Display: Searchable dropdown with repositories
│   │  ├─ Show: repo name, language, LOC, last analysis date
│   │  └─ Smart default: Most recently active repo pre-selected
│   │
│   ├─ User Action: Select repository from dropdown
│   │  └─ Validation: Ensure repo is connected (GitHub OAuth)
│   │
│   └─ User Action: Click "Analyze Now" button
│       │
│       ├─ API Call: POST /api/v1/analysis/visual/start
│       │  Body: { repositoryId, config: { autoDefaults: true } }
│       │  Response: { analysisId, estimatedDuration: 300 }
│       │
│       └─ Transition to Progress Screen
│
├─► [Live Progress Screen]
│   │
│   ├─ Display: Progress bar (0-100%)
│   ├─ Display: Current step with status icons
│   │  ├─ ✓ Repository cloned
│   │  ├─ ✓ Analyzing code complexity
│   │  ├─ ⏳ Checking documentation coverage (in progress)
│   │  ├─ ⋯ Generating recommendations
│   │  └─ ⋯ Calculating AI-Readiness Score
│   │
│   ├─ Display: ETA countdown (updates every 5 seconds)
│   │
│   ├─ User Action: [Cancel] button (optional)
│   │  └─ API Call: DELETE /api/v1/analysis/:id
│   │     └─ Return to Dashboard
│   │
│   └─ Auto-refresh: WebSocket connection for real-time updates
│       │
│       └─ On completion (progress: 100%) → Transition to Results
│
└─► [Results Dashboard]
    │
    ├─ Display: AI-Readiness Score Card
    │  ├─ Large score: 62/100
    │  ├─ Status badge: "Needs Improvement" (color-coded)
    │  └─ Trend: ↑ +5 from last week
    │
    ├─ Display: Visual Charts
    │  ├─ Pie Chart: Code Quality Breakdown
    │  │  ├─ Excellent: 15%
    │  │  ├─ Good: 35%
    │  │  ├─ Fair: 30%
    │  │  └─ Poor: 20%
    │  │
    │  └─ Bar Chart: Issues by Severity
    │     ├─ Critical: 3
    │     ├─ High: 12
    │     ├─ Medium: 47
    │     └─ Low: 89
    │
    ├─ Display: Top 5 Recommendations (sorted by impact)
    │  │
    │  └─ For each recommendation:
    │     ├─ Title: "Reduce complexity in auth.ts"
    │     ├─ Impact: +8 points to AI-Readiness
    │     ├─ Effort: 2 hours
    │     ├─ Risk Level: Low ✅ (color-coded)
    │     │
    │     └─ User Actions:
    │        ├─ [Start Refactoring] → Go to Refactoring Wizard
    │        ├─ [Ignore] → Hide recommendation
    │        └─ [Learn More] → Show detailed explanation
    │
    ├─ User Action: [Export PDF] button
    │  └─ Download: analysis-report-2026-01-20.pdf
    │
    ├─ User Action: [Share Results] button
    │  └─ Copy shareable link or send email
    │
    └─ User Action: [Run Another Analysis]
       └─ Return to Repository Selection

END: User exits or starts new action
```

### Key Metrics (Target)

- **Selection Time**: < 30 seconds
- **Analysis Duration**: 2-5 minutes (depending on repo size)
- **Progress Updates**: Every 5 seconds
- **Results Render Time**: < 2 seconds

---

## Refactoring Approval Workflow

### User Story
> **As a Product Manager**, I want to initiate refactoring without coding, but have a developer review it before deployment.

### Flow Diagram

```
START: User clicks "Start Refactoring" from recommendation card
│
├─► [Refactoring Wizard - Step 1/4: Select Recommendations]
│   │
│   ├─ Display: Checklist of recommendations (from analysis)
│   │  │
│   │  └─ For each recommendation:
│   │     ├─ ☑ Reduce complexity in auth.ts (+8 points)
│   │     ├─ ☑ Add docstrings to 47 functions (+12 points)
│   │     └─ ☐ Refactor database queries (+5 points)
│   │
│   ├─ Display: Total impact summary
│   │  ├─ Selected: 2 recommendations
│   │  └─ Total impact: +20 points
│   │
│   └─ User Action: Click "Next"
│       └─ Validation: At least 1 recommendation selected
│
├─► [Refactoring Wizard - Step 2/4: Configure Options]
│   │
│   ├─ Display: Configuration options
│   │  ├─ ☑ Auto-fix issues where possible
│   │  ├─ ☑ Create separate PR per recommendation
│   │  └─ ☐ Run full test suite after each change
│   │
│   └─ User Action: Click "Next"
│
├─► [Refactoring Wizard - Step 3/4: Assign Reviewers]
│   │
│   ├─ Display: Suggested reviewers (based on code ownership)
│   │  ├─ ☑ John Doe (Tech Lead) - Recommended
│   │  ├─ ☐ Jane Smith (Senior Dev)
│   │  └─ ☐ Security Team (if high-risk detected)
│   │
│   ├─ Display: Notification preferences
│   │  ├─ ☑ Email notification
│   │  ├─ ☑ Slack notification
│   │  └─ Deadline: 24 hours (auto-escalate if no response)
│   │
│   └─ User Action: Click "Next"
│       └─ Validation: At least 1 reviewer selected
│
├─► [Refactoring Wizard - Step 4/4: Confirm & Start]
│   │
│   ├─ Display: Summary of selections
│   │  ├─ Recommendations: 2 selected
│   │  ├─ Options: Auto-fix enabled
│   │  ├─ Reviewers: John Doe (Tech Lead)
│   │  └─ Deadline: Jan 20, 2026 2:00 PM
│   │
│   ├─ User Action: Click "Start Refactoring"
│   │  │
│   │  ├─ API Call: POST /api/v1/refactoring/wizard/start
│   │  │  Body: {
│   │  │    recommendations: ["rec_1", "rec_2"],
│   │  │    options: { autoFix: true, separatePRs: true },
│   │  │    reviewers: ["user_123"],
│   │  │    deadline: "2026-01-20T14:00:00Z"
│   │  │  }
│   │  │  Response: { refactoringId: "ref_789", workflowId: "wf_456" }
│   │  │
│   │  ├─ Background: AI generates refactoring changes
│   │  ├─ Background: Risk analysis runs automatically
│   │  └─ Background: Notification sent to reviewers
│   │
│   └─ Transition to Approval Timeline
│
├─► [AI Risk Analysis - Automatic Background Process]
│   │
│   ├─ Analyze refactoring impact:
│   │  ├─ File count: 5 files → Risk +10
│   │  ├─ Complexity delta: -15 → Risk -5
│   │  ├─ Test coverage: +8% → Risk -8
│   │  ├─ Security scan: 0 issues → Risk +0
│   │  └─ Critical path: Not affected → Risk +0
│   │
│   ├─ Calculate risk score: 32/100 (Medium Risk)
│   │
│   └─ Auto-route approval:
│      ├─ Low Risk (0-30) → Auto-approve, deploy immediately
│      ├─ Medium Risk (31-70) → 1 technical approval required ✓
│      └─ High Risk (71-100) → 2+ approvals required (Tech Lead + Security)
│
├─► [Approval Timeline - Requester View]
│   │
│   ├─ Display: Visual timeline
│   │  │
│   │  ├─ ● Requested by Sarah (PM)
│   │  │   └─ Jan 20, 2026 10:00 AM
│   │  │
│   │  ├─ ● Awaiting Approval: John (Tech Lead)
│   │  │   ├─ Status: Pending ⏳
│   │  │   └─ Deadline: Jan 20, 2026 2:00 PM (4 hours)
│   │  │
│   │  └─ ○ Pending: Security Team (if needed)
│   │
│   ├─ User Action: View diff preview (read-only)
│   └─ User Action: Cancel refactoring (if needed)
│
└─► [Approval Timeline - Reviewer View]
    │
    ├─ Display: Notification received
    │  ├─ Email: "Sarah requested your review for refactoring"
    │  └─ Slack: "@john - New refactoring approval needed"
    │
    ├─ User Action: Click notification link
    │  └─ Navigate to Side-by-Side Diff Viewer
    │
    ├─► [Side-by-Side Diff Viewer]
    │   │
    │   ├─ Display: File navigation
    │   │  └─ "File 1 of 5: src/auth.ts"
    │   │
    │   ├─ Display: Split view
    │   │  │
    │   │  ├─ Left Panel: Before (Current Code)
    │   │  │  └─ function auth() {
    │   │  │       if (user) { return true }
    │   │  │       return false
    │   │  │     }
    │   │  │
    │   │  └─ Right Panel: After (Refactored Code)
    │   │     └─ /**
    │   │          * Authenticates user
    │   │          */
    │   │         function auth() {
    │   │           return user !== null
    │   │         }
    │   │
    │   ├─ Display: Impact summary
    │   │  ├─ Complexity: -3 (improved)
    │   │  ├─ Readability: +15%
    │   │  └─ Risk Level: Low ✅
    │   │
    │   ├─ Display: Test results
    │   │  ├─ Unit tests: 47/47 passed ✓
    │   │  ├─ Integration tests: 12/12 passed ✓
    │   │  └─ Coverage: 92% (+5%)
    │   │
    │   └─ User Actions:
    │      ├─ [← Previous] / [Next →] - Navigate files
    │      ├─ [✓ Approve] - Approve all changes
    │      ├─ [✗ Reject] - Reject with reason
    │      └─ [Request Changes] - Send feedback to requester
    │
    ├─ Decision Path: Approve ✓
    │  │
    │  ├─ API Call: POST /api/v1/approvals/:id/approve
    │  │  Body: { comment: "LGTM - clean refactoring" }
    │  │  Response: { status: "approved", nextStep: "deployment" }
    │  │
    │  ├─ Update: Approval timeline marked as approved
    │  ├─ Notification: Sent to requester (Sarah)
    │  └─ Auto-trigger: Move to deployment phase
    │
    ├─ Decision Path: Reject ✗
    │  │
    │  ├─ User Action: Enter rejection reason
    │  ├─ API Call: POST /api/v1/approvals/:id/reject
    │  ├─ Notification: Sent to requester with reason
    │  └─ END: Refactoring blocked (requester can revise and resubmit)
    │
    └─ Decision Path: Request Changes
       │
       ├─ User Action: Enter feedback comments
       ├─ API Call: POST /api/v1/approvals/:id/request-changes
       ├─ Notification: Sent to requester with feedback
       └─ Requester Action: Revise wizard and resubmit
          └─ Return to Refactoring Wizard (Step 1)

END: Approval complete → Proceed to Deployment
```

### Key Metrics (Target)

- **Wizard Completion**: < 3 minutes
- **Risk Analysis**: < 10 seconds
- **Approval Notification**: < 1 minute
- **Review Time**: < 5 clicks to approve
- **Auto-escalation**: 24 hours if no response

---

## One-Click Deployment Workflow

### User Story
> **As a Product Manager**, I want to deploy approved changes with one click, so I don't need developer help.

### Flow Diagram

```
START: Refactoring approved → Auto-navigate to deployment
│
├─► [Pre-Deployment Checklist Screen]
│   │
│   ├─ Display: Automated safety checks (running in background)
│   │  │
│   │  ├─ ✓ Unit & Integration Tests (47/47 passed)
│   │  │  └─ Duration: 1m 23s
│   │  │
│   │  ├─ ✓ Security Scan (0 vulnerabilities)
│   │  │  └─ Scanned: 5 files, 847 LOC
│   │  │
│   │  ├─ ✓ Lint Check (0 errors)
│   │  │  └─ ESLint: All rules passed
│   │  │
│   │  ├─ ✓ Type Check (no issues)
│   │  │  └─ TypeScript: Strict mode passed
│   │  │
│   │  └─ ✓ Build Verification (success)
│   │     └─ Bundle size: 187 KB (within budget)
│   │
│   ├─ Conditional: All checks passed?
│   │  │
│   │  ├─ YES → Enable "Deploy" button
│   │  │  └─ Display: "All checks passed! Ready to deploy." ✅
│   │  │
│   │  └─ NO → Block deployment
│   │     ├─ Display: Failed check details with error messages
│   │     ├─ Display: "Deployment blocked - fix errors first" ⚠️
│   │     └─ User Action: [View Logs] → Show detailed error output
│   │
│   └─ User Action: Select deployment strategy
│
├─► [Deployment Strategy Selection]
│   │
│   ├─ Display: Strategy options
│   │  │
│   │  ├─ ○ Staging (default)
│   │  │  ├─ Description: "Deploy to staging environment for testing"
│   │  │  ├─ ETA: ~5 minutes
│   │  │  └─ Risk: Low
│   │  │
│   │  ├─ ○ Blue-Green
│   │  │  ├─ Description: "Zero-downtime production deployment"
│   │  │  ├─ ETA: ~10 minutes
│   │  │  └─ Risk: Low (instant rollback available)
│   │  │
│   │  ├─ ○ Canary
│   │  │  ├─ Description: "Gradual rollout: 10% → 25% → 50% → 100%"
│   │  │  ├─ ETA: ~45 minutes (with monitoring pauses)
│   │  │  └─ Risk: Very Low (automatic rollback on errors)
│   │  │
│   │  └─ ○ Scheduled
│   │     ├─ Description: "Schedule deployment for specific date/time"
│   │     ├─ Date Picker: Select future date/time
│   │     └─ Timezone: User's local timezone
│   │
│   └─ User Action: Select strategy and click "Next"
│
├─► [Deployment Confirmation Dialog]
│   │
│   ├─ Display: Confirmation modal
│   │  │
│   │  ├─ Title: "Ready to Deploy"
│   │  ├─ Strategy: Staging
│   │  ├─ Files: 5 files changed
│   │  ├─ Impact: AI-Readiness Score +20 points
│   │  └─ Warning: "This will update the staging environment"
│   │
│   └─ User Action: Click "Deploy Now"
│      │
│      ├─ Prevent accidental clicks: Confirmation required
│      └─ API Call: POST /api/v1/deployments/deploy
│         Body: {
│           refactoringId: "ref_789",
│           strategy: "staging"
│         }
│         Response: {
│           deploymentId: "dep_123",
│           estimatedDuration: 300
│         }
│
├─► [Real-Time Deployment Progress]
│   │
│   ├─ Display: Progress bar (0-100%)
│   │  └─ [████████████████░░░░░░] 65%
│   │
│   ├─ Display: Step-by-step status (with icons)
│   │  │
│   │  ├─ ✓ Running tests (completed)
│   │  ├─ ✓ Building Docker image (completed)
│   │  ├─ ⏳ Deploying to ECS cluster (in progress)
│   │  ├─ ⋯ Running health checks (pending)
│   │  └─ ⋯ Updating load balancer (pending)
│   │
│   ├─ Display: ETA countdown
│   │  └─ "Estimated time remaining: 3 minutes"
│   │
│   ├─ Display: Live logs (expandable)
│   │  │
│   │  └─ User Action: Click [View Logs ▼]
│   │     └─ Show real-time deployment logs
│   │        ├─ [12:34:56] Building Docker image...
│   │        ├─ [12:35:23] Pushing to ECR...
│   │        ├─ [12:36:01] Deploying to ECS...
│   │        └─ [12:37:15] Health check passed ✓
│   │
│   ├─ WebSocket Updates: Every 5 seconds
│   │  └─ API: GET /api/v1/deployments/:id/progress
│   │     Response: { progress: 65, status: "deploying", eta: 180 }
│   │
│   └─ Conditional: Deployment complete (progress: 100%)
│      │
│      ├─ SUCCESS → Transition to Success Screen
│      └─ FAILURE → Transition to Error Screen
│
├─► [Deployment Success Screen]
│   │
│   ├─ Display: Success message
│   │  │
│   │  ├─ ✓ Deployment Successful!
│   │  ├─ "Your changes are now live in staging."
│   │  └─ Timestamp: Jan 20, 2026 12:45 PM
│   │
│   ├─ Display: Impact summary
│   │  │
│   │  ├─ AI-Readiness Score: 62 → 78 (+16)
│   │  ├─ Files refactored: 5
│   │  ├─ Issues resolved: 47
│   │  └─ Test coverage: 87% → 92% (+5%)
│   │
│   ├─ Display: Deployment details
│   │  │
│   │  ├─ Environment: Staging
│   │  ├─ URL: https://staging.example.com
│   │  ├─ Deployment ID: dep_123
│   │  └─ Duration: 8m 42s
│   │
│   └─ User Actions:
│      │
│      ├─ [View Staging Site]
│      │  └─ Open staging URL in new tab
│      │
│      ├─ [Run Another Analysis]
│      │  └─ Return to dashboard, start new analysis
│      │
│      ├─ [Deploy to Production]
│      │  └─ If staging deployment, option to promote
│      │
│      └─ [Share Results]
│         └─ Send email/Slack notification to team
│
└─► [Deployment Error Screen] (if deployment fails)
    │
    ├─ Display: Error message
    │  │
    │  ├─ ✗ Deployment Failed
    │  ├─ Error: "Health check failed - service not responding"
    │  └─ Timestamp: Jan 20, 2026 12:40 PM
    │
    ├─ Display: Error details
    │  │
    │  ├─ Failed at: "Running health checks" (step 4/5)
    │  ├─ Error code: HEALTH_CHECK_TIMEOUT
    │  └─ Logs: [Show Last 50 Lines]
    │
    ├─ Display: Auto-rollback status
    │  │
    │  ├─ ✓ Automatic rollback initiated
    │  ├─ ✓ Previous version restored
    │  └─ Service is stable (reverted to pre-deployment state)
    │
    └─ User Actions:
       │
       ├─ [View Full Logs]
       │  └─ Download complete deployment logs
       │
       ├─ [Contact Support]
       │  └─ Create support ticket with error details
       │
       └─ [Retry Deployment]
          └─ Return to deployment strategy selection

END: Deployment complete → Return to dashboard or start new action
```

### Key Metrics (Target)

- **Pre-deployment Checks**: < 2 minutes
- **Deployment Duration**: < 10 minutes
- **Progress Updates**: Every 5 seconds
- **Rollback Time**: < 5 minutes
- **Success Rate**: > 95%

---

## Error & Recovery Flows

### Analysis Errors

```
┌─────────────────────────────────────────────────┐
│ ERROR: Analysis Failed                          │
├─────────────────────────────────────────────────┤
│                                                  │
│ Common Scenarios:                                │
│                                                  │
│ 1. Repository Clone Failed                      │
│    ├─ Cause: Invalid credentials, private repo  │
│    ├─ Action: Prompt to reconnect GitHub OAuth  │
│    └─ Recovery: [Reconnect GitHub] button       │
│                                                  │
│ 2. Analysis Timeout (> 15 minutes)              │
│    ├─ Cause: Repository too large (> 1M LOC)    │
│    ├─ Action: Suggest breaking into modules     │
│    └─ Recovery: [Analyze Specific Directory]    │
│                                                  │
│ 3. Unsupported Language                         │
│    ├─ Cause: Repo uses unsupported language     │
│    ├─ Action: Show supported languages list     │
│    └─ Recovery: [Request Language Support]      │
│                                                  │
│ 4. Network Error                                │
│    ├─ Cause: Connection lost during analysis    │
│    ├─ Action: Auto-retry 3 times with backoff   │
│    └─ Recovery: [Retry Analysis]                │
│                                                  │
└─────────────────────────────────────────────────┘
```

### Approval Errors

```
┌─────────────────────────────────────────────────┐
│ ERROR: Approval Workflow Failed                 │
├─────────────────────────────────────────────────┤
│                                                  │
│ 1. No Response from Reviewer (24+ hours)        │
│    ├─ Auto-escalate to next level              │
│    ├─ Notify: Manager or backup reviewer       │
│    └─ User Action: [Change Reviewer]           │
│                                                  │
│ 2. Reviewer Rejected Changes                    │
│    ├─ Display: Rejection reason                │
│    ├─ User Action: Read feedback               │
│    └─ User Action: [Revise and Resubmit]       │
│                                                  │
│ 3. Merge Conflict Detected                      │
│    ├─ Cause: Code changed since analysis       │
│    ├─ Action: Re-run analysis on latest code   │
│    └─ User Action: [Re-analyze Repository]     │
│                                                  │
└─────────────────────────────────────────────────┘
```

### Deployment Errors

```
┌─────────────────────────────────────────────────┐
│ ERROR: Deployment Failed                        │
├─────────────────────────────────────────────────┤
│                                                  │
│ 1. Pre-Deployment Check Failed                  │
│    ├─ Cause: Tests failing, security issues    │
│    ├─ Action: Block deployment                 │
│    ├─ Display: Failed check details            │
│    └─ User Action: [View Logs] [Fix Issues]    │
│                                                  │
│ 2. Health Check Timeout                         │
│    ├─ Cause: Service not responding            │
│    ├─ Auto-action: Automatic rollback          │
│    └─ User Action: [View Logs] [Contact Devs]  │
│                                                  │
│ 3. Resource Limits Exceeded                     │
│    ├─ Cause: Memory/CPU limits hit             │
│    ├─ Action: Rollback + alert DevOps          │
│    └─ User Action: [Retry] [Upgrade Plan]      │
│                                                  │
│ 4. Blue-Green Switch Failed                     │
│    ├─ Cause: Load balancer error               │
│    ├─ Action: Keep old version running         │
│    └─ User Action: [Retry] [Manual Rollback]   │
│                                                  │
└─────────────────────────────────────────────────┘
```

---

## User Personas & Journeys

### Persona 1: Sarah - Product Manager

**Background**: Non-technical, manages feature roadmap, wants to track code quality metrics without bothering developers.

**Goals**:
- Understand technical debt in her features
- Make data-driven prioritization decisions
- Track code quality trends over time

**Journey**:

```
Monday Morning:
├─ 9:00 AM: Sarah logs into Forge Factory
├─ 9:05 AM: Clicks "New Analysis" for feature repo
├─ 9:06 AM: Selects "mobile-checkout" repository
├─ 9:07 AM: Clicks "Analyze Now", watches progress
├─ 9:12 AM: Analysis complete - Score: 58/100 ⚠️
├─ 9:15 AM: Reviews recommendations, sees "Reduce complexity in payment.ts (+12 points)"
├─ 9:20 AM: Clicks "Start Refactoring", completes wizard
├─ 9:25 AM: Assigns tech lead (John) as reviewer, sets 24hr deadline
└─ 9:30 AM: Receives confirmation, returns to dashboard

Tuesday Afternoon:
├─ 2:00 PM: Sarah receives Slack notification: "John approved your refactoring"
├─ 2:05 PM: Navigates to deployment screen, sees all checks passed ✓
├─ 2:10 PM: Selects "Staging" deployment strategy
├─ 2:11 PM: Clicks "Deploy Now", watches progress bar
├─ 2:18 PM: Deployment successful! Score now 70/100 ✅
├─ 2:20 PM: Clicks "View Staging Site" to verify changes
└─ 2:25 PM: Sends update to team: "Payment code quality improved +12 points"
```

**Pain Points Resolved**:
- ✅ No need to understand code
- ✅ No need to ask developers for help
- ✅ Clear visual feedback on impact
- ✅ Automated safety checks prevent mistakes

---

### Persona 2: Mike - Business Analyst

**Background**: Analyst reporting to executives, needs to track engineering KPIs, wants exportable metrics.

**Goals**:
- Generate weekly code quality reports for execs
- Track ROI of refactoring investments
- Identify high-risk technical debt

**Journey**:

```
Friday (Weekly Report Day):
├─ 10:00 AM: Mike runs analysis on all 5 active repositories
├─ 10:15 AM: All analyses complete (parallel execution)
├─ 10:20 AM: Opens dashboard, sees aggregated metrics:
│  ├─ Average score across repos: 67/100
│  ├─ Trend: ↑ +8 from last week
│  └─ High-risk repos: 1 (needs attention)
├─ 10:30 AM: Clicks "Export PDF" for each repo
├─ 10:35 AM: Compiles PDF reports into executive summary
├─ 10:45 AM: Adds commentary: "Authentication service improved from 52 → 71"
└─ 11:00 AM: Sends weekly report to CTO and VPs
```

**Pain Points Resolved**:
- ✅ No manual data collection
- ✅ Automated trend tracking
- ✅ Professional PDF exports
- ✅ Historical comparison built-in

---

### Persona 3: Alex - Tech Lead (Reviewer)

**Background**: Experienced developer, reviews PM-initiated refactoring, wants efficient approval process.

**Goals**:
- Quickly review non-technical user changes
- Ensure code quality standards maintained
- Minimal time spent on approvals (< 10 min)

**Journey**:

```
Tuesday Morning:
├─ 11:00 AM: Alex receives Slack: "Sarah requested refactoring review"
├─ 11:05 AM: Clicks notification link → Opens diff viewer
├─ 11:06 AM: Reviews File 1/5: auth.ts
│  ├─ Sees side-by-side diff
│  ├─ Complexity: -3 (good!)
│  ├─ Tests: All passed ✓
│  └─ Risk: Low ✅
├─ 11:08 AM: Clicks "Next" through remaining 4 files
├─ 11:10 AM: All changes look good, clicks "✓ Approve"
├─ 11:11 AM: Adds comment: "LGTM - nice cleanup"
└─ 11:12 AM: Approval sent, Sarah notified automatically
```

**Pain Points Resolved**:
- ✅ Clear diff viewer (no need to check out code)
- ✅ Impact metrics shown upfront
- ✅ Automated test results visible
- ✅ One-click approval (no GitHub/CLI needed)

---

## Accessibility Considerations

### Keyboard Navigation

All workflows support full keyboard navigation:

```
Tab Order:
1. Repository dropdown (Enter to expand)
2. Search input (Type to filter)
3. Repository items (Arrow keys to navigate, Enter to select)
4. "Analyze Now" button (Enter to activate)
5. Progress screen: "Cancel" button (Esc or Enter)
6. Results: Recommendations (Tab through, Enter to activate)
7. Wizard steps: Form fields (Tab through, Enter to proceed)
8. Diff viewer: Navigation buttons (Arrow keys, Enter)
9. Deployment: Strategy radios (Arrow keys), "Deploy" button (Enter)
```

### Screen Reader Support

- All progress updates announced via ARIA live regions
- Status icons have text alternatives: ✓ = "Completed", ⏳ = "In progress"
- Charts have data table alternatives
- Error messages have role="alert" for immediate announcement

### Color Accessibility

- Risk levels use both color AND icons:
  - Low: Green ✅
  - Medium: Yellow ⚠️
  - High: Red 🚨
- WCAG 2.1 AA contrast ratios (4.5:1 minimum)
- Colorblind-friendly palette

---

## Mobile Responsiveness

### Mobile Optimizations

```
Mobile Layout Changes:

Analysis Screen (Mobile):
┌─────────────────────────┐
│ [☰] Analyze Repository  │
├─────────────────────────┤
│ Repository:              │
│ ┌─────────────────────┐ │
│ │ acme-corp/api-srv ▼ │ │
│ └─────────────────────┘ │
│                          │
│ [Analyze Now] (full-width)│
└─────────────────────────┘

Results (Mobile - Vertical Stack):
┌─────────────────────────┐
│ Score: 62/100            │
│ [────────62%──────]      │
├─────────────────────────┤
│ Quality Breakdown        │
│ [Pie Chart]              │
├─────────────────────────┤
│ Issues by Severity       │
│ [Bar Chart]              │
├─────────────────────────┤
│ Recommendations          │
│ 1. Reduce complexity... │
│    [Start] [Ignore]      │
└─────────────────────────┘
```

### Touch Optimizations

- Minimum touch target: 44x44px
- Swipe gestures for file navigation
- Pull-to-refresh for status updates
- Bottom sheet for modals

---

## Performance Metrics

### Target Load Times

| Screen | Target | Current | Status |
|--------|--------|---------|--------|
| Repository Selection | < 1s | 0.8s | ✅ |
| Analysis Progress | < 0.5s | 0.3s | ✅ |
| Results Dashboard | < 2s | 1.7s | ✅ |
| Diff Viewer | < 1.5s | 1.2s | ✅ |
| Deployment Progress | < 0.5s | 0.4s | ✅ |

### Real-Time Update Latency

- WebSocket connection: < 100ms
- Progress updates: Every 5s (max)
- Log streaming: < 500ms delay

---

## Version History

- **v1.0** (2026-01-20): Initial user flows for no-code workflows
- **v1.1** (TBD): Add canary deployment monitoring flows
- **v1.2** (TBD): Add multi-repository batch operations

---

**Related Documentation**:
- ADR-019: No-Code Analysis & Refactoring Workflows
- ADR-020: Approval & Review System
- ADR-021: One-Click Deployment Pipeline
- FF-008: Visual Analysis Workflow (UI Spec)
- FF-009: Refactoring Approval System (UI Spec)
- FF-010: Deployment Pipeline UI (UI Spec)
