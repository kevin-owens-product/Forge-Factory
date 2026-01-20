# ADR-031: Microservices & Domain-Driven Design Transformation Playbook

## Status
Proposed

## Context

Microservices architecture promises **independent deployment, scalability, and team autonomy**, but **70% of microservices initiatives fail or underdeliver** due to poor bounded context definition, data coupling, and operational complexity (ThoughtWorks). Domain-Driven Design (DDD) provides the strategic patterns to decompose monoliths successfully.

### Market Reality (2026)

**Microservices Adoption**:
- **85% of enterprises** have adopted or are adopting microservices
- **Average enterprise**: 100-500 microservices
- **Complexity explosion**: 10x increase in operational complexity
- **Success rate**: Only 30% achieve expected benefits

**Common Failures**:
- ❌ "Distributed monolith" (tight coupling via sync HTTP)
- ❌ Data coupling (shared databases)
- ❌ Anemic services (CRUD only, no business logic)
- ❌ Unbounded service proliferation (1000+ microservices)
- ❌ Operational nightmare (distributed tracing,debugging

, deployment)

### When to Use Microservices

**Good Reasons**:
- ✅ Independent team scalability (100+ engineers)
- ✅ Different scaling needs per module
- ✅ Technology diversity required
- ✅ Independent deployment cadence
- ✅ Clear bounded contexts

**Bad Reasons**:
- ❌ "It's modern/trendy"
- ❌ Small team (<10 engineers) - monolith is better
- ❌ No clear domain boundaries
- ❌ Premature optimization

### Domain-Driven Design Principles

**Strategic Design**:
1. **Bounded Contexts**: Explicit boundaries for models
2. **Ubiquitous Language**: Shared vocabulary between business and dev
3. **Context Mapping**: Define relationships between contexts
4. **Anti-Corruption Layer**: Protect your model from legacy

**Tactical Design**:
1. **Entities**: Objects with identity
2. **Value Objects**: Immutable objects without identity
3. **Aggregates**: Consistency boundaries
4. **Domain Events**: Business events
5. **Repositories**: Data access abstraction
6. **Services**: Domain logic that doesn't fit entities

## Decision

Implement **comprehensive Microservices & DDD Transformation Playbook** supporting strategic domain modeling, monolith decomposition, event-driven architecture, and distributed system patterns.

### Architecture Overview

