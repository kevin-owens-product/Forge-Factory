# ADR-008: Workflow Engine Architecture

## Status
Accepted

## Context
Forge Factory needs a powerful workflow engine that enables users to:
- Visually build complex automation workflows
- Orchestrate AI agents, tasks, and integrations
- Handle conditional logic and branching
- Support parallel execution and synchronization
- Provide real-time execution monitoring
- Enable workflow templates and reuse
- Support approval gates and human-in-the-loop
- Handle errors and retries gracefully
- Scale to thousands of concurrent executions

## Decision
We will build a **visual workflow engine** using **ReactFlow** for the builder UI and **BullMQ** (Redis-based queue) for execution orchestration.

### Workflow Engine Architecture

```
┌──────────────────────────────────────────────────────────────┐
│               Workflow Engine Architecture                    │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Workflow Builder (ReactFlow)                          │ │
│  │  - Visual node-based editor                            │ │
│  │  - Drag-and-drop nodes                                 │ │
│  │  - Connection validation                               │ │
│  │  - Node configuration panels                           │ │
│  └────────────────────────────────────────────────────────┘ │
│                         ↓                                     │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Workflow Definition (JSON)                            │ │
│  │  - Nodes (steps)                                       │ │
│  │  - Edges (flow)                                        │ │
│  │  - Configuration                                       │ │
│  │  - Variables and inputs                                │ │
│  └────────────────────────────────────────────────────────┘ │
│                         ↓                                     │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Execution Engine (BullMQ)                             │ │
│  │  - Queue-based processing                              │ │
│  │  - Parallel execution                                  │ │
│  │  - Error handling and retries                          │ │
│  │  - State persistence                                   │ │
│  └────────────────────────────────────────────────────────┘ │
│                         ↓                                     │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Node Executors                                        │ │
│  │  - Agent nodes (Claude, custom)                        │ │
│  │  - Task nodes (create, update)                         │ │
│  │  - Integration nodes (GitHub, APIs)                    │ │
│  │  - Logic nodes (condition, loop, merge)                │ │
│  │  - Approval nodes (human gates)                        │ │
│  └────────────────────────────────────────────────────────┘ │
│                         ↓                                     │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  State Storage (PostgreSQL + Redis)                    │ │
│  │  - Workflow definitions                                │ │
│  │  - Execution history                                   │ │
│  │  - Runtime state and variables                         │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

## Implementation

### 1. Workflow Data Model

```prisma
// packages/prisma/schema.prisma

model Workflow {
  id              String   @id @default(cuid())
  tenantId        String

  // Metadata
  name            String
  description     String?
  version         Int      @default(1)
  status          WorkflowStatus

  // Definition (ReactFlow format)
  definition      Json     // { nodes: [], edges: [] }
  variables       Json?    // Input/output schema

  // Execution config
  timeout         Int?     // seconds
  maxRetries      Int      @default(3)
  retryDelay      Int      @default(60) // seconds

  // Relations
  creatorId       String
  creator         User     @relation(fields: [creatorId], references: [id])
  projectId       String?
  project         Project? @relation(fields: [projectId], references: [id])

  // Executions
  executions      WorkflowExecution[]
  tasks           Task[]

  // Timestamps
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  publishedAt     DateTime?

  @@index([tenantId])
  @@index([status])
  @@index([creatorId])
}

enum WorkflowStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}

model WorkflowExecution {
  id              String   @id @default(cuid())
  tenantId        String
  workflowId      String
  workflow        Workflow @relation(fields: [workflowId], references: [id])

  // Execution state
  status          ExecutionStatus
  currentStep     String?  // Current node ID
  progress        Int      @default(0) // 0-100

  // Runtime data
  input           Json?    // Input variables
  output          Json?    // Output variables
  state           Json?    // Current execution state

  // Error handling
  error           String?
  retryCount      Int      @default(0)

  // Timing
  startedAt       DateTime @default(now())
  completedAt     DateTime?
  duration        Int?     // milliseconds

  // Triggered by
  triggeredBy     String
  triggerUser     User     @relation(fields: [triggeredBy], references: [id])
  triggerType     TriggerType

  // Steps
  steps           WorkflowStep[]

  @@index([tenantId])
  @@index([workflowId])
  @@index([status])
}

enum ExecutionStatus {
  PENDING
  RUNNING
  PAUSED
  COMPLETED
  FAILED
  CANCELLED
}

enum TriggerType {
  MANUAL
  SCHEDULE
  WEBHOOK
  EVENT
}

