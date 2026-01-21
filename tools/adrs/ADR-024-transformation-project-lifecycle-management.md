# ADR-024: Transformation Project Lifecycle Management

## Status
Accepted

## Context

Forge Factory is designed to run dozens to hundreds of concurrent transformation projects across enterprise organizations. Each transformation project represents a complete business transformation with its own codebase, infrastructure, team, and lifecycle. As the platform scales, we need a robust system to manage projects from inception through retirement while ensuring maintainability, governance, and operational excellence.

### Requirements

**Scale Requirements:**
- Support 100-1000+ active transformation projects per Forge Factory instance
- Handle 10-50 new project creations per week
- Support 5-20 projects in active development simultaneously
- Manage projects across multiple lifecycle stages concurrently
- Enable bulk operations across project cohorts

**Lifecycle Requirements:**
- Clear project stages with defined transitions
- Automated provisioning and deprovisioning
- Long-term maintenance support (2-5 years per project)
- Safe archival and restoration capabilities
- Audit trail of all lifecycle changes

**Operational Requirements:**
- Project health monitoring across all stages
- Resource quota management per project
- Dependency tracking between projects
- Breaking change impact analysis
- Rollback and recovery capabilities

### Current Challenges

1. **No Standardized Lifecycle:** Projects lack clear stages and transitions
2. **Manual Provisioning:** Creating new projects requires manual setup
3. **Resource Sprawl:** No centralized resource management across projects
4. **Maintenance Burden:** No systematic approach to update hundreds of projects
5. **Unclear Ownership:** Project ownership and responsibility boundaries are undefined
6. **No Retirement Strategy:** Old projects accumulate without clear sunset process

## Decision

We will implement a comprehensive **Project Lifecycle Management (PLM)** system with seven distinct stages, automated transitions, and robust governance controls.

### Lifecycle Stages

```
┌─────────────┐
│   DRAFT     │  Initial planning and configuration
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ PROVISIONING│  Automated resource allocation
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   ACTIVE    │  Active development and deployment
└──────┬──────┘
       │
       ├──────────┐
       │          ▼
       │    ┌─────────────┐
       │    │ MAINTENANCE │  Long-term support mode
       │    └──────┬──────┘
       │           │
       ▼           ▼
┌─────────────┐
│  ARCHIVED   │  Read-only historical state
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  RETIRED    │  Deprovisioned and deleted
└─────────────┘

Emergency Path:
ACTIVE/MAINTENANCE ──► SUSPENDED ──► ACTIVE/MAINTENANCE
```

### Stage Definitions

#### 1. DRAFT
**Purpose:** Project planning and configuration
**Duration:** 1-30 days
**Resources:** Metadata storage only

**Characteristics:**
- No infrastructure provisioned
- Configuration and planning only
- Team assignments and approvals
- Template selection and customization
- Cost estimation and budgeting

**Transitions:**
- → PROVISIONING: When approved and funded
- → RETIRED: If cancelled during planning

#### 2. PROVISIONING
**Purpose:** Automated resource allocation
**Duration:** 5-60 minutes
**Resources:** Full infrastructure creation in progress

**Characteristics:**
- Automated infrastructure creation (databases, repos, CI/CD)
- Initial code generation from templates
- Service account and credential creation
- Monitoring and alerting setup
- DNS and networking configuration

**Transitions:**
- → ACTIVE: When all resources healthy
- → DRAFT: If provisioning fails (with cleanup)

#### 3. ACTIVE
**Purpose:** Primary development and deployment stage
**Duration:** 3-18 months
**Resources:** Full allocation, unrestricted

**Characteristics:**
- Full development capabilities
- Unrestricted deployments
- Regular automated updates
- Full feature access
- Active monitoring and support

**Transitions:**
- → MAINTENANCE: When development complete
- → SUSPENDED: For policy violations or resource issues
- → ARCHIVED: If abandoned (with approval)

#### 4. MAINTENANCE
**Purpose:** Long-term support with reduced change velocity
**Duration:** 1-5 years
**Resources:** Reduced allocation, selective updates

**Characteristics:**
- Security patches automatically applied
- Breaking changes require approval
- Reduced resource allocation (50% of ACTIVE)
- Quarterly health checks
- Selective feature updates