```
┌────────────────────────────────────────────────────────────────┐
│  Microservices & Domain-Driven Design Transformation Playbook  │
├────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Domain Discovery → Decomposition → Migration → Optimization   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         Phase 1: Domain Discovery & Event Storming        │  │
│  │                                                            │  │
│  │  Event Storming Workshop:                                 │  │
│  │  ┌────────────────────────────────────────────────────┐   │  │
│  │  │ 1. Domain Events (Orange sticky notes)            │   │  │
│  │  │    - Order Placed                                  │   │  │
│  │  │    - Payment Processed                             │   │  │
│  │  │    - Inventory Reserved                            │   │  │
│  │  │    - Shipment Created                              │   │  │
│  │  │                                                     │   │  │
│  │  │ 2. Commands (Blue sticky notes)                    │   │  │
│  │  │    - Place Order                                   │   │  │
│  │  │    - Process Payment                               │   │  │
│  │  │    - Reserve Inventory                             │   │  │
│  │  │                                                     │   │  │
│  │  │ 3. Aggregates (Yellow sticky notes)                │   │  │
│  │  │    - Order                                         │   │  │
│  │  │    - Payment                                       │   │  │
│  │  │    - Inventory                                     │   │  │
│  │  │    - Shipment                                      │   │  │
│  │  │                                                     │   │  │
│  │  │ 4. Bounded Contexts (Pink boundaries)              │   │  │
│  │  │    ┌─────────────┐  ┌──────────────┐               │   │  │
│  │  │    │   Orders    │  │   Payments   │               │   │  │
│  │  │    └─────────────┘  └──────────────┘               │   │  │
│  │  │    ┌─────────────┐  ┌──────────────┐               │   │  │
│  │  │    │  Inventory  │  │   Shipping   │               │   │  │
│  │  │    └─────────────┘  └──────────────┘               │   │  │
│  │  └────────────────────────────────────────────────────┘   │  │
│  │                                                            │  │
│  │  Output: Bounded Context Map                              │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            ▼                                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Phase 2: Monolith Analysis                   │  │
│  │                                                            │  │
│  │  Code Analysis:                                           │  │
│  │  ┌────────────────────────────────────────────────────┐   │  │
│  │  │ Current Monolith Structure:                        │   │  │
│  │  │                                                     │   │  │
│  │  │ monolith/                                          │   │  │
│  │  │   ├── orders/ (5,000 LOC)                          │   │  │
│  │  │   ├── payments/ (3,000 LOC)                        │   │  │
│  │  │   ├── inventory/ (4,000 LOC)                       │   │  │
│  │  │   ├── shipping/ (2,500 LOC)                        │   │  │
│  │  │   ├── customers/ (3,500 LOC)                       │   │  │
│  │  │   └── shared/ (10,000 LOC) ⚠️ Shared code          │   │  │
│  │  │                                                     │   │  │
│  │  │ Dependency Analysis:                                │   │  │
│  │  │ - Orders → Payments (high coupling)                │   │  │
│  │  │ - Orders → Inventory (high coupling)               │   │  │
│  │  │ - Inventory → Shipping (medium coupling)           │   │  │
│  │  │ - All → Customers (shared DB table)                │   │  │
│  │  │                                                     │   │  │
│  │  │ Database Analysis:                                  │   │  │
│  │  │ - Single PostgreSQL database                       │   │  │
│  │  │ - 50 tables                                        │   │  │
│  │  │ - Foreign keys across contexts ⚠️                  │   │  │
│  │  │ - Shared Customer table ⚠️                         │   │  │
│  │  └────────────────────────────────────────────────────┘   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            ▼                                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         Phase 3: Decomposition Strategy                   │  │
│  │                                                            │  │
│  │  Strangler Fig Pattern (Incremental Migration):          │  │
│  │  ┌────────────────────────────────────────────────────┐   │  │
│  │  │                                                     │   │  │
│  │  │  ┌───────────────────────────────────────────┐     │   │  │
│  │  │  │         Monolith (Existing)               │     │   │  │
│  │  │  │  ┌──────────────────────────────────┐     │     │   │  │
│  │  │  │  │ Orders  │ Payments │ Inventory   │     │     │   │  │
│  │  │  │  │ Shipping│ Customers│ Shared      │     │     │   │  │
│  │  │  │  └──────────────────────────────────┘     │     │   │  │
│  │  │  └───────────────────────────────────────────┘     │   │  │
│  │  │                      ▲                             │   │  │
│  │  │                      │ Routing Layer (API Gateway) │   │  │
│  │  │                      ▼                             │   │  │
│  │  │  ┌───────────────────────────────────────────┐     │   │  │
│  │  │  │      New Microservices (Extracted)        │     │   │  │
│  │  │  │  ┌──────────┐  ┌──────────┐               │     │   │  │
│  │  │  │  │ Orders   │  │ Payments │               │     │   │  │
│  │  │  │  │ Service  │  │ Service  │               │     │   │  │
│  │  │  │  └──────────┘  └──────────┘               │     │   │  │
│  │  │  └───────────────────────────────────────────┘     │   │  │
│  │  │                                                     │   │  │
│  │  │  Routing Logic:                                    │   │  │
│  │  │  - /api/orders/* → Orders Service (if exists)      │   │  │
│  │  │  - Else → Monolith                                 │   │  │
│  │  │                                                     │   │  │
│  │  │  Gradually extract each bounded context            │   │  │
│  │  └────────────────────────────────────────────────────┘   │  │
│  │                                                            │  │
│  │  Extraction Order (Low Risk → High Risk):                │  │
│  │  1. Shipping (low coupling, simple)                      │  │
│  │  2. Inventory (moderate coupling)                        │  │
│  │  3. Payments (high value, compliance)                    │  │
│  │  4. Orders (core business logic, high coupling)          │  │
│  │  5. Customers (shared across all contexts)               │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            ▼                                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         Phase 4: Data Decomposition                       │  │
│  │                                                            │  │
│  │  Database-per-Service Pattern:                           │  │
│  │  ┌────────────────────────────────────────────────────┐   │  │
│  │  │ Before (Shared Database):                          │   │  │
│  │  │                                                     │   │  │
│  │  │  ┌─────────────────────────────────────┐           │   │  │
│  │  │  │   Monolithic PostgreSQL Database    │           │   │  │
│  │  │  │                                      │           │   │  │
│  │  │  │  orders │ payments │ inventory │... │           │   │  │
│  │  │  └─────────────────────────────────────┘           │   │  │
│  │  │                                                     │   │  │
│  │  │ After (Database-per-Service):                      │   │  │
│  │  │                                                     │   │  │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐         │   │  │
│  │  │  │ Orders   │  │ Payments │  │ Inventory│         │   │  │
│  │  │  │ DB       │  │ DB       │  │ DB       │         │   │  │
│  │  │  └──────────┘  └──────────┘  └──────────┘         │   │  │
│  │  │       ▲              ▲              ▲              │   │  │
│  │  │       │              │              │              │   │  │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐         │   │  │
│  │  │  │ Orders   │  │ Payments │  │ Inventory│         │   │  │
│  │  │  │ Service  │  │ Service  │  │ Service  │         │   │  │
│  │  │  └──────────┘  └──────────┘  └──────────┘         │   │  │
│  │  └────────────────────────────────────────────────────┘   │  │
│  │                                                            │  │
│  │  Shared Data Problem:                                     │  │
│  │  - Customer table used by all services                    │  │
│  │  - Solution: Customer service owns data                   │  │
│  │  - Others store only customer_id (reference)              │  │
│  │  - Eventual consistency via events                        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            ▼                                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         Phase 5: Event-Driven Architecture                │  │
│  │                                                            │  │
│  │  Decouple with Domain Events:                             │  │
│  │  ┌────────────────────────────────────────────────────┐   │  │
│  │  │                                                     │   │  │
│  │  │  Orders Service                                    │   │  │
│  │  │       │                                             │   │  │
│  │  │       │ (1) Order Placed                            │   │  │
│  │  │       ▼                                             │   │  │
│  │  │  ┌─────────────────┐                                │   │  │
│  │  │  │  Event Bus      │                                │   │  │
│  │  │  │  (Kafka/SNS)    │                                │   │  │
│  │  │  └─────────────────┘                                │   │  │
│  │  │       │         │         │                          │   │  │
│  │  │       ▼         ▼         ▼                          │   │  │
│  │  │  Payments   Inventory  Shipping                     │   │  │
│  │  │  Service    Service    Service                      │   │  │
│  │  │    (2)        (3)        (4)                         │   │  │
│  │  │  Process   Reserve    Create                        │   │  │
│  │  │  Payment   Stock      Shipment                      │   │  │
│  │  │                                                     │   │  │
│  │  │  Benefits:                                          │   │  │
│  │  │  - Loose coupling (no direct service calls)         │   │  │
│  │  │  - Async processing                                 │   │  │
│  │  │  - Audit trail (event log)                          │   │  │
│  │  │  - Replay capability                                │   │  │
│  │  └────────────────────────────────────────────────────┘   │  │
│  │                                                            │  │
│  │  Saga Pattern (Distributed Transactions):                │  │
│  │  - Choreography: Services react to events                │  │
│  │  - Orchestration: Central coordinator                    │  │
│  │  - Compensating transactions for rollback                │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└────────────────────────────────────────────────────────────────┘
```