model WorkflowStep {
  id              String   @id @default(cuid())
  tenantId        String
  executionId     String
  execution       WorkflowExecution @relation(fields: [executionId], references: [id], onDelete: Cascade)

  // Step info
  nodeId          String   // Node ID from workflow definition
  nodeType        String
  name            String

  // Execution
  status          StepStatus
  input           Json?
  output          Json?
  error           String?

  // Timing
  startedAt       DateTime?
  completedAt     DateTime?
  duration        Int?     // milliseconds

  @@index([tenantId])
  @@index([executionId])
}

enum StepStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
  SKIPPED
}
```

### 2. Workflow Builder UI

```tsx
// apps/portal/components/workflows/workflow-builder.tsx
'use client';

import { useCallback, useState } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Connection,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MiniMap,
  Panel,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { NodePalette } from './node-palette';
import { NodeConfigPanel } from './node-config-panel';
import { WorkflowToolbar } from './workflow-toolbar';
import { useWorkflow, useSaveWorkflow } from '@/hooks/use-workflows';

// Custom node types
import { AgentNode } from './nodes/agent-node';
import { TaskNode } from './nodes/task-node';
import { ConditionNode } from './nodes/condition-node';
import { ApprovalNode } from './nodes/approval-node';
import { IntegrationNode } from './nodes/integration-node';

const nodeTypes = {
  agent: AgentNode,
  task: TaskNode,
  condition: ConditionNode,
  approval: ApprovalNode,
  integration: IntegrationNode,
};

interface WorkflowBuilderProps {
  workflowId?: string;
}

