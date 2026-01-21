# ADR-038: Multi-Language Code Analysis Architecture

**Status:** Accepted
**Date:** 2026-01-21
**Priority:** P0 - Critical for Launch
**Complexity:** High

---

## Context

Forge Factory must analyze codebases written in **10+ programming languages** to generate AI-readiness scores, identify refactoring opportunities, and enable code transformations. Different languages have different syntax, semantics, tooling ecosystems, and analysis requirements.

### Business Requirements

- **Primary Languages** (90% of target customers):
  - JavaScript/TypeScript (Node.js, React, Vue, Angular)
  - Python (Django, Flask, FastAPI, data science)
  - Java (Spring Boot, Jakarta EE, Android)
  - Go (microservices, CLIs, infrastructure)
  - C# (.NET Core, ASP.NET, Unity)

- **Secondary Languages** (50% of enterprise customers):
  - Ruby (Rails, Sinatra)
  - PHP (Laravel, Symfony, WordPress)
  - Rust (systems programming, WebAssembly)
  - Kotlin (Android, backend)
  - Swift (iOS, macOS)

- **Legacy Languages** (modernization market):
  - COBOL (banking, insurance, government)
  - VB6 (enterprise applications)
  - Classic ASP (web applications)
  - PowerBuilder (enterprise systems)
  - Delphi (desktop applications)

### Analysis Requirements

For each language, we need to extract:

1. **Structural Metrics**
   - Lines of code (LOC), comment density
   - File count, average file size
   - Function/method count, average function size
   - Class/module count
   - Dependency graph (imports, requires)

2. **Complexity Metrics**
   - Cyclomatic complexity (McCabe)
   - Cognitive complexity
   - Nesting depth
   - Function parameter count
   - Halstead metrics

3. **Quality Indicators**
   - Type annotation coverage (TypeScript, Python)
   - Test coverage (via coverage tools)
   - Documentation coverage (JSDoc, docstrings)
   - Anti-pattern detection (hardcoded values, TODO comments)
   - Dead code detection

4. **AI-Readiness Indicators**
   - Files >500 LOC (context window limits)
   - Functions >50 LOC (comprehension limits)
   - Missing type annotations
   - Missing documentation
   - Missing tests
   - Deep nesting (>3 levels)
   - Long parameter lists (>5 parameters)

---

## Decision

We will implement a **multi-tier analysis architecture** combining:

1. **Abstract Syntax Tree (AST) parsing** via Tree-sitter (universal)
2. **Language-specific analyzers** for deep inspection
3. **Static analysis tools** for quality and security
4. **LLM-based semantic analysis** for AI-readiness

### Architecture Overview

```typescript
interface LanguageAnalyzer {
  // Metadata
  language: SupportedLanguage;
  version: string;
  fileExtensions: string[];

  // Analysis capabilities
  capabilities: {
    structuralAnalysis: boolean;
    complexityMetrics: boolean;
    typeAnalysis: boolean;
    securityScanning: boolean;
    testCoverage: boolean;
  };

  // Core methods
  analyze(files: SourceFile[]): Promise<AnalysisResult>;
  extractMetrics(ast: AST): CodeMetrics;
  detectAntiPatterns(ast: AST): AntiPattern[];
  assessAIReadiness(metrics: CodeMetrics): AIReadinessScore;
}

// Plugin-based architecture
class AnalysisEngine {
  private analyzers: Map<string, LanguageAnalyzer> = new Map();

  registerAnalyzer(analyzer: LanguageAnalyzer): void {
    analyzer.fileExtensions.forEach(ext => {
      this.analyzers.set(ext, analyzer);
    });
  }

  async analyzeRepository(repoPath: string): Promise<RepositoryAnalysis> {
    const files = await this.discoverFiles(repoPath);
    const filesByLanguage = this.groupByLanguage(files);

    const results = await Promise.all(
      Array.from(filesByLanguage.entries()).map(async ([lang, files]) => {
        const analyzer = this.getAnalyzer(lang);
        return analyzer.analyze(files);
      })
    );

    return this.aggregateResults(results);
  }
}
```

