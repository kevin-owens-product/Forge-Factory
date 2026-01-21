# ADR-044: Prompt Engineering & Versioning

**Status:** Accepted
**Date:** 2026-01-21
**Priority:** P1 - Enterprise Ready
**Complexity:** High

---

## Context

Prompts are the **core intellectual property** of Forge Factory. The quality of code transformations depends entirely on prompt engineering. Without proper versioning, A/B testing, and quality control, we risk:

- **Regressions:** New prompt changes breaking existing functionality
- **Inconsistency:** Different results for the same input
- **Debugging Difficulty:** Unable to reproduce issues
- **Lost Knowledge:** No record of why prompts were changed
- **Compliance Issues:** Unable to audit AI decisions

### Business Requirements

- **Version Control:** All prompts versioned with git-like semantics
- **A/B Testing:** Run experiments to compare prompt effectiveness
- **Quality Metrics:** Track prompt success rates and quality scores
- **Rollback:** Instantly revert to previous prompt versions
- **Audit Trail:** Complete history of prompt changes and their effects
- **Collaboration:** Multiple engineers can contribute prompts safely

### Prompt Categories

| Category | Description | Update Frequency | Risk Level |
|----------|-------------|------------------|------------|
| Code Analysis | Understanding code structure | Weekly | Medium |
| Code Generation | Writing new code | Daily | High |
| Refactoring | Improving existing code | Weekly | High |
| Test Generation | Creating tests | Weekly | Medium |
| Documentation | Writing docs | Monthly | Low |
| Code Review | Reviewing changes | Weekly | Medium |

---

## Decision

We will implement a **comprehensive prompt management system** with:

1. **Versioned Prompt Repository** - Git-based prompt storage
2. **Prompt Templates** - Composable, reusable prompt components
3. **A/B Testing Framework** - Experiment infrastructure
4. **Quality Metrics Pipeline** - Automated evaluation
5. **Prompt Registry** - Centralized access and discovery

### Architecture Overview

```typescript
interface PromptManagementSystem {
  // Registry
  registry: PromptRegistry;

  // Versioning
  getPrompt(id: string, version?: string): Promise<VersionedPrompt>;
  createPrompt(prompt: PromptDefinition): Promise<VersionedPrompt>;
  updatePrompt(id: string, changes: PromptChanges): Promise<VersionedPrompt>;

  // A/B Testing
  createExperiment(experiment: ExperimentDefinition): Promise<Experiment>;
  getExperimentResults(id: string): Promise<ExperimentResults>;

  // Quality
  evaluatePrompt(id: string, testCases: TestCase[]): Promise<EvaluationResult>;
  getPromptMetrics(id: string): Promise<PromptMetrics>;
}

interface VersionedPrompt {
  id: string;
  name: string;
  version: SemanticVersion;
  template: PromptTemplate;
  variables: PromptVariable[];
  metadata: PromptMetadata;
  changelog: ChangelogEntry[];
  qualityScore: number;
  status: 'draft' | 'testing' | 'active' | 'deprecated';
}

interface PromptTemplate {
  systemPrompt: string;
  userPromptTemplate: string;
  outputSchema?: JSONSchema;
  examples?: FewShotExample[];
  constraints?: string[];
  fallbackBehavior?: FallbackBehavior;
}

interface PromptMetadata {
  category: PromptCategory;
  author: string;
  createdAt: Date;
  updatedAt: Date;
  model: LLMModel;
  maxTokens: number;
  temperature: number;
  tags: string[];
  dependencies: string[];  // Other prompts this depends on
}
```

### Component 1: Versioned Prompt Repository

Store prompts as versioned files with structured metadata.

