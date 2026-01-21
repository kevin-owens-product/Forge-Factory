# ADR-025: Multi-Project Code Generation & Template Management

## Status
Accepted

## Context

With dozens to hundreds of transformation projects running concurrently, each based on templates and requiring ongoing code generation, we need a robust system to manage templates, track what code was generated from which template version, and handle updates across hundreds of projects when templates evolve.

### Requirements

**Scale Requirements:**
- Support 10-50 distinct template types (e.g., "enterprise-app", "microservice", "data-pipeline")
- Manage 100-500 template versions simultaneously
- Generate code for 10-50 new projects per week
- Update 50-200 existing projects when templates change
- Track template usage across 1000+ projects

**Template Management Requirements:**
- Version templates with semantic versioning
- Track template lineage and evolution
- Support template composition (templates using other templates)
- Enable template customization per organization
- Provide template testing and validation
- Support gradual rollout of new template versions

**Code Generation Requirements:**
- Deterministic generation (same input = same output)
- Traceability (know what was generated from what)
- Incremental generation (update only changed files)
- Conflict detection and resolution
- Safe regeneration without losing manual changes
- Support for protected regions in generated files

**Update Management Requirements:**
- Identify which projects need updates when templates change
- Classify updates by impact (breaking, feature, bugfix)
- Enable opt-in or automatic updates based on project lifecycle
- Provide rollback capability
- Track update adoption across project portfolio

### Current Challenges

1. **Template Sprawl:** No central template registry or versioning
2. **Update Chaos:** No systematic way to update hundreds of projects
3. **Lost Modifications:** Regenerating code overwrites manual changes
4. **No Traceability:** Can't tell what code came from which template
5. **Breaking Changes:** Template updates break existing projects
6. **Testing Gap:** No way to test templates before deploying to projects
7. **Customization Conflicts:** Project-specific customizations conflict with template updates

## Decision

We will implement a **Versioned Template System** with **Safe Code Generation**, **Protected Regions**, and **Controlled Update Propagation** across the project portfolio.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Template Registry                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Template A  │  │  Template B  │  │  Template C  │      │
│  │  v1.0, v1.1  │  │  v2.0, v2.1  │  │  v1.5, v2.0  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                  Code Generation Engine                      │
│  ┌────────────┐  ┌─────────────┐  ┌──────────────┐         │
│  │ Generator  │  │  Protected  │  │   Conflict   │         │
│  │   Core     │  │   Regions   │  │  Resolution  │         │
│  └────────────┘  └─────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                  Project Instances (1000+)                   │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Project 1                                             │  │
│  │  Template: A@v1.0                                      │  │
│  │  Generated: 2024-01-01                                 │  │
│  │  Manual Changes: Yes (protected)                       │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Project 2                                             │  │
│  │  Template: A@v1.1                                      │  │
│  │  Generated: 2024-02-01                                 │  │
│  │  Manual Changes: No                                    │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Update Orchestrator                       │
│  ┌──────────────┐  ┌─────────────┐  ┌──────────────┐       │
│  │   Impact     │  │  Rollout    │  │   Rollback   │       │
│  │  Analysis    │  │  Strategy   │  │   Manager    │       │
│  └──────────────┘  └─────────────┘  └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

### Template Structure

```typescript
// Template definition
interface ProjectTemplate {
  // Identity
  id: string;
  name: string;
  slug: string;
  version: string; // Semantic version (e.g., "2.1.3")

  // Metadata
  description: string;
  category: string;
  tags: string[];

  // Composition
  extends?: string; // Parent template ID
  includes?: string[]; // Composed template IDs

  // Configuration
  schema: JsonSchema; // Configuration options
  defaultConfig: Record<string, any>;
  defaultQuota: ResourceQuota;
  defaultFeatures: string[];

  // Generation
  generators: GeneratorConfig[];
  hooks: TemplateHooks;

  // Constraints
  platformVersionMin: string;
  platformVersionMax?: string;
  requiredFeatures: string[];

  // Lifecycle
  status: 'DRAFT' | 'TESTING' | 'ACTIVE' | 'DEPRECATED';
  deprecationDate?: Date;
  replacedBy?: string; // Template ID

  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
}

interface GeneratorConfig {
  name: string;
  type: 'file' | 'directory' | 'command';

  // For file generators
  source?: string; // Template file path
  destination: string; // Output path (supports variables)

  // For directory generators
  sourceDir?: string;
  destinationDir?: string;

  // For command generators
  command?: string;

  // Control
  condition?: string; // JavaScript expression
  overwrite: 'always' | 'never' | 'if-unchanged' | 'prompt';
  protected: boolean; // If true, supports protected regions
}

interface TemplateHooks {
  beforeGenerate?: string; // Script to run before generation
  afterGenerate?: string; // Script to run after generation
  beforeUpdate?: string; // Script to run before updating existing project
  afterUpdate?: string; // Script to run after updating existing project
}
```

