# ADR-054: Branch Protection & Merge Strategies

**Status:** Accepted
**Date:** 2026-01-21
**Priority:** P1 - Enterprise Ready
**Complexity:** Medium

---

## Context

AI-generated code changes must follow the same rigor as human-written code. **Branch protection and merge strategies** ensure that transformations don't accidentally break production code and maintain code quality standards.

### Business Requirements

- **Protection:** Prevent direct pushes to main/master branches
- **Review:** Require human approval for AI-generated changes
- **Validation:** All checks must pass before merge
- **Audit:** Complete history of who approved what
- **Flexibility:** Support different workflows per repository

### Branch Protection Challenges

| Challenge | Risk | Mitigation |
|-----------|------|------------|
| Bypassing Reviews | Bad code in prod | Enforce protection |
| Stale Branches | Merge conflicts | Auto-rebase |
| Slow CI | Developer friction | Parallel checks |
| Force Push | Lost history | Disable force push |
| Admin Override | Inconsistent policy | Audit logging |

### Merge Strategy Options

| Strategy | Pros | Cons |
|----------|------|------|
| Merge Commit | Full history | Noisy history |
| Squash Merge | Clean history | Lost granularity |
| Rebase Merge | Linear history | Rewrite risk |
| Fast-Forward | Simple history | Requires rebase |

---

## Decision

We will implement a **comprehensive branch protection system** with:

1. **Branch Protection Rules** - Configurable protection policies
2. **Merge Strategy Engine** - Smart merge strategy selection
3. **Pre-Merge Validation** - Automated checks before merge
4. **Approval Workflows** - Human-in-the-loop approvals
5. **Merge Automation** - Auto-merge when criteria met

### Architecture Overview

```typescript
interface BranchProtectionSystem {
  // Configuration
  configureProtection(repo: Repository, rules: ProtectionRules): Promise<void>;

  // Validation
  validateMerge(pr: PullRequest): Promise<MergeValidation>;

  // Merge execution
  executeMerge(pr: PullRequest, strategy: MergeStrategy): Promise<MergeResult>;

  // Approval management
  requestApproval(pr: PullRequest, reviewers: string[]): Promise<ApprovalRequest>;
  checkApprovalStatus(pr: PullRequest): Promise<ApprovalStatus>;
}

interface ProtectionRules {
  branch: string;                     // Branch pattern (e.g., "main", "release/*")

  // Merge requirements
  requirePullRequest: boolean;
  requiredApprovals: number;
  dismissStaleReviews: boolean;
  requireCodeOwnerReview: boolean;

  // Status checks
  requiredStatusChecks: string[];
  strictStatusChecks: boolean;        // Require branch to be up-to-date

  // Restrictions
  allowForcePush: boolean;
  allowDeletion: boolean;
  restrictPushAccess: string[];       // Users/teams who can push

  // Merge strategies
  allowedMergeStrategies: MergeStrategy[];
  defaultMergeStrategy: MergeStrategy;
  squashMergeCommitMessage: 'pr_title' | 'pr_body' | 'blank';
}

interface MergeValidation {
  canMerge: boolean;
  blockers: MergeBlocker[];
  warnings: MergeWarning[];
  requiredActions: RequiredAction[];
}

interface MergeBlocker {
  type: BlockerType;
  message: string;
  resolution: string;
}
```

### Component 1: Branch Protection Rules

Configure and enforce branch protection.