```typescript
// Prompt file structure
// prompts/
//   code-generation/
//     typescript/
//       generate-function.v1.0.0.yaml
//       generate-function.v1.1.0.yaml
//       generate-class.v2.0.0.yaml
//   refactoring/
//     extract-method.v1.0.0.yaml
//     rename-variable.v1.0.0.yaml

interface PromptFileSchema {
  // Metadata
  id: string;
  name: string;
  version: string;
  category: string;
  description: string;
  author: string;

  // Model configuration
  model:
    name: string;
    temperature: number;
    maxTokens: number;
    topP?: number;
    frequencyPenalty?: number;

  // Template
  template:
    system: string;
    user: string;
    assistant?: string;  // For few-shot

  // Variables
  variables:
    - name: string;
      type: 'string' | 'code' | 'json' | 'array';
      required: boolean;
      description: string;
      validation?: string;  // Regex or JSON schema

  // Output
  output:
    format: 'text' | 'json' | 'code';
    schema?: object;  // JSON Schema for validation

  // Quality
  quality:
    minScore: number;
    testCases: string[];  // References to test cases

  // History
  changelog:
    - version: string;
      date: string;
      author: string;
      changes: string;
}

class PromptRepository {
  private git: SimpleGit;
  private basePath: string;

  async getPrompt(id: string, version?: string): Promise<VersionedPrompt> {
    const promptPath = this.resolvePromptPath(id, version);
    const content = await this.git.show([`${version || 'HEAD'}:${promptPath}`]);
    return this.parsePromptFile(content);
  }

  async createPrompt(definition: PromptDefinition): Promise<VersionedPrompt> {
    const version = '1.0.0';
    const path = this.generatePromptPath(definition, version);

    const promptFile = this.generatePromptFile(definition, version);
    await fs.writeFile(path, yaml.stringify(promptFile));

    await this.git.add(path);
    await this.git.commit(`feat(prompts): add ${definition.name} v${version}`);

    return this.parsePromptFile(promptFile);
  }

  async updatePrompt(
    id: string,
    changes: PromptChanges,
    bumpType: 'patch' | 'minor' | 'major'
  ): Promise<VersionedPrompt> {
    const current = await this.getPrompt(id);
    const newVersion = this.bumpVersion(current.version, bumpType);

    const updated = this.applyChanges(current, changes);
    updated.version = newVersion;
    updated.changelog.push({
      version: newVersion,
      date: new Date().toISOString(),
      author: changes.author,
      changes: changes.description,
    });

    const newPath = this.generatePromptPath(updated, newVersion);
    await fs.writeFile(newPath, yaml.stringify(updated));

    await this.git.add(newPath);
    await this.git.commit(`feat(prompts): update ${id} to v${newVersion}\n\n${changes.description}`);

    return updated;
  }

  async listVersions(id: string): Promise<VersionInfo[]> {
    const pattern = `prompts/**/${id}.v*.yaml`;
    const files = await glob(pattern, { cwd: this.basePath });

    return files.map(f => this.extractVersionInfo(f)).sort(this.compareVersions);
  }

  async rollback(id: string, toVersion: string): Promise<VersionedPrompt> {
    const targetPrompt = await this.getPrompt(id, toVersion);
    const currentVersion = await this.getCurrentVersion(id);

    // Create new version with rollback content
    return this.updatePrompt(id, {
      template: targetPrompt.template,
      author: 'system',
      description: `Rollback to v${toVersion} from v${currentVersion}`,
    }, 'minor');
  }
}
```

### Component 2: Prompt Templates

Composable prompt building system.