**Transitions:**
- → ACTIVE: If major enhancements needed
- → ARCHIVED: When support period ends
- → SUSPENDED: For critical issues

#### 5. SUSPENDED
**Purpose:** Emergency pause due to issues
**Duration:** 1-30 days
**Resources:** Minimal, read-only access

**Characteristics:**
- Deployments blocked
- Read-only access for investigation
- Automated cost protection (scales down non-critical resources)
- Escalated monitoring
- Time-bound with auto-escalation

**Transitions:**
- → ACTIVE/MAINTENANCE: When issues resolved
- → ARCHIVED: If suspension exceeds 30 days

#### 6. ARCHIVED
**Purpose:** Historical preservation
**Duration:** 1-7 years (compliance-dependent)
**Resources:** Storage only, no compute

**Characteristics:**
- Complete snapshot preserved
- Read-only access
- No active infrastructure
- Searchable metadata
- Restore capability maintained

**Transitions:**
- → ACTIVE: If restoration requested (requires approval)
- → RETIRED: After retention period

#### 7. RETIRED
**Purpose:** Complete removal
**Duration:** Permanent
**Resources:** None

**Characteristics:**
- All resources deleted
- Audit logs preserved (7 years)
- Metadata retained for reporting
- Irreversible without backups
- Compliance holds honored

### Database Schema

```prisma
// Schema extension for apps/core/src/lib/db/schema.prisma

model TransformationProject {
  id                String   @id @default(cuid())
  organizationId    String
  organization      Organization @relation(fields: [organizationId], references: [id])

  // Identity
  name              String
  slug              String   @unique
  description       String?

  // Lifecycle
  status            ProjectStatus @default(DRAFT)
  statusChangedAt   DateTime @default(now())
  statusChangedBy   String

  // Metadata
  templateId        String
  templateVersion   String
  platformVersion   String

  // Ownership
  ownerId           String
  owner             User @relation("ProjectOwner", fields: [ownerId], references: [id])
  teamId            String?
  team              Team? @relation(fields: [teamId], references: [id])

  // Resources
  resourceQuota     Json     // { cpu: "4", memory: "16Gi", storage: "100Gi" }
  currentUsage      Json     // Updated hourly

  // Lifecycle tracking
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  provisionedAt     DateTime?
  activatedAt       DateTime?
  maintenanceAt     DateTime?
  archivedAt        DateTime?
  retiredAt         DateTime?

  // Configuration
  config            Json     // Project-specific configuration
  features          Json     // Enabled features

  // Audit
  lifecycleEvents   ProjectLifecycleEvent[]
  healthChecks      ProjectHealthCheck[]

  @@index([organizationId, status])
  @@index([status, updatedAt])
  @@index([templateId, templateVersion])
}

enum ProjectStatus {
  DRAFT
  PROVISIONING
  ACTIVE
  MAINTENANCE
  SUSPENDED
  ARCHIVED
  RETIRED
}

model ProjectLifecycleEvent {
  id                String   @id @default(cuid())
  projectId         String
  project           TransformationProject @relation(fields: [projectId], references: [id])

  fromStatus        ProjectStatus?
  toStatus          ProjectStatus

  triggeredBy       String   // User or system identifier
  reason            String?
  metadata          Json?    // Additional context

  successful        Boolean  @default(true)
  errorMessage      String?

  createdAt         DateTime @default(now())

  @@index([projectId, createdAt])
  @@index([toStatus, createdAt])
}

model ProjectHealthCheck {
  id                String   @id @default(cuid())
  projectId         String
  project           TransformationProject @relation(fields: [projectId], references: [id])

  status            HealthStatus
  score             Int      // 0-100

  checks            Json     // Individual check results
  metrics           Json     // Performance metrics

  createdAt         DateTime @default(now())

  @@index([projectId, createdAt])
  @@index([status, createdAt])
}

enum HealthStatus {
  HEALTHY
  DEGRADED
  UNHEALTHY
  CRITICAL
}
```

### API Design

