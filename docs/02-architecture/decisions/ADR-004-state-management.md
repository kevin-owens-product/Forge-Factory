# ADR-004: State Management and Data Fetching Strategy

## Status
Accepted

## Context
Our enterprise SaaS application needs to manage several types of state:
1. **Server State**: Data from the API (tasks, workflows, agents, repositories)
2. **Client State**: UI state (modals, filters, selections)
3. **Form State**: Complex forms with validation
4. **URL State**: Shareable filters, pagination, tabs
5. **Real-time State**: Live updates from WebSocket/SSE
6. **Global State**: Tenant context, user preferences, feature flags

We need a strategy that provides:
- Type safety
- Minimal boilerplate
- Good performance (minimal re-renders)
- Excellent caching and cache invalidation
- Optimistic updates
- Real-time synchronization
- Offline support (future)

## Decision
We will use a **hybrid state management approach** with specialized tools for each state type.

### State Management Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     State Management Layers                   │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │   Server State (TanStack Query)                     │    │
│  │   - API data, caching, synchronization              │    │
│  │   - Optimistic updates, invalidation                │    │
│  └─────────────────────────────────────────────────────┘    │
│                         ↓                                     │
│  ┌─────────────────────────────────────────────────────┐    │
│  │   Client State (Zustand)                            │    │
│  │   - UI state, selections, transient data            │    │
│  └─────────────────────────────────────────────────────┘    │
│                         ↓                                     │
│  ┌─────────────────────────────────────────────────────┐    │
│  │   Form State (React Hook Form + Zod)                │    │
│  │   - Form data, validation, errors                   │    │
│  └─────────────────────────────────────────────────────┘    │
│                         ↓                                     │
│  ┌─────────────────────────────────────────────────────┐    │
│  │   URL State (nuqs)                                   │    │
│  │   - Filters, pagination, tabs                       │    │
│  └─────────────────────────────────────────────────────┘    │
│                         ↓                                     │
│  ┌─────────────────────────────────────────────────────┐    │
│  │   Real-time State (Socket.io + Query Integration)   │    │
│  │   - Live updates, presence, notifications           │    │
│  └─────────────────────────────────────────────────────┘    │
│                         ↓                                     │
│  ┌─────────────────────────────────────────────────────┐    │
│  │   Global Context (React Context)                     │    │
│  │   - Tenant, user, theme, feature flags              │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

## Implementation

### 1. Server State - TanStack Query

**Use for**: All API data fetching, caching, and synchronization.

```typescript
// lib/api-client.ts
import axios from 'axios';
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Auto-inject tenant header
apiClient.interceptors.request.use((config) => {
  const tenantId = getTenantId();
  if (tenantId) {
    config.headers['X-Tenant-ID'] = tenantId;
  }
  return config;
});
```

#### Query Pattern

```typescript
// hooks/use-tasks.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { Task, CreateTaskDto } from '@forge/shared-types';

export const taskKeys = {
  all: ['tasks'] as const,
  lists: () => [...taskKeys.all, 'list'] as const,
  list: (filters: TaskFilters) => [...taskKeys.lists(), filters] as const,
  details: () => [...taskKeys.all, 'detail'] as const,
  detail: (id: string) => [...taskKeys.details(), id] as const,
};

export function useTasks(filters: TaskFilters = {}) {
  return useQuery({
    queryKey: taskKeys.list(filters),
    queryFn: async () => {
      const { data } = await apiClient.get<Task[]>('/tasks', { params: filters });
      return data;
    },
  });
}

export function useTask(id: string) {
  return useQuery({
    queryKey: taskKeys.detail(id),
    queryFn: async () => {
      const { data } = await apiClient.get<Task>(`/tasks/${id}`);
      return data;
    },
    enabled: !!id,
  });
}
```

#### Mutation Pattern with Optimistic Updates