```typescript
class PromptTemplateEngine {
  private partials: Map<string, string> = new Map();

  registerPartial(name: string, template: string): void {
    this.partials.set(name, template);
  }

  compile(prompt: VersionedPrompt, variables: Record<string, any>): CompiledPrompt {
    // Replace partials
    let systemPrompt = this.replacePartials(prompt.template.systemPrompt);
    let userPrompt = this.replacePartials(prompt.template.userPromptTemplate);

    // Validate required variables
    this.validateVariables(prompt.variables, variables);

    // Replace variables
    systemPrompt = this.replaceVariables(systemPrompt, variables);
    userPrompt = this.replaceVariables(userPrompt, variables);

    // Add examples if present
    const messages: Message[] = [
      { role: 'system', content: systemPrompt },
    ];

    if (prompt.template.examples) {
      for (const example of prompt.template.examples) {
        messages.push({ role: 'user', content: example.input });
        messages.push({ role: 'assistant', content: example.output });
      }
    }

    messages.push({ role: 'user', content: userPrompt });

    return {
      messages,
      model: prompt.metadata.model,
      maxTokens: prompt.metadata.maxTokens,
      temperature: prompt.metadata.temperature,
      outputSchema: prompt.template.outputSchema,
    };
  }

  private replacePartials(template: string): string {
    return template.replace(/\{\{>\s*(\w+)\s*\}\}/g, (_, name) => {
      const partial = this.partials.get(name);
      if (!partial) {
        throw new Error(`Unknown partial: ${name}`);
      }
      return partial;
    });
  }

  private replaceVariables(template: string, variables: Record<string, any>): string {
    return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, name) => {
      const value = variables[name];
      if (value === undefined) {
        return `{{${name}}}`; // Keep placeholder if not provided
      }

      if (typeof value === 'object') {
        return JSON.stringify(value, null, 2);
      }

      return String(value);
    });
  }

  private validateVariables(
    definitions: PromptVariable[],
    values: Record<string, any>
  ): void {
    for (const def of definitions) {
      if (def.required && values[def.name] === undefined) {
        throw new Error(`Missing required variable: ${def.name}`);
      }

      if (values[def.name] !== undefined && def.validation) {
        const isValid = new RegExp(def.validation).test(String(values[def.name]));
        if (!isValid) {
          throw new Error(`Variable ${def.name} failed validation: ${def.validation}`);
        }
      }
    }
  }
}

// Example prompt template with partials
const codeGenerationPrompt = `
# System Prompt

{{> safety_guidelines}}

You are an expert {{language}} developer. Generate clean, well-documented code.

{{> output_format}}

# User Prompt Template

Generate a {{functionType}} function that:

**Requirements:**
{{requirements}}

**Context:**
\`\`\`{{language}}
{{context}}
\`\`\`

**Constraints:**
{{> code_constraints}}

Return only the code, no explanations.
`;

// Partial definitions
const partials = {
  safety_guidelines: `
## Safety Guidelines
- Never generate code that could cause security vulnerabilities
- Never include hardcoded credentials or secrets
- Always validate inputs before use
- Follow OWASP best practices
`,

  output_format: `
## Output Format
Return well-formatted code with:
- Clear function/method signatures
- Type annotations where applicable
- JSDoc/docstring comments
- Error handling for edge cases
`,

  code_constraints: `
- Follow the project's existing code style
- Use meaningful variable and function names
- Keep functions under 50 lines
- Avoid deep nesting (max 3 levels)
`,
};
```

### Component 3: A/B Testing Framework

Run experiments to compare prompt effectiveness.

```typescript
interface Experiment {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'running' | 'completed' | 'cancelled';

  variants: ExperimentVariant[];
  trafficAllocation: TrafficAllocation;

  metrics: ExperimentMetric[];
  successCriteria: SuccessCriteria;

  startDate: Date;
  endDate?: Date;
  sampleSize: number;
  currentSamples: number;
}

interface ExperimentVariant {
  id: string;
  name: string;
  promptId: string;
  promptVersion: string;
  weight: number;  // Traffic allocation weight (0-100)
}

interface TrafficAllocation {
  type: 'percentage' | 'deterministic';
  seed?: string;  // For deterministic allocation
}

class ABTestingService {
  constructor(
    private experimentStore: ExperimentStore,
    private promptRegistry: PromptRegistry,
    private metricsService: MetricsService
  ) {}

