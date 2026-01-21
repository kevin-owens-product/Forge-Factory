# ADR-047: Refactoring Engine Architecture

**Status:** Accepted
**Date:** 2026-01-21
**Priority:** P0 - Critical for Launch
**Complexity:** High
**Dependencies:** ADR-038 (Multi-Language Code Analysis), ADR-040 (Safety & Rollback), ADR-041 (LLM Provider Strategy)

---

## Context

Forge Factory's core value proposition is **automated code refactoring** to improve AI-readiness scores. The refactoring engine must support **6+ refactoring types** across **10+ programming languages** while maintaining **100% behavior preservation** and **human-in-the-loop control**.

### Business Requirements

**Refactoring Types (Priority Order):**
1. **File Split** (P0): Break large files (>500 LOC) into smaller modules
2. **Extract Function** (P0): Extract complex functions (complexity >10) into smaller pieces
3. **Reduce Complexity** (P0): Simplify control flow, reduce nesting
4. **Add Type Annotations** (P1): Add TypeScript types, Python type hints
5. **Generate Tests** (P1): Create unit tests for uncovered functions
6. **Add Documentation** (P1): Generate JSDoc, docstrings
7. **Remove Dead Code** (P2): Eliminate unused imports, variables, functions
8. **Modernize Patterns** (P2): Update deprecated APIs, legacy patterns

**Quality Requirements:**
- **100% behavior preservation** (no logic changes)
- **Test coverage maintained** (all tests pass before/after)
- **Incremental transformations** (small batches, not all-at-once)
- **Human approval for critical code** (auth, payments, security)
- **Rollback in <5 minutes** (if issues detected)
- **Auditability** (complete trail of changes)

### Technical Challenges

1. **Multi-language support:** Each language has different syntax, semantics, tooling
2. **Behavior preservation:** Hard to guarantee refactoring doesn't change behavior
3. **Context understanding:** AI needs to understand business logic, not just syntax
4. **Dependency tracking:** Changes cascade through import graphs
5. **Test maintenance:** Refactoring may require updating test imports/mocks
6. **Incremental safety:** Apply changes gradually with validation at each step

### Real-World Refactoring Example

**Before: Large file with high complexity (auth.ts, 850 LOC)**
```typescript
// auth.ts (850 lines)
export async function handleLogin(req, res) {
  // 120 lines: input validation
  if (!req.body.email) { ... }
  if (!validateEmail(req.body.email)) { ... }
  // ... 20 more validation checks

  // 80 lines: database lookup
  const user = await db.users.findOne({ email: req.body.email });
  if (!user) { ... }
  // ... complex user lookup logic

  // 100 lines: password verification
  const passwordHash = crypto.createHash('sha256')...
  // ... complex password logic

  // 60 lines: session creation
  const session = await createSession(user);
  // ... session logic

  // 40 lines: audit logging
  await auditLog.log({ event: 'login', userId: user.id });
  // ... logging logic

  // 50 lines: response formatting
  res.json({ token: session.token, user: formatUser(user) });
}
```

**After: Split into focused modules**
```typescript
// auth/login-handler.ts (100 lines)
export async function handleLogin(req: Request, res: Response) {
  const input = await validateLoginInput(req.body);
  const user = await findUserByEmail(input.email);
  await verifyPassword(user, input.password);
  const session = await createUserSession(user);
  await logLoginEvent(user);

  res.json(formatLoginResponse(session, user));
}

// auth/validators/login-input-validator.ts (80 lines)
export async function validateLoginInput(body: unknown): Promise<LoginInput> { ... }

// auth/services/user-lookup-service.ts (100 lines)
export async function findUserByEmail(email: string): Promise<User> { ... }

// auth/services/password-service.ts (120 lines)
export async function verifyPassword(user: User, password: string): Promise<void> { ... }

// auth/services/session-service.ts (90 lines)
export async function createUserSession(user: User): Promise<Session> { ... }

// auth/audit/login-logger.ts (60 lines)
export async function logLoginEvent(user: User): Promise<void> { ... }

// auth/formatters/login-response-formatter.ts (50 lines)
export function formatLoginResponse(session: Session, user: User): LoginResponse { ... }
```

