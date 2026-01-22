# ADR-045: AI Agent Orchestration Patterns

**Status:** Accepted
**Date:** 2026-01-21
**Priority:** P1 - Enterprise Ready
**Complexity:** High

---

## Context

Complex code transformations require **multiple AI agents working together**. A single LLM call cannot analyze a 100K LOC codebase, generate tests, refactor code, and validate changes simultaneously. We need a multi-agent orchestration system.

### Business Requirements

- **Complex Transformations:** Support multi-step transformations across files
- **Parallelization:** Process independent files/modules concurrently
- **Reliability:** Handle agent failures gracefully
- **Observability:** Track agent progress and decisions
- **Cost Control:** Minimize redundant LLM calls
- **Human-in-the-Loop:** Support approval checkpoints

### Agent Types Needed

| Agent | Responsibility | Input | Output |
|-------|---------------|-------|--------|
| Analyzer | Understand code structure | Source files | Analysis report |
| Planner | Create transformation plan | Analysis report | Step-by-step plan |
| Generator | Generate new/modified code | Plan + context | Code changes |
| Reviewer | Review generated code | Code changes | Review feedback |
| Tester | Generate and run tests | Code changes | Test results |
| Validator | Validate transformation | Test results | Validation report |

### Orchestration Challenges

1. **State Management:** Agents need shared context
2. **Error Recovery:** Handle partial failures
3. **Resource Limits:** API rate limits, context windows
4. **Ordering:** Some tasks depend on others
5. **Parallelism:** Balance speed vs. cost
6. **Debugging:** Trace issues across agents

---

## Decision

We will implement a **graph-based agent orchestration system** with:

1. **Agent Registry** - Typed agent definitions
2. **Task Graph** - DAG of dependent tasks
3. **Execution Engine** - Parallel execution with dependencies
4. **State Manager** - Shared context across agents
5. **Checkpoint System** - Persistence and recovery

### Architecture Overview

```typescript
interface AgentOrchestrationSystem {
  // Agent management
  registry: AgentRegistry;

  // Workflow definition
  defineWorkflow(definition: WorkflowDefinition): Workflow;

  // Execution
  executeWorkflow(workflow: Workflow, input: WorkflowInput): Promise<WorkflowResult>;

  // Monitoring
  getWorkflowStatus(workflowId: string): WorkflowStatus;
  getAgentLogs(workflowId: string, agentId: string): AgentLog[];
}

interface Agent {
  id: string;
  name: string;
  description: string;

  // Capabilities
  inputSchema: JSONSchema;
  outputSchema: JSONSchema;

  // Configuration
  model: LLMModel;
  temperature: number;
  maxTokens: number;
  timeout: number;
  retryPolicy: RetryPolicy;

  // Execution
  execute(input: AgentInput, context: AgentContext): Promise<AgentOutput>;
}

interface Workflow {
  id: string;
  name: string;
  description: string;

  agents: Agent[];
  edges: TaskEdge[];  // Dependencies

  checkpoints: Checkpoint[];
  errorHandlers: ErrorHandler[];
}

interface TaskEdge {
  from: string;  // Agent ID
  to: string;    // Agent ID
  condition?: (output: any) => boolean;
  transform?: (output: any) => any;
}
```

### Pattern 1: Sequential Pipeline

For simple transformations with linear dependencies.

```typescript
class SequentialPipeline {
  private agents: Agent[] = [];

  addAgent(agent: Agent): this {
    this.agents.push(agent);
    return this;
  }

  async execute(input: any): Promise<PipelineResult> {
    let currentOutput = input;
    const results: AgentResult[] = [];

    for (const agent of this.agents) {
      try {
        const result = await agent.execute(currentOutput, this.context);
        results.push({ agent: agent.id, output: result, status: 'success' });
        currentOutput = result;
      } catch (error) {
        results.push({ agent: agent.id, error, status: 'error' });
        throw new PipelineError(`Agent ${agent.id} failed`, results);
      }
    }

    return { output: currentOutput, results };
  }
}

// Example: Simple refactoring pipeline
const refactoringPipeline = new SequentialPipeline()
  .addAgent(codeAnalyzerAgent)      // Analyze code structure
  .addAgent(refactoringPlannerAgent) // Plan refactoring steps
  .addAgent(codeGeneratorAgent)      // Generate refactored code
  .addAgent(testGeneratorAgent)      // Generate tests
  .addAgent(validatorAgent);         // Validate changes

await refactoringPipeline.execute({
  files: sourceFiles,
  refactoringType: 'extract-method',
});
```