```typescript
// apps/core/src/lib/api/project-lifecycle.ts

/**
 * @prompt-id forge-v4.1:feature:project-lifecycle:001
 * @generated-at 2026-01-20T00:00:00Z
 * @model claude-sonnet-4-5
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { authedProcedure, router } from '../trpc';
import { ProjectStatus } from '@prisma/client';

const CreateProjectInputSchema = z.object({
  name: z.string().min(3).max(100),
  description: z.string().max(500).optional(),
  templateId: z.string(),
  organizationId: z.string(),
  ownerId: z.string(),
  teamId: z.string().optional(),
  resourceQuota: z.object({
    cpu: z.string(),
    memory: z.string(),
    storage: z.string(),
  }).optional(),
  config: z.record(z.any()).optional(),
});

const TransitionProjectInputSchema = z.object({
  projectId: z.string(),
  toStatus: z.nativeEnum(ProjectStatus),
  reason: z.string().optional(),
  force: z.boolean().default(false),
});

export const projectLifecycleRouter = router({
  // Create new project in DRAFT status
  create: authedProcedure
    .input(CreateProjectInputSchema)
    .mutation(async ({ ctx, input }) => {
      const { user, db } = ctx;

      // Check permissions
      await requireOrganizationRole(user.id, input.organizationId, ['ADMIN', 'OWNER']);

      // Generate unique slug
      const slug = await generateUniqueSlug(input.name);

      // Get current platform version
      const platformVersion = await getPlatformVersion();

      // Get template
      const template = await db.projectTemplate.findUnique({
        where: { id: input.templateId },
      });

      if (!template) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Template not found',
        });
      }

      // Create project
      const project = await db.transformationProject.create({
        data: {
          name: input.name,
          slug,
          description: input.description,
          templateId: input.templateId,
          templateVersion: template.version,
          platformVersion,
          organizationId: input.organizationId,
          ownerId: input.ownerId,
          teamId: input.teamId,
          status: ProjectStatus.DRAFT,
          statusChangedBy: user.id,
          resourceQuota: input.resourceQuota || template.defaultQuota,
          currentUsage: {},
          config: input.config || {},
          features: template.defaultFeatures,
        },
      });

      // Record lifecycle event
      await db.projectLifecycleEvent.create({
        data: {
          projectId: project.id,
          fromStatus: null,
          toStatus: ProjectStatus.DRAFT,
          triggeredBy: user.id,
          reason: 'Project created',
        },
      });

      // Emit event
      await emitEvent('project.created', { project });

      return project;
    }),

  // Transition project to new status
  transition: authedProcedure
    .input(TransitionProjectInputSchema)
    .mutation(async ({ ctx, input }) => {
      const { user, db } = ctx;

      const project = await db.transformationProject.findUnique({
        where: { id: input.projectId },
      });

      if (!project) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project not found',
        });
      }

      // Check permissions
      await requireProjectRole(user.id, project.id, ['ADMIN', 'OWNER']);

      // Validate transition
      const transitionValidator = new ProjectTransitionValidator(project, input.toStatus);
      const validation = await transitionValidator.validate();

      if (!validation.allowed && !input.force) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Invalid transition: ${validation.reason}`,
          cause: validation.blockers,
        });
      }

      // Execute transition
      const transitionHandler = getTransitionHandler(project.status, input.toStatus);

      try {
        await db.$transaction(async (tx) => {
          // Run transition handler
          await transitionHandler.execute(tx, project);

          // Update project status
          await tx.transformationProject.update({
            where: { id: project.id },
            data: {
              status: input.toStatus,
              statusChangedAt: new Date(),
              statusChangedBy: user.id,
              [`${input.toStatus.toLowerCase()}At`]: new Date(),
            },
          });

          // Record event
          await tx.projectLifecycleEvent.create({
            data: {
              projectId: project.id,
              fromStatus: project.status,
              toStatus: input.toStatus,
              triggeredBy: user.id,
              reason: input.reason,
              successful: true,
            },
          });
        });

        // Emit event
        await emitEvent('project.transitioned', {
          projectId: project.id,
          fromStatus: project.status,
          toStatus: input.toStatus,
        });

        // Trigger async post-transition tasks
        await queuePostTransitionTasks(project.id, input.toStatus);

        return { success: true };
      } catch (error) {
        // Record failed transition
        await db.projectLifecycleEvent.create({
          data: {
            projectId: project.id,
            fromStatus: project.status,
            toStatus: input.toStatus,
            triggeredBy: user.id,
            reason: input.reason,
            successful: false,
            errorMessage: error.message,
          },
        });

        throw error;
      }
    }),

  // Bulk transition projects
  bulkTransition: authedProcedure
    .input(z.object({
      projectIds: z.array(z.string()).min(1).max(100),
      toStatus: z.nativeEnum(ProjectStatus),
      reason: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const results = await Promise.allSettled(
        input.projectIds.map((projectId) =>
          ctx.procedures.transition({
            projectId,
            toStatus: input.toStatus,
            reason: input.reason,
          })
        )
      );

      return {
        successful: results.filter((r) => r.status === 'fulfilled').length,
        failed: results.filter((r) => r.status === 'rejected').length,
        results,
      };
    }),

  // Get project lifecycle history
  getHistory: authedProcedure
    .input(z.object({
      projectId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const events = await ctx.db.projectLifecycleEvent.findMany({
        where: { projectId: input.projectId },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });

      return events;
    }),
});

