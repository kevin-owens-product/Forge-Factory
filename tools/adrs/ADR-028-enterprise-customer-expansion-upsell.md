# ADR-028: Enterprise Customer Expansion & Upsell Engine

## Status
Accepted

## Context

Enterprise customers represent our highest-value segment ($150K avg ARR, $1.5M-$2.25M total from 10-15 customers), but also our greatest expansion opportunity. Industry data shows:

**SaaS Expansion Benchmarks** (from OpenView, ChartMogul):
- **Net Dollar Retention (NDR)**: Best-in-class SaaS companies achieve 120-130% NDR
  - 120% = $100K customer → $120K next year (20% expansion)
  - This offsets churn and drives efficient growth
- **Expansion Revenue**: 30-40% of total ARR growth comes from existing customers
  - Lower CAC than new logos ($0 vs $50K-$100K per enterprise deal)
  - Faster sales cycles (30 days vs 180 days for new customers)
- **Land & Expand**: Companies that master expansion grow 2-3x faster than acquisition-only

### Current State: Missed Expansion Opportunities

1. **Reactive Expansion** (Not Proactive):
   - Customers reach out to add seats (we don't suggest it)
   - Missing cross-sell opportunities (customers don't know about features)
   - No systematic identification of expansion-ready customers

   Average expansion revenue: $15K/year (only 10% of base ARR)
   Industry best practice: $30K-$45K/year (20-30% of base ARR)

2. **No Expansion Playbook**:
   - CSMs don't have visibility into expansion signals
   - No automated prompts for "right time to expand" conversations
   - Lack of pricing/packaging options for upsells

3. **Limited Product Telemetry**:
   - Don't track seat utilization (95% seats used = expansion trigger)
   - Don't monitor feature usage (high usage = upsell opportunity)
   - Don't identify departments not yet onboarded

4. **Organizational Sprawl**:
   - Customer starts with 1 team, expands to 5 teams
   - Each team has different repo access, different use cases
   - No visibility into which teams would benefit from Forge

### Expansion Opportunities

```
┌────────────────────────────────────────────────────────────────┐
│                  Expansion Motion Matrix                        │
├────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Land            Expand Width       Expand Depth    Expand Up  │
│  ────            ────────────       ────────────    ─────────   │
│                                                                  │
│  Pilot           More Teams         More Features   Executives │
│  (10-20 users)   (20 → 100 users)   (Basic → Pro)   (Pro → Ent)│
│                                                                  │
│  $50K ARR        +$75K ARR          +$30K ARR       +$100K ARR │
│                  (Seat expansion)   (Upsell)        (Premium)   │
│                                                                  │
│  Quarter 1       Quarter 2-3        Quarter 3-4     Year 2      │
│                                                                  │
└────────────────────────────────────────────────────────────────┘
```

**Expansion Types**:

1. **Seat Expansion** (Horizontal):
   - Add more users within existing team
   - Expand to new teams/departments
   - Company-wide rollout (100 → 500 → 2,000 users)

   Example: Acme Corp starts with API Team (50 users) → adds Web Team (30 users) → adds Mobile Team (20 users)
   Revenue impact: $50K → $100K ARR (+100%)

2. **Feature Upsell** (Vertical):
   - Upgrade from Growth → Enterprise tier
   - Add premium features (SCIM, SSO, advanced security)
   - Custom integrations, white-glove support

   Example: Customer on Growth ($2K/user/year) → upgrades to Enterprise ($3K/user/year)
   Revenue impact: $100K → $150K ARR (+50%)

3. **Usage-Based Expansion**:
   - Analyze more repositories
   - Transform more lines of code
   - Higher API call quotas

   Example: Customer analyzing 10 repos → expands to 50 repos
   Revenue impact: Overage charges or tier upgrade

4. **Service Attach**:
   - Professional services (migration, custom training)
   - Dedicated success manager
   - Priority support

   Example: Add $50K professional services package
   Revenue impact: One-time revenue + higher renewal rates

5. **Multi-Product** (if we launch additional products):
   - Forge Code Quality → Forge Security → Forge Performance
   - Bundle pricing encourages multi-product adoption

### Requirements

**Must Have**:
- Automated expansion signal detection (usage patterns, milestones)
- CSM expansion dashboard (show expansion-ready customers)
- Expansion playbooks (when & how to have expansion conversations)
- Self-service upgrade path (customer can add seats without sales call)
- Pricing calculator (quote builder for CSMs and customers)
- Expansion revenue tracking (measure NDR, expansion ARR)

**Should Have**:
- In-product expansion prompts ("Your team is at 95% seat capacity. Add more seats?")
- Feature gating (show locked features to drive upsell)
- Usage analytics for customer (transparency drives expansion)
- Champion identification (who internally can advocate for expansion?)
- ROI calculator (justify expansion with business case)

**Could Have**:
- AI-powered expansion recommendations
- Automated email campaigns (nurture toward expansion)
- Competitive displacement (identify customers using competitors)
- Referral program (customers refer other teams/departments)

## Decision

We will implement an **Enterprise Expansion & Upsell Engine** with:

### 1. Expansion Signal Detection
### 2. Expansion Playbooks & CSM Dashboard
### 3. Self-Service Upgrade Flow
### 4. In-Product Growth Prompts
### 5. Pricing & Quoting System
### 6. Expansion Revenue Tracking

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│              Enterprise Expansion Engine                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │               Signal Detection Layer                      │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │ • Seat Utilization Monitor (>90% = expansion trigger)    │   │
│  │ • Feature Usage Analyzer (identify upsell candidates)    │   │
│  │ • Department Discovery (find un-onboarded teams)         │   │
│  │ • Milestone Tracker (QBR complete = expansion ready)     │   │
│  │ • Health Score Gate (only expand healthy customers)      │   │
│  └──────────────────────────────────────────────────────────┘   │
│                             │                                     │
│                             ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │          Expansion Opportunity Scoring                    │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │ • Calculate expansion readiness (0-100 score)            │   │
│  │ • Estimate expansion potential ($ARR impact)             │   │
│  │ • Identify expansion type (seat, feature, usage)         │   │
│  │ • Predict close probability (based on health, timing)    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                             │                                     │
│                             ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Playbook Recommendation                      │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │ • Match customer to expansion playbook                   │   │
│  │ • Generate talking points for CSM                        │   │
│  │ • Create expansion tasks (schedule call, send proposal)  │   │
│  │ • Prepare ROI business case                              │   │
│  └──────────────────────────────────────────────────────────┘   │
│                             │                                     │
│                             ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │               Execution Layer                             │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │ • CSM Dashboard (expansion pipeline)                     │   │
│  │ • In-Product Prompts (seat/feature upsells)              │   │
│  │ • Self-Service Upgrade (customer adds seats)             │   │
│  │ • Quoting System (generate proposals)                    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                             │                                     │
│                             ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │            Tracking & Analytics                           │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │ • Expansion revenue (track upsells, seat adds)           │   │
│  │ • NDR calculation (Net Dollar Retention)                 │   │
│  │ • Expansion velocity (time from signal to close)         │   │
│  │ • Playbook effectiveness (conversion rates by playbook)  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 1. Expansion Signal Detection

**Automated Monitors** (run daily):

```typescript
// Seat utilization monitor
export class SeatUtilizationMonitor {
  @Cron('0 3 * * *') // 3am daily
  async checkSeatUtilization() {
    const orgs = await this.db.organization.findMany({
      where: { tier: 'enterprise', status: 'active' }
    })

    for (const org of orgs) {
      const utilization = await this.calculateUtilization(org)

      // Expansion trigger: >90% seat utilization
      if (utilization.percent >= 0.90) {
        await this.createExpansionOpportunity({
          organizationId: org.id,
          type: 'seat_expansion',
          trigger: 'high_seat_utilization',
          score: this.calculateScore(utilization),
          estimatedARR: this.estimateARR(org, utilization),
          suggestedAction: 'Add 20% more seats',
        })
      }

      // Warning trigger: >80% (proactive heads-up)
      if (utilization.percent >= 0.80 && utilization.percent < 0.90) {
        await this.createExpansionSignal({
          organizationId: org.id,
          type: 'seat_utilization_warning',
          message: `${org.name} at ${(utilization.percent * 100).toFixed(0)}% seat capacity`,
          action: 'Monitor closely, prepare expansion conversation',
        })
      }
    }
  }

  async calculateUtilization(org: Organization) {
    const activeUsers = await this.db.user.count({
      where: {
        organizationId: org.id,
        status: 'active',
        lastLoginAt: { gt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // 30 days
      }
    })

    return {
      total: org.seats,
      active: activeUsers,
      percent: activeUsers / org.seats,
      available: org.seats - activeUsers,
    }
  }

  estimateARR(org: Organization, utilization: any): number {
    // Suggest 20% more seats (buffer for growth)
    const additionalSeats = Math.ceil(org.seats * 0.2)
    const pricePerSeat = org.arr / org.seats // Avg price per seat
    return additionalSeats * pricePerSeat
  }
}

// Feature usage analyzer
export class FeatureUsageAnalyzer {
  @Cron('0 4 * * *') // 4am daily
  async analyzeFeatureUsage() {
    const orgs = await this.db.organization.findMany({
      where: { tier: { in: ['growth', 'startup'] } } // Not yet on enterprise tier
    })

    for (const org of orgs) {
      const usage = await this.getFeatureUsage(org.id)

      // Upsell trigger: Using features not in current plan
      const lockedFeatures = this.getLockedFeatures(org.tier)
      const attemptedFeatures = usage.filter(f => lockedFeatures.includes(f.name))

      if (attemptedFeatures.length > 0) {
        await this.createExpansionOpportunity({
          organizationId: org.id,
          type: 'feature_upsell',
          trigger: 'attempted_premium_features',
          score: 80, // High intent
          estimatedARR: this.getUpgradeCost(org.tier, 'enterprise'),
          suggestedAction: `Upgrade to Enterprise for ${attemptedFeatures.map(f => f.name).join(', ')}`,
          lockedFeatures: attemptedFeatures,
        })
      }

      // Power user trigger: High usage of current features
      const powerUsage = usage.filter(f => f.usagePercent > 0.8) // Using >80% of quota

      if (powerUsage.length >= 3) {
        await this.createExpansionOpportunity({
          organizationId: org.id,
          type: 'usage_expansion',
          trigger: 'power_user_behavior',
          score: 75,
          estimatedARR: this.estimateUsageExpansion(org, powerUsage),
          suggestedAction: 'Increase quotas or upgrade tier',
        })
      }
    }
  }

  getLockedFeatures(currentTier: Tier): string[] {
    const featureMatrix = {
      startup: ['sso', 'scim', 'custom_roles', 'priority_support', 'sla'],
      growth: ['scim', 'custom_roles', 'priority_support', 'sla'],
      enterprise: [], // All features available
    }

    return featureMatrix[currentTier] || []
  }
}

// Department discovery
export class DepartmentDiscovery {
  @Cron('0 5 * * 0') // 5am every Sunday
  async discoverNewDepartments() {
    const orgs = await this.db.organization.findMany({
      where: { tier: 'enterprise', status: 'active' }
    })

    for (const org of orgs) {
      // Analyze email domains to identify departments
      const users = await this.db.user.findMany({
        where: { organizationId: org.id },
        select: { email: true }
      })

      const domains = this.extractDepartments(users)

      // Compare to onboarded departments
      const onboarded = await this.getOnboardedDepartments(org.id)
      const notOnboarded = domains.filter(d => !onboarded.includes(d))

      if (notOnboarded.length > 0) {
        await this.createExpansionOpportunity({
          organizationId: org.id,
          type: 'department_expansion',
          trigger: 'unonboarded_departments_discovered',
          score: 70,
          estimatedARR: notOnboarded.length * 50_000, // $50K per department
          suggestedAction: `Expand to ${notOnboarded.join(', ')} departments`,
          departments: notOnboarded,
        })
      }
    }
  }

  extractDepartments(users: { email: string }[]): string[] {
    // Heuristic: Extract department from email prefix
    // Examples: engineering@, marketing@, sales@, product@
    const departments = new Set<string>()

    for (const user of users) {
      const match = user.email.match(/^([a-z]+)@/)
      if (match) {
        departments.add(match[1])
      }
    }

    return Array.from(departments)
  }
}

// Milestone-based trigger
export class MilestoneExpansionTrigger {
  @OnEvent('customer.qbr_completed')
  async onQBRCompleted(event: QBRCompletedEvent) {
    // QBR completion = customer is engaged and seeing value
    // Perfect time for expansion conversation

    const org = await this.db.organization.findUnique({
      where: { id: event.organizationId }
    })

    const health = await this.healthService.getLatestScore(org.id)

    // Only suggest expansion if healthy (>70)
    if (health.score >= 70) {
      await this.createExpansionOpportunity({
        organizationId: org.id,
        type: 'post_qbr_expansion',
        trigger: 'qbr_completed_healthy_customer',
        score: 85, // High readiness
        estimatedARR: org.arr * 0.2, // 20% expansion
        suggestedAction: 'Schedule expansion conversation within 2 weeks',
        context: {
          qbrDate: event.completedAt,
          healthScore: health.score,
          roiMultiple: event.roiMultiple,
        },
      })
    }
  }

  @OnEvent('customer.case_study_published')
  async onCaseStudyPublished(event: CaseStudyEvent) {
    // Customer published case study = strong advocate
    // Opportunity for department/company expansion

    await this.createExpansionOpportunity({
      organizationId: event.organizationId,
      type: 'advocate_expansion',
      trigger: 'case_study_published',
      score: 90, // Very high readiness
      estimatedARR: event.organization.arr * 0.5, // 50% expansion potential
      suggestedAction: 'Leverage advocate for company-wide rollout',
      context: {
        caseStudyUrl: event.url,
        champion: event.championEmail,
      },
    })
  }
}
```

**Expansion Opportunity Scoring**:
```typescript
interface ExpansionOpportunity {
  id: string
  organizationId: string

  // Classification
  type: ExpansionType
  trigger: string  // What caused this opportunity

  // Scoring
  score: number  // 0-100 (readiness)
  estimatedARR: number  // Potential expansion revenue
  closeProbability: number  // 0-1 (likelihood of closing)

  // Recommendation
  suggestedAction: string
  playbook: string  // Which playbook to use
  talkingPoints: string[]

  // Context
  context: Json  // Additional data for CSM

  // Tracking
  status: 'open' | 'in_progress' | 'closed_won' | 'closed_lost'
  assignedTo: string  // CSM email
  createdAt: DateTime
  closedAt: DateTime?
  actualARR: number?  // Actual expansion (if closed won)
}

type ExpansionType =
  | 'seat_expansion'
  | 'feature_upsell'
  | 'usage_expansion'
  | 'department_expansion'
  | 'tier_upgrade'
  | 'service_attach'
  | 'multi_product'

function calculateExpansionScore(opp: ExpansionOpportunity, org: Organization): number {
  const factors = {
    // Health score (must be >70 to expand)
    health: org.healthScore >= 70 ? 20 : 0,

    // Tenure (>6 months = established relationship)
    tenure: org.tenureDays >= 180 ? 15 : org.tenureDays / 180 * 15,

    // Usage intensity (high usage = ready for more)
    usage: org.usageScore / 100 * 15,

    // NPS (promoters more likely to expand)
    nps: org.nps >= 9 ? 15 : org.nps >= 7 ? 10 : 0,

    // Trigger quality (some triggers are stronger signals)
    trigger: {
      'high_seat_utilization': 20,
      'attempted_premium_features': 15,
      'qbr_completed_healthy_customer': 15,
      'case_study_published': 20,
      'power_user_behavior': 10,
    }[opp.trigger] || 5,

    // Timing (Q4 budget season is best)
    timing: isQ4() ? 15 : 10,
  }

  return Object.values(factors).reduce((sum, val) => sum + val, 0)
}
```

### 2. Expansion Playbooks & CSM Dashboard

**Expansion Playbooks**:

```typescript
interface ExpansionPlaybook {
  id: string
  name: string
  description: string

  // When to use
  applicableFor: {
    expansionTypes: ExpansionType[]
    minScore: number  // Minimum readiness score
    healthThreshold: number  // Minimum health score
  }

  // Steps
  steps: PlaybookStep[]

  // Success criteria
  avgCloseRate: number  // Historical close rate
  avgDaysToClose: number
  avgExpansionARR: number
}

const seatExpansionPlaybook: ExpansionPlaybook = {
  id: 'seat-expansion-standard',
  name: 'Standard Seat Expansion',
  description: 'Customer approaching seat capacity, ready to add more users',

  applicableFor: {
    expansionTypes: ['seat_expansion'],
    minScore: 70,
    healthThreshold: 70,
  },

  steps: [
    {
      step: 1,
      title: 'Validate Utilization',
      description: 'Confirm customer is at >90% seat capacity',
      actions: [
        'Review usage dashboard',
        'Identify teams/departments at capacity',
        'Check if any seats are inactive (can be reclaimed)',
      ],
      duration: '1 day',
    },
    {
      step: 2,
      title: 'Build Business Case',
      description: 'Quantify value and justify expansion',
      actions: [
        'Calculate ROI from current usage',
        'Project value of additional seats',
        'Identify departments/teams not yet onboarded',
      ],
      duration: '2 days',
    },
    {
      step: 3,
      title: 'Schedule Expansion Conversation',
      description: 'Proactive outreach to champion',
      actions: [
        'Send email: "Your team is growing! Let\'s discuss adding more seats."',
        'Schedule 30-min call with champion + admin',
        'Share usage data showing high adoption',
      ],
      duration: '3 days',
    },
    {
      step: 4,
      title: 'Present Proposal',
      description: 'Formal quote for additional seats',
      actions: [
        'Generate quote (use pricing calculator)',
        'Offer volume discount (if adding >50 seats)',
        'Align on timeline and billing',
      ],
      duration: '1 day',
    },
    {
      step: 5,
      title: 'Close & Implement',
      description: 'Execute contract amendment',
      actions: [
        'Send DocuSign for signature',
        'Update Salesforce opportunity',
        'Provision additional seats',
        'Notify billing team for invoice update',
      ],
      duration: '3 days',
    },
  ],

  avgCloseRate: 0.85, // 85% of seat expansion opps close
  avgDaysToClose: 14,
  avgExpansionARR: 30_000,
}

const featureUpsellPlaybook: ExpansionPlaybook = {
  id: 'feature-upsell-enterprise',
  name: 'Feature Upsell to Enterprise Tier',
  description: 'Customer attempting to use premium features, ready to upgrade',

  applicableFor: {
    expansionTypes: ['feature_upsell', 'tier_upgrade'],
    minScore: 75,
    healthThreshold: 70,
  },

  steps: [
    {
      step: 1,
      title: 'Identify Feature Gaps',
      description: 'Understand which premium features customer needs',
      actions: [
        'Review attempted feature clicks (telemetry)',
        'Ask: "What features would be most valuable to you?"',
        'Prioritize: SSO, SCIM, custom roles, SLA, priority support',
      ],
      duration: '2 days',
    },
    {
      step: 2,
      title: 'Demo Premium Features',
      description: 'Show value of Enterprise tier',
      actions: [
        'Schedule demo call (30 min)',
        'Walk through SSO setup (if needed)',
        'Show compliance reports (SOC2, HIPAA)',
        'Highlight priority support SLA',
      ],
      duration: '3 days',
    },
    {
      step: 3,
      title: 'Build ROI Case',
      description: 'Quantify value of upgrade',
      actions: [
        'Calculate time saved with SSO (no password resets)',
        'Calculate IT efficiency with SCIM (auto-provisioning)',
        'Calculate risk reduction with priority support',
      ],
      duration: '2 days',
    },
    {
      step: 4,
      title: 'Present Pricing',
      description: 'Transparent pricing for upgrade',
      actions: [
        'Calculate prorated upgrade cost',
        'Offer annual commitment discount (10%)',
        'Provide payment options (annual vs quarterly)',
      ],
      duration: '1 day',
    },
    {
      step: 5,
      title: 'Close & Onboard',
      description: 'Upgrade tier and configure features',
      actions: [
        'Sign contract amendment',
        'Upgrade account in system',
        'Schedule SSO/SCIM onboarding (if applicable)',
        'Provide Enterprise onboarding guide',
      ],
      duration: '5 days',
    },
  ],

  avgCloseRate: 0.70, // 70% of feature upsell opps close
  avgDaysToClose: 21,
  avgExpansionARR: 50_000,
}
```

**CSM Expansion Dashboard** (`/apps/admin/expansion`):

```typescript
export default async function ExpansionDashboardPage() {
  const opportunities = await getExpansionOpportunities()
  const pipeline = await getExpansionPipeline()
  const metrics = await getExpansionMetrics()

  return (
    <div className="p-8 space-y-8">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard
          title="Expansion Pipeline"
          value={`$${(pipeline.total / 1000).toFixed(0)}K`}
          description={`${pipeline.count} opportunities`}
          icon={<TrendingUp />}
        />
        <MetricCard
          title="NDR (TTM)"
          value={`${(metrics.ndr * 100).toFixed(0)}%`}
          trend={metrics.ndrTrend}
          description="Target: 120%+"
          icon={<DollarSign />}
        />
        <MetricCard
          title="Avg Expansion ARR"
          value={`$${(metrics.avgExpansionARR / 1000).toFixed(0)}K`}
          description="Per customer per year"
          icon={<BarChart />}
        />
        <MetricCard
          title="Close Rate"
          value={`${(metrics.closeRate * 100).toFixed(0)}%`}
          description="Expansion opps closed"
          icon={<Target />}
        />
      </div>

      {/* Expansion Opportunities (Sorted by Score) */}
      <Card>
        <CardHeader>
          <CardTitle>Expansion Opportunities ({opportunities.length})</CardTitle>
          <div className="flex gap-2">
            <FilterDropdown
              label="Type"
              options={['All', 'Seat', 'Feature', 'Usage', 'Department']}
            />
            <FilterDropdown
              label="Score"
              options={['All', '>90', '75-90', '60-75', '<60']}
            />
            <FilterDropdown
              label="Status"
              options={['Open', 'In Progress', 'Closed Won', 'Closed Lost']}
            />
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={[
              { key: 'organizationName', label: 'Customer', sortable: true },
              { key: 'type', label: 'Type', render: (type) => (
                <Badge variant={getBadgeVariant(type)}>{formatType(type)}</Badge>
              )},
              { key: 'score', label: 'Score', sortable: true, render: (score) => (
                <ExpansionScoreBadge score={score} />
              )},
              { key: 'estimatedARR', label: 'Est. ARR', sortable: true, format: 'currency' },
              { key: 'closeProbability', label: 'Close %', sortable: true, render: (prob) => (
                `${(prob * 100).toFixed(0)}%`
              )},
              { key: 'trigger', label: 'Trigger' },
              { key: 'createdAt', label: 'Created', format: 'date' },
              { key: 'actions', label: '', render: (_, opp) => (
                <Button
                  size="sm"
                  onClick={() => router.push(`/expansion/${opp.id}`)}
                >
                  View Playbook
                </Button>
              )}
            ]}
            data={opportunities}
            defaultSort={{ key: 'score', order: 'desc' }}
          />
        </CardContent>
      </Card>

      {/* Expansion by Type */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Expansion by Type</CardTitle>
          </CardHeader>
          <CardContent>
            <ExpansionByTypeChart data={metrics.byType} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Expansion Velocity</CardTitle>
          </CardHeader>
          <CardContent>
            <ExpansionVelocityChart data={metrics.velocity} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
```

**Opportunity Detail Page** (`/apps/admin/expansion/[id]`):

```typescript
export default async function ExpansionOpportunityPage({
  params
}: {
  params: { id: string }
}) {
  const opp = await getExpansionOpportunity(params.id)
  const org = await getOrganization(opp.organizationId)
  const playbook = await getPlaybook(opp.type)

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">{org.name}</h1>
          <p className="text-slate-600">
            {formatType(opp.type)} · Created {formatDate(opp.createdAt)}
          </p>
        </div>

        <div className="flex gap-2">
          <ExpansionScoreBadge score={opp.score} size="large" />
          <Badge variant="outline">
            {(opp.closeProbability * 100).toFixed(0)}% Close Probability
          </Badge>
        </div>
      </div>

      {/* Opportunity Details */}
      <Card>
        <CardHeader>
          <CardTitle>Opportunity Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold">Trigger</label>
              <p>{opp.trigger}</p>
            </div>
            <div>
              <label className="text-sm font-semibold">Estimated ARR</label>
              <p className="text-2xl font-bold text-green-600">
                ${opp.estimatedARR.toLocaleString()}
              </p>
            </div>
            <div>
              <label className="text-sm font-semibold">Suggested Action</label>
              <p>{opp.suggestedAction}</p>
            </div>
            <div>
              <label className="text-sm font-semibold">Status</label>
              <StatusBadge status={opp.status} />
            </div>
          </div>

          {/* Context */}
          {opp.context && (
            <div>
              <label className="text-sm font-semibold">Additional Context</label>
              <pre className="mt-2 p-4 bg-slate-100 rounded text-sm">
                {JSON.stringify(opp.context, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Playbook */}
      <Card>
        <CardHeader>
          <CardTitle>Recommended Playbook: {playbook.name}</CardTitle>
          <p className="text-sm text-slate-600">{playbook.description}</p>
        </CardHeader>
        <CardContent>
          <PlaybookSteps steps={playbook.steps} />

          <div className="mt-6 grid grid-cols-3 gap-4 p-4 bg-slate-50 rounded">
            <div>
              <label className="text-sm font-semibold">Avg Close Rate</label>
              <p className="text-xl font-bold">{(playbook.avgCloseRate * 100).toFixed(0)}%</p>
            </div>
            <div>
              <label className="text-sm font-semibold">Avg Days to Close</label>
              <p className="text-xl font-bold">{playbook.avgDaysToClose} days</p>
            </div>
            <div>
              <label className="text-sm font-semibold">Avg Expansion ARR</label>
              <p className="text-xl font-bold">${(playbook.avgExpansionARR / 1000).toFixed(0)}K</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Talking Points */}
      <Card>
        <CardHeader>
          <CardTitle>Talking Points for CSM</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc pl-5 space-y-2">
            {generateTalkingPoints(opp, org).map((point, i) => (
              <li key={i}>{point}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-2">
        <Button onClick={() => updateStatus(opp.id, 'in_progress')}>
          Start Working on This
        </Button>
        <Button variant="outline" onClick={() => generateQuote(opp)}>
          Generate Quote
        </Button>
        <Button variant="outline" onClick={() => scheduleCall(org)}>
          Schedule Call
        </Button>
        <Button variant="destructive" onClick={() => updateStatus(opp.id, 'closed_lost')}>
          Mark as Lost
        </Button>
      </div>
    </div>
  )
}

function generateTalkingPoints(opp: ExpansionOpportunity, org: Organization): string[] {
  const points = [
    `Current usage: ${org.activeUsers} of ${org.seats} seats (${(org.activeUsers / org.seats * 100).toFixed(0)}% utilization)`,
    `Health score: ${org.healthScore}/100 (${org.healthScore >= 70 ? 'healthy' : 'needs attention'})`,
    `Tenure: ${org.tenureDays} days (${(org.tenureDays / 365).toFixed(1)} years)`,
  ]

  switch (opp.type) {
    case 'seat_expansion':
      points.push(
        `You're approaching maximum capacity. Adding more seats ensures your team can continue to grow.`,
        `Based on current trajectory, you'll hit 100% capacity in ${estimateDaysToCapacity(org)} days.`,
        `We recommend adding ${Math.ceil(org.seats * 0.2)} seats (20% buffer for growth).`
      )
      break

    case 'feature_upsell':
      points.push(
        `You've attempted to use ${opp.context.lockedFeatures?.length} premium features: ${opp.context.lockedFeatures?.join(', ')}.`,
        `Upgrading to Enterprise tier unlocks all these features plus priority support and SLA.`,
        `Estimated time savings: ${estimateTimeSavings(opp.context.lockedFeatures)} hours/month with SSO and SCIM automation.`
      )
      break

    case 'department_expansion':
      points.push(
        `We've identified ${opp.context.departments?.length} departments not yet using Forge: ${opp.context.departments?.join(', ')}.`,
        `Each department could benefit from ${estimateDepartmentValue()} in annual value.`,
        `Let's schedule time to discuss rolling out Forge company-wide.`
      )
      break
  }

  return points
}
```

### 3. Self-Service Upgrade Flow

**In-App Upgrade Wizard** (`/apps/portal/upgrade`):

```typescript
export default function UpgradePage() {
  const { organization } = useAuth()
  const [selectedPlan, setSelectedPlan] = useState<Tier | null>(null)

  return (
    <div className="max-w-6xl mx-auto p-8">
      <h1 className="text-4xl font-bold mb-2">Upgrade Your Plan</h1>
      <p className="text-lg text-slate-600 mb-12">
        Scale your team and unlock powerful features
      </p>

      {/* Pricing Table */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <PricingCard
          tier="growth"
          price={2000}
          priceUnit="per user/year"
          features={[
            'Unlimited repositories',
            'AI-Readiness scoring',
            'Code transformations',
            'Team collaboration',
            'Email support',
          ]}
          current={organization.tier === 'growth'}
          onSelect={() => setSelectedPlan('growth')}
        />

        <PricingCard
          tier="enterprise"
          price={3000}
          priceUnit="per user/year"
          features={[
            'Everything in Growth',
            'SSO (SAML, OIDC, Azure AD)',
            'SCIM provisioning',
            'Custom roles & permissions',
            'Priority support',
            '99.95% SLA',
            'Dedicated CSM',
          ]}
          popular
          current={organization.tier === 'enterprise'}
          onSelect={() => setSelectedPlan('enterprise')}
        />

        <PricingCard
          tier="custom"
          price="Contact us"
          features={[
            'Everything in Enterprise',
            'Volume discounts',
            'Custom integrations',
            'Professional services',
            'White-glove onboarding',
            'Executive business reviews',
          ]}
          onSelect={() => router.push('/contact-sales')}
        />
      </div>

      {/* Upgrade Wizard */}
      {selectedPlan && selectedPlan !== organization.tier && (
        <Card className="border-2 border-blue-500">
          <CardHeader>
            <CardTitle>Upgrade to {capitalize(selectedPlan)}</CardTitle>
          </CardHeader>
          <CardContent>
            <UpgradeWizard
              currentTier={organization.tier}
              targetTier={selectedPlan}
              currentSeats={organization.seats}
              onComplete={async (params) => {
                await upgradeAccount(params)
                router.push('/dashboard')
              }}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function UpgradeWizard({
  currentTier,
  targetTier,
  currentSeats,
  onComplete,
}: {
  currentTier: Tier
  targetTier: Tier
  currentSeats: number
  onComplete: (params: UpgradeParams) => Promise<void>
}) {
  const [step, setStep] = useState(1)
  const [seats, setSeats] = useState(currentSeats)
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual')

  const pricing = calculateUpgradePricing({
    currentTier,
    targetTier,
    currentSeats,
    newSeats: seats,
    billingCycle,
  })

  return (
    <div className="space-y-6">
      {/* Step 1: Adjust Seats */}
      {step === 1 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">How many seats do you need?</h3>

          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => setSeats(Math.max(currentSeats, seats - 10))}
            >
              -10
            </Button>

            <Input
              type="number"
              value={seats}
              onChange={(e) => setSeats(parseInt(e.target.value))}
              min={currentSeats}
              className="w-32 text-center text-2xl"
            />

            <Button
              variant="outline"
              onClick={() => setSeats(seats + 10)}
            >
              +10
            </Button>
          </div>

          <p className="text-sm text-slate-600 mt-2">
            You currently have {currentSeats} seats. Minimum {currentSeats} seats required.
          </p>

          <Button className="mt-6" onClick={() => setStep(2)}>
            Continue
          </Button>
        </div>
      )}

      {/* Step 2: Billing Cycle */}
      {step === 2 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Choose billing cycle</h3>

          <RadioGroup value={billingCycle} onChange={setBillingCycle}>
            <RadioOption value="monthly">
              <div className="flex items-center justify-between w-full">
                <span>Monthly</span>
                <span className="font-bold">${pricing.monthly.toLocaleString()}/mo</span>
              </div>
            </RadioOption>

            <RadioOption value="annual">
              <div className="flex items-center justify-between w-full">
                <span>Annual <Badge className="ml-2">Save 10%</Badge></span>
                <span className="font-bold">${pricing.annual.toLocaleString()}/yr</span>
              </div>
            </RadioOption>
          </RadioGroup>

          <div className="flex gap-2 mt-6">
            <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
            <Button onClick={() => setStep(3)}>Continue</Button>
          </div>
        </div>
      )}

      {/* Step 3: Review & Confirm */}
      {step === 3 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Review your upgrade</h3>

          <div className="bg-slate-50 rounded p-6 space-y-4">
            <div className="flex justify-between">
              <span>Current plan:</span>
              <span className="font-semibold">{capitalize(currentTier)}</span>
            </div>
            <div className="flex justify-between">
              <span>New plan:</span>
              <span className="font-semibold">{capitalize(targetTier)}</span>
            </div>
            <div className="flex justify-between">
              <span>Seats:</span>
              <span className="font-semibold">{seats}</span>
            </div>
            <div className="flex justify-between">
              <span>Billing:</span>
              <span className="font-semibold">{capitalize(billingCycle)}</span>
            </div>

            <Separator />

            <div className="flex justify-between">
              <span>Prorated charge today:</span>
              <span className="font-semibold">${pricing.proratedCharge.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Next invoice ({billing Cycle}):</span>
              <span className="text-2xl font-bold">
                ${(billingCycle === 'annual' ? pricing.annual : pricing.monthly).toLocaleString()}
              </span>
            </div>
          </div>

          <Alert className="mt-6">
            <Info className="h-4 w-4" />
            <AlertTitle>What happens next?</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Your account will be upgraded immediately</li>
                <li>New features will be available instantly</li>
                <li>Additional seats can be assigned right away</li>
                <li>You'll receive a confirmation email with next steps</li>
              </ul>
            </AlertDescription>
          </Alert>

          <div className="flex gap-2 mt-6">
            <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
            <Button
              size="lg"
              onClick={() => onComplete({
                targetTier,
                seats,
                billingCycle,
                proratedCharge: pricing.proratedCharge,
              })}
            >
              Confirm Upgrade
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
```

### 4. In-Product Growth Prompts

**Seat Capacity Warning** (shown at 80% utilization):
```typescript
// Appears as banner in product
export function SeatCapacityWarning() {
  const { organization } = useAuth()
  const utilization = useCurrentSeatUtilization()

  if (utilization < 0.8) return null

  const daysToCapacity = estimateDaysToCapacity(organization)
  const suggestedSeats = Math.ceil(organization.seats * 0.2)

  return (
    <Alert variant="warning" className="mb-6">
      <AlertTriangle className="h-5 w-5" />
      <AlertTitle>You're approaching seat capacity</AlertTitle>
      <AlertDescription>
        {organization.activeUsers} of {organization.seats} seats in use ({(utilization * 100).toFixed(0)}%).
        Based on current growth, you'll reach capacity in ~{daysToCapacity} days.
      </AlertDescription>
      <div className="mt-4">
        <Button onClick={() => router.push('/upgrade?action=add_seats')}>
          Add {suggestedSeats} More Seats
        </Button>
      </div>
    </Alert>
  )
}
```

**Feature Unlock Prompt** (when user clicks locked feature):
```typescript
// Modal shown when non-enterprise user clicks SSO
export function FeatureLockedModal({ feature }: { feature: string }) {
  return (
    <Modal>
      <ModalHeader>
        <ModalTitle>{getFeatureName(feature)} is available on Enterprise</ModalTitle>
      </ModalHeader>
      <ModalContent>
        <p className="mb-4">
          {getFeatureDescription(feature)}
        </p>

        <div className="bg-blue-50 rounded p-4 mb-4">
          <h4 className="font-semibold mb-2">What you'll get:</h4>
          <ul className="list-disc pl-5 space-y-1">
            {getFeatureBenefits(feature).map((benefit, i) => (
              <li key={i}>{benefit}</li>
            ))}
          </ul>
        </div>

        <div className="flex gap-2">
          <Button onClick={() => router.push('/upgrade?feature=' + feature)}>
            Upgrade to Enterprise
          </Button>
          <Button variant="outline" onClick={() => scheduleDemo()}>
            Schedule Demo
          </Button>
        </div>
      </ModalContent>
    </Modal>
  )
}
```

### 5. Pricing & Quoting System

**Quote Generator** (for CSMs):
```typescript
export class QuoteGenerator {
  async generateQuote(params: {
    organizationId: string
    expansionType: ExpansionType
    additionalSeats?: number
    targetTier?: Tier
    customDiscount?: number
  }): Promise<Quote> {
    const org = await this.db.organization.findUnique({
      where: { id: params.organizationId }
    })

    let quote: Quote

    switch (params.expansionType) {
      case 'seat_expansion':
        quote = this.calculateSeatExpansion(org, params.additionalSeats!)
        break
      case 'tier_upgrade':
        quote = this.calculateTierUpgrade(org, params.targetTier!)
        break
      // ... other cases
    }

    // Apply custom discount (if authorized)
    if (params.customDiscount) {
      quote.discount = params.customDiscount
      quote.total = quote.subtotal * (1 - params.customDiscount)
    }

    // Save quote
    const savedQuote = await this.db.quote.create({
      data: {
        organizationId: org.id,
        type: params.expansionType,
        subtotal: quote.subtotal,
        discount: quote.discount,
        total: quote.total,
        lineItems: quote.lineItems,
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        createdBy: getCurrentUser().email,
      }
    })

    // Generate PDF
    const pdf = await this.generateQuotePDF(savedQuote)

    return { ...quote, id: savedQuote.id, pdfUrl: pdf.url }
  }

  calculateSeatExpansion(org: Organization, additionalSeats: number): Quote {
    const pricePerSeat = org.arr / org.seats
    const subtotal = additionalSeats * pricePerSeat

    // Prorated for remaining contract term
    const daysRemaining = differenceInDays(org.renewalDate, new Date())
    const proratedCharge = subtotal * (daysRemaining / 365)

    return {
      subtotal: proratedCharge,
      discount: 0,
      total: proratedCharge,
      lineItems: [
        {
          description: `${additionalSeats} additional seats`,
          quantity: additionalSeats,
          unitPrice: pricePerSeat,
          total: subtotal,
        },
        {
          description: `Prorated for ${daysRemaining} days remaining`,
          quantity: 1,
          unitPrice: -( subtotal - proratedCharge),
          total: -(subtotal - proratedCharge),
        },
      ],
      nextInvoice: {
        date: org.renewalDate,
        amount: org.arr + subtotal, // Full year at renewal
      },
    }
  }

  calculateTierUpgrade(org: Organization, targetTier: Tier): Quote {
    const currentPricePerSeat = org.arr / org.seats
    const targetPricePerSeat = this.getPricePerSeat(targetTier)

    const annualDifference = (targetPricePerSeat - currentPricePerSeat) * org.seats

    // Prorated
    const daysRemaining = differenceInDays(org.renewalDate, new Date())
    const proratedCharge = annualDifference * (daysRemaining / 365)

    return {
      subtotal: proratedCharge,
      discount: 0,
      total: proratedCharge,
      lineItems: [
        {
          description: `Upgrade ${org.seats} seats to ${targetTier} tier`,
          quantity: org.seats,
          unitPrice: targetPricePerSeat - currentPricePerSeat,
          total: annualDifference,
        },
        {
          description: `Prorated for ${daysRemaining} days remaining`,
          quantity: 1,
          unitPrice: -(annualDifference - proratedCharge),
          total: -(annualDifference - proratedCharge),
        },
      ],
      nextInvoice: {
        date: org.renewalDate,
        amount: org.seats * targetPricePerSeat, // Full year at new tier
      },
    }
  }
}
```

### 6. Expansion Revenue Tracking

**NDR (Net Dollar Retention) Calculation**:
```typescript
// Calculate NDR for trailing 12 months
export async function calculateNDR(periodEnd: Date = new Date()): Promise<number> {
  const periodStart = subMonths(periodEnd, 12)

  // Cohort: Customers active at start of period
  const cohort = await db.organization.findMany({
    where: {
      createdAt: { lte: periodStart },
      status: 'active',
    },
    select: { id: true, arr: true }
  })

  const startingARR = cohort.reduce((sum, org) => sum + org.arr, 0)

  // Ending ARR for same cohort (includes expansions, excludes new customers)
  const cohortIds = cohort.map(org => org.id)
  const endingARR = await db.organization.aggregate({
    where: {
      id: { in: cohortIds },
      status: { in: ['active', 'churned'] }, // Include churned to account for churn
    },
    _sum: { arr: true }
  })

  // NDR = (Ending ARR / Starting ARR) * 100
  const ndr = (endingARR._sum.arr || 0) / startingARR

  return ndr // e.g., 1.25 = 125% NDR
}

// Breakdown: Expansion vs Churn vs Contraction
export async function calculateARRMovement(periodStart: Date, periodEnd: Date) {
  const events = await db.arrEvent.findMany({
    where: {
      createdAt: { gte: periodStart, lte: periodEnd }
    }
  })

  return {
    expansion: events
      .filter(e => e.type === 'expansion')
      .reduce((sum, e) => sum + e.amount, 0),

    contraction: events
      .filter(e => e.type === 'contraction')
      .reduce((sum, e) => sum + Math.abs(e.amount), 0),

    churn: events
      .filter(e => e.type === 'churn')
      .reduce((sum, e) => sum + Math.abs(e.amount), 0),

    newARR: events
      .filter(e => e.type === 'new_customer')
      .reduce((sum, e) => sum + e.amount, 0),
  }
}
```

**Expansion Metrics Dashboard**:
```typescript
interface ExpansionMetrics {
  // NDR
  ndr: number  // 1.25 = 125%
  ndrTrend: 'up' | 'down' | 'stable'

  // Expansion revenue
  expansionARR: number  // Total expansion ARR this period
  expansionCount: number  // Number of expansions
  avgExpansionARR: number  // Avg per expansion

  // By type
  byType: {
    seat_expansion: { count: number; arr: number }
    feature_upsell: { count: number; arr: number }
    usage_expansion: { count: number; arr: number }
    department_expansion: { count: number; arr: number }
  }

  // Funnel
  opportunities: number  // Total expansion opps
  inProgress: number
  closedWon: number
  closedLost: number
  closeRate: number  // closedWon / (closedWon + closedLost)

  // Velocity
  avgDaysToClose: number
  velocity: number  // ARR per day in pipeline
}
```

## Data Model

```prisma
model ExpansionOpportunity {
  id             String   @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])

  // Classification
  type           ExpansionType
  trigger        String

  // Scoring
  score          Int      // 0-100
  estimatedARR   Float
  closeProbability Float  // 0-1

  // Recommendation
  suggestedAction String
  playbook       String
  talkingPoints  String[]

  // Context
  context        Json

  // Tracking
  status         OpportunityStatus @default(OPEN)
  assignedTo     String
  createdAt      DateTime @default(now())
  closedAt       DateTime?
  actualARR      Float?

  @@index([organizationId, status])
  @@index([score, createdAt])
}

enum ExpansionType {
  SEAT_EXPANSION
  FEATURE_UPSELL
  USAGE_EXPANSION
  DEPARTMENT_EXPANSION
  TIER_UPGRADE
  SERVICE_ATTACH
  MULTI_PRODUCT
}

enum OpportunityStatus {
  OPEN
  IN_PROGRESS
  CLOSED_WON
  CLOSED_LOST
}

model Quote {
  id             String   @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])

  type           ExpansionType
  subtotal       Float
  discount       Float    @default(0)
  total          Float

  lineItems      Json     // Array of line items
  nextInvoice    Json     // { date, amount }

  validUntil     DateTime
  acceptedAt     DateTime?

  pdfUrl         String?
  createdBy      String

  createdAt      DateTime @default(now())

  @@index([organizationId, createdAt])
}

model ARREvent {
  id             String   @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])

  type           ARREventType
  amount         Float    // Positive for expansion/new, negative for churn/contraction
  description    String

  // Links
  opportunityId  String?
  opportunity    ExpansionOpportunity? @relation(fields: [opportunityId], references: [id])

  createdAt      DateTime @default(now())

  @@index([organizationId, type, createdAt])
  @@index([createdAt])
}