### Database Schema

```prisma
// Schema extension for apps/core/src/lib/db/schema.prisma

model ProjectTemplate {
  id                String   @id @default(cuid())
  name              String
  slug              String
  version           String   // Semantic version

  description       String
  category          String
  tags              String[]

  // Composition
  extendsId         String?
  extends           ProjectTemplate? @relation("TemplateInheritance", fields: [extendsId], references: [id])
  children          ProjectTemplate[] @relation("TemplateInheritance")

  includesIds       String[]
  includes          ProjectTemplate[] @relation("TemplateComposition")
  includedBy        ProjectTemplate[] @relation("TemplateComposition")

  // Configuration
  schema            Json     // JSON Schema
  defaultConfig     Json
  defaultQuota      Json
  defaultFeatures   Json

  // Generation
  generators        Json     // GeneratorConfig[]
  hooks             Json     // TemplateHooks

  // Constraints
  platformVersionMin String
  platformVersionMax String?
  requiredFeatures  String[]

  // Lifecycle
  status            TemplateStatus @default(DRAFT)
  deprecationDate   DateTime?
  replacedById      String?
  replacedBy        ProjectTemplate? @relation("TemplateReplacement", fields: [replacedById], references: [id])
  replaces          ProjectTemplate[] @relation("TemplateReplacement")

  // Storage
  storageUrl        String   // S3/GCS URL for template files
  checksum          String   // SHA-256 of template package

  // Audit
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  publishedAt       DateTime?
  createdBy         String

  // Relations
  projects          TransformationProject[]
  generations       CodeGeneration[]
  tests             TemplateTest[]

  @@unique([slug, version])
  @@index([status, category])
  @@index([version])
}

enum TemplateStatus {
  DRAFT
  TESTING
  ACTIVE
  DEPRECATED
}

model CodeGeneration {
  id                String   @id @default(cuid())

  // Source
  templateId        String
  template          ProjectTemplate @relation(fields: [templateId], references: [id])
  templateVersion   String

  // Target
  projectId         String
  project           TransformationProject @relation(fields: [projectId], references: [id])

  // Generation details
  type              GenerationType
  config            Json     // Configuration used

  // Results
  status            GenerationStatus
  filesGenerated    Int      @default(0)
  filesUpdated      Int      @default(0)
  filesSkipped      Int      @default(0)
  filesConflicted   Int      @default(0)

  // Tracking
  generatedFiles    GeneratedFile[]
  conflicts         GenerationConflict[]

  // Metadata
  triggeredBy       String
  startedAt         DateTime @default(now())
  completedAt       DateTime?
  duration          Int?     // Milliseconds

  // Error handling
  error             String?
  rollbackAt        DateTime?

  @@index([projectId, startedAt])
  @@index([templateId, templateVersion])
  @@index([status, startedAt])
}

enum GenerationType {
  INITIAL      // First generation for new project
  REGENERATE   // Full regeneration
  UPDATE       // Template version update
  PARTIAL      // Specific files only
}

enum GenerationStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
  ROLLED_BACK
}

model GeneratedFile {
  id                String   @id @default(cuid())

  generationId      String
  generation        CodeGeneration @relation(fields: [generationId], references: [id])

  // File details
  path              String
  checksum          String   // SHA-256 of generated content
  size              Int

  // Tracking
  operation         FileOperation
  hasProtectedRegions Boolean @default(false)
  wasModified       Boolean  @default(false) // Modified after generation

  // Metadata
  generatedAt       DateTime @default(now())

  @@unique([generationId, path])
  @@index([path])
}

enum FileOperation {
  CREATED
  UPDATED
  SKIPPED
  CONFLICTED
}

model GenerationConflict {
  id                String   @id @default(cuid())

  generationId      String
  generation        CodeGeneration @relation(fields: [generationId], references: [id])

  // Conflict details
  path              String
  conflictType      ConflictType

  // Content
  generatedContent  String   @db.Text
  existingContent   String   @db.Text

  // Resolution
  resolution        ConflictResolution?
  resolvedBy        String?
  resolvedAt        DateTime?
  finalContent      String?  @db.Text

  createdAt         DateTime @default(now())

  @@index([generationId, resolution])
}

enum ConflictType {
  MODIFIED_FILE     // File was manually modified
  MERGE_CONFLICT    // Cannot automatically merge changes
  PROTECTED_REGION  // Protected region changed in template
}

enum ConflictResolution {
  USE_GENERATED     // Use new generated version
  KEEP_EXISTING     // Keep manual changes
  MANUAL_MERGE      // Manually merged
  SKIP              // Skip this file
}

model TemplateTest {
  id                String   @id @default(cuid())

  templateId        String
  template          ProjectTemplate @relation(fields: [templateId], references: [id])

  // Test configuration
  name              String
  config            Json     // Test-specific configuration

  // Results
  status            TestStatus
  passedChecks      Int      @default(0)
  failedChecks      Int      @default(0)
  warnings          Int      @default(0)

  output            Json?    // Detailed test results
  error             String?

  // Timing
  startedAt         DateTime @default(now())
  completedAt       DateTime?
  duration          Int?

  // Tracking
  triggeredBy       String

  @@index([templateId, status])
  @@index([startedAt])
}

enum TestStatus {
  PENDING
  RUNNING
  PASSED
  FAILED
}

// Extension to TransformationProject
model TransformationProject {
  // ... existing fields ...

  // Template tracking
  templateId        String
  template          ProjectTemplate @relation(fields: [templateId], references: [id])
  templateVersion   String

  // Generation history
  generations       CodeGeneration[]

  // Update preferences
  updatePolicy      UpdatePolicy @default(MANUAL)
  autoUpdateTo      String?      // Max version for auto-updates (e.g., "2.x")
}

enum UpdatePolicy {
  MANUAL            // Never auto-update
  PATCH             // Auto-update patch versions only (2.1.x)
  MINOR             // Auto-update minor versions (2.x.x)
  MAJOR             // Auto-update all versions (dangerous)
  SECURITY_ONLY     // Only auto-apply security patches
}
```

