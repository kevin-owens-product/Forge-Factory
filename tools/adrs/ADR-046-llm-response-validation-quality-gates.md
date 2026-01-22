# ADR-046: LLM Response Validation & Quality Gates

**Status:** Accepted
**Date:** 2026-01-21
**Priority:** P1 - Enterprise Ready
**Complexity:** High

---

## Context

LLMs can **hallucinate**, produce syntactically invalid code, introduce security vulnerabilities, or generate outputs that don't match requirements. Without robust validation, AI-generated code can break production systems and erode customer trust.

### Business Requirements

- **Code Validity:** 100% of generated code must be syntactically valid
- **Security:** No OWASP Top 10 vulnerabilities in generated code
- **Functionality:** Code must pass automated tests
- **Style Compliance:** Code must match project conventions
- **Documentation:** Generated code must include proper documentation
- **Performance:** Validation must complete in <10 seconds

### Validation Challenges

| Challenge | Risk | Impact |
|-----------|------|--------|
| Syntax Errors | Build failures | High |
| Type Mismatches | Runtime errors | High |
| Missing Imports | Module errors | Medium |
| Security Vulnerabilities | Data breaches | Critical |
| Logic Errors | Incorrect behavior | High |
| Style Violations | Code review delays | Low |
| Incomplete Code | Partial functionality | Medium |

### Quality Gate Levels

1. **Gate 1: Syntax** - Code parses without errors
2. **Gate 2: Types** - Type checking passes
3. **Gate 3: Lint** - No linting errors
4. **Gate 4: Security** - No vulnerability findings
5. **Gate 5: Tests** - All tests pass
6. **Gate 6: Coverage** - Coverage threshold met
7. **Gate 7: Review** - Human/AI review approved

---

## Decision

We will implement a **multi-layer validation system** with:

1. **Structural Validation** - Syntax, types, imports
2. **Semantic Validation** - Logic, correctness
3. **Security Validation** - Vulnerability scanning
4. **Quality Validation** - Style, documentation
5. **Behavioral Validation** - Testing, coverage

### Architecture Overview

```typescript
interface ValidationPipeline {
  // Configuration
  config: ValidationConfig;

  // Validation
  validate(code: GeneratedCode): Promise<ValidationResult>;

  // Individual validators
  validators: Validator[];

  // Quality gates
  gates: QualityGate[];
}

interface ValidationConfig {
  language: SupportedLanguage;
  strictMode: boolean;
  skipValidators: string[];
  customRules: CustomRule[];
  timeoutMs: number;
  parallel: boolean;
}

interface ValidationResult {
  passed: boolean;
  gate: QualityGate;          // Highest gate passed
  issues: ValidationIssue[];
  metrics: ValidationMetrics;
  duration: number;
}

interface ValidationIssue {
  validator: string;
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  location: CodeLocation;
  suggestion?: string;
  autoFixable: boolean;
}

interface QualityGate {
  level: number;
  name: string;
  validators: string[];
  passThreshold: number;      // 0-100
  required: boolean;
}
```

### Layer 1: Structural Validation

Validate code structure before execution.

