# ADR-011: Agent Management and Orchestration

## Status
Accepted

## Context
Forge Factory's core value proposition is AI-powered code analysis and automation through intelligent agents. We need:
- Multi-provider LLM support (Anthropic Claude, OpenAI, custom models)
- Agent types for different tasks (analysis, refactoring, testing, documentation)
- Agent orchestration and chaining
- Real-time monitoring and debugging
- Cost tracking and optimization
- Rate limiting and quotas
- Agent templates and customization
- Integration with workflows and tasks

## Decision
We will build a **flexible agent management system** with support for multiple LLM providers, custom agent types, and sophisticated orchestration capabilities.

### Agent System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                Agent Management Architecture                  │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Agent UI Layer                                        │ │
│  │  - Agent Catalog                                       │ │
│  │  - Agent Configuration                                 │ │
│  │  - Execution Monitor (real-time)                       │ │
│  │  - Conversation History                                │ │
│  └────────────────────────────────────────────────────────┘ │
│                         ↓                                     │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Agent Orchestration Layer                             │ │
│  │  - Agent Executor Service                              │ │
│  │  - Context Manager                                     │ │
│  │  - Chain Coordinator                                   │ │
│  │  - State Manager                                       │ │
│  └────────────────────────────────────────────────────────┘ │
│                         ↓                                     │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  LLM Provider Abstraction                              │ │
│  │  - Anthropic Claude                                    │ │
│  │  - OpenAI GPT                                          │ │
│  │  - Custom Models                                       │ │
│  │  - Provider Router (cost optimization)                 │ │
│  └────────────────────────────────────────────────────────┘ │
│                         ↓                                     │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Tool Integration Layer                                │ │
│  │  - Code Analysis Tools                                 │ │
│  │  - Repository Access                                   │ │
│  │  - Test Runners                                        │ │
│  │  - Documentation Generators                            │ │
│  └────────────────────────────────────────────────────────┘ │
│                         ↓                                     │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Storage & Analytics                                   │ │
│  │  - Agent Definitions                                   │ │
│  │  - Execution History                                   │ │
│  │  - Cost Tracking                                       │ │
│  │  - Performance Metrics                                 │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

## Implementation

### 1. Agent Data Model

```prisma
// packages/prisma/schema.prisma

model Agent {
  id              String   @id @default(cuid())
  tenantId        String

  // Metadata
  name            String
  description     String?
  type            AgentType
  category        AgentCategory

  // Configuration
  provider        LLMProvider
  model           String   // e.g., "claude-opus-4", "gpt-4"
  systemPrompt    String   @db.Text
  temperature     Float    @default(0.7)
  maxTokens       Int      @default(4000)

  // Tools (function calling)
  availableTools  String[] // Tool IDs
  toolConfig      Json?

  // Limits
  maxCost         Float?   // Max cost per execution
  timeout         Int      @default(300) // seconds
  retryPolicy     Json?

  // Status
  status          AgentStatus
  version         Int      @default(1)

  // Relations
  creatorId       String
  creator         User     @relation(fields: [creatorId], references: [id])
  executions      AgentExecution[]

  // Templates
  isTemplate      Boolean  @default(false)
  isPublic        Boolean  @default(false)

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([tenantId])
  @@index([type])
  @@index([category])
}

enum AgentType {
  ANALYZER          // Code analysis
  REFACTORER        // Code refactoring
  TEST_GENERATOR    // Test generation
  DOCUMENTER        // Documentation
  REVIEWER          // Code review
  DEBUGGER          // Bug detection
  CUSTOM            // Custom agent
}

enum AgentCategory {
  CORE              // Built-in agents
  COMMUNITY         // Community templates
  CUSTOM            // User-created
}

enum LLMProvider {
  ANTHROPIC
  OPENAI
  CUSTOM
}

enum AgentStatus {
  DRAFT
  ACTIVE
  DEPRECATED
  ARCHIVED
}

model AgentExecution {
  id              String   @id @default(cuid())
  tenantId        String
  agentId         String
  agent           Agent    @relation(fields: [agentId], references: [id])

  // Input
  prompt          String   @db.Text
  context         Json?    // Additional context (files, variables)

  // Execution
  status          ExecutionStatus
  provider        LLMProvider
  model           String

  // Output
  response        String?  @db.Text
  toolCalls       Json?    // Functions called
  reasoning       String?  @db.Text

  // Metrics
  tokensInput     Int?
  tokensOutput    Int?
  cost            Float?   // USD
  latency         Int?     // milliseconds

  // Error handling
  error           String?
  retryCount      Int      @default(0)

  // Audit
  executedBy      String
  user            User     @relation(fields: [executedBy], references: [id])
  workflowId      String?  // If part of workflow
  taskId          String?  // If associated with task

  startedAt       DateTime @default(now())
  completedAt     DateTime?

  // Conversation history (for multi-turn)
  conversationId  String?
  messages        AgentMessage[]

  @@index([tenantId])
  @@index([agentId])
  @@index([status])
  @@index([conversationId])
}

model AgentMessage {
  id              String   @id @default(cuid())
  tenantId        String
  executionId     String
  execution       AgentExecution @relation(fields: [executionId], references: [id], onDelete: Cascade)

  role            MessageRole
  content         String   @db.Text
  toolCalls       Json?    // Function calls in this message
  toolResults     Json?    // Function results

  tokensCount     Int?
  createdAt       DateTime @default(now())

  @@index([tenantId])
  @@index([executionId])
}

enum MessageRole {
  SYSTEM
  USER
  ASSISTANT
  TOOL
}

model AgentTool {
  id              String   @id @default(cuid())
  tenantId        String

  name            String
  description     String
  schema          Json     // JSON Schema for parameters

  // Implementation
  type            ToolType
  implementation  String   @db.Text // Code or config

  // Access
  isPublic        Boolean  @default(false)
  creatorId       String

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([tenantId])
  @@index([name])
}

enum ToolType {
  INTERNAL      // Built-in tool
  API           // HTTP API call
  CODE          // Execute code
  DATABASE      // Database query
}
```