```typescript
class BranchProtectionManager {
  constructor(
    private gitProvider: GitProvider,
    private policyStore: PolicyStore
  ) {}

  async configureProtection(
    repo: Repository,
    rules: ProtectionRules
  ): Promise<void> {
    // Validate rules
    this.validateRules(rules);

    // Apply to git provider (GitHub, GitLab, etc.)
    await this.gitProvider.setBranchProtection(repo, rules);

    // Store local policy for enforcement
    await this.policyStore.savePolicy(repo.id, rules);

    // Set up webhooks for enforcement
    await this.setupEnforcementWebhooks(repo, rules);
  }

  async getEffectiveRules(
    repo: Repository,
    branch: string
  ): Promise<ProtectionRules> {
    const policies = await this.policyStore.getPolicies(repo.id);

    // Find matching policy (supports wildcards)
    const matchingPolicy = policies.find(p =>
      this.branchMatchesPattern(branch, p.branch)
    );

    if (!matchingPolicy) {
      return this.getDefaultRules();
    }

    return matchingPolicy;
  }

  private branchMatchesPattern(branch: string, pattern: string): boolean {
    // Convert glob pattern to regex
    const regex = new RegExp(
      '^' +
      pattern
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.')
      + '$'
    );

    return regex.test(branch);
  }

  async enforceProtection(
    repo: Repository,
    branch: string,
    action: BranchAction
  ): Promise<EnforcementResult> {
    const rules = await this.getEffectiveRules(repo, branch);

    switch (action.type) {
      case 'push':
        return this.enforcePushProtection(rules, action);

      case 'force_push':
        if (!rules.allowForcePush) {
          return {
            allowed: false,
            reason: 'Force push is not allowed on protected branches',
          };
        }
        return { allowed: true };

      case 'delete':
        if (!rules.allowDeletion) {
          return {
            allowed: false,
            reason: 'Deletion is not allowed on protected branches',
          };
        }
        return { allowed: true };

      default:
        return { allowed: true };
    }
  }

  private enforcePushProtection(
    rules: ProtectionRules,
    action: PushAction
  ): EnforcementResult {
    // Check if user is allowed to push directly
    if (rules.requirePullRequest) {
      if (!rules.restrictPushAccess.includes(action.user)) {
        return {
          allowed: false,
          reason: 'Direct push not allowed. Please create a pull request.',
        };
      }
    }

    return { allowed: true };
  }
}
```

### Component 2: Merge Strategy Engine

Select and execute optimal merge strategy.

```typescript
class MergeStrategyEngine {
  constructor(
    private gitProvider: GitProvider,
    private conflictResolver: ConflictResolver
  ) {}

  async selectStrategy(
    pr: PullRequest,
    rules: ProtectionRules
  ): Promise<MergeStrategy> {
    const allowedStrategies = rules.allowedMergeStrategies;

    // If only one strategy allowed, use it
    if (allowedStrategies.length === 1) {
      return allowedStrategies[0];
    }

    // Analyze PR to select optimal strategy
    const analysis = await this.analyzePR(pr);

    // For AI-generated code, prefer squash merge for clean history
    if (pr.labels.includes('ai-generated')) {
      if (allowedStrategies.includes('squash')) {
        return 'squash';
      }
    }

    // For multiple meaningful commits, prefer merge commit
    if (analysis.commitCount > 3 && analysis.hasDistinctChanges) {
      if (allowedStrategies.includes('merge')) {
        return 'merge';
      }
    }

    // For clean linear history, prefer rebase
    if (analysis.isLinear && !analysis.hasConflicts) {
      if (allowedStrategies.includes('rebase')) {
        return 'rebase';
      }
    }

    // Default to configured default
    return rules.defaultMergeStrategy;
  }

  async executeMerge(
    pr: PullRequest,
    strategy: MergeStrategy
  ): Promise<MergeResult> {
    // Pre-merge checks
    const validation = await this.validatePreMerge(pr);
    if (!validation.canMerge) {
      return { success: false, blockers: validation.blockers };
    }

    // Resolve conflicts if any
    if (validation.hasConflicts) {
      const resolved = await this.conflictResolver.resolve(pr);
      if (!resolved.success) {
        return { success: false, error: 'Could not resolve conflicts' };
      }
    }

    // Execute merge based on strategy
    switch (strategy) {
      case 'squash':
        return this.executeSquashMerge(pr);

      case 'merge':
        return this.executeMergeCommit(pr);

      case 'rebase':
        return this.executeRebaseMerge(pr);

      case 'fast-forward':
        return this.executeFastForward(pr);

      default:
        throw new Error(`Unknown merge strategy: ${strategy}`);
    }
  }

  private async executeSquashMerge(pr: PullRequest): Promise<MergeResult> {
    // Combine all commits into one
    const commitMessage = await this.generateSquashCommitMessage(pr);

    const result = await this.gitProvider.squashMerge(pr, {
      commitMessage,
      commitTitle: pr.title,
    });

    return {
      success: true,
      mergeCommit: result.sha,
      strategy: 'squash',
    };
  }

  private async generateSquashCommitMessage(pr: PullRequest): Promise<string> {
    // Include PR description and list of squashed commits
    let message = pr.body || '';

    message += '\n\n---\n';
    message += `Squashed commits:\n`;

    const commits = await this.gitProvider.getPRCommits(pr);
    for (const commit of commits) {
      message += `- ${commit.sha.substring(0, 7)}: ${commit.message.split('\n')[0]}\n`;
    }

    // Add metadata for AI-generated PRs
    if (pr.labels.includes('ai-generated')) {
      message += '\n---\n';
      message += `Generated by: Forge Factory\n`;
      message += `Transformation: ${pr.metadata?.transformationType || 'unknown'}\n`;
    }

    return message;
  }

  private async executeRebaseMerge(pr: PullRequest): Promise<MergeResult> {
    // Rebase PR commits onto target branch
    const result = await this.gitProvider.rebaseMerge(pr);

    return {
      success: true,
      mergeCommit: result.sha,
      strategy: 'rebase',
      rebasedCommits: result.commits,
    };
  }
}
```