### Pattern 2: Parallel Fan-Out/Fan-In

For processing multiple files or modules concurrently.

```typescript
class ParallelFanOutFanIn {
  constructor(
    private fanOutAgent: Agent,
    private parallelAgent: Agent,
    private fanInAgent: Agent,
    private concurrency: number = 10
  ) {}

  async execute(input: any): Promise<any> {
    // Fan-out: Split work into chunks
    const fanOutResult = await this.fanOutAgent.execute(input, this.context);
    const chunks = fanOutResult.chunks;

    // Parallel processing with concurrency limit
    const results = await this.processParallel(chunks);

    // Fan-in: Aggregate results
    const fanInResult = await this.fanInAgent.execute(
      { chunks, results },
      this.context
    );

    return fanInResult;
  }

  private async processParallel(chunks: any[]): Promise<any[]> {
    const semaphore = new Semaphore(this.concurrency);

    return Promise.all(
      chunks.map(async (chunk, index) => {
        await semaphore.acquire();
        try {
          return await this.parallelAgent.execute(
            { chunk, index },
            this.context
          );
        } finally {
          semaphore.release();
        }
      })
    );
  }
}

// Example: Repository-wide type annotation
const typeAnnotationWorkflow = new ParallelFanOutFanIn(
  fileSplitterAgent,       // Split repo into files
  typeInferenceAgent,      // Infer types for each file
  typeAggregatorAgent,     // Merge type definitions
  5                        // Process 5 files concurrently
);

await typeAnnotationWorkflow.execute({
  repository: repoPath,
  language: 'python',
});
```

### Pattern 3: DAG-Based Orchestration

For complex workflows with multiple dependencies.

```typescript
class DAGOrchestrator {
  private graph: DirectedAcyclicGraph<Task>;
  private executor: TaskExecutor;
  private stateManager: StateManager;

  constructor(workflow: Workflow) {
    this.graph = this.buildGraph(workflow);
    this.executor = new TaskExecutor(workflow.agents);
    this.stateManager = new StateManager();
  }

  async execute(input: WorkflowInput): Promise<WorkflowResult> {
    const executionId = generateId();
    await this.stateManager.initialize(executionId, input);

    // Get execution order using topological sort
    const executionOrder = this.graph.topologicalSort();

    // Track completed tasks
    const completed = new Set<string>();
    const results = new Map<string, any>();

    // Execute tasks respecting dependencies
    while (completed.size < executionOrder.length) {
      // Find ready tasks (all dependencies completed)
      const readyTasks = executionOrder.filter(task =>
        !completed.has(task.id) &&
        this.graph.getDependencies(task.id).every(dep => completed.has(dep))
      );

      if (readyTasks.length === 0 && completed.size < executionOrder.length) {
        throw new Error('Circular dependency detected');
      }

      // Execute ready tasks in parallel
      await Promise.all(
        readyTasks.map(async task => {
          const dependencies = this.graph.getDependencies(task.id);
          const dependencyOutputs = Object.fromEntries(
            dependencies.map(dep => [dep, results.get(dep)])
          );

          const agent = this.executor.getAgent(task.agentId);
          const result = await agent.execute(
            { ...task.input, ...dependencyOutputs },
            await this.stateManager.getContext(executionId)
          );

          results.set(task.id, result);
          completed.add(task.id);

          // Update state
          await this.stateManager.updateTaskState(executionId, task.id, result);
        })
      );
    }

    return {
      executionId,
      results: Object.fromEntries(results),
      state: await this.stateManager.getFinalState(executionId),
    };
  }

  private buildGraph(workflow: Workflow): DirectedAcyclicGraph<Task> {
    const graph = new DirectedAcyclicGraph<Task>();

    for (const agent of workflow.agents) {
      graph.addNode({
        id: agent.id,
        agentId: agent.id,
        input: {},
      });
    }

    for (const edge of workflow.edges) {
      graph.addEdge(edge.from, edge.to);
    }

    return graph;
  }
}

// Example: Complete transformation workflow
const transformationWorkflow: Workflow = {
  id: 'full-transformation',
  name: 'Full Code Transformation',
  agents: [
    codeAnalyzer,
    dependencyAnalyzer,
    securityScanner,
    transformationPlanner,
    codeGenerator,
    testGenerator,
    codeReviewer,
    validator,
  ],
  edges: [
    { from: 'code-analyzer', to: 'transformation-planner' },
    { from: 'dependency-analyzer', to: 'transformation-planner' },
    { from: 'security-scanner', to: 'transformation-planner' },
    { from: 'transformation-planner', to: 'code-generator' },
    { from: 'code-generator', to: 'test-generator' },
    { from: 'code-generator', to: 'code-reviewer' },
    { from: 'test-generator', to: 'validator' },
    { from: 'code-reviewer', to: 'validator' },
  ],
  checkpoints: [],
  errorHandlers: [],
};
```