### Protected Regions

Protected regions allow developers to make manual changes within generated files without losing them on regeneration.

```typescript
// Example generated file with protected regions

/**
 * @generated-at 2026-01-20T00:00:00Z
 * @template enterprise-app@2.1.0
 * @generator apps/core/src/lib/api/user-api.ts
 * @prompt-id forge-v4.1:template:enterprise-app:user-api:001
 *
 * WARNING: This file is auto-generated. Do not modify outside protected regions.
 */

import { authedProcedure, router } from '../trpc';
import { z } from 'zod';

// PROTECTED_REGION_BEGIN: custom-imports
// Add your custom imports here
import { sendWelcomeEmail } from './email-service';
import { trackUserRegistration } from './analytics';
// PROTECTED_REGION_END: custom-imports

const UserSchema = z.object({
  email: z.string().email(),
  name: z.string(),
  role: z.enum(['USER', 'ADMIN']),
});

export const userRouter = router({
  create: authedProcedure
    .input(UserSchema)
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.create({
        data: input,
      });

      // PROTECTED_REGION_BEGIN: post-create-hooks
      // Add custom logic after user creation
      await sendWelcomeEmail(user.email);
      await trackUserRegistration(user.id);
      // PROTECTED_REGION_END: post-create-hooks

      return user;
    }),

  // PROTECTED_REGION_BEGIN: custom-endpoints
  // Add your custom endpoints here
  sendPasswordReset: authedProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ ctx, input }) => {
      // Custom implementation
      const user = await ctx.db.user.findUnique({
        where: { email: input.email },
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Send reset email
      await sendPasswordResetEmail(user.email);

      return { success: true };
    }),
  // PROTECTED_REGION_END: custom-endpoints
});
```

### Code Generation Engine

