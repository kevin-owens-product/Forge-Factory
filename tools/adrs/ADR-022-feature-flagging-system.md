# ADR-022: Feature Flagging System

## Status
Accepted

## Context

Forge Factory needs a **robust feature flagging system** to support:

### Enterprise Requirements

1. **Per-Tenant Feature Access**:
   - Enterprise features behind feature flags (SSO, SCIM, custom roles)
   - Gradual rollout to enterprise customers (beta testing)
   - Trial access (enable features temporarily for POCs)
   - Contract-based feature access (Enterprise plan gets X features)

2. **Gradual Rollouts & Canary Deployments**:
   - Roll out new features to 1% → 10% → 50% → 100% of users
   - Canary deployments (test on internal users first)
   - Rollback capability (disable feature instantly if issues detected)
   - A/B testing (50% get feature A, 50% get feature B)

3. **Kill Switches**:
   - Disable features instantly without code deployment
   - Critical for incident response (e.g., feature causing database overload)
   - Toggle features off during maintenance windows
   - Emergency rollback of problematic features

4. **Compliance & Audit**:
   - Track who enabled/disabled features (audit trail)
   - Feature flag change history
   - Compliance requirement: know which customers have which features

5. **Developer Experience**:
   - Simple API: `if (isFeatureEnabled('sso')) { ... }`
   - Type-safe feature flag names (TypeScript)
   - Local development override (enable all features locally)
   - Feature flag documentation (what each flag does)

### Current State

No formal feature flagging system exists. Current approach:
- ❌ Environment variables (`ENABLE_SSO=true`)
- ❌ Hard-coded plan checks (`if (plan === 'enterprise')`)
- ❌ Database fields (`organization.features.sso`)

**Problems**:
- ❌ No gradual rollouts (all-or-nothing)
- ❌ No audit trail (who enabled SSO?)
- ❌ No kill switches (requires code deployment to disable)
- ❌ No A/B testing support
- ❌ Inconsistent implementation across codebase

### Feature Flag Use Cases

| Use Case | Example | Rollout Strategy |
|----------|---------|------------------|
| **Enterprise Feature** | SSO, SCIM, Custom Roles | Per-contract (Enterprise plan only) |
| **Beta Feature** | AI Code Assistant | Gradual (10% → 50% → 100%) |
| **Experimental Feature** | New Dashboard UI | A/B test (50/50 split) |
| **Kill Switch** | Advanced Analytics | On by default, can disable if performance issues |
| **Trial Access** | Enterprise features for POC | Temporary (14-day trial) |
| **Canary Deployment** | New API Endpoint | Internal users → 1% → 10% → 100% |
| **Compliance Feature** | HIPAA Audit Logs | Only for HIPAA-certified customers |
| **Regional Feature** | EU Data Residency | Only for EU customers |

### Scale Requirements (Year 1)

- **Organizations**: 1,000+
- **Feature Flags**: 50-100
- **Flag Evaluations**: 100M+/day (1,000 users × 100 page loads/day × 1,000 flags)
- **Flag Changes**: 10-20/day
- **Response Time**: < 10ms for flag evaluation

### Vendor Options Considered

1. **LaunchDarkly**:
   - ✅ Fully managed, battle-tested
   - ✅ Real-time flag updates
   - ✅ A/B testing, gradual rollouts
   - ❌ Cost: $1,500/month (1,000 seats)
   - ❌ Vendor lock-in

2. **Flagsmith (Open Source)**:
   - ✅ Self-hosted (free)
   - ✅ Feature-rich (gradual rollouts, A/B testing)
   - ❌ Maintenance burden (infra, updates)
   - ❌ Need to build audit trail

3. **Custom Solution**:
   - ✅ Full control
   - ✅ Tailored to our needs
   - ✅ No ongoing costs
   - ❌ Development time (2-3 weeks)
   - ❌ Maintenance burden

## Decision

We will build a **custom feature flagging system** optimized for our multi-tenant SaaS architecture.

**Rationale**:
- Integration with existing tenant model (organization-based flags)
- Custom audit trail (compliance requirement)
- Cost savings ($1,500/month = $18K/year)
- Learning opportunity (deep understanding of system)

### Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                   Feature Flagging System Architecture               │
├──────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  Application Layer                                                    │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ Frontend (React)              Backend (NestJS)                  │  │
│  │ ┌─────────────────┐          ┌─────────────────┐               │  │
│  │ │ useFeatureFlag  │          │ FeatureFlag     │               │  │
│  │ │                 │          │ Guard           │               │  │
│  │ │ const enabled = │          │                 │               │  │
│  │ │   useFeature    │          │ @FeatureFlag    │               │  │
│  │ │   Flag('sso')   │          │ ('sso')         │               │  │
│  │ │                 │          │ async handler() │               │  │
│  │ │ if (enabled) {  │          │ { ... }         │               │  │
│  │ │   <SSOLogin />  │          │                 │               │  │
│  │ │ }               │          │                 │               │  │
│  │ └─────────────────┘          └─────────────────┘               │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                   │                                   │
│                                   ▼                                   │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                   Feature Flag Service                          │  │
│  │                                                                  │  │
│  │  isFeatureEnabled(flagKey, context)                             │  │
│  │  ├─ 1. Load flag definition from cache/DB                       │  │
│  │  ├─ 2. Evaluate targeting rules                                 │  │
│  │  ├─ 3. Check organization override                              │  │
│  │  ├─ 4. Check user override                                      │  │
│  │  ├─ 5. Apply rollout percentage                                 │  │
│  │  └─ 6. Return boolean + track analytics                         │  │
│  │                                                                  │  │
│  │  Evaluation Algorithm:                                          │  │
│  │                                                                  │  │
│  │  function evaluate(flag, context) {                             │  │
│  │    // 1. Kill switch (highest priority)                         │  │
│  │    if (flag.killSwitchEnabled) return false                     │  │
│  │                                                                  │  │
│  │    // 2. Organization override                                  │  │
│  │    const orgOverride = getOrgOverride(context.orgId, flag.key)  │  │
│  │    if (orgOverride !== null) return orgOverride                 │  │
│  │                                                                  │  │
│  │    // 3. User override (for testing)                            │  │
│  │    const userOverride = getUserOverride(context.userId, flag.key)│ │
│  │    if (userOverride !== null) return userOverride               │  │
│  │                                                                  │  │
│  │    // 4. Targeting rules                                        │  │
│  │    for (const rule of flag.targetingRules) {                    │  │
│  │      if (matchesRule(context, rule)) {                          │  │
│  │        return rule.enabled                                      │  │
│  │      }                                                           │  │
│  │    }                                                             │  │
│  │                                                                  │  │
│  │    // 5. Rollout percentage                                     │  │
│  │    if (flag.rolloutPercentage < 100) {                          │  │
│  │      const hash = hashUserId(context.userId)                    │  │
│  │      return (hash % 100) < flag.rolloutPercentage               │  │
│  │    }                                                             │  │
│  │                                                                  │  │
│  │    // 6. Default value                                          │  │
│  │    return flag.defaultEnabled                                   │  │
│  │  }                                                               │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                   │                                   │
│                                   ▼                                   │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                  Caching Layer (Redis)                          │  │
│  │                                                                  │  │
│  │  Cache Key: feature_flag:{flagKey}                              │  │
│  │  TTL: 60 seconds                                                │  │
│  │  Invalidation: On flag update                                   │  │
│  │                                                                  │  │
│  │  Performance:                                                   │  │
│  │  - Cache hit: < 1ms                                             │  │
│  │  - Cache miss: < 10ms (DB query)                                │  │
│  │  - 99%+ cache hit rate                                          │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                   │                                   │
│                                   ▼                                   │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                  Database Schema                                │  │
│  │                                                                  │  │
│  │  FeatureFlag                                                    │  │
│  │  ├─ key (unique, e.g., "sso", "scim")                          │  │
│  │  ├─ name (human-readable)                                       │  │
│  │  ├─ description                                                 │  │
│  │  ├─ category (ENTERPRISE, BETA, EXPERIMENTAL, COMPLIANCE)      │  │
│  │  ├─ defaultEnabled (boolean)                                    │  │
│  │  ├─ killSwitchEnabled (boolean)                                 │  │
│  │  ├─ rolloutPercentage (0-100)                                   │  │
│  │  ├─ targetingRules (JSON array)                                 │  │
│  │  ├─ createdAt                                                   │  │
│  │  ├─ updatedAt                                                   │  │
│  │  └─ metadata (JSON)                                             │  │
│  │                                                                  │  │
│  │  FeatureFlagOverride                                            │  │
│  │  ├─ id                                                          │  │
│  │  ├─ featureFlagKey                                              │  │
│  │  ├─ organizationId (null for global)                            │  │
│  │  ├─ userId (null for org-level)                                │  │
│  │  ├─ enabled (boolean)                                           │  │
│  │  ├─ expiresAt (for temporary access)                            │  │
│  │  ├─ reason (why override?)                                      │  │
│  │  ├─ createdBy (admin user ID)                                   │  │
│  │  ├─ createdAt                                                   │  │
│  │  └─ revokedAt                                                   │  │
│  │                                                                  │  │
│  │  FeatureFlagAuditLog                                            │  │
│  │  ├─ id                                                          │  │
│  │  ├─ featureFlagKey                                              │  │
│  │  ├─ action (CREATED, UPDATED, TOGGLED, OVERRIDE_ADDED)         │  │
│  │  ├─ changedBy (user ID)                                         │  │
│  │  ├─ before (JSON snapshot)                                      │  │
│  │  ├─ after (JSON snapshot)                                       │  │
│  │  ├─ reason                                                      │  │
│  │  ├─ createdAt                                                   │  │
│  │  └─ metadata                                                    │  │
│  │                                                                  │  │
│  │  FeatureFlagEvaluation (Analytics)                              │  │
│  │  ├─ id                                                          │  │
│  │  ├─ featureFlagKey                                              │  │
│  │  ├─ organizationId                                              │  │
│  │  ├─ userId                                                      │  │
│  │  ├─ enabled (result of evaluation)                              │  │
│  │  ├─ evaluationReason (DEFAULT, OVERRIDE, ROLLOUT, RULE)        │  │
│  │  ├─ timestamp                                                   │  │
│  │  └─ metadata                                                    │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │              Platform Admin UI (Feature Flag Manager)           │  │
│  │                                                                  │  │
│  │  /admin/feature-flags/                                          │  │
│  │    ├─ /                        # List all flags                 │  │
│  │    ├─ /create                  # Create new flag                │  │
│  │    ├─ /:key                    # Flag detail & edit             │  │
│  │    ├─ /:key/overrides          # Manage overrides               │  │
│  │    ├─ /:key/analytics          # Usage analytics                │  │
│  │    └─ /:key/audit-log          # Change history                 │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                        │
└──────────────────────────────────────────────────────────────────────┘
```

## Detailed Decisions

### 1. Feature Flag Definition

**Schema**:

```typescript
/**
 * @prompt-id forge-v4.1:feature:feature-flags:001
 * @generated-at 2026-01-20T00:00:00Z
 * @model claude-sonnet-4-5
 */

