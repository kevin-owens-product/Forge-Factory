# ADR-027: Project Versioning & Dependency Management

## Status
Accepted

## Context

With hundreds of transformation projects running concurrently, each project depends on the Forge Factory platform, shared libraries, templates, and external dependencies. As the platform evolves, we need to manage breaking changes, coordinate updates across projects, and maintain compatibility while allowing projects to evolve at their own pace.

### Requirements

**Versioning Requirements:**
- Track platform version for each project
- Support multiple platform versions simultaneously (N, N-1, N-2)
- Clear deprecation and sunset timelines
- Semantic versioning for all components
- Version compatibility matrix

**Dependency Management Requirements:**
- Track shared library versions per project
- Detect dependency conflicts
- Automated security vulnerability scanning
- Breaking change impact analysis
- Coordinated update orchestration

**Scale Requirements:**
- Support 1000+ projects on different versions
- Coordinate updates across 100+ projects
- Dependency graph for 1000s of packages
- Security patches deployed within 24 hours

### Current Challenges

1. **Version Fragmentation:** Projects on many different versions
2. **Breaking Changes:** Platform updates break existing projects
3. **Security Lag:** Critical vulnerabilities not patched quickly
4. **Dependency Conflicts:** Projects use incompatible library versions
5. **Update Fatigue:** Too many updates overwhelm teams
6. **No Impact Analysis:** Cannot predict breaking change effects

## Decision

We will implement a **Platform Versioning Strategy** with **Long-Term Support (LTS) releases**, **Dependency Lockfiles**, and **Automated Compatibility Testing** to manage hundreds of projects across multiple platform versions.

### Platform Versioning Strategy

```
Platform Version Timeline:

v5.0.0 (Current)    v5.1.0 (Next)      v6.0.0 (Future)
   │                   │                   │
   ├─ LTS Support      ├─ Active Dev       ├─ Planning
   ├─ Security Fixes   ├─ New Features     └─ Breaking Changes
   └─ Critical Bugs    └─ Bug Fixes

   │◄─── 18 months ───►│
         LTS Window

Version Support Levels:
┌──────────────────────────────────────────────────────────┐
│ CURRENT (v5.1.0)                                         │
│  - Full support                                          │
│  - All updates (features, bugs, security)                │
│  - Recommended for new projects                          │
│  - Support: 6 months from next major                     │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│ LTS (v5.0.0)                                             │
│  - Security fixes only                                   │
│  - Critical bug fixes                                    │
│  - No new features                                       │
│  - Support: 18 months from release                       │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│ MAINTENANCE (v4.2.0)                                     │
│  - Security fixes only                                   │
│  - Support: 12 months from next LTS                      │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│ EOL (v3.x)                                               │
│  - No support                                            │
│  - Forced upgrade required                               │
└──────────────────────────────────────────────────────────┘
```

### Semantic Versioning

All platform components use semantic versioning: **MAJOR.MINOR.PATCH**

```typescript
interface SemanticVersion {
  major: number; // Breaking changes
  minor: number; // New features (backward compatible)
  patch: number; // Bug fixes (backward compatible)
  prerelease?: string; // alpha, beta, rc
  build?: string; // Build metadata
}

// Examples:
// 5.0.0 - Major release with breaking changes
// 5.1.0 - New features, backward compatible
// 5.1.3 - Bug fixes
// 5.2.0-beta.1 - Pre-release
// 5.2.0+20260120 - Build metadata

// Breaking change policy:
// MAJOR: Breaking API changes, removed features, architectural changes
// MINOR: New features, deprecations (with warnings), non-breaking enhancements
// PATCH: Bug fixes, security patches, performance improvements
```

### Database Schema

