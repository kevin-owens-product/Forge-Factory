# Frontend Architecture Specification

**Version:** 1.0
**Date:** 2026-01-19
**Status:** Draft

---

## Overview

This document defines the complete frontend architecture for Forge Factory, built with Next.js 14, React 18, and TypeScript. The architecture follows modern best practices with server-side rendering, optimistic updates, and a component-driven approach.

---

## Technology Stack

### Core Framework

```json
{
  "framework": "Next.js 14.0+",
  "runtime": "React 18.2+",
  "language": "TypeScript 5.0+",
  "buildTool": "Turbopack",
  "packageManager": "pnpm"
}
```

**Rationale:**
- **Next.js 14:** App Router, Server Components, Server Actions, optimized bundling
- **React 18:** Concurrent rendering, Suspense, automatic batching
- **TypeScript:** Type safety, better DX, fewer runtime errors
- **Turbopack:** 700x faster than Webpack for local development
- **pnpm:** Faster installs, disk space efficient

### UI Libraries

```typescript
// package.json
{
  "dependencies": {
    "@radix-ui/react-*": "^1.0.0",      // Accessible primitives
    "tailwindcss": "^3.4.0",             // Utility-first CSS
    "class-variance-authority": "^0.7.0", // Variant handling
    "clsx": "^2.0.0",                    // Conditional classes
    "tailwind-merge": "^2.0.0",          // Merge Tailwind classes
    "lucide-react": "^0.300.0",          // Icons
    "recharts": "^2.10.0",               // Charts
    "d3": "^7.8.0",                      // Complex visualizations
    "@monaco-editor/react": "^4.6.0",    // Code editor
    "react-hook-form": "^7.48.0",        // Form handling
    "zod": "^3.22.0",                    // Schema validation
    "@tanstack/react-query": "^5.0.0",   // Server state
    "zustand": "^4.4.0",                 // Client state
    "sonner": "^1.2.0",                  // Toast notifications
    "vaul": "^0.9.0"                     // Drawers
  }
}
```

### State Management Strategy

```typescript
/**
 * State Management Philosophy:
 *
 * 1. Server State: React Query (async, cached, synchronized)
 * 2. Client State: Zustand (global UI state)
 * 3. URL State: Next.js searchParams (shareable state)
 * 4. Form State: React Hook Form (local form state)
 */

// Server State - React Query
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useRepository(id: string) {
  return useQuery({
    queryKey: ['repository', id],
    queryFn: () => api.repositories.get(id),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Client State - Zustand
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

interface AppState {
  sidebarOpen: boolean;
  theme: 'light' | 'dark' | 'system';
  toggleSidebar: () => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

export const useAppStore = create<AppState>()(
  devtools(
    persist(
      (set) => ({
        sidebarOpen: true,
        theme: 'system',
        toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
        setTheme: (theme) => set({ theme }),
      }),
      { name: 'app-storage' }
    )
  )
);

// URL State - Next.js
'use client';
import { useSearchParams, useRouter } from 'next/navigation';

export function useFilters() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const filters = {
    search: searchParams.get('search') || '',
    status: searchParams.get('status') || 'all',
  };

  const setFilters = (newFilters: Partial<typeof filters>) => {
    const params = new URLSearchParams(searchParams);
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });
    router.push(`?${params.toString()}`);
  };

  return { filters, setFilters };
}

// Form State - React Hook Form
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
});

export function MyForm() {
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      description: '',
    },
  });

  const onSubmit = form.handleSubmit(async (data) => {
    await api.create(data);
  });

  return <form onSubmit={onSubmit}>...</form>;
}
```

---

## Project Structure