// Transition validation
class ProjectTransitionValidator {
  constructor(
    private project: TransformationProject,
    private targetStatus: ProjectStatus
  ) {}

  async validate(): Promise<{
    allowed: boolean;
    reason?: string;
    blockers?: string[];
  }> {
    const transitions = ALLOWED_TRANSITIONS[this.project.status];

    if (!transitions.includes(this.targetStatus)) {
      return {
        allowed: false,
        reason: `Cannot transition from ${this.project.status} to ${this.targetStatus}`,
      };
    }

    // Status-specific validations
    const validators = {
      [ProjectStatus.PROVISIONING]: () => this.validateProvisioningReady(),
      [ProjectStatus.ACTIVE]: () => this.validateActivationReady(),
      [ProjectStatus.ARCHIVED]: () => this.validateArchivalReady(),
      [ProjectStatus.RETIRED]: () => this.validateRetirementReady(),
    };

    const validator = validators[this.targetStatus];
    if (validator) {
      return await validator();
    }

    return { allowed: true };
  }

  private async validateProvisioningReady() {
    const blockers: string[] = [];

    // Check approvals
    if (!this.project.config.approved) {
      blockers.push('Project not approved');
    }

    // Check budget allocation
    if (!this.project.config.budgetAllocated) {
      blockers.push('Budget not allocated');
    }

    return {
      allowed: blockers.length === 0,
      blockers,
    };
  }

  private async validateActivationReady() {
    const blockers: string[] = [];

    // Check health
    const health = await getProjectHealth(this.project.id);
    if (health.status === HealthStatus.CRITICAL) {
      blockers.push('Project health is critical');
    }

    // Check resources provisioned
    if (!this.project.provisionedAt) {
      blockers.push('Project not fully provisioned');
    }

    return {
      allowed: blockers.length === 0,
      blockers,
    };
  }

  private async validateArchivalReady() {
    const blockers: string[] = [];

    // Check for active deployments
    const activeDeployments = await getActiveDeployments(this.project.id);
    if (activeDeployments.length > 0) {
      blockers.push(`${activeDeployments.length} active deployments must be stopped`);
    }

    // Check for pending work
    const pendingPRs = await getPendingPRs(this.project.id);
    if (pendingPRs.length > 0) {
      blockers.push(`${pendingPRs.length} pending PRs must be merged or closed`);
    }

    return {
      allowed: blockers.length === 0,
      blockers,
    };
  }

  private async validateRetirementReady() {
    const blockers: string[] = [];

    // Must be archived first
    if (this.project.status !== ProjectStatus.ARCHIVED) {
      blockers.push('Project must be archived before retirement');
    }

    // Check compliance holds
    const complianceHolds = await getComplianceHolds(this.project.id);
    if (complianceHolds.length > 0) {
      blockers.push(`${complianceHolds.length} compliance holds prevent deletion`);
    }

    // Check retention period
    const retentionMet = await checkRetentionPeriod(this.project);
    if (!retentionMet) {
      blockers.push('Minimum retention period not met');
    }

    return {
      allowed: blockers.length === 0,
      blockers,
    };
  }
}