export function WorkflowBuilder({ workflowId }: WorkflowBuilderProps) {
  const { data: workflow } = useWorkflow(workflowId);
  const saveWorkflow = useSaveWorkflow();

  const [nodes, setNodes, onNodesChange] = useNodesState(
    workflow?.definition?.nodes || []
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    workflow?.definition?.edges || []
  );
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge(connection, eds));
    },
    [setEdges]
  );

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      // Auto-save on drag
      saveWorkflow.mutate({
        id: workflowId,
        definition: { nodes, edges },
      });
    },
    [nodes, edges, workflowId, saveWorkflow]
  );

  const handleSave = async () => {
    await saveWorkflow.mutateAsync({
      id: workflowId,
      definition: { nodes, edges },
    });
  };

  const handleAddNode = (type: string) => {
    const newNode: Node = {
      id: `${type}-${Date.now()}`,
      type,
      position: { x: Math.random() * 500, y: Math.random() * 500 },
      data: { label: `${type} node` },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  return (
    <div className="h-screen flex flex-col">
      <WorkflowToolbar
        workflow={workflow}
        onSave={handleSave}
        isSaving={saveWorkflow.isPending}
      />

      <div className="flex-1 flex">
        <NodePalette onAddNode={handleAddNode} />

        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onNodeDragStop={onNodeDragStop}
            nodeTypes={nodeTypes}
            fitView
          >
            <Background />
            <Controls />
            <MiniMap />
            <Panel position="top-right">
              {nodes.length} nodes, {edges.length} connections
            </Panel>
          </ReactFlow>
        </div>

        {selectedNode && (
          <NodeConfigPanel
            node={selectedNode}
            onUpdate={(data) => {
              setNodes((nds) =>
                nds.map((n) =>
                  n.id === selectedNode.id ? { ...n, data } : n
                )
              );
            }}
            onClose={() => setSelectedNode(null)}
          />
        )}
      </div>
    </div>
  );
}
```

### 3. Custom Node Components

```tsx
// apps/portal/components/workflows/nodes/agent-node.tsx
'use client';

import { Handle, Position } from 'reactflow';
import { Card } from '@/components/ui/card';
import { Bot } from 'lucide-react';

export function AgentNode({ data, selected }: any) {
  return (
    <>
      <Handle type="target" position={Position.Top} />
      <Card
        className={`px-4 py-3 min-w-[200px] ${
          selected ? 'ring-2 ring-primary' : ''
        }`}
      >
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <div>
            <div className="font-medium text-sm">{data.label}</div>
            <div className="text-xs text-muted-foreground">
              {data.agentType || 'Claude'}
            </div>
          </div>
        </div>
      </Card>
      <Handle type="source" position={Position.Bottom} />
    </>
  );
}
```

### 4. Workflow Execution Engine

```typescript
// apps/api/src/modules/workflows/workflow-executor.service.ts
import { Injectable } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import { PrismaService } from '@forge/prisma';
import { EventsGateway } from '@/gateways/events.gateway';
import { NodeExecutorService } from './node-executor.service';

@Injectable()
export class WorkflowExecutorService {
  private workflowQueue: Queue;
  private worker: Worker;

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsGateway: EventsGateway,
    private readonly nodeExecutor: NodeExecutorService,
  ) {
    this.initializeQueue();
  }

  private initializeQueue() {
    // Create BullMQ queue
    this.workflowQueue = new Queue('workflows', {
      connection: {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT),
      },
    });

    // Create worker
    this.worker = new Worker(
      'workflows',
      async (job) => {
        await this.executeWorkflow(job.data);
      },
      {
        connection: {
          host: process.env.REDIS_HOST,
          port: parseInt(process.env.REDIS_PORT),
        },
        concurrency: 10,
      }
    );

    this.worker.on('completed', (job) => {
      console.log(`Workflow ${job.id} completed`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`Workflow ${job.id} failed:`, err);
    });
  }

  async startExecution(
    tenantId: string,
    workflowId: string,
    userId: string,
    input?: any,
  ) {
    // Create execution record
    const execution = await this.prisma.workflowExecution.create({
      data: {
        tenantId,
        workflowId,
        triggeredBy: userId,
        triggerType: 'MANUAL',
        status: 'PENDING',
        input,
      },
      include: {
        workflow: true,
      },
    });

    // Add to queue
    await this.workflowQueue.add(
      'execute',
      {
        executionId: execution.id,
        tenantId,
        workflowId,
        definition: execution.workflow.definition,
        input,
      },
      {
        attempts: execution.workflow.maxRetries,
        backoff: {
          type: 'exponential',
          delay: execution.workflow.retryDelay * 1000,
        },
      }
    );

    // Emit event
    this.eventsGateway.emitToTenant(tenantId, 'workflow:started', {
      executionId: execution.id,
    });

    return execution;
  }

  private async executeWorkflow(data: any) {
    const { executionId, tenantId, definition, input } = data;

    try {
      // Update status to running
      await this.prisma.workflowExecution.update({
        where: { id: executionId },
        data: { status: 'RUNNING' },
      });

      // Execute workflow graph
      const result = await this.executeGraph(
        executionId,
        tenantId,
        definition,
        input
      );

      // Mark as completed
      await this.prisma.workflowExecution.update({
        where: { id: executionId },
        data: {
          status: 'COMPLETED',
          output: result,
          completedAt: new Date(),
          duration: Date.now() - new Date(execution.startedAt).getTime(),
        },
      });

      // Emit event
      this.eventsGateway.emitToTenant(tenantId, 'workflow:completed', {
        executionId,
        output: result,
      });
    } catch (error) {
      // Mark as failed
      await this.prisma.workflowExecution.update({
        where: { id: executionId },
        data: {
          status: 'FAILED',
          error: error.message,
          completedAt: new Date(),
        },
      });

      // Emit event
      this.eventsGateway.emitToTenant(tenantId, 'workflow:failed', {
        executionId,
        error: error.message,
      });

      throw error;
    }
  }

  private async executeGraph(
    executionId: string,
    tenantId: string,
    definition: any,
    input: any,
  ) {
    const { nodes, edges } = definition;
    const state = { ...input };
    const completed = new Set<string>();

    // Find start node (node with no incoming edges)
    const startNode = nodes.find(
      (node: any) => !edges.some((edge: any) => edge.target === node.id)
    );

    if (!startNode) {
      throw new Error('No start node found');
    }

    // Execute nodes in order
    await this.executeNode(
      executionId,
      tenantId,
      startNode,
      nodes,
      edges,
      state,
      completed
    );

    return state;
  }

  private async executeNode(
    executionId: string,
    tenantId: string,
    node: any,
    allNodes: any[],
    allEdges: any[],
    state: any,
    completed: Set<string>,
  ) {
    if (completed.has(node.id)) {
      return;
    }

    // Create step record
    const step = await this.prisma.workflowStep.create({
      data: {
        tenantId,
        executionId,
        nodeId: node.id,
        nodeType: node.type,
        name: node.data.label,
        status: 'RUNNING',
        input: state,
        startedAt: new Date(),
      },
    });

    try {
      // Execute node
      const result = await this.nodeExecutor.execute(node, state);

      // Update state
      Object.assign(state, result);

      // Mark step as completed
      await this.prisma.workflowStep.update({
        where: { id: step.id },
        data: {
          status: 'COMPLETED',
          output: result,
          completedAt: new Date(),
          duration: Date.now() - new Date(step.startedAt).getTime(),
        },
      });

      // Mark node as completed
      completed.add(node.id);

      // Find next nodes
      const nextEdges = allEdges.filter((edge: any) => edge.source === node.id);

      // Execute next nodes (parallel execution)
      await Promise.all(
        nextEdges.map(async (edge: any) => {
          const nextNode = allNodes.find((n: any) => n.id === edge.target);
          if (nextNode) {
            await this.executeNode(
              executionId,
              tenantId,
              nextNode,
              allNodes,
              allEdges,
              state,
              completed
            );
          }
        })
      );
    } catch (error) {
      // Mark step as failed
      await this.prisma.workflowStep.update({
        where: { id: step.id },
        data: {
          status: 'FAILED',
          error: error.message,
          completedAt: new Date(),
        },
      });

      throw error;
    }
  }
}
```

### 5. Node Executor Service

```typescript
// apps/api/src/modules/workflows/node-executor.service.ts
import { Injectable } from '@nestjs/common';
import { AgentService } from '@/modules/agents/agent.service';
import { TasksService } from '@/modules/tasks/tasks.service';
import { IntegrationService } from '@/modules/integrations/integration.service';

