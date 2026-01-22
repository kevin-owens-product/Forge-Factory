# ADR-007: Task Management System

## Status
Accepted

## Context
Forge Factory needs a comprehensive task management system that supports:
- Task creation, assignment, and tracking
- Multiple views (Kanban board, list, calendar, timeline)
- Task dependencies and subtasks
- Labels, priorities, and custom fields
- Time tracking and estimates
- Comments and attachments
- Task templates
- Bulk operations
- Real-time collaboration
- Integration with workflows and agents

## Decision
We will build a **flexible task management system** with support for multiple views, real-time updates, and deep integration with workflows and AI agents.

### Task Management Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                Task Management System Architecture            │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  UI Layer                                              │ │
│  │  - Kanban Board (drag & drop)                          │ │
│  │  - List View (sortable, filterable)                    │ │
│  │  - Calendar View                                       │ │
│  │  - Timeline View (Gantt-style)                         │ │
│  │  - Task Detail Sidebar                                 │ │
│  └────────────────────────────────────────────────────────┘ │
│                         ↓                                     │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  State Management                                      │ │
│  │  - TanStack Query (server state)                       │ │
│  │  - Zustand (UI state, selections)                      │ │
│  │  - React Hook Form (task creation/editing)             │ │
│  └────────────────────────────────────────────────────────┘ │
│                         ↓                                     │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  API Layer                                             │ │
│  │  - CRUD operations                                     │ │
│  │  - Bulk operations                                     │ │
│  │  - Task dependencies graph                             │ │
│  │  - Real-time event emission                            │ │
│  └────────────────────────────────────────────────────────┘ │
│                         ↓                                     │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Business Logic Layer                                  │ │
│  │  - Task lifecycle management                           │ │
│  │  - Dependency resolution                               │ │
│  │  - Assignment validation                               │ │
│  │  - Notification triggers                               │ │
│  └────────────────────────────────────────────────────────┘ │
│                         ↓                                     │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Data Layer (PostgreSQL)                               │ │
│  │  - Tasks table                                         │ │
│  │  - Task dependencies (adjacency list)                  │ │
│  │  - Comments, attachments                               │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

## Implementation

### 1. Data Model

```prisma
// packages/prisma/schema.prisma

model Task {
  id              String   @id @default(cuid())
  tenantId        String
  projectId       String?
  workflowId      String?

  // Basic info
  title           String
  description     String?
  status          TaskStatus
  priority        TaskPriority
  type            TaskType

  // Assignment
  assigneeId      String?
  assignee        User?    @relation("TaskAssignee", fields: [assigneeId], references: [id])
  creatorId       String
  creator         User     @relation("TaskCreator", fields: [creatorId], references: [id])

  // Dates
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  dueDate         DateTime?
  startDate       DateTime?
  completedAt     DateTime?

  // Metadata
  tags            String[]
  customFields    Json?

  // Hierarchy
  parentId        String?
  parent          Task?    @relation("TaskSubtasks", fields: [parentId], references: [id])
  subtasks        Task[]   @relation("TaskSubtasks")

  // Dependencies
  dependsOn       TaskDependency[] @relation("DependentTask")
  blockedBy       TaskDependency[] @relation("BlockingTask")

  // Tracking
  estimate        Int?     // minutes
  timeSpent       Int?     // minutes

  // Relations
  project         Project? @relation(fields: [projectId], references: [id])
  workflow        Workflow? @relation(fields: [workflowId], references: [id])
  comments        Comment[]
  attachments     Attachment[]
  activities      TaskActivity[]

  @@index([tenantId])
  @@index([assigneeId])
  @@index([status])
  @@index([dueDate])
  @@index([projectId])
  @@index([workflowId])
}

enum TaskStatus {
  TODO
  IN_PROGRESS
  IN_REVIEW
  BLOCKED
  COMPLETED
  CANCELLED
}

enum TaskPriority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

enum TaskType {
  FEATURE
  BUG
  CHORE
  DOCUMENTATION
  REFACTORING
  TEST
  AGENT_TASK
}

model TaskDependency {
  id              String   @id @default(cuid())
  tenantId        String

  dependentId     String
  dependent       Task     @relation("DependentTask", fields: [dependentId], references: [id], onDelete: Cascade)

  blockingId      String
  blocking        Task     @relation("BlockingTask", fields: [blockingId], references: [id], onDelete: Cascade)

  type            DependencyType
  createdAt       DateTime @default(now())

  @@unique([dependentId, blockingId])
  @@index([tenantId])
}

enum DependencyType {
  FINISH_TO_START  // Blocking task must finish before dependent starts
  START_TO_START   // Both tasks start together
  FINISH_TO_FINISH // Both tasks finish together
}

model Comment {
  id          String   @id @default(cuid())
  tenantId    String
  taskId      String
  task        Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)

  authorId    String
  author      User     @relation(fields: [authorId], references: [id])

  content     String
  mentions    String[] // User IDs mentioned in comment

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([tenantId])
  @@index([taskId])
}

model Attachment {
  id          String   @id @default(cuid())
  tenantId    String
  taskId      String
  task        Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)

  filename    String
  filesize    Int
  mimeType    String
  url         String

  uploadedBy  String
  uploader    User     @relation(fields: [uploadedBy], references: [id])

  createdAt   DateTime @default(now())

  @@index([tenantId])
  @@index([taskId])
}

model TaskActivity {
  id          String   @id @default(cuid())
  tenantId    String
  taskId      String
  task        Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)

  userId      String
  user        User     @relation(fields: [userId], references: [id])

  action      TaskAction
  changes     Json?    // Before/after state

  createdAt   DateTime @default(now())

  @@index([tenantId])
  @@index([taskId])
}

enum TaskAction {
  CREATED
  UPDATED
  STATUS_CHANGED
  ASSIGNED
  UNASSIGNED
  COMMENTED
  ATTACHMENT_ADDED
  DEPENDENCY_ADDED
  COMPLETED
  REOPENED
}
```

