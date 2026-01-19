# Feature: LLM Provider Integration

**Feature ID:** FF-004
**Version:** 1.0
**Status:** Draft
**Owner:** Engineering Team

---

## Overview

Multi-provider LLM integration with intelligent routing, cost optimization, fallback handling, and support for cloud (Anthropic, OpenAI) and self-hosted (vLLM, Ollama) models. This ensures flexibility, reliability, and cost control.

### User Story
> As a **platform operator**, I want to **integrate multiple LLM providers with intelligent routing** so that **we can optimize costs, ensure reliability, and support air-gapped deployments**.

### Success Criteria
- ✓ Sub-500ms routing decision time
- ✓ 99.9% uptime with automatic failover
- ✓ 30%+ cost savings through intelligent routing
- ✓ Support for air-gapped deployments

---

## Vertical Slice Architecture

### 1. Database Schema

```sql
-- LLM provider configurations
CREATE TABLE llm_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL, -- 'anthropic', 'openai', 'self-hosted'
  provider_type VARCHAR(50) NOT NULL CHECK (provider_type IN (
    'anthropic', 'openai', 'azure_openai', 'self_hosted'
  )),

  -- Configuration
  config JSONB NOT NULL DEFAULT '{
    "baseUrl": null,
    "models": [],
    "rateLimits": {
      "requestsPerMinute": 500,
      "tokensPerMinute": 100000
    }
  }'::jsonb,

  -- Credentials (encrypted)
  api_key_encrypted TEXT,

  -- Status
  is_enabled BOOLEAN DEFAULT TRUE,
  is_default BOOLEAN DEFAULT FALSE,
  priority INTEGER DEFAULT 100, -- Lower = higher priority

  -- Health tracking
  last_health_check_at TIMESTAMPTZ,
  health_status VARCHAR(20) DEFAULT 'unknown' CHECK (health_status IN (
    'healthy', 'degraded', 'unhealthy', 'unknown'
  )),
  consecutive_failures INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ensure only one default per organization
  UNIQUE(organization_id, is_default) WHERE is_default = TRUE
);

CREATE INDEX idx_llm_providers_org ON llm_providers(organization_id, is_enabled);

-- LLM models available from providers
CREATE TABLE llm_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES llm_providers(id) ON DELETE CASCADE,
  model_name VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) NOT NULL,

  -- Model capabilities
  context_window INTEGER NOT NULL,
  max_output_tokens INTEGER NOT NULL,
  supports_function_calling BOOLEAN DEFAULT FALSE,
  supports_streaming BOOLEAN DEFAULT TRUE,

  -- Pricing (per million tokens)
  input_price_per_1m_tokens DECIMAL(10, 4) NOT NULL,
  output_price_per_1m_tokens DECIMAL(10, 4) NOT NULL,

  -- Performance characteristics
  avg_latency_ms INTEGER, -- Average time to first token
  tokens_per_second INTEGER, -- Throughput

  -- Use case mappings
  best_for TEXT[], -- ['code_analysis', 'test_generation', 'documentation']

  is_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(provider_id, model_name)
);

CREATE INDEX idx_llm_models_provider ON llm_models(provider_id, is_enabled);

-- LLM requests log
CREATE TABLE llm_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  provider_id UUID NOT NULL REFERENCES llm_providers(id),
  model_id UUID NOT NULL REFERENCES llm_models(id),

  -- Request details
  task_type VARCHAR(100) NOT NULL, -- 'code_analysis', 'refactoring', 'test_generation'
  prompt_tokens INTEGER NOT NULL,
  completion_tokens INTEGER NOT NULL,
  total_tokens INTEGER NOT NULL,

  -- Cost tracking
  input_cost DECIMAL(10, 6) NOT NULL,
  output_cost DECIMAL(10, 6) NOT NULL,
  total_cost DECIMAL(10, 6) NOT NULL,

  -- Performance
  latency_ms INTEGER NOT NULL,
  time_to_first_token_ms INTEGER,

  -- Status
  status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'error', 'timeout')),
  error_message TEXT,

  -- Caching
  cache_hit BOOLEAN DEFAULT FALSE,

  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_llm_requests_org_time ON llm_requests(organization_id, requested_at DESC);
CREATE INDEX idx_llm_requests_status ON llm_requests(status, requested_at DESC) WHERE status = 'error';

-- Prompt templates
CREATE TABLE prompt_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  task_type VARCHAR(100) NOT NULL,

  template TEXT NOT NULL,
  variables JSONB DEFAULT '[]'::jsonb, -- Array of variable names

  -- Model-specific variations
  model_overrides JSONB DEFAULT '{}'::jsonb,

  is_public BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES users(id),
  version INTEGER DEFAULT 1,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(name, version)
);

CREATE INDEX idx_prompt_templates_task ON prompt_templates(task_type, is_public);

-- Response cache
CREATE TABLE llm_response_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key VARCHAR(64) NOT NULL UNIQUE, -- SHA256 of prompt + model + params

  prompt_hash VARCHAR(64) NOT NULL,
  model_name VARCHAR(255) NOT NULL,
  response TEXT NOT NULL,

  tokens INTEGER NOT NULL,
  cost DECIMAL(10, 6) NOT NULL,

  hit_count INTEGER DEFAULT 0,
  last_hit_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL -- TTL: 7 days
);

CREATE INDEX idx_cache_expires ON llm_response_cache(expires_at);
CREATE INDEX idx_cache_prompt ON llm_response_cache(prompt_hash);
```

