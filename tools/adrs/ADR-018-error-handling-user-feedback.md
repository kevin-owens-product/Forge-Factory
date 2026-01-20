# ADR-018: Error Handling & User Feedback Patterns

## Status
Accepted

## Context

Enterprise SaaS requires robust error handling:
- **User Errors**: Invalid form input, expired sessions
- **API Errors**: 4xx client errors, 5xx server errors, network failures
- **Runtime Errors**: JavaScript exceptions, React errors
- **Expected Failures**: Quota exceeded, feature unavailable

### Requirements
- **User-Friendly**: Show helpful error messages (not stack traces)
- **Actionable**: Tell users what to do next ("Retry", "Contact support")
- **Monitored**: Log all errors to Sentry/Datadog
- **Recoverable**: Auto-retry transient failures
- **Contextual**: Different feedback for different error types

## Decision

### 1. Error Classification

```typescript
enum ErrorType {
  // User errors (400-level) - user can fix
  VALIDATION = 'validation',           // Invalid input
  AUTHENTICATION = 'authentication',   // Not logged in
  AUTHORIZATION = 'authorization',     // No permission
  NOT_FOUND = 'not_found',             // Resource doesn't exist
  CONFLICT = 'conflict',               // Duplicate, race condition

  // Server errors (500-level) - we need to fix
  SERVER = 'server',                   // Internal server error
  SERVICE_UNAVAILABLE = 'service_unavailable', // Maintenance, overload
  TIMEOUT = 'timeout',                 // Request took too long

  // Network errors - could be transient
  NETWORK = 'network',                 // No internet, DNS failure
  ABORT = 'abort',                     // Request cancelled

  // Client errors - bugs in our code
  RUNTIME = 'runtime',                 // JavaScript exception
  RENDERING = 'rendering',             // React render error
}
```

### 2. API Error Handling (React Query)

**Standard Error Response**:
```typescript
// Backend API returns consistent error format
interface ApiError {
  error: {
    type: ErrorType
    message: string        // User-friendly message
    code: string           // Error code (e.g., "QUOTA_EXCEEDED")
    details?: Record<string, any>
    requestId: string      // For support debugging
  }
}

// Example: 402 Payment Required
{
  "error": {
    "type": "authorization",
    "message": "You've exceeded your monthly quota. Upgrade to continue.",
    "code": "QUOTA_EXCEEDED",
    "details": {
      "current": 125000,
      "limit": 100000,
      "unit": "LOC"
    },
    "requestId": "req_1a2b3c"
  }
}
```

**Client Handling**:
```typescript
// packages/api-client/src/client.ts
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Don't retry user errors (4xx)
        if (error.status >= 400 && error.status < 500) return false

        // Retry server errors (5xx) up to 3 times
        if (error.status >= 500 && failureCount < 3) return true

        // Retry network errors
        if (error.type === 'network' && failureCount < 3) return true

        return false
      },

      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

      onError: (error: ApiError) => {
        // Log to Sentry
        Sentry.captureException(error, {
          extra: {
            requestId: error.requestId,
            code: error.code,
          },
        })

        // Show toast notification
        handleApiError(error)
      },
    },

    mutations: {
      onError: (error: ApiError) => {
        Sentry.captureException(error)
        handleApiError(error)
      },
    },
  },
})

// Error toast handler
function handleApiError(error: ApiError) {
  const { type, message, code } = error.error

  switch (type) {
    case 'validation':
      toast.error('Validation Error', { description: message })
      break

    case 'authentication':
      toast.error('Session Expired', {
        description: 'Please log in again.',
        action: <Button onClick={() => router.push('/login')}>Log In</Button>,
      })
      break

    case 'authorization':
      if (code === 'QUOTA_EXCEEDED') {
        toast.error('Quota Exceeded', {
          description: message,
          action: <Button onClick={() => router.push('/billing')}>Upgrade</Button>,
        })
      } else {
        toast.error('Access Denied', { description: message })
      }
      break

    case 'server':
      toast.error('Server Error', {
        description: 'Something went wrong. Please try again.',
        action: <Button onClick={retry}>Retry</Button>,
      })
      break

    case 'network':
      toast.error('Network Error', {
        description: 'Check your internet connection.',
      })
      break

    default:
      toast.error('Error', { description: message })
  }
}
```

### 3. Form Validation Errors

**React Hook Form + Zod**:
```typescript
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'

const schema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters').max(100),
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[0-9]/, 'Password must contain a number'),
})

export function SignupForm() {
  const form = useForm({
    resolver: zodResolver(schema),
  })

  const { errors } = form.formState

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <div>
        <Label htmlFor="name">Name</Label>
        <Input id="name" {...form.register('name')} />
        {errors.name && (
          <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>
        )}
      </div>

      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" {...form.register('email')} />
        {errors.email && (
          <p className="text-sm text-red-500 mt-1">{errors.email.message}</p>
        )}
      </div>

      <Button type="submit" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? 'Creating account...' : 'Sign Up'}
      </Button>
    </form>
  )
}
```