// Allowed transitions map
const ALLOWED_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  [ProjectStatus.DRAFT]: [ProjectStatus.PROVISIONING, ProjectStatus.RETIRED],
  [ProjectStatus.PROVISIONING]: [ProjectStatus.ACTIVE, ProjectStatus.DRAFT],
  [ProjectStatus.ACTIVE]: [
    ProjectStatus.MAINTENANCE,
    ProjectStatus.SUSPENDED,
    ProjectStatus.ARCHIVED,
  ],
  [ProjectStatus.MAINTENANCE]: [
    ProjectStatus.ACTIVE,
    ProjectStatus.SUSPENDED,
    ProjectStatus.ARCHIVED,
  ],
  [ProjectStatus.SUSPENDED]: [
    ProjectStatus.ACTIVE,
    ProjectStatus.MAINTENANCE,
    ProjectStatus.ARCHIVED,
  ],
  [ProjectStatus.ARCHIVED]: [ProjectStatus.ACTIVE, ProjectStatus.RETIRED],
  [ProjectStatus.RETIRED]: [], // Terminal state
};
```

### Transition Handlers

```typescript
// apps/core/src/lib/services/project-transitions/

interface TransitionHandler {
  execute(tx: PrismaTransaction, project: TransformationProject): Promise<void>;
  rollback?(tx: PrismaTransaction, project: TransformationProject): Promise<void>;
}

// DRAFT → PROVISIONING
class ProvisioningHandler implements TransitionHandler {
  async execute(tx: PrismaTransaction, project: TransformationProject) {
    // Queue infrastructure provisioning job
    await queueJob('provision-project', {
      projectId: project.id,
      tasks: [
        'create-database',
        'create-git-repository',
        'setup-ci-cd',
        'configure-monitoring',
        'generate-initial-code',
        'setup-dns',
        'create-service-accounts',
      ],
    });
  }

  async rollback(tx: PrismaTransaction, project: TransformationProject) {
    await queueJob('cleanup-provisioning', {
      projectId: project.id,
    });
  }
}

// PROVISIONING → ACTIVE
class ActivationHandler implements TransitionHandler {
  async execute(tx: PrismaTransaction, project: TransformationProject) {
    // Enable all project features
    await enableProjectFeatures(project.id);

    // Send welcome notifications
    await sendNotification({
      to: project.ownerId,
      type: 'PROJECT_ACTIVATED',
      projectId: project.id,
    });

    // Schedule first health check
    await scheduleHealthCheck(project.id, '1 hour');
  }
}

// ACTIVE → MAINTENANCE
class MaintenanceHandler implements TransitionHandler {
  async execute(tx: PrismaTransaction, project: TransformationProject) {
    // Reduce resource allocation
    await scaleResources(project.id, 0.5); // 50% of ACTIVE

    // Change update policy
    await tx.transformationProject.update({
      where: { id: project.id },
      data: {
        config: {
          ...project.config,
          updatePolicy: 'SECURITY_ONLY',
          requireApprovalForBreakingChanges: true,
        },
      },
    });

    // Schedule quarterly health checks
    await scheduleHealthCheck(project.id, '90 days');
  }
}

// * → SUSPENDED
class SuspensionHandler implements TransitionHandler {
  async execute(tx: PrismaTransaction, project: TransformationProject) {
    // Block all deployments
    await blockDeployments(project.id);

    // Scale down to minimum
    await scaleResources(project.id, 0.1);

    // Alert stakeholders
    await sendAlert({
      to: [project.ownerId, ...project.teamIds],
      severity: 'HIGH',
      type: 'PROJECT_SUSPENDED',
      projectId: project.id,
    });

    // Set auto-escalation timer (30 days)
    await scheduleEscalation(project.id, '30 days');
  }
}

// * → ARCHIVED
class ArchivalHandler implements TransitionHandler {
  async execute(tx: PrismaTransaction, project: TransformationProject) {
    // Create complete snapshot
    const snapshot = await createProjectSnapshot(project.id);

    // Store in cold storage
    await uploadToArchiveStorage(snapshot, {
      projectId: project.id,
      retentionYears: 7,
    });

    // Deprovision active resources
    await deprovisionResources(project.id, {
      keep: ['database-snapshot', 'git-repository', 'audit-logs'],
    });

    // Update metadata for search
    await updateSearchIndex({
      projectId: project.id,
      status: 'ARCHIVED',
      archivedAt: new Date(),
    });
  }
}