### Tier 1: Universal AST Parsing (Tree-sitter)

**Tool:** [Tree-sitter](https://tree-sitter.github.io/tree-sitter/)
**Coverage:** 50+ languages with maintained grammars

**Capabilities:**
- Fast, incremental parsing
- Error-tolerant (handles syntax errors)
- Language-agnostic API
- Low memory footprint
- Supports all major languages

**Usage:**
```typescript
import Parser from 'tree-sitter';
import TypeScript from 'tree-sitter-typescript';
import Python from 'tree-sitter-python';
import Java from 'tree-sitter-java';

class TreeSitterAnalyzer implements LanguageAnalyzer {
  private parser: Parser;

  constructor(language: SupportedLanguage) {
    this.parser = new Parser();
    this.parser.setLanguage(this.getGrammar(language));
  }

  async analyze(files: SourceFile[]): Promise<AnalysisResult> {
    const results = await Promise.all(
      files.map(async file => {
        const tree = this.parser.parse(file.content);
        return {
          structuralMetrics: this.extractStructuralMetrics(tree),
          complexityMetrics: this.calculateComplexity(tree),
          dependencies: this.extractDependencies(tree),
        };
      })
    );

    return this.aggregateFileResults(results);
  }

  private extractStructuralMetrics(tree: Tree): StructuralMetrics {
    const rootNode = tree.rootNode;

    return {
      totalLines: this.countLines(rootNode),
      codeLines: this.countNonCommentLines(rootNode),
      commentLines: this.countCommentLines(rootNode),
      functionCount: this.countNodes(rootNode, 'function_declaration'),
      classCount: this.countNodes(rootNode, 'class_declaration'),
      importCount: this.countNodes(rootNode, 'import_statement'),
    };
  }

  private calculateComplexity(tree: Tree): ComplexityMetrics {
    const functions = this.findAllFunctions(tree.rootNode);

    return functions.map(fn => ({
      name: this.getFunctionName(fn),
      cyclomaticComplexity: this.calculateCyclomaticComplexity(fn),
      cognitiveComplexity: this.calculateCognitiveComplexity(fn),
      nestingDepth: this.calculateNestingDepth(fn),
      linesOfCode: this.countLines(fn),
      parameterCount: this.countParameters(fn),
    }));
  }

  private calculateCyclomaticComplexity(node: SyntaxNode): number {
    // McCabe's Cyclomatic Complexity: V(G) = E - N + 2P
    // Simplified: count decision points + 1
    let complexity = 1;

    const decisionNodes = [
      'if_statement',
      'while_statement',
      'for_statement',
      'case_statement',
      'catch_clause',
      'ternary_expression',
      'logical_expression', // && and ||
    ];

    this.traverse(node, child => {
      if (decisionNodes.includes(child.type)) {
        complexity++;
      }
    });

    return complexity;
  }
}
```

**Metrics Extraction:**

```typescript
interface StructuralMetrics {
  totalLines: number;
  codeLines: number;
  commentLines: number;
  blankLines: number;

  functionCount: number;
  classCount: number;
  interfaceCount: number;

  importCount: number;
  exportCount: number;

  averageFunctionSize: number;
  largestFunctionSize: number;
  filesOver500LOC: number;
}

interface ComplexityMetrics {
  averageCyclomaticComplexity: number;
  maxCyclomaticComplexity: number;
  functionsOverComplexity10: number;

  averageNestingDepth: number;
  maxNestingDepth: number;
  functionsWithDeepNesting: number; // >3 levels

  averageParameterCount: number;
  functionsWithManyParameters: number; // >5 params
}
```

### Tier 2: Language-Specific Deep Analysis

For languages requiring specialized analysis:

#### TypeScript/JavaScript: `@typescript-eslint/parser` + ESLint

```typescript
class TypeScriptAnalyzer extends TreeSitterAnalyzer {
  async analyze(files: SourceFile[]): Promise<AnalysisResult> {
    const baseAnalysis = await super.analyze(files);

    // Additional TypeScript-specific analysis
    const typeAnalysis = await this.analyzeTypes(files);
    const lintResults = await this.runESLint(files);

    return {
      ...baseAnalysis,
      typeAnnotationCoverage: typeAnalysis.coverage,
      missingTypes: typeAnalysis.missingTypes,
      lintIssues: lintResults,
    };
  }

  private async analyzeTypes(files: SourceFile[]): Promise<TypeAnalysis> {
    const program = ts.createProgram(
      files.map(f => f.path),
      {
        strict: true,
        noImplicitAny: true,
      }
    );

    const checker = program.getTypeChecker();

    let totalFunctions = 0;
    let functionsWithTypes = 0;
    const missingTypes: MissingTypeLocation[] = [];

    for (const sourceFile of program.getSourceFiles()) {
      ts.forEachChild(sourceFile, node => {
        if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) {
          totalFunctions++;

          if (this.hasExplicitReturnType(node)) {
            functionsWithTypes++;
          } else {
            missingTypes.push({
              file: sourceFile.fileName,
              line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line,
              functionName: node.name?.getText() || '<anonymous>',
            });
          }
        }
      });
    }

    return {
      coverage: totalFunctions > 0 ? functionsWithTypes / totalFunctions : 0,
      missingTypes,
    };
  }
}
```

#### Python: `ast` module + `mypy` + `radon`

```typescript
class PythonAnalyzer extends TreeSitterAnalyzer {
  async analyze(files: SourceFile[]): Promise<AnalysisResult> {
    const baseAnalysis = await super.analyze(files);

    // Use Python's ast module via subprocess
    const typeAnalysis = await this.runMypy(files);
    const complexityAnalysis = await this.runRadon(files);
    const testCoverage = await this.runPytest(files);

    return {
      ...baseAnalysis,
      typeHintCoverage: typeAnalysis.coverage,
      complexity: complexityAnalysis,
      testCoverage: testCoverage.percentage,
    };
  }

  private async runMypy(files: SourceFile[]): Promise<TypeAnalysis> {
    // Run mypy for type checking
    const result = await exec(
      `mypy --strict --show-column-numbers ${files.map(f => f.path).join(' ')}`
    );

    return this.parseMypyOutput(result.stdout);
  }

  private async runRadon(files: SourceFile[]): Promise<ComplexityReport> {
    // Radon for cyclomatic complexity
    const result = await exec(
      `radon cc ${files.map(f => f.path).join(' ')} -j`
    );

    return JSON.parse(result.stdout);
  }
}
```

#### Java: `JavaParser` library

```typescript
class JavaAnalyzer extends TreeSitterAnalyzer {
  async analyze(files: SourceFile[]): Promise<AnalysisResult> {
    const baseAnalysis = await super.analyze(files);

    // Use JavaParser for deep semantic analysis
    const semanticAnalysis = await this.analyzeWithJavaParser(files);

    return {
      ...baseAnalysis,
      classHierarchy: semanticAnalysis.hierarchy,
      dependencyGraph: semanticAnalysis.dependencies,
      testCoverage: await this.runJaCoCo(files),
    };
  }

  private async analyzeWithJavaParser(files: SourceFile[]): Promise<SemanticAnalysis> {
    // Call Java subprocess with JavaParser
    const javaCode = `
      import com.github.javaparser.JavaParser;
      import com.github.javaparser.ast.CompilationUnit;

      // Parse and analyze Java files
    `;

    // Execute Java analysis and return results
    return this.executeJavaAnalysis(javaCode);
  }
}
```

### Tier 3: Static Analysis Tools Integration

#### Security & Quality Scanning

```typescript
class SecurityAnalyzer {
  async scanForVulnerabilities(files: SourceFile[]): Promise<SecurityFindings> {
    const semgrepResults = await this.runSemgrep(files);
    const snykResults = await this.runSnyk(files);

    return {
      owaspFindings: this.categorizeOWASP(semgrepResults),
      dependencyVulnerabilities: snykResults,
      secretsDetected: await this.scanForSecrets(files),
    };
  }

  private async runSemgrep(files: SourceFile[]): Promise<SemgrepFindings> {
    // Run Semgrep with security rules
    const result = await exec(
      `semgrep --config=p/security-audit --json ${files.map(f => f.path).join(' ')}`
    );

    return JSON.parse(result.stdout);
  }

  private async scanForSecrets(files: SourceFile[]): Promise<SecretFindings> {
    // Use TruffleHog or detect-secrets
    const result = await exec(
      `trufflehog filesystem ${files[0].path.split('/').slice(0, -1).join('/')} --json`
    );

    return this.parseSecretFindings(result.stdout);
  }
}
```

### Tier 4: LLM-Based Semantic Analysis

For AI-readiness assessment beyond structural metrics:

```typescript
class LLMSemanticAnalyzer {
  constructor(private llmClient: AnthropicClient) {}

  async assessAIReadiness(file: SourceFile, metrics: CodeMetrics): Promise<AIReadinessAssessment> {
    const prompt = `
Analyze this ${file.language} code file for AI agent maintainability:

File: ${file.path}
Size: ${metrics.linesOfCode} lines
Complexity: ${metrics.cyclomaticComplexity}

\`\`\`${file.language}
${file.content}
\`\`\`

Assess the following AI-readiness factors (0-10 scale):

1. **Naming Clarity**: Are variable/function names descriptive and unambiguous?
2. **Documentation Quality**: Is the "why" documented (not just "what")?
3. **Logical Structure**: Is the code flow easy to follow?
4. **Single Responsibility**: Does each function do one thing?
5. **Modularity**: Are dependencies clear and minimal?

Return JSON:
{
  "namingClarity": <0-10>,
  "documentationQuality": <0-10>,
  "logicalStructure": <0-10>,
  "singleResponsibility": <0-10>,
  "modularity": <0-10>,
  "reasoning": "<brief explanation>",
  "improvements": ["<specific suggestion 1>", "..."]
}
    `;

    const response = await this.llmClient.complete({
      model: 'claude-sonnet-4-5',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2000,
      temperature: 0.1,
    });

    return this.parseAIReadinessResponse(response.content);
  }
}
```

### Aggregation & Scoring Engine

```typescript
class AIReadinessScorer {
  calculateScore(analysis: RepositoryAnalysis): AIReadinessScore {
    // Weighted scoring model (0-100 scale)
    const weights = {
      structuralQuality: 0.25,      // 25%
      complexity: 0.20,              // 20%
      documentation: 0.20,           // 20%
      testing: 0.15,                 // 15%
      typeAnnotations: 0.10,         // 10%
      securityQuality: 0.10,         // 10%
    };

    const structuralScore = this.calculateStructuralScore(analysis.structural);
    const complexityScore = this.calculateComplexityScore(analysis.complexity);
    const documentationScore = this.calculateDocumentationScore(analysis.documentation);
    const testingScore = analysis.testCoverage;
    const typeScore = analysis.typeAnnotationCoverage * 100;
    const securityScore = this.calculateSecurityScore(analysis.security);

    const totalScore =
      structuralScore * weights.structuralQuality +
      complexityScore * weights.complexity +
      documentationScore * weights.documentation +
      testingScore * weights.testing +
      typeScore * weights.typeAnnotations +
      securityScore * weights.securityQuality;

    return {
      overall: Math.round(totalScore),
      breakdown: {
        structuralQuality: structuralScore,
        complexity: complexityScore,
        documentation: documentationScore,
        testing: testingScore,
        typeAnnotations: typeScore,
        security: securityScore,
      },
      grade: this.calculateGrade(totalScore),
      recommendations: this.generateRecommendations(analysis),
    };
  }