```typescript
export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (task: CreateTaskDto) => {
      const { data } = await apiClient.post<Task>('/tasks', task);
      return data;
    },
    onMutate: async (newTask) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: taskKeys.lists() });

      // Snapshot previous value
      const previousTasks = queryClient.getQueryData(taskKeys.lists());

      // Optimistically update
      queryClient.setQueryData(taskKeys.lists(), (old: Task[] = []) => [
        ...old,
        { ...newTask, id: 'temp-' + Date.now(), status: 'pending' },
      ]);

      return { previousTasks };
    },
    onError: (err, newTask, context) => {
      // Rollback on error
      if (context?.previousTasks) {
        queryClient.setQueryData(taskKeys.lists(), context.previousTasks);
      }
    },
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
    },
  });
}
```

#### Infinite Query Pattern

```typescript
export function useInfiniteTasks(filters: TaskFilters) {
  return useInfiniteQuery({
    queryKey: taskKeys.list(filters),
    queryFn: async ({ pageParam = 0 }) => {
      const { data } = await apiClient.get<PaginatedResponse<Task>>('/tasks', {
        params: { ...filters, page: pageParam, limit: 50 },
      });
      return data;
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: 0,
  });
}
```

### 2. Client State - Zustand

**Use for**: UI state that doesn't need to persist or sync with server.

```typescript
// stores/ui-store.ts
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface UIState {
  // Modals
  isTaskModalOpen: boolean;
  selectedTaskId: string | null;
  openTaskModal: (taskId: string) => void;
  closeTaskModal: () => void;

  // Selections
  selectedItems: Set<string>;
  toggleSelection: (id: string) => void;
  clearSelection: () => void;

  // Sidebar
  isSidebarOpen: boolean;
  toggleSidebar: () => void;

  // Filters (ephemeral, not in URL)
  quickFilter: string;
  setQuickFilter: (filter: string) => void;
}

export const useUIStore = create<UIState>()(
  devtools(
    (set) => ({
      // Initial state
      isTaskModalOpen: false,
      selectedTaskId: null,
      selectedItems: new Set(),
      isSidebarOpen: true,
      quickFilter: '',

      // Actions
      openTaskModal: (taskId) =>
        set({ isTaskModalOpen: true, selectedTaskId: taskId }),
      closeTaskModal: () =>
        set({ isTaskModalOpen: false, selectedTaskId: null }),

      toggleSelection: (id) =>
        set((state) => {
          const newSelection = new Set(state.selectedItems);
          if (newSelection.has(id)) {
            newSelection.delete(id);
          } else {
            newSelection.add(id);
          }
          return { selectedItems: newSelection };
        }),

      clearSelection: () => set({ selectedItems: new Set() }),

      toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),

      setQuickFilter: (filter) => set({ quickFilter: filter }),
    }),
    { name: 'ui-store' }
  )
);
```

#### Usage in Components

```tsx
'use client';

import { useUIStore } from '@/stores/ui-store';

export function TaskList() {
  const { openTaskModal, selectedItems, toggleSelection } = useUIStore();

  return (
    <div>
      {tasks.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          isSelected={selectedItems.has(task.id)}
          onSelect={() => toggleSelection(task.id)}
          onOpen={() => openTaskModal(task.id)}
        />
      ))}
    </div>
  );
}
```

#### Slice Pattern for Large Stores

```typescript
// stores/slices/selection-slice.ts
export interface SelectionSlice {
  selectedItems: Set<string>;
  toggleSelection: (id: string) => void;
  clearSelection: () => void;
}

export const createSelectionSlice = (set): SelectionSlice => ({
  selectedItems: new Set(),
  toggleSelection: (id) =>
    set((state) => {
      const newSelection = new Set(state.selectedItems);
      if (newSelection.has(id)) {
        newSelection.delete(id);
      } else {
        newSelection.add(id);
      }
      return { selectedItems: newSelection };
    }),
  clearSelection: () => set({ selectedItems: new Set() }),
});

// stores/ui-store.ts
export const useUIStore = create<UIState>()(
  devtools(
    (...a) => ({
      ...createSelectionSlice(...a),
      ...createSidebarSlice(...a),
      ...createModalSlice(...a),
    }),
    { name: 'ui-store' }
  )
);
```

### 3. Form State - React Hook Form + Zod