### 4. React Error Boundaries

**Global Error Boundary**:
```typescript
// app/error.tsx (Next.js 14)
'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'
import { Button } from '@packages/ui'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h2 className="text-2xl font-bold mb-4">Something went wrong!</h2>
      <p className="text-slate-600 mb-6">
        We've been notified and are working on a fix.
      </p>
      <div className="flex gap-4">
        <Button onClick={reset}>Try Again</Button>
        <Button variant="outline" onClick={() => router.push('/dashboard')}>
          Go to Dashboard
        </Button>
      </div>
      {process.env.NODE_ENV === 'development' && (
        <pre className="mt-8 p-4 bg-slate-100 rounded text-xs overflow-auto max-w-2xl">
          {error.stack}
        </pre>
      )}
    </div>
  )
}
```

**Component-Level Error Boundary**:
```typescript
// components/error-boundary.tsx
import { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    Sentry.captureException(error, { extra: errorInfo })
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="p-4 bg-red-50 border border-red-200 rounded">
            <p className="text-red-800">Something went wrong in this component.</p>
          </div>
        )
      )
    }

    return this.props.children
  }
}

// Usage
<ErrorBoundary fallback={<ChartErrorFallback />}>
  <AnalyticsChart data={data} />
</ErrorBoundary>
```

### 5. Loading & Empty States

**Loading States**:
```typescript
// Skeleton loaders
import { Skeleton } from '@packages/ui'

export function RepositoryListSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-[250px]" />
            <Skeleton className="h-4 w-[200px]" />
          </div>
        </div>
      ))}
    </div>
  )
}

// Suspense boundaries
<Suspense fallback={<RepositoryListSkeleton />}>
  <RepositoryList />
</Suspense>
```

**Empty States**:
```typescript
export function EmptyState({
  icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="text-slate-400 mb-4">{icon}</div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-slate-600 mb-6">{description}</p>
      {action}
    </div>
  )
}

// Usage
{repositories.length === 0 && (
  <EmptyState
    icon={<GitBranchIcon className="h-16 w-16" />}
    title="No repositories yet"
    description="Connect your first repository to get started."
    action={<Button onClick={() => router.push('/repos/connect')}>Connect Repository</Button>}
  />
)}
```

### 6. Toast Notifications (Sonner)

**Implementation**:
```typescript
import { toast } from 'sonner'

// Success
toast.success('Repository connected', {
  description: 'Analysis will start automatically.',
})

// Error
toast.error('Failed to connect repository', {
  description: 'Please check your GitHub permissions.',
  action: {
    label: 'View Docs',
    onClick: () => window.open('/docs/github-integration'),
  },
})

// Loading (with promise)
toast.promise(
  apiClient.analysis.run(repoId),
  {
    loading: 'Starting analysis...',
    success: 'Analysis started successfully',
    error: 'Failed to start analysis',
  }
)

// Custom
toast.custom((t) => (
  <div className="bg-white border rounded-lg p-4 shadow-lg">
    <h4 className="font-semibold">Analysis Complete</h4>
    <p className="text-sm text-slate-600">Your AI-Readiness Score is 78/100</p>
    <Button onClick={() => router.push(`/analysis/${id}`)}>View Results</Button>
  </div>
))
```

### 7. Monitoring (Sentry)

**Configuration**:
```typescript
// sentry.client.config.ts
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1, // 10% of transactions
  replaysOnErrorSampleRate: 1.0, // 100% of errors
  replaysSessionSampleRate: 0.1, // 10% of sessions

  beforeSend(event, hint) {
    // Filter out non-actionable errors
    if (event.exception?.values?.[0]?.type === 'ChunkLoadError') {
      return null // User refreshed during deployment
    }

    // Add user context
    event.user = {
      id: getCurrentUserId(),
      email: getCurrentUserEmail(),
    }

    return event
  },
})
```

## Consequences

### Positive
- **User Experience**: Clear, actionable error messages
- **Debugging**: All errors logged to Sentry with context
- **Reliability**: Auto-retry transient failures
- **Monitoring**: Dashboard shows error rates, types

### Negative
- **Complexity**: Many error handling paths
- **Bundle Size**: Sentry adds ~30KB
- **Cost**: Sentry pricing ($26/month for 50K events)

### Mitigations
- Standardize error handling patterns (avoid duplication)
- Lazy-load Sentry on error (reduce initial bundle)
- Set error quotas (alert at 80% of monthly limit)

## Metrics
- **Error Rate**: < 2% of API calls
- **Unhandled Errors**: 0 (all caught by error boundaries)
- **Mean Time to Resolution**: < 4 hours for critical errors
- **User-Reported Errors**: < 5% (most caught proactively)

## References
- [React Error Boundaries](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary)
- [Sentry Documentation](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Sonner Toast](https://sonner.emilkowal.ski/)

---

**Document Version**: 1.0
**Last Updated**: 2026-01-20
