# ADR-042: Test Generation Strategy

**Status:** Accepted
**Date:** 2026-01-21
**Priority:** P1 - Enterprise Ready
**Complexity:** High

---

## Context

Forge Factory must automatically generate tests to achieve **80%+ code coverage** for transformed code. Manual test writing is the primary bottleneck in code transformation projects, with developers spending 30-50% of transformation time on testing.

### Business Requirements

- **Target Coverage:** Minimum 80% line/branch coverage
- **Test Types:** Unit tests, integration tests, e2e tests
- **Frameworks:** Support for 15+ testing frameworks across languages
- **Quality:** Generated tests must be maintainable and readable
- **Speed:** Generate tests 10x faster than manual writing

### Testing Framework Coverage

| Language | Unit Testing | Integration Testing | E2E Testing |
|----------|-------------|---------------------|-------------|
| JavaScript/TypeScript | Jest, Vitest, Mocha | Supertest, MSW | Playwright, Cypress |
| Python | pytest, unittest | pytest-aiohttp, httpx | pytest-playwright |
| Java | JUnit 5, TestNG | Spring Test, MockMvc | Selenium |
| Go | testing, testify | httptest | Rod |
| C# | xUnit, NUnit | WebApplicationFactory | Playwright |
| Ruby | RSpec, Minitest | Rack::Test | Capybara |
| PHP | PHPUnit, Pest | Laravel HTTP Tests | Laravel Dusk |

### Test Generation Challenges

1. **Understanding Intent:** Inferring what the code should do
2. **Edge Cases:** Identifying boundary conditions and error paths
3. **Mocking Strategy:** Determining what to mock vs. test real
4. **Test Isolation:** Ensuring tests don't depend on each other
5. **Performance:** Generating thousands of tests quickly
6. **Maintenance:** Generated tests must be readable and updatable

---

## Decision

We will implement a **multi-strategy test generation system** that combines:

1. **Static Analysis-Based Generation** - Derive tests from code structure
2. **LLM-Based Semantic Generation** - Understand intent and generate meaningful tests
3. **Property-Based Testing** - Automatically discover edge cases
4. **Coverage-Guided Generation** - Iteratively improve coverage

### Architecture Overview

```typescript
interface TestGenerationEngine {
  // Configuration
  config: TestGenerationConfig;

  // Core generation methods
  generateUnitTests(file: SourceFile): Promise<GeneratedTest[]>;
  generateIntegrationTests(module: Module): Promise<GeneratedTest[]>;
  generateE2ETests(feature: Feature): Promise<GeneratedTest[]>;

  // Coverage optimization
  analyzeCoverage(tests: GeneratedTest[]): CoverageReport;
  generateCoverageTests(gaps: CoverageGap[]): Promise<GeneratedTest[]>;

  // Quality assurance
  validateTests(tests: GeneratedTest[]): ValidationResult;
  optimizeTests(tests: GeneratedTest[]): GeneratedTest[];
}

interface TestGenerationConfig {
  targetCoverage: number;          // 80
  testingFramework: TestFramework;
  mockingStrategy: MockingStrategy;
  assertionStyle: AssertionStyle;
  testFileNaming: NamingConvention;
  maxTestsPerFunction: number;     // 10
  includeEdgeCases: boolean;
  includePropertyTests: boolean;
  includeErrorTests: boolean;
}

interface GeneratedTest {
  id: string;
  name: string;
  description: string;
  targetFunction: string;
  targetFile: string;
  testCode: string;
  testType: 'unit' | 'integration' | 'e2e';
  assertions: Assertion[];
  mocks: Mock[];
  fixtures: Fixture[];
  estimatedCoverage: CoverageEstimate;
  confidence: number;              // 0-1
  generationMethod: 'static' | 'llm' | 'property' | 'coverage';
}
```

### Strategy 1: Static Analysis-Based Generation

Generate tests by analyzing code structure without understanding semantics.