**Result:**
- File split: 1 file (850 LOC) → 7 files (avg 86 LOC each)
- Function complexity: Reduced from 45 → 8
- Test coverage: Easier to test (unit tests for each module)
- AI-readiness: Score increased from 35 → 78

---

## Decision

We will implement a **plugin-based refactoring engine** with:

1. **Abstract refactoring interface** (common API for all refactoring types)
2. **Language-specific refactorings** (TypeScript, Python, Java, etc.)
3. **Safety-first architecture** (validate at every step)
4. **Incremental execution** (apply changes in small batches)
5. **Human-in-the-loop approval** (for critical changes)
6. **Rollback support** (instant revert if issues detected)

### Architecture Overview

```typescript
interface RefactoringEngine {
  // Discovery
  discoverRefactorings(files: SourceFile[]): Promise<RefactoringOpportunity[]>;
  prioritizeRefactorings(opportunities: RefactoringOpportunity[]): RefactoringPlan;

  // Execution
  executeRefactoring(refactoring: Refactoring): Promise<RefactoringResult>;
  validateRefactoring(result: RefactoringResult): Promise<ValidationResult>;

  // Safety
  createCheckpoint(): Promise<Checkpoint>;
  rollbackToCheckpoint(checkpoint: Checkpoint): Promise<void>;
  requiresHumanApproval(refactoring: Refactoring): boolean;
}

interface Refactoring {
  id: string;
  type: RefactoringType;
  description: string;
  affectedFiles: SourceFile[];
  estimatedImpact: Impact;
  riskScore: number;

  // Execution
  plan(): Promise<RefactoringPlan>;
  execute(): Promise<RefactoringResult>;
  validate(): Promise<ValidationResult>;
  rollback(): Promise<void>;
}
```

### Core Component 1: Refactoring Discovery

```typescript
class RefactoringDiscovery {
  async discoverRefactorings(
    repository: Repository,
    analysis: RepositoryAnalysis
  ): Promise<RefactoringOpportunity[]> {
    const opportunities: RefactoringOpportunity[] = [];

    // Discover File Split opportunities
    const fileSplitOps = await this.discoverFileSplits(analysis);
    opportunities.push(...fileSplitOps);

    // Discover Extract Function opportunities
    const extractFunctionOps = await this.discoverExtractFunctions(analysis);
    opportunities.push(...extractFunctionOps);

    // Discover Complexity Reduction opportunities
    const complexityOps = await this.discoverComplexityReductions(analysis);
    opportunities.push(...complexityOps);

    // Discover Type Annotation opportunities
    const typeOps = await this.discoverTypeAnnotations(analysis);
    opportunities.push(...typeOps);

    // Prioritize by impact and effort
    return this.prioritize(opportunities);
  }

  private async discoverFileSplits(
    analysis: RepositoryAnalysis
  ): Promise<RefactoringOpportunity[]> {
    const opportunities: RefactoringOpportunity[] = [];

    // Find files >500 LOC
    const largeFiles = analysis.files.filter(f => f.linesOfCode > 500);

    for (const file of largeFiles) {
      // Analyze file structure to determine how to split
      const splitPlan = await this.analyzeSplitStrategy(file);

      if (splitPlan.feasible) {
        opportunities.push({
          type: RefactoringType.FILE_SPLIT,
          priority: this.calculatePriority(file.linesOfCode, 500),
          impact: {
            aiReadinessImprovement: splitPlan.estimatedScoreIncrease,
            filesCreated: splitPlan.targetFiles.length,
            linesReduced: file.linesOfCode - splitPlan.largestTargetFile,
          },
          effort: {
            estimatedHours: splitPlan.targetFiles.length * 0.5, // 30 min per file
            automationAvailable: true,
          },
          file,
          plan: splitPlan,
        });
      }
    }

    return opportunities;
  }

  private async analyzeSplitStrategy(file: SourceFile): Promise<FileSplitPlan> {
    // Parse file to extract structure
    const ast = await this.parseFile(file);

    // Analyze natural boundaries (classes, function groups, modules)
    const boundaries = this.findNaturalBoundaries(ast);

    // Group related functions/classes
    const groups = this.clusterByRelationship(ast, boundaries);

    // Propose file split strategy
    const targetFiles = groups.map(group => ({
      name: this.suggestFileName(group),
      path: this.suggestFilePath(file, group),
      content: group.members,
      linesOfCode: this.estimateLines(group),
    }));

    return {
      feasible: targetFiles.every(f => f.linesOfCode < 400),
      strategy: 'group-by-responsibility',
      targetFiles,
      estimatedScoreIncrease: this.estimateScoreIncrease(file, targetFiles),
      largestTargetFile: Math.max(...targetFiles.map(f => f.linesOfCode)),
    };
  }

  private findNaturalBoundaries(ast: AST): Boundary[] {
    const boundaries: Boundary[] = [];

    // 1. Class boundaries (each class → separate file in OOP languages)
    const classes = this.findAllClasses(ast);
    classes.forEach(cls => {
      boundaries.push({
        type: 'class',
        name: cls.name,
        members: cls.methods,
        dependencies: this.extractDependencies(cls),
      });
    });

    // 2. Function groups (related functions → separate file)
    const functions = this.findAllFunctions(ast);
    const functionGroups = this.clusterFunctionsByNaming(functions);
    functionGroups.forEach(group => {
      boundaries.push({
        type: 'function-group',
        name: group.name,
        members: group.functions,
        dependencies: this.extractDependencies(group),
      });
    });

    // 3. Export boundaries (public API vs. internal helpers)
    const exports = this.findAllExports(ast);
    const internals = this.findAllInternals(ast);

    if (exports.length > 0 && internals.length > 0) {
      boundaries.push(
        { type: 'public-api', members: exports },
        { type: 'internal', members: internals }
      );
    }

    return boundaries;
  }

  private clusterFunctionsByNaming(functions: Function[]): FunctionGroup[] {
    // Use LLM to understand semantic relationships
    const groups: FunctionGroup[] = [];

    // Simple heuristic: group by prefix (e.g., "validate*", "format*", "calculate*")
    const prefixGroups = new Map<string, Function[]>();

    for (const fn of functions) {
      const prefix = this.extractPrefix(fn.name); // "validateEmail" → "validate"

      if (!prefixGroups.has(prefix)) {
        prefixGroups.set(prefix, []);
      }
      prefixGroups.get(prefix).push(fn);
    }

    // Convert to groups
    for (const [prefix, fns] of prefixGroups.entries()) {
      if (fns.length >= 2) {
        groups.push({
          name: `${prefix}-functions`,
          functions: fns,
          reason: `Functions with common prefix "${prefix}"`,
        });
      }
    }

    return groups;
  }
}
```