### Component 3: Pre-Merge Validation

Validate all requirements before merge.

```typescript
class PreMergeValidator {
  constructor(
    private ciService: CIService,
    private codeOwnerService: CodeOwnerService,
    private securityScanner: SecurityScanner
  ) {}

  async validate(pr: PullRequest): Promise<MergeValidation> {
    const blockers: MergeBlocker[] = [];
    const warnings: MergeWarning[] = [];
    const requiredActions: RequiredAction[] = [];

    // Get protection rules
    const rules = await this.getProtectionRules(pr.repository, pr.targetBranch);

    // Check required approvals
    const approvalStatus = await this.checkApprovals(pr, rules);
    if (!approvalStatus.met) {
      blockers.push({
        type: 'insufficient_approvals',
        message: `Requires ${rules.requiredApprovals} approvals, has ${approvalStatus.count}`,
        resolution: 'Request additional reviews',
      });
    }

    // Check code owner approval
    if (rules.requireCodeOwnerReview) {
      const codeOwnerApproval = await this.checkCodeOwnerApproval(pr);
      if (!codeOwnerApproval.approved) {
        blockers.push({
          type: 'code_owner_approval_required',
          message: `Code owner approval required from: ${codeOwnerApproval.requiredOwners.join(', ')}`,
          resolution: 'Request code owner review',
        });
      }
    }

    // Check status checks
    const statusChecks = await this.checkStatusChecks(pr, rules);
    for (const check of statusChecks.failed) {
      blockers.push({
        type: 'status_check_failed',
        message: `Status check "${check.name}" failed`,
        resolution: `Fix ${check.name} failures`,
      });
    }

    for (const check of statusChecks.pending) {
      blockers.push({
        type: 'status_check_pending',
        message: `Status check "${check.name}" is pending`,
        resolution: 'Wait for check to complete',
      });
    }

    // Check if branch is up-to-date
    if (rules.strictStatusChecks) {
      const upToDate = await this.checkBranchUpToDate(pr);
      if (!upToDate) {
        blockers.push({
          type: 'branch_out_of_date',
          message: 'Branch is not up-to-date with target branch',
          resolution: 'Update branch from target',
        });
        requiredActions.push({
          type: 'update_branch',
          action: 'Merge or rebase from target branch',
        });
      }
    }

    // Check for conflicts
    const hasConflicts = await this.gitProvider.hasConflicts(pr);
    if (hasConflicts) {
      blockers.push({
        type: 'merge_conflicts',
        message: 'Branch has merge conflicts',
        resolution: 'Resolve conflicts',
      });
    }

    // Security scan for AI-generated code
    if (pr.labels.includes('ai-generated')) {
      const securityScan = await this.securityScanner.scan(pr);
      if (securityScan.hasVulnerabilities) {
        for (const vuln of securityScan.vulnerabilities) {
          blockers.push({
            type: 'security_vulnerability',
            message: `Security vulnerability: ${vuln.description}`,
            resolution: vuln.remediation,
          });
        }
      }
    }

    // Check for stale reviews
    if (rules.dismissStaleReviews) {
      const staleReviews = await this.checkStaleReviews(pr);
      if (staleReviews.length > 0) {
        warnings.push({
          type: 'stale_reviews',
          message: `${staleReviews.length} reviews are stale due to new commits`,
        });
      }
    }

    return {
      canMerge: blockers.length === 0,
      blockers,
      warnings,
      requiredActions,
    };
  }

  private async checkApprovals(
    pr: PullRequest,
    rules: ProtectionRules
  ): Promise<ApprovalCheck> {
    const reviews = await this.gitProvider.getPRReviews(pr);
    const approvals = reviews.filter(r => r.state === 'APPROVED');

    // Check for required team approvals
    const teamApprovals = new Set<string>();
    for (const approval of approvals) {
      const teams = await this.getReviewerTeams(approval.user);
      teams.forEach(t => teamApprovals.add(t));
    }

    return {
      count: approvals.length,
      required: rules.requiredApprovals,
      met: approvals.length >= rules.requiredApprovals,
      approvers: approvals.map(a => a.user),
      teamApprovals: Array.from(teamApprovals),
    };
  }

  private async checkCodeOwnerApproval(pr: PullRequest): Promise<CodeOwnerApproval> {
    const changedFiles = await this.gitProvider.getPRFiles(pr);
    const requiredOwners = await this.codeOwnerService.getOwnersForFiles(
      pr.repository,
      changedFiles.map(f => f.path)
    );

    const reviews = await this.gitProvider.getPRReviews(pr);
    const approvers = reviews
      .filter(r => r.state === 'APPROVED')
      .map(r => r.user);

    const pendingOwners = requiredOwners.filter(
      owner => !approvers.includes(owner)
    );

    return {
      approved: pendingOwners.length === 0,
      requiredOwners,
      approvedOwners: requiredOwners.filter(o => approvers.includes(o)),
      pendingOwners,
    };
  }
}
```