```typescript
class StaticAnalysisTestGenerator {
  async generateTests(file: SourceFile): Promise<GeneratedTest[]> {
    const ast = await this.parseFile(file);
    const functions = this.extractFunctions(ast);

    const tests: GeneratedTest[] = [];

    for (const fn of functions) {
      // Generate happy path test
      tests.push(await this.generateHappyPathTest(fn));

      // Generate error path tests
      tests.push(...await this.generateErrorPathTests(fn));

      // Generate boundary tests
      tests.push(...await this.generateBoundaryTests(fn));

      // Generate null/undefined tests
      tests.push(...await this.generateNullTests(fn));
    }

    return tests;
  }

  private async generateHappyPathTest(fn: FunctionNode): Promise<GeneratedTest> {
    const params = this.analyzeParameters(fn);
    const returnType = this.analyzeReturnType(fn);

    // Generate test inputs based on parameter types
    const inputs = params.map(p => this.generateTestValue(p.type));

    // Infer expected output from function body
    const expectedOutput = this.inferExpectedOutput(fn, inputs);

    return {
      id: `${fn.name}_happy_path`,
      name: `should ${this.describeFunction(fn)} with valid inputs`,
      description: `Happy path test for ${fn.name}`,
      targetFunction: fn.name,
      targetFile: fn.file,
      testCode: this.generateTestCode(fn, inputs, expectedOutput),
      testType: 'unit',
      assertions: [{ type: 'toEqual', expected: expectedOutput }],
      mocks: this.generateRequiredMocks(fn),
      fixtures: [],
      estimatedCoverage: { lines: 0.6, branches: 0.5 },
      confidence: 0.7,
      generationMethod: 'static',
    };
  }

  private generateTestValue(type: TypeNode): TestValue {
    const generators: Record<string, () => TestValue> = {
      'string': () => ({ value: 'test-string', type: 'string' }),
      'number': () => ({ value: 42, type: 'number' }),
      'boolean': () => ({ value: true, type: 'boolean' }),
      'array': () => ({ value: [1, 2, 3], type: 'array' }),
      'object': () => ({ value: { key: 'value' }, type: 'object' }),
      'null': () => ({ value: null, type: 'null' }),
      'undefined': () => ({ value: undefined, type: 'undefined' }),
      'Date': () => ({ value: new Date('2026-01-21'), type: 'Date' }),
      'Promise': () => ({ value: Promise.resolve(), type: 'Promise' }),
    };

    return generators[type.name]?.() ?? this.generateComplexValue(type);
  }

  private async generateBoundaryTests(fn: FunctionNode): Promise<GeneratedTest[]> {
    const params = this.analyzeParameters(fn);
    const tests: GeneratedTest[] = [];

    for (const param of params) {
      if (param.type.name === 'number') {
        // Test boundary values
        tests.push(this.createBoundaryTest(fn, param, 0));
        tests.push(this.createBoundaryTest(fn, param, -1));
        tests.push(this.createBoundaryTest(fn, param, Number.MAX_SAFE_INTEGER));
        tests.push(this.createBoundaryTest(fn, param, Number.MIN_SAFE_INTEGER));
      } else if (param.type.name === 'string') {
        tests.push(this.createBoundaryTest(fn, param, ''));
        tests.push(this.createBoundaryTest(fn, param, 'a'.repeat(10000)));
      } else if (param.type.name === 'array') {
        tests.push(this.createBoundaryTest(fn, param, []));
        tests.push(this.createBoundaryTest(fn, param, new Array(1000).fill(0)));
      }
    }

    return tests;
  }
}
```

### Strategy 2: LLM-Based Semantic Generation

Use LLMs to understand function intent and generate meaningful tests.

```typescript
class LLMTestGenerator {
  constructor(
    private llmClient: AnthropicClient,
    private config: LLMTestConfig
  ) {}

  async generateTests(fn: FunctionNode, context: CodeContext): Promise<GeneratedTest[]> {
    const prompt = this.buildTestGenerationPrompt(fn, context);

    const response = await this.llmClient.complete({
      model: 'claude-sonnet-4-5',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4000,
      temperature: 0.2,
    });

    return this.parseTestResponse(response.content, fn);
  }

  private buildTestGenerationPrompt(fn: FunctionNode, context: CodeContext): string {
    return `