```prisma
// Schema extension for apps/core/src/lib/db/schema.prisma

model PlatformVersion {
  id                String   @id @default(cuid())
  version           String   @unique // Semantic version (e.g., "5.1.0")

  major             Int
  minor             Int
  patch             Int
  prerelease        String?

  // Lifecycle
  status            VersionStatus
  releaseDate       DateTime
  eolDate           DateTime?
  ltsUntil          DateTime?

  // Release notes
  changelog         String   @db.Text
  breakingChanges   Json     // List of breaking changes
  deprecations      Json     // List of deprecations
  securityFixes     Json     // List of CVEs fixed

  // Compatibility
  compatibleWith    String[] // Previous versions compatible
  requiresMigration Boolean  @default(false)
  migrationGuide    String?  @db.Text

  // Artifacts
  releaseNotesUrl   String?
  dockerImage       String
  helmChartVersion  String

  // Statistics
  projectCount      Int      @default(0) // Projects on this version

  projects          TransformationProject[]
  dependencies      PlatformDependency[]

  createdAt         DateTime @default(now())

  @@index([status, releaseDate])
  @@index([major, minor, patch])
}

enum VersionStatus {
  PLANNED      // Future version
  ALPHA        // Early testing
  BETA         // Public testing
  RC           // Release candidate
  CURRENT      // Latest stable
  LTS          // Long-term support
  MAINTENANCE  // Security fixes only
  EOL          // End of life
}

model PlatformDependency {
  id                String   @id @default(cuid())

  platformVersionId String
  platformVersion   PlatformVersion @relation(fields: [platformVersionId], references: [id])

  // Dependency details
  name              String
  version           String
  versionConstraint String   // npm-style (e.g., "^18.0.0", ">=16.0.0 <19.0.0")

  type              DependencyType
  scope             DependencyScope

  // Package info
  packageManager    String   // npm, pip, maven, etc.
  registry          String?

  // Security
  knownVulnerabilities Json  // CVE list

  createdAt         DateTime @default(now())

  @@unique([platformVersionId, name])
  @@index([name, version])
}

enum DependencyType {
  RUNTIME      // Required at runtime
  BUILD        // Required for building
  DEVELOPMENT  // Dev dependencies only
  PEER         // Peer dependency
}

enum DependencyScope {
  PLATFORM     // Core platform dependency
  TEMPLATE     // Template-level dependency
  PROJECT      // Project-level dependency
}

// Extension to TransformationProject
model TransformationProject {
  // ... existing fields ...

  // Platform version
  platformVersionId String
  platformVersion   PlatformVersion @relation(fields: [platformVersionId], references: [id])

  // Dependency tracking
  dependencies      ProjectDependency[]
  dependencyLockfile Json?    // Complete lockfile snapshot

  // Update preferences
  autoUpdatePolicy  AutoUpdatePolicy @default(LTS_ONLY)
  allowedVersions   String?   // Version constraint (e.g., "5.x", "^5.0.0")

  // Update status
  updateAvailable   Boolean  @default(false)
  latestCompatibleVersion String?
  blockedDependencies Json?   // Dependencies blocking update
}

enum AutoUpdatePolicy {
  NONE             // Manual updates only
  PATCH_ONLY       // Auto patch updates (5.1.1 → 5.1.2)
  MINOR            // Auto minor updates (5.1.0 → 5.2.0)
  LTS_ONLY         // Auto LTS releases only
  CURRENT          // Always update to latest stable
}

model ProjectDependency {
  id                String   @id @default(cuid())

  projectId         String
  project           TransformationProject @relation(fields: [projectId], references: [id])

  // Dependency info
  name              String
  version           String
  requestedVersion  String   // Version specified in package.json
  resolvedVersion   String   // Actual installed version

  type              DependencyType
  direct            Boolean  // Direct vs transitive

  // Security
  vulnerabilities   SecurityVulnerability[]

  // Metadata
  lastChecked       DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@unique([projectId, name])
  @@index([name, version])
}

model SecurityVulnerability {
  id                String   @id @default(cuid())

  dependencyId      String
  dependency        ProjectDependency @relation(fields: [dependencyId], references: [id])

  // CVE info
  cveId             String   @unique
  severity          VulnerabilitySeverity
  cvssScore         Float?

  // Details
  title             String
  description       String   @db.Text
  publishedDate     DateTime

  // Fix
  fixedInVersion    String?
  patchAvailable    Boolean  @default(false)

  // Status
  status            VulnerabilityStatus @default(OPEN)
  resolvedAt        DateTime?
  mitigationNotes   String?  @db.Text

  createdAt         DateTime @default(now())

  @@index([severity, status])
  @@index([cveId])
}

enum VulnerabilitySeverity {
  CRITICAL
  HIGH
  MEDIUM
  LOW
  INFO
}

enum VulnerabilityStatus {
  OPEN
  IN_PROGRESS
  PATCHED
  MITIGATED
  ACCEPTED_RISK
  FALSE_POSITIVE
}

model DependencyUpdate {
  id                String   @id @default(cuid())

  // Target
  projectId         String?  // Null for platform-wide update
  organizationId    String?  // Null for all orgs

  // Update details
  dependencyName    String
  fromVersion       String
  toVersion         String

  updateType        UpdateType
  breaking          Boolean  @default(false)
  securityFix       Boolean  @default(false)

  // Rollout
  status            UpdateStatus
  strategy          RolloutStrategy

  affectedProjects  Int      @default(0)
  successfulProjects Int     @default(0)
  failedProjects    Int      @default(0)

  // Timing
  scheduledAt       DateTime?
  startedAt         DateTime?
  completedAt       DateTime?

  // Metadata
  initiatedBy       String
  reason            String?
  changelog         String?  @db.Text

  createdAt         DateTime @default(now())

  @@index([status, scheduledAt])
  @@index([dependencyName])
}

enum UpdateType {
  PATCH
  MINOR
  MAJOR
  SECURITY
}

enum UpdateStatus {
  PLANNED
  SCHEDULED
  IN_PROGRESS
  COMPLETED
  FAILED
  ROLLED_BACK
}

enum RolloutStrategy {
  IMMEDIATE      // All at once
  GRADUAL        // Phased rollout
  CANARY         // Canary then gradual
  MANUAL         // Manual approval per project
}
```

