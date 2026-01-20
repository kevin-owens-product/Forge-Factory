# Architecture Documentation

This directory contains all technical architecture documentation for the Forge Factory platform.

## Overview

Forge Factory is built as a modern, cloud-native enterprise SaaS platform using:
- **Monorepo Architecture**: Nx-powered monorepo with pnpm workspaces
- **Vertical Slice Architecture**: Complete feature slices from DB to UI
- **Multi-tenancy**: Shared database with row-level tenant isolation
- **Cloud-Native**: Designed for AWS with containerization (ECS Fargate)
- **Real-time**: WebSocket communication for live collaboration
- **AI-Native**: Deep integration with LLM providers (Anthropic, OpenAI)

## Architecture Documents

### Core Architecture
- **[Architecture Overview](./architecture.md)** (1165 lines)
  - System architecture and technical design
  - Technology stack and infrastructure
  - Component interaction patterns
  - Scalability and performance considerations

- **[Security & Compliance](./security-compliance.md)**
  - Security model and threat mitigation
  - Compliance framework (SOC 2, GDPR, HIPAA)
  - Authentication and authorization
  - Data protection and encryption

- **[Integrations](./integrations.md)**
  - Third-party integration architecture
  - GitHub, GitLab, Bitbucket integration
  - LLM provider integration
  - Webhook and API patterns

### Architecture Decisions

All significant architectural decisions are documented as ADRs (Architecture Decision Records):

**[View All ADRs →](./decisions/README.md)**

#### Infrastructure (3 ADRs)
- [ADR-001: Vertical Slice Architecture](./decisions/ADR-001-vertical-slice-architecture.md)
- [ADR-002: Tenant Isolation Strategy](./decisions/ADR-002-tenant-isolation.md)
- [ADR-009: Database Connection Pooling](./decisions/ADR-009-connection-pooling.md)

#### Frontend (3 ADRs)
- [ADR-003: Frontend Architecture & Tech Stack](./decisions/ADR-003-frontend-architecture.md)
- [ADR-004: State Management & Data Fetching](./decisions/ADR-004-state-management.md)
- [ADR-005: Component Library & Design System](./decisions/ADR-005-design-system.md)

#### Core Features (3 ADRs)
- [ADR-006: Dashboard Architecture & Analytics](./decisions/ADR-006-dashboard-analytics.md)
- [ADR-007: Task Management System](./decisions/ADR-007-task-management.md)
- [ADR-008: Workflow Engine Architecture](./decisions/ADR-008-workflow-engine.md)

#### Enterprise Features (4 ADRs)
- [ADR-010: Team Management & RBAC](./decisions/ADR-010-team-management-rbac.md)
- [ADR-011: Agent Management & Orchestration](./decisions/ADR-011-agent-management.md)
- [ADR-012: Real-time Communication & Notifications](./decisions/ADR-012-realtime-notifications.md)
- [ADR-013: Authentication & Authorization UI](./decisions/ADR-013-authentication-ui.md)

## System Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                   Forge Factory Architecture                  │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Client Layer                                          │ │
│  │  - Portal (Next.js) - Customer-facing app             │ │
│  │  - Admin (Next.js) - Operations dashboard             │ │
│  └────────────────────────────────────────────────────────┘ │
│                         ↓                                     │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  API Gateway Layer                                     │ │
│  │  - REST API (NestJS)                                   │ │
│  │  - GraphQL API (future)                                │ │
│  │  - WebSocket Gateway (Socket.io)                       │ │
│  └────────────────────────────────────────────────────────┘ │
│                         ↓                                     │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Service Layer                                         │ │
│  │  - Analysis Service (Go)                               │ │
│  │  - LLM Service (multi-provider)                        │ │
│  │  - Workflow Engine (BullMQ)                            │ │
│  │  - Notification Service                                │ │
│  └────────────────────────────────────────────────────────┘ │
│                         ↓                                     │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Data Layer                                            │ │
│  │  - PostgreSQL (primary data store)                     │ │
│  │  - Redis (cache + queue + pub/sub)                     │ │
│  │  - S3 (file storage)                                   │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

## Technology Stack