```typescript
// apps/core/src/lib/services/code-generation/

import Handlebars from 'handlebars';
import * as diff from 'diff';

interface GenerationContext {
  project: TransformationProject;
  template: ProjectTemplate;
  config: Record<string, any>;
  previousGeneration?: CodeGeneration;
}

class CodeGenerationEngine {
  async generate(ctx: GenerationContext): Promise<CodeGeneration> {
    const generation = await this.createGenerationRecord(ctx);

    try {
      // Download template files
      const templateFiles = await this.downloadTemplate(ctx.template);

      // Prepare Handlebars context
      const handlebarsContext = this.prepareContext(ctx);

      // Run pre-generation hooks
      await this.runHook(ctx.template.hooks.beforeGenerate, handlebarsContext);

      // Generate files
      for (const generatorConfig of ctx.template.generators) {
        if (!this.shouldGenerate(generatorConfig, handlebarsContext)) {
          continue;
        }

        await this.generateFile(
          generation,
          generatorConfig,
          templateFiles,
          handlebarsContext,
          ctx
        );
      }

      // Run post-generation hooks
      await this.runHook(ctx.template.hooks.afterGenerate, handlebarsContext);

      // Mark generation complete
      await this.completeGeneration(generation);

      return generation;
    } catch (error) {
      await this.failGeneration(generation, error);
      throw error;
    }
  }

  private async generateFile(
    generation: CodeGeneration,
    config: GeneratorConfig,
    templateFiles: Map<string, string>,
    context: any,
    ctx: GenerationContext
  ): Promise<void> {
    const destinationPath = Handlebars.compile(config.destination)(context);

    // Load template
    const templateContent = templateFiles.get(config.source);
    if (!templateContent) {
      throw new Error(`Template file not found: ${config.source}`);
    }

    // Render template
    const generated = Handlebars.compile(templateContent)(context);

    // Check if file exists
    const existing = await this.readFile(ctx.project.id, destinationPath);

    if (!existing) {
      // New file - just write it
      await this.writeFile(ctx.project.id, destinationPath, generated);

      await this.recordGeneratedFile(generation, {
        path: destinationPath,
        operation: FileOperation.CREATED,
        checksum: this.checksum(generated),
        size: generated.length,
      });

      return;
    }

    // File exists - handle based on overwrite policy
    switch (config.overwrite) {
      case 'always':
        await this.writeFile(ctx.project.id, destinationPath, generated);
        await this.recordGeneratedFile(generation, {
          path: destinationPath,
          operation: FileOperation.UPDATED,
          checksum: this.checksum(generated),
          size: generated.length,
        });
        break;

      case 'never':
        await this.recordGeneratedFile(generation, {
          path: destinationPath,
          operation: FileOperation.SKIPPED,
          checksum: this.checksum(existing),
          size: existing.length,
        });
        break;

      case 'if-unchanged':
        const previousChecksum = await this.getPreviousChecksum(
          ctx.previousGeneration,
          destinationPath
        );
        const currentChecksum = this.checksum(existing);

        if (previousChecksum === currentChecksum) {
          // File unchanged since last generation - safe to overwrite
          await this.writeFile(ctx.project.id, destinationPath, generated);
          await this.recordGeneratedFile(generation, {
            path: destinationPath,
            operation: FileOperation.UPDATED,
            checksum: this.checksum(generated),
            size: generated.length,
          });
        } else {
          // File was modified - handle conflict
          await this.handleConflict(generation, {
            path: destinationPath,
            generated,
            existing,
            config,
          });
        }
        break;

      case 'prompt':
        // In batch mode, record as conflict for manual resolution
        await this.handleConflict(generation, {
          path: destinationPath,
          generated,
          existing,
          config,
        });
        break;
    }
  }

  private async handleConflict(
    generation: CodeGeneration,
    conflict: {
      path: string;
      generated: string;
      existing: string;
      config: GeneratorConfig;
    }
  ): Promise<void> {
    if (conflict.config.protected) {
      // Use protected regions for smart merge
      const merged = await this.mergeProtectedRegions(
        conflict.existing,
        conflict.generated
      );

      if (merged.success) {
        await this.writeFile(generation.projectId, conflict.path, merged.content);
        await this.recordGeneratedFile(generation, {
          path: conflict.path,
          operation: FileOperation.UPDATED,
          checksum: this.checksum(merged.content),
          size: merged.content.length,
          hasProtectedRegions: true,
        });
        return;
      }
    }

    // Record conflict for manual resolution
    await db.generationConflict.create({
      data: {
        generationId: generation.id,
        path: conflict.path,
        conflictType: ConflictType.MODIFIED_FILE,
        generatedContent: conflict.generated,
        existingContent: conflict.existing,
      },
    });

    await this.recordGeneratedFile(generation, {
      path: conflict.path,
      operation: FileOperation.CONFLICTED,
      checksum: this.checksum(conflict.existing),
      size: conflict.existing.length,
    });
  }

  private async mergeProtectedRegions(
    existing: string,
    generated: string
  ): Promise<{ success: boolean; content?: string; error?: string }> {
    try {
      // Extract protected regions from existing file
      const protectedRegions = this.extractProtectedRegions(existing);

      // Replace protected regions in generated content
      let merged = generated;
      for (const [name, content] of Object.entries(protectedRegions)) {
        const regex = new RegExp(
          `// PROTECTED_REGION_BEGIN: ${name}[\\s\\S]*?// PROTECTED_REGION_END: ${name}`,
          'g'
        );

        const replacement = `// PROTECTED_REGION_BEGIN: ${name}\n${content}\n// PROTECTED_REGION_END: ${name}`;
        merged = merged.replace(regex, replacement);
      }

      return { success: true, content: merged };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  private extractProtectedRegions(content: string): Record<string, string> {
    const regions: Record<string, string> = {};
    const regex = /\/\/ PROTECTED_REGION_BEGIN: (\w+)([\s\S]*?)\/\/ PROTECTED_REGION_END: \1/g;

    let match;
    while ((match = regex.exec(content)) !== null) {
      const [, name, regionContent] = match;
      regions[name] = regionContent.trim();
    }

    return regions;
  }

  private checksum(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }
}
```

### Template Update Orchestration

```typescript
// apps/core/src/lib/services/template-updates/

