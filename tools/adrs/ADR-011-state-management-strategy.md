# ADR-011: State Management Strategy

## Status
Accepted

## Context

Forge Factory's frontend applications require sophisticated state management across three distinct portals:

1. **User Portal**: Repository data, analysis results, refactoring jobs, user preferences
2. **Developer Portal**: API playground state, documentation navigation, code examples
3. **Admin Portal**: Organization data, user management, billing, audit logs, analytics

### Current Challenges

1. **Complexity Scale**: Managing state across 50+ pages, 200+ components
2. **Real-Time Updates**: WebSocket data (analysis progress, notifications) needs reactivity
3. **Optimistic Updates**: PRs, refactoring jobs need instant UI feedback
4. **Multi-Tenant Context**: Tenant switching must preserve/clear appropriate state
5. **Offline Support**: Cache data for poor network conditions
6. **DevTools**: Engineers need visibility into state for debugging
7. **Performance**: Minimize re-renders in data-heavy admin dashboards

### Requirements

- Support for **server state** (API data) vs **client state** (UI state)
- **Type safety**: Full TypeScript inference for all stores
- **DevTools**: Time-travel debugging for production issues
- **SSR Compatibility**: Works with Next.js Server Components
- **Bundle Size**: < 10KB total for state management libraries
- **Learning Curve**: Low enough for mid-level engineers
- **Performance**: Sub-100ms state updates, minimal re-renders

## Decision

We will use a **hybrid state management approach**:

### 1. **Zustand** for Global Client State
### 2. **TanStack Query (React Query)** for Server State
### 3. **React Hook Form** for Form State
### 4. **URL State** for Shareable UI State

## Architecture

```typescript
┌─────────────────────────────────────────────────────────────┐
│                    State Management Layers                   │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │   URL State      │  │  Local State     │                │
│  │  (Searchable)    │  │ (useState/Refs)  │                │
│  └──────────────────┘  └──────────────────┘                │
│           │                      │                           │
│  ┌────────▼──────────────────────▼────────┐                │
│  │      Zustand (Global Client State)     │                │
│  │  - UI preferences (theme, sidebar)     │                │
│  │  - Tenant context                      │                │
│  │  - Real-time WebSocket data            │                │
│  │  - Optimistic updates                  │                │
│  └────────────────────────────────────────┘                │
│           │                                                  │
│  ┌────────▼──────────────────────────────┐                │
│  │  TanStack Query (Server State)        │                │
│  │  - API data fetching & caching        │                │
│  │  - Background refetching              │                │
│  │  - Pagination & infinite scroll       │                │
│  └────────────────────────────────────────┘                │
│           │                                                  │
│  ┌────────▼──────────────────────────────┐                │
│  │       Backend API (Fastify)            │                │
│  └────────────────────────────────────────┘                │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Detailed Decisions

### 1. Zustand for Global Client State

**Selected**: Zustand v4.5+

**Rationale**:
- **Minimal Boilerplate**: 90% less code than Redux (no actions/reducers/dispatch)
- **Performance**: Fine-grained subscriptions (only re-render components using changed slice)
- **TypeScript**: Excellent inference, no manual type annotations needed
- **DevTools**: Redux DevTools integration for debugging
- **Bundle Size**: 1.2KB gzipped (vs Redux Toolkit 15KB)
- **SSR Compatible**: Works seamlessly with Next.js App Router
- **No Context**: Avoids React Context performance issues
- **Research**: Top choice for medium/large apps in 2026 (per Netguru, Syncfusion)

**Use Cases**:
- ✅ Theme preference (light/dark)
- ✅ Sidebar collapsed/expanded state
- ✅ Current tenant context
- ✅ WebSocket connection status
- ✅ Real-time notifications (before persisting to DB)
- ✅ Command palette open/closed
- ✅ Optimistic UI updates (e.g., starring a repo)

**Example Store**:
```typescript
// packages/store/src/tenant-store.ts
import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

interface Tenant {
  id: string
  name: string
  slug: string
  role: 'owner' | 'admin' | 'member' | 'viewer'
}

interface TenantStore {
  currentTenant: Tenant | null
  tenants: Tenant[]

  // Actions
  setCurrentTenant: (tenant: Tenant) => void
  switchTenant: (tenantId: string) => void
  addTenant: (tenant: Tenant) => void
}