### Core Component 2: Plugin Architecture

```typescript
abstract class RefactoringPlugin {
  abstract type: RefactoringType;
  abstract supportedLanguages: Language[];

  // Discovery
  abstract discoverOpportunities(
    file: SourceFile,
    analysis: FileAnalysis
  ): Promise<RefactoringOpportunity[]>;

  // Planning
  abstract createPlan(opportunity: RefactoringOpportunity): Promise<RefactoringPlan>;

  // Execution
  abstract execute(plan: RefactoringPlan): Promise<RefactoringResult>;

  // Validation
  abstract validate(result: RefactoringResult): Promise<ValidationResult>;

  // Common utilities
  protected async requiresHumanApproval(plan: RefactoringPlan): Promise<boolean> {
    // Check if plan affects security-critical code
    const securityCritical = this.isSecurityCritical(plan.affectedFiles);
    if (securityCritical) return true;

    // Check risk score
    const riskScore = await this.calculateRiskScore(plan);
    return riskScore > 70;
  }

  protected async calculateRiskScore(plan: RefactoringPlan): Promise<number> {
    let score = 0;

    // Factor 1: Number of files affected
    score += Math.min(plan.affectedFiles.length * 10, 30);

    // Factor 2: Lines of code changed
    score += Math.min(plan.estimatedLinesChanged / 50, 30);

    // Factor 3: Test coverage
    const avgCoverage = this.getAverageCoverage(plan.affectedFiles);
    if (avgCoverage < 50) score += 30;
    else if (avgCoverage < 80) score += 15;

    // Factor 4: Security-critical
    if (this.isSecurityCritical(plan.affectedFiles)) score += 40;

    return Math.min(score, 100);
  }
}
```

**Plugin Example: File Split Refactoring**