interface TemplateUpdate {
  fromVersion: string;
  toVersion: string;
  changeType: 'MAJOR' | 'MINOR' | 'PATCH';
  breaking: boolean;
  securityFix: boolean;

  changelog: string;
  affectedProjects: number;

  migrationGuide?: string;
  automatedMigration?: boolean;
}

class TemplateUpdateOrchestrator {
  async publishTemplateVersion(
    templateId: string,
    version: string
  ): Promise<void> {
    const template = await db.projectTemplate.findUnique({
      where: { id: templateId, version },
    });

    if (!template) {
      throw new Error('Template version not found');
    }

    // Find all projects using this template
    const affectedProjects = await db.transformationProject.findMany({
      where: {
        templateId,
        status: {
          in: [ProjectStatus.ACTIVE, ProjectStatus.MAINTENANCE],
        },
      },
    });

    // Analyze impact
    const update = await this.analyzeUpdate(template, affectedProjects);

    // Create rollout plan
    const rollout = await this.createRolloutPlan(update, affectedProjects);

    // Execute rollout
    await this.executeRollout(rollout);
  }

  private async analyzeUpdate(
    newTemplate: ProjectTemplate,
    projects: TransformationProject[]
  ): Promise<TemplateUpdate> {
    const changeType = this.getChangeType(newTemplate.version);
    const breaking = await this.detectBreakingChanges(newTemplate);
    const securityFix = await this.isSecurityFix(newTemplate);

    return {
      fromVersion: projects[0]?.templateVersion || '0.0.0',
      toVersion: newTemplate.version,
      changeType,
      breaking,
      securityFix,
      changelog: await this.generateChangelog(newTemplate),
      affectedProjects: projects.length,
      automatedMigration: !breaking,
    };
  }

  private async createRolloutPlan(
    update: TemplateUpdate,
    projects: TransformationProject[]
  ): Promise<RolloutPlan> {
    // Categorize projects by update policy
    const autoUpdate: TransformationProject[] = [];
    const manualUpdate: TransformationProject[] = [];

    for (const project of projects) {
      if (this.shouldAutoUpdate(project, update)) {
        autoUpdate.push(project);
      } else {
        manualUpdate.push(project);
      }
    }

    // Create phased rollout for auto-updates
    const phases = this.createRolloutPhases(autoUpdate, update);

    return {
      update,
      autoUpdateProjects: autoUpdate,
      manualUpdateProjects: manualUpdate,
      phases,
      estimatedDuration: this.estimateDuration(phases),
    };
  }

  private shouldAutoUpdate(
    project: TransformationProject,
    update: TemplateUpdate
  ): boolean {
    // Never auto-update if breaking changes
    if (update.breaking) {
      return false;
    }

    switch (project.updatePolicy) {
      case UpdatePolicy.MANUAL:
        return false;

      case UpdatePolicy.SECURITY_ONLY:
        return update.securityFix;

      case UpdatePolicy.PATCH:
        return update.changeType === 'PATCH';

      case UpdatePolicy.MINOR:
        return update.changeType === 'PATCH' || update.changeType === 'MINOR';

      case UpdatePolicy.MAJOR:
        return true;

      default:
        return false;
    }
  }