// ARCHIVED → RETIRED
class RetirementHandler implements TransitionHandler {
  async execute(tx: PrismaTransaction, project: TransformationProject) {
    // Final compliance check
    const holds = await getComplianceHolds(project.id);
    if (holds.length > 0) {
      throw new Error('Cannot retire project with active compliance holds');
    }

    // Delete all resources
    await deleteAllResources(project.id);

    // Preserve audit trail
    await preserveAuditTrail(project.id, {
      retentionYears: 7,
    });

    // Mark project as retired (soft delete)
    // Hard delete happens after audit retention period
    await tx.transformationProject.update({
      where: { id: project.id },
      data: {
        config: {
          ...project.config,
          hardDeleteAt: new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000), // 7 years
        },
      },
    });
  }
}

function getTransitionHandler(
  fromStatus: ProjectStatus,
  toStatus: ProjectStatus
): TransitionHandler {
  const key = `${fromStatus}_TO_${toStatus}`;

  const handlers: Record<string, TransitionHandler> = {
    'DRAFT_TO_PROVISIONING': new ProvisioningHandler(),
    'PROVISIONING_TO_ACTIVE': new ActivationHandler(),
    'ACTIVE_TO_MAINTENANCE': new MaintenanceHandler(),
    'MAINTENANCE_TO_ACTIVE': new ActivationHandler(),
    'ACTIVE_TO_SUSPENDED': new SuspensionHandler(),
    'MAINTENANCE_TO_SUSPENDED': new SuspensionHandler(),
    'SUSPENDED_TO_ACTIVE': new ActivationHandler(),
    'SUSPENDED_TO_MAINTENANCE': new MaintenanceHandler(),
    'ACTIVE_TO_ARCHIVED': new ArchivalHandler(),
    'MAINTENANCE_TO_ARCHIVED': new ArchivalHandler(),
    'SUSPENDED_TO_ARCHIVED': new ArchivalHandler(),
    'ARCHIVED_TO_RETIRED': new RetirementHandler(),
  };

  return handlers[key] || new NoOpHandler();
}

class NoOpHandler implements TransitionHandler {
  async execute() {
    // No-op for transitions that don't require special handling
  }
}
```

### Automated Lifecycle Management

```typescript
// apps/core/src/lib/jobs/project-lifecycle-automation.ts

/**
 * Automated lifecycle management jobs
 */

// Auto-transition to MAINTENANCE after inactivity
export async function autoTransitionToMaintenance() {
  const candidates = await db.transformationProject.findMany({
    where: {
      status: ProjectStatus.ACTIVE,
      updatedAt: {
        lt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000), // 6 months
      },
    },
  });

  for (const project of candidates) {
    // Check if truly inactive
    const recentActivity = await getRecentActivity(project.id, '180 days');

    if (recentActivity.commits === 0 && recentActivity.deployments === 0) {
      await transitionProject({
        projectId: project.id,
        toStatus: ProjectStatus.MAINTENANCE,
        reason: 'Auto-transitioned due to 6 months of inactivity',
        triggeredBy: 'system',
      });

      await sendNotification({
        to: project.ownerId,
        type: 'AUTO_MAINTENANCE',
        projectId: project.id,
      });
    }
  }
}

// Auto-archive old MAINTENANCE projects
export async function autoArchiveOldProjects() {
  const candidates = await db.transformationProject.findMany({
    where: {
      status: ProjectStatus.MAINTENANCE,
      maintenanceAt: {
        lt: new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000), // 2 years
      },
    },
  });

  for (const project of candidates) {
    // Request owner approval
    const approval = await requestApproval({
      projectId: project.id,
      action: 'ARCHIVE',
      reason: 'Project has been in maintenance for 2 years',
      approvers: [project.ownerId],
      deadline: '30 days',
    });

    if (approval.status === 'APPROVED') {
      await transitionProject({
        projectId: project.id,
        toStatus: ProjectStatus.ARCHIVED,
        reason: 'Auto-archived after 2 years in maintenance (approved)',
        triggeredBy: 'system',
      });
    }
  }
}