```typescript
class FileSplitRefactoring extends RefactoringPlugin {
  type = RefactoringType.FILE_SPLIT;
  supportedLanguages = ['typescript', 'javascript', 'python', 'java'];

  async createPlan(opportunity: RefactoringOpportunity): Promise<RefactoringPlan> {
    const { file, plan: splitPlan } = opportunity;

    // Generate detailed execution steps
    const steps: RefactoringStep[] = [];

    // Step 1: Create new files
    for (const targetFile of splitPlan.targetFiles) {
      steps.push({
        action: 'create-file',
        file: targetFile.path,
        content: this.generateFileContent(targetFile),
      });
    }

    // Step 2: Update imports in original file consumers
    const consumers = await this.findFileConsumers(file);
    for (const consumer of consumers) {
      steps.push({
        action: 'update-imports',
        file: consumer.path,
        changes: this.calculateImportChanges(consumer, splitPlan),
      });
    }

    // Step 3: Delete or minimize original file
    if (splitPlan.deleteOriginal) {
      steps.push({
        action: 'delete-file',
        file: file.path,
      });
    } else {
      steps.push({
        action: 'update-file',
        file: file.path,
        content: this.generateReExports(splitPlan),
      });
    }

    return {
      id: uuid(),
      type: this.type,
      description: `Split ${file.path} into ${splitPlan.targetFiles.length} focused modules`,
      affectedFiles: [file, ...consumers],
      newFiles: splitPlan.targetFiles,
      steps,
      estimatedDuration: steps.length * 30, // 30 seconds per step
      riskScore: await this.calculateRiskScore({ affectedFiles: [file, ...consumers], estimatedLinesChanged: file.linesOfCode }),
    };
  }

  async execute(plan: RefactoringPlan): Promise<RefactoringResult> {
    const results: StepResult[] = [];

    // Execute steps incrementally
    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i];

      console.log(`Executing step ${i + 1}/${plan.steps.length}: ${step.action}`);

      try {
        const stepResult = await this.executeStep(step);
        results.push(stepResult);

        // Validate after each step
        const validation = await this.validateStep(stepResult);
        if (!validation.passed) {
          // Rollback previous steps
          await this.rollbackSteps(results.slice(0, i));
          throw new Error(`Step ${i + 1} validation failed: ${validation.errors.join(', ')}`);
        }

      } catch (error) {
        // Rollback all previous steps
        await this.rollbackSteps(results);
        throw error;
      }
    }

    return {
      success: true,
      plan,
      steps: results,
      filesCreated: plan.newFiles.length,
      filesModified: plan.affectedFiles.length,
      filesDeleted: plan.steps.filter(s => s.action === 'delete-file').length,
    };
  }

  private async executeStep(step: RefactoringStep): Promise<StepResult> {
    switch (step.action) {
      case 'create-file':
        await fs.writeFile(step.file, step.content, 'utf8');
        return { action: step.action, file: step.file, success: true };

      case 'update-file':
        await fs.writeFile(step.file, step.content, 'utf8');
        return { action: step.action, file: step.file, success: true };

      case 'update-imports':
        const content = await fs.readFile(step.file, 'utf8');
        const updated = this.applyImportChanges(content, step.changes);
        await fs.writeFile(step.file, updated, 'utf8');
        return { action: step.action, file: step.file, success: true };

      case 'delete-file':
        await fs.unlink(step.file);
        return { action: step.action, file: step.file, success: true };

      default:
        throw new Error(`Unknown action: ${step.action}`);
    }
  }

  private generateFileContent(targetFile: TargetFile): string {
    // Use LLM to generate well-structured file

    const imports = this.generateImports(targetFile);
    const content = this.extractContent(targetFile.content);
    const exports = this.generateExports(targetFile);

    return `${imports}\n\n${content}\n\n${exports}`;
  }

  private async findFileConsumers(file: SourceFile): Promise<SourceFile[]> {
    // Find all files that import from this file
    const allFiles = await this.repository.getAllFiles();
    const consumers: SourceFile[] = [];

    for (const f of allFiles) {
      const imports = await this.extractImports(f);
      if (imports.some(imp => imp.from === file.path)) {
        consumers.push(f);
      }
    }

    return consumers;
  }
}
```

**Plugin Example: Extract Function Refactoring**