  private createRolloutPhases(
    projects: TransformationProject[],
    update: TemplateUpdate
  ): RolloutPhase[] {
    const phases: RolloutPhase[] = [];

    if (update.securityFix) {
      // Security fixes: aggressive rollout
      phases.push({
        name: 'Emergency Security Patch',
        projects: projects,
        canaryPercentage: 0,
        delayBetweenBatches: 0,
        maxConcurrent: 50,
      });
    } else if (update.changeType === 'PATCH') {
      // Patch updates: moderate rollout
      phases.push(
        {
          name: 'Canary',
          projects: projects.slice(0, Math.ceil(projects.length * 0.05)),
          canaryPercentage: 5,
          delayBetweenBatches: 1000 * 60 * 60, // 1 hour
          maxConcurrent: 5,
        },
        {
          name: 'Gradual Rollout',
          projects: projects.slice(Math.ceil(projects.length * 0.05)),
          canaryPercentage: 0,
          delayBetweenBatches: 1000 * 60 * 30, // 30 minutes
          maxConcurrent: 20,
        }
      );
    } else {
      // Minor/Major updates: conservative rollout
      phases.push(
        {
          name: 'Canary',
          projects: projects.slice(0, Math.ceil(projects.length * 0.01)),
          canaryPercentage: 1,
          delayBetweenBatches: 1000 * 60 * 60 * 24, // 24 hours
          maxConcurrent: 2,
        },
        {
          name: 'Early Adopters',
          projects: projects.slice(
            Math.ceil(projects.length * 0.01),
            Math.ceil(projects.length * 0.10)
          ),
          canaryPercentage: 10,
          delayBetweenBatches: 1000 * 60 * 60 * 12, // 12 hours
          maxConcurrent: 5,
        },
        {
          name: 'General Availability',
          projects: projects.slice(Math.ceil(projects.length * 0.10)),
          canaryPercentage: 0,
          delayBetweenBatches: 1000 * 60 * 60 * 2, // 2 hours
          maxConcurrent: 20,
        }
      );
    }

    return phases;
  }

  private async executeRollout(plan: RolloutPlan): Promise<void> {
    // Notify about manual updates
    for (const project of plan.manualUpdateProjects) {
      await this.notifyProjectOwner(project, plan.update);
    }

    // Execute phased auto-updates
    for (const phase of plan.phases) {
      await this.executePhase(phase, plan.update);
    }
  }

  private async executePhase(
    phase: RolloutPhase,
    update: TemplateUpdate
  ): Promise<void> {
    const batches = this.createBatches(phase.projects, phase.maxConcurrent);

    for (const batch of batches) {
      // Update batch concurrently
      const results = await Promise.allSettled(
        batch.map((project) => this.updateProject(project, update))
      );

      // Check for failures
      const failures = results.filter((r) => r.status === 'rejected');

      if (failures.length > 0) {
        // Pause rollout if failure rate exceeds threshold
        const failureRate = failures.length / batch.length;
        if (failureRate > 0.2) {
          // >20% failure rate
          await this.pauseRollout(phase, update, failures);
          throw new Error(`Rollout paused due to high failure rate: ${failureRate}`);
        }
      }

      // Wait before next batch
      if (phase.delayBetweenBatches > 0) {
        await sleep(phase.delayBetweenBatches);
      }
    }
  }

  private async updateProject(
    project: TransformationProject,
    update: TemplateUpdate
  ): Promise<void> {
    const generationEngine = new CodeGenerationEngine();

    // Get new template
    const newTemplate = await db.projectTemplate.findUnique({
      where: {
        slug: project.template.slug,
        version: update.toVersion,
      },
    });

    if (!newTemplate) {
      throw new Error('Template version not found');
    }

    // Get previous generation
    const previousGeneration = await db.codeGeneration.findFirst({
      where: { projectId: project.id },
      orderBy: { startedAt: 'desc' },
    });

    // Run update
    const generation = await generationEngine.generate({
      project,
      template: newTemplate,
      config: project.config,
      previousGeneration,
    });

    // Update project template version
    await db.transformationProject.update({
      where: { id: project.id },
      data: {
        templateVersion: update.toVersion,
      },
    });

    // Check for conflicts
    const conflicts = await db.generationConflict.findMany({
      where: {
        generationId: generation.id,
        resolution: null,
      },
    });

    if (conflicts.length > 0) {
      // Notify project owner about conflicts
      await this.notifyConflicts(project, generation, conflicts);
    }
  }

  private async notifyProjectOwner(
    project: TransformationProject,
    update: TemplateUpdate
  ): Promise<void> {
    await sendNotification({
      to: project.ownerId,
      type: 'TEMPLATE_UPDATE_AVAILABLE',
      data: {
        projectId: project.id,
        projectName: project.name,
        currentVersion: project.templateVersion,
        newVersion: update.toVersion,
        breaking: update.breaking,
        securityFix: update.securityFix,
        changelog: update.changelog,
      },
    });
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }
}

interface RolloutPlan {
  update: TemplateUpdate;
  autoUpdateProjects: TransformationProject[];
  manualUpdateProjects: TransformationProject[];
  phases: RolloutPhase[];
  estimatedDuration: number;
}

interface RolloutPhase {
  name: string;
  projects: TransformationProject[];
  canaryPercentage: number;
  delayBetweenBatches: number;
  maxConcurrent: number;
}
```

### Template Testing

```typescript
// apps/core/src/lib/services/template-testing/