### Pattern 4: Hierarchical Agent Teams

For complex reasoning with specialized sub-agents.

```typescript
class HierarchicalAgentTeam {
  constructor(
    private orchestrator: OrchestratorAgent,
    private specialists: Map<string, Agent>,
    private maxIterations: number = 10
  ) {}

  async execute(task: Task): Promise<TeamResult> {
    let iteration = 0;
    let currentState: TeamState = { task, completed: false, results: [] };

    while (!currentState.completed && iteration < this.maxIterations) {
      // Orchestrator decides next action
      const decision = await this.orchestrator.execute({
        task,
        currentState,
        availableSpecialists: Array.from(this.specialists.keys()),
      }, this.context);

      if (decision.action === 'delegate') {
        // Delegate to specialist
        const specialist = this.specialists.get(decision.specialistId);
        if (!specialist) {
          throw new Error(`Unknown specialist: ${decision.specialistId}`);
        }

        const result = await specialist.execute(decision.subtask, this.context);
        currentState.results.push({
          specialist: decision.specialistId,
          subtask: decision.subtask,
          result,
        });
      } else if (decision.action === 'synthesize') {
        // Orchestrator synthesizes final result
        currentState.completed = true;
        currentState.finalResult = decision.synthesis;
      } else if (decision.action === 'clarify') {
        // Need human input
        const clarification = await this.requestHumanInput(decision.question);
        currentState.clarifications = [
          ...(currentState.clarifications || []),
          clarification,
        ];
      }

      iteration++;
    }

    return {
      result: currentState.finalResult,
      iterations: iteration,
      delegations: currentState.results,
    };
  }
}

// Example: Code review team
const codeReviewTeam = new HierarchicalAgentTeam(
  reviewOrchestrator,
  new Map([
    ['security', securityReviewAgent],
    ['performance', performanceReviewAgent],
    ['architecture', architectureReviewAgent],
    ['testing', testCoverageAgent],
    ['style', codeStyleAgent],
  ]),
  5
);

await codeReviewTeam.execute({
  type: 'code-review',
  files: changedFiles,
  context: pullRequestContext,
});
```

### Pattern 5: Reactive Agent Network

For event-driven, autonomous agent behavior.

