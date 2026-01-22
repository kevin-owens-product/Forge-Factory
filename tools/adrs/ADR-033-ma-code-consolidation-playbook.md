# ADR-033: M&A Code Consolidation Playbook

## Status
Proposed

## Context

**Mergers & Acquisitions (M&A) are accelerating**: Global M&A deal value exceeded **$3.7 trillion in 2024**, with **70% of deals citing technology integration as a top risk**. Post-merger technology consolidation typically takes **18-36 months** and costs **$10-50M for mid-market deals**, yet **50% of M&A integrations fail to achieve expected synergies** due to technical complexity.

### Market Reality (2026)

**M&A Technology Challenges**:
- **18-36 months** typical integration timeline
- **$10-50M** integration cost for mid-market ($500M-1B deals)
- **30-40% of deal value** lost to poor tech integration
- **Employee attrition**: 25-40% of acquired dev team leaves within 2 years
- **Day 1 readiness**: Only 20% of acquirers have Day 1 IT plan

**Common Integration Scenarios**:

1. **Tech Acquisition** (Acquihire):
   - **Goal**: Acquire engineering talent + product
   - **Timeline**: 6-12 months
   - **Strategy**: Integrate product into existing platform

2. **Horizontal Merger** (Competitor):
   - **Goal**: Market consolidation, eliminate redundancy
   - **Timeline**: 12-24 months
   - **Strategy**: Choose best-of-breed, decommission duplicate

3. **Vertical Integration** (Supply Chain):
   - **Goal**: Control end-to-end value chain
   - **Timeline**: 12-18 months
   - **Strategy**: Integrate via APIs, maintain separate systems

4. **Conglomerate** (Unrelated):
   - **Goal**: Portfolio diversification
   - **Timeline**: Varies
   - **Strategy**: Minimal integration, shared services only

### Technology Integration Challenges

**Technical Debt**:
- ❌ Different technology stacks (Java vs .NET vs Node.js)
- ❌ Incompatible architectures (monolith vs microservices)
- ❌ Duplicate systems (2 CRMs, 2 billing platforms)
- ❌ Data silos (incompatible schemas)
- ❌ Security gaps (different security standards)

**Organizational**:
- ❌ Cultural clash (startup vs enterprise)
- ❌ Process differences (agile vs waterfall)
- ❌ Tooling differences (GitHub vs GitLab, AWS vs Azure)
- ❌ Resistance to change ("not invented here" syndrome)

**Business Continuity**:
- ❌ Can't disrupt revenue during integration
- ❌ Customer promises to both companies
- ❌ Regulatory approval conditions
- ❌ Contractual obligations (SLAs)

## Decision

Implement **comprehensive M&A Code Consolidation Playbook** supporting technology assessment, integration strategy selection, automated code migration, team onboarding, and synergy tracking.

### Architecture Overview