enum ARREventType {
  NEW_CUSTOMER
  EXPANSION
  CONTRACTION
  CHURN
  REACTIVATION
}
```

## Consequences

### Positive

1. **Revenue Growth**:
   - Target 120-130% NDR (best-in-class SaaS)
   - $300K-$675K expansion ARR annually (20-30% of base)
   - Lower CAC than new customer acquisition

2. **Proactive Expansion**:
   - Identify expansion opportunities before customer reaches out
   - 3-5x more expansion conversations (automated signals)
   - Higher close rate (75-85% vs 50-60% reactive)

3. **Better Customer Experience**:
   - Self-service upgrade (no sales call required for simple expansions)
   - Transparent pricing (customers know cost upfront)
   - Faster time to expand (days vs weeks)

4. **CSM Productivity**:
   - Clear expansion pipeline and priorities
   - Playbooks reduce prep time by 70%
   - Automated quote generation

5. **Data-Driven Decisions**:
   - Understand which expansion motions work best
   - Optimize playbooks based on historical data
   - Forecast expansion revenue accurately

### Negative

1. **Complexity**:
   - Multiple expansion types require different playbooks
   - Pricing calculations can be complex (proration, discounts)
   - Self-service flow must handle edge cases

2. **Over-Prompting Risk**:
   - Too many in-product prompts = annoying
   - Could feel pushy/sales-y
   - Need careful UX balance

3. **Pricing Transparency**:
   - Self-service means less negotiation flexibility
   - Some customers expect custom deals
   - List pricing may not work for all scenarios

4. **Signal Accuracy**:
   - False positives waste CSM time
   - Some triggers may not actually indicate readiness
   - Need ongoing tuning

### Mitigations

1. **Complexity**:
   - **Action**: Start with 2-3 playbooks, expand over time
   - **Pattern**: Template-based quote generation
   - **Tool**: Approval workflow for complex quotes

2. **Over-Prompting**:
   - **Action**: Limit to 1 prompt per user per month
   - **Pattern**: Dismissible prompts (don't show again)
   - **Tool**: A/B test prompt placement and copy

3. **Pricing**:
   - **Action**: Self-service for simple expansions, sales for complex
   - **Pattern**: "Contact us for enterprise pricing" escape hatch
   - **Tool**: Discount approval workflow

4. **Signal Accuracy**:
   - **Action**: Track conversion rate by signal type
   - **Pattern**: Threshold tuning based on historical data
   - **Tool**: Monthly review of false positives

## Metrics & Success Criteria

### Expansion Revenue
- **NDR**: 120-130% (best-in-class)
- **Expansion ARR**: $300K-$675K annually (20-30% of base)
- **Avg Expansion per Customer**: $30K-$45K per year
- **% of Revenue from Expansion**: 30-40%

### Funnel Performance
- **Opportunities Created**: 50-75 per year (5-7 per customer)
- **Close Rate**: 75-85%
- **Avg Days to Close**: 14-30 days
- **Self-Service Conversion**: 60%+ (for seat/tier upgrades)

### CSM Productivity
- **Time to Generate Quote**: < 10 minutes (vs 2+ hours manual)
- **Playbook Usage**: 90%+ of opportunities use playbook
- **Expansion Conversations**: 3-5 per customer per year

### Customer Experience
- **Self-Service Satisfaction**: 8+/10
- **Upgrade NPS**: 50+ (customers happy with upgrade process)
- **Time to Activate Expansion**: < 24 hours

## Implementation Plan

### Phase 1: Signal Detection (Weeks 1-4)
- [ ] Build seat utilization monitor
- [ ] Build feature usage analyzer
- [ ] Create expansion opportunity data model
- [ ] Implement daily background jobs

### Phase 2: CSM Dashboard (Weeks 5-8)
- [ ] Build expansion opportunities list
- [ ] Create opportunity detail page
- [ ] Implement playbook viewer
- [ ] Add talking points generator

### Phase 3: Self-Service Upgrade (Weeks 9-12)
- [ ] Build upgrade wizard UI
- [ ] Implement pricing calculator
- [ ] Add payment processing
- [ ] Create confirmation flow

### Phase 4: In-Product Prompts (Weeks 13-16)
- [ ] Build seat capacity warning banner
- [ ] Create feature unlock modal
- [ ] Implement department discovery
- [ ] Add usage analytics for customers

### Phase 5: Quoting System (Weeks 17-20)
- [ ] Build quote generator API
- [ ] Create quote PDF template
- [ ] Add quote tracking
- [ ] Implement approval workflow

### Phase 6: Analytics (Weeks 21-24)
- [ ] Build NDR calculation
- [ ] Create expansion metrics dashboard
- [ ] Add ARR event tracking
- [ ] Implement executive reporting

## References

### Industry Research
- [OpenView: 2025 SaaS Benchmarks](https://openviewpartners.com/expansion-saas-benchmarks/)
- [ChartMogul: Net Dollar Retention Guide](https://chartmogul.com/blog/net-dollar-retention/)
- [Gainsight: Land & Expand Playbook](https://www.gainsight.com)

### Technology
- [Stripe: Subscription Upgrades](https://stripe.com/docs/billing/subscriptions/upgrade-downgrade)
- [Salesforce: Opportunity Management](https://help.salesforce.com/s/articleView?id=sf.opportunities.htm)

### Internal References
- ADR-019: Enterprise Customer Management
- ADR-026: Enterprise Customer Onboarding Automation
- ADR-027: Enterprise Customer Health Monitoring

## Review Date
April 2026 (3 months)

**Reviewers**: VP Customer Success, VP Sales, Head of Product

---

**Document Version**: 1.0
**Last Updated**: 2026-01-20
**Authors**: Customer Success & Sales Team
**Approved By**: VP Customer Success, CRO