```typescript
class ReactiveAgentNetwork {
  private agents: Map<string, ReactiveAgent> = new Map();
  private eventBus: EventBus;
  private stateStore: StateStore;

  constructor() {
    this.eventBus = new EventBus();
    this.stateStore = new StateStore();
  }

  registerAgent(agent: ReactiveAgent): void {
    this.agents.set(agent.id, agent);

    // Subscribe agent to relevant events
    for (const trigger of agent.triggers) {
      this.eventBus.subscribe(trigger.eventType, async (event) => {
        if (trigger.condition(event)) {
          await this.executeAgent(agent, event);
        }
      });
    }
  }

  private async executeAgent(agent: ReactiveAgent, event: Event): Promise<void> {
    const state = await this.stateStore.get(event.contextId);

    try {
      const result = await agent.execute(event, state);

      // Update state
      await this.stateStore.update(event.contextId, result.stateUpdate);

      // Emit output events
      for (const outputEvent of result.events) {
        await this.eventBus.emit(outputEvent);
      }
    } catch (error) {
      await this.eventBus.emit({
        type: 'agent.error',
        agentId: agent.id,
        error,
        originalEvent: event,
      });
    }
  }

  async startWorkflow(input: WorkflowInput): Promise<string> {
    const contextId = generateId();

    await this.stateStore.initialize(contextId, input);

    // Emit initial event to trigger the network
    await this.eventBus.emit({
      type: 'workflow.started',
      contextId,
      input,
    });

    return contextId;
  }
}

// Example: Continuous improvement network
const improvementNetwork = new ReactiveAgentNetwork();

improvementNetwork.registerAgent({
  id: 'code-watcher',
  triggers: [{ eventType: 'file.changed', condition: () => true }],
  async execute(event, state) {
    const analysis = await analyzeFile(event.file);
    return {
      stateUpdate: { lastAnalysis: analysis },
      events: analysis.issues.length > 0
        ? [{ type: 'issues.detected', issues: analysis.issues }]
        : [],
    };
  },
});

improvementNetwork.registerAgent({
  id: 'auto-fixer',
  triggers: [{
    eventType: 'issues.detected',
    condition: (e) => e.issues.some(i => i.severity === 'auto-fixable'),
  }],
  async execute(event, state) {
    const fixes = await generateFixes(event.issues);
    return {
      stateUpdate: { pendingFixes: fixes },
      events: [{ type: 'fixes.generated', fixes }],
    };
  },
});
```

### State Manager

Shared context across all agents.

```typescript
class StateManager {
  private store: StateStore;
  private contextBuilder: ContextBuilder;

  async initialize(executionId: string, input: WorkflowInput): Promise<void> {
    await this.store.set(executionId, {
      input,
      startedAt: new Date(),
      status: 'running',
      tasks: {},
      context: {},
    });
  }

  async getContext(executionId: string): Promise<AgentContext> {
    const state = await this.store.get(executionId);

    return {
      // Shared read-only context
      input: state.input,
      repository: state.context.repository,
      analysis: state.context.analysis,

      // Task results
      completedTasks: state.tasks,

      // Utilities
      logger: this.createLogger(executionId),
      metrics: this.createMetrics(executionId),
    };
  }

  async updateTaskState(
    executionId: string,
    taskId: string,
    result: any
  ): Promise<void> {
    const state = await this.store.get(executionId);

    state.tasks[taskId] = {
      completedAt: new Date(),
      result,
      status: 'completed',
    };

    // Extract shared context updates
    if (result.contextUpdates) {
      Object.assign(state.context, result.contextUpdates);
    }

    await this.store.set(executionId, state);
  }

  async checkpoint(executionId: string): Promise<string> {
    const state = await this.store.get(executionId);
    const checkpointId = `${executionId}-${Date.now()}`;

    await this.store.set(checkpointId, {
      ...state,
      checkpointedAt: new Date(),
    });

    return checkpointId;
  }

  async restoreFromCheckpoint(checkpointId: string): Promise<string> {
    const checkpoint = await this.store.get(checkpointId);
    const newExecutionId = generateId();

    await this.store.set(newExecutionId, {
      ...checkpoint,
      restoredFrom: checkpointId,
      restoredAt: new Date(),
    });

    return newExecutionId;
  }
}
```

### Error Recovery

Handle failures gracefully.