// Database schema
model FeatureFlag {
  key                 String   @id          // "sso", "scim", "custom_roles"
  name                String                // "Single Sign-On"
  description         String                // Long description
  category            FeatureFlagCategory
  defaultEnabled      Boolean @default(false)
  killSwitchEnabled   Boolean @default(false)

  // Gradual rollout
  rolloutPercentage   Int @default(0)       // 0-100

  // Targeting rules (JSON)
  targetingRules      Json @default("[]")   // Array of rule objects

  // Metadata
  metadata            Json?
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  // Relations
  overrides           FeatureFlagOverride[]
  auditLogs           FeatureFlagAuditLog[]
  evaluations         FeatureFlagEvaluation[]

  @@index([category])
  @@index([defaultEnabled])
}

enum FeatureFlagCategory {
  ENTERPRISE      // Enterprise-only features (SSO, SCIM)
  BETA            // Beta features (AI assistant)
  EXPERIMENTAL    // Experimental features (new UI)
  COMPLIANCE      // Compliance features (HIPAA logs)
  INTERNAL        // Internal tools (admin debug mode)
  KILL_SWITCH     // Kill switches (disable on incident)
}

model FeatureFlagOverride {
  id              String   @id @default(cuid())
  featureFlagKey  String
  featureFlag     FeatureFlag @relation(fields: [featureFlagKey], references: [key])

  // Target
  organizationId  String?              // Null = global override
  userId          String?              // Null = org-level override

  enabled         Boolean
  expiresAt       DateTime?            // For temporary access (trials)
  reason          String?
  createdBy       String               // Admin user ID
  createdAt       DateTime @default(now())
  revokedAt       DateTime?

  @@unique([featureFlagKey, organizationId, userId])
  @@index([featureFlagKey])
  @@index([organizationId])
  @@index([userId])
  @@index([expiresAt])
}

model FeatureFlagAuditLog {
  id              String   @id @default(cuid())
  featureFlagKey  String
  featureFlag     FeatureFlag @relation(fields: [featureFlagKey], references: [key])

  action          FeatureFlagAction
  changedBy       String               // User ID
  before          Json?                // Snapshot before change
  after           Json?                // Snapshot after change
  reason          String?
  metadata        Json?

  createdAt       DateTime @default(now())

  @@index([featureFlagKey, createdAt])
  @@index([changedBy])
}