class TemplateTestRunner {
  async testTemplate(template: ProjectTemplate): Promise<TemplateTest> {
    const test = await db.templateTest.create({
      data: {
        templateId: template.id,
        name: `Test ${template.name}@${template.version}`,
        config: template.defaultConfig,
        status: TestStatus.RUNNING,
        triggeredBy: 'system',
      },
    });

    try {
      // Create temporary test project
      const testProject = await this.createTestProject(template);

      // Run generation
      const generation = await new CodeGenerationEngine().generate({
        project: testProject,
        template,
        config: template.defaultConfig,
      });

      // Validate generated code
      const checks = await this.runValidationChecks(testProject, generation);

      // Update test results
      const passed = checks.filter((c) => c.passed).length;
      const failed = checks.filter((c) => !c.passed && c.severity === 'ERROR').length;
      const warnings = checks.filter((c) => !c.passed && c.severity === 'WARNING').length;

      await db.templateTest.update({
        where: { id: test.id },
        data: {
          status: failed > 0 ? TestStatus.FAILED : TestStatus.PASSED,
          passedChecks: passed,
          failedChecks: failed,
          warnings,
          output: { checks },
          completedAt: new Date(),
          duration: Date.now() - test.startedAt.getTime(),
        },
      });

      // Cleanup test project
      await this.cleanupTestProject(testProject);

      return test;
    } catch (error) {
      await db.templateTest.update({
        where: { id: test.id },
        data: {
          status: TestStatus.FAILED,
          error: error.message,
          completedAt: new Date(),
        },
      });

      throw error;
    }
  }

  private async runValidationChecks(
    project: TransformationProject,
    generation: CodeGeneration
  ): Promise<ValidationCheck[]> {
    const checks: ValidationCheck[] = [];

    // Check: All files generated successfully
    checks.push({
      name: 'Generation Success',
      passed: generation.status === GenerationStatus.COMPLETED,
      severity: 'ERROR',
      message: `Generation status: ${generation.status}`,
    });

    // Check: No conflicts
    const conflicts = await db.generationConflict.count({
      where: { generationId: generation.id },
    });

    checks.push({
      name: 'No Conflicts',
      passed: conflicts === 0,
      severity: 'ERROR',
      message: `Found ${conflicts} conflicts`,
    });

    // Check: TypeScript compilation
    const tsCheck = await this.runTypeScriptCheck(project);
    checks.push({
      name: 'TypeScript Compilation',
      passed: tsCheck.success,
      severity: 'ERROR',
      message: tsCheck.errors ? tsCheck.errors.join('\n') : 'OK',
    });

    // Check: Linting
    const lintCheck = await this.runLinter(project);
    checks.push({
      name: 'ESLint',
      passed: lintCheck.errorCount === 0,
      severity: 'WARNING',
      message: `${lintCheck.errorCount} errors, ${lintCheck.warningCount} warnings`,
    });

    // Check: Security scan
    const securityCheck = await this.runSecurityScan(project);
    checks.push({
      name: 'Security Scan',
      passed: securityCheck.criticalCount === 0,
      severity: 'ERROR',
      message: `${securityCheck.criticalCount} critical issues`,
    });

    // Check: No circular dependencies
    const circularCheck = await this.checkCircularDependencies(project);
    checks.push({
      name: 'No Circular Dependencies',
      passed: circularCheck.cycles.length === 0,
      severity: 'ERROR',
      message: circularCheck.cycles.length > 0
        ? `Found ${circularCheck.cycles.length} circular dependencies`
        : 'OK',
    });

    // Check: All required files present
    const requiredFiles = await this.checkRequiredFiles(project, generation);
    checks.push({
      name: 'Required Files Present',
      passed: requiredFiles.missing.length === 0,
      severity: 'ERROR',
      message: requiredFiles.missing.length > 0
        ? `Missing files: ${requiredFiles.missing.join(', ')}`
        : 'OK',
    });

    return checks;
  }
}

