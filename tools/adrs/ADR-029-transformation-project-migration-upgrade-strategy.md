# ADR-029: Transformation Project Migration & Upgrade Strategy

## Status
Accepted

## Context

As the Forge Factory platform evolves, we must upgrade hundreds of transformation projects from older platform versions to newer ones, migrate between template versions, and handle infrastructure changes without disrupting active projects. This requires a systematic approach to migrations that minimizes risk and downtime.

### Requirements

**Migration Requirements:**
- Migrate 100+ projects simultaneously during platform upgrades
- Zero-downtime migrations for production projects
- Automated migration with manual override capability
- Rollback capability for failed migrations
- Data integrity guarantees throughout migration

**Scale Requirements:**
- Support migrating 500+ projects within 48 hours
- Parallel migrations (20-50 concurrent)
- Large database migrations (100GB+)
- Complex dependency upgrades

### Current Challenges

1. **Manual Migrations:** Currently manual, doesn't scale
2. **No Rollback:** Failed migrations leave projects in broken state
3. **Long Downtime:** Migrations require extended downtime
4. **Data Loss Risk:** No guaranteed data integrity
5. **Coordination Complexity:** Difficult to coordinate across many projects

## Decision

We will implement a **Blue-Green Migration Strategy** with **Automated Pre-flight Checks**, **Staged Rollouts**, and **Automatic Rollback** capabilities.

### Migration Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  Migration Orchestrator                      │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Pre-flight │  │  Migration   │  │  Validation  │      │
│  │    Checks    │  │   Executor   │  │   & Rollback │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   Migration Strategies                       │
│                                                              │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │   Blue-Green    │  │   Rolling       │                  │
│  │   (Zero DT)     │  │   (Gradual)     │                  │
│  └─────────────────┘  └─────────────────┘                  │
│                                                              │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │   Canary        │  │   Shadow        │                  │
│  │   (Safe Test)   │  │   (Test First)  │                  │
│  └─────────────────┘  └─────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

### Blue-Green Migration Strategy