enum FeatureFlagAction {
  CREATED
  UPDATED
  DELETED
  ENABLED
  DISABLED
  KILL_SWITCH_ACTIVATED
  KILL_SWITCH_DEACTIVATED
  OVERRIDE_ADDED
  OVERRIDE_REMOVED
  ROLLOUT_PERCENTAGE_CHANGED
}

// Analytics (separate table for high-volume data)
model FeatureFlagEvaluation {
  id                String   @id @default(cuid())
  featureFlagKey    String
  featureFlag       FeatureFlag @relation(fields: [featureFlagKey], references: [key])

  organizationId    String?
  userId            String?
  enabled           Boolean
  evaluationReason  EvaluationReason
  timestamp         DateTime @default(now())

  metadata          Json?

  @@index([featureFlagKey, timestamp])
  @@index([organizationId, timestamp])
}

enum EvaluationReason {
  DEFAULT             // Used default value
  KILL_SWITCH         // Kill switch active
  ORG_OVERRIDE        // Organization override
  USER_OVERRIDE       // User override
  TARGETING_RULE      // Matched targeting rule
  ROLLOUT_PERCENTAGE  // Included in rollout percentage
}

// Targeting rule structure (stored as JSON)
interface TargetingRule {
  id: string
  name: string
  enabled: boolean
  conditions: Condition[]
  operator: 'AND' | 'OR'  // How to combine conditions
}

interface Condition {
  attribute: string       // "plan", "region", "createdAt", "userCount"
  operator: ConditionOperator
  value: any
}

enum ConditionOperator {
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
  IN = 'in',
  NOT_IN = 'not_in',
  GREATER_THAN = 'greater_than',
  LESS_THAN = 'less_than',
  CONTAINS = 'contains',
  STARTS_WITH = 'starts_with',
  MATCHES_REGEX = 'matches_regex',
}

// Example targeting rules
const exampleTargetingRules: TargetingRule[] = [
  {
    id: 'rule_1',
    name: 'Enterprise customers only',
    enabled: true,
    operator: 'AND',
    conditions: [
      { attribute: 'plan', operator: 'equals', value: 'enterprise' },
    ],
  },
  {
    id: 'rule_2',
    name: 'EU customers with 100+ users',
    enabled: true,
    operator: 'AND',
    conditions: [
      { attribute: 'region', operator: 'equals', value: 'EU' },
      { attribute: 'userCount', operator: 'greater_than', value: 100 },
    ],
  },
  {
    id: 'rule_3',
    name: 'Customers created after Jan 2026',
    enabled: true,
    operator: 'AND',
    conditions: [
      { attribute: 'createdAt', operator: 'greater_than', value: '2026-01-01' },
    ],
  },
]
```

### 2. Feature Flag Service (Backend)

**Implementation**:

```typescript
// packages/feature-flags/src/feature-flag.service.ts

@Injectable()
export class FeatureFlagService {
  constructor(
    private db: PrismaService,
    private redis: RedisService,
    private analytics: AnalyticsService,
  ) {}

  /**
   * Main evaluation function
   */
  async isFeatureEnabled(
    flagKey: string,
    context: EvaluationContext
  ): Promise<boolean> {
    const flag = await this.getFlag(flagKey)

    if (!flag) {
      console.warn(`[FeatureFlag] Flag not found: ${flagKey}`)
      return false
    }

    const result = this.evaluate(flag, context)

    // Track evaluation for analytics
    await this.trackEvaluation(flagKey, context, result)

    return result.enabled
  }

  /**
   * Evaluation logic
   */
  private evaluate(
    flag: FeatureFlag,
    context: EvaluationContext
  ): EvaluationResult {
    // 1. Kill switch (highest priority)
    if (flag.killSwitchEnabled) {
      return {
        enabled: false,
        reason: 'KILL_SWITCH',
      }
    }

    // 2. Organization override
    if (context.organizationId) {
      const orgOverride = await this.getOrgOverride(
        flag.key,
        context.organizationId
      )

      if (orgOverride !== null) {
        // Check if override is expired
        if (orgOverride.expiresAt && new Date() > orgOverride.expiresAt) {
          // Revoke expired override
          await this.revokeOverride(orgOverride.id)
        } else if (!orgOverride.revokedAt) {
          return {
            enabled: orgOverride.enabled,
            reason: 'ORG_OVERRIDE',
          }
        }
      }
    }

    // 3. User override (for testing/debugging)
    if (context.userId) {
      const userOverride = await this.getUserOverride(
        flag.key,
        context.userId
      )

      if (userOverride !== null && !userOverride.revokedAt) {
        return {
          enabled: userOverride.enabled,
          reason: 'USER_OVERRIDE',
        }
      }
    }

    // 4. Targeting rules
    const targetingRules = flag.targetingRules as TargetingRule[]
    for (const rule of targetingRules) {
      if (!rule.enabled) continue

      if (this.matchesRule(context, rule)) {
        return {
          enabled: true,
          reason: 'TARGETING_RULE',
          metadata: { ruleId: rule.id },
        }
      }
    }

    // 5. Rollout percentage
    if (flag.rolloutPercentage > 0 && flag.rolloutPercentage < 100) {
      const hash = this.hashUserId(context.userId)
      const inRollout = (hash % 100) < flag.rolloutPercentage

      if (inRollout) {
        return {
          enabled: true,
          reason: 'ROLLOUT_PERCENTAGE',
          metadata: { percentage: flag.rolloutPercentage },
        }
      }
    }

    // 6. Default value
    return {
      enabled: flag.defaultEnabled,
      reason: 'DEFAULT',
    }
  }