### 2. Agent Executor Service

```typescript
// apps/api/src/modules/agents/agent-executor.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@forge/prisma';
import { AnthropicService } from './providers/anthropic.service';
import { OpenAIService } from './providers/openai.service';
import { ToolExecutor } from './tool-executor.service';
import { EventsGateway } from '@/gateways/events.gateway';

@Injectable()
export class AgentExecutorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly anthropic: AnthropicService,
    private readonly openai: OpenAIService,
    private readonly toolExecutor: ToolExecutor,
    private readonly eventsGateway: EventsGateway,
  ) {}

  async execute(params: {
    tenantId: string;
    agentId: string;
    userId: string;
    prompt: string;
    context?: any;
    conversationId?: string;
  }) {
    const { tenantId, agentId, userId, prompt, context, conversationId } = params;

    // Get agent configuration
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId, tenantId },
      include: {
        executions: {
          where: { conversationId },
          orderBy: { createdAt: 'asc' },
          include: { messages: true },
        },
      },
    });

    if (!agent) {
      throw new Error('Agent not found');
    }

    // Create execution record
    const execution = await this.prisma.agentExecution.create({
      data: {
        tenantId,
        agentId,
        executedBy: userId,
        prompt,
        context,
        conversationId: conversationId || undefined,
        provider: agent.provider,
        model: agent.model,
        status: 'RUNNING',
      },
    });

    // Emit start event
    this.eventsGateway.emitToTenant(tenantId, 'agent:started', {
      executionId: execution.id,
    });

    try {
      // Build message history
      const messages = this.buildMessages(agent, prompt, context);

      // Execute based on provider
      let response: any;
      if (agent.provider === 'ANTHROPIC') {
        response = await this.anthropic.execute({
          model: agent.model,
          systemPrompt: agent.systemPrompt,
          messages,
          temperature: agent.temperature,
          maxTokens: agent.maxTokens,
          tools: await this.loadTools(agent.availableTools),
        });
      } else if (agent.provider === 'OPENAI') {
        response = await this.openai.execute({
          model: agent.model,
          systemPrompt: agent.systemPrompt,
          messages,
          temperature: agent.temperature,
          maxTokens: agent.maxTokens,
          tools: await this.loadTools(agent.availableTools),
        });
      }

      // Handle tool calls
      if (response.toolCalls) {
        const toolResults = await this.executeTools(
          tenantId,
          response.toolCalls,
        );

        // Continue conversation with tool results
        messages.push({
          role: 'assistant',
          content: response.content,
          toolCalls: response.toolCalls,
        });
        messages.push({
          role: 'tool',
          content: JSON.stringify(toolResults),
        });

        // Re-execute with tool results
        response = await this[agent.provider.toLowerCase()].execute({
          model: agent.model,
          systemPrompt: agent.systemPrompt,
          messages,
          temperature: agent.temperature,
          maxTokens: agent.maxTokens,
        });
      }

      // Calculate cost
      const cost = this.calculateCost({
        provider: agent.provider,
        model: agent.model,
        inputTokens: response.tokensInput,
        outputTokens: response.tokensOutput,
      });

      // Update execution
      const completed = await this.prisma.agentExecution.update({
        where: { id: execution.id },
        data: {
          status: 'COMPLETED',
          response: response.content,
          toolCalls: response.toolCalls,
          reasoning: response.reasoning,
          tokensInput: response.tokensInput,
          tokensOutput: response.tokensOutput,
          cost,
          latency: Date.now() - execution.startedAt.getTime(),
          completedAt: new Date(),
        },
      });

      // Save messages
      await this.saveMessages(execution.id, messages, response);

      // Emit completion event
      this.eventsGateway.emitToTenant(tenantId, 'agent:completed', {
        executionId: execution.id,
        response: response.content,
      });

      return completed;
    } catch (error) {
      // Update execution with error
      await this.prisma.agentExecution.update({
        where: { id: execution.id },
        data: {
          status: 'FAILED',
          error: error.message,
          completedAt: new Date(),
        },
      });

      // Emit failure event
      this.eventsGateway.emitToTenant(tenantId, 'agent:failed', {
        executionId: execution.id,
        error: error.message,
      });

      throw error;
    }
  }

  private buildMessages(agent: Agent, prompt: string, context: any) {
    const messages = [];

    // Add context as system message if provided
    if (context) {
      messages.push({
        role: 'system',
        content: `Context: ${JSON.stringify(context)}`,
      });
    }

    // Add user prompt
    messages.push({
      role: 'user',
      content: prompt,
    });

    return messages;
  }

  private async loadTools(toolIds: string[]) {
    const tools = await this.prisma.agentTool.findMany({
      where: { id: { in: toolIds } },
    });

    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.schema,
    }));
  }

  private async executeTools(tenantId: string, toolCalls: any[]) {
    const results = await Promise.all(
      toolCalls.map((call) =>
        this.toolExecutor.execute(tenantId, call.name, call.parameters)
      )
    );

    return results;
  }

  private calculateCost(params: {
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
  }): number {
    // Pricing per 1M tokens (example rates)
    const pricing = {
      'claude-opus-4': { input: 15, output: 75 },
      'claude-sonnet-4': { input: 3, output: 15 },
      'gpt-4': { input: 30, output: 60 },
      'gpt-4-turbo': { input: 10, output: 30 },
    };

    const rates = pricing[params.model] || { input: 0, output: 0 };

    const inputCost = (params.inputTokens / 1_000_000) * rates.input;
    const outputCost = (params.outputTokens / 1_000_000) * rates.output;

    return inputCost + outputCost;
  }
}
```