## Data Model

```typescript
/**
 * @prompt-id forge-v4.1:microservices-ddd:data-model:001
 * @generated-at 2026-01-20T00:00:00Z
 * @model claude-sonnet-4-5
 */

model MicroservicesProgram {
  id                    String   @id @default(cuid())
  organizationId        String
  organization          Organization @relation(fields: [organizationId], references: [id])

  name                  String
  description           String

  // Strategy
  decompositionStrategy DecompositionStrategy

  // Monolith details
  monolithRepository    String?
  monolithLOC           Int?

  // Status
  status                ProgramStatus
  startDate             DateTime
  targetEndDate         DateTime

  // Bounded contexts
  boundedContexts       BoundedContext[]

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@index([organizationId])
}

enum DecompositionStrategy {
  STRANGLER_FIG         // Incremental extraction
  BIG_BANG              // Rewrite all at once
  HYBRID                // Mix of extraction + new services
}

// Bounded context (becomes a microservice)
model BoundedContext {
  id                    String   @id @default(cuid())
  programId             String
  program               MicroservicesProgram @relation(fields: [programId], references: [id])

  // Domain
  name                  String           // "Orders", "Payments"
  ubiquitousLanguage    Json             // Key domain terms
  coreDomain            Boolean @default(false) // Is this core to business?

  // Service details
  repository            String?          // GitHub repo for extracted service
  technology            String?          // "Node.js", "Java", "Go"
  database              String?          // "PostgreSQL", "MongoDB"

  // Extraction
  extractionStatus      ExtractionStatus
  extractionOrder       Int              // 1, 2, 3, ... (priority)

  // Dependencies
  upstreamContexts      String[]         // Context IDs we depend on
  downstreamContexts    String[]         // Contexts that depend on us
  integrationPattern    IntegrationPattern // How we integrate

  // Metrics
  linesOfCode           Int?
  teamOwner             String?

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@index([programId])
}

enum ExtractionStatus {
  NOT_STARTED
  PLANNING
  IN_PROGRESS
  EXTRACTED
  DECOMMISSIONED        // Monolith code removed
}

enum IntegrationPattern {
  SYNC_HTTP             // REST API calls
  ASYNC_EVENTS          // Event bus (Kafka, SNS)
  SHARED_DATABASE       // Anti-pattern (legacy)
  API_GATEWAY           // Through gateway
}

// Domain events (event-driven architecture)
model DomainEvent {
  id                    String   @id @default(cuid())
  organizationId        String
  organization          Organization @relation(fields: [organizationId], references: [id])

  // Event details
  eventType             String           // "OrderPlaced", "PaymentProcessed"
  sourceContext         String           // Bounded context that emitted
  payload               Json             // Event data

  // Subscribers
  subscribers           String[]         // Bounded context IDs subscribed

  // Metadata
  createdAt             DateTime @default(now())

  @@index([organizationId])
  @@index([eventType])
}
```