### Platform Version Management

```typescript
// apps/core/src/lib/services/platform-versioning/

class PlatformVersionManager {
  async releaseVersion(config: {
    version: string;
    changelog: string;
    breakingChanges: BreakingChange[];
    deprecations: Deprecation[];
    securityFixes: SecurityFix[];
  }): Promise<PlatformVersion> {
    const semver = this.parseSemVer(config.version);

    // Determine version status
    const status = semver.prerelease
      ? this.prereleaseStatus(semver.prerelease)
      : VersionStatus.CURRENT;

    // Calculate EOL date
    const eolDate = this.calculateEOLDate(semver, status);
    const ltsUntil = semver.major % 2 === 0 // Even major versions are LTS
      ? this.calculateLTSDate(semver)
      : null;

    // Create version
    const version = await db.platformVersion.create({
      data: {
        version: config.version,
        major: semver.major,
        minor: semver.minor,
        patch: semver.patch,
        prerelease: semver.prerelease,
        status,
        releaseDate: new Date(),
        eolDate,
        ltsUntil,
        changelog: config.changelog,
        breakingChanges: config.breakingChanges,
        deprecations: config.deprecations,
        securityFixes: config.securityFixes,
        compatibleWith: this.calculateCompatibility(semver),
        requiresMigration: config.breakingChanges.length > 0,
        dockerImage: `forge-factory:${config.version}`,
        helmChartVersion: config.version,
      },
    });

    // Update previous CURRENT version to LTS or MAINTENANCE
    await this.transitionPreviousVersions(version);

    // Analyze affected projects
    const affectedProjects = await this.analyzeBreakingChangeImpact(
      config.breakingChanges
    );

    // Send notifications
    await this.notifyVersionRelease(version, affectedProjects);

    return version;
  }

  private calculateEOLDate(
    semver: SemanticVersion,
    status: VersionStatus
  ): Date {
    const now = new Date();

    switch (status) {
      case VersionStatus.CURRENT:
        // Supported until next major + 6 months
        return new Date(now.getTime() + 18 * 30 * 24 * 60 * 60 * 1000);

      case VersionStatus.LTS:
        // LTS supported for 18 months
        return new Date(now.getTime() + 18 * 30 * 24 * 60 * 60 * 1000);

      case VersionStatus.MAINTENANCE:
        // Maintenance for 12 months
        return new Date(now.getTime() + 12 * 30 * 24 * 60 * 60 * 1000);

      default:
        return new Date(now.getTime() + 6 * 30 * 24 * 60 * 60 * 1000);
    }
  }

  private calculateCompatibility(semver: SemanticVersion): string[] {
    const compatible: string[] = [];

    // Patch versions compatible with same minor
    if (semver.patch > 0) {
      for (let p = 0; p < semver.patch; p++) {
        compatible.push(`${semver.major}.${semver.minor}.${p}`);
      }
    }

    // Minor versions compatible within same major (non-breaking)
    if (semver.minor > 0) {
      for (let m = 0; m < semver.minor; m++) {
        compatible.push(`${semver.major}.${m}.x`);
      }
    }

    return compatible;
  }

  async analyzeBreakingChangeImpact(
    breakingChanges: BreakingChange[]
  ): Promise<ImpactAnalysis> {
    const analysis: ImpactAnalysis = {
      totalProjects: 0,
      affectedProjects: [],
      impactByChange: {},
    };

    for (const change of breakingChanges) {
      // Find projects using affected APIs/features
      const affected = await this.findAffectedProjects(change);

      analysis.impactByChange[change.id] = {
        change,
        affectedCount: affected.length,
        projects: affected,
      };

      analysis.affectedProjects.push(...affected);
    }

    analysis.totalProjects = new Set(analysis.affectedProjects).size;

    return analysis;
  }

  private async findAffectedProjects(
    change: BreakingChange
  ): Promise<TransformationProject[]> {
    // Use code analysis to find usage
    const searchPatterns = change.detectionPatterns || [];

    const affectedProjects: TransformationProject[] = [];

    for (const pattern of searchPatterns) {
      // Search across all project repositories
      const results = await this.codeSearch.search({
        pattern,
        scope: 'all-projects',
      });

      affectedProjects.push(...results.projects);
    }

    return [...new Set(affectedProjects)];
  }
}

interface BreakingChange {
  id: string;
  title: string;
  description: string;
  affectedAPI?: string;
  detectionPatterns?: string[]; // Regex patterns to detect usage
  migrationGuide: string;
  automatedMigration?: boolean;
  migrationScript?: string;
}

interface Deprecation {
  feature: string;
  deprecatedIn: string; // Version
  removedIn: string; // Version
  replacement?: string;
  migrationGuide: string;
}

interface SecurityFix {
  cveId: string;
  severity: VulnerabilitySeverity;
  description: string;
  affectedVersions: string[];
  fixedIn: string;
}
```

