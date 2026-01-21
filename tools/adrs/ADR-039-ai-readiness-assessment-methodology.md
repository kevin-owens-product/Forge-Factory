# ADR-039: AI-Readiness Assessment Methodology

**Status:** Accepted
**Date:** 2026-01-21
**Priority:** P0 - Critical for Launch
**Complexity:** High
**Dependencies:** ADR-038 (Multi-Language Code Analysis)

---

## Context

Forge Factory's **primary value proposition** is transforming codebases to be "AI-agent maintainable." The **AI-Readiness Score (0-100)** is our **North Star metric** that quantifies how well a codebase can be understood, maintained, and evolved by AI coding agents like Claude Code, GitHub Copilot, and Cursor.

### Problem Statement

AI coding assistants struggle with:
1. **Large files** (>500 LOC) that exceed context windows
2. **Complex functions** (high cyclomatic complexity) that are hard to reason about
3. **Missing documentation** that lacks "why" context
4. **Undocumented dependencies** between modules
5. **Missing tests** that prevent safe refactoring
6. **Unclear naming** that obscures intent
7. **Deep nesting** that complicates control flow
8. **Type ambiguity** in dynamically-typed languages

### Business Impact

- **Product metric:** AI-Readiness Score is displayed on dashboard as primary KPI
- **Sales enablement:** "Increase your AI-Readiness from 35 to 85 in 30 days"
- **Customer success:** Track improvement over time, correlate with developer velocity
- **Pricing:** Usage-based pricing tied to LOC transformed (driven by score improvements)

### Research Foundation

Studies show AI coding assistants are most effective when:
- **File size <300 LOC:** 2.5x better code suggestions (GitHub Copilot study)
- **Cyclomatic complexity <10:** 3x fewer errors (Microsoft Research)
- **Test coverage >80%:** 4x safer refactoring (Google Testing Blog)
- **Type annotations present:** 2x better autocomplete (TypeScript team)
- **Clear documentation:** 5x faster onboarding (Stack Overflow developer survey)

---

## Decision

We will implement a **multi-dimensional scoring methodology** that combines:

1. **Quantitative metrics** (70% of score) - Objective measurements
2. **Qualitative analysis** (20% of score) - LLM-based semantic assessment
3. **Practical indicators** (10% of score) - Real-world usability factors

### Scoring Model (0-100 Scale)

```typescript
interface AIReadinessScore {
  overall: number; // 0-100 composite score
  grade: 'A' | 'B' | 'C' | 'D' | 'F'; // Letter grade
  breakdown: ScoreBreakdown;
  trends: ScoreTrends; // Historical comparison
  recommendations: Recommendation[];
  estimatedEffort: EffortEstimate; // Hours to reach 80+
}

interface ScoreBreakdown {
  // Quantitative (70%)
  structuralQuality: number;        // 20% - File/function sizes
  complexityManagement: number;     // 15% - Cyclomatic complexity
  documentationCoverage: number;    // 15% - JSDoc, docstrings, README
  testCoverage: number;             // 10% - Unit/integration tests
  typeAnnotations: number;          // 10% - TypeScript, Python type hints

  // Qualitative (20%)
  namingClarity: number;            // 10% - LLM assessment of naming
  architecturalClarity: number;     // 10% - LLM assessment of structure

  // Practical (10%)
  toolingSupport: number;           // 5% - Linters, formatters configured
  githubReadiness: number;          // 5% - PR templates, CI/CD, branch protection
}
```

### Detailed Scoring Algorithm

#### 1. Structural Quality (20% of total)

**Measures:** File sizes, function sizes, modularity