### Component 4: Approval Workflows

Manage human-in-the-loop approvals.

```typescript
class ApprovalWorkflowManager {
  constructor(
    private gitProvider: GitProvider,
    private notificationService: NotificationService,
    private auditLogger: AuditLogger
  ) {}

  async requestApproval(
    pr: PullRequest,
    options: ApprovalRequestOptions
  ): Promise<ApprovalRequest> {
    // Determine reviewers
    let reviewers = options.reviewers || [];

    // Auto-assign based on code ownership
    if (options.useCodeOwners) {
      const codeOwners = await this.getCodeOwners(pr);
      reviewers = [...new Set([...reviewers, ...codeOwners])];
    }

    // Auto-assign based on expertise
    if (options.useExpertise) {
      const experts = await this.getExpertsForChanges(pr);
      reviewers = [...new Set([...reviewers, ...experts])];
    }

    // Create review request
    await this.gitProvider.requestReview(pr, reviewers);

    // Send notifications
    for (const reviewer of reviewers) {
      await this.notificationService.notifyReviewRequest({
        reviewer,
        pr,
        priority: options.priority || 'normal',
        message: options.message,
      });
    }

    // Log request
    await this.auditLogger.log({
      action: 'approval_requested',
      pr: pr.id,
      reviewers,
      requestedBy: options.requestedBy,
    });

    return {
      id: generateId(),
      pr: pr.id,
      reviewers,
      status: 'pending',
      createdAt: new Date(),
    };
  }

  async checkApprovalStatus(pr: PullRequest): Promise<ApprovalStatus> {
    const reviews = await this.gitProvider.getPRReviews(pr);
    const rules = await this.getProtectionRules(pr.repository, pr.targetBranch);

    const approvals = reviews.filter(r => r.state === 'APPROVED');
    const rejections = reviews.filter(r => r.state === 'CHANGES_REQUESTED');

    return {
      approved: approvals.length >= rules.requiredApprovals && rejections.length === 0,
      approvalCount: approvals.length,
      requiredCount: rules.requiredApprovals,
      approvers: approvals.map(r => ({
        user: r.user,
        approvedAt: r.submittedAt,
      })),
      rejections: rejections.map(r => ({
        user: r.user,
        reason: r.body,
        rejectedAt: r.submittedAt,
      })),
      pendingReviewers: await this.getPendingReviewers(pr),
    };
  }

  async handleApproval(
    pr: PullRequest,
    approval: ReviewApproval
  ): Promise<void> {
    // Log approval
    await this.auditLogger.log({
      action: 'pr_approved',
      pr: pr.id,
      approver: approval.user,
      comment: approval.comment,
    });

    // Check if auto-merge should trigger
    const status = await this.checkApprovalStatus(pr);
    if (status.approved && pr.autoMergeEnabled) {
      await this.triggerAutoMerge(pr);
    }

    // Notify PR author
    await this.notificationService.notifyApproval({
      pr,
      approver: approval.user,
      comment: approval.comment,
    });
  }

  async handleRejection(
    pr: PullRequest,
    rejection: ReviewRejection
  ): Promise<void> {
    // Log rejection
    await this.auditLogger.log({
      action: 'pr_changes_requested',
      pr: pr.id,
      reviewer: rejection.user,
      reason: rejection.reason,
    });

    // Cancel auto-merge if enabled
    if (pr.autoMergeEnabled) {
      await this.gitProvider.disableAutoMerge(pr);
    }

    // Notify PR author
    await this.notificationService.notifyChangesRequested({
      pr,
      reviewer: rejection.user,
      reason: rejection.reason,
    });
  }
}
```