  async createExperiment(definition: ExperimentDefinition): Promise<Experiment> {
    // Validate variants exist
    for (const variant of definition.variants) {
      await this.promptRegistry.getPrompt(variant.promptId, variant.promptVersion);
    }

    const experiment: Experiment = {
      id: generateId(),
      ...definition,
      status: 'draft',
      currentSamples: 0,
    };

    await this.experimentStore.save(experiment);
    return experiment;
  }

  async getVariant(experimentId: string, userId: string): Promise<ExperimentVariant> {
    const experiment = await this.experimentStore.get(experimentId);

    if (experiment.status !== 'running') {
      throw new Error(`Experiment ${experimentId} is not running`);
    }

    // Deterministic assignment based on user ID
    const hash = this.hashUserId(userId, experiment.trafficAllocation.seed);
    const bucket = hash % 100;

    let cumulative = 0;
    for (const variant of experiment.variants) {
      cumulative += variant.weight;
      if (bucket < cumulative) {
        return variant;
      }
    }

    return experiment.variants[0]; // Fallback to first variant
  }

  async recordOutcome(
    experimentId: string,
    variantId: string,
    outcome: ExperimentOutcome
  ): Promise<void> {
    await this.metricsService.recordExperimentMetric({
      experimentId,
      variantId,
      timestamp: new Date(),
      metrics: outcome.metrics,
    });

    // Check if experiment is complete
    const experiment = await this.experimentStore.get(experimentId);
    experiment.currentSamples++;

    if (experiment.currentSamples >= experiment.sampleSize) {
      await this.completeExperiment(experiment);
    }
  }

  async getResults(experimentId: string): Promise<ExperimentResults> {
    const experiment = await this.experimentStore.get(experimentId);
    const metrics = await this.metricsService.getExperimentMetrics(experimentId);

    const variantResults = experiment.variants.map(variant => {
      const variantMetrics = metrics.filter(m => m.variantId === variant.id);

      return {
        variant,
        sampleSize: variantMetrics.length,
        metrics: this.aggregateMetrics(variantMetrics),
        statisticalSignificance: this.calculateSignificance(variantMetrics, metrics),
      };
    });

    return {
      experiment,
      variants: variantResults,
      winner: this.determineWinner(variantResults, experiment.successCriteria),
      recommendation: this.generateRecommendation(variantResults),
    };
  }

  private calculateSignificance(
    variantMetrics: MetricRecord[],
    allMetrics: MetricRecord[]
  ): StatisticalSignificance {
    // Calculate p-value using t-test
    const variantValues = variantMetrics.map(m => m.metrics.successScore);
    const controlValues = allMetrics
      .filter(m => !variantMetrics.includes(m))
      .map(m => m.metrics.successScore);

    const tTest = this.performTTest(variantValues, controlValues);

    return {
      pValue: tTest.pValue,
      confidenceInterval: tTest.confidenceInterval,
      effectSize: tTest.effectSize,
      isSignificant: tTest.pValue < 0.05,
    };
  }
}
```

### Component 4: Quality Metrics Pipeline

Automated evaluation of prompt effectiveness.

```typescript
interface PromptMetrics {
  promptId: string;
  version: string;
  period: DateRange;

  // Usage metrics
  totalInvocations: number;
  uniqueUsers: number;

  // Quality metrics
  successRate: number;          // % of successful completions
  averageQualityScore: number;  // 0-100 human/auto evaluation
  averageLatency: number;       // ms
  averageTokens: number;

  // Error metrics
  errorRate: number;
  timeoutRate: number;
  invalidOutputRate: number;

  // Cost metrics
  totalCost: number;
  costPerSuccess: number;
}

class PromptEvaluationService {
  constructor(
    private llmClient: AnthropicClient,
    private metricsStore: MetricsStore
  ) {}

  async evaluatePrompt(
    prompt: VersionedPrompt,
    testCases: TestCase[]
  ): Promise<EvaluationResult> {
    const results: TestCaseResult[] = [];

    for (const testCase of testCases) {
      const result = await this.runTestCase(prompt, testCase);
      results.push(result);
    }

    return this.aggregateResults(prompt, results);
  }

