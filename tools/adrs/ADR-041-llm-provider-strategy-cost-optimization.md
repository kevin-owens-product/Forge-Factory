# ADR-041: LLM Provider Strategy & Cost Optimization

**Status:** Accepted
**Date:** 2026-01-21
**Priority:** P0 - Critical for Launch
**Complexity:** High
**Dependencies:** ADR-038 (Multi-Language Code Analysis), ADR-039 (AI-Readiness Assessment)

---

## Context

Forge Factory's AI-powered transformations rely heavily on **Large Language Models (LLMs)** for code analysis, refactoring, documentation generation, and test creation. LLM costs are our **largest COGS (Cost of Goods Sold)** component and can make or break unit economics.

### Cost Reality

**Without optimization:**
- Average repository analysis: $5-15 (Claude Opus 4.5)
- Code transformation: $10-50 per transformation
- Documentation generation: $5-20 per repository
- **Total COGS per customer/month:** $200-500 (if processing 20 repos)

**With $99/month pricing:**
- **Gross margin:** -100% to 50% (unprofitable at scale)
- **Target COGS:** <$50/month (50% gross margin)
- **Required cost reduction:** 75-90%

### Business Requirements

1. **Cost Target:** <50% of revenue (50% gross margin)
2. **Quality:** No degradation in transformation quality
3. **Reliability:** 99.9% uptime (handle provider outages)
4. **Speed:** P95 latency <30 seconds for analysis
5. **Scalability:** Support 100,000+ repositories without manual intervention
6. **Compliance:** Data residency (EU, US), no training on customer code

### LLM Provider Landscape (2026)

| Provider | Model | Cost (Input/Output) | Quality | Speed | Context |
|----------|-------|---------------------|---------|-------|---------|
| **Anthropic** | Claude Opus 4.5 | $15/$75 per 1M tokens | Excellent | Medium | 200K |
| **Anthropic** | Claude Sonnet 4.5 | $3/$15 per 1M tokens | Very Good | Fast | 200K |
| **Anthropic** | Claude Haiku 4 | $0.80/$4 per 1M tokens | Good | Very Fast | 200K |
| **OpenAI** | GPT-4.5 Turbo | $10/$30 per 1M tokens | Very Good | Fast | 128K |
| **OpenAI** | GPT-4o-mini | $0.15/$0.60 per 1M tokens | Good | Very Fast | 128K |
| **Google** | Gemini 2.0 Flash | $0.10/$0.30 per 1M tokens | Good | Very Fast | 1M |
| **Open Source** | Qwen 2.5 72B (self-hosted) | $0.20/$0.20 per 1M tokens | Fair | Medium | 32K |

### Token Usage Analysis

**Typical repository (50K LOC):**
- **Initial analysis:** 150K input tokens (AST + metrics + sample code)
- **AI-readiness assessment:** 50K input + 10K output tokens
- **Transformation planning:** 30K input + 5K output tokens
- **Code generation:** 20K input + 15K output tokens per file
- **Documentation generation:** 10K input + 5K output tokens per file

**Total tokens per repo:** 300K-500K tokens
**Cost at Claude Opus rates:** $7-12 per repository
**Cost at optimized rates:** $1-2 per repository (75-85% reduction)

---

## Decision

We will implement a **multi-provider, intelligent routing strategy** with:

1. **Primary Provider:** Anthropic Claude (Opus for critical, Sonnet for most, Haiku for simple)
2. **Secondary Provider:** OpenAI GPT-4.5 Turbo (fallback, load balancing)
3. **Tertiary Provider:** Google Gemini 2.0 Flash (high-volume, low-complexity tasks)
4. **Self-Hosted:** Qwen 2.5 72B (for EU data residency, cost-sensitive customers)
5. **Intelligent Routing:** Task complexity determines provider selection
6. **Aggressive Caching:** Cache 80% of LLM calls (code patterns repeat)
7. **Prompt Optimization:** Reduce input tokens by 50% (structured data vs. raw code)

### Architecture Overview