### 2. Kanban Board Component

```tsx
// apps/portal/components/tasks/kanban-board.tsx
'use client';

import { DndContext, DragEndEvent, DragOverlay, DragStartEvent } from '@dnd-kit/core';
import { useState } from 'react';
import { useTasks, useUpdateTask } from '@/hooks/use-tasks';
import { TaskColumn } from './task-column';
import { TaskCard } from './task-card';
import { Task, TaskStatus } from '@forge/shared-types';

const COLUMNS: TaskStatus[] = [
  'TODO',
  'IN_PROGRESS',
  'IN_REVIEW',
  'COMPLETED',
];

export function KanbanBoard() {
  const { data: tasks = [] } = useTasks();
  const updateTask = useUpdateTask();
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id);
    setActiveTask(task || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) {
      setActiveTask(null);
      return;
    }

    const taskId = active.id as string;
    const newStatus = over.id as TaskStatus;
    const task = tasks.find((t) => t.id === taskId);

    if (task && task.status !== newStatus) {
      updateTask.mutate({
        id: taskId,
        status: newStatus,
      });
    }

    setActiveTask(null);
  };

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-4 gap-4 h-full">
        {COLUMNS.map((status) => {
          const columnTasks = tasks.filter((task) => task.status === status);
          return (
            <TaskColumn
              key={status}
              status={status}
              tasks={columnTasks}
              count={columnTasks.length}
            />
          );
        })}
      </div>

      <DragOverlay>
        {activeTask ? (
          <TaskCard task={activeTask} isDragging />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
```

```tsx
// apps/portal/components/tasks/task-column.tsx
'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { TaskCard } from './task-card';
import { Task, TaskStatus } from '@forge/shared-types';
import { Badge } from '@/components/ui/badge';

interface TaskColumnProps {
  status: TaskStatus;
  tasks: Task[];
  count: number;
}

const COLUMN_LABELS: Record<TaskStatus, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'In Review',
  BLOCKED: 'Blocked',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export function TaskColumn({ status, tasks, count }: TaskColumnProps) {
  const { setNodeRef } = useDroppable({ id: status });

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 bg-muted rounded-t-lg">
        <h3 className="font-semibold">{COLUMN_LABELS[status]}</h3>
        <Badge variant="secondary">{count}</Badge>
      </div>

      <div
        ref={setNodeRef}
        className="flex-1 p-4 space-y-2 overflow-y-auto bg-muted/50 rounded-b-lg"
      >
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}
```