```typescript
class StructuralValidator implements Validator {
  id = 'structural';
  priority = 1;

  async validate(code: GeneratedCode, context: ValidationContext): Promise<ValidatorResult> {
    const issues: ValidationIssue[] = [];

    // 1. Syntax validation
    const syntaxResult = await this.validateSyntax(code);
    issues.push(...syntaxResult.issues);

    if (!syntaxResult.valid) {
      return { passed: false, issues, stopPipeline: true };
    }

    // 2. Import validation
    const importResult = await this.validateImports(code, context);
    issues.push(...importResult.issues);

    // 3. Type validation (if applicable)
    if (code.language === 'typescript' || code.language === 'python') {
      const typeResult = await this.validateTypes(code, context);
      issues.push(...typeResult.issues);
    }

    // 4. Completeness check
    const completenessResult = await this.validateCompleteness(code);
    issues.push(...completenessResult.issues);

    const errors = issues.filter(i => i.severity === 'error');
    return {
      passed: errors.length === 0,
      issues,
      stopPipeline: errors.length > 0,
    };
  }

  private async validateSyntax(code: GeneratedCode): Promise<SyntaxResult> {
    const parser = this.getParser(code.language);

    try {
      const ast = parser.parse(code.content);

      // Check for parse errors
      const errors = this.findSyntaxErrors(ast);

      return {
        valid: errors.length === 0,
        issues: errors.map(e => ({
          validator: 'structural',
          severity: 'error',
          code: 'SYNTAX_ERROR',
          message: e.message,
          location: e.location,
          suggestion: this.suggestSyntaxFix(e),
          autoFixable: false,
        })),
      };
    } catch (error) {
      return {
        valid: false,
        issues: [{
          validator: 'structural',
          severity: 'error',
          code: 'PARSE_ERROR',
          message: `Failed to parse code: ${error.message}`,
          location: { line: 1, column: 1, file: code.path },
          autoFixable: false,
        }],
      };
    }
  }

  private async validateTypes(code: GeneratedCode, context: ValidationContext): Promise<TypeResult> {
    if (code.language === 'typescript') {
      return this.validateTypeScript(code, context);
    } else if (code.language === 'python') {
      return this.validatePythonTypes(code, context);
    }

    return { issues: [] };
  }

  private async validateTypeScript(code: GeneratedCode, context: ValidationContext): Promise<TypeResult> {
    const compilerOptions: ts.CompilerOptions = {
      strict: true,
      noImplicitAny: true,
      noImplicitReturns: true,
      noUnusedLocals: true,
      noUnusedParameters: true,
    };

    const host = ts.createCompilerHost(compilerOptions);
    const program = ts.createProgram([code.path], compilerOptions, host);
    const diagnostics = ts.getPreEmitDiagnostics(program);

    return {
      issues: diagnostics.map(d => ({
        validator: 'structural',
        severity: d.category === ts.DiagnosticCategory.Error ? 'error' : 'warning',
        code: `TS${d.code}`,
        message: ts.flattenDiagnosticMessageText(d.messageText, '\n'),
        location: this.getLocationFromDiagnostic(d),
        autoFixable: false,
      })),
    };
  }

  private async validateCompleteness(code: GeneratedCode): Promise<CompletenessResult> {
    const issues: ValidationIssue[] = [];

    // Check for incomplete patterns
    const incompletePatterns = [
      { pattern: /TODO:?\s/gi, code: 'INCOMPLETE_TODO', message: 'Contains TODO comment' },
      { pattern: /FIXME:?\s/gi, code: 'INCOMPLETE_FIXME', message: 'Contains FIXME comment' },
      { pattern: /\.\.\./g, code: 'INCOMPLETE_ELLIPSIS', message: 'Contains ellipsis placeholder' },
      { pattern: /pass\s*#.*implement/gi, code: 'INCOMPLETE_PASS', message: 'Contains unimplemented pass' },
      { pattern: /throw new Error\(['"]Not implemented/gi, code: 'NOT_IMPLEMENTED', message: 'Contains not implemented error' },
    ];

    for (const { pattern, code: issueCode, message } of incompletePatterns) {
      const matches = code.content.matchAll(pattern);
      for (const match of matches) {
        issues.push({
          validator: 'structural',
          severity: 'error',
          code: issueCode,
          message,
          location: this.getLocationFromMatch(code, match),
          autoFixable: false,
        });
      }
    }

    return { issues };
  }
}
```

### Layer 2: Semantic Validation

Validate code logic and correctness.

```typescript
class SemanticValidator implements Validator {
  id = 'semantic';
  priority = 2;

  constructor(private llmClient: AnthropicClient) {}

  async validate(code: GeneratedCode, context: ValidationContext): Promise<ValidatorResult> {
    const issues: ValidationIssue[] = [];

    // 1. API usage validation
    const apiResult = await this.validateAPIUsage(code, context);
    issues.push(...apiResult.issues);

    // 2. Logic validation via LLM
    const logicResult = await this.validateLogic(code, context);
    issues.push(...logicResult.issues);

    // 3. Edge case coverage
    const edgeCaseResult = await this.validateEdgeCases(code, context);
    issues.push(...edgeCaseResult.issues);

    const errors = issues.filter(i => i.severity === 'error');
    return {
      passed: errors.length === 0,
      issues,
    };
  }

  private async validateAPIUsage(code: GeneratedCode, context: ValidationContext): Promise<APIResult> {
    const issues: ValidationIssue[] = [];

    // Extract API calls from code
    const apiCalls = this.extractAPICalls(code);

    for (const call of apiCalls) {
      // Check if API exists
      const apiDef = context.apiDefinitions.get(call.name);
      if (!apiDef) {
        issues.push({
          validator: 'semantic',
          severity: 'error',
          code: 'UNKNOWN_API',
          message: `Unknown API call: ${call.name}`,
          location: call.location,
          autoFixable: false,
        });
        continue;
      }

      // Check parameter types
      const paramErrors = this.validateParameters(call, apiDef);
      issues.push(...paramErrors);

      // Check return type usage
      const returnErrors = this.validateReturnUsage(call, apiDef);
      issues.push(...returnErrors);
    }

    return { issues };
  }

  private async validateLogic(code: GeneratedCode, context: ValidationContext): Promise<LogicResult> {
    const prompt = `
