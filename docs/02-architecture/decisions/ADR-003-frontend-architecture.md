# ADR-003: Frontend Architecture and Technology Stack

## Status
Accepted

## Context
We need to build two separate frontend applications for Forge Factory:
1. **Portal** - Customer-facing SPA for developers and teams
2. **Admin** - Operations dashboard for internal support and monitoring

Both applications need to be:
- Fast, responsive, and scalable
- Type-safe with excellent DX
- SEO-friendly (Portal only)
- Support real-time updates
- Accessible (WCAG 2.1 AA compliance)
- Optimized for bundle size and performance

## Decision
We will use **Next.js 14+ (App Router)** with **React 18+** for both applications, with a shared component library.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Monorepo Structure                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  apps/portal/              apps/admin/                       │
│  ├── app/                  ├── app/                          │
│  │   ├── (auth)/          │   ├── dashboard/                │
│  │   ├── (dashboard)/     │   ├── tenants/                  │
│  │   └── api/             │   └── monitoring/               │
│  ├── components/           ├── components/                   │
│  └── lib/                  └── lib/                          │
│                                                              │
│  packages/ui/              packages/shared-types/            │
│  ├── components/           └── api-contracts/                │
│  ├── hooks/                                                  │
│  └── utils/                packages/api-client/              │
│                            └── generated/                    │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack

#### Core Framework
- **Next.js 14+** - App Router with React Server Components
- **React 18+** - UI library with concurrent features
- **TypeScript 5.6+** - Type safety across the stack

#### Styling
- **Tailwind CSS 3.4+** - Utility-first CSS framework
- **shadcn/ui** - Accessible component library built on Radix UI
- **CSS Modules** - For component-specific styles when needed
- **Tailwind Variants** - Type-safe variant management

#### State Management
- **Zustand** - Simple, fast state management for client state
- **TanStack Query v5** - Server state management, caching, and data fetching
- **React Context** - For theme, tenant context, and feature flags

#### Forms and Validation
- **React Hook Form** - Performant forms with minimal re-renders
- **Zod** - Schema validation (shared with backend)
- **@hookform/resolvers** - Bridge between RHF and Zod

#### Data Fetching
- **TanStack Query** - Data fetching, caching, and synchronization
- **Axios** - HTTP client with interceptors
- **tRPC** (Future) - End-to-end typesafe APIs

#### Real-time Communication
- **Socket.io Client** - Real-time updates for tasks, workflows, agents
- **EventSource** (SSE) - Server-sent events for notifications

#### Routing and Navigation
- **Next.js App Router** - File-based routing with layouts
- **next/navigation** - Programmatic navigation
- **nuqs** - Type-safe URL state management

#### UI Components
- **shadcn/ui** - Base component library
- **Radix UI** - Unstyled, accessible primitives
- **Lucide React** - Icon library
- **Recharts** - Chart library for analytics
- **React Table v8** - Table component with sorting, filtering, pagination
- **React DnD** - Drag-and-drop for task boards and workflows

#### Development Tools
- **Storybook** - Component development and documentation
- **Playwright** - E2E testing
- **Vitest** - Unit and integration testing
- **Testing Library** - Component testing
- **Chromatic** - Visual regression testing

#### Build and Optimization
- **Turbopack** - Next.js 14 bundler (dev mode)
- **SWC** - Fast TypeScript/JavaScript compiler
- **next/image** - Automatic image optimization
- **next/font** - Font optimization with zero layout shift

#### Performance Monitoring
- **Vercel Analytics** - Real user monitoring
- **Sentry** - Error tracking and performance monitoring
- **Lighthouse CI** - Performance budgets in CI

### Portal Application Structure

```
apps/portal/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   ├── signup/
│   │   └── sso/
│   ├── (dashboard)/
│   │   ├── layout.tsx              # Dashboard shell with nav
│   │   ├── page.tsx                # Home dashboard
│   │   ├── repositories/           # Repository management
│   │   ├── analysis/               # Code analysis results
│   │   ├── tasks/                  # Task management
│   │   ├── workflows/              # Workflow builder & execution
│   │   ├── agents/                 # Agent management
│   │   ├── team/                   # Team & collaboration
│   │   ├── settings/               # User & org settings
│   │   └── integrations/           # GitHub, GitLab, etc.
│   ├── api/                        # API routes (auth callbacks)
│   └── layout.tsx                  # Root layout
├── components/
│   ├── dashboard/                  # Dashboard-specific components
│   ├── analysis/                   # Analysis visualizations
│   ├── tasks/                      # Task components
│   ├── workflows/                  # Workflow builder components
│   └── agents/                     # Agent components
├── lib/
│   ├── api-client.ts               # API client instance
│   ├── auth.ts                     # Auth utilities
│   ├── hooks/                      # Custom React hooks
│   └── stores/                     # Zustand stores
├── middleware.ts                   # Auth and tenant middleware
├── next.config.js
└── package.json
```