### Dependency Management

```typescript
// apps/core/src/lib/services/dependency-management/

class DependencyManager {
  async scanDependencies(projectId: string): Promise<DependencyScanResult> {
    const project = await db.transformationProject.findUnique({
      where: { id: projectId },
    });

    // Read lockfile from project repository
    const lockfile = await this.readLockfile(project);

    // Parse dependencies
    const dependencies = this.parseLockfile(lockfile);

    // Scan for vulnerabilities
    const vulnerabilities = await this.scanVulnerabilities(dependencies);

    // Check for updates
    const updates = await this.checkUpdates(dependencies);

    // Detect conflicts
    const conflicts = await this.detectConflicts(project, dependencies);

    // Store in database
    await this.storeDependencies(projectId, dependencies, vulnerabilities);

    return {
      total: dependencies.length,
      direct: dependencies.filter((d) => d.direct).length,
      transitive: dependencies.filter((d) => !d.direct).length,
      vulnerabilities: vulnerabilities.length,
      criticalVulnerabilities: vulnerabilities.filter(
        (v) => v.severity === VulnerabilitySeverity.CRITICAL
      ).length,
      updates: updates.length,
      conflicts: conflicts.length,
    };
  }

  async scanVulnerabilities(
    dependencies: Dependency[]
  ): Promise<SecurityVulnerability[]> {
    const vulnerabilities: SecurityVulnerability[] = [];

    // Use multiple sources
    const sources = [
      this.scanWithNpmAudit(dependencies),
      this.scanWithSnyk(dependencies),
      this.scanWithOSV(dependencies),
    ];

    const results = await Promise.all(sources);

    // Deduplicate by CVE ID
    const vulnMap = new Map<string, SecurityVulnerability>();

    for (const result of results) {
      for (const vuln of result) {
        if (!vulnMap.has(vuln.cveId)) {
          vulnMap.set(vuln.cveId, vuln);
        }
      }
    }

    return Array.from(vulnMap.values());
  }

  async updateDependency(config: {
    projectId: string;
    dependencyName: string;
    toVersion: string;
    reason?: string;
  }): Promise<void> {
    // Create update record
    const update = await db.dependencyUpdate.create({
      data: {
        projectId: config.projectId,
        dependencyName: config.dependencyName,
        fromVersion: await this.getCurrentVersion(
          config.projectId,
          config.dependencyName
        ),
        toVersion: config.toVersion,
        updateType: this.determineUpdateType(
          config.dependencyName,
          config.toVersion
        ),
        status: UpdateStatus.PLANNED,
        initiatedBy: 'system',
        reason: config.reason,
      },
    });

    try {
      // Update package.json in repository
      await this.updatePackageJson(config.projectId, {
        [config.dependencyName]: config.toVersion,
      });

      // Run npm install / update lockfile
      await this.updateLockfile(config.projectId);

      // Run tests
      const testResult = await this.runTests(config.projectId);

      if (!testResult.success) {
        throw new Error(`Tests failed after update: ${testResult.errors.join(', ')}`);
      }

      // Create PR with update
      await this.createUpdatePR(config.projectId, update);

      // Mark as completed
      await db.dependencyUpdate.update({
        where: { id: update.id },
        data: {
          status: UpdateStatus.COMPLETED,
          completedAt: new Date(),
        },
      });
    } catch (error) {
      // Rollback
      await this.rollbackUpdate(update);

      await db.dependencyUpdate.update({
        where: { id: update.id },
        data: {
          status: UpdateStatus.FAILED,
          completedAt: new Date(),
        },
      });

      throw error;
    }
  }

  async bulkUpdate(config: {
    dependencyName: string;
    toVersion: string;
    filter?: {
      organizationId?: string;
      lifecycleStage?: ProjectStatus;
      currentVersion?: string;
    };
    strategy: RolloutStrategy;
  }): Promise<DependencyUpdate> {
    // Find affected projects
    const projects = await this.findProjectsWithDependency(
      config.dependencyName,
      config.filter
    );

    // Create bulk update record
    const update = await db.dependencyUpdate.create({
      data: {
        dependencyName: config.dependencyName,
        fromVersion: config.filter?.currentVersion || '*',
        toVersion: config.toVersion,
        updateType: this.determineUpdateType(
          config.dependencyName,
          config.toVersion
        ),
        status: UpdateStatus.PLANNED,
        strategy: config.strategy,
        affectedProjects: projects.length,
        initiatedBy: 'system',
      },
    });

    // Execute based on strategy
    switch (config.strategy) {
      case RolloutStrategy.IMMEDIATE:
        await this.executeImmediateUpdate(update, projects);
        break;

      case RolloutStrategy.GRADUAL:
        await this.executeGradualUpdate(update, projects);
        break;

      case RolloutStrategy.CANARY:
        await this.executeCanaryUpdate(update, projects);
        break;

      case RolloutStrategy.MANUAL:
        await this.notifyManualUpdate(update, projects);
        break;
    }

    return update;
  }

  private async executeGradualUpdate(
    update: DependencyUpdate,
    projects: TransformationProject[]
  ): Promise<void> {
    // Phase 1: 5% canary
    const canary = projects.slice(0, Math.ceil(projects.length * 0.05));
    await this.updateProjects(canary, update);
    await sleep(24 * 60 * 60 * 1000); // Wait 24h

    // Check canary health
    const canaryHealth = await this.checkUpdateHealth(canary);
    if (canaryHealth.failureRate > 0.1) {
      // >10% failure rate
      await this.pauseUpdate(update);
      throw new Error('Canary update failed, pausing rollout');
    }

    // Phase 2: 25%
    const phase2 = projects.slice(
      Math.ceil(projects.length * 0.05),
      Math.ceil(projects.length * 0.30)
    );
    await this.updateProjects(phase2, update);
    await sleep(12 * 60 * 60 * 1000); // Wait 12h

    // Phase 3: Remaining
    const phase3 = projects.slice(Math.ceil(projects.length * 0.30));
    await this.updateProjects(phase3, update);
  }

  private async updateProjects(
    projects: TransformationProject[],
    update: DependencyUpdate
  ): Promise<void> {
    const results = await Promise.allSettled(
      projects.map((project) =>
        this.updateDependency({
          projectId: project.id,
          dependencyName: update.dependencyName,
          toVersion: update.toVersion,
          reason: `Bulk update: ${update.id}`,
        })
      )
    );

    const successful = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    await db.dependencyUpdate.update({
      where: { id: update.id },
      data: {
        successfulProjects: { increment: successful },
        failedProjects: { increment: failed },
      },
    });
  }
}

interface DependencyScanResult {
  total: number;
  direct: number;
  transitive: number;
  vulnerabilities: number;
  criticalVulnerabilities: number;
  updates: number;
  conflicts: number;
}
```