Analyze this code for logical errors:

\`\`\`${code.language}
${code.content}
\`\`\`

Original requirements:
${context.requirements}

Check for:
1. **Logic errors**: Does the code correctly implement the requirements?
2. **Edge cases**: Are boundary conditions handled?
3. **Error handling**: Are errors handled appropriately?
4. **Resource leaks**: Are resources properly cleaned up?
5. **Race conditions**: Are there concurrency issues?

Return JSON array of issues (empty if none found):
[
  {
    "severity": "error" | "warning",
    "code": "LOGIC_ERROR" | "EDGE_CASE" | "ERROR_HANDLING" | "RESOURCE_LEAK" | "RACE_CONDITION",
    "message": "Description of the issue",
    "line": <line number>,
    "suggestion": "How to fix"
  }
]
`;

    const response = await this.llmClient.complete({
      model: 'claude-sonnet-4-5',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2000,
      temperature: 0,
    });

    return this.parseLogicValidationResponse(response.content, code);
  }

  private async validateEdgeCases(code: GeneratedCode, context: ValidationContext): Promise<EdgeCaseResult> {
    const issues: ValidationIssue[] = [];

    // Check for common missing edge cases
    const edgeCases = this.inferRequiredEdgeCases(code, context);

    for (const edgeCase of edgeCases) {
      if (!this.hasEdgeCaseHandling(code, edgeCase)) {
        issues.push({
          validator: 'semantic',
          severity: 'warning',
          code: 'MISSING_EDGE_CASE',
          message: `Missing handling for edge case: ${edgeCase.description}`,
          location: edgeCase.suggestedLocation,
          suggestion: edgeCase.suggestedFix,
          autoFixable: true,
        });
      }
    }

    return { issues };
  }
}
```

### Layer 3: Security Validation

Scan for vulnerabilities and security issues.

```typescript
class SecurityValidator implements Validator {
  id = 'security';
  priority = 3;

  async validate(code: GeneratedCode, context: ValidationContext): Promise<ValidatorResult> {
    const issues: ValidationIssue[] = [];

    // 1. Run Semgrep for SAST
    const semgrepResult = await this.runSemgrep(code);
    issues.push(...semgrepResult.issues);

    // 2. Check for hardcoded secrets
    const secretsResult = await this.scanForSecrets(code);
    issues.push(...secretsResult.issues);

    // 3. Validate input handling
    const inputResult = await this.validateInputHandling(code, context);
    issues.push(...inputResult.issues);

    // 4. Check for OWASP Top 10
    const owaspResult = await this.checkOWASPTop10(code);
    issues.push(...owaspResult.issues);

    const errors = issues.filter(i => i.severity === 'error');
    return {
      passed: errors.length === 0,
      issues,
    };
  }

  private async runSemgrep(code: GeneratedCode): Promise<SemgrepResult> {
    const result = await exec(
      `semgrep --config=p/security-audit --config=p/secrets --json ${code.path}`
    );

    const findings = JSON.parse(result.stdout);

    return {
      issues: findings.results.map((f: any) => ({
        validator: 'security',
        severity: f.extra.severity === 'ERROR' ? 'error' : 'warning',
        code: f.check_id,
        message: f.extra.message,
        location: {
          file: f.path,
          line: f.start.line,
          column: f.start.col,
        },
        suggestion: f.extra.fix || undefined,
        autoFixable: !!f.extra.fix,
      })),
    };
  }