  /**
   * Check if context matches targeting rule
   */
  private matchesRule(context: EvaluationContext, rule: TargetingRule): boolean {
    const results = rule.conditions.map((condition) =>
      this.evaluateCondition(context, condition)
    )

    return rule.operator === 'AND'
      ? results.every((r) => r)
      : results.some((r) => r)
  }

  /**
   * Evaluate single condition
   */
  private evaluateCondition(
    context: EvaluationContext,
    condition: Condition
  ): boolean {
    const actualValue = this.getAttributeValue(context, condition.attribute)

    switch (condition.operator) {
      case 'equals':
        return actualValue === condition.value
      case 'not_equals':
        return actualValue !== condition.value
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(actualValue)
      case 'not_in':
        return Array.isArray(condition.value) && !condition.value.includes(actualValue)
      case 'greater_than':
        return actualValue > condition.value
      case 'less_than':
        return actualValue < condition.value
      case 'contains':
        return String(actualValue).includes(String(condition.value))
      case 'starts_with':
        return String(actualValue).startsWith(String(condition.value))
      case 'matches_regex':
        return new RegExp(condition.value).test(String(actualValue))
      default:
        return false
    }
  }

  /**
   * Get attribute value from context
   */
  private getAttributeValue(context: EvaluationContext, attribute: string): any {
    // Support nested attributes: "organization.plan"
    const parts = attribute.split('.')
    let value: any = context

    for (const part of parts) {
      value = value?.[part]
      if (value === undefined) return null
    }

    return value
  }

  /**
   * Hash user ID for consistent rollout assignment
   */
  private hashUserId(userId: string): number {
    let hash = 0
    for (let i = 0; i < userId.length; i++) {
      hash = ((hash << 5) - hash) + userId.charCodeAt(i)
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash)
  }

  /**
   * Get flag from cache or DB
   */
  private async getFlag(flagKey: string): Promise<FeatureFlag | null> {
    // Try cache first
    const cacheKey = `feature_flag:${flagKey}`
    const cached = await this.redis.get(cacheKey)

    if (cached) {
      return JSON.parse(cached)
    }

    // Load from DB
    const flag = await this.db.featureFlag.findUnique({
      where: { key: flagKey },
    })

    if (flag) {
      // Cache for 60 seconds
      await this.redis.setex(cacheKey, 60, JSON.stringify(flag))
    }

    return flag
  }

  /**
   * Track evaluation for analytics (async, non-blocking)
   */
  private async trackEvaluation(
    flagKey: string,
    context: EvaluationContext,
    result: EvaluationResult
  ) {
    // Use background queue to avoid blocking
    await this.queue.add('track-feature-flag-evaluation', {
      flagKey,
      organizationId: context.organizationId,
      userId: context.userId,
      enabled: result.enabled,
      reason: result.reason,
      timestamp: new Date(),
    })
  }

  /**
   * Management methods
   */

  async createFlag(dto: CreateFeatureFlagDto, createdBy: string) {
    const flag = await this.db.featureFlag.create({
      data: {
        key: dto.key,
        name: dto.name,
        description: dto.description,
        category: dto.category,
        defaultEnabled: dto.defaultEnabled ?? false,
        rolloutPercentage: dto.rolloutPercentage ?? 0,
        targetingRules: dto.targetingRules ?? [],
      },
    })

    await this.auditLog(flag.key, 'CREATED', createdBy, null, flag)

    return flag
  }