```
┌────────────────────────────────────────────────────────────────┐
│          M&A Code Consolidation Playbook                       │
├────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Due Diligence → Planning → Day 1 → Integration → Optimization │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         Phase 0: Technical Due Diligence (Pre-Close)      │  │
│  │                                                            │  │
│  │  Automated Code Assessment:                               │  │
│  │  ┌────────────────────────────────────────────────────┐   │  │
│  │  │ Target Company: AcquiredCo                         │   │  │
│  │  │                                                     │   │  │
│  │  │ Technology Stack:                                  │   │  │
│  │  │  - Backend: Node.js 18, Express                    │   │  │
│  │  │  - Frontend: React 17, Redux                       │   │  │
│  │  │  - Database: PostgreSQL 14, MongoDB 5              │   │  │
│  │  │  - Cloud: AWS (us-east-1)                          │   │  │
│  │  │  - DevOps: GitHub Actions, Docker, ECS             │   │  │
│  │  │                                                     │   │  │
│  │  │ Codebase Metrics:                                  │   │  │
│  │  │  - Repositories: 47                                │   │  │
│  │  │  - Total LOC: 287,000                              │   │  │
│  │  │  - Test Coverage: 68%                              │   │  │
│  │  │  - Technical Debt: 32% (Medium)                    │   │  │
│  │  │  - Security Vulns: 23 Critical, 47 High            │   │  │
│  │  │  - Dependencies: 1,247 (156 outdated)              │   │  │
│  │  │                                                     │   │  │
│  │  │ Integration Complexity Score: 7.2/10 (Medium-High) │   │  │
│  │  │                                                     │   │  │
│  │  │ Estimated Integration Effort: 12-18 months         │   │  │
│  │  │ Estimated Cost: $4.2M                              │   │  │
│  │  │                                                     │   │  │
│  │  │ Risks:                                             │   │  │
│  │  │  - ⚠️ Legacy Node.js code (needs modernization)    │   │  │
│  │  │  - ⚠️ No single sign-on (SSO) integration         │   │  │
│  │  │  - ⚠️ Data migration complexity (MongoDB → PG)     │   │  │
│  │  │  - ⚠️ Different cloud (we use Azure)               │   │  │
│  │  └────────────────────────────────────────────────────┘   │  │
│  │                                                            │  │
│  │  Deliverable: Technical Due Diligence Report              │  │
│  │  - Technology compatibility analysis                      │  │
│  │  - Integration effort estimate                            │  │
│  │  - Risk assessment                                        │  │
│  │  - Recommendation: GO / NO-GO / RENEGOTIATE               │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            ▼                                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         Phase 1: Integration Planning (Pre-Close)         │  │
│  │                                                            │  │
│  │  Integration Strategy Selection:                          │  │
│  │  ┌────────────────────────────────────────────────────┐   │  │
│  │  │ Decision Matrix:                                    │   │  │
│  │  │                                                     │   │  │
│  │  │ ┌──────────────┬────────┬─────────┬─────────────┐  │   │  │
│  │  │ │ Strategy     │ Time   │ Cost    │ Risk        │  │   │  │
│  │  │ ├──────────────┼────────┼─────────┼─────────────┤  │   │  │
│  │  │ │ Absorb       │ 18-24  │ High    │ High        │  │   │  │
│  │  │ │ (Full merge) │ months │ $$$     │ Disruption  │  │   │  │
│  │  │ │              │        │         │             │  │   │  │
│  │  │ │ Coexist      │ 6-12   │ Medium  │ Medium      │  │   │  │
│  │  │ │ (Parallel)   │ months │ $$      │ Duplication │  │   │  │
│  │  │ │              │        │         │             │  │   │  │
│  │  │ │ Best-of-     │ 12-18  │ Medium  │ Low-Medium  │  │   │  │
│  │  │ │ Breed        │ months │ $$      │ Complexity  │  │   │  │
│  │  │ │              │        │         │             │  │   │  │
│  │  │ │ Greenfield   │ 24-36  │ Very    │ Very High   │  │   │  │
│  │  │ │ (Rebuild)    │ months │ High    │ Disruption  │  │   │  │
│  │  │ │              │        │ $$$$    │             │  │   │  │
│  │  │ └──────────────┴────────┴─────────┴─────────────┘  │   │  │
│  │  │                                                     │   │  │
│  │  │ Recommendation: BEST-OF-BREED                      │   │  │
│  │  │  - Our CRM (superior)                              │   │  │
│  │  │  - Their billing system (better features)          │   │  │
│  │  │  - Our infrastructure (Azure vs their AWS)         │   │  │
│  │  │  - Their analytics (ML capabilities)               │   │  │
│  │  └────────────────────────────────────────────────────┘   │  │
│  │                                                            │  │
│  │  Integration Roadmap:                                     │  │
│  │  ┌────────────────────────────────────────────────────┐   │  │
│  │  │ Day 1 (Close Date):                                 │   │  │
│  │  │  - Employee access (SSO, VPN, Slack)                │   │  │
│  │  │  - Email migration (acquired@newcompany.com)        │   │  │
│  │  │  - Basic monitoring                                 │   │  │
│  │  │  - No customer-facing changes                       │   │  │
│  │  │                                                     │   │  │
│  │  │ Month 1-3 (Quick Wins):                             │   │  │
│  │  │  - SSO integration                                  │   │  │
│  │  │  - Consolidate monitoring (one dashboard)           │   │  │
│  │  │  - Shared Slack channels                            │   │  │
│  │  │  - Cross-team collaboration                         │   │  │
│  │  │                                                     │   │  │
│  │  │ Month 4-9 (Core Integration):                       │   │  │
│  │  │  - Migrate billing system to our platform           │   │  │
│  │  │  - Unify customer databases                         │   │  │
│  │  │  - Consolidate infrastructure (AWS → Azure)         │   │  │
│  │  │  - Decommission duplicate systems                   │   │  │
│  │  │                                                     │   │  │
│  │  │ Month 10-18 (Optimization):                         │   │  │
│  │  │  - Unified codebase (shared libraries)              │   │  │
│  │  │  - Performance optimization                         │   │  │
│  │  │  - Cost optimization (cloud spend)                  │   │  │
│  │  │  - Team consolidation                               │   │  │
│  │  └────────────────────────────────────────────────────┘   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            ▼                                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         Phase 2: Day 1 Integration (Close Date)           │  │
│  │                                                            │  │
│  │  Critical Day 1 Activities:                               │  │
│  │  ┌────────────────────────────────────────────────────┐   │  │
│  │  │ ✅ Employee Onboarding                              │   │  │
│  │  │    - Provision accounts (email, Slack, GitHub)      │   │  │
│  │  │    - VPN access                                     │   │  │
│  │  │    - Welcome email from CEO                         │   │  │
│  │  │    - Org chart update                               │   │  │
│  │  │                                                     │   │  │
│  │  │ ✅ System Access                                    │   │  │
│  │  │    - SSO integration (Okta)                         │   │  │
│  │  │    - GitHub org merge                               │   │  │
│  │  │    - AWS/Azure cross-account access                 │   │  │
│  │  │    - Monitoring dashboards                          │   │  │
│  │  │                                                     │   │  │
│  │  │ ✅ Customer Communication                           │   │  │
│  │  │    - Announce acquisition                           │   │  │
│  │  │    - Reassure continuity                            │   │  │
│  │  │    - No immediate changes                           │   │  │
│  │  │                                                     │   │  │
│  │  │ ✅ Legal & Compliance                               │   │  │
│  │  │    - Update contracts                               │   │  │
│  │  │    - Privacy policy updates                         │   │  │
│  │  │    - Regulatory notifications                       │   │  │
│  │  └────────────────────────────────────────────────────┘   │  │
│  │                                                            │  │
│  │  NO customer-facing changes on Day 1                      │  │
│  │  (minimize risk of outages)                               │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            ▼                                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         Phase 3: Technical Integration (Month 1-18)       │  │
│  │                                                            │  │
│  │  Wave 1: Infrastructure (Month 1-3)                       │  │
│  │  ┌────────────────────────────────────────────────────┐   │  │
│  │  │ - Consolidate cloud accounts (AWS → Azure)          │   │  │
│  │  │ - Unified monitoring (Datadog)                      │   │  │
│  │  │ - Consolidated CI/CD (migrate to GitHub Actions)    │   │  │
│  │  │ - Secrets management (Vault)                        │   │  │
│  │  └────────────────────────────────────────────────────┘   │  │
│  │                                                            │  │
│  │  Wave 2: Data Integration (Month 4-9)                     │  │
│  │  ┌────────────────────────────────────────────────────┐   │  │
│  │  │ Customer Data Unification:                          │   │  │
│  │  │  - Map customer IDs (theirs → ours)                │   │  │
│  │  │  - Merge duplicate customers                        │   │  │
│  │  │  - Data quality (deduplication, normalization)      │   │  │
│  │  │  - Migration validation (checksums)                 │   │  │
│  │  │                                                     │   │  │
│  │  │ Database Consolidation:                             │   │  │
│  │  │  - Schema mapping                                   │   │  │
│  │  │  - ETL pipelines                                    │   │  │
│  │  │  - Dual-write period (both DBs)                     │   │  │
│  │  │  - Cutover & decommission old DB                    │   │  │
│  │  └────────────────────────────────────────────────────┘   │  │
│  │                                                            │  │
│  │  Wave 3: Application Integration (Month 6-15)             │  │
│  │  ┌────────────────────────────────────────────────────┐   │  │
│  │  │ Code Migration:                                     │   │  │
│  │  │  - Migrate best-of-breed components                │   │  │
│  │  │  - Refactor for compatibility                       │   │  │
│  │  │  - Shared UI component library                      │   │  │
│  │  │  - API integration layer                            │   │  │
│  │  │                                                     │   │  │
│  │  │ Decommissioning:                                    │   │  │
│  │  │  - Deprecate duplicate systems                      │   │  │
│  │  │  - Sunset timeline (6-12 months)                    │   │  │
│  │  │  - Customer migration plan                          │   │  │
│  │  │  - Archive data for compliance                      │   │  │
│  │  └────────────────────────────────────────────────────┘   │  │
│  │                                                            │  │
│  │  Wave 4: Team & Process Integration (Ongoing)             │  │
│  │  ┌────────────────────────────────────────────────────┐   │  │
│  │  │ - Unified engineering org structure                 │   │  │
│  │  │ - Standardize processes (agile, code review)        │   │  │
│  │  │ - Tech stack alignment                              │   │  │
│  │  │ - Knowledge sharing (lunch & learns)                │   │  │
│  │  │ - Retention (keep key talent)                       │   │  │
│  │  └────────────────────────────────────────────────────┘   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            ▼                                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         Phase 4: Synergy Realization                      │  │
│  │                                                            │  │
│  │  Cost Synergies:                                          │  │
│  │  - Decommission duplicate infrastructure: $500K/year      │  │
│  │  - Consolidated vendor contracts: $300K/year              │  │
│  │  - Reduced headcount (redundancies): $1.2M/year           │  │
│  │  - Total: $2M/year                                        │  │
│  │                                                            │  │
│  │  Revenue Synergies:                                       │  │
│  │  - Cross-sell products: $3M/year                          │  │
│  │  - Unified product offering: $5M/year                     │  │
│  │  - Total: $8M/year                                        │  │
│  │                                                            │  │
│  │  Total Synergies: $10M/year                               │  │
│  │  Integration Cost: $4.2M                                  │  │
│  │  Payback Period: 5 months                                 │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└────────────────────────────────────────────────────────────────┘
```