  private async scanForSecrets(code: GeneratedCode): Promise<SecretsResult> {
    const secretPatterns = [
      { pattern: /['"][A-Za-z0-9+/]{40}['"]/, code: 'AWS_KEY', message: 'Possible AWS access key' },
      { pattern: /['"]sk-[A-Za-z0-9]{48}['"]/, code: 'OPENAI_KEY', message: 'Possible OpenAI API key' },
      { pattern: /['"]ghp_[A-Za-z0-9]{36}['"]/, code: 'GITHUB_TOKEN', message: 'Possible GitHub token' },
      { pattern: /password\s*=\s*['"][^'"]+['"]/, code: 'HARDCODED_PASSWORD', message: 'Hardcoded password' },
      { pattern: /api[_-]?key\s*=\s*['"][^'"]+['"]/, code: 'HARDCODED_API_KEY', message: 'Hardcoded API key' },
      { pattern: /-----BEGIN (RSA |DSA |EC )?PRIVATE KEY-----/, code: 'PRIVATE_KEY', message: 'Private key in code' },
    ];

    const issues: ValidationIssue[] = [];

    for (const { pattern, code: issueCode, message } of secretPatterns) {
      const matches = code.content.matchAll(new RegExp(pattern, 'gi'));
      for (const match of matches) {
        issues.push({
          validator: 'security',
          severity: 'error',
          code: issueCode,
          message,
          location: this.getLocationFromMatch(code, match),
          suggestion: 'Use environment variables or a secrets manager',
          autoFixable: false,
        });
      }
    }

    return { issues };
  }

  private async checkOWASPTop10(code: GeneratedCode): Promise<OWASPResult> {
    const issues: ValidationIssue[] = [];

    // A01:2021 - Broken Access Control
    issues.push(...this.checkAccessControl(code));

    // A02:2021 - Cryptographic Failures
    issues.push(...this.checkCryptography(code));

    // A03:2021 - Injection
    issues.push(...this.checkInjection(code));

    // A04:2021 - Insecure Design
    issues.push(...this.checkInsecureDesign(code));

    // A05:2021 - Security Misconfiguration
    issues.push(...this.checkMisconfiguration(code));

    // A06:2021 - Vulnerable Components
    issues.push(...this.checkVulnerableComponents(code));

    // A07:2021 - Authentication Failures
    issues.push(...this.checkAuthentication(code));

    // A08:2021 - Data Integrity
    issues.push(...this.checkDataIntegrity(code));

    // A09:2021 - Logging Failures
    issues.push(...this.checkLogging(code));

    // A10:2021 - SSRF
    issues.push(...this.checkSSRF(code));

    return { issues };
  }

  private checkInjection(code: GeneratedCode): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // SQL Injection
    const sqlPatterns = [
      /`SELECT.*\$\{/,                    // Template literal SQL
      /['"]SELECT.*['"]\s*\+/,           // String concatenation SQL
      /query\s*\(\s*['"]SELECT.*\$\{/,   // Query with template
      /execute\s*\(\s*f['"]SELECT/,      // Python f-string SQL
    ];

    for (const pattern of sqlPatterns) {
      const match = code.content.match(pattern);
      if (match) {
        issues.push({
          validator: 'security',
          severity: 'error',
          code: 'SQL_INJECTION',
          message: 'Potential SQL injection vulnerability',
          location: this.getLocationFromMatch(code, match),
          suggestion: 'Use parameterized queries instead of string interpolation',
          autoFixable: false,
        });
      }
    }

    // Command Injection
    const cmdPatterns = [
      /exec\s*\(\s*['"].*\$\{/,
      /child_process\.exec\s*\(\s*`/,
      /subprocess\.run\s*\(\s*f['"][^'"]*\{/,
      /os\.system\s*\(\s*f['"][^'"]*\{/,
    ];

    for (const pattern of cmdPatterns) {
      const match = code.content.match(pattern);
      if (match) {
        issues.push({
          validator: 'security',
          severity: 'error',
          code: 'COMMAND_INJECTION',
          message: 'Potential command injection vulnerability',
          location: this.getLocationFromMatch(code, match),
          suggestion: 'Use parameterized commands or avoid shell execution',
          autoFixable: false,
        });
      }
    }

    return issues;
  }
}
```

### Layer 4: Quality Validation

Validate code style and documentation.

```typescript
class QualityValidator implements Validator {
  id = 'quality';
  priority = 4;

  async validate(code: GeneratedCode, context: ValidationContext): Promise<ValidatorResult> {
    const issues: ValidationIssue[] = [];

    // 1. Run linting
    const lintResult = await this.runLinter(code);
    issues.push(...lintResult.issues);

    // 2. Check documentation
    const docResult = await this.validateDocumentation(code);
    issues.push(...docResult.issues);

    // 3. Check code style
    const styleResult = await this.validateStyle(code, context);
    issues.push(...styleResult.issues);

    // 4. Check complexity
    const complexityResult = await this.validateComplexity(code);
    issues.push(...complexityResult.issues);

    const errors = issues.filter(i => i.severity === 'error');
    return {
      passed: errors.length === 0,
      issues,
    };
  }

  private async runLinter(code: GeneratedCode): Promise<LintResult> {
    const linterConfig = this.getLinterConfig(code.language);

    if (code.language === 'typescript' || code.language === 'javascript') {
      return this.runESLint(code);
    } else if (code.language === 'python') {
      return this.runRuff(code);
    } else if (code.language === 'go') {
      return this.runGolangciLint(code);
    }

    return { issues: [] };
  }

  private async runESLint(code: GeneratedCode): Promise<LintResult> {
    const eslint = new ESLint({
      baseConfig: {
        extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
        rules: {
          '@typescript-eslint/explicit-function-return-type': 'error',
          '@typescript-eslint/no-explicit-any': 'error',
          'no-console': 'warn',
        },
      },
    });

    const results = await eslint.lintText(code.content, { filePath: code.path });

    return {
      issues: results.flatMap(r =>
        r.messages.map(m => ({
          validator: 'quality',
          severity: m.severity === 2 ? 'error' : 'warning',
          code: m.ruleId || 'LINT_ERROR',
          message: m.message,
          location: { file: code.path, line: m.line, column: m.column },
          suggestion: m.fix ? 'Auto-fixable' : undefined,
          autoFixable: !!m.fix,
        }))
      ),
    };
  }

  private async validateDocumentation(code: GeneratedCode): Promise<DocResult> {
    const issues: ValidationIssue[] = [];

    // Parse functions and check for documentation
    const functions = this.extractFunctions(code);

    for (const fn of functions) {
      if (!fn.hasDocumentation) {
        issues.push({
          validator: 'quality',
          severity: 'warning',
          code: 'MISSING_DOCUMENTATION',
          message: `Function '${fn.name}' is missing documentation`,
          location: fn.location,
          suggestion: 'Add JSDoc or docstring comment',
          autoFixable: true,
        });
      }

      // Check documentation completeness
      if (fn.hasDocumentation && fn.documentation) {
        const missingParams = fn.parameters.filter(
          p => !fn.documentation.includes(`@param ${p.name}`)
        );

        for (const param of missingParams) {
          issues.push({
            validator: 'quality',
            severity: 'warning',
            code: 'INCOMPLETE_DOCUMENTATION',
            message: `Parameter '${param.name}' is not documented`,
            location: fn.location,
            autoFixable: true,
          });
        }

        if (fn.returnType && fn.returnType !== 'void' && !fn.documentation.includes('@returns')) {
          issues.push({
            validator: 'quality',
            severity: 'warning',
            code: 'MISSING_RETURN_DOC',
            message: 'Return value is not documented',
            location: fn.location,
            autoFixable: true,
          });
        }
      }
    }

    return { issues };
  }

  private async validateComplexity(code: GeneratedCode): Promise<ComplexityResult> {
    const issues: ValidationIssue[] = [];

    const functions = this.extractFunctions(code);

    for (const fn of functions) {
      // Cyclomatic complexity
      if (fn.cyclomaticComplexity > 10) {
        issues.push({
          validator: 'quality',
          severity: fn.cyclomaticComplexity > 20 ? 'error' : 'warning',
          code: 'HIGH_COMPLEXITY',
          message: `Function '${fn.name}' has high cyclomatic complexity: ${fn.cyclomaticComplexity}`,
          location: fn.location,
          suggestion: 'Consider breaking into smaller functions',
          autoFixable: false,
        });
      }

      // Function length
      if (fn.lineCount > 50) {
        issues.push({
          validator: 'quality',
          severity: fn.lineCount > 100 ? 'error' : 'warning',
          code: 'LONG_FUNCTION',
          message: `Function '${fn.name}' is too long: ${fn.lineCount} lines`,
          location: fn.location,
          suggestion: 'Consider breaking into smaller functions',
          autoFixable: false,
        });
      }

      // Nesting depth
      if (fn.maxNestingDepth > 3) {
        issues.push({
          validator: 'quality',
          severity: fn.maxNestingDepth > 5 ? 'error' : 'warning',
          code: 'DEEP_NESTING',
          message: `Function '${fn.name}' has deep nesting: ${fn.maxNestingDepth} levels`,
          location: fn.location,
          suggestion: 'Use early returns or extract nested logic',
          autoFixable: false,
        });
      }
    }

    return { issues };
  }
}
```

### Layer 5: Behavioral Validation

Validate through testing.

```typescript
class BehavioralValidator implements Validator {
  id = 'behavioral';
  priority = 5;

  constructor(private testRunner: TestRunner) {}

  async validate(code: GeneratedCode, context: ValidationContext): Promise<ValidatorResult> {
    const issues: ValidationIssue[] = [];

    // 1. Run existing tests
    if (context.existingTests.length > 0) {
      const testResult = await this.runExistingTests(code, context);
      issues.push(...testResult.issues);

      if (!testResult.passed) {
        return { passed: false, issues, stopPipeline: true };
      }
    }

    // 2. Run generated tests
    if (context.generatedTests.length > 0) {
      const genTestResult = await this.runGeneratedTests(code, context);
      issues.push(...genTestResult.issues);
    }

    // 3. Check coverage
    const coverageResult = await this.checkCoverage(code, context);
    issues.push(...coverageResult.issues);

    // 4. Run mutation testing (optional)
    if (context.enableMutationTesting) {
      const mutationResult = await this.runMutationTesting(code, context);
      issues.push(...mutationResult.issues);
    }

    const errors = issues.filter(i => i.severity === 'error');
    return {
      passed: errors.length === 0,
      issues,
    };
  }

  private async runExistingTests(code: GeneratedCode, context: ValidationContext): Promise<TestResult> {
    const result = await this.testRunner.run({
      testFiles: context.existingTests,
      sourceFiles: [code.path],
      timeout: 60000,
    });

    const issues: ValidationIssue[] = [];

    for (const failure of result.failures) {
      issues.push({
        validator: 'behavioral',
        severity: 'error',
        code: 'TEST_FAILURE',
        message: `Test failed: ${failure.testName} - ${failure.message}`,
        location: this.findRelatedLocation(code, failure),
        autoFixable: false,
      });
    }

    return { passed: result.failures.length === 0, issues };
  }

  private async checkCoverage(code: GeneratedCode, context: ValidationContext): Promise<CoverageResult> {
    const coverage = await this.testRunner.getCoverage(code.path);
    const issues: ValidationIssue[] = [];

    // Check line coverage
    if (coverage.lineCoverage < context.targetCoverage.lines) {
      issues.push({
        validator: 'behavioral',
        severity: 'warning',
        code: 'LOW_LINE_COVERAGE',
        message: `Line coverage ${coverage.lineCoverage}% below threshold ${context.targetCoverage.lines}%`,
        location: { file: code.path, line: 1, column: 1 },
        autoFixable: false,
      });
    }

    // Check branch coverage
    if (coverage.branchCoverage < context.targetCoverage.branches) {
      issues.push({
        validator: 'behavioral',
        severity: 'warning',
        code: 'LOW_BRANCH_COVERAGE',
        message: `Branch coverage ${coverage.branchCoverage}% below threshold ${context.targetCoverage.branches}%`,
        location: { file: code.path, line: 1, column: 1 },
        autoFixable: false,
      });
    }

    // Report uncovered lines
    for (const uncoveredLine of coverage.uncoveredLines) {
      issues.push({
        validator: 'behavioral',
        severity: 'info',
        code: 'UNCOVERED_LINE',
        message: 'Line is not covered by tests',
        location: { file: code.path, line: uncoveredLine, column: 1 },
        autoFixable: false,
      });
    }

    return { issues };
  }
}
```

### Validation Pipeline Orchestrator

```typescript
class ValidationPipeline {
  private validators: Validator[] = [];
  private gates: QualityGate[] = [];

  constructor(config: ValidationConfig) {
    this.validators = this.initializeValidators(config);
    this.gates = this.initializeGates(config);
  }

  async validate(code: GeneratedCode, context: ValidationContext): Promise<ValidationResult> {
    const startTime = Date.now();
    const allIssues: ValidationIssue[] = [];
    let highestGatePassed: QualityGate | null = null;

    // Sort validators by priority
    const sortedValidators = [...this.validators].sort((a, b) => a.priority - b.priority);

    for (const validator of sortedValidators) {
      // Check timeout
      if (Date.now() - startTime > context.config.timeoutMs) {
        allIssues.push({
          validator: 'pipeline',
          severity: 'error',
          code: 'TIMEOUT',
          message: 'Validation pipeline timed out',
          location: { file: code.path, line: 1, column: 1 },
          autoFixable: false,
        });
        break;
      }

      try {
        const result = await validator.validate(code, context);
        allIssues.push(...result.issues);

        if (result.stopPipeline) {
          break;
        }
      } catch (error) {
        allIssues.push({
          validator: validator.id,
          severity: 'error',
          code: 'VALIDATOR_ERROR',
          message: `Validator ${validator.id} failed: ${error.message}`,
          location: { file: code.path, line: 1, column: 1 },
          autoFixable: false,
        });
      }

      // Check which gate was passed
      const gatePassed = this.checkGatePassed(validator.id, allIssues);
      if (gatePassed && (!highestGatePassed || gatePassed.level > highestGatePassed.level)) {
        highestGatePassed = gatePassed;
      }
    }

    const errors = allIssues.filter(i => i.severity === 'error');
    const warnings = allIssues.filter(i => i.severity === 'warning');

    return {
      passed: errors.length === 0,
      gate: highestGatePassed,
      issues: allIssues,
      metrics: {
        errors: errors.length,
        warnings: warnings.length,
        gateLevel: highestGatePassed?.level ?? 0,
      },
      duration: Date.now() - startTime,
    };
  }

  async autoFix(code: GeneratedCode, issues: ValidationIssue[]): Promise<AutoFixResult> {
    const fixableIssues = issues.filter(i => i.autoFixable);
    let fixedCode = code.content;
    const appliedFixes: AppliedFix[] = [];

    for (const issue of fixableIssues) {
      const fixer = this.getAutoFixer(issue.code);
      if (fixer) {
        const fix = await fixer.fix(fixedCode, issue);
        if (fix.applied) {
          fixedCode = fix.code;
          appliedFixes.push({ issue, fix });
        }
      }
    }

    return {
      originalCode: code.content,
      fixedCode,
      appliedFixes,
      remainingIssues: issues.filter(i => !fixableIssues.includes(i) || !appliedFixes.find(f => f.issue === i)),
    };
  }
}
```

---

## Consequences

### Positive

1. **Safety:** No invalid code reaches production
2. **Security:** Automatic vulnerability detection
3. **Quality:** Consistent code standards
4. **Trust:** Customers can rely on AI-generated code
5. **Automation:** Most issues caught automatically

### Negative

1. **Latency:** Validation adds 5-10 seconds per file
2. **Complexity:** Multiple validation layers to maintain
3. **False Positives:** Some valid code may be flagged
4. **Cost:** LLM-based semantic validation adds cost

### Trade-offs

- **Thoroughness vs. Speed:** More validators = slower
- **Strictness vs. Flexibility:** Strict rules may block valid code
- **Automation vs. Accuracy:** Some issues need human review

---

## Implementation Plan

### Phase 1: Structural Validation (Week 1-2)
- Implement syntax validation
- Add type checking
- Build import validation

### Phase 2: Security Validation (Week 3-4)
- Integrate Semgrep
- Add secrets scanning
- Implement OWASP checks

### Phase 3: Quality Validation (Week 5-6)
- Implement linting
- Add documentation checks
- Build complexity analysis

### Phase 4: Behavioral Validation (Week 7-8)
- Integrate test runner
- Add coverage checking
- Implement auto-fix

---

## References

- [Semgrep Rules](https://semgrep.dev/explore)
- [ESLint Rules](https://eslint.org/docs/rules/)
- [OWASP Top 10](https://owasp.org/Top10/)
- [TypeScript Compiler API](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API)

---

**Decision Maker:** Security Lead + Engineering Lead
**Approved By:** Engineering Leadership
**Implementation Owner:** Platform Engineering Team