```typescript
function calculateStructuralQuality(repo: RepositoryAnalysis): number {
  let score = 100;
  const penalties: Penalty[] = [];

  // File Size Analysis
  const largeFiles = repo.files.filter(f => f.linesOfCode > 500);
  const largeFilesRatio = largeFiles.length / repo.totalFiles;

  if (largeFilesRatio > 0.5) {
    // >50% files over 500 LOC
    penalties.push({ amount: 40, reason: 'Majority of files exceed AI context limits' });
  } else if (largeFilesRatio > 0.25) {
    penalties.push({ amount: 25, reason: 'Many files exceed optimal size for AI' });
  } else if (largeFilesRatio > 0.10) {
    penalties.push({ amount: 10, reason: 'Some files could be split for better AI comprehension' });
  }

  // Average File Size
  const avgFileSize = repo.totalLinesOfCode / repo.totalFiles;
  if (avgFileSize > 400) {
    penalties.push({ amount: 20, reason: `Average file size (${avgFileSize} LOC) is too large` });
  } else if (avgFileSize > 300) {
    penalties.push({ amount: 10, reason: `Average file size (${avgFileSize} LOC) could be smaller` });
  }

  // Function Size Analysis
  const largeFunctions = repo.functions.filter(f => f.linesOfCode > 50);
  const largeFunctionsRatio = largeFunctions.length / repo.totalFunctions;

  if (largeFunctionsRatio > 0.30) {
    penalties.push({ amount: 25, reason: 'Many functions are too long for AI to understand' });
  } else if (largeFunctionsRatio > 0.15) {
    penalties.push({ amount: 15, reason: 'Some functions should be extracted into smaller pieces' });
  }

  // Modularity (Single Responsibility)
  const avgFunctionsPerFile = repo.totalFunctions / repo.totalFiles;
  if (avgFunctionsPerFile > 20) {
    penalties.push({ amount: 15, reason: 'Files have too many functions (low cohesion)' });
  }

  // Apply penalties
  const totalPenalty = penalties.reduce((sum, p) => sum + p.amount, 0);
  score = Math.max(0, score - totalPenalty);

  // Bonus for excellent structure
  if (avgFileSize < 200 && largeFunctionsRatio < 0.05) {
    score = Math.min(100, score + 10); // Bonus for excellent modularity
  }

  return score;
}
```

**Scoring Rubric:**

| Score Range | Grade | Description | Characteristics |
|-------------|-------|-------------|-----------------|
| 90-100 | A | Excellent | <10% files >500 LOC, avg file <200 LOC, <5% functions >50 LOC |
| 80-89 | B | Good | <25% files >500 LOC, avg file <300 LOC, <15% functions >50 LOC |
| 70-79 | C | Fair | <50% files >500 LOC, avg file <400 LOC, <30% functions >50 LOC |
| 60-69 | D | Poor | >50% files >500 LOC, avg file >400 LOC, >30% functions >50 LOC |
| 0-59 | F | Critical | Majority of files >500 LOC, monolithic structure |

#### 2. Complexity Management (15% of total)

**Measures:** Cyclomatic complexity, cognitive complexity, nesting depth

```typescript
function calculateComplexityScore(repo: RepositoryAnalysis): number {
  let score = 100;
  const penalties: Penalty[] = [];

  // Cyclomatic Complexity
  const avgComplexity = repo.averageCyclomaticComplexity;
  if (avgComplexity > 10) {
    penalties.push({ amount: 40, reason: `Average complexity (${avgComplexity}) is very high` });
  } else if (avgComplexity > 7) {
    penalties.push({ amount: 25, reason: `Average complexity (${avgComplexity}) is high` });
  } else if (avgComplexity > 5) {
    penalties.push({ amount: 10, reason: `Average complexity (${avgComplexity}) could be lower` });
  }

  // High Complexity Functions
  const highComplexityFunctions = repo.functions.filter(f => f.cyclomaticComplexity > 10);
  const highComplexityRatio = highComplexityFunctions.length / repo.totalFunctions;

  if (highComplexityRatio > 0.20) {
    penalties.push({ amount: 30, reason: '20%+ functions have complexity >10' });
  } else if (highComplexityRatio > 0.10) {
    penalties.push({ amount: 15, reason: '10%+ functions have complexity >10' });
  }

  // Nesting Depth
  const deeplyNestedFunctions = repo.functions.filter(f => f.maxNestingDepth > 4);
  const deepNestingRatio = deeplyNestedFunctions.length / repo.totalFunctions;

  if (deepNestingRatio > 0.15) {
    penalties.push({ amount: 20, reason: 'Many functions have deep nesting (>4 levels)' });
  } else if (deepNestingRatio > 0.05) {
    penalties.push({ amount: 10, reason: 'Some functions have deep nesting' });
  }

  // Parameter Count
  const longParameterFunctions = repo.functions.filter(f => f.parameterCount > 5);
  const longParamsRatio = longParameterFunctions.length / repo.totalFunctions;

  if (longParamsRatio > 0.10) {
    penalties.push({ amount: 15, reason: 'Many functions have too many parameters (>5)' });
  }

  const totalPenalty = penalties.reduce((sum, p) => sum + p.amount, 0);
  score = Math.max(0, score - totalPenalty);

  // Bonus for excellent complexity management
  if (avgComplexity < 3 && highComplexityRatio < 0.02) {
    score = Math.min(100, score + 10);
  }

  return score;
}
```