```tsx
// apps/portal/components/tasks/task-card.tsx
'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar, MessageSquare, Paperclip } from 'lucide-react';
import { Task } from '@forge/shared-types';
import { cn } from '@/lib/utils';

interface TaskCardProps {
  task: Task;
  isDragging?: boolean;
}

export function TaskCard({ task, isDragging }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'p-3 cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-50'
      )}
    >
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-medium text-sm line-clamp-2">{task.title}</h4>
          <Badge variant={getPriorityVariant(task.priority)} className="shrink-0">
            {task.priority}
          </Badge>
        </div>

        {task.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {task.description}
          </p>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {task.dueDate && (
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDate(task.dueDate)}
              </div>
            )}
            {task.comments.length > 0 && (
              <div className="flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                {task.comments.length}
              </div>
            )}
            {task.attachments.length > 0 && (
              <div className="flex items-center gap-1">
                <Paperclip className="h-3 w-3" />
                {task.attachments.length}
              </div>
            )}
          </div>

          {task.assignee && (
            <Avatar className="h-6 w-6">
              <AvatarImage src={task.assignee.avatar} />
              <AvatarFallback>{task.assignee.initials}</AvatarFallback>
            </Avatar>
          )}
        </div>

        {task.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {task.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
```

### 3. Task Detail Sidebar

```tsx
// apps/portal/components/tasks/task-detail-sidebar.tsx
'use client';

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TaskOverview } from './task-detail/task-overview';
import { TaskComments } from './task-detail/task-comments';
import { TaskActivity } from './task-detail/task-activity';
import { TaskSubtasks } from './task-detail/task-subtasks';
import { useTask } from '@/hooks/use-tasks';
import { Skeleton } from '@/components/ui/skeleton';

interface TaskDetailSidebarProps {
  taskId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TaskDetailSidebar({
  taskId,
  open,
  onOpenChange,
}: TaskDetailSidebarProps) {
  const { data: task, isLoading } = useTask(taskId!);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-2xl w-full overflow-y-auto">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-64" />
          </div>
        ) : task ? (
          <>
            <SheetHeader>
              <SheetTitle>{task.title}</SheetTitle>
            </SheetHeader>

            <Tabs defaultValue="overview" className="mt-6">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="comments">
                  Comments ({task.comments.length})
                </TabsTrigger>
                <TabsTrigger value="subtasks">
                  Subtasks ({task.subtasks.length})
                </TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
              </TabsList>

              <TabsContent value="overview">
                <TaskOverview task={task} />
              </TabsContent>

              <TabsContent value="comments">
                <TaskComments task={task} />
              </TabsContent>

              <TabsContent value="subtasks">
                <TaskSubtasks task={task} />
              </TabsContent>

              <TabsContent value="activity">
                <TaskActivity task={task} />
              </TabsContent>
            </Tabs>
          </>
        ) : (
          <div>Task not found</div>
        )}
      </SheetContent>
    </Sheet>
  );
}
```

### 4. Task API Endpoints

```typescript
// apps/api/src/modules/tasks/tasks.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TenantGuard } from '@/guards/tenant.guard';
import { TenantId, UserId } from '@/decorators';
import { CreateTaskDto, UpdateTaskDto, TaskFiltersDto } from './dto';

@Controller('tasks')
@UseGuards(TenantGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  async getTasks(
    @TenantId() tenantId: string,
    @Query() filters: TaskFiltersDto,
  ) {
    return this.tasksService.findAll(tenantId, filters);
  }

  @Get(':id')
  async getTask(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.tasksService.findOne(tenantId, id);
  }

  @Post()
  async createTask(
    @TenantId() tenantId: string,
    @UserId() userId: string,
    @Body() dto: CreateTaskDto,
  ) {
    return this.tasksService.create(tenantId, userId, dto);
  }

  @Put(':id')
  async updateTask(
    @TenantId() tenantId: string,
    @UserId() userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasksService.update(tenantId, userId, id, dto);
  }

  @Delete(':id')
  async deleteTask(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.tasksService.delete(tenantId, id);
  }

  @Post(':id/comments')
  async addComment(
    @TenantId() tenantId: string,
    @UserId() userId: string,
    @Param('id') taskId: string,
    @Body('content') content: string,
  ) {
    return this.tasksService.addComment(tenantId, userId, taskId, content);
  }

  @Post(':id/dependencies')
  async addDependency(
    @TenantId() tenantId: string,
    @Param('id') taskId: string,
    @Body('blockingTaskId') blockingTaskId: string,
    @Body('type') type: DependencyType,
  ) {
    return this.tasksService.addDependency(tenantId, taskId, blockingTaskId, type);
  }

  @Post('bulk/update')
  async bulkUpdate(
    @TenantId() tenantId: string,
    @Body('taskIds') taskIds: string[],
    @Body('update') update: Partial<UpdateTaskDto>,
  ) {
    return this.tasksService.bulkUpdate(tenantId, taskIds, update);
  }
}
```