**Use for**: Complex forms with validation.

```typescript
// components/forms/create-task-form.tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCreateTask } from '@/hooks/use-tasks';

const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(2000).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  assigneeId: z.string().optional(),
  dueDate: z.date().optional(),
  tags: z.array(z.string()).max(10),
});

type CreateTaskFormData = z.infer<typeof createTaskSchema>;

export function CreateTaskForm({ onSuccess }: CreateTaskFormProps) {
  const createTask = useCreateTask();

  const form = useForm<CreateTaskFormData>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: {
      title: '',
      description: '',
      priority: 'medium',
      tags: [],
    },
  });

  const onSubmit = async (data: CreateTaskFormData) => {
    try {
      await createTask.mutateAsync(data);
      form.reset();
      onSuccess?.();
    } catch (error) {
      // Error handled by mutation
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <FormField
        control={form.control}
        name="title"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Title</FormLabel>
            <FormControl>
              <Input placeholder="Task title" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* More fields... */}

      <Button type="submit" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? 'Creating...' : 'Create Task'}
      </Button>
    </form>
  );
}
```

### 4. URL State - nuqs

**Use for**: Shareable state (filters, pagination, search, tabs).

```typescript
// app/(dashboard)/tasks/page.tsx
'use client';

import { useQueryState, parseAsString, parseAsInteger } from 'nuqs';

export function TasksPage() {
  const [search, setSearch] = useQueryState('search', parseAsString.withDefault(''));
  const [status, setStatus] = useQueryState('status', parseAsString.withDefault('all'));
  const [page, setPage] = useQueryState('page', parseAsInteger.withDefault(1));

  const { data: tasks } = useTasks({ search, status, page });

  return (
    <div>
      <SearchInput value={search} onChange={setSearch} />
      <StatusFilter value={status} onChange={setStatus} />
      <TaskList tasks={tasks} />
      <Pagination page={page} onPageChange={setPage} />
    </div>
  );
}

// URL updates automatically: /tasks?search=fix&status=open&page=2
// Shareable, bookmarkable, back/forward navigation works
```

### 5. Real-time State - Socket.io Integration

**Use for**: Live updates to server state.

```typescript
// lib/socket.ts
import { io, Socket } from 'socket.io-client';
import { queryClient } from '@/lib/api-client';
import { taskKeys } from '@/hooks/use-tasks';

let socket: Socket | null = null;

export function initializeSocket(tenantId: string) {
  if (socket?.connected) return socket;

  socket = io(process.env.NEXT_PUBLIC_WS_URL!, {
    auth: { tenantId },
    transports: ['websocket'],
  });

  // Task events
  socket.on('task:created', (task) => {
    queryClient.setQueryData(taskKeys.lists(), (old: Task[] = []) => [task, ...old]);
    queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
  });

  socket.on('task:updated', (task) => {
    queryClient.setQueryData(taskKeys.detail(task.id), task);
    queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
  });

  socket.on('task:deleted', (taskId) => {
    queryClient.removeQueries({ queryKey: taskKeys.detail(taskId) });
    queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
  });

  // Agent events
  socket.on('agent:status-changed', (agent) => {
    queryClient.setQueryData(agentKeys.detail(agent.id), agent);
  });

  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
```

#### Usage in Components

```tsx
'use client';

import { useEffect } from 'react';
import { initializeSocket, disconnectSocket } from '@/lib/socket';
import { useTenantContext } from '@/lib/tenant-context';

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { tenantId } = useTenantContext();

  useEffect(() => {
    if (!tenantId) return;

    const socket = initializeSocket(tenantId);

    return () => {
      disconnectSocket();
    };
  }, [tenantId]);

  return <>{children}</>;
}
```

### 6. Global Context - React Context

**Use for**: Tenant context, user, theme, feature flags.