```typescript
interface LLMStrategy {
  // Provider management
  selectProvider(task: LLMTask): LLMProvider;
  routeRequest(request: LLMRequest): Promise<LLMResponse>;
  handleFailover(provider: LLMProvider, error: Error): LLMProvider;

  // Cost optimization
  estimateCost(task: LLMTask): CostEstimate;
  cacheResponse(request: LLMRequest, response: LLMResponse): Promise<void>;
  getCachedResponse(request: LLMRequest): Promise<LLMResponse | null>;
  optimizePrompt(prompt: string): OptimizedPrompt;

  // Monitoring
  trackUsage(provider: LLMProvider, tokens: number, cost: number): void;
  generateCostReport(): CostReport;
}
```

### Component 1: Intelligent Provider Routing

```typescript
enum TaskComplexity {
  SIMPLE = 'SIMPLE',       // Pattern matching, formatting, simple queries
  MEDIUM = 'MEDIUM',       // Code analysis, documentation, simple refactoring
  COMPLEX = 'COMPLEX',     // Complex refactoring, architecture decisions
  CRITICAL = 'CRITICAL',   // Security-critical, payment logic, auth
}

enum LLMProvider {
  CLAUDE_OPUS = 'claude-opus-4-5',
  CLAUDE_SONNET = 'claude-sonnet-4-5',
  CLAUDE_HAIKU = 'claude-haiku-4',
  GPT4_TURBO = 'gpt-4.5-turbo',
  GPT4O_MINI = 'gpt-4o-mini',
  GEMINI_FLASH = 'gemini-2.0-flash',
  QWEN_SELF_HOSTED = 'qwen-2.5-72b',
}

class IntelligentRouter {
  selectProvider(task: LLMTask): LLMProvider {
    // Factor 1: Task complexity
    const complexity = this.assessComplexity(task);

    // Factor 2: Cost budget
    const costBudget = task.metadata?.costBudget || 'STANDARD';

    // Factor 3: Data residency requirements
    const region = task.metadata?.region || 'US';
    if (region === 'EU' && task.metadata?.strictDataResidency) {
      return LLMProvider.QWEN_SELF_HOSTED; // EU-hosted model
    }

    // Factor 4: Current provider health
    const healthyProviders = this.getHealthyProviders();

    // Routing logic
    switch (complexity) {
      case TaskComplexity.CRITICAL:
        // Always use best model for security/payment code
        return healthyProviders.includes(LLMProvider.CLAUDE_OPUS)
          ? LLMProvider.CLAUDE_OPUS
          : LLMProvider.GPT4_TURBO;

      case TaskComplexity.COMPLEX:
        // Use high-quality models
        if (costBudget === 'HIGH') {
          return LLMProvider.CLAUDE_OPUS;
        }
        return healthyProviders.includes(LLMProvider.CLAUDE_SONNET)
          ? LLMProvider.CLAUDE_SONNET
          : LLMProvider.GPT4_TURBO;

      case TaskComplexity.MEDIUM:
        // Balance cost and quality
        if (costBudget === 'LOW') {
          return LLMProvider.GPT4O_MINI;
        }
        return LLMProvider.CLAUDE_SONNET;

      case TaskComplexity.SIMPLE:
        // Use cheapest reliable model
        if (task.estimatedInputTokens > 50000) {
          // Gemini Flash has 1M context, very cheap
          return LLMProvider.GEMINI_FLASH;
        }
        return LLMProvider.CLAUDE_HAIKU;

      default:
        return LLMProvider.CLAUDE_SONNET;
    }
  }

  private assessComplexity(task: LLMTask): TaskComplexity {
    // Analyze task to determine complexity

    // Critical: Security-sensitive code
    if (this.isSecurityCritical(task)) {
      return TaskComplexity.CRITICAL;
    }

    // Simple: Pattern-based tasks
    if (task.type === 'format-code' || task.type === 'add-imports') {
      return TaskComplexity.SIMPLE;
    }

    // Simple: Documentation for small functions
    if (task.type === 'generate-docs' && task.estimatedInputTokens < 1000) {
      return TaskComplexity.SIMPLE;
    }

    // Medium: Standard refactoring
    if (task.type === 'extract-function' || task.type === 'rename-variable') {
      return TaskComplexity.MEDIUM;
    }

    // Complex: Architecture changes
    if (task.type === 'file-split' || task.type === 'reduce-complexity') {
      return TaskComplexity.COMPLEX;
    }

    // Complex: Large input
    if (task.estimatedInputTokens > 20000) {
      return TaskComplexity.COMPLEX;
    }

    return TaskComplexity.MEDIUM;
  }

  private isSecurityCritical(task: LLMTask): boolean {
    const securityKeywords = [
      'auth', 'authentication', 'authorize', 'password', 'secret',
      'token', 'jwt', 'oauth', 'payment', 'charge', 'billing',
      'sanitize', 'escape', 'sql', 'query', 'execute',
    ];

    return task.files.some(file =>
      securityKeywords.some(keyword =>
        file.path.toLowerCase().includes(keyword) ||
        file.content.toLowerCase().includes(keyword)
      )
    );
  }
}
```