**Scoring Rubric:**

| Score Range | Description | Avg Complexity | Functions >10 |
|-------------|-------------|----------------|---------------|
| 90-100 | Excellent | <3 | <2% |
| 80-89 | Good | 3-5 | <5% |
| 70-79 | Fair | 5-7 | <10% |
| 60-69 | Poor | 7-10 | <20% |
| 0-59 | Critical | >10 | >20% |

#### 3. Documentation Coverage (15% of total)

**Measures:** JSDoc/docstrings, README, inline comments, ADRs

```typescript
function calculateDocumentationScore(repo: RepositoryAnalysis): number {
  let score = 0;

  // Function Documentation (40 points)
  const documentedFunctions = repo.functions.filter(f => f.hasDocstring);
  const docCoverageRatio = documentedFunctions.length / repo.totalFunctions;
  score += docCoverageRatio * 40;

  // Quality of Documentation (30 points) - LLM assessment
  const qualityScore = await assessDocumentationQuality(repo);
  score += qualityScore * 30;

  // README Presence and Quality (15 points)
  if (repo.hasReadme) {
    const readmeQuality = await assessReadmeQuality(repo.readme);
    score += readmeQuality * 15;
  }

  // Architecture Documentation (10 points)
  const hasArchDocs = repo.hasFile('docs/architecture.md') || repo.hasADRs;
  if (hasArchDocs) {
    score += 10;
  }

  // Inline Comments (5 points)
  const commentDensity = repo.commentLines / repo.totalLinesOfCode;
  if (commentDensity > 0.15 && commentDensity < 0.40) {
    // Sweet spot: 15-40% comments (not too few, not excessive)
    score += 5;
  }

  return Math.min(100, score);
}

async function assessDocumentationQuality(repo: RepositoryAnalysis): Promise<number> {
  // Sample 10 documented functions for LLM assessment
  const sampleFunctions = repo.functions
    .filter(f => f.hasDocstring)
    .sort(() => Math.random() - 0.5)
    .slice(0, 10);

  const assessments = await Promise.all(
    sampleFunctions.map(async fn => {
      const prompt = `
Rate this function documentation (0-10 scale):