### Admin Application Structure

```
apps/admin/
├── app/
│   ├── dashboard/
│   │   └── page.tsx                # Metrics overview
│   ├── tenants/
│   │   ├── page.tsx                # Tenant list
│   │   └── [id]/                   # Tenant details
│   ├── monitoring/
│   │   ├── logs/                   # Audit logs
│   │   ├── errors/                 # Error tracking
│   │   └── performance/            # Performance metrics
│   ├── support/
│   │   ├── tickets/                # Support tickets
│   │   └── impersonate/            # Tenant impersonation
│   └── system/
│       ├── health/                 # System health
│       └── configuration/          # System config
├── components/
│   ├── monitoring/
│   ├── tenants/
│   └── support/
└── lib/
    └── admin-api-client.ts
```

### Shared Component Library

```
packages/ui/
├── components/
│   ├── button/
│   │   ├── button.tsx
│   │   ├── button.stories.tsx
│   │   └── button.test.tsx
│   ├── form/
│   ├── data-table/
│   ├── charts/
│   ├── code-viewer/              # Syntax-highlighted code
│   ├── diff-viewer/              # Code diffs
│   ├── task-board/               # Kanban board
│   ├── workflow-builder/         # Visual workflow builder
│   └── agent-status/             # Agent monitoring
├── hooks/
│   ├── use-tenant.ts
│   ├── use-permissions.ts
│   └── use-feature-flags.ts
├── utils/
│   ├── cn.ts                     # className utility
│   └── format.ts                 # Formatting utilities
└── styles/
    └── globals.css
```

### Rendering Strategy

#### Server Components (Default)
Use for:
- Static content
- SEO-critical pages
- Initial data fetching
- Layouts and shells

```tsx
// app/(dashboard)/repositories/page.tsx
async function RepositoriesPage() {
  const repos = await getRepositories(); // Server-side fetch
  return <RepositoryList repos={repos} />;
}
```

#### Client Components
Use for:
- Interactive UI (forms, modals, drag-and-drop)
- Real-time updates
- Client-only state (Zustand stores)
- Browser APIs

```tsx
'use client';

export function TaskBoard() {
  const { tasks, moveTask } = useTaskStore();
  // Interactive drag-and-drop
}
```

#### Hybrid Approach
```tsx
// Server Component (shell)
async function TasksPage() {
  const initialTasks = await getTasks();

  return (
    <>
      <TasksHeader /> {/* Server Component */}
      <TaskBoard initialTasks={initialTasks} /> {/* Client Component */}
    </>
  );
}
```

### Data Fetching Patterns

#### Pattern 1: Server Component + TanStack Query
```tsx
// Server Component - Initial load
async function AnalysisPage({ params }) {
  const analysis = await getAnalysis(params.id);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AnalysisDetails analysisId={params.id} />
    </HydrationBoundary>
  );
}

// Client Component - Real-time updates
'use client';
function AnalysisDetails({ analysisId }) {
  const { data: analysis } = useQuery({
    queryKey: ['analysis', analysisId],
    queryFn: () => getAnalysis(analysisId),
    refetchInterval: 5000, // Poll every 5s
  });
}
```

#### Pattern 2: Optimistic Updates
```tsx
const mutation = useMutation({
  mutationFn: updateTask,
  onMutate: async (newTask) => {
    // Optimistic update
    await queryClient.cancelQueries(['tasks']);
    const previous = queryClient.getQueryData(['tasks']);
    queryClient.setQueryData(['tasks'], (old) => [...old, newTask]);
    return { previous };
  },
  onError: (err, newTask, context) => {
    // Rollback on error
    queryClient.setQueryData(['tasks', context.previous);
  },
});
```