```typescript
class ExtractFunctionRefactoring extends RefactoringPlugin {
  type = RefactoringType.EXTRACT_FUNCTION;
  supportedLanguages = ['typescript', 'javascript', 'python', 'java', 'go'];

  async discoverOpportunities(
    file: SourceFile,
    analysis: FileAnalysis
  ): Promise<RefactoringOpportunity[]> {
    const opportunities: RefactoringOpportunity[] = [];

    // Find complex functions (complexity >10)
    const complexFunctions = analysis.functions.filter(f => f.cyclomaticComplexity > 10);

    for (const fn of complexFunctions) {
      // Identify extractable code blocks
      const extractableBlocks = await this.identifyExtractableBlocks(fn);

      for (const block of extractableBlocks) {
        opportunities.push({
          type: this.type,
          priority: fn.cyclomaticComplexity / 10, // Higher complexity = higher priority
          impact: {
            complexityReduction: block.estimatedComplexityReduction,
            aiReadinessImprovement: block.estimatedScoreIncrease,
          },
          effort: {
            estimatedHours: 0.25, // 15 minutes
            automationAvailable: true,
          },
          function: fn,
          block,
        });
      }
    }

    return opportunities;
  }

  private async identifyExtractableBlocks(fn: Function): Promise<ExtractableBlock[]> {
    const blocks: ExtractableBlock[] = [];

    // Strategy 1: Look for comment-separated sections
    const commentBlocks = this.findCommentSeparatedBlocks(fn);
    blocks.push(...commentBlocks);

    // Strategy 2: Look for variable scopes (block of code that uses same variables)
    const scopeBlocks = this.findScopeBasedBlocks(fn);
    blocks.push(...scopeBlocks);

    // Strategy 3: Use LLM to identify logical sections
    const semanticBlocks = await this.findSemanticBlocks(fn);
    blocks.push(...semanticBlocks);

    return blocks;
  }

  private async findSemanticBlocks(fn: Function): Promise<ExtractableBlock[]> {
    // Use LLM to understand code semantics and identify extractable blocks

    const prompt = `
Analyze this function and identify extractable code blocks:

\`\`\`${fn.language}
${fn.source}
\`\`\`

Identify 2-3 logical code blocks that can be extracted into separate functions.
For each block:
1. Describe its purpose (e.g., "input validation", "database query", "error handling")
2. Identify start and end line numbers
3. Suggest a function name
4. List parameters needed
5. Identify return value

Return JSON:
[
  {
    "purpose": "string",
    "startLine": number,
    "endLine": number,
    "suggestedName": "string",
    "parameters": ["param1: type", "param2: type"],
    "returnType": "string"
  }
]
    `;

    const response = await this.llm.complete({ prompt, maxTokens: 2000 });
    const blocks = JSON.parse(response.content);

    return blocks.map((block: any) => ({
      purpose: block.purpose,
      startLine: block.startLine,
      endLine: block.endLine,
      suggestedName: block.suggestedName,
      parameters: block.parameters,
      returnType: block.returnType,
      estimatedComplexityReduction: this.estimateComplexityReduction(fn, block),
      estimatedScoreIncrease: 5, // Rough estimate
    }));
  }

  async execute(plan: RefactoringPlan): Promise<RefactoringResult> {
    const { function: fn, block } = plan.metadata;

    // Step 1: Generate extracted function
    const extractedFunction = this.generateExtractedFunction(block, fn);

    // Step 2: Replace original code with function call
    const updatedFunction = this.replaceBlockWithCall(fn, block, extractedFunction);

    // Step 3: Insert extracted function into file
    const updatedFile = this.insertFunction(fn.file, extractedFunction, updatedFunction);

    // Step 4: Write changes
    await fs.writeFile(fn.file.path, updatedFile, 'utf8');

    // Step 5: Run tests to verify behavior preservation
    const testResult = await this.runTests(fn.file);
    if (!testResult.passed) {
      throw new Error(`Tests failed after extraction: ${testResult.failures.join(', ')}`);
    }

    return {
      success: true,
      plan,
      filesModified: 1,
      functionsExtracted: 1,
      complexityReduction: block.estimatedComplexityReduction,
    };
  }

  private generateExtractedFunction(block: ExtractableBlock, originalFn: Function): string {
    // Use LLM to generate well-named, well-documented function

    const prompt = `
Extract this code block into a separate function:

**Original function:**
\`\`\`${originalFn.language}
${originalFn.source}
\`\`\`

**Block to extract (lines ${block.startLine}-${block.endLine}):**
\`\`\`${originalFn.language}
${this.extractLines(originalFn.source, block.startLine, block.endLine)}
\`\`\`

**Suggested name:** ${block.suggestedName}
**Purpose:** ${block.purpose}

Generate:
1. Function signature with types
2. JSDoc/docstring explaining purpose
3. Function body (extracted code)

Return only the complete function.
    `;

    const response = await this.llm.complete({ prompt, maxTokens: 1500 });
    return response.content;
  }
}
```

### Core Component 3: Safety & Validation

```typescript
class RefactoringValidator {
  async validate(result: RefactoringResult): Promise<ValidationResult> {
    const checks = await Promise.all([
      this.validateSyntax(result),
      this.validateTypes(result),
      this.validateTests(result),
      this.validateBehavior(result),
      this.validateImports(result),
    ]);

    const passed = checks.every(c => c.passed);
    const errors = checks.flatMap(c => c.errors);
    const warnings = checks.flatMap(c => c.warnings);

    return {
      passed,
      checks,
      errors,
      warnings,
    };
  }

