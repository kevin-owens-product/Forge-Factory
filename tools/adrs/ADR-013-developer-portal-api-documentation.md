# ADR-013: Developer Portal & API Documentation Platform

## Status
Accepted

## Context

Forge Factory is positioning itself as an **enterprise platform** that integrates into existing development workflows. Developer experience (DX) is critical for:

1. **API Adoption**: 70%+ of enterprise customers integrate via API (vs using UI)
2. **Ecosystem Growth**: Third-party tools, CI/CD plugins, IDE extensions
3. **Self-Service**: Reduce support burden (80% of dev questions answerable via docs)
4. **Trust**: High-quality docs signal product maturity (Stripe, Twilio benchmark)

### Current Challenges

1. **API Complexity**: 50+ endpoints across 8 microservices
2. **Multiple Audiences**:
   - **Integration Engineers**: Need quick-start guides, code samples
   - **DevOps Teams**: Need CI/CD integration examples
   - **Plugin Developers**: Need SDK documentation, webhooks
3. **Discoverability**: Users don't know what's possible
4. **Authentication**: API keys, OAuth, JWT—multiple auth methods
5. **Versioning**: Breaking changes need clear migration paths

### Requirements (from Research)

Based on [Developer Portal Best Practices 2026](https://devspheretechnologies.com/api-developer-portal-guide/):

- ✅ **Interactive API Playground**: Test endpoints without writing code
- ✅ **Auto-Generated Docs**: From OpenAPI spec (single source of truth)
- ✅ **Code Samples**: 5+ languages (TypeScript, Python, Go, Java, cURL)
- ✅ **SDKs**: Official client libraries with type safety
- ✅ **Webhooks**: Real-time event notifications
- ✅ **Search**: Fast, accurate search across all docs
- ✅ **Versioning**: Clear v1, v2 migration guides
- ✅ **API Keys Management**: Self-service key creation/rotation
- ✅ **Usage Analytics**: Show rate limits, quota usage
- ✅ **Self-Service Registration**: No sales call required

### Success Metrics

- **Adoption**: 60%+ of enterprise customers use API within 30 days
- **Time to First Call**: < 5 minutes from signup to successful API call
- **Support Deflection**: 80%+ of dev questions answered by docs
- **API Errors**: < 2% error rate (proper validation, clear errors)
- **Documentation NPS**: 70+ (industry benchmark: Stripe 85, Twilio 78)

## Decision

We will build a **dedicated Developer Portal** (`/apps/docs`) with the following components:

### 1. Auto-Generated API Reference (OpenAPI/Swagger)
### 2. Interactive API Playground (Try It Now)
### 3. Official SDKs (TypeScript, Python, Go)
### 4. Code-Heavy Guides (Quick Start, Integration Patterns)
### 5. Webhook Documentation & Testing
### 6. API Key Management Dashboard
### 7. Fast Search (Algolia DocSearch)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  Developer Portal Stack                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Frontend (Next.js 14 + Nextra)                              │
│  ┌──────────────────────────────────────────────┐           │
│  │ /docs/                                        │           │
│  │  /getting-started                             │           │
│  │  /authentication                              │           │
│  │  /api-reference        ← Generated from spec  │           │
│  │  /sdks                                        │           │
│  │  /webhooks                                    │           │
│  │  /guides                                      │           │
│  │  /changelog                                   │           │
│  └──────────────────────────────────────────────┘           │
│           │                                                   │
│           ▼                                                   │
│  OpenAPI Spec (Single Source of Truth)                      │
│  ┌──────────────────────────────────────────────┐           │
│  │ /tools/openapi/                               │           │
│  │   forge-api-v1.yaml                           │           │
│  │   ├─ /repositories                            │           │
│  │   ├─ /analysis                                │           │
│  │   ├─ /refactoring                             │           │
│  │   └─ /webhooks                                │           │
│  └──────────────────────────────────────────────┘           │
│           │                                                   │
│           ▼                                                   │
│  Code Generation Pipeline                                    │
│  ┌──────────────────────────────────────────────┐           │
│  │ openapi-generator-cli                        │           │
│  │  → TypeScript SDK (@forge/sdk-ts)            │           │
│  │  → Python SDK (forge-sdk)                    │           │
│  │  → Go SDK (forge-go)                         │           │
│  │  → API Reference Markdown                    │           │
│  └──────────────────────────────────────────────┘           │
│           │                                                   │
│           ▼                                                   │
│  Interactive Playground (Scalar/Stoplight)                   │
│  ┌──────────────────────────────────────────────┐           │
│  │ Try API Endpoints                             │           │
│  │  - Use your API key                           │           │
│  │  - See request/response                       │           │
│  │  - Copy as cURL/code                          │           │
│  └──────────────────────────────────────────────┘           │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Detailed Decisions

### 1. Documentation Framework: Nextra (Next.js)

**Selected**: Nextra v3 (by Vercel)

**Rationale**:
- **Next.js-Based**: Leverages our existing stack (ADR-010)
- **MDX Support**: Write docs in Markdown with React components
- **Built-in Search**: Full-text search out of box
- **Git-Based**: Docs live in `/apps/docs` (version controlled)
- **Performance**: Static generation (sub-1s page loads)
- **SEO**: Server-side rendering for Google indexing
- **Used By**: Vercel, Next.js, SWR, Tailwind (proven at scale)

**Configuration**:
```typescript
// apps/docs/next.config.js
const withNextra = require('nextra')({
  theme: 'nextra-theme-docs',
  themeConfig: './theme.config.tsx',
  defaultShowCopyCode: true,
  staticImage: true,
})

module.exports = withNextra({
  // Next.js config
})

// apps/docs/theme.config.tsx
export default {
  logo: <span>Forge Factory Developer Docs</span>,
  project: {
    link: 'https://github.com/forge-factory/forge-api',
  },
  docsRepositoryBase: 'https://github.com/forge-factory/forge-docs',
  footer: {
    text: '© 2026 Forge Factory. API v1.',
  },
  search: {
    placeholder: 'Search documentation...',
  },
  primaryHue: 220, // Brand color
  sidebar: {
    defaultMenuCollapseLevel: 1,
  },
  toc: {
    backToTop: true,
  },
}
```

**Directory Structure**:
```
/apps/docs/
  /pages/
    index.mdx                 # Landing page
    /getting-started/
      quick-start.mdx         # First API call in 5 min
      authentication.mdx      # API keys, OAuth
      rate-limits.mdx         # Quotas, throttling
    /api-reference/
      _meta.json              # Sidebar config
      repositories.mdx        # Auto-generated
      analysis.mdx            # Auto-generated
      refactoring.mdx         # Auto-generated
    /guides/
      ci-cd-integration.mdx   # GitHub Actions, GitLab CI
      webhooks-setup.mdx      # Webhook configuration
      error-handling.mdx      # Retry logic, best practices
    /sdks/
      typescript.mdx          # @forge/sdk-ts
      python.mdx              # forge-sdk
      go.mdx                  # forge-go
    /webhooks/
      events.mdx              # Event types
      security.mdx            # Signature verification
    /changelog/
      v1.0.0.mdx
  /components/              # Custom MDX components
    api-endpoint.tsx        # Render endpoint card
    code-sample.tsx         # Multi-language code samples
    playground.tsx          # Embedded API playground
```

### 2. API Reference: Auto-Generated from OpenAPI

**Selected**: OpenAPI 3.1 + Scalar API Reference

**Rationale**:
- **Single Source of Truth**: Backend spec → Frontend docs (no drift)
- **Auto-Generated**: Changes to API automatically update docs
- **Interactive**: Built-in "Try It" playground
- **Beautiful**: Modern design (better than Swagger UI)
- **Fast**: React-based, no iframes
- **Open Source**: Scalar is MIT-licensed

**OpenAPI Spec Example**:
```yaml
# tools/openapi/forge-api-v1.yaml
openapi: 3.1.0
info:
  title: Forge Factory API
  version: 1.0.0
  description: AI-powered code refactoring platform
  contact:
    email: [email protected]
    url: https://forgefactory.dev/support

servers:
  - url: https://api.forgefactory.dev/v1
    description: Production
  - url: https://api-staging.forgefactory.dev/v1
    description: Staging

security:
  - ApiKeyAuth: []
  - BearerAuth: []

paths:
  /repositories:
    get:
      summary: List repositories
      description: Returns all repositories for the current tenant
      tags:
        - Repositories
      parameters:
        - name: page
          in: query
          schema:
            type: integer
            default: 1
        - name: limit
          in: query
          schema:
            type: integer
            default: 20
            maximum: 100
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      $ref: '#/components/schemas/Repository'
                  meta:
                    $ref: '#/components/schemas/PaginationMeta'
        '401':
          $ref: '#/components/responses/UnauthorizedError'
        '429':
          $ref: '#/components/responses/RateLimitError'

components:
  securitySchemes:
    ApiKeyAuth:
      type: apiKey
      in: header
      name: X-API-Key
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  schemas:
    Repository:
      type: object
      required:
        - id
        - name
        - url
      properties:
        id:
          type: string
          format: uuid
        name:
          type: string
          example: "acme-corp/api-service"
        url:
          type: string
          format: uri
          example: "https://github.com/acme-corp/api-service"
        language:
          type: string
          example: "TypeScript"
        linesOfCode:
          type: integer
          example: 125000
        aiReadinessScore:
          type: integer
          minimum: 0
          maximum: 100
          example: 62
        createdAt:
          type: string
          format: date-time
        updatedAt:
          type: string
          format: date-time
```

**Rendering in Nextra**:
```tsx
// apps/docs/pages/api-reference/repositories.mdx
import { ApiReference } from '@/components/api-reference'

# Repositories API

The Repositories API allows you to manage and analyze code repositories.

<ApiReference path="/repositories" method="GET" />

## List Repositories

Returns all repositories for the current tenant.

### Example Request

```typescript
const response = await forge.repositories.list({
  page: 1,
  limit: 20,
})
```

### Example Response

```json
{
  "data": [
    {
      "id": "repo_1a2b3c",
      "name": "acme-corp/api-service",
      "aiReadinessScore": 62
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 47
  }
}
```
```

### 3. Interactive API Playground: Scalar

**Selected**: Scalar API Reference Component

**Features**:
- **Try It Now**: Make real API calls from browser
- **Authentication**: Use your API key (secured)
- **Request Builder**: Fill form fields → generates cURL/code
- **Response Inspector**: View headers, body, status
- **Copy as Code**: Export to cURL, TypeScript, Python, Go

**Implementation**:
```tsx
// apps/docs/components/api-playground.tsx
'use client'

import { ApiReference } from '@scalar/api-reference-react'
import '@scalar/api-reference-react/style.css'

export function ApiPlayground() {
  return (
    <ApiReference
      configuration={{
        spec: {
          url: '/openapi/forge-api-v1.yaml',
        },
        authentication: {
          // User's API key from settings
          preferredSecurityScheme: 'ApiKeyAuth',
        },
        theme: 'default',
        layout: 'modern',
        showSidebar: true,
      }}
    />
  )
}

// Usage in MDX
import { ApiPlayground } from '@/components/api-playground'

# API Playground

Test Forge Factory APIs directly from your browser.

<ApiPlayground />
```

**User Flow**:
1. Navigate to `/docs/api-reference/playground`
2. Click "Add API Key" → Paste API key from `/settings/api-keys`
3. Select endpoint (e.g., `GET /repositories`)
4. Fill query params (page, limit)
5. Click "Send Request"
6. View response (JSON, headers, status)
7. Copy as cURL or code snippet

### 4. Official SDKs (Type-Safe Clients)

**Selected**: Auto-generated from OpenAPI spec

**Languages**:
1. **TypeScript** (`@forge/sdk-ts`) - Primary (70% of users)
2. **Python** (`forge-sdk`) - Data science, ML teams
3. **Go** (`forge-go`) - High-performance integrations

**Code Generation**:
```bash
# tools/scripts/generate-sdks.sh
#!/bin/bash

SPEC="tools/openapi/forge-api-v1.yaml"

# TypeScript SDK
openapi-generator-cli generate \
  -i $SPEC \
  -g typescript-fetch \
  -o packages/sdk-ts \
  --additional-properties=supportsES6=true,typescriptThreePlus=true

# Python SDK
openapi-generator-cli generate \
  -i $SPEC \
  -g python \
  -o packages/sdk-python \
  --additional-properties=packageName=forge_sdk

# Go SDK
openapi-generator-cli generate \
  -i $SPEC \
  -g go \
  -o packages/sdk-go \
  --additional-properties=packageName=forge

echo "✅ SDKs generated successfully"
```

**TypeScript SDK Example**:
```typescript
// packages/sdk-ts/src/index.ts
import { Configuration, RepositoriesApi } from './generated'

export class ForgeClient {
  private repos: RepositoriesApi

  constructor(apiKey: string, options?: { baseUrl?: string }) {
    const config = new Configuration({
      apiKey,
      basePath: options?.baseUrl || 'https://api.forgefactory.dev/v1',
    })

    this.repos = new RepositoriesApi(config)
  }

  get repositories() {
    return this.repos
  }

  // ... other APIs
}

// Usage (in docs)
import { ForgeClient } from '@forge/sdk-ts'

const forge = new ForgeClient(process.env.FORGE_API_KEY)

const repos = await forge.repositories.list({ page: 1, limit: 20 })
console.log(repos.data)
```

**SDK Documentation**:
```mdx
// apps/docs/pages/sdks/typescript.mdx

# TypeScript SDK

Official TypeScript SDK for Forge Factory API.

## Installation

```bash
npm install @forge/sdk-ts
```

## Quick Start

```typescript
import { ForgeClient } from '@forge/sdk-ts'

const forge = new ForgeClient(process.env.FORGE_API_KEY)

// List repositories
const repos = await forge.repositories.list()

// Run analysis
const analysis = await forge.analysis.run({
  repositoryId: 'repo_1a2b3c',
  config: {
    excludePaths: ['node_modules', 'dist'],
  },
})

// Check analysis status
const status = await forge.analysis.get(analysis.id)
console.log(status.progress) // 0-100
```

## Type Safety

The SDK is fully typed with TypeScript:

```typescript
import type { Repository, AnalysisRun } from '@forge/sdk-ts'

const repo: Repository = await forge.repositories.get('repo_1a2b3c')
//    ^? Repository { id: string; name: string; ... }
```

## Error Handling

```typescript
import { ForgeError } from '@forge/sdk-ts'

try {
  await forge.repositories.delete('repo_1a2b3c')
} catch (error) {
  if (error instanceof ForgeError) {
    console.error(`API Error ${error.status}: ${error.message}`)
  }
}
```
```

### 5. Webhook Documentation

**Approach**: Dedicated section with testing tool

**Content**:
```mdx
// apps/docs/pages/webhooks/events.mdx

# Webhook Events

Forge Factory sends webhook events when certain actions occur (e.g., analysis completed).

## Event Types

### `analysis.completed`

Sent when an analysis job finishes.

**Payload:**
```json
{
  "event": "analysis.completed",
  "id": "evt_1a2b3c",
  "createdAt": "2026-01-20T12:00:00Z",
  "data": {
    "analysisId": "analysis_xyz",
    "repositoryId": "repo_abc",
    "status": "completed",
    "aiReadinessScore": 62,
    "recommendations": 47
  }
}
```

### `refactoring.pr_created`

Sent when a refactoring PR is created.

## Webhook Configuration

1. Go to [Settings → Webhooks](/settings/webhooks)
2. Click "Add Endpoint"
3. Enter your URL: `https://yourdomain.com/webhooks/forge`
4. Select events to subscribe to
5. Copy the webhook secret (for signature verification)

## Security

Verify webhook signatures to prevent spoofing:

```typescript
import crypto from 'crypto'

function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const hmac = crypto.createHmac('sha256', secret)
  const digest = hmac.update(payload).digest('hex')
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(digest)
  )
}

// Express.js example
app.post('/webhooks/forge', (req, res) => {
  const signature = req.headers['x-forge-signature']
  const isValid = verifyWebhookSignature(
    JSON.stringify(req.body),
    signature,
    process.env.FORGE_WEBHOOK_SECRET
  )

  if (!isValid) {
    return res.status(401).send('Invalid signature')
  }

  // Process webhook
  res.sendStatus(200)
})
```

## Testing Webhooks

Use our webhook testing tool to send test events:

<WebhookTester />
```

**Webhook Tester Component**:
```tsx
// apps/docs/components/webhook-tester.tsx
'use client'

export function WebhookTester() {
  const [url, setUrl] = useState('')
  const [event, setEvent] = useState('analysis.completed')
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')

  const sendTestWebhook = async () => {
    setStatus('sending')
    try {
      await fetch('/api/webhooks/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, event }),
      })
      setStatus('success')
    } catch (error) {
      setStatus('error')
    }
  }

  return (
    <div className="border rounded-lg p-6">
      <h3>Test Webhook</h3>
      <input
        type="url"
        placeholder="https://yourdomain.com/webhooks/forge"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
      <select value={event} onChange={(e) => setEvent(e.target.value)}>
        <option value="analysis.completed">analysis.completed</option>
        <option value="refactoring.pr_created">refactoring.pr_created</option>
      </select>
      <button onClick={sendTestWebhook} disabled={status === 'sending'}>
        {status === 'sending' ? 'Sending...' : 'Send Test Event'}
      </button>
      {status === 'success' && <p>✅ Webhook sent successfully</p>}
      {status === 'error' && <p>❌ Failed to send webhook</p>}
    </div>
  )
}
```

### 6. API Key Management Dashboard

**Location**: `/apps/portal/app/settings/api-keys`

**Features**:
- Create API keys (with name/description)
- Rotate keys (generate new, revoke old)
- View usage (requests/day, quota usage)
- Scoped permissions (read-only, read-write)
- Expiration dates (optional)

**UI**:
```tsx
// apps/portal/app/settings/api-keys/page.tsx
export default async function ApiKeysPage() {
  const apiKeys = await db.apiKey.findMany({
    where: { userId: currentUser.id },
  })

  return (
    <div>
      <h1>API Keys</h1>
      <p>Manage your API keys for programmatic access.</p>

      <Button onClick={() => setShowCreateDialog(true)}>
        + Create API Key
      </Button>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Key</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Last Used</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {apiKeys.map((key) => (
            <TableRow key={key.id}>
              <TableCell>{key.name}</TableCell>
              <TableCell>
                <code>ff_***{key.keyPreview}</code>
                <Button variant="ghost" onClick={() => copyToClipboard(key.value)}>
                  Copy
                </Button>
              </TableCell>
              <TableCell>{formatDate(key.createdAt)}</TableCell>
              <TableCell>{formatDate(key.lastUsedAt)}</TableCell>
              <TableCell>
                <Button variant="destructive" onClick={() => revokeKey(key.id)}>
                  Revoke
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
```

### 7. Fast Search: Algolia DocSearch

**Selected**: Algolia DocSearch (free for open-source docs)

**Rationale**:
- **Fast**: Sub-50ms search (CDN-powered)
- **Relevant**: AI-powered ranking
- **Keyboard**: `Cmd+K` shortcut
- **Free**: For open-source documentation

**Configuration**:
```typescript
// apps/docs/theme.config.tsx
import { useRouter } from 'next/router'

export default {
  // ...
  search: {
    component: (
      <DocSearch
        appId="YOUR_APP_ID"
        apiKey="YOUR_SEARCH_KEY"
        indexName="forge-factory-docs"
      />
    ),
  },
}
```

## Page Structure

```
/apps/docs/pages/
  index.mdx                      # Landing: "Build with Forge Factory"
  /getting-started/
    quick-start.mdx              # First API call in 5 min
    authentication.mdx           # API keys, OAuth
    rate-limits.mdx              # 1000 req/min, quotas
    errors.mdx                   # Error codes, debugging
  /api-reference/
    playground.mdx               # Interactive API playground
    repositories.mdx             # Auto-generated
    analysis.mdx
    refactoring.mdx
    users.mdx
    organizations.mdx
  /guides/
    ci-cd-integration.mdx        # GitHub Actions, GitLab CI
    ide-extensions.mdx           # VS Code, JetBrains
    webhooks-setup.mdx
    error-handling.mdx
    pagination.mdx               # Cursor vs offset
    filtering.mdx                # Query syntax
  /sdks/
    typescript.mdx
    python.mdx
    go.mdx
  /webhooks/
    events.mdx                   # Event types, payloads
    security.mdx                 # Signature verification
    testing.mdx                  # Webhook tester
  /changelog/
    v1.1.0.mdx
    v1.0.0.mdx
```

## Consequences

### Positive

1. **Developer Adoption**:
   - Interactive playground reduces time-to-first-call to < 5 min
   - SDKs eliminate boilerplate (5-10x faster integration)
   - Clear docs reduce support tickets by 80%

2. **Trust Signal**:
   - High-quality docs signal product maturity
   - Auto-generated docs eliminate doc/API drift
   - Stripe-quality docs increase enterprise confidence

3. **Ecosystem Growth**:
   - SDKs enable third-party integrations
   - Webhooks enable event-driven workflows
   - API playground enables experimentation

4. **Maintainability**:
   - OpenAPI spec is single source of truth
   - Auto-generation reduces manual work
   - Git-based docs enable version control

5. **SEO**:
   - Static docs pages rank in Google
   - Next.js SSR ensures crawlability
   - Drives organic traffic to platform

### Negative

1. **Maintenance Overhead**:
   - OpenAPI spec must stay in sync with backend
   - SDK updates require versioning strategy
   - Docs require ongoing updates (features, examples)

2. **Complexity**:
   - Multiple SDK languages = 3x testing
   - Webhook security is complex (signature verification)
   - API versioning requires migration guides

3. **Performance**:
   - Scalar playground adds 150KB bundle
   - Algolia DocSearch requires external service
   - Auto-generated SDKs can be verbose

4. **Security**:
   - API playground exposes keys (must secure)
   - Webhook endpoints vulnerable to spoofing
   - Rate limiting required to prevent abuse

### Mitigations

1. **Maintenance**:
   - **Action**: CI/CD validates OpenAPI spec on every backend change
   - **Automation**: GitHub Actions generates SDKs automatically
   - **Ownership**: Assign docs owner (rotate quarterly)

2. **Complexity**:
   - **Action**: E2E tests for each SDK
   - **Documentation**: Versioning guide (breaking changes)
   - **Migration**: Automated migration scripts (v1 → v2)

3. **Performance**:
   - **Action**: Lazy-load playground (only on `/playground` page)
   - **Optimization**: Bundle analyzer enforces < 200KB budget
   - **Alternative**: Offer lightweight SDK for edge functions

4. **Security**:
   - **Action**: API keys scoped to tenant (row-level security)
   - **Validation**: HMAC signature verification for webhooks
   - **Rate Limiting**: 1000 req/min per API key

## Implementation Plan

### Phase 1: Foundation (Weeks 1-2)
- [ ] Set up Nextra documentation site
- [ ] Create OpenAPI spec (50+ endpoints)
- [ ] Generate initial SDKs (TypeScript, Python, Go)
- [ ] Build API playground (Scalar integration)

### Phase 2: Content (Weeks 3-4)
- [ ] Write Getting Started guide
- [ ] Create 10+ code examples
- [ ] Document authentication flows
- [ ] Write webhook setup guide

### Phase 3: Advanced (Weeks 5-6)
- [ ] Add CI/CD integration guides
- [ ] Create webhook tester component
- [ ] Implement Algolia DocSearch
- [ ] Build API key management UI

### Phase 4: Polish (Weeks 7-8)
- [ ] Add interactive diagrams (Mermaid)
- [ ] Record video tutorials (Loom)
- [ ] Beta testing with 20 developers
- [ ] Iterate based on feedback

## Metrics & Success Criteria

### Adoption
- **API Users**: 60%+ of customers use API within 30 days
- **SDK Downloads**: 1000+ npm downloads/month (TypeScript SDK)
- **Time to First Call**: < 5 minutes (from signup to successful API call)

### Engagement
- **Docs Visitors**: 10K+ monthly visitors
- **Search Usage**: 40%+ use search (indicates doc discovery)
- **Playground Usage**: 1000+ API calls/month via playground

### Quality
- **Documentation NPS**: 70+ (industry benchmark)
- **Support Deflection**: 80%+ of dev questions answered by docs
- **Error Rate**: < 2% API error rate (proper validation)

### Performance
- **Page Load**: < 1s (Lighthouse 95+)
- **Search Speed**: < 50ms (Algolia)
- **SDK Size**: < 50KB gzipped (TypeScript SDK)

## References

### Research Sources
- [API Developer Portal Guide 2026](https://devspheretechnologies.com/api-developer-portal-guide/)
- [Best Practices for API Portals](https://www.moesif.com/blog/technical/api-development/Dev-Portal/)
- [How to Engage Developers (Mulesoft)](https://www.mulesoft.com/api-university/best-practices-how-to-engage-developers-world-class-api-portal)

### Documentation
- [Nextra Documentation](https://nextra.site/)
- [Scalar API Reference](https://scalar.com/)
- [OpenAPI 3.1 Spec](https://spec.openapis.org/oas/v3.1.0)
- [Algolia DocSearch](https://docsearch.algolia.com/)

### Benchmarks
- [Stripe API Docs](https://stripe.com/docs/api) - Gold standard
- [Twilio Docs](https://www.twilio.com/docs) - Excellent guides
- [GitHub API Docs](https://docs.github.com/rest) - Comprehensive

### Internal References
- ADR-010: Frontend Architecture
- [Architecture Overview](/docs/technical/architecture.md)
- FF-004: LLM Provider Integration (API design patterns)

## Review Date
April 2026 (3 months)

**Reviewers**: Engineering Lead, Developer Advocate, Solutions Architect

---

**Document Version**: 1.0
**Last Updated**: 2026-01-20
**Authors**: Engineering & DevRel Team
**Approved By**: CTO, Head of Developer Relations