You are an expert test engineer. Generate comprehensive unit tests for the following function.

## Function to Test

File: ${fn.file}
Language: ${context.language}
Testing Framework: ${context.testFramework}

\`\`\`${context.language}
${fn.sourceCode}
\`\`\`

## Related Context

Dependencies:
${context.dependencies.map(d => `- ${d.name}: ${d.description}`).join('\n')}

Types:
${context.types.map(t => `- ${t.name}: ${t.definition}`).join('\n')}

## Requirements

1. Generate tests for:
   - Happy path (normal successful execution)
   - Edge cases (empty inputs, boundary values)
   - Error conditions (invalid inputs, exceptions)
   - Async behavior (if applicable)

2. Use ${context.testFramework} syntax
3. Use descriptive test names following pattern: "should <action> when <condition>"
4. Include setup and teardown if needed
5. Mock external dependencies appropriately
6. Aim for 80%+ code coverage

## Output Format

Return a JSON array of test cases:
\`\`\`json
[
  {
    "name": "should return user when valid ID is provided",
    "description": "Happy path test for user retrieval",
    "testCode": "test('should return user when valid ID is provided', async () => {...})",
    "testType": "unit",
    "assertions": [
      { "type": "toEqual", "actual": "result.name", "expected": "'John'" }
    ],
    "mocks": [
      { "target": "userRepository.findById", "returns": "mockUser" }
    ],
    "coverage": { "lines": ["5-10", "15-20"], "branches": ["6", "16"] }
  }
]
\`\`\`

Generate 5-10 comprehensive tests:
`;
  }

  private parseTestResponse(response: string, fn: FunctionNode): GeneratedTest[] {
    const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/);
    if (!jsonMatch) {
      throw new Error('Failed to parse LLM test response');
    }

    const testData = JSON.parse(jsonMatch[1]) as LLMTestOutput[];

    return testData.map((test, index) => ({
      id: `${fn.name}_llm_${index}`,
      name: test.name,
      description: test.description,
      targetFunction: fn.name,
      targetFile: fn.file,
      testCode: test.testCode,
      testType: test.testType as 'unit' | 'integration' | 'e2e',
      assertions: test.assertions,
      mocks: test.mocks,
      fixtures: [],
      estimatedCoverage: this.estimateCoverage(test.coverage),
      confidence: 0.85,
      generationMethod: 'llm',
    }));
  }
}
```

### Strategy 3: Property-Based Testing

Automatically discover edge cases through property-based testing.

```typescript
class PropertyBasedTestGenerator {
  async generatePropertyTests(fn: FunctionNode): Promise<GeneratedTest[]> {
    const properties = this.inferProperties(fn);

    return properties.map(prop => this.generatePropertyTest(fn, prop));
  }

  private inferProperties(fn: FunctionNode): Property[] {
    const properties: Property[] = [];

    // Infer idempotency
    if (this.isPotentiallyIdempotent(fn)) {
      properties.push({
        name: 'idempotency',
        description: 'Calling twice with same input returns same result',
        check: 'fn(x) === fn(x)',
      });
    }

    // Infer commutativity
    if (this.isPotentiallyCommutative(fn)) {
      properties.push({
        name: 'commutativity',
        description: 'Order of arguments does not matter',
        check: 'fn(a, b) === fn(b, a)',
      });
    }

    // Infer round-trip
    if (this.hasInverseFunction(fn)) {
      properties.push({
        name: 'round-trip',
        description: 'Encode/decode returns original',
        check: 'decode(encode(x)) === x',
      });
    }

    // Infer invariants
    properties.push(...this.inferInvariants(fn));

    return properties;
  }