### 2. API Endpoints

```typescript
// types/llm.ts
export interface LLMProvider {
  id: string;
  name: string;
  providerType: 'anthropic' | 'openai' | 'azure_openai' | 'self_hosted';
  config: {
    baseUrl?: string;
    models: string[];
    rateLimits: {
      requestsPerMinute: number;
      tokensPerMinute: number;
    };
  };
  isEnabled: boolean;
  isDefault: boolean;
  priority: number;
  healthStatus: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
}

export interface LLMModel {
  id: string;
  providerId: string;
  modelName: string;
  displayName: string;
  contextWindow: number;
  maxOutputTokens: number;
  supportsFunctionCalling: boolean;
  inputPricePer1MTokens: number;
  outputPricePer1MTokens: number;
  bestFor: string[];
  isEnabled: boolean;
}

export interface LLMCompletionRequest {
  taskType: string;
  prompt: string;
  model?: string; // Optional - will auto-select if not provided
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
}

export interface LLMCompletionResponse {
  id: string;
  content: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  cost: {
    input: number;
    output: number;
    total: number;
  };
  performance: {
    latencyMs: number;
    timeToFirstTokenMs?: number;
  };
  cacheHit: boolean;
}

export interface PromptTemplate {
  id: string;
  name: string;
  taskType: string;
  template: string;
  variables: string[];
}
```