### Component 2: Aggressive Caching Strategy

**80% cache hit rate = 80% cost reduction**

```typescript
class LLMCacheManager {
  private cache: Redis;
  private localCache: LRUCache;

  async getCachedResponse(request: LLMRequest): Promise<LLMResponse | null> {
    // Generate deterministic cache key
    const cacheKey = this.generateCacheKey(request);

    // Check local cache first (in-memory, <1ms)
    const localResult = this.localCache.get(cacheKey);
    if (localResult) {
      this.metrics.recordCacheHit('local');
      return localResult;
    }

    // Check Redis cache (network, ~5ms)
    const redisResult = await this.cache.get(cacheKey);
    if (redisResult) {
      const response = JSON.parse(redisResult);

      // Populate local cache
      this.localCache.set(cacheKey, response);

      this.metrics.recordCacheHit('redis');
      return response;
    }

    this.metrics.recordCacheMiss();
    return null;
  }

  private generateCacheKey(request: LLMRequest): string {
    // Normalize request for caching
    const normalized = {
      model: request.model,
      prompt: this.normalizePrompt(request.prompt),
      temperature: request.temperature || 0,
      // Ignore non-deterministic params like user_id, timestamp
    };

    return crypto
      .createHash('sha256')
      .update(JSON.stringify(normalized))
      .digest('hex');
  }

  private normalizePrompt(prompt: string): string {
    // Remove non-semantic variations
    return prompt
      .replace(/\/\/ Generated at .*/g, '') // Remove timestamps
      .replace(/File: \/.*?\//g, 'File: /') // Normalize file paths
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  async cacheResponse(
    request: LLMRequest,
    response: LLMResponse,
    ttl: number = 7 * 24 * 60 * 60 // 7 days default
  ): Promise<void> {
    const cacheKey = this.generateCacheKey(request);

    // Store in local cache (no TTL, LRU eviction)
    this.localCache.set(cacheKey, response);

    // Store in Redis with TTL
    await this.cache.setex(
      cacheKey,
      ttl,
      JSON.stringify(response)
    );

    this.metrics.recordCacheWrite();
  }

  // Semantic caching: similar code should cache similarly
  async getSemanticallySimilarResponse(
    request: LLMRequest
  ): Promise<LLMResponse | null> {
    // Extract code embedding
    const embedding = await this.embedCode(request.prompt);

    // Search for similar cached responses (vector similarity)
    const similar = await this.vectorDB.search({
      vector: embedding,
      threshold: 0.95, // 95% similarity
      limit: 1,
    });

    if (similar.length > 0) {
      this.metrics.recordCacheHit('semantic');
      return similar[0].response;
    }

    return null;
  }

  private async embedCode(code: string): Promise<number[]> {
    // Use lightweight embedding model (OpenAI ada, $0.0001 per 1K tokens)
    const response = await this.openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: code.slice(0, 8000), // Limit to 8K chars
    });

    return response.data[0].embedding;
  }
}
```

**Caching Strategy by Task Type:**

| Task Type | Cache TTL | Expected Hit Rate | Cost Savings |
|-----------|-----------|-------------------|--------------|
| Code formatting | 30 days | 95% | 95% |
| Import organization | 30 days | 90% | 90% |
| Documentation generation | 14 days | 70% | 70% |
| Simple refactoring | 7 days | 60% | 60% |
| AI-readiness assessment | 7 days | 50% | 50% |
| Complex refactoring | 3 days | 30% | 30% |
| Custom transformations | No cache | 0% | 0% |

### Component 3: Prompt Optimization (50% Token Reduction)

**Bad Prompt (wasteful):**
```typescript
const badPrompt = `
Analyze this TypeScript file and provide an AI-readiness score:

${file.content} // 10,000 tokens of raw code

Please analyze:
1. Function complexity
2. Documentation quality
3. Type annotations
4. Test coverage
5. Naming conventions
...
`;
// Total: 12,000 tokens input
```

**Optimized Prompt (structured data):**
```typescript
const optimizedPrompt = `
Analyze this TypeScript file for AI-readiness:

**Metrics:**
- Lines of code: ${metrics.loc}
- Functions: ${metrics.functionCount}
- Avg cyclomatic complexity: ${metrics.avgComplexity}
- Type annotation coverage: ${metrics.typeAnnotations}%
- Test coverage: ${metrics.testCoverage}%

**Sample Functions (3 largest):**
\`\`\`typescript
${sampleFunctions.slice(0, 3).map(f => f.signature).join('\n')}
\`\`\`

**Issues Detected:**
${issues.slice(0, 5).join('\n')}

Score 0-100 based on AI-readiness criteria.
`;
// Total: 1,500 tokens input (87.5% reduction)
```

```typescript
class PromptOptimizer {
  optimizeForAnalysis(file: SourceFile, metrics: CodeMetrics): OptimizedPrompt {
    // Instead of sending entire file, send structured summary
    const summary = {
      language: file.language,
      loc: metrics.linesOfCode,
      functions: metrics.functionCount,
      complexity: {
        average: metrics.averageCyclomaticComplexity,
        max: metrics.maxCyclomaticComplexity,
        functionsOver10: metrics.functionsOverComplexity10,
      },
      structure: {
        largestFile: metrics.largestFileSize,
        averageFileSize: metrics.averageFileSize,
        filesOver500: metrics.filesOver500LOC,
      },
      quality: {
        typeAnnotations: metrics.typeAnnotationCoverage,
        documentation: metrics.documentationCoverage,
        testCoverage: metrics.testCoverage,
      },
      // Include only sample functions (not all)
      sampleFunctions: this.selectRepresentativeFunctions(file, 5),
      // Include only critical issues
      criticalIssues: metrics.issues.filter(i => i.severity === 'HIGH').slice(0, 10),
    };

    const prompt = this.buildPromptFromSummary(summary);

    return {
      prompt,
      estimatedTokens: this.estimateTokens(prompt),
      reductionPercentage: this.calculateReduction(file.content, prompt),
    };
  }

  optimizeForTransformation(
    file: SourceFile,
    transformation: Transformation
  ): OptimizedPrompt {
    // Send only relevant parts of the file

    // Extract function to transform + its dependencies
    const relevantCode = this.extractRelevantCode(file, transformation.target);

    const prompt = `
Transform this ${file.language} function:

**Original Function:**
\`\`\`${file.language}
${relevantCode.targetFunction}
\`\`\`

**Dependencies:**
${relevantCode.dependencies.map(d => `- ${d.name}: ${d.type}`).join('\n')}

**Transformation:** ${transformation.type}
**Goal:** ${transformation.description}

**Constraints:**
- Preserve behavior (same inputs → same outputs)
- Maintain type signatures
- Keep existing tests passing

Return only the transformed function.
    `;

    return {
      prompt,
      estimatedTokens: this.estimateTokens(prompt),
      reductionPercentage: this.calculateReduction(file.content, prompt),
    };
  }

  private selectRepresentativeFunctions(file: SourceFile, count: number): Function[] {
    // Select diverse sample: largest, most complex, most called, typical
    const functions = file.functions;

    const samples = [
      ...functions.sort((a, b) => b.linesOfCode - a.linesOfCode).slice(0, 2), // 2 largest
      ...functions.sort((a, b) => b.complexity - a.complexity).slice(0, 2),   // 2 most complex
      ...functions.filter(f => f.isExported).slice(0, 1), // 1 public API
    ];

    // Remove duplicates
    return [...new Set(samples)].slice(0, count);
  }
}
```

### Component 4: Failover & Load Balancing

```typescript
class LLMProviderManager {
  private providers: Map<LLMProvider, ProviderClient>;
  private healthStatus: Map<LLMProvider, HealthStatus>;
  private rateLimits: Map<LLMProvider, RateLimiter>;