  private generatePropertyTest(fn: FunctionNode, prop: Property): GeneratedTest {
    // Generate fast-check property test
    const testCode = `
import * as fc from 'fast-check';

test('${fn.name} ${prop.name}', () => {
  fc.assert(
    fc.property(
      ${this.generateArbitrary(fn.parameters)},
      (${fn.parameters.map(p => p.name).join(', ')}) => {
        ${this.generatePropertyAssertion(fn, prop)}
      }
    ),
    { numRuns: 100 }
  );
});
`;

    return {
      id: `${fn.name}_property_${prop.name}`,
      name: `${fn.name} satisfies ${prop.name}`,
      description: prop.description,
      targetFunction: fn.name,
      targetFile: fn.file,
      testCode,
      testType: 'unit',
      assertions: [{ type: 'property', description: prop.check }],
      mocks: [],
      fixtures: [],
      estimatedCoverage: { lines: 0.4, branches: 0.6 },
      confidence: 0.9,
      generationMethod: 'property',
    };
  }

  private generateArbitrary(params: Parameter[]): string {
    const arbitraries = params.map(p => {
      switch (p.type.name) {
        case 'string': return 'fc.string()';
        case 'number': return 'fc.integer()';
        case 'boolean': return 'fc.boolean()';
        case 'array': return 'fc.array(fc.anything())';
        default: return 'fc.anything()';
      }
    });

    return arbitraries.join(', ');
  }
}
```

### Strategy 4: Coverage-Guided Generation

Iteratively generate tests to fill coverage gaps.

```typescript
class CoverageGuidedTestGenerator {
  async generateCoverageTests(
    file: SourceFile,
    existingTests: GeneratedTest[],
    coverageReport: CoverageReport
  ): Promise<GeneratedTest[]> {
    const gaps = this.identifyCoverageGaps(file, coverageReport);
    const additionalTests: GeneratedTest[] = [];

    for (const gap of gaps) {
      const test = await this.generateTestForGap(file, gap);
      if (test) {
        additionalTests.push(test);
      }
    }

    return additionalTests;
  }

  private identifyCoverageGaps(file: SourceFile, report: CoverageReport): CoverageGap[] {
    const gaps: CoverageGap[] = [];

    // Identify uncovered lines
    for (const [line, covered] of Object.entries(report.lineCoverage)) {
      if (!covered) {
        gaps.push({
          type: 'uncovered_line',
          file: file.path,
          line: parseInt(line),
          code: file.lines[parseInt(line) - 1],
          context: this.getLineContext(file, parseInt(line)),
        });
      }
    }

    // Identify uncovered branches
    for (const branch of report.branches) {
      if (!branch.taken) {
        gaps.push({
          type: 'uncovered_branch',
          file: file.path,
          line: branch.line,
          branch: branch.condition,
          condition: branch.value,
          context: this.getBranchContext(file, branch),
        });
      }
    }

    return gaps;
  }

  private async generateTestForGap(file: SourceFile, gap: CoverageGap): Promise<GeneratedTest | null> {
    const prompt = `
Generate a test that will execute the following uncovered code:

File: ${gap.file}
Line: ${gap.line}
${gap.type === 'uncovered_branch' ? `Branch condition: ${gap.condition}` : ''}

Code context:
\`\`\`
${gap.context}
\`\`\`

Generate a test that will:
1. Set up the necessary conditions to reach this code
2. Execute the code path
3. Assert the expected behavior

Return JSON with test code:
`;

    const response = await this.llmClient.complete({
      model: 'claude-sonnet-4-5',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2000,
      temperature: 0.3,
    });

    return this.parseTestFromResponse(response.content, gap);
  }
}
```

### Test Orchestrator

```typescript
class TestGenerationOrchestrator {
  constructor(
    private staticGenerator: StaticAnalysisTestGenerator,
    private llmGenerator: LLMTestGenerator,
    private propertyGenerator: PropertyBasedTestGenerator,
    private coverageGenerator: CoverageGuidedTestGenerator,
    private testRunner: TestRunner
  ) {}

