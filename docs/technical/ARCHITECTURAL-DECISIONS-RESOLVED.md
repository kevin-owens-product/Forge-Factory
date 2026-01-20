# Architectural Decisions - Conflicts Resolved

**Date**: 2026-01-20
**Status**: FINAL - All conflicts resolved

This document resolves all conflicts identified in the documentation gaps analysis and provides the single source of truth for Forge Factory's technical stack.

---

## 1. Backend Framework: **Fastify** ✅

**Decision**: Use **Fastify** for all backend services

**Rationale**:
- **Performance**: 2x faster than Express, 30% faster than NestJS
- **Overhead**: Minimal abstraction, lower memory footprint
- **Ecosystem**: Excellent plugin ecosystem (@fastify/jwt, @fastify/cors, etc.)
- **TypeScript**: First-class TypeScript support
- **Learning Curve**: Simpler than NestJS for microservices

**Migration**: Remove all NestJS references from documentation

**Stack**:
```typescript
- Framework: Fastify 4.x
- Validation: @fastify/type-provider-zod (Zod schemas)
- Auth: @fastify/jwt
- Rate Limiting: @fastify/rate-limit
- CORS: @fastify/cors
- Helmet: @fastify/helmet
```

**File Structure** (Updated from ADR-001):
```
/apps/api/src/
  /features/
    /repositories/
      routes.ts         # Fastify routes (not NestJS controllers)
      handlers.ts       # Request handlers
      service.ts        # Business logic
      schema.ts         # Zod validation schemas
```

---

## 2. Monitoring & Observability: **Datadog** ✅

**Decision**: Use **Datadog** as primary observability platform

**Rationale**:
- **All-in-One**: Metrics + Logs + Traces + APM in single platform
- **Auto-Instrumentation**: Automatic tracing for Node.js, Go
- **Enterprise Support**: 24/7 support, SLA guarantees
- **Compliance**: SOC 2, ISO 27001, HIPAA compliant
- **Cost**: $15/host/month + $0.10/GB logs (estimated $5K-10K/month)

**Prometheus/Grafana**: Not used (too much operational overhead)

**Stack**:
```yaml
Metrics: Datadog APM
Logs: Datadog Logs (replace ELK)
Traces: Datadog APM (replace Jaeger)
Error Tracking: Sentry (frontend) + Datadog (backend)
Uptime Monitoring: Datadog Synthetic Monitoring
Alerting: Datadog Monitors → PagerDuty
Dashboards: Datadog Dashboards
```

**Configuration**:
```typescript
// apps/api/src/instrumentation.ts
import tracer from 'dd-trace'

tracer.init({
  service: 'forge-api',
  env: process.env.NODE_ENV,
  version: process.env.GIT_SHA,
  logInjection: true, // Add trace IDs to logs
  runtimeMetrics: true, // Heap, CPU, event loop
})

export default tracer
```

---

## 3. Database Connection Pooling: **AWS RDS Proxy** ✅

**Decision**: Use **AWS RDS Proxy** for production, **PgBouncer** for local/self-hosted

**Rationale**:
- **AWS RDS Proxy** (Production):
  - Managed service (no operational overhead)
  - Auto-scaling connection pools
  - IAM authentication
  - Failover in < 1 minute
  - Transparent to application

- **PgBouncer** (Local/Self-Hosted):
  - Open-source, self-managed
  - Docker Compose for local dev
  - Transaction mode for Prisma compatibility

**Configuration**:

**Production (AWS RDS Proxy)**:
```typescript
// .env.production
DATABASE_URL="postgresql://user:pass@proxy-endpoint.proxy.us-east-1.rds.amazonaws.com:5432/forge"
DIRECT_DATABASE_URL="postgresql://user:pass@instance.us-east-1.rds.amazonaws.com:5432/forge"

// Use proxy for app connections
// Use direct for migrations (RDS Proxy doesn't support prepared statements in all modes)
```

**Local (PgBouncer)**:
```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: forge
      POSTGRES_USER: forge
      POSTGRES_PASSWORD: forge_dev

  pgbouncer:
    image: pgbouncer/pgbouncer:latest
    environment:
      DATABASES: "forge = host=postgres port=5432 dbname=forge"
      POOL_MODE: transaction
      MAX_CLIENT_CONN: 1000
      DEFAULT_POOL_SIZE: 20
```

---

## 4. Authentication Provider: **Auth0** ✅

**Decision**: Use **Auth0** for authentication and identity management

**Rationale**:
- **Enterprise SSO**: SAML 2.0, OIDC, LDAP support
- **Compliance**: SOC 2, ISO 27001, GDPR, HIPAA compliant
- **MFA**: TOTP, SMS, WebAuthn out-of-box
- **Universal Login**: Hosted login pages (reduces attack surface)
- **Organizations**: Multi-tenant support built-in
- **Cost**: $240/month (Essentials) → $800/month (Professional) as we scale

**Not Chosen**:
- **Clerk**: Lacks enterprise SSO (SAML)
- **Custom**: 6-12 months to build, ongoing maintenance

**Architecture**:
```
User → Auth0 Universal Login
     → Auth0 issues JWT (access token + refresh token)
     → Frontend stores tokens (httpOnly cookie)
     → Backend validates JWT (@fastify/jwt)
     → Database: User record created on first login (Auth0 webhook)
```

**JWT Structure**:
```json
{
  "iss": "https://forge-factory.us.auth0.com/",
  "sub": "auth0|user_1a2b3c",
  "aud": ["https://api.forgefactory.dev", "https://forge-factory.us.auth0.com/userinfo"],
  "exp": 1706634000,
  "iat": 1706633100,
  "scope": "openid profile email",
  "org_id": "org_xyz",
  "permissions": ["read:repositories", "write:analysis"]
}
```