```typescript
// apps/core/src/lib/services/migration/

interface MigrationPlan {
  id: string;
  projectId: string;
  fromVersion: string;
  toVersion: string;
  strategy: MigrationStrategy;
  steps: MigrationStep[];
  estimatedDuration: number;
  rollbackPlan: RollbackPlan;
}

enum MigrationStrategy {
  BLUE_GREEN = 'blue-green',
  ROLLING = 'rolling',
  CANARY = 'canary',
  SHADOW = 'shadow',
}

class MigrationOrchestrator {
  async executeMigration(plan: MigrationPlan): Promise<MigrationResult> {
    // Step 1: Pre-flight checks
    const preflightResults = await this.runPreflightChecks(plan);
    if (!preflightResults.passed) {
      return {
        success: false,
        errors: preflightResults.errors,
        stage: 'preflight',
      };
    }

    // Step 2: Create backup
    const backup = await this.createBackup(plan.projectId);

    // Step 3: Execute based on strategy
    try {
      let result: MigrationResult;

      switch (plan.strategy) {
        case MigrationStrategy.BLUE_GREEN:
          result = await this.executeBlueGreen(plan);
          break;
        case MigrationStrategy.ROLLING:
          result = await this.executeRolling(plan);
          break;
        case MigrationStrategy.CANARY:
          result = await this.executeCanary(plan);
          break;
        default:
          throw new Error(`Unknown strategy: ${plan.strategy}`);
      }

      // Step 4: Post-migration validation
      const validation = await this.validateMigration(plan.projectId);
      if (!validation.passed) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      // Step 5: Cleanup old environment
      await this.cleanupOldEnvironment(plan.projectId);

      return result;
    } catch (error) {
      // Automatic rollback on failure
      await this.rollback(plan, backup);

      return {
        success: false,
        errors: [error.message],
        stage: 'execution',
        rolledBack: true,
      };
    }
  }

  private async executeBlueGreen(plan: MigrationPlan): Promise<MigrationResult> {
    const project = await db.transformationProject.findUnique({
      where: { id: plan.projectId },
    });

    // 1. Provision new environment (Green)
    const greenEnv = await this.provisionEnvironment({
      projectId: plan.projectId,
      version: plan.toVersion,
      suffix: '-green',
    });

    // 2. Replicate data to green environment
    await this.replicateData({
      from: project.databaseUrl,
      to: greenEnv.databaseUrl,
    });

    // 3. Run database migrations on green
    await this.runDatabaseMigrations(greenEnv, plan.steps);

    // 4. Deploy application to green
    await this.deployApplication(greenEnv, plan.toVersion);

    // 5. Smoke tests on green
    const smokeTests = await this.runSmokeTests(greenEnv);
    if (!smokeTests.passed) {
      await this.destroyEnvironment(greenEnv);
      throw new Error('Smoke tests failed on green environment');
    }

    // 6. Final data sync (with application paused)
    await this.pauseWrites(project);
    await this.syncFinalData({
      from: project.databaseUrl,
      to: greenEnv.databaseUrl,
    });

    // 7. Switch traffic to green (atomic DNS/load balancer update)
    await this.switchTraffic({
      from: project.url,
      to: greenEnv.url,
    });

    // 8. Resume writes
    await this.resumeWrites(greenEnv);

    // 9. Monitor for 15 minutes
    await this.monitorEnvironment(greenEnv, 15 * 60 * 1000);

    // 10. Mark blue for deletion (kept for 24h for emergency rollback)
    await this.scheduleCleanup(project.environmentId, '24 hours');

    return {
      success: true,
      duration: Date.now() - plan.startTime,
      stage: 'completed',
    };
  }

  private async runPreflightChecks(plan: MigrationPlan): Promise<PreflightResult> {
    const checks: PreflightCheck[] = [
      {
        name: 'Backup Available',
        check: async () => {
          const recentBackup = await this.getRecentBackup(plan.projectId);
          return recentBackup && recentBackup.age < 24 * 60 * 60 * 1000; // <24h old
        },
      },
      {
        name: 'Sufficient Resources',
        check: async () => {
          const quota = await this.getResourceQuota(plan.projectId);
          const required = await this.estimateResourceRequirements(plan);
          return quota.cpu >= required.cpu && quota.memory >= required.memory;
        },
      },
      {
        name: 'No Pending Deployments',
        check: async () => {
          const pending = await db.deployment.count({
            where: {
              projectId: plan.projectId,
              status: { in: ['PENDING', 'IN_PROGRESS'] },
            },
          });
          return pending === 0;
        },
      },
      {
        name: 'Database Accessible',
        check: async () => {
          try {
            await this.testDatabaseConnection(plan.projectId);
            return true;
          } catch {
            return false;
          }
        },
      },
      {
        name: 'Migration Scripts Valid',
        check: async () => {
          return await this.validateMigrationScripts(plan.steps);
        },
      },
    ];

    const results = await Promise.all(checks.map((c) => c.check()));
    const passed = results.every((r) => r === true);

    return {
      passed,
      checks: checks.map((c, i) => ({
        name: c.name,
        passed: results[i],
      })),
      errors: checks
        .filter((c, i) => !results[i])
        .map((c) => `Pre-flight check failed: ${c.name}`),
    };
  }

  async rollback(plan: MigrationPlan, backup: Backup): Promise<void> {
    // 1. Stop writes to prevent data loss
    await this.pauseWrites(plan.projectId);

    // 2. Restore database from backup
    await this.restoreDatabase(plan.projectId, backup);

    // 3. Rollback application version
    await this.deployApplication(plan.projectId, plan.fromVersion);

    // 4. Update project metadata
    await db.transformationProject.update({
      where: { id: plan.projectId },
      data: {
        platformVersion: plan.fromVersion,
      },
    });

    // 5. Resume writes
    await this.resumeWrites(plan.projectId);

    // 6. Notify stakeholders
    await this.notifyRollback(plan);
  }
}

// Database schema for migration tracking
model Migration {
  id                String   @id @default(cuid())
  projectId         String
  project           TransformationProject @relation(fields: [projectId], references: [id])

  fromVersion       String
  toVersion         String
  strategy          MigrationStrategy

  status            MigrationStatus
  progress          Int      @default(0) // 0-100

  startedAt         DateTime @default(now())
  completedAt       DateTime?
  duration          Int?     // milliseconds

  steps             Json     // MigrationStep[]
  logs              Json[]   // Detailed logs

  backupId          String?
  rollbackAvailable Boolean  @default(true)

  error             String?
  rolledBack        Boolean  @default(false)

  initiatedBy       String

  @@index([projectId, status])
  @@index([status, startedAt])
}

enum MigrationStatus {
  PENDING
  PREFLIGHT_CHECKS
  BACKING_UP
  PROVISIONING
  MIGRATING_DATA
  TESTING
  SWITCHING_TRAFFIC
  MONITORING
  COMPLETED
  FAILED
  ROLLED_BACK
}
```