  async routeRequest(request: LLMRequest): Promise<LLMResponse> {
    const primaryProvider = this.selectProvider(request.task);

    try {
      // Check rate limits
      if (!this.rateLimits.get(primaryProvider).allowRequest()) {
        throw new Error(`Rate limit exceeded for ${primaryProvider}`);
      }

      // Try primary provider
      const response = await this.sendRequest(primaryProvider, request);

      // Track usage
      this.trackUsage(primaryProvider, request, response);

      return response;

    } catch (error) {
      // Failover to secondary provider
      console.warn(`Primary provider ${primaryProvider} failed:`, error.message);

      const fallbackProvider = this.selectFallbackProvider(primaryProvider, request);

      if (!fallbackProvider) {
        throw new Error('All LLM providers unavailable');
      }

      console.log(`Failing over to ${fallbackProvider}`);

      const response = await this.sendRequest(fallbackProvider, request);
      this.trackUsage(fallbackProvider, request, response);

      return response;
    }
  }

  private selectFallbackProvider(
    failed: LLMProvider,
    request: LLMRequest
  ): LLMProvider | null {
    // Fallback hierarchy
    const fallbackMap: Record<LLMProvider, LLMProvider[]> = {
      [LLMProvider.CLAUDE_OPUS]: [
        LLMProvider.GPT4_TURBO,
        LLMProvider.CLAUDE_SONNET,
      ],
      [LLMProvider.CLAUDE_SONNET]: [
        LLMProvider.GPT4_TURBO,
        LLMProvider.CLAUDE_HAIKU,
      ],
      [LLMProvider.CLAUDE_HAIKU]: [
        LLMProvider.GPT4O_MINI,
        LLMProvider.GEMINI_FLASH,
      ],
      [LLMProvider.GPT4_TURBO]: [
        LLMProvider.CLAUDE_SONNET,
        LLMProvider.CLAUDE_OPUS,
      ],
      [LLMProvider.GPT4O_MINI]: [
        LLMProvider.CLAUDE_HAIKU,
        LLMProvider.GEMINI_FLASH,
      ],
      [LLMProvider.GEMINI_FLASH]: [
        LLMProvider.CLAUDE_HAIKU,
        LLMProvider.GPT4O_MINI,
      ],
    };

    const fallbacks = fallbackMap[failed] || [];

    // Find first healthy fallback
    for (const fallback of fallbacks) {
      if (this.isHealthy(fallback) && this.rateLimits.get(fallback).allowRequest()) {
        return fallback;
      }
    }

    return null;
  }

  private async sendRequest(
    provider: LLMProvider,
    request: LLMRequest
  ): Promise<LLMResponse> {
    const client = this.providers.get(provider);
    const startTime = Date.now();

    try {
      const response = await client.complete({
        model: provider,
        messages: [{ role: 'user', content: request.prompt }],
        temperature: request.temperature || 0,
        max_tokens: request.maxTokens || 4096,
      });

      const duration = Date.now() - startTime;

      // Update health status
      this.healthStatus.set(provider, {
        healthy: true,
        lastSuccessfulRequest: new Date(),
        averageLatency: this.updateAverageLatency(provider, duration),
      });

      return {
        content: response.content[0].text,
        model: provider,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        },
        cost: this.calculateCost(provider, response.usage),
      };

    } catch (error) {
      // Update health status
      this.healthStatus.set(provider, {
        healthy: false,
        lastError: error.message,
        lastFailedRequest: new Date(),
      });

      throw error;
    }
  }
}
```

### Component 5: Cost Tracking & Budgeting

```typescript
class CostTracker {
  async trackUsage(
    provider: LLMProvider,
    request: LLMRequest,
    response: LLMResponse
  ): Promise<void> {
    const cost = this.calculateCost(provider, response.usage);

    await this.db.llmUsage.create({
      data: {
        provider,
        model: provider,
        taskType: request.task.type,
        inputTokens: response.usage.inputTokens,
        outputTokens: response.usage.outputTokens,
        totalCost: cost,
        cached: false,
        timestamp: new Date(),
        customerId: request.customerId,
      },
    });

    // Check budget alerts
    await this.checkBudgetAlerts(request.customerId);
  }