### 3. Anthropic Provider

```typescript
// apps/api/src/modules/agents/providers/anthropic.service.ts
import { Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';

@Injectable()
export class AnthropicService {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  async execute(params: {
    model: string;
    systemPrompt: string;
    messages: any[];
    temperature: number;
    maxTokens: number;
    tools?: any[];
  }) {
    const response = await this.client.messages.create({
      model: params.model,
      system: params.systemPrompt,
      messages: params.messages,
      temperature: params.temperature,
      max_tokens: params.maxTokens,
      tools: params.tools,
    });

    return {
      content: response.content[0].text,
      toolCalls: response.tool_calls,
      tokensInput: response.usage.input_tokens,
      tokensOutput: response.usage.output_tokens,
      reasoning: response.thinking, // If using extended thinking
    };
  }
}
```

### 4. Agent UI Components

```tsx
// apps/portal/components/agents/agent-catalog.tsx
'use client';

import { useAgents } from '@/hooks/use-agents';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bot, Play } from 'lucide-react';

export function AgentCatalog() {
  const { data: agents = [] } = useAgents();

  return (
    <div className="grid grid-cols-3 gap-4">
      {agents.map((agent) => (
        <Card key={agent.id} className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">{agent.name}</h3>
            </div>
            <Badge>{agent.type}</Badge>
          </div>

          <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
            {agent.description}
          </p>

          <div className="mt-4 flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              {agent.provider} • {agent.model}
            </div>
            <Button size="sm">
              <Play className="h-3 w-3 mr-1" />
              Run
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
```

