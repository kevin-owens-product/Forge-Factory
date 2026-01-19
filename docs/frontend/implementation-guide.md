# Frontend Implementation Guide

**Version:** 1.0
**Date:** 2026-01-19
**Status:** Draft

---

## Setup & Installation

### Prerequisites

```bash
- Node.js 20+
- pnpm 8+
- Git
```

### Initial Setup

```bash
# Clone repository
git clone https://github.com/forge-factory/forge-factory.git
cd forge-factory

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env.local

# Run development server
pnpm dev
```

### Environment Variables

```bash
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_GITHUB_CLIENT_ID=your_client_id
NEXT_PUBLIC_SENTRY_DSN=your_sentry_dsn
NEXT_PUBLIC_POSTHOG_KEY=your_posthog_key
```

---

## Folder Structure Standards

```
apps/web/
├── app/                              # Next.js 14 App Router
│   ├── (auth)/                       # Auth pages (login, register)
│   ├── (app)/                        # Main app (dashboard, repos)
│   ├── api/                          # API routes (if needed)
│   ├── layout.tsx                    # Root layout
│   └── globals.css                   # Global styles
│
├── components/
│   ├── ui/                           # Base components (shadcn)
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   └── ...
│   ├── features/                     # Feature components
│   │   ├── repository/
│   │   │   ├── repository-card.tsx
│   │   │   ├── repository-list.tsx
│   │   │   └── repository-form.tsx
│   │   ├── analysis/
│   │   └── refactoring/
│   ├── layouts/                      # Layout components
│   └── providers/                    # Context providers
│
├── lib/
│   ├── api/                          # API client
│   ├── hooks/                        # Custom hooks
│   ├── utils/                        # Utilities
│   └── store/                        # State management
│
├── types/                            # TypeScript types
└── public/                           # Static assets
```

---

## Coding Conventions

### File Naming

```typescript
// Components: PascalCase
Button.tsx
RepositoryCard.tsx

// Utilities: kebab-case
format-date.ts
api-client.ts

// Hooks: camelCase with 'use' prefix
useRepository.ts
useAnalysis.ts

// Types: PascalCase
Repository.ts
AnalysisRun.ts
```

### Component Structure

```typescript
/**
 * @prompt-id forge-v4.1:component:repository-card:001
 * @generated-at 2026-01-19T00:00:00Z
 */

'use client'; // Only if client component

import { type FC } from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';

// 1. Types/Interfaces
interface RepositoryCardProps {
  repository: Repository;
  onSelect?: (id: string) => void;
}

// 2. Component
export const RepositoryCard: FC<RepositoryCardProps> = ({
  repository,
  onSelect,
}) => {
  // 3. Hooks (useState, useEffect, custom hooks)
  const { data, isLoading } = useAnalysis(repository.id);

  // 4. Handlers
  const handleClick = () => {
    onSelect?.(repository.id);
  };

  // 5. Early returns
  if (isLoading) {
    return <RepositoryCardSkeleton />;
  }

  // 6. Render
  return (
    <Card onClick={handleClick}>
      <CardHeader>
        <CardTitle>{repository.name}</CardTitle>
      </CardHeader>
    </Card>
  );
};

// 7. Display name (for debugging)
RepositoryCard.displayName = 'RepositoryCard';
```

### TypeScript Best Practices

```typescript
// Use interfaces for objects
interface User {
  id: string;
  name: string;
  email: string;
}

// Use types for unions/intersections
type Status = 'pending' | 'completed' | 'failed';
type UserWithStatus = User & { status: Status };

// Use generics for reusable types
interface APIResponse<T> {
  data: T;
  error?: string;
}

// Avoid any - use unknown instead
function parseJSON(json: string): unknown {
  return JSON.parse(json);
}

// Use const assertions
const STATUSES = ['pending', 'completed', 'failed'] as const;
type Status = typeof STATUSES[number];

// Use satisfies for type checking
const config = {
  apiUrl: 'https://api.example.com',
  timeout: 5000,
} satisfies Config;
```

---

## Component Patterns

### Server Components (Default)