### Bulk Migration Orchestration

```typescript
// Migrate multiple projects

class BulkMigrationOrchestrator {
  async migrateProjects(config: {
    projectIds: string[];
    toVersion: string;
    strategy: MigrationStrategy;
    maxConcurrent: number;
  }): Promise<BulkMigrationResult> {
    const results: Map<string, MigrationResult> = new Map();

    // Create migration plans
    const plans = await Promise.all(
      config.projectIds.map((projectId) =>
        this.createMigrationPlan({
          projectId,
          toVersion: config.toVersion,
          strategy: config.strategy,
        })
      )
    );

    // Sort by estimated duration (fastest first)
    plans.sort((a, b) => a.estimatedDuration - b.estimatedDuration);

    // Execute in batches
    const batches = this.createBatches(plans, config.maxConcurrent);

    for (const batch of batches) {
      const batchResults = await Promise.allSettled(
        batch.map((plan) => this.migrationOrchestrator.executeMigration(plan))
      );

      // Record results
      for (let i = 0; i < batch.length; i++) {
        const plan = batch[i];
        const result = batchResults[i];

        if (result.status === 'fulfilled') {
          results.set(plan.projectId, result.value);
        } else {
          results.set(plan.projectId, {
            success: false,
            errors: [result.reason],
            stage: 'execution',
          });
        }
      }

      // Check failure rate
      const failures = batchResults.filter((r) => r.status === 'rejected').length;
      const failureRate = failures / batch.length;

      if (failureRate > 0.2) {
        // >20% failure rate - pause
        throw new Error(
          `Migration paused due to high failure rate: ${(failureRate * 100).toFixed(1)}%`
        );
      }
    }

    return {
      total: config.projectIds.length,
      successful: Array.from(results.values()).filter((r) => r.success).length,
      failed: Array.from(results.values()).filter((r) => !r.success).length,
      results,
    };
  }
}
```

## Consequences

### Positive

1. **Zero Downtime:** Blue-green strategy enables zero-downtime migrations
2. **Safe Rollback:** Automatic rollback on failure
3. **Parallel Execution:** Migrate many projects simultaneously
4. **Validated Migrations:** Pre-flight and post-migration checks
5. **Audit Trail:** Complete migration history
6. **Predictable:** Standardized process reduces risk

### Negative

1. **Resource Overhead:** Blue-green requires 2x resources temporarily
2. **Complexity:** Multiple strategies to maintain
3. **Time Intensive:** Careful migrations take longer
4. **Storage Cost:** Backups and dual environments increase cost

### Mitigations

1. **Scheduled Cleanup:** Automatic cleanup of old environments
2. **Cost Monitoring:** Track migration costs
3. **Efficient Strategies:** Use rolling updates when zero-downtime not required
4. **Backup Retention:** Limit backup retention to reduce storage

## Alternatives Considered

### Alternative 1: Manual Migrations

**Rejected Because:**
- Doesn't scale to hundreds of projects
- Error-prone
- Inconsistent execution

### Alternative 2: In-Place Migrations Only

**Rejected Because:**
- Requires downtime
- Difficult rollback
- Higher risk

## References

- [Blue-Green Deployments](https://martinfowler.com/bliki/BlueGreenDeployment.html)
- [Canary Releases](https://martinfowler.com/bliki/CanaryRelease.html)

## Review Date

2026-04-20 (3 months)