### Migration Tools

```typescript
// apps/core/src/lib/services/migration/

class PlatformMigrationManager {
  async migratePlatformVersion(
    projectId: string,
    targetVersion: string
  ): Promise<MigrationResult> {
    const project = await db.transformationProject.findUnique({
      where: { id: projectId },
      include: { platformVersion: true },
    });

    const currentVersion = project.platformVersion.version;
    const target = await db.platformVersion.findUnique({
      where: { version: targetVersion },
    });

    if (!target) {
      throw new Error(`Target version ${targetVersion} not found`);
    }

    // Calculate migration path
    const migrationPath = this.calculateMigrationPath(
      currentVersion,
      targetVersion
    );

    // Run pre-migration checks
    const checks = await this.runPreMigrationChecks(project, target);

    if (!checks.passed) {
      return {
        success: false,
        errors: checks.errors,
        warnings: checks.warnings,
      };
    }

    // Execute migrations step by step
    for (const step of migrationPath) {
      await this.executeMigrationStep(project, step);
    }

    // Update platform version
    await db.transformationProject.update({
      where: { id: projectId },
      data: {
        platformVersionId: target.id,
      },
    });

    // Run post-migration validation
    const validation = await this.validateMigration(project, target);

    return {
      success: validation.passed,
      migratedFrom: currentVersion,
      migratedTo: targetVersion,
      stepsExecuted: migrationPath.length,
      warnings: validation.warnings,
    };
  }

  private calculateMigrationPath(
    fromVersion: string,
    toVersion: string
  ): MigrationStep[] {
    const from = this.parseSemVer(fromVersion);
    const to = this.parseSemVer(toVersion);

    const steps: MigrationStep[] = [];

    // Major version jumps require explicit migration steps
    if (to.major > from.major) {
      for (let major = from.major + 1; major <= to.major; major++) {
        steps.push({
          type: 'major-upgrade',
          fromVersion: `${major - 1}.x.x`,
          toVersion: `${major}.0.0`,
          scripts: this.getMajorUpgradeScripts(major),
          breaking: true,
        });
      }
    }

    // Minor version migrations (usually automatic)
    if (to.minor > from.minor && to.major === from.major) {
      steps.push({
        type: 'minor-upgrade',
        fromVersion: `${from.major}.${from.minor}.x`,
        toVersion: `${to.major}.${to.minor}.0`,
        scripts: [],
        breaking: false,
      });
    }

    // Patch migrations (usually automatic)
    if (to.patch > from.patch && to.major === from.major && to.minor === from.minor) {
      steps.push({
        type: 'patch-upgrade',
        fromVersion: `${from.major}.${from.minor}.${from.patch}`,
        toVersion: `${to.major}.${to.minor}.${to.patch}`,
        scripts: [],
        breaking: false,
      });
    }

    return steps;
  }
}

interface MigrationStep {
  type: 'major-upgrade' | 'minor-upgrade' | 'patch-upgrade';
  fromVersion: string;
  toVersion: string;
  scripts: MigrationScript[];
  breaking: boolean;
}

interface MigrationScript {
  name: string;
  description: string;
  script: string; // Path to script or inline code
  rollback?: string; // Rollback script
}
```