\`\`\`${repo.language}
${fn.docstring}
${fn.signature}
\`\`\`

Criteria:
- Does it explain WHY (not just what)?
- Are edge cases documented?
- Are parameters and return values clear?
- Is business logic explained?

Return only a number 0-10.
      `;

      const response = await llm.complete({ prompt, maxTokens: 10 });
      return parseFloat(response.content);
    })
  );

  return assessments.reduce((sum, score) => sum + score, 0) / assessments.length / 10;
}
```

**Scoring Rubric:**

| Score Range | Description | Function Docs | README | ADRs |
|-------------|-------------|---------------|--------|------|
| 90-100 | Excellent | >90% | Comprehensive | Present |
| 80-89 | Good | 70-90% | Good | Some |
| 70-79 | Fair | 50-70% | Basic | None |
| 60-69 | Poor | 30-50% | Minimal | None |
| 0-59 | Critical | <30% | Missing/Poor | None |

#### 4. Test Coverage (10% of total)

**Measures:** Line coverage, branch coverage, test quality

```typescript
function calculateTestScore(repo: RepositoryAnalysis): number {
  if (!repo.hasTests) {
    return 0;
  }

  let score = 0;

  // Line Coverage (60 points)
  const lineCoverage = repo.testCoverage.lineCoverage;
  if (lineCoverage >= 80) {
    score += 60;
  } else if (lineCoverage >= 60) {
    score += 45;
  } else if (lineCoverage >= 40) {
    score += 30;
  } else if (lineCoverage >= 20) {
    score += 15;
  }

  // Branch Coverage (20 points)
  const branchCoverage = repo.testCoverage.branchCoverage;
  if (branchCoverage >= 70) {
    score += 20;
  } else if (branchCoverage >= 50) {
    score += 15;
  } else if (branchCoverage >= 30) {
    score += 10;
  }

  // Test Types Present (20 points)
  if (repo.hasUnitTests) score += 10;
  if (repo.hasIntegrationTests) score += 5;
  if (repo.hasE2ETests) score += 5;

  return Math.min(100, score);
}
```

**Scoring Rubric:**

| Score Range | Description | Line Coverage | Test Types |
|-------------|-------------|---------------|------------|
| 90-100 | Excellent | >80% | Unit + Integration + E2E |
| 80-89 | Good | 60-80% | Unit + Integration |
| 70-79 | Fair | 40-60% | Unit tests |
| 60-69 | Poor | 20-40% | Minimal tests |
| 0-59 | Critical | <20% | No/few tests |

#### 5. Type Annotations (10% of total)

**Measures:** TypeScript coverage, Python type hints, explicit types

```typescript
function calculateTypeScore(repo: RepositoryAnalysis): number {
  if (!repo.supportsTypeAnnotations) {
    // Languages without type systems (Ruby, JavaScript) get neutral score
    return 75; // Don't penalize, but don't reward
  }

  let score = 0;

  // Function Return Types (40 points)
  const functionsWithReturnTypes = repo.functions.filter(f => f.hasReturnType);
  const returnTypeRatio = functionsWithReturnTypes.length / repo.totalFunctions;
  score += returnTypeRatio * 40;

  // Parameter Types (30 points)
  const paramsWithTypes = repo.countParametersWithTypes();
  const totalParams = repo.countTotalParameters();
  const paramTypeRatio = paramsWithTypes / totalParams;
  score += paramTypeRatio * 30;

  // Variable Types (20 points)
  const varsWithTypes = repo.countVariablesWithTypes();
  const totalVars = repo.countTotalVariables();
  const varTypeRatio = varsWithTypes / totalVars;
  score += varTypeRatio * 20;

  // Type Strictness (10 points)
  if (repo.language === 'typescript' && repo.tsConfig?.strict) {
    score += 10;
  } else if (repo.language === 'python' && repo.hasMypyConfig) {
    score += 10;
  }

  return Math.min(100, score);
}
```

#### 6. Naming Clarity (10% of total) - LLM Assessment

```typescript
async function calculateNamingScore(repo: RepositoryAnalysis): Promise<number> {
  // Sample 20 functions for LLM assessment
  const sampleFunctions = repo.functions
    .sort(() => Math.random() - 0.5)
    .slice(0, 20);

  const prompt = `
Assess the naming clarity of these functions (0-10 scale):

${sampleFunctions.map(f => `- ${f.name}(${f.parameters.map(p => p.name).join(', ')})`).join('\n')}

Criteria:
- Are names descriptive and unambiguous?
- Do names reveal intent?
- Are abbreviations avoided?
- Is naming consistent across codebase?
- Would an AI agent understand the purpose from names alone?

Return JSON:
{
  "score": <0-10>,
  "reasoning": "<brief explanation>",
  "goodExamples": ["name1", "name2"],
  "poorExamples": ["name3", "name4"]
}
  `;

  const response = await llm.complete({ prompt, maxTokens: 500 });
  const assessment = JSON.parse(response.content);

  return (assessment.score / 10) * 100;
}
```

#### 7. Architectural Clarity (10% of total) - LLM Assessment

```typescript
async function calculateArchitecturalScore(repo: RepositoryAnalysis): Promise<number> {
  const prompt = `
Assess the architectural clarity of this codebase:

**Directory Structure:**
${repo.directoryTree}

**Module Dependencies:**
${repo.dependencyGraph}

**Key Files:**
${repo.largestFiles.slice(0, 10).map(f => `- ${f.path} (${f.linesOfCode} LOC)`).join('\n')}

Criteria (0-10 scale):
- Is the directory structure logical and intuitive?
- Are dependencies clear and minimal?
- Is separation of concerns evident?
- Would an AI agent quickly understand the architecture?
- Are there circular dependencies?

Return JSON:
{
  "score": <0-10>,
  "reasoning": "<brief explanation>",
  "strengths": ["strength1", "strength2"],
  "weaknesses": ["weakness1", "weakness2"]
}
  `;

  const response = await llm.complete({ prompt, maxTokens: 800 });
  const assessment = JSON.parse(response.content);

  return (assessment.score / 10) * 100;
}
```

#### 8. Tooling Support (5% of total)

```typescript
function calculateToolingScore(repo: RepositoryAnalysis): number {
  let score = 0;

  // Linter Configuration (30 points)
  if (repo.hasEslintConfig || repo.hasPylintConfig || repo.hasRuboCop) {
    score += 30;
  }

  // Formatter Configuration (20 points)
  if (repo.hasPrettierConfig || repo.hasBlackConfig || repo.hasGoFmt) {
    score += 20;
  }

  // Package Manager (20 points)
  if (repo.hasPackageJson || repo.hasRequirementsTxt || repo.hasGoMod) {
    score += 20;
  }

  // Build Tool (15 points)
  if (repo.hasWebpackConfig || repo.hasMakefile || repo.hasGradle) {
    score += 15;
  }

  // Pre-commit Hooks (15 points)
  if (repo.hasPreCommitConfig || repo.hasHuskyConfig) {
    score += 15;
  }

  return Math.min(100, score);
}
```

#### 9. GitHub Readiness (5% of total)

```typescript
function calculateGitHubScore(repo: RepositoryAnalysis): number {
  let score = 0;

  // CLAUDE.md or .cursorrules (30 points)
  if (repo.hasClaudeMd || repo.hasCursorRules) {
    score += 30;
  }

  // CI/CD Configuration (25 points)
  if (repo.hasGitHubActions || repo.hasCircleCI || repo.hasJenkins) {
    score += 25;
  }

  // PR Template (15 points)
  if (repo.hasPullRequestTemplate) {
    score += 15;
  }

  // Issue Templates (10 points)
  if (repo.hasIssueTemplates) {
    score += 10;
  }

  // Contributing Guide (10 points)
  if (repo.hasContributingMd) {
    score += 10;
  }

  // Branch Protection (10 points)
  if (repo.hasBranchProtection) {
    score += 10;
  }

  return Math.min(100, score);
}
```

### Composite Score Calculation

```typescript
function calculateOverallScore(repo: RepositoryAnalysis): AIReadinessScore {
  const weights = {
    structuralQuality: 0.20,
    complexityManagement: 0.15,
    documentationCoverage: 0.15,
    testCoverage: 0.10,
    typeAnnotations: 0.10,
    namingClarity: 0.10,
    architecturalClarity: 0.10,
    toolingSupport: 0.05,
    githubReadiness: 0.05,
  };

  const breakdown = {
    structuralQuality: calculateStructuralQuality(repo),
    complexityManagement: calculateComplexityScore(repo),
    documentationCoverage: calculateDocumentationScore(repo),
    testCoverage: calculateTestScore(repo),
    typeAnnotations: calculateTypeScore(repo),
    namingClarity: await calculateNamingScore(repo),
    architecturalClarity: await calculateArchitecturalScore(repo),
    toolingSupport: calculateToolingScore(repo),
    githubReadiness: calculateGitHubScore(repo),
  };

  const overall = Object.entries(breakdown).reduce((sum, [key, score]) => {
    return sum + score * weights[key as keyof typeof weights];
  }, 0);

  return {
    overall: Math.round(overall),
    grade: calculateGrade(overall),
    breakdown,
    trends: calculateTrends(repo),
    recommendations: generateRecommendations(breakdown),
    estimatedEffort: estimateEffortToTarget(breakdown, 80),
  };
}
```

### Recommendation Engine

```typescript
function generateRecommendations(breakdown: ScoreBreakdown): Recommendation[] {
  const recommendations: Recommendation[] = [];

  // Prioritize by impact and ease
  if (breakdown.structuralQuality < 70) {
    recommendations.push({
      priority: 'HIGH',
      impact: 'HIGH',
      effort: 'MEDIUM',
      title: 'Split large files',
      description: 'Break files over 500 LOC into smaller modules',
      estimatedHours: 20,
      automationAvailable: true,
    });
  }

  if (breakdown.complexityManagement < 70) {
    recommendations.push({
      priority: 'HIGH',
      impact: 'HIGH',
      effort: 'HIGH',
      title: 'Reduce function complexity',
      description: 'Extract complex functions into smaller, single-purpose functions',
      estimatedHours: 40,
      automationAvailable: true,
    });
  }

  if (breakdown.documentationCoverage < 70) {
    recommendations.push({
      priority: 'MEDIUM',
      impact: 'MEDIUM',
      effort: 'LOW',
      title: 'Generate documentation',
      description: 'Add JSDoc/docstrings to all public functions',
      estimatedHours: 10,
      automationAvailable: true,
    });
  }

  if (breakdown.testCoverage < 70) {
    recommendations.push({
      priority: 'HIGH',
      impact: 'HIGH',
      effort: 'HIGH',
      title: 'Increase test coverage',
      description: 'Generate unit tests for uncovered functions',
      estimatedHours: 60,
      automationAvailable: true,
    });
  }

  // Sort by priority, impact, and ease
  return recommendations.sort((a, b) => {
    const priorityWeight = { HIGH: 3, MEDIUM: 2, LOW: 1 };
    const impactWeight = { HIGH: 3, MEDIUM: 2, LOW: 1 };
    const effortWeight = { LOW: 3, MEDIUM: 2, HIGH: 1 };

    const scoreA = priorityWeight[a.priority] + impactWeight[a.impact] + effortWeight[a.effort];
    const scoreB = priorityWeight[b.priority] + impactWeight[b.impact] + effortWeight[b.effort];

    return scoreB - scoreA;
  });
}
```

---

## Consequences

### Positive

1. **Objective & Transparent:** Clear methodology builds trust
2. **Actionable:** Specific recommendations with effort estimates
3. **Measurable:** Track progress over time
4. **Sales Enablement:** Concrete value proposition ("40 → 85 in 30 days")
5. **Product-Led Growth:** Free tier shows score, paid tier improves it

### Negative

1. **Complexity:** Multi-dimensional scoring requires careful calibration
2. **LLM Cost:** Qualitative analysis adds $0.10-0.50 per repository
3. **Subjectivity:** LLM assessments may vary slightly between runs
4. **Gaming:** Customers might optimize for score rather than real improvements

### Trade-offs

- **Accuracy vs. Speed:** Deep analysis takes time (5-10 min for large repos)
- **Objectivity vs. Insight:** Pure metrics miss semantic issues, LLMs add context
- **Simplicity vs. Completeness:** 9 dimensions capture nuance but complicate communication

---

## Implementation Plan

### Phase 1: Quantitative Scoring (Week 1-2)
- Implement structural, complexity, test coverage scores
- Build aggregation engine
- Create scoring rubrics

### Phase 2: Qualitative Analysis (Week 3)
- Implement LLM-based naming and architectural assessment
- Calibrate prompts for consistency
- Add caching to reduce costs

### Phase 3: Recommendations (Week 4)
- Build recommendation engine
- Estimate effort for improvements
- Prioritize by impact and ease

### Phase 4: Trends & Visualization (Week 5)
- Track historical scores
- Show improvement over time
- Generate executive reports

---

## Validation

### Internal Benchmarking
- Score 100 open-source repositories
- Validate scores against manual code review
- Adjust weights based on feedback

### Customer Pilots
- Run scoring on 10 pilot customer codebases
- Validate that improvements correlate with developer velocity
- Refine based on customer feedback

### Continuous Calibration
- A/B test different weights
- Track correlation between score and AI agent success rate
- Adjust methodology quarterly

---

## References

- [GitHub Copilot Research](https://github.blog/2022-09-07-research-quantifying-github-copilots-impact-on-developer-productivity-and-happiness/)
- [Microsoft Research: Code Complexity](https://www.microsoft.com/en-us/research/publication/code-complexity-metrics/)
- [Google Testing Blog](https://testing.googleblog.com/)
- [SonarQube Quality Model](https://docs.sonarqube.org/latest/user-guide/metric-definitions/)
- [Cognitive Complexity Paper](https://www.sonarsource.com/docs/CognitiveComplexity.pdf)

---

**Decision Maker:** CTO + Product Lead
**Approved By:** Executive Team
**Implementation Owner:** AI/ML Engineering Team