  private async validateSyntax(result: RefactoringResult): Promise<ValidationCheck> {
    // Parse all affected files to ensure valid syntax
    const errors: string[] = [];

    for (const file of result.affectedFiles) {
      try {
        const parser = this.getParser(file.language);
        const ast = parser.parse(file.content);

        if (ast.hasErrors()) {
          errors.push(`Syntax errors in ${file.path}: ${ast.errors.join(', ')}`);
        }
      } catch (error) {
        errors.push(`Failed to parse ${file.path}: ${error.message}`);
      }
    }

    return {
      name: 'Syntax Validation',
      passed: errors.length === 0,
      errors,
    };
  }

  private async validateTests(result: RefactoringResult): Promise<ValidationCheck> {
    // Run tests to ensure behavior preserved
    const testResult = await this.testRunner.runTests(result.affectedFiles);

    if (!testResult.passed) {
      return {
        name: 'Test Validation',
        passed: false,
        errors: testResult.failures.map(f => `Test failed: ${f.name} - ${f.message}`),
      };
    }

    return {
      name: 'Test Validation',
      passed: true,
      errors: [],
    };
  }

  private async validateBehavior(result: RefactoringResult): Promise<ValidationCheck> {
    // Compare ASTs before/after to ensure behavior equivalence
    const differences: string[] = [];

    for (const file of result.affectedFiles) {
      const beforeAST = result.metadata.beforeASTs[file.path];
      const afterAST = await this.parseFile(file);

      const behaviorCheck = await this.compareBehavior(beforeAST, afterAST);

      if (!behaviorCheck.equivalent) {
        differences.push(...behaviorCheck.differences);
      }
    }

    return {
      name: 'Behavior Validation',
      passed: differences.length === 0,
      errors: differences,
    };
  }
}
```

### Core Component 4: Human-in-the-Loop Workflow

```typescript
class RefactoringApprovalWorkflow {
  async executeWithApproval(
    refactoring: Refactoring,
    plan: RefactoringPlan
  ): Promise<RefactoringResult> {
    // Check if approval required
    if (!await this.requiresApproval(plan)) {
      // Execute immediately
      return await refactoring.execute();
    }

    // Create approval request
    const approval = await this.requestApproval(plan);

    // Wait for approval
    const approved = await this.waitForApproval(approval.id, {
      timeout: 24 * 60 * 60 * 1000, // 24 hours
    });

    if (!approved) {
      throw new Error('Refactoring rejected by reviewer');
    }

    // Execute with approval
    return await refactoring.execute();
  }

  private async requiresApproval(plan: RefactoringPlan): Promise<boolean> {
    // Require approval for high-risk refactorings
    const riskScore = plan.riskScore;

    if (riskScore >= 70) return true; // High risk

    // Require approval for security-critical files
    const touchesSecurity = plan.affectedFiles.some(f =>
      this.isSecurityCritical(f)
    );

    if (touchesSecurity) return true;

    // Require approval for large changes
    if (plan.affectedFiles.length > 10) return true;

    return false;
  }