// Auto-escalate SUSPENDED projects
export async function autoEscalateSuspensions() {
  const suspended = await db.transformationProject.findMany({
    where: {
      status: ProjectStatus.SUSPENDED,
      statusChangedAt: {
        lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    },
  });

  for (const project of suspended) {
    await sendAlert({
      to: [project.ownerId, ...getOrgAdmins(project.organizationId)],
      severity: 'CRITICAL',
      type: 'SUSPENDED_PROJECT_ESCALATION',
      message: `Project ${project.name} has been suspended for 30 days. Action required.`,
      actions: [
        { label: 'Resolve and Reactivate', action: 'reactivate' },
        { label: 'Archive Project', action: 'archive' },
      ],
    });
  }
}

// Cleanup retired projects after retention period
export async function cleanupRetiredProjects() {
  const toDelete = await db.transformationProject.findMany({
    where: {
      status: ProjectStatus.RETIRED,
      'config.hardDeleteAt': {
        lt: new Date(),
      },
    },
  });

  for (const project of toDelete) {
    // Final safety check
    const holds = await getComplianceHolds(project.id);
    if (holds.length > 0) {
      await extendRetention(project.id, '1 year');
      continue;
    }

    // Hard delete
    await db.transformationProject.delete({
      where: { id: project.id },
    });

    await logAudit({
      action: 'PROJECT_HARD_DELETED',
      projectId: project.id,
      timestamp: new Date(),
    });
  }
}
```

## Consequences

### Positive

1. **Clear Governance:** Well-defined stages with explicit transitions
2. **Automated Operations:** Reduces manual overhead for hundreds of projects
3. **Resource Efficiency:** Automatic resource scaling based on lifecycle stage
4. **Auditability:** Complete history of all lifecycle changes
5. **Safe Retirement:** Controlled archival and deletion process
6. **Cost Optimization:** Automatic downscaling of inactive projects
7. **Operational Clarity:** Teams understand project status at a glance
8. **Compliance:** Built-in retention and deletion policies

### Negative

1. **Complexity:** Seven stages may be overwhelming initially
2. **Transition Friction:** Approval gates may slow down transitions
3. **Resource Overhead:** Lifecycle tracking adds database load
4. **Learning Curve:** Teams need training on lifecycle management
5. **Automation Risks:** Incorrect auto-transitions could disrupt projects

### Mitigations

1. **Comprehensive Documentation:** Detailed guides for each lifecycle stage
2. **Visual Dashboards:** Clear UI showing project status and allowed transitions
3. **Dry-Run Mode:** Test transitions without executing them
4. **Rollback Capability:** All transitions can be reversed if needed
5. **Override Mechanisms:** Superadmins can force transitions when necessary
6. **Notification System:** Alert owners before automated transitions
7. **Gradual Rollout:** Pilot with small project cohorts first
8. **Training Program:** Structured onboarding for project owners

## Alternatives Considered

### Alternative 1: Simple Active/Archived Model

**Description:** Only two states: ACTIVE and ARCHIVED

**Rejected Because:**
- No distinction between active development and maintenance
- No way to handle emergency situations (suspension)
- No gradual transition path
- Doesn't support long-term project support needs

### Alternative 2: Manual-Only Lifecycle

**Description:** No automated transitions, all manual

**Rejected Because:**
- Doesn't scale to hundreds of projects
- Inconsistent application of policies
- High operational overhead
- Human error in lifecycle management

### Alternative 3: Time-Based Only

**Description:** Projects automatically progress based solely on age

**Rejected Because:**
- Ignores actual project activity
- May archive active projects prematurely
- No flexibility for different project types
- Doesn't account for business needs

### Alternative 4: Git-Like Branching Model

**Description:** Projects can have multiple "branches" in different states

**Rejected Because:**
- Too complex for project management
- Resource management becomes very difficult
- Unclear ownership and responsibility
- Doesn't align with business transformation model

## Implementation Plan

### Phase 1: Core Lifecycle (Weeks 1-3)
- Implement database schema
- Build state machine and transition validation
- Create basic API endpoints
- Add lifecycle event tracking

### Phase 2: Transition Handlers (Weeks 4-6)
- Implement all transition handlers
- Build provisioning automation
- Add resource scaling logic
- Create archival/retirement processes

### Phase 3: Automation (Weeks 7-9)
- Auto-transition to MAINTENANCE
- Auto-archival workflows
- Suspension escalation
- Cleanup jobs

### Phase 4: UI & Observability (Weeks 10-12)
- Lifecycle dashboard
- Project status visualizations
- Transition approval workflows
- Health monitoring integration

## Testing Strategy

### Unit Tests
- State transition validation logic
- Permission checks
- Resource quota calculations

### Integration Tests
- End-to-end lifecycle flows
- Transition handler execution
- Rollback scenarios
- Bulk operations

### Load Tests
- 1000 concurrent projects
- 100 simultaneous transitions
- Bulk transition performance

### Chaos Tests
- Failed provisioning recovery
- Partial transition failures
- Network interruption during transitions

## Metrics & Monitoring

### Key Metrics
- **Provisioning Success Rate:** Target >99%
- **Average Provisioning Time:** Target <10 minutes
- **Projects by Status:** Distribution across lifecycle stages
- **Transition Failures:** Target <1%
- **Auto-transition Rate:** % of automated vs manual transitions
- **Resource Utilization by Stage:** Cost optimization tracking

### Alerts
- Provisioning failures
- Projects stuck in SUSPENDED >30 days
- Unexpected status transitions
- Resource quota exceeded
- Failed archival/retirement

## Multi-Organization Transformation Support

For large-scale enterprise transformations spanning multiple organizations (e.g., M&A integrations, global rollouts), this lifecycle management system supports:

### Cross-Organization Project Groups

```typescript
interface TransformationProjectGroup {
  id: string;
  name: string;
  transformationType: TransformationPlaybookType;

  // Multiple organizations participating
  participatingOrganizations: OrganizationParticipation[];

  // Group-level governance
  governance: GroupGovernance;

  // Coordinated lifecycle
  coordinatedTransitions: CoordinatedTransition[];

  // Shared resources
  sharedResources: SharedResource[];
}

enum TransformationPlaybookType {
  DIGITAL_TRANSFORMATION = 'digital-transformation',      // ADR-031
  LEGACY_MODERNIZATION = 'legacy-modernization',          // ADR-032
  CLOUD_MIGRATION = 'cloud-migration',                    // ADR-033
  DEVOPS_TRANSFORMATION = 'devops-transformation',        // ADR-034
  MICROSERVICES_DDD = 'microservices-ddd',               // ADR-035
  SECURITY_COMPLIANCE = 'security-compliance',            // ADR-036
  MA_CONSOLIDATION = 'ma-consolidation'                   // ADR-037
}

interface OrganizationParticipation {
  organizationId: string;
  role: 'lead' | 'participant' | 'observer';
  projects: ProjectReference[];
  syncStrategy: SyncStrategy;
}
```

### Coordinated Lifecycle Transitions

```typescript
interface CoordinatedTransition {
  groupId: string;
  targetStatus: ProjectStatus;

  // All projects must transition together
  synchronous: boolean;

  // Order of transitions
  transitionOrder: TransitionOrder[];

  // Rollback strategy
  rollbackOnFailure: 'all' | 'failed-only' | 'none';
}
```

## Related ADRs

- ADR-025: ROI Tracking for Code Transformations
- ADR-031: Digital Transformation Playbook
- ADR-032: Legacy System Modernization Playbook
- ADR-033: Cloud Migration & Hybrid Cloud Playbook
- ADR-034: DevOps & Platform Engineering Transformation Playbook
- ADR-035: Microservices & DDD Transformation Playbook
- ADR-036: Security & Compliance Transformation Playbook
- ADR-037: M&A Code Consolidation Playbook

## References

- [AWS Account Lifecycle Management](https://aws.amazon.com/organizations/)
- [Kubernetes Namespace Lifecycle](https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces/)
- [Project Portfolio Management Frameworks](https://www.pmi.org/learning/library/project-portfolio-management-framework-7761)

## Review Date

2026-04-20 (3 months)

## Appendix: CLI Tools

```bash
# Create new project
forge project create \
  --name "customer-portal-transformation" \
  --template "enterprise-app-v2" \
  --org "acme-corp" \
  --owner "john@acme.com"

# Transition project
forge project transition \
  --project "customer-portal-transformation" \
  --to "provisioning"

# View lifecycle history
forge project history customer-portal-transformation

# Bulk transition
forge project bulk-transition \
  --status "active" \
  --inactive-days 180 \
  --to "maintenance" \
  --dry-run

# Get project status
forge project status customer-portal-transformation

# List projects by status
forge project list --status maintenance

# Schedule archival
forge project archive \
  --project "legacy-app" \
  --date "2026-03-01" \
  --reason "End of support period"
```