```typescript
// apps/api/src/modules/tasks/tasks.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@forge/prisma';
import { EventsGateway } from '@/gateways/events.gateway';
import { CreateTaskDto, UpdateTaskDto, TaskFiltersDto } from './dto';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  async findAll(tenantId: string, filters: TaskFiltersDto) {
    const where: any = { tenantId };

    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.assigneeId) {
      where.assigneeId = filters.assigneeId;
    }
    if (filters.priority) {
      where.priority = filters.priority;
    }
    if (filters.tags?.length) {
      where.tags = { hasSome: filters.tags };
    }
    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.task.findMany({
      where,
      include: {
        assignee: true,
        creator: true,
        comments: { take: 5, orderBy: { createdAt: 'desc' } },
        attachments: true,
        subtasks: { select: { id: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(tenantId: string, userId: string, dto: CreateTaskDto) {
    const task = await this.prisma.task.create({
      data: {
        ...dto,
        tenantId,
        creatorId: userId,
        assigneeId: dto.assigneeId || userId,
      },
      include: {
        assignee: true,
        creator: true,
      },
    });

    // Emit real-time event
    this.eventsGateway.emitToTenant(tenantId, 'task:created', task);

    // Log activity
    await this.logActivity(tenantId, task.id, userId, 'CREATED');

    return task;
  }

  async update(
    tenantId: string,
    userId: string,
    id: string,
    dto: UpdateTaskDto,
  ) {
    const existingTask = await this.prisma.task.findUnique({
      where: { id, tenantId },
    });

    if (!existingTask) {
      throw new NotFoundException('Task not found');
    }

    const task = await this.prisma.task.update({
      where: { id, tenantId },
      data: dto,
      include: {
        assignee: true,
        creator: true,
      },
    });

    // Emit real-time event
    this.eventsGateway.emitToTenant(tenantId, 'task:updated', task);

    // Log activity
    const action = this.getActivityAction(existingTask, task);
    await this.logActivity(tenantId, task.id, userId, action, {
      before: existingTask,
      after: task,
    });

    return task;
  }

  private async logActivity(
    tenantId: string,
    taskId: string,
    userId: string,
    action: TaskAction,
    changes?: any,
  ) {
    return this.prisma.taskActivity.create({
      data: {
        tenantId,
        taskId,
        userId,
        action,
        changes,
      },
    });
  }
}
```

## Task Views

### 1. Kanban Board
- Drag-and-drop between columns
- Column swimlanes for status
- Real-time updates
- Card previews with key info

### 2. List View
- Sortable columns
- Bulk selection and operations
- Filters and search
- Inline editing

### 3. Calendar View
- Monthly/weekly views
- Due dates and milestones
- Drag to reschedule
- Color-coded by priority

### 4. Timeline View (Gantt)
- Task dependencies visualization
- Progress tracking
- Critical path highlighting
- Resource allocation

## Features

### Task Dependencies
- Finish-to-start (most common)
- Start-to-start
- Finish-to-finish
- Circular dependency detection

### Subtasks
- Hierarchical task breakdown
- Progress rollup to parent
- Independent or linked status

### Time Tracking
- Estimated vs actual time
- Timer integration
- Time logs and reports

### Task Templates
- Reusable task structures
- Variable substitution
- Checklist templates

### Bulk Operations
- Multi-select
- Bulk status change
- Bulk assignment
- Bulk tagging

## Consequences

### Positive
- **Flexible Views**: Multiple perspectives on same data
- **Collaboration**: Real-time updates, comments, mentions
- **Powerful**: Dependencies, subtasks, custom fields
- **Integrated**: Deep workflow and agent integration

### Negative
- **Complexity**: Many features increase learning curve
- **Performance**: Real-time updates for large task lists

### Mitigations
- **Progressive Disclosure**: Hide advanced features initially
- **Pagination**: Limit tasks loaded at once
- **Virtualization**: Virtual scrolling for large lists

## Alternatives Considered

### 1. Third-party Task Management (Jira, Asana)
**Rejected**: Less control, no deep integration with our platform.

### 2. Simpler Task System
**Rejected**: Insufficient for enterprise needs.

## References
- [dnd-kit Documentation](https://docs.dndkit.com/)
- [Task Management Best Practices](https://asana.com/resources/task-management)

## Review Date
2024-05-16 (3 months)