```tsx
// apps/portal/components/agents/agent-chat.tsx
'use client';

import { useState } from 'react';
import { useAgentExecution } from '@/hooks/use-agents';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Loader2 } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';

export function AgentChat({ agentId }: { agentId: string }) {
  const [prompt, setPrompt] = useState('');
  const [conversationId] = useState(() => `conv-${Date.now()}`);
  const executeAgent = useAgentExecution();

  const handleSend = async () => {
    if (!prompt.trim()) return;

    await executeAgent.mutateAsync({
      agentId,
      prompt,
      conversationId,
    });

    setPrompt('');
  };

  return (
    <Card className="flex flex-col h-[600px]">
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {messages.map((message, i) => (
          <div
            key={i}
            className={`flex gap-3 ${
              message.role === 'user' ? 'flex-row-reverse' : ''
            }`}
          >
            <Avatar>
              {message.role === 'user' ? '👤' : '🤖'}
            </Avatar>
            <div className="flex-1">
              <div
                className={`p-3 rounded-lg ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground ml-auto'
                    : 'bg-muted'
                } max-w-[80%]`}
              >
                {message.content}
              </div>
              {message.toolCalls && (
                <div className="mt-2 text-xs text-muted-foreground">
                  🔧 Used tools: {message.toolCalls.map((t) => t.name).join(', ')}
                </div>
              )}
            </div>
          </div>
        ))}

        {executeAgent.isPending && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Agent is thinking...
          </div>
        )}
      </div>

      <div className="border-t p-4">
        <div className="flex gap-2">
          <Textarea
            placeholder="Ask the agent..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            className="resize-none"
            rows={3}
          />
          <Button
            onClick={handleSend}
            disabled={!prompt.trim() || executeAgent.isPending}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
```

## Agent Types

### 1. Code Analyzer
- Analyzes code quality
- Identifies bugs and vulnerabilities
- Suggests improvements

### 2. Refactorer
- Refactors code for better quality
- Applies design patterns
- Optimizes performance

### 3. Test Generator
- Generates unit tests
- Creates integration tests
- Improves test coverage

### 4. Documenter
- Generates documentation
- Creates README files
- Writes API docs

### 5. Code Reviewer
- Reviews pull requests
- Provides feedback
- Enforces coding standards

## Features

### Multi-Provider Support
- Anthropic Claude (primary)
- OpenAI GPT
- Custom models (self-hosted)
- Automatic failover

### Cost Optimization
- Provider selection based on cost
- Token usage tracking
- Budget limits per agent
- Cost analytics

### Tool Integration
- Function calling support
- Custom tool creation
- Tool chaining
- Sandbox execution

### Agent Chains
- Sequential agent execution
- Conditional branching
- Parallel execution
- Result aggregation

## Consequences

### Positive
- **Flexible**: Support for multiple providers
- **Powerful**: Complex agent workflows
- **Observable**: Comprehensive monitoring
- **Cost-Effective**: Optimization strategies

### Negative
- **Complexity**: Multi-provider management
- **Cost**: LLM API costs can be high

### Mitigations
- **Caching**: Cache agent responses
- **Rate Limiting**: Prevent abuse
- **Cost Tracking**: Monitor and alert

## Alternatives Considered

### 1. Single Provider (Anthropic only)
**Rejected**: Vendor lock-in, no flexibility.

### 2. LangChain
**Partial**: Use concepts, but build custom for control.

### 3. Third-party Agent Platform
**Rejected**: Less control, data privacy concerns.

## References
- [Anthropic Claude API](https://docs.anthropic.com/)
- [OpenAI API](https://platform.openai.com/docs)
- [Function Calling Guide](https://platform.openai.com/docs/guides/function-calling)

## Review Date
2024-05-16 (3 months)