## Consequences

### Positive

1. **Clear Versioning:** Semantic versioning provides clarity
2. **Controlled Updates:** LTS strategy allows gradual adoption
3. **Security:** Fast security patching across all projects
4. **Compatibility:** Multiple versions supported simultaneously
5. **Migration Paths:** Clear upgrade paths with automation
6. **Dependency Tracking:** Full visibility into dependency tree
7. **Risk Reduction:** Gradual rollouts minimize impact

### Negative

1. **Complexity:** Supporting N-2 versions is complex
2. **Testing Burden:** Need to test against multiple versions
3. **Storage Overhead:** Multiple platform versions stored
4. **Update Fatigue:** Too many updates can overwhelm teams
5. **Conflict Resolution:** Dependency conflicts difficult to resolve
6. **Migration Effort:** Major version upgrades require significant work

### Mitigations

1. **Automated Testing:** CI/CD tests against all supported versions
2. **Clear EOL Policy:** Sunset old versions after defined period
3. **Migration Tools:** Automated migration scripts where possible
4. **Gradual Rollouts:** Phased updates reduce risk
5. **Dependency Bots:** Automated dependency update PRs
6. **Clear Communication:** Release notes, changelogs, migration guides

## Alternatives Considered

### Alternative 1: Single Version (Always Latest)