```typescript
// routes/llm.ts
import { FastifyInstance } from 'fastify';
import { z } from 'zod';

const CompletionRequestSchema = z.object({
  taskType: z.string(),
  prompt: z.string().min(1),
  model: z.string().optional(),
  maxTokens: z.number().min(1).max(8192).optional(),
  temperature: z.number().min(0).max(2).optional(),
  stream: z.boolean().optional(),
});

export async function llmRoutes(fastify: FastifyInstance) {

  // Request completion
  fastify.post<{
    Body: LLMCompletionRequest;
  }>('/api/v1/llm/completion', {
    schema: {
      body: CompletionRequestSchema,
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { taskType, prompt, model, maxTokens, temperature, stream } = request.body;

    // Check cache first
    const cacheKey = fastify.llm.computeCacheKey(prompt, model, { maxTokens, temperature });
    const cached = await fastify.llm.getFromCache(cacheKey);

    if (cached) {
      return {
        ...cached,
        cacheHit: true,
      };
    }

    // Select best provider/model
    const selectedModel = model
      ? await fastify.llm.getModel(model)
      : await fastify.llm.selectModel(taskType, prompt.length);

    if (!selectedModel) {
      return reply.code(400).send({
        error: 'No available model for this request',
      });
    }

    // Execute request with retry logic
    const startTime = Date.now();
    let timeToFirstToken: number | undefined;

    const response = await fastify.llm.complete({
      provider: selectedModel.provider,
      model: selectedModel.modelName,
      prompt,
      maxTokens: maxTokens || 4096,
      temperature: temperature || 0.7,
      stream,
      onFirstToken: () => {
        timeToFirstToken = Date.now() - startTime;
      },
    });

    const endTime = Date.now();

    // Calculate cost
    const cost = {
      input: (response.usage.promptTokens / 1_000_000) * selectedModel.inputPricePer1MTokens,
      output: (response.usage.completionTokens / 1_000_000) * selectedModel.outputPricePer1MTokens,
      total: 0,
    };
    cost.total = cost.input + cost.output;

    // Log request
    await fastify.db.llmRequest.create({
      data: {
        organizationId: request.user.organizationId,
        providerId: selectedModel.providerId,
        modelId: selectedModel.id,
        taskType,
        promptTokens: response.usage.promptTokens,
        completionTokens: response.usage.completionTokens,
        totalTokens: response.usage.totalTokens,
        inputCost: cost.input,
        outputCost: cost.output,
        totalCost: cost.total,
        latencyMs: endTime - startTime,
        timeToFirstTokenMs: timeToFirstToken,
        status: 'success',
      },
    });

    // Cache response
    await fastify.llm.cacheResponse(cacheKey, response, cost.total);

    return {
      id: response.id,
      content: response.content,
      model: selectedModel.modelName,
      usage: response.usage,
      cost,
      performance: {
        latencyMs: endTime - startTime,
        timeToFirstTokenMs: timeToFirstToken,
      },
      cacheHit: false,
    };
  });

  // List providers
  fastify.get('/api/v1/llm/providers', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const providers = await fastify.db.llmProvider.findMany({
      where: {
        organizationId: request.user.organizationId,
        isEnabled: true,
      },
      orderBy: { priority: 'asc' },
    });

    return providers;
  });

  // Add provider
  fastify.post<{
    Body: {
      name: string;
      providerType: string;
      config: Record<string, any>;
      apiKey?: string;
    };
  }>('/api/v1/llm/providers', {
    preHandler: [fastify.authenticate, fastify.authorize(['settings:write'])],
  }, async (request, reply) => {
    const { name, providerType, config, apiKey } = request.body;

    const provider = await fastify.db.llmProvider.create({
      data: {
        organizationId: request.user.organizationId,
        name,
        providerType,
        config,
        apiKeyEncrypted: apiKey ? await fastify.encrypt(apiKey) : null,
      },
    });

    // Fetch available models
    await fastify.llm.syncModels(provider.id);

    return provider;
  });

  // Health check provider
  fastify.post<{
    Params: { providerId: string };
  }>('/api/v1/llm/providers/:providerId/health-check', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { providerId } = request.params;

    const health = await fastify.llm.checkHealth(providerId);

    await fastify.db.llmProvider.update({
      where: { id: providerId },
      data: {
        lastHealthCheckAt: new Date(),
        healthStatus: health.status,
        consecutiveFailures: health.status === 'healthy' ? 0 : undefined,
      },
    });

    return health;
  });

  // Get usage statistics
  fastify.get<{
    Querystring: {
      startDate: string;
      endDate: string;
      groupBy?: 'day' | 'week' | 'month' | 'model' | 'task';
    };
  }>('/api/v1/llm/usage', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { startDate, endDate, groupBy = 'day' } = request.query;

    const stats = await fastify.db.$queryRaw`
      SELECT
        DATE_TRUNC(${groupBy}, requested_at) AS period,
        COUNT(*) AS request_count,
        SUM(prompt_tokens) AS total_prompt_tokens,
        SUM(completion_tokens) AS total_completion_tokens,
        SUM(total_cost) AS total_cost,
        AVG(latency_ms) AS avg_latency_ms
      FROM llm_requests
      WHERE organization_id = ${request.user.organizationId}
        AND requested_at BETWEEN ${startDate} AND ${endDate}
      GROUP BY period
      ORDER BY period DESC
    `;

    return stats;
  });

  // List prompt templates
  fastify.get<{
    Querystring: { taskType?: string };
  }>('/api/v1/llm/templates', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { taskType } = request.query;

    const templates = await fastify.db.promptTemplate.findMany({
      where: {
        isPublic: true,
        ...(taskType && { taskType }),
      },
      orderBy: { name: 'asc' },
    });

    return templates;
  });

  // Render template
  fastify.post<{
    Body: {
      templateId: string;
      variables: Record<string, any>;
    };
  }>('/api/v1/llm/templates/render', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { templateId, variables } = request.body;

    const template = await fastify.db.promptTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      return reply.code(404).send({ error: 'Template not found' });
    }

    // Simple template rendering (replace {{variable}} with values)
    let rendered = template.template;
    for (const [key, value] of Object.entries(variables)) {
      rendered = rendered.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
    }

    return { rendered };
  });
}
```