```
apps/web/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Auth layout group
│   │   ├── login/
│   │   ├── register/
│   │   └── layout.tsx
│   ├── (app)/                    # Authenticated app layout
│   │   ├── dashboard/
│   │   ├── repositories/
│   │   │   ├── [id]/
│   │   │   │   ├── analysis/
│   │   │   │   ├── refactorings/
│   │   │   │   └── settings/
│   │   │   └── page.tsx
│   │   ├── settings/
│   │   └── layout.tsx
│   ├── api/                      # API routes (if needed)
│   │   └── webhooks/
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Landing page
│   └── globals.css
├── components/                   # React components
│   ├── ui/                       # Base UI components (shadcn)
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   └── ...
│   ├── features/                 # Feature-specific components
│   │   ├── repository/
│   │   │   ├── repository-card.tsx
│   │   │   ├── repository-list.tsx
│   │   │   └── repository-form.tsx
│   │   ├── analysis/
│   │   │   ├── ai-readiness-score.tsx
│   │   │   ├── metrics-chart.tsx
│   │   │   └── recommendations-list.tsx
│   │   └── refactoring/
│   ├── layouts/                  # Layout components
│   │   ├── app-sidebar.tsx
│   │   ├── app-header.tsx
│   │   └── app-layout.tsx
│   └── providers/                # Context providers
│       ├── query-provider.tsx
│       ├── theme-provider.tsx
│       └── auth-provider.tsx
├── lib/                          # Utilities
│   ├── api/                      # API client
│   │   ├── client.ts
│   │   ├── repositories.ts
│   │   ├── analysis.ts
│   │   └── types.ts
│   ├── hooks/                    # Custom hooks
│   │   ├── use-repository.ts
│   │   ├── use-analysis.ts
│   │   └── use-toast.ts
│   ├── utils/                    # Utility functions
│   │   ├── cn.ts                 # Class name merger
│   │   ├── format.ts             # Formatters
│   │   └── validation.ts
│   └── store/                    # Zustand stores
│       ├── app-store.ts
│       └── user-store.ts
├── styles/                       # Global styles
│   └── globals.css
├── public/                       # Static assets
│   ├── images/
│   └── fonts/
├── types/                        # TypeScript types
│   ├── api.ts
│   └── models.ts
├── middleware.ts                 # Next.js middleware
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## Routing Architecture

### App Router Structure

```typescript
/**
 * Route Groups:
 * (auth) - Authentication pages (login, register, forgot-password)
 * (app) - Authenticated application pages
 * (marketing) - Public marketing pages
 */

// app/(app)/layout.tsx - Authenticated layout
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppSidebar />
      <div className="flex-1 flex flex-col">
        <AppHeader />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </>
  );
}

// app/(app)/repositories/[id]/page.tsx - Dynamic route
export default async function RepositoryPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { tab?: string };
}) {
  // Server Component - fetch data here
  const repository = await getRepository(params.id);

  return (
    <div>
      <RepositoryHeader repository={repository} />
      <RepositoryTabs defaultTab={searchParams.tab} />
    </div>
  );
}
```

### Protected Routes

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('auth-token');
  const isAuthPage = request.nextUrl.pathname.startsWith('/login');
  const isAppPage = request.nextUrl.pathname.startsWith('/dashboard');

  // Redirect to login if accessing app without token
  if (isAppPage && !token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Redirect to dashboard if accessing auth with token
  if (isAuthPage && token) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/repositories/:path*',
    '/settings/:path*',
    '/login',
    '/register',
  ],
};
```

---

## API Client Architecture

### Type-Safe API Client

```typescript
// lib/api/client.ts
import ky from 'ky';

export class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export const api = ky.create({
  prefixUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api',
  hooks: {
    beforeRequest: [
      (request) => {
        // Add auth token
        const token = localStorage.getItem('auth-token');
        if (token) {
          request.headers.set('Authorization', `Bearer ${token}`);
        }

        // Add organization context
        const orgId = localStorage.getItem('current-organization');
        if (orgId) {
          request.headers.set('X-Organization-Id', orgId);
        }
      },
    ],
    afterResponse: [
      async (request, options, response) => {
        if (!response.ok) {
          const error = await response.json();
          throw new APIError(
            error.error?.message || 'An error occurred',
            response.status,
            error.error?.code || 'UNKNOWN_ERROR',
            error.error?.details
          );
        }
      },
    ],
  },
});

// lib/api/repositories.ts - Domain-specific API
import { api } from './client';
import type { Repository, CreateRepositoryRequest } from '@/types/api';

export const repositories = {
  list: async (params?: {
    search?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ repositories: Repository[]; total: number }> => {
    return await api.get('v1/repositories', { searchParams: params }).json();
  },

  get: async (id: string): Promise<Repository> => {
    return await api.get(`v1/repositories/${id}`).json();
  },

  create: async (data: CreateRepositoryRequest): Promise<Repository> => {
    return await api.post('v1/repositories', { json: data }).json();
  },

  update: async (id: string, data: Partial<Repository>): Promise<Repository> => {
    return await api.patch(`v1/repositories/${id}`, { json: data }).json();
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`v1/repositories/${id}`);
  },

  analyze: async (id: string): Promise<{ analysisId: string }> => {
    return await api.post(`v1/repositories/${id}/analyze`).json();
  },
};

// Usage in React Query
export function useRepositories(params?: {
  search?: string;
  status?: string;
}) {
  return useQuery({
    queryKey: ['repositories', params],
    queryFn: () => repositories.list(params),
  });
}

export function useRepository(id: string) {
  return useQuery({
    queryKey: ['repository', id],
    queryFn: () => repositories.get(id),
    enabled: !!id,
  });
}

export function useCreateRepository() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: repositories.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repositories'] });
    },
  });
}
```