## Data Model

```typescript
/**
 * @prompt-id forge-v4.1:ma-integration:data-model:001
 * @generated-at 2026-01-20T00:00:00Z
 * @model claude-sonnet-4-5
 */

model AcquisitionIntegration {
  id                    String   @id @default(cuid())
  organizationId        String   // Acquirer
  organization          Organization @relation(fields: [organizationId], references: [id])

  // Deal details
  dealName              String           // "Acquisition of AcquiredCo"
  targetCompany         String
  dealValue             Int              // Cents
  closeDate             DateTime

  // Integration strategy
  integrationStrategy   IntegrationStrategy

  // Status
  status                IntegrationStatus
  progressPercentage    Int @default(0)

  // Synergies
  projectedCostSynergies    Int          // Annual (cents)
  projectedRevenueSynergies Int          // Annual (cents)
  realizedSynergies         Int?         // Actual

  // Technical details
  targetTechStack       Json             // Technology assessment
  integrationComplexity Float            // 1-10
  estimatedEffort       Int              // Person-months

  // Phases
  phases                IntegrationPhase[]

  // Teams
  integrationTeam       IntegrationTeamMember[]

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@index([organizationId])
  @@index([status])
}

enum IntegrationStrategy {
  ABSORB                // Full merger into acquirer
  COEXIST               // Run in parallel
  BEST_OF_BREED         // Pick best from each
  GREENFIELD            // Rebuild from scratch
}

enum IntegrationStatus {
  DUE_DILIGENCE         // Pre-close
  PLANNING              // Pre-close planning
  DAY_1_READY           // Ready for close
  INTEGRATING           // Post-close integration
  OPTIMIZING            // Synergy realization
  COMPLETED             // Fully integrated
}

model IntegrationPhase {
  id                    String   @id @default(cuid())
  integrationId         String
  integration           AcquisitionIntegration @relation(fields: [integrationId], references: [id])

  name                  String
  phaseType             IntegrationPhaseType
  order                 Int

  status                PhaseStatus
  startDate             DateTime
  endDate               DateTime

  // Milestones
  milestones            IntegrationMilestone[]

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@index([integrationId])
  @@unique([integrationId, order])
}

enum IntegrationPhaseType {
  DUE_DILIGENCE
  PLANNING
  DAY_1
  INFRASTRUCTURE
  DATA
  APPLICATION
  TEAM_PROCESS
  SYNERGY_REALIZATION
}

model IntegrationMilestone {
  id                    String   @id @default(cuid())
  phaseId               String
  phase                 IntegrationPhase @relation(fields: [phaseId], references: [id])

  name                  String
  description           String
  dueDate               DateTime
  completedDate         DateTime?

  status                MilestoneStatus

  // Deliverables
  deliverables          Json?

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@index([phaseId])
}

enum MilestoneStatus {
  NOT_STARTED
  IN_PROGRESS
  AT_RISK
  COMPLETED
  BLOCKED
}

// Integration team
model IntegrationTeamMember {
  id                    String   @id @default(cuid())
  integrationId         String
  integration           AcquisitionIntegration @relation(fields: [integrationId], references: [id])

  userId                String
  user                  User @relation(fields: [userId], references: [id])

  role                  IntegrationRole
  workstream            String?          // "Infrastructure", "Data", "Application"

  createdAt             DateTime @default(now())

  @@index([integrationId])
  @@unique([integrationId, userId])
}

enum IntegrationRole {
  INTEGRATION_LEAD      // Overall program manager
  TECHNICAL_LEAD        // Technical workstream lead
  CONTRIBUTOR           // Engineer working on integration
  STAKEHOLDER           // Informed but not executing
}

// System mapping (source → target)
model SystemMapping {
  id                    String   @id @default(cuid())
  integrationId         String

  // Source (acquired company)
  sourceSystem          String
  sourceOwner           String?

  // Target (acquirer)
  targetSystem          String?          // Null = decommission
  targetOwner           String?

  // Migration
  migrationStrategy     MigrationStrategy
  migrationStatus       MigrationStatus
  cutoverDate           DateTime?

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@index([integrationId])
}

enum MigrationStrategy {
  MIGRATE               // Move to target system
  KEEP                  // Keep source system
  DECOMMISSION          // Sunset
  REPLACE               // New system entirely
}

enum MigrationStatus {
  NOT_STARTED
  PLANNING
  MIGRATING
  TESTING
  CUTOVER
  COMPLETED
  DECOMMISSIONED
}
```