### Frontend
- **Framework**: Next.js 14+ (App Router)
- **UI Library**: React 18+
- **Styling**: Tailwind CSS 3.4+
- **Components**: shadcn/ui (Radix UI)
- **State Management**: TanStack Query + Zustand
- **Forms**: React Hook Form + Zod

### Backend
- **Framework**: NestJS 10.3+
- **Runtime**: Node.js 22+
- **ORM**: Prisma
- **Validation**: class-validator
- **Queue**: BullMQ (Redis-based)

### Data Stores
- **Primary Database**: PostgreSQL 16+
- **Cache/Queue/PubSub**: Redis 7+
- **Object Storage**: AWS S3
- **Search** (Future): Typesense

### Infrastructure
- **Cloud Provider**: AWS
- **Container Orchestration**: ECS Fargate
- **CDN**: CloudFront
- **Load Balancer**: Application Load Balancer
- **IaC**: Terraform

### DevOps
- **CI/CD**: GitHub Actions
- **Monitoring**: Sentry, Prometheus, Grafana
- **Logging**: CloudWatch
- **Security Scanning**: Snyk, Semgrep

## Key Architectural Patterns

### 1. Vertical Slice Architecture
Each feature is developed as a complete vertical slice:
- Database schema (Prisma models)
- API endpoints (NestJS controllers/services)
- UI components (React)
- Tests (unit + integration + E2E)

Benefits:
- Faster feature delivery
- Fewer merge conflicts
- Better testability
- Clear feature boundaries

### 2. Multi-Tenancy
Shared database with row-level tenant isolation:
- Every table has `tenantId` column
- Application-level filtering via guards
- PostgreSQL RLS for additional safety
- Property-based tests verify isolation

### 3. Event-Driven Architecture
Real-time updates and async processing:
- WebSocket (Socket.io) for real-time features
- Redis Pub/Sub for service communication
- BullMQ for background job processing
- Event sourcing for audit trails

### 4. API-First Design
All features expose APIs:
- RESTful APIs for CRUD operations
- GraphQL (future) for complex queries
- WebSocket for real-time updates
- Webhooks for external integrations

## Scalability & Performance

### Horizontal Scaling
- **API Servers**: Auto-scaling based on CPU/memory
- **Workers**: Auto-scaling based on queue depth
- **Database**: Read replicas for query distribution
- **Cache**: Redis cluster for high throughput

### Performance Optimization
- **CDN**: CloudFront for static assets
- **Caching**: Multi-layer caching strategy
- **Connection Pooling**: PgBouncer/RDS Proxy
- **Query Optimization**: Indexed queries, materialized views

### Monitoring & Observability
- **Metrics**: Prometheus + Grafana
- **Logging**: Structured JSON logs
- **Tracing**: Distributed tracing (future)
- **Alerting**: PagerDuty integration

## Security Architecture

### Defense in Depth
- **Network**: VPC, security groups, NACLs
- **Application**: Input validation, CSRF protection
- **Data**: Encryption at rest and in transit
- **Authentication**: Multi-factor, SSO/SAML
- **Authorization**: RBAC with fine-grained permissions

### Compliance
- **SOC 2**: Audit controls and evidence collection
- **GDPR**: Data protection and privacy controls
- **HIPAA**: (Optional) Healthcare data compliance

## Development Principles

### The Forge Method
- **70-95% AI-generated code** with human oversight
- **Prompt-based development** with traceable prompts
- **Vertical slice delivery** for rapid iteration
- **Quality gates** for every commit

### Code Quality
- **Type Safety**: TypeScript strict mode
- **Test Coverage**: Minimum 80%
- **Linting**: ESLint with strict rules
- **Security**: Semgrep scanning

## Related Documentation

- [Product Specification](../01-product/product-spec.md)
- [Feature Specifications](../03-features/README.md)
- [Development Guide](../04-development/README.md)
- [Operations Guide](../05-operations/README.md)

## Further Reading

- [The Forge Method](../00-overview/the-forge-method.md)
- [The Forge Factory](../00-overview/the-forge-factory.md)
- [All ADRs](./decisions/README.md)

---

**Last Updated**: January 2024
**Architecture Version**: 1.0
**Total ADRs**: 13