  private async runTestCase(
    prompt: VersionedPrompt,
    testCase: TestCase
  ): Promise<TestCaseResult> {
    const startTime = Date.now();

    try {
      // Compile prompt with test case inputs
      const compiled = this.templateEngine.compile(prompt, testCase.inputs);

      // Execute prompt
      const response = await this.llmClient.complete({
        model: compiled.model,
        messages: compiled.messages,
        max_tokens: compiled.maxTokens,
        temperature: compiled.temperature,
      });

      const latency = Date.now() - startTime;

      // Validate output format
      const formatValid = this.validateOutputFormat(
        response.content,
        prompt.template.outputSchema
      );

      // Check against expected output
      const matchScore = await this.calculateMatchScore(
        response.content,
        testCase.expectedOutput
      );

      // Evaluate quality with LLM judge
      const qualityScore = await this.evaluateQuality(
        testCase,
        response.content
      );

      return {
        testCaseId: testCase.id,
        status: 'success',
        output: response.content,
        latency,
        tokenUsage: response.usage,
        formatValid,
        matchScore,
        qualityScore,
      };
    } catch (error) {
      return {
        testCaseId: testCase.id,
        status: 'error',
        error: error.message,
        latency: Date.now() - startTime,
      };
    }
  }

  private async evaluateQuality(
    testCase: TestCase,
    output: string
  ): Promise<number> {
    // Use LLM-as-judge for quality evaluation
    const evaluationPrompt = `
You are evaluating the quality of an AI-generated output.

## Task Description
${testCase.description}

## Input
${JSON.stringify(testCase.inputs, null, 2)}

## Expected Characteristics
${testCase.qualityCriteria.join('\n')}

## Actual Output
${output}

## Evaluation

Rate the output on a scale of 0-100 based on:
1. Correctness (40%): Does it solve the task correctly?
2. Quality (30%): Is the code/output well-written?
3. Completeness (20%): Does it handle edge cases?
4. Style (10%): Does it follow best practices?

Return JSON:
{
  "score": <0-100>,
  "breakdown": {
    "correctness": <0-40>,
    "quality": <0-30>,
    "completeness": <0-20>,
    "style": <0-10>
  },
  "feedback": "<brief explanation>"
}
`;

    const response = await this.llmClient.complete({
      model: 'claude-sonnet-4-5',
      messages: [{ role: 'user', content: evaluationPrompt }],
      max_tokens: 500,
      temperature: 0,
    });

    const evaluation = JSON.parse(response.content);
    return evaluation.score;
  }

  async getPromptMetrics(promptId: string, period: DateRange): Promise<PromptMetrics> {
    const records = await this.metricsStore.query({
      promptId,
      startDate: period.start,
      endDate: period.end,
    });

    return {
      promptId,
      version: records[0]?.version,
      period,
      totalInvocations: records.length,
      uniqueUsers: new Set(records.map(r => r.userId)).size,
      successRate: records.filter(r => r.status === 'success').length / records.length,
      averageQualityScore: this.average(records.map(r => r.qualityScore)),
      averageLatency: this.average(records.map(r => r.latency)),
      averageTokens: this.average(records.map(r => r.tokenUsage.total)),
      errorRate: records.filter(r => r.status === 'error').length / records.length,
      timeoutRate: records.filter(r => r.error?.includes('timeout')).length / records.length,
      invalidOutputRate: records.filter(r => !r.formatValid).length / records.length,
      totalCost: records.reduce((sum, r) => sum + r.cost, 0),
      costPerSuccess: this.calculateCostPerSuccess(records),
    };
  }
}
```

### Component 5: Prompt Registry

Centralized access and discovery.

```typescript
class PromptRegistry {
  constructor(
    private repository: PromptRepository,
    private evaluationService: PromptEvaluationService,
    private cache: PromptCache
  ) {}