export const useTenantStore = create<TenantStore>()(
  devtools(
    persist(
      (set, get) => ({
        currentTenant: null,
        tenants: [],

        setCurrentTenant: (tenant) =>
          set({ currentTenant: tenant }, false, 'tenant/setCurrent'),

        switchTenant: (tenantId) => {
          const tenant = get().tenants.find(t => t.id === tenantId)
          if (tenant) {
            set({ currentTenant: tenant }, false, 'tenant/switch')
            // Invalidate all React Query caches for new tenant
            queryClient.invalidateQueries()
          }
        },

        addTenant: (tenant) =>
          set(
            (state) => ({ tenants: [...state.tenants, tenant] }),
            false,
            'tenant/add'
          ),
      }),
      { name: 'tenant-storage' }
    ),
    { name: 'TenantStore' }
  )
)
```

**Store Organization**:
```
/packages/store/
  /src/
    tenant-store.ts        # Current tenant, tenant switching
    ui-store.ts            # Theme, sidebar, modals
    websocket-store.ts     # WebSocket connection, messages
    notifications-store.ts # Real-time notifications
    command-palette-store.ts # Command palette state
```

### 2. TanStack Query for Server State

**Selected**: TanStack Query (React Query) v5.17+

**Rationale**:
- **Automatic Caching**: Eliminates manual cache management
- **Background Refetching**: Keeps data fresh automatically
- **Optimistic Updates**: Built-in support for instant UI feedback
- **DevTools**: Powerful query inspector for debugging
- **TypeScript**: Full type inference with `@tanstack/react-query`
- **SSR Support**: Hydration utilities for Next.js
- **Bundle Size**: 13KB gzipped (worth it for features)
- **Industry Standard**: Used by Netflix, Google, Meta

**Use Cases**:
- ✅ Fetching repositories, analysis results, jobs
- ✅ Pagination & infinite scroll (repository lists)
- ✅ Polling (analysis job status every 5s)
- ✅ Mutations (create refactoring job, update settings)
- ✅ Optimistic updates (star repo, save CLAUDE.md)
- ✅ Cache invalidation (on tenant switch)

**Configuration**:
```typescript
// apps/portal/app/providers.tsx
'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState } from 'react'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Don't refetch on window focus in development
            refetchOnWindowFocus: process.env.NODE_ENV === 'production',
            // Cache for 5 minutes
            staleTime: 5 * 60 * 1000,
            // Retry failed requests 3 times
            retry: 3,
            // Exponential backoff
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
          },
          mutations: {
            // Retry mutations once
            retry: 1,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
```

**Example Usage**:
```typescript
// apps/portal/hooks/use-repositories.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@packages/api-client'

export function useRepositories(tenantId: string) {
  return useQuery({
    queryKey: ['repositories', tenantId],
    queryFn: () => apiClient.repositories.list({ tenantId }),
    // Refetch every 30 seconds if window is focused
    refetchInterval: 30 * 1000,
  })
}

export function useStarRepository() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (repoId: string) => apiClient.repositories.star(repoId),

    // Optimistic update
    onMutate: async (repoId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['repositories'] })

      // Snapshot previous value
      const previous = queryClient.getQueryData(['repositories'])

      // Optimistically update
      queryClient.setQueryData(['repositories'], (old: any) =>
        old.map((repo: any) =>
          repo.id === repoId ? { ...repo, starred: true } : repo
        )
      )

      return { previous }
    },

    // Rollback on error
    onError: (err, repoId, context) => {
      queryClient.setQueryData(['repositories'], context?.previous)
    },

    // Refetch on success
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repositories'] })
    },
  })
}
```

### 3. React Hook Form for Form State

**Selected**: React Hook Form v7.49+

**Rationale**:
- **Performance**: Uncontrolled components (minimal re-renders)
- **TypeScript**: Full type inference with Zod schema validation
- **Bundle Size**: 9KB gzipped
- **Accessibility**: Built-in error handling and ARIA attributes
- **Integration**: Works seamlessly with shadcn/ui form components
- **DevTools**: Form state inspector

**Use Cases**:
- ✅ Repository configuration forms
- ✅ Organization settings
- ✅ User profile updates
- ✅ Multi-step wizards (onboarding)

**Example**:
```typescript
// apps/portal/components/repository-form.tsx
'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'

const schema = z.object({
  name: z.string().min(3).max(100),
  description: z.string().max(500).optional(),
  visibility: z.enum(['public', 'private']),
})

type FormData = z.infer<typeof schema>

export function RepositoryForm() {
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      visibility: 'private',
    },
  })

  const onSubmit = form.handleSubmit(async (data) => {
    await apiClient.repositories.create(data)
  })

  return (
    <form onSubmit={onSubmit}>
      <input {...form.register('name')} />
      {form.formState.errors.name && (
        <span>{form.formState.errors.name.message}</span>
      )}
      {/* ... */}
    </form>
  )
}
```

### 4. URL State for Shareable UI

**Selected**: `nuqs` (Next.js URL Query String library)

**Rationale**:
- **Shareable**: Users can share URLs with filters, pagination, search
- **Type-Safe**: TypeScript support for query params
- **SSR Compatible**: Works with Next.js App Router
- **Bundle Size**: 2KB gzipped

**Use Cases**:
- ✅ Search queries (`?q=authentication`)
- ✅ Filters (`?status=completed&language=typescript`)
- ✅ Pagination (`?page=2`)
- ✅ Sort order (`?sort=created_at&order=desc`)
- ✅ Tab selection (`?tab=analytics`)

**Example**:
```typescript
import { useQueryState } from 'nuqs'