  async toggleFlag(flagKey: string, enabled: boolean, reason: string, changedBy: string) {
    const before = await this.getFlag(flagKey)

    const flag = await this.db.featureFlag.update({
      where: { key: flagKey },
      data: { defaultEnabled: enabled },
    })

    await this.invalidateCache(flagKey)
    await this.auditLog(
      flagKey,
      enabled ? 'ENABLED' : 'DISABLED',
      changedBy,
      before,
      flag,
      reason
    )

    return flag
  }

  async activateKillSwitch(flagKey: string, reason: string, activatedBy: string) {
    const before = await this.getFlag(flagKey)

    const flag = await this.db.featureFlag.update({
      where: { key: flagKey },
      data: { killSwitchEnabled: true },
    })

    await this.invalidateCache(flagKey)
    await this.auditLog(
      flagKey,
      'KILL_SWITCH_ACTIVATED',
      activatedBy,
      before,
      flag,
      reason
    )

    // Alert engineering team
    await this.slackService.sendMessage({
      channel: '#engineering-alerts',
      text: `🚨 Kill switch activated for feature flag "${flag.name}" by ${activatedBy}. Reason: ${reason}`,
    })

    return flag
  }

  async setRolloutPercentage(
    flagKey: string,
    percentage: number,
    reason: string,
    changedBy: string
  ) {
    if (percentage < 0 || percentage > 100) {
      throw new BadRequestException('Rollout percentage must be between 0 and 100')
    }

    const before = await this.getFlag(flagKey)

    const flag = await this.db.featureFlag.update({
      where: { key: flagKey },
      data: { rolloutPercentage: percentage },
    })

    await this.invalidateCache(flagKey)
    await this.auditLog(
      flagKey,
      'ROLLOUT_PERCENTAGE_CHANGED',
      changedBy,
      before,
      flag,
      reason
    )

    return flag
  }

  async addOverride(dto: AddOverrideDto, createdBy: string) {
    const override = await this.db.featureFlagOverride.create({
      data: {
        featureFlagKey: dto.flagKey,
        organizationId: dto.organizationId,
        userId: dto.userId,
        enabled: dto.enabled,
        expiresAt: dto.expiresAt,
        reason: dto.reason,
        createdBy,
      },
    })

    await this.invalidateCache(dto.flagKey)
    await this.auditLog(dto.flagKey, 'OVERRIDE_ADDED', createdBy, null, override)

    return override
  }

  private async auditLog(
    flagKey: string,
    action: FeatureFlagAction,
    changedBy: string,
    before: any,
    after: any,
    reason?: string
  ) {
    await this.db.featureFlagAuditLog.create({
      data: {
        featureFlagKey: flagKey,
        action,
        changedBy,
        before,
        after,
        reason,
      },
    })
  }

  private async invalidateCache(flagKey: string) {
    await this.redis.del(`feature_flag:${flagKey}`)
  }
}

// Evaluation context
interface EvaluationContext {
  userId?: string
  organizationId?: string
  plan?: string
  region?: string
  userCount?: number
  createdAt?: Date
  [key: string]: any  // Allow custom attributes
}

interface EvaluationResult {
  enabled: boolean
  reason: EvaluationReason
  metadata?: any
}
```

### 3. React Hook (Frontend)

**Implementation**:

```typescript
// packages/ui/src/hooks/use-feature-flag.ts

export function useFeatureFlag(flagKey: string): boolean {
  const { user, organization } = useAuth()
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    // Call backend API to evaluate flag
    const evaluateFlag = async () => {
      try {
        const response = await fetch('/api/v1/feature-flags/evaluate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            flagKey,
            context: {
              userId: user?.id,
              organizationId: organization?.id,
              plan: organization?.plan,
              region: organization?.region,
              userCount: organization?.memberCount,
              createdAt: organization?.createdAt,
            },
          }),
        })

        const { enabled } = await response.json()
        setEnabled(enabled)
      } catch (error) {
        console.error(`[FeatureFlag] Failed to evaluate ${flagKey}:`, error)
        setEnabled(false) // Fail closed
      }
    }

    evaluateFlag()
  }, [flagKey, user, organization])

  return enabled
}

// Usage in components
export function SSOLoginButton() {
  const ssoEnabled = useFeatureFlag('sso')

  if (!ssoEnabled) {
    return null
  }

  return <Button onClick={handleSSOLogin}>Login with SSO</Button>
}

// Variant: useFeatureFlags (batch evaluation)
export function useFeatureFlags(flagKeys: string[]): Record<string, boolean> {
  const { user, organization } = useAuth()
  const [flags, setFlags] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const evaluateFlags = async () => {
      const response = await fetch('/api/v1/feature-flags/evaluate-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flagKeys,
          context: {
            userId: user?.id,
            organizationId: organization?.id,
            plan: organization?.plan,
          },
        }),
      })

      const { flags } = await response.json()
      setFlags(flags)
    }

    evaluateFlags()
  }, [flagKeys, user, organization])

  return flags
}
```

### 4. Feature Flag Guard (Backend)

**Implementation**:

```typescript
// packages/api/src/decorators/feature-flag.guard.ts