```typescript
// app/(app)/repositories/page.tsx
import { getRepositories } from '@/lib/api/repositories';

// Server Component - fetches on server
export default async function RepositoriesPage() {
  // Direct database/API calls
  const repositories = await getRepositories();

  return (
    <div>
      <h1>Repositories</h1>
      <RepositoryList repositories={repositories} />
    </div>
  );
}
```

### Client Components

```typescript
// components/repository-list.tsx
'use client';

import { useState } from 'react';

export function RepositoryList({ repositories }: { repositories: Repository[] }) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div>
      {repositories.map((repo) => (
        <RepositoryCard
          key={repo.id}
          repository={repo}
          isSelected={selected === repo.id}
          onSelect={setSelected}
        />
      ))}
    </div>
  );
}
```

### Composition Pattern

```typescript
// Good: Composition
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
  </CardHeader>
  <CardContent>Content</CardContent>
</Card>

// Avoid: Prop drilling
<Card
  title="Title"
  content="Content"
  footer={<Button />}
  headerProps={{}}
/>
```

### Custom Hooks Pattern

```typescript
// lib/hooks/use-repository.ts
export function useRepository(id: string) {
  return useQuery({
    queryKey: ['repository', id],
    queryFn: () => api.repositories.get(id),
    enabled: !!id,
  });
}

export function useRepositories(filters?: RepositoryFilters) {
  return useQuery({
    queryKey: ['repositories', filters],
    queryFn: () => api.repositories.list(filters),
  });
}

export function useCreateRepository() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.repositories.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repositories'] });
    },
  });
}

// Usage in component
function RepositoryPage({ params }: { params: { id: string } }) {
  const { data: repository, isLoading } = useRepository(params.id);

  if (isLoading) return <Skeleton />;

  return <div>{repository.name}</div>;
}
```

---

## Data Fetching Patterns

### React Query Setup

```typescript
// app/providers.tsx
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

### Optimistic Updates

```typescript
export function useUpdateRepository() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateRepositoryRequest) =>
      api.repositories.update(data.id, data),

    // Optimistic update
    onMutate: async (variables) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['repository', variables.id] });

      // Snapshot current value
      const previous = queryClient.getQueryData(['repository', variables.id]);

      // Optimistically update
      queryClient.setQueryData(['repository', variables.id], (old: Repository) => ({
        ...old,
        ...variables,
      }));

      return { previous };
    },

    // Rollback on error
    onError: (err, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['repository', variables.id], context.previous);
      }
      toast.error('Failed to update repository');
    },

    // Refetch on success
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['repository', variables.id] });
      toast.success('Repository updated');
    },
  });
}
```

### Infinite Queries (Pagination)

```typescript
export function useRepositoriesInfinite(filters?: RepositoryFilters) {
  return useInfiniteQuery({
    queryKey: ['repositories', 'infinite', filters],
    queryFn: ({ pageParam = 0 }) =>
      api.repositories.list({
        ...filters,
        offset: pageParam,
        limit: 20,
      }),
    getNextPageParam: (lastPage, allPages) => {
      const totalFetched = allPages.reduce((sum, page) => sum + page.repositories.length, 0);
      return totalFetched < lastPage.total ? totalFetched : undefined;
    },
  });
}

// Usage
function RepositoryList() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useRepositoriesInfinite();

  return (
    <>
      {data?.pages.map((page) =>
        page.repositories.map((repo) => (
          <RepositoryCard key={repo.id} repository={repo} />
        ))
      )}

      {hasNextPage && (
        <Button onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
          {isFetchingNextPage ? 'Loading...' : 'Load More'}
        </Button>
      )}
    </>
  );
}
```

---

## Form Handling

### React Hook Form + Zod

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().optional(),
  settings: z.object({
    autoAnalyze: z.boolean(),
    autoPr: z.boolean(),
  }),
});

type FormValues = z.infer<typeof schema>;

export function RepositoryForm() {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      description: '',
      settings: {
        autoAnalyze: true,
        autoPr: false,
      },
    },
  });

  const onSubmit = async (data: FormValues) => {
    try {
      await api.repositories.create(data);
      toast.success('Repository created');
    } catch (error) {
      toast.error('Failed to create repository');
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Creating...' : 'Create'}
        </Button>
      </form>
    </Form>
  );
}
```