  private calculateStructuralScore(metrics: StructuralMetrics): number {
    let score = 100;

    // Penalize large files (>500 LOC)
    const largeFil esRatio = metrics.filesOver500LOC / metrics.totalFiles;
    score -= largeFilesRatio * 30; // Up to -30 points

    // Penalize average file size >300 LOC
    if (metrics.averageFileSize > 300) {
      score -= Math.min((metrics.averageFileSize - 300) / 10, 20); // Up to -20 points
    }

    // Reward modular structure (many small files)
    if (metrics.averageFileSize < 200) {
      score += 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  private calculateComplexityScore(metrics: ComplexityMetrics): number {
    let score = 100;

    // Penalize high average complexity
    if (metrics.averageCyclomaticComplexity > 5) {
      score -= (metrics.averageCyclomaticComplexity - 5) * 5;
    }

    // Penalize functions with complexity >10
    score -= metrics.functionsOverComplexity10 * 2;

    // Penalize deep nesting
    score -= metrics.functionsWithDeepNesting * 3;

    // Penalize long parameter lists
    score -= metrics.functionsWithManyParameters * 2;

    return Math.max(0, Math.min(100, score));
  }

  private calculateGrade(score: number): string {
    if (score >= 90) return 'A'; // Excellent AI-readiness
    if (score >= 80) return 'B'; // Good AI-readiness
    if (score >= 70) return 'C'; // Fair AI-readiness
    if (score >= 60) return 'D'; // Poor AI-readiness
    return 'F'; // Not AI-ready
  }
}
```

---

## Consequences

### Positive

1. **Universal Coverage:** Tree-sitter supports 50+ languages with consistent API
2. **Extensible:** Plugin architecture allows adding new languages easily
3. **Fast:** Tree-sitter is written in C, provides incremental parsing
4. **Accurate:** Language-specific analyzers provide deep insights
5. **Cost-Effective:** Use LLMs only for semantic analysis (10-20% of files)

### Negative

1. **Complexity:** Managing multiple analysis tools and their dependencies
2. **Maintenance:** Need to keep language parsers updated
3. **Performance:** Large repositories (>100K files) may require optimization
4. **Cost:** Running language-specific tools in subprocesses adds latency

### Trade-offs

- **Depth vs. Speed:** Deep analysis is slower but more accurate
- **Coverage vs. Accuracy:** Tree-sitter is fast but may miss language-specific nuances
- **Cost vs. Quality:** LLM-based analysis is expensive but provides semantic insights

---

## Implementation Plan

### Phase 1: Core Languages (Week 1-2)
- Implement Tree-sitter integration
- Add TypeScript/JavaScript analyzer
- Add Python analyzer
- Add Java analyzer
- Build aggregation engine

### Phase 2: Additional Languages (Week 3-4)
- Add Go, C#, Ruby analyzers
- Add PHP, Rust, Kotlin analyzers
- Implement security scanning (Semgrep)

### Phase 3: LLM Semantic Analysis (Week 5-6)
- Implement LLM-based readiness assessment
- Build scoring algorithm
- Create recommendation engine

### Phase 4: Testing & Optimization (Week 7-8)
- Performance optimization for large repos
- Caching strategy
- Parallel processing
- Error handling

---

## Alternatives Considered

### Alternative 1: LLM-Only Analysis
**Pros:** Simple, no language-specific tools
**Cons:** Expensive ($50-100 per repo), slow, limited to context window

### Alternative 2: Language-Specific Tools Only
**Pros:** Deep insights for each language
**Cons:** Inconsistent APIs, hard to maintain 10+ tools

### Alternative 3: GitHub/GitLab Code Insights APIs
**Pros:** Hosted, maintained by providers
**Cons:** Limited coverage, no AI-readiness metrics, vendor lock-in

---

## References

- [Tree-sitter Documentation](https://tree-sitter.github.io/tree-sitter/)
- [TypeScript Compiler API](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API)
- [Python AST Module](https://docs.python.org/3/library/ast.html)
- [JavaParser](https://javaparser.org/)
- [Semgrep Rules](https://semgrep.dev/explore)
- [McCabe's Cyclomatic Complexity](https://en.wikipedia.org/wiki/Cyclomatic_complexity)
- [Cognitive Complexity](https://www.sonarsource.com/docs/CognitiveComplexity.pdf)

---

**Decision Maker:** CTO + AI/ML Lead
**Approved By:** Engineering Leadership
**Implementation Owner:** Platform Engineering Team