---

## Performance Optimization

### Code Splitting

```typescript
// Lazy load heavy components
import dynamic from 'next/dynamic';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
  loading: () => <EditorSkeleton />,
  ssr: false, // Don't render on server
});

const ComplexChart = dynamic(() => import('@/components/complex-chart'), {
  loading: () => <ChartSkeleton />,
});

// Route-based code splitting (automatic with Next.js)
// Each route in app/ directory is automatically code-split
```

### Image Optimization

```typescript
import Image from 'next/image';

export function RepositoryCard({ repository }: { repository: Repository }) {
  return (
    <div>
      <Image
        src={repository.ownerAvatar}
        alt={repository.owner}
        width={48}
        height={48}
        className="rounded-full"
        priority={false} // Lazy load
        placeholder="blur" // Show blur placeholder
        blurDataURL="data:image/jpeg;base64,..." // Base64 blur
      />
    </div>
  );
}
```

### Streaming & Suspense

```typescript
// app/(app)/repositories/[id]/page.tsx
import { Suspense } from 'react';

export default function RepositoryPage({ params }: { params: { id: string } }) {
  return (
    <div>
      {/* Instant: Static header */}
      <RepositoryHeader id={params.id} />

      {/* Streaming: Analysis data */}
      <Suspense fallback={<AnalysisSkeleton />}>
        <RepositoryAnalysis id={params.id} />
      </Suspense>

      {/* Streaming: Refactoring jobs */}
      <Suspense fallback={<RefactoringSkeleton />}>
        <RefactoringJobs id={params.id} />
      </Suspense>
    </div>
  );
}

// Server Component - fetches data
async function RepositoryAnalysis({ id }: { id: string }) {
  const analysis = await getLatestAnalysis(id);
  return <AnalysisResults analysis={analysis} />;
}
```

### Caching Strategy

```typescript
// Next.js fetch caching
export async function getRepository(id: string) {
  const res = await fetch(`${API_URL}/repositories/${id}`, {
    next: {
      revalidate: 60, // Revalidate every 60 seconds
      tags: ['repository', id], // Cache tags for invalidation
    },
  });
  return res.json();
}

// Revalidate on-demand
import { revalidateTag } from 'next/cache';

export async function updateRepository(id: string, data: any) {
  await api.repositories.update(id, data);
  revalidateTag('repository');
  revalidateTag(id);
}

// React Query caching
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
```

---

## Error Handling

### Error Boundaries

```typescript
// components/error-boundary.tsx
'use client';

import { Component, ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    // Send to error tracking service
    if (typeof window !== 'undefined' && window.Sentry) {
      window.Sentry.captureException(error);
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error!, () => {
          this.setState({ hasError: false, error: undefined });
        });
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
          <h2 className="text-2xl font-bold">Something went wrong</h2>
          <p className="text-muted-foreground">{this.state.error?.message}</p>
          <Button
            onClick={() => this.setState({ hasError: false, error: undefined })}
          >
            Try again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Usage
<ErrorBoundary fallback={(error, reset) => (
  <ErrorFallback error={error} reset={reset} />
)}>
  <MyComponent />
</ErrorBoundary>
```

### API Error Handling