  private async requestApproval(plan: RefactoringPlan): Promise<Approval> {
    // Generate preview of changes
    const preview = await this.generatePreview(plan);

    // Create approval record
    const approval = await this.db.approvals.create({
      data: {
        planId: plan.id,
        type: 'refactoring',
        status: 'PENDING',
        preview,
        requestedAt: new Date(),
      },
    });

    // Notify reviewers
    await this.notifyReviewers(approval);

    return approval;
  }

  private async generatePreview(plan: RefactoringPlan): Promise<RefactoringPreview> {
    // Generate diff for each affected file
    const diffs = await Promise.all(
      plan.affectedFiles.map(async file => {
        const before = file.content;
        const after = await this.applyPlan(plan, file);

        return {
          file: file.path,
          diff: this.generateDiff(before, after),
          linesAdded: this.countLinesAdded(before, after),
          linesRemoved: this.countLinesRemoved(before, after),
        };
      })
    );

    return {
      planId: plan.id,
      description: plan.description,
      type: plan.type,
      filesAffected: plan.affectedFiles.length,
      riskScore: plan.riskScore,
      diffs,
      estimatedDuration: plan.estimatedDuration,
    };
  }
}
```

---

## Consequences

### Positive

1. **Scalable:** Plugin architecture allows easy addition of new refactoring types
2. **Safe:** Multi-layer validation prevents breaking changes
3. **Transparent:** Human reviewers see exactly what will change
4. **Incremental:** Changes applied in small batches with rollback
5. **Language-agnostic:** Abstract interface works across 10+ languages

### Negative

1. **Complexity:** Managing 6+ refactoring plugins adds overhead
2. **LLM Dependency:** Semantic analysis requires expensive LLM calls
3. **Approval Bottleneck:** High-risk refactorings require human review
4. **Test Dependency:** Requires existing test suite to validate behavior

### Trade-offs

- **Safety vs. Speed:** Prioritize safety, accept slower refactoring
- **Automation vs. Control:** Fully automate low-risk, require approval for high-risk
- **Quality vs. Cost:** Use LLM for semantic understanding despite cost

---

## Implementation Plan

### Phase 1: Core Engine (Week 1-2)
- Implement abstract refactoring interface
- Build plugin registry
- Create validation framework
- Add checkpoint/rollback system

### Phase 2: File Split Plugin (Week 3-4)
- Implement discovery algorithm
- Build split strategy analyzer
- Add execution logic
- Test on 50 repositories

### Phase 3: Extract Function Plugin (Week 5-6)
- Implement complexity analysis
- Build block extraction logic
- Add LLM-based semantic analysis
- Test on complex functions

### Phase 4: Additional Plugins (Week 7-10)
- Reduce Complexity plugin
- Add Type Annotations plugin
- Generate Tests plugin
- Add Documentation plugin

### Phase 5: Human Approval Workflow (Week 11)
- Build approval dashboard UI
- Implement preview generation
- Add notification system

### Phase 6: Testing & Optimization (Week 12)
- End-to-end testing
- Performance optimization
- Cost optimization (caching)

---

## Alternatives Considered

### Alternative 1: Rule-Based Refactoring Only
**Pros:** Fast, deterministic, no LLM cost
**Cons:** Limited to simple pattern matching, misses semantic opportunities

### Alternative 2: LLM-Only Refactoring (No AST)
**Pros:** Simple, flexible
**Cons:** Unreliable, expensive, no behavior guarantees

### Alternative 3: Manual Refactoring Only
**Pros:** Maximum safety and quality
**Cons:** Slow, expensive, doesn't scale

---

## References

- [Martin Fowler: Refactoring](https://refactoring.com/)
- [TypeScript Compiler API](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API)
- [jscodeshift](https://github.com/facebook/jscodeshift)
- [Rope (Python Refactoring Library)](https://github.com/python-rope/rope)
- [RefactorGL (Multi-language)](https://refactoring.info/)
- [Behavior Preservation in Refactoring](https://dl.acm.org/doi/10.1145/1287624.1287651)

---

**Decision Maker:** CTO + Lead Architect
**Approved By:** Engineering Leadership
**Implementation Owner:** Platform Engineering Team