## Microservices Transformation Playbooks

### 1. Strategic DDD Workshop (1-2 weeks)

```typescript
const eventStormingWorkshop = {
  participants: [
    'Domain experts (business)',
    'Developers',
    'Architects',
    'Product managers',
  ],

  steps: [
    {
      step: 'Domain Events',
      duration: '2 hours',
      activity: 'Identify all business events (orange sticky notes)',
      output: 'Timeline of events',
    },
    {
      step: 'Commands & Actors',
      duration: '1 hour',
      activity: 'What triggers events? Who performs actions?',
      output: 'Commands (blue) and Actors (small yellow)',
    },
    {
      step: 'Aggregates',
      duration: '2 hours',
      activity: 'Group related events around aggregates',
      output: 'Aggregate boundaries (yellow)',
    },
    {
      step: 'Bounded Contexts',
      duration: '2 hours',
      activity: 'Draw boundaries around cohesive domains',
      output: 'Bounded context map (pink boundaries)',
    },
    {
      step: 'Context Mapping',
      duration: '1 hour',
      activity: 'Define relationships between contexts',
      output: 'Integration patterns, anti-corruption layers',
    },
  ],

  deliverable: 'Bounded Context Map → Microservices Architecture',
}
```

### 2. Monolith to Microservices (6-18 months)