  async generateComprehensiveTests(
    file: SourceFile,
    config: TestGenerationConfig
  ): Promise<TestGenerationResult> {
    const allTests: GeneratedTest[] = [];

    // Phase 1: Static analysis tests (fast, cheap)
    const staticTests = await this.staticGenerator.generateTests(file);
    allTests.push(...staticTests);

    // Phase 2: Run initial tests and measure coverage
    let coverageReport = await this.testRunner.runTests(allTests);

    // Phase 3: LLM-based tests for complex functions (targeted)
    if (coverageReport.lineCoverage < config.targetCoverage) {
      const complexFunctions = this.identifyComplexFunctions(file);
      for (const fn of complexFunctions) {
        const llmTests = await this.llmGenerator.generateTests(fn, file.context);
        allTests.push(...llmTests);
      }
    }

    // Phase 4: Property-based tests for algorithmic functions
    if (config.includePropertyTests) {
      const propertyTests = await this.propertyGenerator.generatePropertyTests(file);
      allTests.push(...propertyTests);
    }

    // Phase 5: Coverage-guided generation to fill gaps
    coverageReport = await this.testRunner.runTests(allTests);
    if (coverageReport.lineCoverage < config.targetCoverage) {
      const coverageTests = await this.coverageGenerator.generateCoverageTests(
        file,
        allTests,
        coverageReport
      );
      allTests.push(...coverageTests);
    }

    // Phase 6: Validate and deduplicate tests
    const validatedTests = await this.validateTests(allTests);
    const optimizedTests = this.optimizeTests(validatedTests);

    // Phase 7: Final coverage measurement
    const finalCoverage = await this.testRunner.runTests(optimizedTests);

    return {
      tests: optimizedTests,
      coverage: finalCoverage,
      statistics: {
        totalTests: optimizedTests.length,
        byStrategy: this.groupByStrategy(optimizedTests),
        byType: this.groupByType(optimizedTests),
        generationTime: Date.now() - startTime,
      },
    };
  }

  private async validateTests(tests: GeneratedTest[]): Promise<GeneratedTest[]> {
    const validTests: GeneratedTest[] = [];

    for (const test of tests) {
      try {
        // Syntax validation
        await this.testRunner.validateSyntax(test.testCode);

        // Execute test to ensure it runs
        const result = await this.testRunner.runSingleTest(test);

        if (result.status === 'passed' || result.status === 'failed') {
          // Test runs (even if it fails, the assertion might be wrong)
          validTests.push(test);
        }
      } catch (error) {
        // Test has syntax error or runtime error - discard
        console.log(`Discarding invalid test: ${test.name}`, error);
      }
    }

    return validTests;
  }

  private optimizeTests(tests: GeneratedTest[]): GeneratedTest[] {
    // Remove duplicate tests
    const uniqueTests = this.removeDuplicates(tests);

    // Remove tests that don't add coverage
    const effectiveTests = this.removeRedundantTests(uniqueTests);

    // Sort by coverage contribution
    return effectiveTests.sort((a, b) =>
      (b.estimatedCoverage.lines + b.estimatedCoverage.branches) -
      (a.estimatedCoverage.lines + a.estimatedCoverage.branches)
    );
  }
}
```

### Framework-Specific Adapters

```typescript
interface TestFrameworkAdapter {
  framework: TestFramework;
  generateTestSuite(tests: GeneratedTest[]): string;
  generateTestFile(test: GeneratedTest): string;
  generateAssertion(assertion: Assertion): string;
  generateMock(mock: Mock): string;
}

class JestAdapter implements TestFrameworkAdapter {
  framework = TestFramework.JEST;

  generateTestFile(tests: GeneratedTest[]): string {
    const imports = this.generateImports(tests);
    const mocks = this.generateMocks(tests);
    const describes = this.groupByTarget(tests);

    return `
${imports}

${mocks}

${describes.map(group => `
describe('${group.target}', () => {
  ${group.tests.map(test => test.testCode).join('\n\n  ')}
});
`).join('\n')}
`;
  }