@Injectable()
export class NodeExecutorService {
  constructor(
    private readonly agentService: AgentService,
    private readonly tasksService: TasksService,
    private readonly integrationService: IntegrationService,
  ) {}

  async execute(node: any, state: any): Promise<any> {
    switch (node.type) {
      case 'agent':
        return this.executeAgentNode(node, state);
      case 'task':
        return this.executeTaskNode(node, state);
      case 'condition':
        return this.executeConditionNode(node, state);
      case 'approval':
        return this.executeApprovalNode(node, state);
      case 'integration':
        return this.executeIntegrationNode(node, state);
      default:
        throw new Error(`Unknown node type: ${node.type}`);
    }
  }

  private async executeAgentNode(node: any, state: any) {
    const { agentType, prompt, model } = node.data;

    const result = await this.agentService.execute({
      agentType,
      prompt: this.interpolate(prompt, state),
      model,
      context: state,
    });

    return { [node.id]: result };
  }

  private async executeTaskNode(node: any, state: any) {
    const { action, taskData } = node.data;

    if (action === 'create') {
      const task = await this.tasksService.create(
        state.tenantId,
        state.userId,
        this.interpolate(taskData, state)
      );
      return { [node.id]: task };
    }

    // Handle other task actions...
  }

  private async executeConditionNode(node: any, state: any) {
    const { condition } = node.data;
    const result = this.evaluateCondition(condition, state);
    return { [node.id]: result };
  }

  private async executeApprovalNode(node: any, state: any) {
    // Create approval request
    // Wait for approval (handled by separate flow)
    // Return approval result
  }

  private interpolate(template: any, state: any): any {
    // Replace {{variable}} with actual values from state
    const str = JSON.stringify(template);
    const interpolated = str.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      return state[key] || '';
    });
    return JSON.parse(interpolated);
  }
}
```

## Node Types

### Core Nodes
- **Trigger**: Start workflow (manual, schedule, webhook, event)
- **Agent**: Execute AI agent
- **Task**: Create/update/complete tasks
- **Condition**: Conditional branching
- **Loop**: Iterate over collections
- **Merge**: Synchronize parallel branches
- **Delay**: Wait for specified time
- **Approval**: Human-in-the-loop gate

### Integration Nodes
- **GitHub**: Repository operations
- **API**: HTTP requests
- **Database**: Query/insert data
- **Email**: Send notifications
- **Slack**: Post messages

### Data Nodes
- **Transform**: Map/filter/reduce data
- **Variable**: Set/get variables
- **Code**: Execute custom JavaScript

## Features

### Visual Builder
- Drag-and-drop nodes
- Connection validation
- Node configuration panels
- Zoom and pan
- Minimap for navigation

### Execution
- Queue-based processing
- Parallel execution
- Error handling and retries
- Timeout management
- State persistence

### Monitoring
- Real-time execution status
- Step-by-step progress
- Error logs and stack traces
- Performance metrics

## Consequences

### Positive
- **Visual**: Easy to understand and build workflows
- **Powerful**: Complex orchestration capabilities
- **Scalable**: Queue-based execution scales well
- **Reliable**: Built-in error handling and retries

### Negative
- **Complexity**: Workflow engine is complex to maintain
- **Resource Usage**: Long-running workflows consume resources

### Mitigations
- **Testing**: Comprehensive workflow tests
- **Monitoring**: Track execution metrics
- **Timeouts**: Prevent runaway workflows

## Alternatives Considered

### 1. Temporal.io
**Rejected**: Additional service to manage, learning curve.

### 2. Apache Airflow
**Rejected**: Overkill, Python-based, not real-time.

### 3. n8n / Node-RED
**Rejected**: Less control, licensing concerns.

## References
- [ReactFlow Documentation](https://reactflow.dev/)
- [BullMQ Documentation](https://docs.bullmq.io/)

## Review Date
2024-05-16 (3 months)