@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(private featureFlagService: FeatureFlagService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const reflector = new Reflector()
    const flagKey = reflector.get<string>('featureFlag', context.getHandler())

    if (!flagKey) {
      return true // No flag requirement
    }

    const request = context.switchToHttp().getRequest()
    const user = request.user
    const organization = request.organization

    const enabled = await this.featureFlagService.isFeatureEnabled(flagKey, {
      userId: user?.id,
      organizationId: organization?.id,
      plan: organization?.plan,
      region: organization?.region,
    })

    if (!enabled) {
      throw new ForbiddenException(
        `Feature "${flagKey}" is not enabled for your organization`
      )
    }

    return true
  }
}

// Decorator
export const FeatureFlag = (flagKey: string) =>
  SetMetadata('featureFlag', flagKey)

// Usage
@Controller('api/v1/sso')
export class SSOController {

  @Get('config')
  @UseGuards(FeatureFlagGuard)
  @FeatureFlag('sso')
  async getSSOConfig() {
    // Only accessible if SSO feature flag is enabled
    return await this.ssoService.getConfig()
  }
}
```

### 5. Feature Flag Management UI

**Implementation**:

```tsx
// apps/admin/app/(platform)/feature-flags/page.tsx

export default async function FeatureFlagsPage() {
  const flags = await db.featureFlag.findMany({
    include: {
      _count: {
        select: {
          overrides: true,
          evaluations: { where: { timestamp: { gte: subDays(new Date(), 7) } } },
        },
      },
    },
    orderBy: { category: 'asc' },
  })

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Feature Flags</h1>
        <CreateFeatureFlagDialog />
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All ({flags.length})</TabsTrigger>
          <TabsTrigger value="ENTERPRISE">
            Enterprise ({flags.filter(f => f.category === 'ENTERPRISE').length})
          </TabsTrigger>
          <TabsTrigger value="BETA">
            Beta ({flags.filter(f => f.category === 'BETA').length})
          </TabsTrigger>
          <TabsTrigger value="KILL_SWITCH">
            Kill Switches ({flags.filter(f => f.killSwitchEnabled).length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <div className="grid gap-4">
            {flags.map((flag) => (
              <FeatureFlagCard key={flag.key} flag={flag} />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function FeatureFlagCard({ flag }: { flag: FeatureFlag }) {
  const [rolloutPercentage, setRolloutPercentage] = useState(flag.rolloutPercentage)
  const { mutate: updateRollout } = useUpdateRollout()
  const { mutate: activateKillSwitch } = useActivateKillSwitch()

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                {flag.name}
                <Badge variant={flag.category === 'ENTERPRISE' ? 'default' : 'secondary'}>
                  {flag.category}
                </Badge>
                {flag.killSwitchEnabled && (
                  <Badge variant="error">🚨 Kill Switch Active</Badge>
                )}
              </CardTitle>
              <p className="text-sm text-slate-600 mt-1">{flag.description}</p>
              <code className="text-xs bg-slate-100 px-2 py-1 rounded mt-2 inline-block">
                {flag.key}
              </code>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Toggle
              checked={flag.defaultEnabled}
              onChange={(enabled) => toggleFlag(flag.key, enabled)}
            />
            <DropdownMenu>
              <DropdownMenuItem onClick={() => viewAnalytics(flag.key)}>
                📊 Analytics
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => manageOverrides(flag.key)}>
                🎯 Overrides ({flag._count.overrides})
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => viewAuditLog(flag.key)}>
                📝 Audit Log
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => activateKillSwitch({ flagKey: flag.key })}
                destructive
              >
                🚨 Activate Kill Switch
              </DropdownMenuItem>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          {/* Rollout Percentage */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Rollout Percentage</Label>
              <span className="text-sm font-semibold">{rolloutPercentage}%</span>
            </div>
            <Slider
              value={[rolloutPercentage]}
              onValueChange={([value]) => setRolloutPercentage(value)}
              onValueCommit={([value]) =>
                updateRollout({ flagKey: flag.key, percentage: value })
              }
              min={0}
              max={100}
              step={5}
            />
            <div className="flex justify-between text-xs text-slate-500 mt-1">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>

          {/* Targeting Rules */}
          {(flag.targetingRules as TargetingRule[]).length > 0 && (
            <div>
              <Label className="mb-2">Targeting Rules</Label>
              <div className="space-y-2">
                {(flag.targetingRules as TargetingRule[]).map((rule) => (
                  <div
                    key={rule.id}
                    className="border rounded p-3 bg-slate-50 text-sm"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold">{rule.name}</span>
                      <Badge variant={rule.enabled ? 'success' : 'secondary'}>
                        {rule.enabled ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <div className="text-xs text-slate-600">
                      {rule.conditions.map((c, i) => (
                        <span key={i}>
                          {i > 0 && ` ${rule.operator} `}
                          <code>{c.attribute}</code> {c.operator} <code>{c.value}</code>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 pt-4 border-t">
            <div>
              <p className="text-xs text-slate-600">Evaluations (7d)</p>
              <p className="text-lg font-semibold">{flag._count.evaluations.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-slate-600">Overrides</p>
              <p className="text-lg font-semibold">{flag._count.overrides}</p>
            </div>
            <div>
              <p className="text-xs text-slate-600">Last Updated</p>
              <p className="text-sm">{formatRelativeTime(flag.updatedAt)}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
```

## Consequences

### Positive

1. **Deployment Safety**:
   - Gradual rollouts reduce blast radius (1% → 10% → 100%)
   - Kill switches enable instant rollback without code deployment
   - Canary deployments catch issues early (internal users first)

2. **Enterprise Flexibility**:
   - Per-tenant feature access (Enterprise customers get SSO, etc.)
   - Trial access (temporary feature enablement for POCs)
   - Contract-based access (enable features based on contract)

3. **Operational Excellence**:
   - Full audit trail (compliance requirement)
   - Real-time analytics (usage tracking)
   - Self-service (platform admins can manage flags)

4. **Developer Experience**:
   - Simple API (`useFeatureFlag('sso')`)
   - Type-safe flag names (TypeScript enum)
   - Local development override (enable all flags)

### Negative

1. **Complexity**:
   - Feature flag sprawl (100+ flags = technical debt)
   - Stale flags (flags never removed after 100% rollout)
   - Testing complexity (need to test both enabled/disabled states)

2. **Performance**:
   - 100M+ evaluations/day = potential bottleneck
   - Database load (flag reads + override checks)
   - Cache invalidation complexity

3. **Maintenance**:
   - Flag cleanup process needed (remove stale flags)
   - Documentation (what does each flag do?)
   - Training (how to use flags correctly)

### Mitigations

1. **Complexity**:
   - **Action**: Quarterly flag cleanup (remove flags at 100% for 30+ days)
   - **Process**: Flag lifecycle (BETA → ROLLOUT → GA → DEPRECATED → REMOVED)
   - **Documentation**: Require description for every flag

2. **Performance**:
   - **Action**: Redis caching (60s TTL, 99%+ hit rate)
   - **Optimization**: Batch evaluation API (evaluate 10+ flags in one request)
   - **Monitoring**: Track P99 evaluation latency (target: < 10ms)

3. **Maintenance**:
   - **Action**: Automated alerts for flags unchanged for 6+ months
   - **Process**: Feature flag review in quarterly planning
   - **Tooling**: Flag usage analytics (identify unused flags)

## Metrics & Success Criteria

### Performance
- **Evaluation Latency**: P99 < 10ms
- **Cache Hit Rate**: > 99%
- **System Availability**: 99.99%+ (flags critical for operations)

### Usage
- **Total Flags**: < 100 (prevent flag sprawl)
- **Stale Flags**: < 10 (flags unchanged for 6+ months)
- **Rollout Time**: 1% → 100% in < 7 days for most features

### Safety
- **Rollback Time**: < 5 minutes (via kill switch)
- **Failed Rollouts**: < 2% (caught in canary phase)
- **Audit Coverage**: 100% of flag changes logged

## References

### Research Sources
- [LaunchDarkly Architecture](https://launchdarkly.com/blog/feature-flag-best-practices/)
- [Flagsmith Documentation](https://docs.flagsmith.com/)
- [Feature Flag Best Practices (Martin Fowler)](https://martinfowler.com/articles/feature-toggles.html)
- [Rollout Strategies](https://learn.launchdarkly.com/foundations/release-strategies/)

### Internal References
- ADR-002: Tenant Isolation Strategy
- ADR-019: Enterprise Customer Management
- ADR-020: Super Admin Portal

## Review Date
April 2026 (3 months)

---

**Document Version**: 1.0
**Last Updated**: 2026-01-20
**Authors**: Engineering & Product Team
**Approved By**: CTO, VP Engineering