## M&A Integration Playbooks

### 1. Tech Acquisition (Acquihire) - 6-12 months

```typescript
const acquihirePlaybook = {
  goal: 'Acquire talent + integrate product into platform',

  timeline: {
    'Month 1': 'Day 1 readiness (employee onboarding)',
    'Month 2-3': 'Product assessment & integration planning',
    'Month 4-9': 'Integrate product features into platform',
    'Month 10-12': 'Decommission acquired product, migrate customers',
  },

  keyActivities: [
    'Retain key engineers (retention bonuses)',
    'Integrate product roadmap',
    'Migrate customers to unified platform',
    'Sunset acquired product brand',
  ],
}
```

### 2. Horizontal Merger (Competitor) - 12-24 months

```typescript
const horizontalMergerPlaybook = {
  goal: 'Consolidate market, eliminate redundancy',

  synergies: {
    cost: [
      'Decommission duplicate infrastructure ($1M/year)',
      'Consolidate sales teams',
      'Unified support organization',
      'Vendor contract renegotiation',
    ],
    revenue: [
      'Cross-sell to combined customer base',
      'Unified product offering (best-of-breed)',
      'Market power (pricing)',
    ],
  },

  integration: {
    systems: 'Best-of-breed (keep best from each company)',
    team: 'Merge with layoffs (eliminate redundancy)',
    brand: 'Unified brand or dual-brand strategy',
  },
}
```