export function RepositoryList() {
  const [search, setSearch] = useQueryState('q')
  const [page, setPage] = useQueryState('page', { defaultValue: 1 })
  const [status, setStatus] = useQueryState('status')

  return (
    <>
      <input value={search || ''} onChange={(e) => setSearch(e.target.value)} />
      <RepositoryFilters status={status} onStatusChange={setStatus} />
      <Pagination page={page} onPageChange={setPage} />
    </>
  )
}
```

## State Decision Matrix

| State Type | Tool | Example |
|------------|------|---------|
| **Server Data** | TanStack Query | Repositories, analysis jobs, user data |
| **Global UI** | Zustand | Theme, sidebar, current tenant |
| **Local UI** | useState | Modal open/closed, dropdown expanded |
| **Form Data** | React Hook Form | Login form, settings form |
| **Real-Time** | Zustand + WebSocket | Live notifications, job progress |
| **Shareable** | URL (nuqs) | Search, filters, pagination |
| **Persistent** | Zustand (persist) | Theme, language preference |
| **Computed** | useMemo | Derived data (filter results) |

## Consequences

### Positive

1. **Performance**:
   - Zustand's fine-grained subscriptions reduce re-renders by 70%
   - React Query eliminates redundant API calls (95% cache hit rate)
   - Uncontrolled forms (React Hook Form) minimize re-renders

2. **Developer Experience**:
   - 90% less boilerplate than Redux
   - Excellent TypeScript inference (no manual types)
   - DevTools for debugging (Zustand + React Query)
   - Consistent patterns across all apps

3. **Type Safety**:
   - End-to-end type safety (API → Store → Component)
   - Zod schemas validate at runtime
   - Compiler catches state misuse

4. **User Experience**:
   - Optimistic updates (instant feedback)
   - Automatic background refetching (fresh data)
   - URL state enables sharing (e.g., "Here's the filtered view")

5. **Maintainability**:
   - Clear separation of concerns (server vs client state)
   - Colocated queries with components (easy to find)
   - Minimal global state (reduces coupling)

### Negative

1. **Learning Curve**:
   - Team needs to learn 4 tools (Zustand, React Query, RHF, nuqs)
   - Mental model shift: "What goes where?"
   - Onboarding takes 1-2 weeks for new engineers

2. **Bundle Size**:
   - Total: ~25KB gzipped (Zustand 1KB + React Query 13KB + RHF 9KB + nuqs 2KB)
   - Trade-off: Worth it for features, but must monitor

3. **Complexity**:
   - Hybrid approach = more decision-making
   - Cache invalidation can be tricky (React Query)
   - WebSocket + Zustand + React Query interactions need patterns

4. **Over-Fetching**:
   - React Query caches aggressively (may fetch stale data)
   - Need to tune `staleTime` and `cacheTime` per query

### Mitigations

1. **Learning Curve**:
   - **Action**: 1-day workshop on state management patterns
   - **Documentation**: Decision tree flowchart ("What tool do I use?")
   - **Examples**: Starter templates in `/examples` directory

2. **Bundle Size**:
   - **Action**: Bundle analyzer in CI (fail if > 200KB total)
   - **Monitoring**: Weekly bundle size dashboard
   - **Lazy Load**: Only load React Query DevTools in development

3. **Complexity**:
   - **Action**: Create `useRealtimeQuery` hook (Zustand + React Query integration)
   - **Linting**: ESLint rules to enforce patterns
   - **Code Review**: State management checklist

4. **Cache Invalidation**:
   - **Action**: Document invalidation patterns (tenant switch, mutations)
   - **Helper**: `useTenantAwareQuery` hook (auto-invalidates on tenant change)

## Implementation Patterns

### Pattern 1: Real-Time Data (WebSocket + Zustand + React Query)

```typescript
// Real-time analysis job updates
import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useWebSocketStore } from '@packages/store'

export function useAnalysisJob(jobId: string) {
  const { subscribe } = useWebSocketStore()

  const query = useQuery({
    queryKey: ['analysis', jobId],
    queryFn: () => apiClient.analysis.get(jobId),
  })

  useEffect(() => {
    // Subscribe to WebSocket updates
    const unsubscribe = subscribe(`analysis:${jobId}`, (message) => {
      // Update React Query cache with real-time data
      queryClient.setQueryData(['analysis', jobId], (old: any) => ({
        ...old,
        ...message.data,
      }))
    })

    return unsubscribe
  }, [jobId])

  return query
}
```

### Pattern 2: Tenant-Aware Queries

```typescript
// Automatically invalidate queries on tenant switch
import { useQuery } from '@tanstack/react-query'
import { useTenantStore } from '@packages/store'