#### Pattern 3: Infinite Scroll
```tsx
const {
  data,
  fetchNextPage,
  hasNextPage,
} = useInfiniteQuery({
  queryKey: ['logs'],
  queryFn: ({ pageParam = 0 }) => getLogs(pageParam),
  getNextPageParam: (lastPage) => lastPage.nextCursor,
});
```

### Performance Optimization

#### Code Splitting
```tsx
// Lazy load heavy components
const WorkflowBuilder = dynamic(
  () => import('@/components/workflows/workflow-builder'),
  { ssr: false, loading: () => <Skeleton /> }
);
```

#### Image Optimization
```tsx
import Image from 'next/image';

<Image
  src="/logo.png"
  alt="Forge Factory"
  width={200}
  height={50}
  priority // Above the fold
/>
```

#### Bundle Analysis
```bash
# Analyze bundle size
ANALYZE=true pnpm build
```

### Accessibility

#### WCAG 2.1 AA Compliance
- All components use semantic HTML
- ARIA labels and roles
- Keyboard navigation
- Focus management
- Screen reader support

```tsx
<Button
  aria-label="Delete task"
  aria-describedby="delete-description"
  onClick={handleDelete}
>
  <Trash2Icon aria-hidden="true" />
</Button>
```

### Internationalization (Future)

```tsx
// app/[locale]/layout.tsx
import { NextIntlClientProvider } from 'next-intl';

export default function LocaleLayout({ children, params: { locale } }) {
  return (
    <NextIntlClientProvider locale={locale}>
      {children}
    </NextIntlClientProvider>
  );
}
```

## Consequences

### Positive
- **Type Safety**: End-to-end type safety with TypeScript and Zod
- **Performance**: Server Components + streaming for fast initial loads
- **SEO**: Built-in SSR and static generation
- **Developer Experience**: Hot reload, TypeScript, great tooling
- **Code Reuse**: Shared component library across apps
- **Modern Features**: React 18 features (Suspense, Transitions)
- **Accessibility**: Built-in with Radix UI and shadcn/ui

### Negative
- **Complexity**: App Router learning curve for team
- **Bundle Size**: Large initial bundle with all features
- **Server Components**: New paradigm requires training

### Mitigations
- **Documentation**: Comprehensive docs and examples
- **Training**: Team workshops on App Router and Server Components
- **Code Splitting**: Aggressive lazy loading
- **Performance Budgets**: Lighthouse CI enforces limits
- **Storybook**: Component documentation and examples

## Alternatives Considered

### 1. Separate Frameworks (Next.js + Vite SPA)
**Rejected**: Duplicates effort, different DX, harder to share code.

### 2. Remix
**Rejected**: Smaller ecosystem, less mature than Next.js, fewer features.

### 3. SvelteKit
**Rejected**: Smaller talent pool, less enterprise adoption, fewer resources.

### 4. Vue.js / Nuxt
**Rejected**: Team has more React experience, larger React ecosystem.

### 5. Pages Router (Next.js)
**Rejected**: App Router is the future, better performance with Server Components.

## Migration Path

### Phase 1: Foundation (Week 1-2)
- [ ] Set up Next.js apps (portal + admin)
- [ ] Configure Tailwind CSS and shadcn/ui
- [ ] Create shared component library package
- [ ] Set up TanStack Query and Zustand
- [ ] Configure TypeScript and ESLint

### Phase 2: Core Features (Week 3-6)
- [ ] Authentication flows (login, signup, SSO)
- [ ] Dashboard shell with navigation
- [ ] Repository management UI
- [ ] Task management UI
- [ ] Team management UI

### Phase 3: Advanced Features (Week 7-12)
- [ ] Workflow builder (visual)
- [ ] Agent management and monitoring
- [ ] Real-time updates (Socket.io)
- [ ] Advanced analytics dashboards
- [ ] Admin portal features

### Phase 4: Polish (Week 13-16)
- [ ] Performance optimization
- [ ] Accessibility audit and fixes
- [ ] E2E tests with Playwright
- [ ] Storybook documentation
- [ ] Production deployment

## References
- [Next.js Documentation](https://nextjs.org/docs)
- [React Server Components](https://react.dev/blog/2023/03/22/react-labs-what-we-have-been-working-on-march-2023#react-server-components)
- [shadcn/ui](https://ui.shadcn.com/)
- [TanStack Query](https://tanstack.com/query/latest)
- [Radix UI](https://www.radix-ui.com/)

## Review Date
2024-05-16 (3 months)