  private calculateCost(provider: LLMProvider, usage: TokenUsage): number {
    // Pricing per 1M tokens (as of 2026-01)
    const pricing: Record<LLMProvider, { input: number; output: number }> = {
      [LLMProvider.CLAUDE_OPUS]: { input: 15, output: 75 },
      [LLMProvider.CLAUDE_SONNET]: { input: 3, output: 15 },
      [LLMProvider.CLAUDE_HAIKU]: { input: 0.80, output: 4 },
      [LLMProvider.GPT4_TURBO]: { input: 10, output: 30 },
      [LLMProvider.GPT4O_MINI]: { input: 0.15, output: 0.60 },
      [LLMProvider.GEMINI_FLASH]: { input: 0.10, output: 0.30 },
      [LLMProvider.QWEN_SELF_HOSTED]: { input: 0.20, output: 0.20 },
    };

    const price = pricing[provider];

    const inputCost = (usage.inputTokens / 1_000_000) * price.input;
    const outputCost = (usage.outputTokens / 1_000_000) * price.output;

    return inputCost + outputCost;
  }

  async generateCostReport(customerId: string, period: DateRange): Promise<CostReport> {
    const usage = await this.db.llmUsage.findMany({
      where: {
        customerId,
        timestamp: {
          gte: period.start,
          lte: period.end,
        },
      },
    });

    const totalCost = usage.reduce((sum, u) => sum + u.totalCost, 0);
    const totalTokens = usage.reduce(
      (sum, u) => sum + u.inputTokens + u.outputTokens,
      0
    );

    const byProvider = this.groupBy(usage, 'provider');
    const byTaskType = this.groupBy(usage, 'taskType');

    return {
      totalCost,
      totalTokens,
      averageCostPerRequest: totalCost / usage.length,
      breakdown: {
        byProvider: Object.entries(byProvider).map(([provider, records]) => ({
          provider,
          cost: records.reduce((sum, r) => sum + r.totalCost, 0),
          requests: records.length,
        })),
        byTaskType: Object.entries(byTaskType).map(([type, records]) => ({
          type,
          cost: records.reduce((sum, r) => sum + r.totalCost, 0),
          requests: records.length,
        })),
      },
      savings: {
        fromCaching: await this.calculateCachingSavings(customerId, period),
        fromOptimization: await this.calculateOptimizationSavings(customerId, period),
      },
    };
  }

  private async checkBudgetAlerts(customerId: string): Promise<void> {
    const monthToDate = await this.getMonthToDateCost(customerId);
    const customer = await this.db.customers.findUnique({
      where: { id: customerId },
      select: { llmBudget: true, email: true },
    });

    if (!customer.llmBudget) return;

    // Alert at 80% of budget
    if (monthToDate >= customer.llmBudget * 0.8) {
      await this.alertService.send({
        to: customer.email,
        subject: 'LLM Budget Alert: 80% Consumed',
        body: `You've used $${monthToDate.toFixed(2)} of your $${customer.llmBudget} monthly LLM budget.`,
      });
    }

    // Throttle at 100% of budget
    if (monthToDate >= customer.llmBudget) {
      await this.db.customers.update({
        where: { id: customerId },
        data: { llmThrottled: true },
      });

      await this.alertService.send({
        to: customer.email,
        subject: 'LLM Budget Exceeded - Throttling Enabled',
        body: `Your LLM budget has been exceeded. Upgrade your plan to continue.`,
      });
    }
  }
}
```

### Cost Optimization Results

**Before Optimization:**
- Average cost per repository: $10
- Monthly cost for 1,000 customers (20 repos each): $200,000
- Gross margin at $99/month: -102% (losing money)

**After Optimization:**
```typescript
interface CostBreakdown {
  // 80% cache hit rate
  cacheSavings: 0.80; // 80% of requests cached

  // Remaining 20% with intelligent routing
  llamaUsage: {
    critical: 0.02,     // 2% use Claude Opus ($15 input)
    complex: 0.05,      // 5% use Claude Sonnet ($3 input)
    medium: 0.08,       // 8% use Haiku/GPT-4o-mini ($0.80 input)
    simple: 0.05,       // 5% use Gemini Flash ($0.10 input)
  };

  // Prompt optimization
  promptReduction: 0.50; // 50% fewer tokens