```typescript
// lib/hooks/use-repository.ts
export function useRepository(id: string) {
  return useQuery({
    queryKey: ['repository', id],
    queryFn: () => repositories.get(id),
    retry: (failureCount, error) => {
      // Don't retry on 4xx errors
      if (error instanceof APIError && error.status >= 400 && error.status < 500) {
        return false;
      }
      return failureCount < 3;
    },
    onError: (error) => {
      if (error instanceof APIError) {
        if (error.status === 404) {
          toast.error('Repository not found');
        } else if (error.status === 403) {
          toast.error('You do not have permission to access this repository');
        } else {
          toast.error(error.message);
        }
      } else {
        toast.error('An unexpected error occurred');
      }
    },
  });
}
```

---

## Testing Strategy

### Unit Tests (Vitest + React Testing Library)

```typescript
// components/__tests__/repository-card.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { RepositoryCard } from '../repository-card';

describe('RepositoryCard', () => {
  const mockRepository = {
    id: '123',
    name: 'my-repo',
    owner: 'john-doe',
    aiReadinessScore: 75,
    updatedAt: '2024-01-01T00:00:00Z',
  };

  it('renders repository name', () => {
    render(<RepositoryCard repository={mockRepository} />);
    expect(screen.getByText('my-repo')).toBeInTheDocument();
  });

  it('displays AI readiness score', () => {
    render(<RepositoryCard repository={mockRepository} />);
    expect(screen.getByText('75')).toBeInTheDocument();
  });

  it('applies correct score color class', () => {
    render(<RepositoryCard repository={mockRepository} />);
    const score = screen.getByText('75');
    expect(score).toHaveClass('text-yellow-600'); // 60-79 is yellow
  });
});
```

### Integration Tests (Playwright)

```typescript
// e2e/repository-analysis.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Repository Analysis', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('should analyze repository and show results', async ({ page }) => {
    // Navigate to repository
    await page.goto('/repositories/123');

    // Click analyze button
    await page.click('button:has-text("Run Analysis")');

    // Wait for analysis to complete
    await page.waitForSelector('text=Analysis Complete', { timeout: 60000 });

    // Check AI-Readiness Score is displayed
    const score = await page.textContent('[data-testid="ai-readiness-score"]');
    expect(parseInt(score!)).toBeGreaterThanOrEqual(0);
    expect(parseInt(score!)).toBeLessThanOrEqual(100);

    // Check recommendations are shown
    await expect(page.locator('[data-testid="recommendation"]')).toHaveCount.greaterThan(0);
  });

  test('should handle analysis errors gracefully', async ({ page }) => {
    // Mock API to return error
    await page.route('**/api/v1/analysis/run', (route) => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: { message: 'Analysis failed' } }),
      });
    });

    await page.goto('/repositories/123');
    await page.click('button:has-text("Run Analysis")');

    // Check error toast appears
    await expect(page.locator('text=Analysis failed')).toBeVisible();
  });
});
```

### Visual Regression Tests (Chromatic/Percy)

```typescript
// .storybook/preview.tsx
import type { Preview } from '@storybook/react';
import '../app/globals.css';

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
    chromatic: {
      viewports: [375, 768, 1024, 1440], // Test multiple viewports
      pauseAnimationAtEnd: true,
    },
  },
};

export default preview;

// components/repository-card.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { RepositoryCard } from './repository-card';

const meta: Meta<typeof RepositoryCard> = {
  title: 'Features/Repository/RepositoryCard',
  component: RepositoryCard,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof RepositoryCard>;

export const Default: Story = {
  args: {
    repository: {
      id: '123',
      name: 'my-repo',
      owner: 'john-doe',
      aiReadinessScore: 75,
      updatedAt: '2024-01-01T00:00:00Z',
    },
  },
};

export const HighScore: Story = {
  args: {
    repository: {
      id: '123',
      name: 'my-repo',
      owner: 'john-doe',
      aiReadinessScore: 95,
      updatedAt: '2024-01-01T00:00:00Z',
    },
  },
};

export const LowScore: Story = {
  args: {
    repository: {
      id: '123',
      name: 'my-repo',
      owner: 'john-doe',
      aiReadinessScore: 25,
      updatedAt: '2024-01-01T00:00:00Z',
    },
  },
};
```