## Consequences

### Positive

1. **Synergy Realization**: $2-10M annual cost savings typical
2. **Revenue Growth**: Cross-sell opportunities
3. **Competitive Advantage**: Combined capabilities
4. **Talent Acquisition**: Acquire experienced engineers
5. **Market Power**: Consolidation

### Negative

1. **High Cost**: $10-50M integration cost (mid-market)
2. **Long Timeline**: 18-36 months
3. **Employee Attrition**: 25-40% of acquired team leaves
4. **Customer Churn**: 10-20% during integration
5. **Cultural Clash**: Different ways of working

### Mitigations

1. **Retention Bonuses**: Keep key talent (12-24 month vesting)
2. **Communication**: Over-communicate with employees & customers
3. **Quick Wins**: Show progress early (SSO, monitoring)
4. **Minimize Disruption**: No customer-facing changes on Day 1
5. **Integration Team**: Dedicated full-time team

## Metrics & Success Criteria

### Integration Progress
- **Day 1 Readiness**: 100% of employees onboarded
- **Month 3**: Infrastructure consolidated
- **Month 9**: Data migration complete
- **Month 18**: Application integration complete

### Synergy Realization
- **Cost Synergies**: $2M+ annual savings
- **Revenue Synergies**: $5M+ annual growth
- **Payback Period**: <12 months

### Retention
- **Employee Retention**: >75% at 12 months
- **Customer Retention**: >90% at 12 months

## References

- [Deloitte M&A Trends 2026](https://www2.deloitte.com/us/en/pages/mergers-and-acquisitions/articles/ma-trends-report.html)
- [BCG: Tech M&A](https://www.bcg.com/capabilities/mergers-acquisitions-transactions-pmi/technology-mergers-and-acquisitions)
- [PwC: M&A Integration](https://www.pwc.com/us/en/services/consulting/deals/integration.html)
- ADR-024: Change Management for Code Transformations
- ADR-027: Digital Transformation Playbook

---

**Document Version**: 1.0
**Last Updated**: 2026-01-20