**Description:** All projects must use latest platform version

**Rejected Because:**
- Breaking changes disrupt all projects simultaneously
- No flexibility for project-specific timelines
- High risk during major upgrades
- Forces unwanted updates

### Alternative 2: Unlimited Version Support

**Description:** Support all versions indefinitely

**Rejected Because:**
- Unsustainable maintenance burden
- Security vulnerabilities in old versions
- Testing complexity exponential
- Infrastructure costs too high

### Alternative 3: No Semantic Versioning

**Description:** Date-based or arbitrary versioning

**Rejected Because:**
- Cannot determine breaking changes from version
- No automated update strategies
- Unclear compatibility
- Industry best practice is semantic versioning

## Implementation Plan

### Phase 1: Versioning Infrastructure (Weeks 1-3)
- Platform version tracking
- Semantic version parsing
- EOL calculation
- LTS designation

### Phase 2: Dependency Management (Weeks 4-7)
- Dependency scanning
- Vulnerability detection
- Lockfile management
- Update orchestration

### Phase 3: Migration Tools (Weeks 8-11)
- Migration path calculation
- Automated migration scripts
- Pre/post migration checks
- Rollback capability

### Phase 4: Monitoring & Reporting (Weeks 12-14)
- Version distribution dashboard
- Vulnerability reports
- Update tracking
- EOL warnings

## Testing Strategy

### Unit Tests
- Semantic version parsing
- Compatibility calculation
- Migration path generation

### Integration Tests
- End-to-end migration
- Dependency updates
- Vulnerability scanning
- Rollback scenarios

### Load Tests
- 1000 projects dependency scan
- Bulk updates across 500 projects
- Migration performance

## Metrics & Monitoring

### Key Metrics
- **Version Distribution:** % of projects on each version
- **EOL Warnings:** Projects on EOL versions
- **Security Coverage:** % projects with no critical vulnerabilities
- **Update Adoption:** Time to 80% adoption of new versions
- **Migration Success Rate:** % successful migrations

### Alerts
- Critical vulnerabilities detected
- Projects on EOL versions
- Failed migrations
- Dependency conflicts

## References

- [Semantic Versioning](https://semver.org/)
- [Node.js Release Schedule](https://github.com/nodejs/release)
- [Kubernetes Version Skew Policy](https://kubernetes.io/releases/version-skew-policy/)

## Review Date

2026-04-20 (3 months)