```typescript
const decompositionPlaybook = {
  phases: [
    {
      name: 'Preparation',
      duration: '1-2 months',
      steps: [
        'Analyze monolith dependencies',
        'Identify bounded contexts',
        'Prioritize extraction order',
        'Set up infrastructure (Kubernetes, API Gateway)',
      ],
    },
    {
      name: 'Extract First Service (Pilot)',
      duration: '1-2 months',
      steps: [
        'Choose low-risk service (Shipping)',
        'Extract code to new service',
        'Separate database',
        'Deploy alongside monolith',
        'Route traffic via API Gateway',
        'Monitor & learn',
      ],
      transformations: [
        'EXTRACT_BOUNDED_CONTEXT',
        'CREATE_SERVICE_REPOSITORY',
        'SEPARATE_DATABASE',
        'IMPLEMENT_API',
        'ADD_OBSERVABILITY',
      ],
    },
    {
      name: 'Extract Remaining Services',
      duration: '4-12 months',
      strategy: 'Repeat for each bounded context',
      riskMitigation: [
        'Strangler fig pattern (parallel running)',
        'Feature flags for gradual cutover',
        'Shadow testing (compare outputs)',
        'Canary deployments (5% → 100%)',
      ],
    },
    {
      name: 'Decommission Monolith',
      duration: '1-2 months',
      steps: [
        'Verify all traffic to microservices',
        'Archive monolith code',
        'Decommission infrastructure',
        'Celebrate! 🎉',
      ],
    },
  ],
}
```

### 3. Event-Driven Architecture (3-6 months)

```typescript
const eventDrivenPlaybook = {
  infrastructure: {
    eventBus: 'Kafka / AWS SNS+SQS / Azure Event Grid',
    schema Registry: 'Confluent Schema Registry / AWS Glue',
    monitoring: 'Distributed tracing (OpenTelemetry)',
  },

  patterns: [
    {
      name: 'Event Notification',
      useCase: 'Notify other services of state changes',
      example: 'OrderPlaced event → Inventory reserves stock',
    },
    {
      name: 'Event-Carried State Transfer',
      useCase: 'Include full state in event (avoid lookups)',
      example: 'OrderPlaced includes {orderId, items, customer}',
    },
    {
      name: 'Event Sourcing',
      useCase: 'Store events as source of truth',
      example: 'Order = sequence of events (Created, ItemAdded, Placed)',
    },
    {
      name: 'CQRS',
      useCase: 'Separate read & write models',
      example: 'Write to event store, read from denormalized view',
    },
  ],

  implementation: [
    'Define domain events (schema)',
    'Implement event publishers',
    'Implement event subscribers',
    'Add dead letter queues',
    'Implement idempotency',
    'Monitor event lag',
  ],
}
```

## Consequences

### Positive

1. **Independent Deployment**: Teams ship independently
2. **Scalability**: Scale services independently
3. **Technology Diversity**: Use best tool per service
4. **Fault Isolation**: One service failure doesn't take down all
5. **Team Autonomy**: Clear ownership boundaries

### Negative

1. **Operational Complexity**: 10x more moving parts
2. **Distributed System Challenges**: Network, consistency, debugging
3. **Data Consistency**: Eventual consistency is hard
4. **Testing Complexity**: Integration tests across services
5. **Learning Curve**: DDD, event-driven patterns

### Mitigations

1. **Start Simple**: Don't extract everything, focus on bounded contexts
2. **Platform Engineering**: Build IDP to reduce ops burden (ADR-030)
3. **Observability**: Invest heavily in monitoring, tracing
4. **Gradual Extraction**: Strangler fig, not big-bang rewrite
5. **Training**: DDD workshops, microservices best practices

## Metrics & Success Criteria

### Decomposition Progress
- **Services Extracted**: 80%+ of planned contexts
- **Monolith Size**: Reduced by 70%+
- **Decommission**: Monolith fully retired

### Business Value
- **Deployment Frequency**: 5x increase per team
- **Lead Time**: 60% reduction
- **Team Velocity**: 40% improvement
- **Downtime**: 50% reduction (fault isolation)

## References

- [Domain-Driven Design - Eric Evans](https://www.domainlanguage.com/ddd/)
- [Building Microservices - Sam Newman](https://samnewman.io/books/building_microservices_2nd_edition/)
- [Event Storming - Alberto Brandolini](https://www.eventstorming.com/)
- [Microservices Patterns - Chris Richardson](https://microservices.io/)
- ADR-028: Legacy System Modernization Playbook
- ADR-030: DevOps & Platform Engineering Transformation

---

**Document Version**: 1.0
**Last Updated**: 2026-01-20