---

## Accessibility (a11y)

### WCAG 2.1 AA Compliance

```typescript
// All components must meet WCAG 2.1 AA standards

// 1. Keyboard Navigation
export function Dialog() {
  return (
    <RadixDialog.Root>
      <RadixDialog.Trigger asChild>
        <Button>Open Dialog</Button>
      </RadixDialog.Trigger>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="dialog-overlay" />
        <RadixDialog.Content
          className="dialog-content"
          onEscapeKeyDown={() => {}} // ESC to close
          aria-describedby={undefined}
        >
          <RadixDialog.Title>Dialog Title</RadixDialog.Title>
          <RadixDialog.Description>
            Dialog description for screen readers
          </RadixDialog.Description>
          {/* Focus trap automatically handled by Radix */}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

// 2. ARIA Labels
export function RepositoryCard({ repository }: Props) {
  return (
    <article
      aria-label={`Repository: ${repository.name}`}
      role="article"
    >
      <h3 id={`repo-${repository.id}`}>{repository.name}</h3>
      <div
        aria-labelledby={`repo-${repository.id}`}
        aria-describedby={`score-${repository.id}`}
      >
        <span id={`score-${repository.id}`}>
          AI-Readiness Score: {repository.aiReadinessScore}
        </span>
      </div>
    </article>
  );
}

// 3. Color Contrast
// All text must meet 4.5:1 contrast ratio (AA standard)
// Defined in Tailwind config
const colors = {
  text: {
    primary: '#09090B',    // Contrast: 20.83:1 on white
    secondary: '#71717A',  // Contrast: 4.61:1 on white
  },
  background: {
    primary: '#FFFFFF',
    secondary: '#F4F4F5',
  },
};

// 4. Focus Indicators
// tailwind.config.ts
module.exports = {
  theme: {
    extend: {
      ringColor: {
        DEFAULT: '#3B82F6', // Blue focus ring
      },
      ringOffsetWidth: {
        DEFAULT: '2px',
      },
    },
  },
};

// All interactive elements get focus ring
<Button className="focus:ring-2 focus:ring-offset-2 focus:ring-primary">
  Click me
</Button>

// 5. Screen Reader Support
export function AnalysisProgress({ progress }: { progress: number }) {
  return (
    <div>
      <div
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Analysis progress"
      >
        <div style={{ width: `${progress}%` }} />
      </div>
      <span className="sr-only">
        Analysis is {progress}% complete
      </span>
    </div>
  );
}
```

### Accessibility Testing

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    globals: true,
  },
});

// test/setup.ts
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(matchers);
expect.extend(toHaveNoViolations);

afterEach(() => {
  cleanup();
});

// components/__tests__/button.test.tsx
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import { Button } from '../button';