  generateAssertion(assertion: Assertion): string {
    switch (assertion.type) {
      case 'toEqual':
        return `expect(${assertion.actual}).toEqual(${assertion.expected})`;
      case 'toBe':
        return `expect(${assertion.actual}).toBe(${assertion.expected})`;
      case 'toThrow':
        return `expect(() => ${assertion.actual}).toThrow(${assertion.expected || ''})`;
      case 'toBeNull':
        return `expect(${assertion.actual}).toBeNull()`;
      case 'toBeDefined':
        return `expect(${assertion.actual}).toBeDefined()`;
      case 'toContain':
        return `expect(${assertion.actual}).toContain(${assertion.expected})`;
      case 'toHaveLength':
        return `expect(${assertion.actual}).toHaveLength(${assertion.expected})`;
      default:
        return `expect(${assertion.actual}).${assertion.type}(${assertion.expected})`;
    }
  }

  generateMock(mock: Mock): string {
    return `
jest.mock('${mock.module}', () => ({
  ${mock.target}: jest.fn().mockReturnValue(${JSON.stringify(mock.returns)}),
}));
`;
  }
}

class PytestAdapter implements TestFrameworkAdapter {
  framework = TestFramework.PYTEST;

  generateTestFile(tests: GeneratedTest[]): string {
    const imports = this.generateImports(tests);
    const fixtures = this.generateFixtures(tests);

    return `
${imports}
import pytest
from unittest.mock import Mock, patch

${fixtures}

${tests.map(test => test.testCode).join('\n\n')}
`;
  }

  generateAssertion(assertion: Assertion): string {
    switch (assertion.type) {
      case 'toEqual':
        return `assert ${assertion.actual} == ${assertion.expected}`;
      case 'toThrow':
        return `with pytest.raises(${assertion.expected}):\n        ${assertion.actual}`;
      case 'toBeNull':
        return `assert ${assertion.actual} is None`;
      case 'toBeDefined':
        return `assert ${assertion.actual} is not None`;
      case 'toContain':
        return `assert ${assertion.expected} in ${assertion.actual}`;
      default:
        return `assert ${assertion.actual} ${assertion.type} ${assertion.expected}`;
    }
  }
}
```

---

## Consequences

### Positive

1. **High Coverage:** Multi-strategy approach achieves 80%+ coverage
2. **Fast Generation:** Static analysis handles 60% of tests instantly
3. **Quality Tests:** LLM generates semantically meaningful tests
4. **Edge Case Discovery:** Property-based testing finds unexpected bugs
5. **Cost Efficient:** LLM used only for complex functions

### Negative

1. **Complexity:** Managing multiple generation strategies
2. **False Positives:** Some generated tests may be incorrect
3. **Maintenance:** Generated tests may become stale
4. **LLM Cost:** Complex functions require LLM generation

### Trade-offs

- **Speed vs. Quality:** Static analysis is fast but shallow
- **Coverage vs. Maintainability:** More tests = more maintenance
- **Automation vs. Accuracy:** Manual review still needed

---

## Implementation Plan

### Phase 1: Core Infrastructure (Week 1-2)
- Implement test generation interfaces
- Build Jest and pytest adapters
- Create test runner integration

### Phase 2: Static Analysis (Week 3-4)
- Implement static test generator
- Add boundary and error path detection
- Build assertion inference

### Phase 3: LLM Integration (Week 5-6)
- Implement LLM test generator
- Build prompt templates
- Add response parsing

### Phase 4: Advanced Features (Week 7-8)
- Property-based testing integration
- Coverage-guided generation
- Test optimization

---

## References

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [pytest Documentation](https://docs.pytest.org/)
- [fast-check Property Testing](https://github.com/dubzzz/fast-check)
- [Istanbul Code Coverage](https://istanbul.js.org/)
- [Microsoft Pex](https://www.microsoft.com/en-us/research/project/pex-and-moles/)

---

**Decision Maker:** Engineering Lead + QA Lead
**Approved By:** Engineering Leadership
**Implementation Owner:** Code Transformation Team
