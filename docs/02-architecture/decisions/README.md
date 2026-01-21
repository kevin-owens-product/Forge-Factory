# Architecture Decision Records (ADRs)

This directory contains Architecture Decision Records (ADRs) documenting significant architectural decisions made in the Forge Factory project.

## What is an ADR?

An Architecture Decision Record (ADR) is a document that captures an important architectural decision made along with its context and consequences. ADRs help teams:

- Understand why decisions were made
- Avoid revisiting settled discussions
- Onboard new team members faster
- Track architectural evolution over time

## ADR Format

Each ADR follows this structure:

1. **Status**: Proposed | Accepted | Deprecated | Superseded
2. **Context**: What is the issue we're addressing?
3. **Decision**: What is the change we're proposing?
4. **Consequences**: What becomes easier or more difficult?
5. **Alternatives Considered**: What other options were evaluated?

## All ADRs

### Infrastructure & Foundation

| ADR | Title | Status | Summary |
|-----|-------|--------|---------|
| [ADR-001](./ADR-001-vertical-slice-architecture.md) | Vertical Slice Architecture | Accepted | Complete vertical slices (DB → API → UI) for each feature |
| [ADR-002](./ADR-002-tenant-isolation.md) | Tenant Isolation Strategy | Accepted | Shared database with row-level filtering + RLS for multi-tenancy |
| [ADR-009](./ADR-009-connection-pooling.md) | Database Connection Pooling | Accepted | PgBouncer in transaction mode via AWS RDS Proxy |

### Frontend Architecture

| ADR | Title | Status | Summary |
|-----|-------|--------|---------|
| [ADR-003](./ADR-003-frontend-architecture.md) | Frontend Architecture & Technology Stack | Accepted | Next.js 14 with App Router, React 18, Tailwind CSS, shadcn/ui |
| [ADR-004](./ADR-004-state-management.md) | State Management & Data Fetching | Accepted | Hybrid: TanStack Query (server), Zustand (client), RHF (forms) |
| [ADR-005](./ADR-005-design-system.md) | Component Library & Design System | Accepted | shadcn/ui on Radix UI, WCAG 2.1 AA compliance |

### Core Features

| ADR | Title | Status | Summary |
|-----|-------|--------|---------|
| [ADR-006](./ADR-006-dashboard-analytics.md) | Dashboard Architecture & Analytics | Accepted | Widget-based modular dashboards with Recharts, real-time updates |
| [ADR-007](./ADR-007-task-management.md) | Task Management System | Accepted | Kanban board with dnd-kit, multiple views, dependencies |
| [ADR-008](./ADR-008-workflow-engine.md) | Workflow Engine Architecture | Accepted | ReactFlow builder + BullMQ execution, visual orchestration |

### Enterprise Features

| ADR | Title | Status | Summary |
|-----|-------|--------|---------|
| [ADR-010](./ADR-010-team-management-rbac.md) | Team Management & RBAC | Accepted | Flexible RBAC with org/team roles, fine-grained permissions |
| [ADR-011](./ADR-011-agent-management.md) | Agent Management & Orchestration | Accepted | Multi-provider LLM support, agent types, cost tracking |
| [ADR-012](./ADR-012-realtime-notifications.md) | Real-time Communication & Notifications | Accepted | Socket.io + hybrid notifications (WebSocket, Push, Email) |
| [ADR-013](./ADR-013-authentication-ui.md) | Authentication & Authorization UI | Accepted | Next-Auth with multiple providers, 2FA, SSO/SAML |

## ADR Timeline

```
2024-01 (Initial Architecture)
├── ADR-001: Vertical Slice Architecture
├── ADR-002: Tenant Isolation Strategy
└── ADR-009: Database Connection Pooling

2024-01 (Frontend & Features)
├── ADR-003: Frontend Architecture
├── ADR-004: State Management
├── ADR-005: Design System
├── ADR-006: Dashboard Architecture
├── ADR-007: Task Management
├── ADR-008: Workflow Engine
├── ADR-010: Team Management & RBAC
├── ADR-011: Agent Management
├── ADR-012: Real-time Communication
└── ADR-013: Authentication UI
```

## Creating New ADRs

When making a significant architectural decision:

1. **Create a new ADR file**: Use the next available number (e.g., `ADR-014-topic-name.md`)
2. **Use the template**: Follow the structure from existing ADRs
3. **Discuss with team**: Review the ADR with relevant stakeholders
4. **Update this README**: Add your ADR to the tables above
5. **Link from other docs**: Reference your ADR in relevant documentation

### ADR Template

```markdown
# ADR-XXX: Title

## Status
Proposed | Accepted | Deprecated | Superseded

## Context
What is the issue we're addressing? What factors are in play?

## Decision
What is the change we're proposing and why?

## Implementation
How will we implement this decision? Include code examples, diagrams, etc.

## Consequences

### Positive
What becomes easier or better?

### Negative
What becomes more difficult or complex?

### Mitigations
How do we address the negative consequences?

## Alternatives Considered
What other options did we evaluate and why were they rejected?

## References
Links to relevant resources, docs, articles

## Review Date
When should we review this decision?
```

## ADR Statuses

- **Proposed**: Under discussion, not yet decided
- **Accepted**: Decision made and being implemented
- **Deprecated**: No longer relevant but kept for history
- **Superseded**: Replaced by a newer ADR (link to new ADR)

## Related Documentation

- [Architecture Overview](../architecture.md)
- [The Forge Method](../../00-overview/the-forge-method.md)
- [Product Specification](../../01-product/product-spec.md)

---

**Last Updated**: January 2024
**Total ADRs**: 13 (11 Frontend/Features, 2 Infrastructure)