```typescript
// lib/tenant-context.tsx
'use client';

import { createContext, useContext, ReactNode } from 'react';
import type { Tenant, User } from '@forge/shared-types';

interface TenantContextValue {
  tenant: Tenant;
  user: User;
  hasPermission: (permission: string) => boolean;
  hasFeature: (feature: string) => boolean;
}

const TenantContext = createContext<TenantContextValue | null>(null);

export function TenantProvider({
  tenant,
  user,
  children,
}: {
  tenant: Tenant;
  user: User;
  children: ReactNode;
}) {
  const hasPermission = (permission: string) => {
    return user.permissions.includes(permission);
  };

  const hasFeature = (feature: string) => {
    return tenant.features.includes(feature);
  };

  return (
    <TenantContext.Provider value={{ tenant, user, hasPermission, hasFeature }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenantContext() {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenantContext must be used within TenantProvider');
  }
  return context;
}
```

## Cache Invalidation Strategy

### Manual Invalidation

```typescript
// After mutation
queryClient.invalidateQueries({ queryKey: taskKeys.lists() });

// Refetch immediately
queryClient.refetchQueries({ queryKey: taskKeys.lists() });

// Remove specific query
queryClient.removeQueries({ queryKey: taskKeys.detail(taskId) });
```

### Automatic Invalidation via Tags

```typescript
const mutation = useMutation({
  mutationFn: updateTask,
  onSuccess: (data) => {
    // Invalidate related queries
    queryClient.invalidateQueries({ queryKey: taskKeys.detail(data.id) });
    queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
    queryClient.invalidateQueries({ queryKey: workflowKeys.detail(data.workflowId) });
  },
});
```

### Time-based Invalidation

```typescript
useQuery({
  queryKey: ['analytics'],
  queryFn: getAnalytics,
  staleTime: 30 * 60 * 1000, // 30 minutes
  gcTime: 60 * 60 * 1000, // 1 hour
});
```

## Performance Considerations

### Query Deduplication
TanStack Query automatically deduplicates identical queries.

### Prefetching
```typescript
// Prefetch on hover
const prefetchTask = (taskId: string) => {
  queryClient.prefetchQuery({
    queryKey: taskKeys.detail(taskId),
    queryFn: () => getTask(taskId),
  });
};

<TaskRow onMouseEnter={() => prefetchTask(task.id)} />
```

### Selective Re-renders
```typescript
// Only re-render when specific data changes
const taskTitle = useTask(taskId, {
  select: (data) => data.title,
});
```

### Suspense Integration
```typescript
const { data } = useSuspenseQuery({
  queryKey: taskKeys.detail(taskId),
  queryFn: () => getTask(taskId),
});

// No loading state needed - handled by Suspense boundary
```

## Consequences

### Positive
- **Type Safety**: Full type safety with TypeScript and Zod
- **Optimal Performance**: Minimal re-renders, intelligent caching
- **Great DX**: Simple APIs, minimal boilerplate
- **Real-time**: Seamless integration with WebSocket
- **Testable**: Easy to mock queries and mutations
- **Debugging**: DevTools for both Query and Zustand

### Negative
- **Learning Curve**: Team needs to learn multiple libraries
- **Bundle Size**: Multiple state management libraries
- **Complexity**: Need to know which tool to use when

### Mitigations
- **Documentation**: Clear guidelines on when to use each tool
- **Examples**: Reference implementations for common patterns
- **Code Review**: Ensure consistent usage
- **Tree Shaking**: Only import what's used

## Alternatives Considered

### Redux Toolkit + RTK Query
**Rejected**: More boilerplate, less performant, harder to use.

### Jotai / Recoil
**Rejected**: Less mature, smaller ecosystem, more complex.

### SWR
**Rejected**: Less features than TanStack Query, less active development.

### Apollo Client
**Rejected**: GraphQL only, we're using REST/tRPC.

### Context + useReducer
**Rejected**: Too much boilerplate, no caching, poor performance.

## References
- [TanStack Query Documentation](https://tanstack.com/query/latest)
- [Zustand Documentation](https://zustand-demo.pmnd.rs/)
- [React Hook Form](https://react-hook-form.com/)
- [Zod](https://zod.dev/)
- [nuqs](https://nuqs.47ng.com/)

## Review Date
2024-05-16 (3 months)