```typescript
class ErrorRecoverySystem {
  constructor(
    private stateManager: StateManager,
    private notificationService: NotificationService
  ) {}

  async handleAgentError(
    executionId: string,
    agentId: string,
    error: Error,
    context: AgentContext
  ): Promise<RecoveryAction> {
    const strategy = this.determineRecoveryStrategy(error, agentId);

    switch (strategy) {
      case 'retry':
        return this.retryAgent(executionId, agentId, context);

      case 'fallback':
        return this.useFallbackAgent(executionId, agentId, context);

      case 'skip':
        return this.skipAgent(executionId, agentId, context);

      case 'checkpoint':
        return this.checkpointAndNotify(executionId, agentId, error);

      case 'abort':
        return this.abortWorkflow(executionId, error);

      default:
        throw error;
    }
  }

  private determineRecoveryStrategy(error: Error, agentId: string): RecoveryStrategy {
    // Rate limit errors -> retry with backoff
    if (error.message.includes('rate_limit')) {
      return 'retry';
    }

    // Context window exceeded -> use fallback (summarization)
    if (error.message.includes('context_length')) {
      return 'fallback';
    }

    // Optional agents -> skip
    if (this.isOptionalAgent(agentId)) {
      return 'skip';
    }

    // Critical agents -> checkpoint and notify
    if (this.isCriticalAgent(agentId)) {
      return 'checkpoint';
    }

    return 'abort';
  }

  private async retryAgent(
    executionId: string,
    agentId: string,
    context: AgentContext,
    attempt: number = 1
  ): Promise<RecoveryAction> {
    const maxRetries = 3;
    const backoffMs = Math.pow(2, attempt) * 1000;

    if (attempt > maxRetries) {
      return this.checkpointAndNotify(
        executionId,
        agentId,
        new Error(`Max retries exceeded for ${agentId}`)
      );
    }

    await sleep(backoffMs);

    return {
      action: 'retry',
      agentId,
      attempt: attempt + 1,
    };
  }

  private async checkpointAndNotify(
    executionId: string,
    agentId: string,
    error: Error
  ): Promise<RecoveryAction> {
    // Create checkpoint
    const checkpointId = await this.stateManager.checkpoint(executionId);

    // Notify human
    await this.notificationService.notifyError({
      executionId,
      agentId,
      error: error.message,
      checkpointId,
      resumeUrl: `/workflows/${executionId}/resume?checkpoint=${checkpointId}`,
    });

    return {
      action: 'paused',
      checkpointId,
      requiresHumanIntervention: true,
    };
  }
}
```

---

## Consequences

### Positive

1. **Scalability:** Process large codebases with parallel agents
2. **Reliability:** Error recovery and checkpointing
3. **Observability:** Full visibility into agent decisions
4. **Flexibility:** Multiple orchestration patterns for different needs
5. **Maintainability:** Modular agent design

### Negative

1. **Complexity:** Significant orchestration overhead
2. **Debugging:** Distributed agent issues are hard to trace
3. **Cost:** Multiple agent calls increase LLM costs
4. **Latency:** Coordination adds execution time

### Trade-offs

- **Parallelism vs. Coordination:** More parallel = faster but harder to coordinate
- **Autonomy vs. Control:** Reactive agents are powerful but unpredictable
- **Cost vs. Quality:** More agents = better results but higher cost

---

## Implementation Plan

### Phase 1: Core Infrastructure (Week 1-2)
- Implement Agent base class
- Build task executor
- Create state manager

### Phase 2: Basic Patterns (Week 3-4)
- Implement sequential pipeline
- Build fan-out/fan-in
- Add DAG orchestrator

### Phase 3: Advanced Patterns (Week 5-6)
- Implement hierarchical teams
- Build reactive network
- Add error recovery

### Phase 4: Monitoring & Tooling (Week 7-8)
- Build execution dashboard
- Add debugging tools
- Create agent library

---

## References

- [LangGraph](https://langchain-ai.github.io/langgraph/)
- [CrewAI](https://github.com/joaomdmoura/crewAI)
- [AutoGen](https://microsoft.github.io/autogen/)
- [Temporal Workflows](https://temporal.io/)

---

**Decision Maker:** AI/ML Lead + Engineering Lead
**Approved By:** Engineering Leadership
**Implementation Owner:** AI Platform Team