export function useTenantAwareQuery<T>(
  key: string[],
  fetcher: (tenantId: string) => Promise<T>
) {
  const { currentTenant } = useTenantStore()

  return useQuery({
    queryKey: [...key, currentTenant?.id],
    queryFn: () => {
      if (!currentTenant) throw new Error('No tenant selected')
      return fetcher(currentTenant.id)
    },
    enabled: !!currentTenant,
  })
}

// Usage
const { data: repos } = useTenantAwareQuery(
  ['repositories'],
  (tenantId) => apiClient.repositories.list({ tenantId })
)
```

### Pattern 3: Optimistic Updates with Rollback

```typescript
export function useUpdateRepository() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: UpdateRepoData) =>
      apiClient.repositories.update(data.id, data),

    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: ['repositories', data.id] })

      const previous = queryClient.getQueryData(['repositories', data.id])

      queryClient.setQueryData(['repositories', data.id], (old: any) => ({
        ...old,
        ...data,
      }))

      return { previous }
    },

    onError: (err, data, context) => {
      queryClient.setQueryData(['repositories', data.id], context?.previous)
      toast.error('Failed to update repository')
    },

    onSettled: (data) => {
      queryClient.invalidateQueries({ queryKey: ['repositories', data?.id] })
    },
  })
}
```

## Alternatives Considered

### 1. Redux Toolkit (RTK)
- **Pros**: Industry standard, mature, excellent DevTools, RTK Query for server state
- **Cons**: Boilerplate (10x more code), steep learning curve, 15KB bundle
- **Rejected**: Too heavy for our needs, slower development velocity

### 2. Jotai (Atomic State)
- **Pros**: Fine-grained reactivity, 3KB bundle, primitive atoms
- **Cons**: New mental model, smaller community, less enterprise adoption
- **Rejected**: Team familiarity with Zustand higher, not worth switching

### 3. Recoil
- **Pros**: Facebook-backed, atomic state, time-travel debugging
- **Cons**: Still experimental, 21KB bundle, complex API
- **Rejected**: Bundle too large, uncertain future (low GitHub activity)

### 4. SWR (Vercel)
- **Pros**: Lightweight (5KB), built for Next.js, simple API
- **Cons**: Less feature-rich than React Query, no DevTools, no optimistic updates
- **Rejected**: React Query more mature and feature-complete

### 5. XState (State Machines)
- **Pros**: Predictable state transitions, visual editor
- **Cons**: 19KB bundle, steep learning curve, overkill for most use cases
- **Rejected**: Too complex for UI state, better for complex workflows only

### 6. MobX
- **Pros**: Simple, observable-based, minimal boilerplate
- **Cons**: Mutable state (harder to debug), 16KB bundle, less modern
- **Rejected**: Immutability preferred for predictability

## Metrics & Success Criteria

### Performance
- **Re-render Count**: Reduce by 70% (baseline: 450 re-renders/page, target: 135)
- **State Update Latency**: < 100ms from action to UI update
- **Cache Hit Rate**: 95%+ for React Query (reduce API calls)
- **Bundle Size**: < 30KB for all state management libraries

### Developer Experience
- **Development Speed**: 40% faster feature development (measured via velocity)
- **Bug Rate**: 50% reduction in state-related bugs (Sentry tracking)
- **Onboarding**: New engineers productive in < 2 weeks

### Code Quality
- **Boilerplate Reduction**: 90% less code vs Redux (measured via LOC)
- **Type Coverage**: 100% TypeScript strict mode compliance
- **Test Coverage**: 80%+ for state logic

## References

### Documentation
- [Zustand Documentation](https://docs.pmnd.rs/zustand)
- [TanStack Query Documentation](https://tanstack.com/query/latest)
- [React Hook Form Documentation](https://react-hook-form.com/)
- [nuqs Documentation](https://nuqs.47ng.com/)

### Research Sources
- [State Management in Modern Frontend Apps 2026](https://leapcell.io/blog/state-management-in-modern-frontend-applications)
- [5 React State Management Tools in 2025](https://www.syncfusion.com/blogs/post/react-state-management-libraries)
- [Frontend Design Patterns 2026](https://www.netguru.com/blog/frontend-design-patterns)

### Internal References
- ADR-010: Frontend Architecture & Component Library
- [Architecture Overview](/docs/technical/architecture.md)

## Review Date
April 2026 (3 months)

**Reviewers**: Engineering Lead, Senior Frontend Engineers

---

**Document Version**: 1.0
**Last Updated**: 2026-01-20
**Authors**: Architecture Team
**Approved By**: CTO