**Implementation Details**: See ADR-003

---

## 5. Feature-to-Service Mapping ✅

**Decision**: **8 Microservices** map to **5 Core Features + 3 Platform Services**

**Mapping**:
```
Core Features (Product Spec):
1. Repository Analyzer         → Analysis Service + Repository Service
2. CLAUDE.md Generator          → LLM Service + Refactoring Service
3. Code Refactoring Engine      → Refactoring Service + LLM Service
4. Documentation Generator      → LLM Service
5. Test Coverage Engine         → Test Service + LLM Service

Platform Services (Infrastructure):
6. Integration Service          → GitHub, GitLab, Slack, Jira integrations
7. Security Service             → Vulnerability scanning, secret detection
8. Analytics Service            → Usage metrics, business intelligence
```

**Updated Architecture Diagram**:
```
┌─────────────────────────────────────────────────────────────┐
│                     Feature Layer                            │
├─────────────────────────────────────────────────────────────┤
│  FF-001: Repository Analyzer                                 │
│  FF-002: CLAUDE.md Generator                                 │
│  FF-003: GitHub Integration                                  │
│  FF-004: LLM Provider Integration                            │
│  FF-005: Code Refactoring Engine                             │
│  FF-006: Documentation Generator                             │
│  FF-007: Test Coverage Engine                                │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                     Service Layer                            │
├─────────────────────────────────────────────────────────────┤
│  [Repository Service]  [Analysis Service]  [Refactoring]    │
│  [Test Service]  [LLM Service]  [Integration Service]       │
│  [Security Service]  [Analytics Service]                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. Next.js Version: **14.2+** ✅

**Decision**: Minimum **Next.js 14.2.0** (stable Turbopack, React 19)

**Rationale**:
- **Turbopack**: Stable in 14.2+ (700x faster than Webpack)
- **React 19**: Full support for Server Components, Actions
- **App Router**: Production-ready in 14+
- **Bug Fixes**: 14.2+ has critical bug fixes from 14.0

**Configuration**:
```json
// package.json
{
  "dependencies": {
    "next": "^14.2.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}

// next.config.js
module.exports = {
  experimental: {
    turbo: {
      enabled: true, // Use Turbopack (dev + build)
    },
  },
}
```

**Upgrade Policy**:
- Patch updates: Weekly (14.2.1 → 14.2.2)
- Minor updates: Monthly (14.2 → 14.3)
- Major updates: Quarterly (14 → 15)

---

## FINAL TECHNOLOGY STACK (Single Source of Truth)

### Frontend
```yaml
Framework: Next.js 14.2+
Runtime: React 19
Language: TypeScript 5.3+
Styling: Tailwind CSS 4
Components: shadcn/ui + Radix UI
State Management: Zustand + TanStack Query
Forms: React Hook Form + Zod
Real-time: Socket.IO Client
Icons: Lucide React
Charts: Recharts
```

### Backend
```yaml
API Framework: Fastify 4.x
Language: TypeScript 5.3+ (Node.js 20 LTS)
Analysis Engine: Go 1.21+ (performance-critical)
Validation: Zod
ORM: Prisma 5.x
Authentication: Auth0
API Docs: OpenAPI 3.1 + Scalar
```

### Database & Cache
```yaml
Primary Database: PostgreSQL 16
Connection Pooling: AWS RDS Proxy (prod), PgBouncer (local)
Cache: Redis 7.x
Search: PostgreSQL Full-Text Search (later: Algolia)
```

### Infrastructure
```yaml
Cloud: AWS (primary), multi-cloud capable
Containers: Docker + Kubernetes (EKS)
IaC: Terraform
CI/CD: GitHub Actions
Monitoring: Datadog (metrics, logs, traces, APM)
Error Tracking: Sentry (frontend), Datadog (backend)
Secrets: AWS Secrets Manager
Storage: S3 (code clones, analysis results)
CDN: CloudFront
```

### External Services
```yaml
Identity: Auth0
Payments: Stripe
LLM: Anthropic Claude, OpenAI GPT-4, Google Gemini
Source Control: GitHub (primary), GitLab, Bitbucket
Security: Snyk, Semgrep, TruffleHog
Email: SendGrid
Support: Intercom
Analytics: PostHog (product), Datadog (technical)
```

---

## IMPLEMENTATION CHECKLIST

### ✅ Completed
- [x] Resolve backend framework (Fastify)
- [x] Resolve monitoring stack (Datadog)
- [x] Resolve authentication (Auth0)
- [x] Resolve database pooling (RDS Proxy)
- [x] Resolve feature-service mapping
- [x] Resolve Next.js version (14.2+)

### 🔄 Update Required
- [ ] Update all code examples to use Fastify (not NestJS)
- [ ] Update infrastructure to use Datadog (not Prometheus)
- [ ] Update authentication docs to reference Auth0
- [ ] Update docker-compose.yml for PgBouncer
- [ ] Update architecture diagram with service mapping

### 📝 Documentation Updates
- [ ] Update ADR-001 with Fastify file structure
- [ ] Update architecture.md with final stack
- [ ] Update security-compliance.md with Auth0 details
- [ ] Remove all NestJS references
- [ ] Remove all Prometheus/Grafana references

---

**Status**: All conflicts resolved ✅
**Next Steps**: Create missing ADRs 003-007, update existing docs

---

**Approved By**: CTO (pending)
**Effective Date**: 2026-01-20