  // Result:
  averageCostPerRepo: 0.50; // $0.50 (95% reduction)
  monthlyCogsFor1000Customers: 10000; // $10,000 (90% reduction)
  grossMarginAt99PerMonth: 0.90; // 90% gross margin
}
```

---

## Consequences

### Positive

1. **Sustainable Economics:** 90% gross margin enables profitability at scale
2. **Reliability:** Multi-provider failover ensures 99.9% uptime
3. **Performance:** Caching provides sub-second response for 80% of requests
4. **Scalability:** Can support 100K+ customers without manual intervention
5. **Flexibility:** Easy to add new providers or adjust routing logic

### Negative

1. **Complexity:** Managing 4-5 providers adds operational overhead
2. **Quality Variance:** Different models may produce slightly different outputs
3. **Cache Staleness:** Cached responses may not reflect latest model improvements
4. **Vendor Risk:** Still dependent on external API providers

### Trade-offs

- **Cost vs. Quality:** Use cheaper models for simple tasks, premium for critical
- **Speed vs. Freshness:** Cache aggressively but accept staleness
- **Reliability vs. Complexity:** Multi-provider adds complexity but improves uptime

---

## Implementation Plan

### Phase 1: Multi-Provider Integration (Week 1-2)
- Integrate Anthropic Claude (Opus, Sonnet, Haiku)
- Integrate OpenAI GPT-4.5 Turbo & GPT-4o-mini
- Integrate Google Gemini 2.0 Flash
- Build provider abstraction layer

### Phase 2: Intelligent Routing (Week 3)
- Implement task complexity assessment
- Build routing logic
- Add failover mechanism
- Test with production traffic (10% canary)

### Phase 3: Caching Infrastructure (Week 4-5)
- Set up Redis cluster for caching
- Implement cache key generation
- Add semantic similarity search (vector DB)
- Monitor cache hit rates

### Phase 4: Prompt Optimization (Week 6)
- Refactor prompts to use structured data
- Implement sample selection logic
- Add prompt compression
- Measure token reduction

### Phase 5: Cost Tracking & Budgeting (Week 7)
- Build cost tracking database
- Implement real-time cost monitoring
- Add budget alerts
- Create cost dashboard

### Phase 6: Self-Hosted Option (Week 8-10)
- Set up self-hosted Qwen 2.5 72B (GPU cluster)
- Implement EU data residency routing
- Test quality vs. cloud models
- Offer as premium add-on ($499/month)

---

## Alternatives Considered

### Alternative 1: Single Provider (Anthropic Only)
**Pros:** Simple, consistent quality
**Cons:** Vendor lock-in, no failover, high cost, rate limit issues

### Alternative 2: Self-Hosted Only
**Pros:** Lowest cost ($0.20 per 1M tokens), data privacy
**Cons:** High infrastructure cost, maintenance burden, lower quality

### Alternative 3: No Caching
**Pros:** Always fresh results
**Cons:** 5x higher costs, slower responses

---

## Monitoring & Alerting

```typescript
interface LLMMetrics {
  // Cost metrics
  totalCostToday: number;
  costPerCustomer: number;
  costByProvider: Record<LLMProvider, number>;

  // Performance metrics
  averageLatency: number;
  p95Latency: number;
  cacheHitRate: number;

  // Reliability metrics
  providerUptime: Record<LLMProvider, number>;
  failoverRate: number;
  errorRate: number;

  // Quality metrics
  averageResponseQuality: number; // User ratings
  transformationSuccessRate: number;
}
```

**Alerts:**
- Cost exceeds $500/day → Notify finance team
- Cache hit rate <70% → Investigate cache invalidation
- Provider downtime >5 min → Auto-failover + alert on-call
- Error rate >5% → Alert engineering team

---

## References

- [Anthropic Pricing](https://www.anthropic.com/pricing)
- [OpenAI Pricing](https://openai.com/pricing)
- [Google Gemini Pricing](https://ai.google.dev/pricing)
- [Prompt Engineering Guide](https://www.promptingguide.ai/)
- [Token Optimization Strategies](https://platform.openai.com/docs/guides/prompt-engineering)
- [LLM Caching Best Practices](https://redis.io/solutions/ai/)

---

**Decision Maker:** CTO + CFO + Head of AI
**Approved By:** Executive Team
**Implementation Owner:** AI/ML Engineering + Infrastructure Team
