# FF-009: Refactoring Approval System

**Status**: Ready for Implementation
**Priority**: P0 (Critical - Safety for Non-Technical Users)
**Estimated Effort**: 4 weeks
**Dependencies**: ADR-020 (Approval System), FF-008 (Visual Analysis)

## Overview

Multi-step approval workflow for refactoring changes initiated by non-technical users, ensuring code quality and safety.

## User Stories

**As a Product Manager**, I want to start refactoring without knowing code, but have a developer review it before deployment.

**As a Tech Lead**, I want to review and approve PM-initiated refactorings, so I maintain code quality.

**As a CTO**, I want visibility into all major code changes, so I can ensure architectural consistency.

## Key Features

### 1. Refactoring Wizard (4-Step)
- **Step 1**: Select recommendations to apply
- **Step 2**: Configure options (auto-fix, separate PRs)
- **Step 3**: Assign reviewers (tech lead, senior dev)
- **Step 4**: Confirm and start

### 2. Side-by-Side Diff Viewer
- **Before/After**: Syntax-highlighted code comparison
- **Impact Summary**: Complexity, readability, risk metrics
- **File Navigation**: Previous/Next buttons
- **Approval Actions**: Approve, Reject, Request Changes

### 3. Risk-Based Auto-Routing
- **Low Risk (0-30)**: Auto-approved, deploy immediately
- **Medium Risk (31-70)**: 1 technical approval required
- **High Risk (71-100)**: 2+ approvals required (tech lead + security)

### 4. Approval Timeline
- Visual timeline showing approval steps
- Status: Pending, Approved, Rejected, Changes Requested
- Timestamps and approver names
- Comments thread

### 5. One-Click Actions
- **Approve**: Mark as approved, advance to next step
- **Reject**: Block deployment, notify requester
- **Request Changes**: Send feedback to requester

## UI Mockups

### Refactoring Wizard
```
┌─────────────────────────────────────────────────────┐
│  Refactoring Wizard                                  │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━    │
│                                                       │
│  Step 1: Select Recommendations (1/4)                │
│                                                       │
│  ☑ Reduce complexity in auth.ts (+8 points)         │
│  ☑ Add docstrings to functions (+12 points)         │
│  ☐ Refactor database queries (+5 points)            │
│                                                       │
│  [Back] [Next →]                                     │
│                                                       │
└─────────────────────────────────────────────────────┘
```

### Side-by-Side Diff
```
┌─────────────────────────────────────────────────────┐
│  Review Changes: src/auth.ts (File 1 of 5)          │
├─────────────────────────────────────────────────────┤
│  Before                │  After (Refactored)         │
│ ─────────────────────  │ ─────────────────────────  │
│  function auth() {     │  /**                        │
│    if (user) {         │   * Authenticates user      │
│      return true       │   */                        │
│    }                   │  function auth() {          │
│    return false        │    return user !== null     │
│  }                     │  }                          │
├─────────────────────────────────────────────────────┤
│  Impact: Complexity -3 | Readability +15% | Risk: Low│
│                                                       │
│  [✓ Approve] [✗ Reject] [Request Changes]           │
│  [← Previous] [Next →]                               │
└─────────────────────────────────────────────────────┘
```

### Approval Timeline
```
┌─────────────────────────────────────────────────────┐
│  Approval Timeline                                   │
├─────────────────────────────────────────────────────┤
│                                                       │
│  ● Requested by Sarah (PM)                           │
│  │ Jan 20, 2026 10:00 AM                             │
│  │                                                    │
│  ● Awaiting Approval: John (Tech Lead)               │
│  │ Deadline: Jan 20, 2026 2:00 PM                    │
│  │                                                    │
│  ○ Pending: Security Team (if needed)                │
│                                                       │
└─────────────────────────────────────────────────────┘
```

## API Endpoints

```
POST /api/v1/refactoring/wizard/start
Body: { recommendations: ["rec_1", "rec_2"], options: {...} }
Response: { refactoringId: "ref_789", workflowId: "wf_456" }

GET /api/v1/refactoring/:id/diff
Response: { files: [{ before, after, impact }] }

POST /api/v1/approvals/:id/approve
Body: { comment: "LGTM" }
Response: { status: "approved", nextStep: {...} }
```

## Acceptance Criteria

- [ ] PM can initiate refactoring without technical knowledge
- [ ] Tech lead receives notification within 1 minute
- [ ] Diff viewer highlights changes clearly
- [ ] Approval takes < 5 clicks
- [ ] Auto-escalation if no response in 24 hours
- [ ] Audit trail tracks all approvals/rejections

---

**Version**: 1.0
**Last Updated**: 2026-01-20