---

## Testing Standards

### Unit Tests

```typescript
// components/__tests__/repository-card.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { RepositoryCard } from '../repository-card';

describe('RepositoryCard', () => {
  const mockRepo = {
    id: '123',
    name: 'my-repo',
    owner: 'john-doe',
    aiReadinessScore: 75,
  };

  it('renders repository name', () => {
    render(<RepositoryCard repository={mockRepo} />);
    expect(screen.getByText('my-repo')).toBeInTheDocument();
  });

  it('calls onSelect when clicked', async () => {
    const onSelect = vi.fn();
    render(<RepositoryCard repository={mockRepo} onSelect={onSelect} />);

    await userEvent.click(screen.getByRole('article'));
    expect(onSelect).toHaveBeenCalledWith('123');
  });
});
```

### Integration Tests (Playwright)

```typescript
// e2e/repository-flow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Repository Management', () => {
  test('should create and analyze repository', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password');
    await page.click('button[type="submit"]');

    // Create repository
    await page.goto('/repositories/new');
    await page.fill('[name="name"]', 'test-repo');
    await page.click('button[type="submit"]');

    // Verify redirect
    await expect(page).toHaveURL(/\/repositories\/[a-z0-9-]+/);

    // Check repository name
    await expect(page.getByText('test-repo')).toBeVisible();
  });
});
```

---

## Performance Optimization

### Image Optimization

```typescript
import Image from 'next/image';

// Optimized image
<Image
  src="/hero.png"
  alt="Hero"
  width={1200}
  height={630}
  priority // Above fold
  placeholder="blur"
  blurDataURL="data:..." // Low quality placeholder
/>
```

### Code Splitting

```typescript
// Lazy load heavy components
import dynamic from 'next/dynamic';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
  loading: () => <Skeleton className="h-[600px]" />,
  ssr: false,
});

const Chart = dynamic(() => import('./chart'), {
  loading: () => <ChartSkeleton />,
});
```

### Memoization

```typescript
import { useMemo, memo } from 'react';

// useMemo for expensive calculations
function RepositoryList({ repositories }: Props) {
  const sortedRepos = useMemo(() => {
    return [...repositories].sort((a, b) =>
      b.aiReadinessScore - a.aiReadinessScore
    );
  }, [repositories]);

  return <div>{sortedRepos.map(...)}</div>;
}

// memo for expensive components
export const RepositoryCard = memo(function RepositoryCard({ repository }: Props) {
  return <Card>...</Card>;
});
```

---

## Deployment Checklist

### Pre-Deploy

- [ ] All tests passing (`pnpm test`)
- [ ] Type check passing (`pnpm tsc`)
- [ ] Linter passing (`pnpm lint`)
- [ ] Build successful (`pnpm build`)
- [ ] Environment variables configured
- [ ] Analytics configured (PostHog/GA)
- [ ] Error tracking configured (Sentry)
- [ ] Performance monitoring enabled

### Post-Deploy

- [ ] Smoke tests passed
- [ ] Core user flows tested
- [ ] Performance metrics within target
- [ ] No console errors
- [ ] Lighthouse score > 90

---

## Common Issues & Solutions

### Issue: Hydration Mismatch

```typescript
// ❌ Bad: Different content on server vs client
<div>{new Date().toLocaleString()}</div>

// ✅ Good: Suppress hydration warning
<div suppressHydrationWarning>
  {new Date().toLocaleString()}
</div>

// ✅ Better: Only render on client
const [mounted, setMounted] = useState(false);

useEffect(() => {
  setMounted(true);
}, []);

if (!mounted) return null;

return <div>{new Date().toLocaleString()}</div>;
```

### Issue: Large Bundle Size

```bash
# Analyze bundle
pnpm build
pnpm next build --analyze

# Solutions:
# 1. Dynamic imports
# 2. Remove unused dependencies
# 3. Use lighter alternatives
```

---

**Status:** Living document - update as implementation patterns evolve