### 3. LLM Service Implementation

```typescript
// services/llm-service.ts
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import crypto from 'crypto';

export class LLMService {
  private providers: Map<string, any> = new Map();
  private cache: LRUCache<string, any>;

  constructor(
    private db: Database,
    private redis: Redis,
  ) {
    this.cache = new LRUCache({ max: 1000 });
  }

  async selectModel(taskType: string, promptLength: number): Promise<LLMModel | null> {
    // Get all available models
    const models = await this.db.llmModel.findMany({
      where: {
        isEnabled: true,
        provider: {
          isEnabled: true,
          healthStatus: { in: ['healthy', 'degraded'] },
        },
      },
      include: { provider: true },
      orderBy: { provider: { priority: 'asc' } },
    });

    // Filter by context window
    const validModels = models.filter(m =>
      m.contextWindow >= promptLength + 4096 // prompt + max output
    );

    if (validModels.length === 0) {
      return null;
    }

    // Score models based on task type
    const scored = validModels.map(model => {
      let score = 0;

      // Best for task type
      if (model.bestFor.includes(taskType)) {
        score += 10;
      }

      // Provider priority
      score += (100 - model.provider.priority) / 10;

      // Cost efficiency (lower is better)
      const avgCost = (model.inputPricePer1MTokens + model.outputPricePer1MTokens) / 2;
      score -= avgCost / 10;

      // Performance
      if (model.avgLatencyMs) {
        score += (1000 - model.avgLatencyMs) / 100;
      }

      return { model, score };
    });

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    return scored[0].model;
  }

  async complete(params: {
    provider: LLMProvider;
    model: string;
    prompt: string;
    maxTokens: number;
    temperature: number;
    stream?: boolean;
    onFirstToken?: () => void;
  }): Promise<any> {
    const { provider, model, prompt, maxTokens, temperature, stream, onFirstToken } = params;

    try {
      switch (provider.providerType) {
        case 'anthropic':
          return await this.completeAnthropic(provider, model, prompt, maxTokens, temperature, stream, onFirstToken);
        case 'openai':
          return await this.completeOpenAI(provider, model, prompt, maxTokens, temperature, stream, onFirstToken);
        case 'self_hosted':
          return await this.completeSelfHosted(provider, model, prompt, maxTokens, temperature);
        default:
          throw new Error(`Unsupported provider: ${provider.providerType}`);
      }
    } catch (error) {
      // Update failure count
      await this.db.llmProvider.update({
        where: { id: provider.id },
        data: {
          consecutiveFailures: { increment: 1 },
          healthStatus: 'unhealthy',
        },
      });

      // Try fallback provider
      const fallback = await this.getFallbackProvider(provider);
      if (fallback) {
        return await this.complete({
          ...params,
          provider: fallback,
        });
      }

      throw error;
    }
  }

  private async completeAnthropic(
    provider: LLMProvider,
    model: string,
    prompt: string,
    maxTokens: number,
    temperature: number,
    stream?: boolean,
    onFirstToken?: () => void,
  ): Promise<any> {
    const apiKey = await this.decrypt(provider.apiKeyEncrypted);
    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      temperature,
      messages: [{ role: 'user', content: prompt }],
      stream,
    });

    if (stream) {
      // Handle streaming
      let firstToken = false;
      let content = '';

      for await (const event of response) {
        if (event.type === 'content_block_delta') {
          if (!firstToken) {
            onFirstToken?.();
            firstToken = true;
          }
          content += event.delta.text;
        }
      }

      return {
        id: response.id,
        content,
        usage: response.usage,
      };
    }

    return {
      id: response.id,
      content: response.content[0].type === 'text' ? response.content[0].text : '',
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
    };
  }

  private async completeOpenAI(
    provider: LLMProvider,
    model: string,
    prompt: string,
    maxTokens: number,
    temperature: number,
    stream?: boolean,
    onFirstToken?: () => void,
  ): Promise<any> {
    const apiKey = await this.decrypt(provider.apiKeyEncrypted);
    const client = new OpenAI({ apiKey });

    const response = await client.chat.completions.create({
      model,
      max_tokens: maxTokens,
      temperature,
      messages: [{ role: 'user', content: prompt }],
      stream,
    });

    if (stream) {
      let firstToken = false;
      let content = '';

      for await (const chunk of response) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          if (!firstToken) {
            onFirstToken?.();
            firstToken = true;
          }
          content += delta;
        }
      }

      return {
        id: response.id,
        content,
        usage: response.usage,
      };
    }

    return {
      id: response.id,
      content: response.choices[0].message.content,
      usage: {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
      },
    };
  }

  private async completeSelfHosted(
    provider: LLMProvider,
    model: string,
    prompt: string,
    maxTokens: number,
    temperature: number,
  ): Promise<any> {
    // vLLM OpenAI-compatible API
    const response = await fetch(`${provider.config.baseUrl}/v1/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        max_tokens: maxTokens,
        temperature,
      }),
    });

    const data = await response.json();

    return {
      id: data.id,
      content: data.choices[0].text,
      usage: {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      },
    };
  }

  computeCacheKey(prompt: string, model: string | undefined, params: any): string {
    const data = JSON.stringify({ prompt, model, params });
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  async getFromCache(cacheKey: string): Promise<any | null> {
    // Check memory cache first
    const memCached = this.cache.get(cacheKey);
    if (memCached) return memCached;

    // Check database
    const cached = await this.db.llmResponseCache.findUnique({
      where: { cacheKey },
    });

    if (cached && cached.expiresAt > new Date()) {
      // Update hit count
      await this.db.llmResponseCache.update({
        where: { id: cached.id },
        data: {
          hitCount: { increment: 1 },
          lastHitAt: new Date(),
        },
      });

      const result = {
        content: cached.response,
        usage: { totalTokens: cached.tokens },
        cost: { total: Number(cached.cost) },
      };

      this.cache.set(cacheKey, result);
      return result;
    }

    return null;
  }

  async cacheResponse(cacheKey: string, response: any, cost: number): Promise<void> {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await this.db.llmResponseCache.create({
      data: {
        cacheKey,
        promptHash: cacheKey.substring(0, 64),
        modelName: response.model || 'unknown',
        response: response.content,
        tokens: response.usage.totalTokens,
        cost,
        expiresAt,
      },
    });

    this.cache.set(cacheKey, response);
  }

  async checkHealth(providerId: string): Promise<{ status: string; latencyMs: number }> {
    const provider = await this.db.llmProvider.findUnique({
      where: { id: providerId },
    });

    if (!provider) {
      throw new Error('Provider not found');
    }

    const startTime = Date.now();

    try {
      await this.complete({
        provider,
        model: provider.config.models[0],
        prompt: 'Hello',
        maxTokens: 10,
        temperature: 0,
      });

      return {
        status: 'healthy',
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        latencyMs: Date.now() - startTime,
      };
    }
  }
}
```

---

## Implementation Plan

- **Week 1:** Core service + Anthropic integration
- **Week 2:** OpenAI + routing logic
- **Week 3:** Self-hosted support (vLLM)
- **Week 4:** Caching + optimization

---

**Status:** Ready for implementation