### Component 5: Merge Automation

Auto-merge when all criteria met.

```typescript
class MergeAutomation {
  constructor(
    private mergeEngine: MergeStrategyEngine,
    private validator: PreMergeValidator,
    private notificationService: NotificationService
  ) {}

  async enableAutoMerge(
    pr: PullRequest,
    options: AutoMergeOptions
  ): Promise<void> {
    // Validate PR is eligible for auto-merge
    const validation = await this.validator.validate(pr);

    if (validation.blockers.some(b => b.type === 'security_vulnerability')) {
      throw new Error('Cannot enable auto-merge on PRs with security vulnerabilities');
    }

    // Store auto-merge preference
    await this.gitProvider.enableAutoMerge(pr, {
      mergeStrategy: options.strategy,
      deleteSourceBranch: options.deleteBranch,
      commitMessage: options.commitMessage,
    });

    // Set up monitoring
    await this.setupAutoMergeMonitor(pr);
  }

  private async setupAutoMergeMonitor(pr: PullRequest): Promise<void> {
    // Monitor PR status changes
    this.eventBus.on(`pr.${pr.id}.status_changed`, async () => {
      await this.checkAndMerge(pr);
    });

    this.eventBus.on(`pr.${pr.id}.review_submitted`, async () => {
      await this.checkAndMerge(pr);
    });
  }

  private async checkAndMerge(pr: PullRequest): Promise<void> {
    // Re-validate
    const validation = await this.validator.validate(pr);

    if (!validation.canMerge) {
      return; // Not ready yet
    }

    // Get auto-merge settings
    const settings = await this.gitProvider.getAutoMergeSettings(pr);
    if (!settings.enabled) {
      return;
    }

    try {
      // Execute merge
      const result = await this.mergeEngine.executeMerge(pr, settings.strategy);

      if (result.success) {
        // Delete source branch if configured
        if (settings.deleteSourceBranch) {
          await this.gitProvider.deleteBranch(pr.repository, pr.sourceBranch);
        }

        // Notify
        await this.notificationService.notifyAutoMerge({
          pr,
          mergeCommit: result.mergeCommit,
        });
      }
    } catch (error) {
      // Disable auto-merge on failure
      await this.gitProvider.disableAutoMerge(pr);

      // Notify author
      await this.notificationService.notifyAutoMergeFailed({
        pr,
        error: error.message,
      });
    }
  }
}
```

---

## Consequences

### Positive

1. **Safety:** Protected branches prevent accidental damage
2. **Quality:** Required reviews ensure code quality
3. **Audit:** Complete history of approvals
4. **Automation:** Auto-merge reduces manual overhead
5. **Consistency:** Enforced merge strategies

### Negative

1. **Friction:** Protection rules slow down development
2. **Complexity:** Multiple strategies to manage
3. **Bottlenecks:** Reviews can become blockers
4. **Override Risk:** Admin bypasses possible

### Trade-offs

- **Security vs. Speed:** More protection = slower merges
- **Automation vs. Control:** Auto-merge reduces oversight
- **Flexibility vs. Consistency:** Flexible rules = inconsistent practices

---

## Implementation Plan

### Phase 1: Protection Rules (Week 1-2)
- Implement branch protection configuration
- Build enforcement webhooks
- Add policy storage

### Phase 2: Merge Strategies (Week 3-4)
- Implement merge strategy engine
- Build conflict resolution
- Add commit message generation

### Phase 3: Validation (Week 5-6)
- Build pre-merge validator
- Add security scanning
- Implement code owner checks

### Phase 4: Automation (Week 7-8)
- Implement auto-merge
- Build approval workflows
- Add notification system

---

## References

- [GitHub Branch Protection](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches)
- [GitLab Protected Branches](https://docs.gitlab.com/ee/user/project/protected_branches.html)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [CODEOWNERS](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners)

---

**Decision Maker:** Engineering Lead + DevOps Lead
**Approved By:** Engineering Leadership
**Implementation Owner:** Platform Engineering Team