  async getActivePrompt(category: string, name: string): Promise<VersionedPrompt> {
    const cacheKey = `${category}:${name}:active`;

    // Check cache
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Get active version from registry
    const promptId = `${category}/${name}`;
    const activeVersion = await this.getActiveVersion(promptId);

    const prompt = await this.repository.getPrompt(promptId, activeVersion);

    // Cache for 5 minutes
    await this.cache.set(cacheKey, prompt, 300);

    return prompt;
  }

  async promotePrompt(promptId: string, version: string): Promise<void> {
    const prompt = await this.repository.getPrompt(promptId, version);

    // Validate prompt meets quality bar
    const metrics = await this.evaluationService.getPromptMetrics(promptId, {
      start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      end: new Date(),
    });

    if (metrics.successRate < 0.95) {
      throw new Error(`Prompt success rate ${metrics.successRate} below threshold 0.95`);
    }

    if (metrics.averageQualityScore < 80) {
      throw new Error(`Prompt quality score ${metrics.averageQualityScore} below threshold 80`);
    }

    // Update active version
    await this.setActiveVersion(promptId, version);

    // Clear cache
    await this.cache.invalidate(`${promptId}:*`);

    // Log promotion
    await this.auditLog.record({
      action: 'prompt_promoted',
      promptId,
      version,
      metrics,
    });
  }

  async searchPrompts(query: SearchQuery): Promise<PromptSearchResult[]> {
    const allPrompts = await this.repository.listPrompts();

    return allPrompts
      .filter(p => this.matchesQuery(p, query))
      .map(p => ({
        prompt: p,
        relevanceScore: this.calculateRelevance(p, query),
        metrics: this.getLatestMetrics(p.id),
      }))
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  async deprecatePrompt(promptId: string, reason: string): Promise<void> {
    const prompt = await this.repository.getPrompt(promptId);

    await this.repository.updatePrompt(promptId, {
      status: 'deprecated',
      deprecationReason: reason,
      deprecationDate: new Date(),
    }, 'minor');

    // Notify users of this prompt
    await this.notificationService.notifyPromptDeprecation(promptId, reason);
  }
}
```

---

## Consequences

### Positive

1. **Quality Control:** Systematic evaluation prevents regressions
2. **Experimentation:** A/B testing enables data-driven improvements
3. **Auditability:** Complete history for compliance
4. **Collaboration:** Multiple engineers can safely contribute
5. **Reliability:** Versioning enables instant rollbacks

### Negative

1. **Complexity:** Significant infrastructure overhead
2. **Overhead:** Every prompt change requires review
3. **Latency:** Registry lookup adds ~50ms
4. **Storage:** Historical versions accumulate

### Trade-offs

- **Speed vs. Safety:** Review process slows deployment
- **Flexibility vs. Control:** Versioning constrains experimentation
- **Cost vs. Quality:** Evaluation requires additional LLM calls

---

## Implementation Plan

### Phase 1: Repository & Versioning (Week 1-2)
- Set up prompt file structure
- Implement version management
- Build template engine

### Phase 2: Registry & Cache (Week 3-4)
- Implement prompt registry
- Add caching layer
- Build search functionality

### Phase 3: Evaluation Pipeline (Week 5-6)
- Implement test case framework
- Build LLM-as-judge evaluation
- Add metrics collection

### Phase 4: A/B Testing (Week 7-8)
- Implement experiment framework
- Add traffic allocation
- Build results analysis

---

## References

- [Anthropic Prompt Engineering Guide](https://docs.anthropic.com/claude/docs/prompt-engineering)
- [LangSmith Prompt Management](https://docs.smith.langchain.com/)
- [Weights & Biases Prompts](https://docs.wandb.ai/guides/prompts)
- [Microsoft Guidance](https://github.com/microsoft/guidance)

---

**Decision Maker:** AI/ML Lead + Engineering Lead
**Approved By:** Engineering Leadership
**Implementation Owner:** AI Platform Team