interface ValidationCheck {
  name: string;
  passed: boolean;
  severity: 'ERROR' | 'WARNING';
  message: string;
}
```

## Consequences

### Positive

1. **Consistency:** All projects generated from same template are consistent
2. **Traceability:** Complete history of what was generated and when
3. **Safe Updates:** Protected regions preserve manual changes
4. **Controlled Rollout:** Phased updates reduce risk across portfolio
5. **Automated Testing:** Templates validated before deployment
6. **Version Control:** Clear template versioning with semantic versions
7. **Flexibility:** Projects can opt into different update policies
8. **Conflict Management:** Clear process for resolving generation conflicts

### Negative

1. **Complexity:** Protected regions add learning curve
2. **Storage Overhead:** Tracking all generations increases database size
3. **Performance:** Generating code for hundreds of projects takes time
4. **Template Lock-in:** Projects tied to specific template lineage
5. **Merge Complexity:** Protected region merging can fail
6. **Testing Overhead:** Each template version needs comprehensive testing

### Mitigations

1. **Documentation:** Comprehensive guides on protected regions and templating
2. **Cleanup Jobs:** Archive old generation records after retention period
3. **Parallel Execution:** Distribute generation across worker pool
4. **Migration Tools:** Provide tools to switch between templates
5. **Fallback to Manual:** Allow manual conflict resolution
6. **Automated Testing:** CI/CD pipeline for template testing

## Alternatives Considered

### Alternative 1: No Code Generation

**Description:** Manually create each project from scratch

**Rejected Because:**
- Doesn't scale to hundreds of projects
- Inconsistency across projects
- No way to propagate improvements
- High manual effort

### Alternative 2: Simple File Copying

**Description:** Just copy template files without tracking or merging

**Rejected Because:**
- No traceability
- Cannot handle updates
- Overwrites manual changes
- No conflict resolution

### Alternative 3: Git Submodules/Subtrees

**Description:** Use Git features to include template code

**Rejected Because:**
- Updates affect all projects simultaneously
- No per-project customization
- Difficult conflict resolution
- Not suitable for generated code

### Alternative 4: Microservice for Each Project

**Description:** Each project is completely independent codebase

**Rejected Because:**
- No code reuse
- Cannot share improvements
- Maintenance nightmare at scale
- Inconsistent implementations

## Implementation Plan

### Phase 1: Core Generation (Weeks 1-4)
- Implement template schema and storage
- Build code generation engine
- Add protected regions support
- Create conflict detection

### Phase 2: Template Management (Weeks 5-7)
- Template versioning system
- Template testing framework
- Template composition (inheritance)
- Template marketplace/registry

### Phase 3: Update Orchestration (Weeks 8-11)
- Impact analysis
- Rollout planning
- Phased execution
- Rollback capability

### Phase 4: UI & Developer Experience (Weeks 12-14)
- Template editor
- Conflict resolution UI
- Generation history dashboard
- Update preview/diff viewer

## Testing Strategy

### Unit Tests
- Protected region extraction/merging
- Template rendering
- Conflict detection
- Checksum calculation

### Integration Tests
- End-to-end generation
- Template updates across projects
- Rollback scenarios
- Conflict resolution workflows

### Load Tests
- Generate 100 projects concurrently
- Update 500 projects in single rollout
- Template test performance

### Chaos Tests
- Failed generations mid-process
- Network failures during template download
- Concurrent generation conflicts

## Metrics & Monitoring

### Key Metrics
- **Generation Success Rate:** Target >99%
- **Average Generation Time:** Target <2 minutes
- **Conflict Rate:** Target <5%
- **Auto-Update Adoption:** Track % of projects auto-updating
- **Template Test Pass Rate:** Target >95%
- **Rollout Failure Rate:** Target <2%

### Alerts
- Generation failures
- High conflict rates
- Template test failures
- Rollout paused events

## References

- [Yeoman Generator Framework](https://yeoman.io/)
- [Rails Application Templates](https://guides.rubyonrails.org/rails_application_templates.html)
- [Cookiecutter Project Templates](https://cookiecutter.readthedocs.io/)
- [Semantic Versioning](https://semver.org/)

## Review Date

2026-04-20 (3 months)

## Appendix: CLI Tools

```bash
# Create new template
forge template create \
  --name "enterprise-app" \
  --version "2.0.0" \
  --from "./template-source" \
  --test

# Generate project from template
forge project generate \
  --template "enterprise-app@2.0.0" \
  --config "config.json" \
  --output "./my-project"

# Update project to new template version
forge project update \
  --project "my-project" \
  --template-version "2.1.0" \
  --preview

# Resolve conflicts
forge project resolve-conflicts \
  --project "my-project" \
  --generation "gen_abc123"

# Test template
forge template test \
  --template "enterprise-app@2.0.0" \
  --verbose

# Publish template
forge template publish \
  --template "enterprise-app@2.0.0" \
  --changelog "CHANGELOG.md"

# Rollout template update
forge template rollout \
  --template "enterprise-app" \
  --version "2.1.0" \
  --strategy "gradual" \
  --canary-percentage 5

# View generation history
forge project generations \
  --project "my-project" \
  --limit 10
```