it('should not have accessibility violations', async () => {
  const { container } = render(<Button>Click me</Button>);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

---

## Monitoring & Analytics

### Performance Monitoring

```typescript
// lib/monitoring/web-vitals.ts
import { onCLS, onFID, onFCP, onLCP, onTTFB } from 'web-vitals';

function sendToAnalytics(metric: any) {
  // Send to analytics service
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', metric.name, {
      value: Math.round(metric.value),
      event_category: 'Web Vitals',
      event_label: metric.id,
      non_interaction: true,
    });
  }

  // Also send to custom analytics
  fetch('/api/analytics/web-vitals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(metric),
  });
}

export function reportWebVitals() {
  onCLS(sendToAnalytics);
  onFID(sendToAnalytics);
  onFCP(sendToAnalytics);
  onLCP(sendToAnalytics);
  onTTFB(sendToAnalytics);
}

// app/layout.tsx
'use client';

import { useEffect } from 'react';
import { reportWebVitals } from '@/lib/monitoring/web-vitals';

export default function RootLayout({ children }) {
  useEffect(() => {
    reportWebVitals();
  }, []);

  return <html>{children}</html>;
}
```

### Error Tracking (Sentry)

```typescript
// lib/monitoring/sentry.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  integrations: [
    new Sentry.Replay({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
});

// Catch API errors
export function captureAPIError(error: APIError, context?: Record<string, any>) {
  Sentry.captureException(error, {
    tags: {
      type: 'api_error',
      status: error.status,
      code: error.code,
    },
    extra: context,
  });
}
```

### User Analytics (PostHog)

```typescript
// lib/analytics/posthog.ts
import posthog from 'posthog-js';

export function initPostHog() {
  if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      api_host: 'https://app.posthog.com',
      loaded: (posthog) => {
        if (process.env.NODE_ENV === 'development') posthog.debug();
      },
    });
  }
}

// Track events
export const analytics = {
  track: (event: string, properties?: Record<string, any>) => {
    posthog.capture(event, properties);
  },

  identify: (userId: string, traits?: Record<string, any>) => {
    posthog.identify(userId, traits);
  },

  page: () => {
    posthog.capture('$pageview');
  },
};

// Usage in components
function AnalyzeButton({ repositoryId }: { repositoryId: string }) {
  const handleClick = () => {
    analytics.track('analysis_started', {
      repository_id: repositoryId,
      source: 'button_click',
    });
    // ... trigger analysis
  };

  return <Button onClick={handleClick}>Analyze</Button>;
}
```

---

## Build & Deployment

### Build Configuration

```javascript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,

  // Image optimization
  images: {
    domains: ['github.com', 'avatars.githubusercontent.com'],
    formats: ['image/avif', 'image/webp'],
  },

  // Experimental features
  experimental: {
    optimizeCss: true,
    optimizePackageImports: ['@radix-ui/react-icons', 'lucide-react'],
  },

  // Environment variables
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },

  // Headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
        ],
      },
    ];
  },

  // Webpack config
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Don't bundle these server-only packages on client
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
```

### CI/CD Pipeline

```yaml
# .github/workflows/frontend.yml
name: Frontend CI/CD

on:
  push:
    branches: [main, develop]
    paths:
      - 'apps/web/**'
      - 'packages/**'
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - uses: actions/setup-node@v3
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Type check
        run: pnpm tsc --noEmit

      - name: Lint
        run: pnpm eslint .

      - name: Unit tests
        run: pnpm test:unit

      - name: Build
        run: pnpm build
        env:
          NEXT_PUBLIC_API_URL: ${{ secrets.API_URL }}

  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Install Playwright
        run: pnpm exec playwright install --with-deps

      - name: Run E2E tests
        run: pnpm test:e2e

      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/

  deploy:
    needs: [test, e2e]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

---

## Performance Targets

| Metric | Target | Description |
|--------|--------|-------------|
| **First Contentful Paint (FCP)** | < 1.8s | First content painted |
| **Largest Contentful Paint (LCP)** | < 2.5s | Largest element visible |
| **Time to Interactive (TTI)** | < 3.8s | Page fully interactive |
| **Cumulative Layout Shift (CLS)** | < 0.1 | Visual stability |
| **First Input Delay (FID)** | < 100ms | Interaction responsiveness |
| **Bundle Size (JS)** | < 250KB | Gzipped JavaScript |
| **Lighthouse Score** | > 90 | Overall performance |

---

## Development Workflow

### Local Development

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Run with HTTPS (for OAuth testing)
pnpm dev:https

# Type check (watch mode)
pnpm tsc --watch --noEmit

# Lint
pnpm lint

# Format
pnpm format

# Run tests
pnpm test          # All tests
pnpm test:unit     # Unit tests only
pnpm test:e2e      # E2E tests only
pnpm test:watch    # Watch mode

# Storybook
pnpm storybook

# Build
pnpm build

# Preview production build
pnpm start
```

### Code Quality

```json
// .eslintrc.json
{
  "extends": [
    "next/core-web-vitals",
    "plugin:@typescript-eslint/recommended",
    "plugin:jsx-a11y/recommended",
    "prettier"
  ],
  "plugins": ["@typescript-eslint", "jsx-a11y"],
  "rules": {
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "@typescript-eslint/no-explicit-any": "warn",
    "jsx-a11y/anchor-is-valid": ["error", {
      "components": ["Link"],
      "specialLink": ["hrefLeft", "hrefRight"],
      "aspects": ["invalidHref", "preferButton"]
    }]
  }
}

// .prettierrc
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false
}
```

---

**Status:** Living document - update as architecture evolves
