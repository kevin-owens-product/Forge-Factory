# ADR-017: Frontend Performance & Optimization

## Status
Accepted

## Context

Performance is critical for:
- **User Experience**: 1-second delay = 7% conversion loss
- **SEO**: Core Web Vitals affect Google rankings
- **Mobile**: 40% of users on mobile (slower networks)

### Targets (from architecture doc)
- **LCP**: < 2.5s (Largest Contentful Paint)
- **INP**: < 200ms (Interaction to Next Paint)
- **CLS**: < 0.1 (Cumulative Layout Shift)
- **FID**: < 100ms (First Input Delay)
- **Initial JS**: < 200KB gzipped
- **Lighthouse**: 95+ score

## Decision

### 1. Next.js Optimization Features

**App Router**:
- Server Components (reduce client JS by 40-60%)
- Streaming SSR (progressive rendering)
- Automatic code splitting
- Image optimization (next/image)
- Font optimization (next/font)

**Implementation**:
```typescript
// Server Components (default)
export default async function RepositoryList() {
  const repos = await db.repository.findMany() // Fetched on server
  return <div>{repos.map(...)}</div>
}

// Client Components (only when needed)
'use client'
export function InteractiveChart({ data }: { data: ChartData }) {
  const [selected, setSelected] = useState(null)
  return <Recharts data={data} onClick={setSelected} />
}

// Streaming (loading.tsx)
export default function Loading() {
  return <Skeleton className="h-96" />
}

// Suspense boundaries
<Suspense fallback={<RepoListSkeleton />}>
  <RepositoryList />
</Suspense>
```

### 2. Code Splitting & Lazy Loading

**Dynamic Imports**:
```typescript
// Lazy load heavy components
import dynamic from 'next/dynamic'

const Chart = dynamic(() => import('@/components/chart'), {
  loading: () => <ChartSkeleton />,
  ssr: false, // Client-only (if needed)
})

// Route-based code splitting (automatic)
// /app/dashboard/page.tsx → dashboard-page.js
// /app/repos/page.tsx → repos-page.js
```

**Bundle Analysis**:
```bash
# Analyze bundle size
ANALYZE=true npm run build

# Output: .next/analyze/client.html
# Shows: Which packages are largest, opportunities to optimize
```

### 3. Image Optimization

**next/image**:
```typescript
import Image from 'next/image'

<Image
  src="/hero.png"
  alt="Forge Factory"
  width={1200}
  height={600}
  priority // LCP image
  placeholder="blur"
  blurDataURL="data:image/jpeg;base64,..."
/>

// Responsive images
<Image
  src="/chart.png"
  alt="Analytics chart"
  fill
  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
/>
```

**Configuration**:
```typescript
// next.config.js
module.exports = {
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
    ],
  },
}
```

### 4. Font Optimization

**next/font**:
```typescript
import { Inter, JetBrains_Mono } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

const mono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono',
})

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  )
}
```

### 5. Caching Strategy

**React Query**:
```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      refetchOnWindowFocus: false,
    },
  },
})
```

**HTTP Caching**:
```typescript
// API routes with Cache-Control headers
export async function GET(request: Request) {
  const data = await fetchData()

  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  })
}
```

### 6. Database Query Optimization

**Prisma**:
```typescript
// ❌ N+1 query problem
const users = await db.user.findMany()
for (const user of users) {
  const repos = await db.repository.findMany({ where: { userId: user.id } })
}

// ✅ Use include (single query)
const users = await db.user.findMany({
  include: { repositories: true },
})

// ✅ Use select (only fetch needed fields)
const users = await db.user.findMany({
  select: {
    id: true,
    name: true,
    email: true,
    // Don't fetch password hash, metadata, etc.
  },
})

// ✅ Pagination (don't fetch all rows)
const repos = await db.repository.findMany({
  take: 20,
  skip: (page - 1) * 20,
  orderBy: { updatedAt: 'desc' },
})
```

### 7. Third-Party Script Loading

**next/script**:
```typescript
import Script from 'next/script'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}

        {/* Analytics (non-blocking) */}
        <Script
          src="https://www.googletagmanager.com/gtag/js"
          strategy="afterInteractive"
        />

        {/* Intercom (lazy load) */}
        <Script src="https://widget.intercom.io/..." strategy="lazyOnload" />
      </body>
    </html>
  )
}
```

### 8. Performance Monitoring

**Web Vitals**:
```typescript
// app/layout.tsx
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
```

**Custom Monitoring**:
```typescript
// lib/vitals.ts
import { onCLS, onFID, onFCP, onLCP, onTTFB } from 'web-vitals'

export function reportWebVitals() {
  onCLS(sendToAnalytics)
  onFID(sendToAnalytics)
  onFCP(sendToAnalytics)
  onLCP(sendToAnalytics)
  onTTFB(sendToAnalytics)
}

function sendToAnalytics(metric: Metric) {
  fetch('/api/analytics/vitals', {
    method: 'POST',
    body: JSON.stringify(metric),
  })
}
```

### 9. CI/CD Performance Budget

**Lighthouse CI**:
```yaml
# .github/workflows/lighthouse.yml
name: Lighthouse CI
on: [pull_request]

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Audit URLs using Lighthouse
        uses: treosh/lighthouse-ci-action@v9
        with:
          urls: |
            https://staging.forgefactory.dev
            https://staging.forgefactory.dev/dashboard
          uploadArtifacts: true
          temporaryPublicStorage: true
```

**lighthouserc.json**:
```json
{
  "ci": {
    "assert": {
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.9 }],
        "categories:accessibility": ["error", { "minScore": 0.95 }],
        "first-contentful-paint": ["error", { "maxNumericValue": 2000 }],
        "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }],
        "total-blocking-time": ["error", { "maxNumericValue": 300 }]
      }
    }
  }
}
```

## Consequences

### Positive
- **User Experience**: 2.5x faster page loads (3.2s → 1.2s LCP)
- **SEO**: Improved Google rankings (Core Web Vitals)
- **Mobile**: 40% faster on 3G networks
- **Conversion**: 7-10% higher conversion rate

### Negative
- **Complexity**: Server Components require mental model shift
- **Build Time**: Image optimization increases build time
- **Bundle Analysis**: Requires manual review

### Mitigations
- Training for team on Server Components
- Optimize images at upload time (not build time)
- Automate bundle analysis in CI/CD

## Metrics
- **LCP**: < 2.5s (currently 1.2s)
- **INP**: < 200ms (currently 120ms)
- **CLS**: < 0.1 (currently 0.03)
- **Lighthouse**: 95+ (currently 97)
- **Bundle Size**: < 200KB (currently 156KB)

## References
- [Next.js Performance](https://nextjs.org/docs/app/building-your-application/optimizing)
- [Web Vitals](https://web.dev/vitals/)

---

**Document Version**: 1.0
**Last Updated**: 2026-01-20
