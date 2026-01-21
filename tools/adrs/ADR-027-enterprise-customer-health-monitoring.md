# ADR-027: Enterprise Customer Health Monitoring & Predictive Analytics

## Status
Accepted

## Context

Enterprise customers represent 80% of our revenue ($1.5M-$2.25M ARR from 10-15 customers) but have significantly higher churn risk than self-service customers due to:
- Complex implementations with multiple stakeholders
- Higher expectations for ROI and business outcomes
- Competitive pressures (SonarQube, CodeClimate, competitors)
- Budget cycles and annual contract renewals

### Current Challenges

1. **Reactive (Not Proactive) Customer Success**:
   - CSMs learn about problems when customer reaches out (too late)
   - Churn signals missed until renewal conversation
   - No early warning system for declining usage
   - Average churn detection lag: 60+ days (should be < 7 days)

2. **Inconsistent Health Assessment**:
   - Different CSMs use different criteria for "healthy" customer
   - Subjective gut feel vs data-driven scoring
   - Health checks happen quarterly (too infrequent)
   - No standardized intervention playbook

3. **Limited Visibility**:
   - CSMs can't monitor 15-20 customers manually
   - Leadership can't see portfolio health at-a-glance
   - Finance can't forecast churn accurately
   - Renewals team surprised by at-risk customers

4. **Manual Data Collection**:
   - CSMs manually check usage in 5+ different tools
   - Support ticket count requires Zendesk export
   - NPS surveys sent manually, low response rate (15-20%)
   - Meeting notes in Google Docs, insights lost

### Industry Benchmarks

**SaaS Renewal Rates** (from Gainsight, ChurnZero):
- Enterprise (>$100K ARR): 90-95% renewal rate
- Mid-market ($10K-$100K): 80-85%
- SMB (<$10K): 60-70%

**Churn Predictors** (correlation with churn):
- 📉 Usage decline > 30% month-over-month: **85% churn correlation**
- 🎫 Support tickets > 10/month: **72% churn correlation**
- 😞 NPS < 6: **68% churn correlation**
- 👥 Admin turnover: **64% churn correlation**
- 🔌 Integration disconnection: **61% churn correlation**

**Time to Intervention**:
- Detect churn signal → CSM intervention: **< 24 hours** (best practice)
- Save at-risk renewal: **60-90 days before renewal** (optimal window)

### Requirements

**Must Have**:
- Automated health score calculation (daily updates)
- Multi-dimensional scoring (usage, engagement, satisfaction, outcomes)
- Real-time alerting (CSM notified within 1 hour of health drop)
- Predictive churn model (ML-based, 90-day forecast)
- CSM dashboard (portfolio health at-a-glance)
- Intervention playbooks (automated next-best-action recommendations)

**Should Have**:
- Benchmarking (compare customer to peer cohort)
- Trend analysis (identify leading vs lagging indicators)
- Executive reports (weekly email digest to leadership)
- Customer-facing health score (transparency builds trust)
- Integration with Salesforce (renewal forecasting)

**Could Have**:
- AI-powered insights ("Why did health score drop?")
- Automated intervention workflows (send resources, schedule call)
- Cohort analysis (segmentation by industry, size, use case)
- Sentiment analysis (scan support tickets, emails for tone)

## Decision

We will implement a **Comprehensive Customer Health Monitoring System** with:

### 1. Multi-Dimensional Health Score
### 2. Real-Time Monitoring Engine
### 3. Predictive Churn Model
### 4. Alerting & Escalation System
### 5. CSM Action Dashboard
### 6. Automated Intervention Playbooks
### 7. Executive Reporting

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│              Customer Health Monitoring System                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   Data Sources Layer                      │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │ • Product Usage (API calls, analyses, LOC transformed)   │   │
│  │ • User Engagement (logins, features used, time in app)   │   │
│  │ • Support Tickets (Zendesk API)                          │   │
│  │ • NPS Surveys (Delighted/Qualtrics)                      │   │
│  │ • Contract Data (Salesforce)                             │   │
│  │ • Business Outcomes (ROI, bugs prevented, time saved)    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                             │                                     │
│                             ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Health Score Calculation Engine              │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │ • Aggregate metrics from all sources                     │   │
│  │ • Calculate sub-scores (usage, engagement, satisfaction) │   │
│  │ • Weight by importance (configurable)                    │   │
│  │ • Normalize to 0-100 scale                               │   │
│  │ • Run daily at 2am UTC                                   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                             │                                     │
│                             ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │          Anomaly Detection & Trend Analysis               │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │ • Compare to historical baseline (30/60/90 day avg)      │   │
│  │ • Detect significant changes (>20% drop triggers alert)  │   │
│  │ • Identify patterns (seasonal, weekly cycles)            │   │
│  │ • Score trends (improving, stable, declining)            │   │
│  └──────────────────────────────────────────────────────────┘   │
│                             │                                     │
│                             ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Predictive Churn Model (ML)                  │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │ • Logistic regression (baseline model)                   │   │
│  │ • Features: health score, trends, contract data          │   │
│  │ • Output: Churn probability (0-100%) at 30/60/90 days    │   │
│  │ • Retrain monthly on historical churn data               │   │
│  └──────────────────────────────────────────────────────────┘   │
│                             │                                     │
│                             ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Alerting & Routing Engine                    │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │ • Evaluate alert rules (health < 50, churn prob > 70%)   │   │
│  │ • Route to CSM (email, Slack, in-app notification)       │   │
│  │ • Escalate to leadership (churn prob > 90%, ARR > 200K)  │   │
│  │ • Create intervention tasks (CRM, project management)    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                             │                                     │
│                             ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │         CSM Dashboard & Executive Reports                 │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │ • Portfolio view (all customers, health distribution)    │   │
│  │ • Customer detail (health breakdown, trends, actions)    │   │
│  │ • Alerts inbox (prioritized by urgency)                  │   │
│  │ • Weekly email digest (at-risk customers, interventions) │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 1. Multi-Dimensional Health Score

**Health Score Formula** (0-100 scale):
```
Health Score = (Usage × 30%) + (Engagement × 25%) + (Satisfaction × 20%)
               + (Outcomes × 15%) + (Support × 10%)
```

**Component Breakdown**:

#### Usage Score (30% weight)
Measures product utilization relative to expected baseline.

```typescript
interface UsageMetrics {
  // Raw metrics (last 30 days)
  apiCalls: number
  analysesRun: number
  linesOfCodeTransformed: number
  repositoriesActive: number

  // Normalized to 0-100
  score: number
}

function calculateUsageScore(org: Organization): number {
  const metrics = getUsageMetrics(org.id, { last: 30 })

  // Expected usage based on contract size
  const expected = {
    apiCalls: org.seats * 1000,        // 1K API calls per user/month
    analysesRun: org.seats * 20,       // 20 analyses per user/month
    locTransformed: org.seats * 50000, // 50K LOC per user/month
    reposActive: Math.max(5, org.seats / 10), // 1 repo per 10 users
  }

  // Calculate % of expected
  const percentages = {
    apiCalls: metrics.apiCalls / expected.apiCalls,
    analysesRun: metrics.analysesRun / expected.analysesRun,
    locTransformed: metrics.linesOfCodeTransformed / expected.locTransformed,
    reposActive: metrics.repositoriesActive / expected.reposActive,
  }

  // Average, capped at 100
  const avgPercent = Object.values(percentages).reduce((a, b) => a + b) / 4
  return Math.min(100, avgPercent * 100)
}
```

**Score Interpretation**:
- **90-100**: Exceeding expectations (power users)
- **70-89**: Meeting expectations (healthy)
- **50-69**: Below expectations (monitor)
- **0-49**: Significantly underutilized (at risk)

#### Engagement Score (25% weight)
Measures user activity and feature adoption.

```typescript
interface EngagementMetrics {
  // Active users
  dailyActiveUsers: number
  weeklyActiveUsers: number
  monthlyActiveUsers: number

  // Feature adoption
  featuresUsed: number
  featuresAvailable: number

  // Stickiness
  dauToMauRatio: number  // DAU/MAU (higher = stickier)
  avgSessionDuration: number // minutes
  avgSessionsPerUser: number

  score: number
}

function calculateEngagementScore(org: Organization): number {
  const metrics = getEngagementMetrics(org.id, { last: 30 })

  const components = {
    // WAU / Total Seats (target: 80%)
    wauAdoption: (metrics.weeklyActiveUsers / org.seats) * 100,

    // Features used / Features available (target: 60%)
    featureAdoption: (metrics.featuresUsed / metrics.featuresAvailable) * 100,

    // DAU/MAU ratio (target: 30% = daily habit)
    stickiness: (metrics.dauToMauRatio / 0.3) * 100,

    // Avg session duration (target: 15 min)
    sessionQuality: (metrics.avgSessionDuration / 15) * 100,
  }

  // Weighted average
  const score = (
    components.wauAdoption * 0.4 +
    components.featureAdoption * 0.3 +
    components.stickiness * 0.2 +
    components.sessionQuality * 0.1
  )

  return Math.min(100, score)
}
```

**Score Interpretation**:
- **90-100**: Highly engaged (daily active users, using many features)
- **70-89**: Engaged (weekly active, using core features)
- **50-69**: Low engagement (monthly active, limited features)
- **0-49**: Disengaged (sporadic usage, single feature)

#### Satisfaction Score (20% weight)
Measures customer sentiment and happiness.

```typescript
interface SatisfactionMetrics {
  // NPS (Net Promoter Score)
  nps: number  // -100 to +100
  lastNPSSurveyDate: Date
  npsResponseRate: number

  // CSAT (Customer Satisfaction)
  csat: number // 1-5
  csatCount: number

  // Sentiment from support tickets
  ticketSentiment: number // -1 to +1 (from NLP)

  score: number
}

function calculateSatisfactionScore(org: Organization): number {
  const metrics = getSatisfactionMetrics(org.id, { last: 90 })

  // NPS: -100 to +100 → 0 to 100
  const npsScore = ((metrics.nps + 100) / 2)

  // CSAT: 1-5 → 0-100
  const csatScore = ((metrics.csat - 1) / 4) * 100

  // Ticket sentiment: -1 to +1 → 0-100
  const sentimentScore = ((metrics.ticketSentiment + 1) / 2) * 100

  // Weighted average (NPS most important)
  const score = (
    npsScore * 0.6 +
    csatScore * 0.3 +
    sentimentScore * 0.1
  )

  return Math.min(100, score)
}
```

**Score Interpretation**:
- **90-100**: Promoters (NPS 9-10, extremely satisfied)
- **70-89**: Passives (NPS 7-8, satisfied but not thrilled)
- **50-69**: Detractors (NPS 0-6, dissatisfied)
- **0-49**: Very dissatisfied (NPS 0-3, high churn risk)

#### Outcomes Score (15% weight)
Measures business value delivered.

```typescript
interface OutcomesMetrics {
  // ROI achieved
  roiMultiple: number  // e.g., 10x
  timeToValue: number  // days to first refactoring

  // Value delivered
  techDebtReduced: number  // dollars
  bugsPrevented: number
  devTimeSaved: number  // hours

  // Success milestones
  firstRefactoringComplete: boolean
  qbrComplete: boolean
  caseStudyPublished: boolean

  score: number
}

function calculateOutcomesScore(org: Organization): number {
  const metrics = getOutcomesMetrics(org.id)

  const components = {
    // ROI (target: 10x)
    roi: (metrics.roiMultiple / 10) * 100,

    // Time to value (target: <60 days, inverse score)
    ttv: Math.max(0, (120 - metrics.timeToValue) / 120 * 100),

    // Milestones (each milestone = 33.3 points)
    milestones: (
      (metrics.firstRefactoringComplete ? 33.3 : 0) +
      (metrics.qbrComplete ? 33.3 : 0) +
      (metrics.caseStudyPublished ? 33.3 : 0)
    ),
  }

  const score = (
    components.roi * 0.5 +
    components.ttv * 0.3 +
    components.milestones * 0.2
  )

  return Math.min(100, score)
}
```

**Score Interpretation**:
- **90-100**: Exceptional outcomes (10x+ ROI, case study worthy)
- **70-89**: Strong outcomes (5-10x ROI, achieving goals)
- **50-69**: Moderate outcomes (2-5x ROI, some value)
- **0-49**: Poor outcomes (< 2x ROI, not realizing value)

#### Support Score (10% weight)
Measures support burden (inverse: fewer tickets = healthier).

```typescript
interface SupportMetrics {
  ticketCount: number
  criticalTickets: number
  avgResolutionTime: number  // hours
  escalations: number

  score: number
}

function calculateSupportScore(org: Organization): number {
  const metrics = getSupportMetrics(org.id, { last: 30 })

  // Expected tickets based on seats (baseline: 1 ticket per 10 users/month)
  const expectedTickets = org.seats / 10

  const components = {
    // Ticket count (inverse scoring: fewer = better)
    ticketBurden: Math.max(0, (1 - metrics.ticketCount / (expectedTickets * 2)) * 100),

    // Critical tickets (each critical = -20 points)
    criticalPenalty: Math.max(0, 100 - (metrics.criticalTickets * 20)),

    // Resolution time (target: <4 hours)
    resolutionSpeed: Math.max(0, (1 - metrics.avgResolutionTime / 24) * 100),

    // Escalations (each escalation = -10 points)
    escalationPenalty: Math.max(0, 100 - (metrics.escalations * 10)),
  }

  const score = (
    components.ticketBurden * 0.4 +
    components.criticalPenalty * 0.3 +
    components.resolutionSpeed * 0.2 +
    components.escalationPenalty * 0.1
  )

  return Math.min(100, score)
}
```

**Score Interpretation**:
- **90-100**: Minimal support needs (self-sufficient)
- **70-89**: Normal support needs (occasional questions)
- **50-69**: High support needs (frequent tickets)
- **0-49**: Very high support burden (product not working for them)

### 2. Real-Time Monitoring Engine

**Architecture**:
```typescript
// Background job: Calculate health scores daily
export class HealthScoreCalculator {
  @Cron('0 2 * * *') // 2am UTC daily
  async calculateAllHealthScores() {
    const orgs = await this.db.organization.findMany({
      where: { tier: 'enterprise', status: 'active' }
    })

    for (const org of orgs) {
      await this.calculateAndStore(org)
    }
  }

  async calculateAndStore(org: Organization) {
    // Calculate all component scores
    const usage = calculateUsageScore(org)
    const engagement = calculateEngagementScore(org)
    const satisfaction = calculateSatisfactionScore(org)
    const outcomes = calculateOutcomesScore(org)
    const support = calculateSupportScore(org)

    // Weighted total
    const totalScore = Math.round(
      usage * 0.30 +
      engagement * 0.25 +
      satisfaction * 0.20 +
      outcomes * 0.15 +
      support * 0.10
    )

    // Get previous score for trend analysis
    const previous = await this.db.customerHealthScore.findFirst({
      where: { organizationId: org.id },
      orderBy: { createdAt: 'desc' }
    })

    // Store new score
    const newScore = await this.db.customerHealthScore.create({
      data: {
        organizationId: org.id,
        score: totalScore,
        usageScore: usage,
        engagementScore: engagement,
        satisfactionScore: satisfaction,
        outcomesScore: outcomes,
        supportScore: support,
        trend: this.calculateTrend(totalScore, previous?.score),
        previousScore: previous?.score,
      }
    })

    // Check for significant changes (trigger alerts)
    if (this.isSignificantChange(newScore, previous)) {
      await this.triggerAlert(org, newScore, previous)
    }

    return newScore
  }

  calculateTrend(current: number, previous?: number): Trend {
    if (!previous) return 'stable'

    const change = current - previous
    if (change > 10) return 'improving'
    if (change < -10) return 'declining'
    return 'stable'
  }

  isSignificantChange(current: HealthScore, previous?: HealthScore): boolean {
    if (!previous) return false

    const changePct = Math.abs(current.score - previous.score) / previous.score

    // Alert if:
    // - 20%+ drop in total score
    // - Score crossed threshold (e.g., 70 → 69 = healthy → at-risk)
    // - Any component dropped >30%
    return (
      changePct > 0.2 ||
      this.crossedThreshold(current.score, previous.score) ||
      this.componentDropped(current, previous)
    )
  }

  crossedThreshold(current: number, previous: number): boolean {
    // Thresholds: 90 (excellent), 70 (healthy), 50 (at-risk)
    const thresholds = [90, 70, 50]

    return thresholds.some(t =>
      (previous >= t && current < t) || (previous < t && current >= t)
    )
  }
}
```

**Event-Driven Triggers** (real-time alerts):
```typescript
// Listen for critical events that bypass daily calculation
export class HealthEventListener {
  @OnEvent('support.critical_ticket_created')
  async onCriticalTicket(event: CriticalTicketEvent) {
    // Immediately recalculate health and alert CSM
    const org = await this.db.organization.findUnique({
      where: { id: event.organizationId }
    })

    await this.healthCalculator.calculateAndStore(org)

    await this.alerting.send({
      type: 'critical_ticket',
      organizationId: org.id,
      severity: 'high',
      message: `Critical ticket #${event.ticketId} created`,
      cta: `View ticket: ${event.ticketUrl}`,
    })
  }

  @OnEvent('user.admin_churned')
  async onAdminChurned(event: AdminChurnedEvent) {
    // Admin user deactivated (SCIM sync or manual)
    await this.alerting.send({
      type: 'admin_turnover',
      organizationId: event.organizationId,
      severity: 'high',
      message: `Admin ${event.userEmail} deactivated. Potential champion churn.`,
      cta: 'Reach out to customer immediately',
    })
  }

  @OnEvent('integration.disconnected')
  async onIntegrationDisconnected(event: IntegrationEvent) {
    // GitHub/GitLab integration disconnected
    await this.alerting.send({
      type: 'integration_disconnected',
      organizationId: event.organizationId,
      severity: 'medium',
      message: `${event.provider} integration disconnected`,
      cta: 'Contact customer to reconnect',
    })
  }

  @OnEvent('usage.inactive_30_days')
  async onInactive30Days(event: InactivityEvent) {
    // No usage for 30 consecutive days (dormant customer)
    await this.alerting.send({
      type: 'dormant_customer',
      organizationId: event.organizationId,
      severity: 'critical',
      message: 'No usage for 30+ days. Customer may have churned.',
      cta: 'Schedule check-in call immediately',
    })
  }
}
```

### 3. Predictive Churn Model

**ML Model Architecture**:
```typescript
// Logistic regression model for churn prediction
interface ChurnPredictionModel {
  // Features (input)
  features: {
    // Health metrics
    currentHealthScore: number
    healthScoreTrend: number  // slope over 90 days
    daysAtLowHealth: number   // days below 50

    // Usage trends
    usageTrend30d: number     // % change vs previous 30d
    usageTrend90d: number     // % change vs previous 90d
    daysInactive: number

    // Contract/account
    daysUntilRenewal: number
    contractValue: number
    tenure: number            // days since signup

    // Engagement
    wauTrend: number
    featureAdoptionRate: number
    lastLoginDays: number

    // Satisfaction
    nps: number
    supportTicketsPerMonth: number
    escalationsPerMonth: number

    // Outcomes
    roiMultiple: number
    qbrCompleted: boolean
  }

  // Output
  churnProbability: number  // 0-100%
  churnRisk: 'low' | 'medium' | 'high' | 'critical'
  confidenceInterval: [number, number]
  topRiskFactors: string[]
}

export class ChurnPredictor {
  private model: LogisticRegressionModel

  constructor() {
    // Load pre-trained model (trained monthly on historical data)
    this.model = loadModel('churn-prediction-v2.pkl')
  }

  async predict(organizationId: string): Promise<ChurnPredictionModel> {
    // Extract features
    const features = await this.extractFeatures(organizationId)

    // Run prediction
    const probability = this.model.predict(features)

    // Calculate risk level
    const risk = this.calculateRiskLevel(probability)

    // Identify top risk factors (SHAP values)
    const riskFactors = this.explainPrediction(features, probability)

    return {
      features,
      churnProbability: probability * 100,
      churnRisk: risk,
      confidenceInterval: this.getConfidenceInterval(probability),
      topRiskFactors: riskFactors,
    }
  }

  calculateRiskLevel(probability: number): 'low' | 'medium' | 'high' | 'critical' {
    if (probability < 0.2) return 'low'       // <20%
    if (probability < 0.5) return 'medium'    // 20-50%
    if (probability < 0.8) return 'high'      // 50-80%
    return 'critical'                         // >80%
  }

  explainPrediction(features: any, probability: number): string[] {
    // Use SHAP (SHapley Additive exPlanations) to identify top contributors
    const shap = this.model.explainPrediction(features)

    // Sort by absolute SHAP value (impact on prediction)
    const sorted = Object.entries(shap)
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
      .slice(0, 5)

    // Convert to human-readable messages
    return sorted.map(([feature, impact]) => {
      const messages = {
        healthScoreTrend: 'Health score declining over time',
        usageTrend30d: 'Usage dropped significantly this month',
        daysUntilRenewal: 'Renewal approaching without engagement',
        nps: 'Low customer satisfaction (NPS)',
        supportTicketsPerMonth: 'High support ticket volume',
        roiMultiple: 'Not achieving expected ROI',
      }

      return messages[feature] || feature
    })
  }

  // Retrain model monthly with new churn data
  @Cron('0 3 1 * *') // 3am on 1st of month
  async retrainModel() {
    // Get historical data (last 12 months)
    const trainingData = await this.db.$queryRaw`
      SELECT
        org.id,
        -- Features
        AVG(hs.score) as avg_health_score,
        REGR_SLOPE(hs.score, EXTRACT(EPOCH FROM hs.created_at)) as health_trend,
        COUNT(*) FILTER (WHERE hs.score < 50) as days_at_low_health,
        -- ... other features

        -- Label (churned or not)
        CASE WHEN org.churned_at IS NOT NULL THEN 1 ELSE 0 END as churned
      FROM organizations org
      LEFT JOIN customer_health_scores hs ON hs.organization_id = org.id
      WHERE org.created_at > NOW() - INTERVAL '12 months'
      GROUP BY org.id
    `

    // Train new model
    const newModel = await trainLogisticRegression(trainingData)

    // Evaluate on holdout set (20% of data)
    const metrics = await this.evaluate(newModel, trainingData)

    // Only deploy if better than current model
    if (metrics.auc > 0.85) {
      await this.deployModel(newModel)

      await this.notifyTeam({
        message: `Churn prediction model retrained. AUC: ${metrics.auc}`,
        metrics,
      })
    }
  }
}
```

**Model Performance Targets**:
- **AUC (Area Under Curve)**: > 0.85 (excellent discrimination)
- **Precision**: > 0.75 (when we predict churn, 75%+ actually churn)
- **Recall**: > 0.80 (we catch 80%+ of actual churns)
- **False Positive Rate**: < 20% (don't over-alert CSMs)

### 4. Alerting & Escalation System

**Alert Rules Engine**:
```typescript
interface AlertRule {
  id: string
  name: string
  description: string

  // Trigger conditions
  conditions: {
    healthScore?: { operator: '<' | '>' | '<='; value: number }
    healthTrend?: 'declining' | 'stable' | 'improving'
    churnProbability?: { operator: '>'; value: number }
    specificEvent?: string  // e.g., 'critical_ticket', 'admin_churned'
  }

  // Severity
  severity: 'low' | 'medium' | 'high' | 'critical'

  // Routing
  recipients: {
    csm: boolean
    csmManager: boolean
    vp_cs: boolean
    account_exec: boolean
  }

  // Channels
  channels: ('email' | 'slack' | 'in_app' | 'sms')[]

  // Throttling (prevent alert fatigue)
  throttle: {
    maxPerDay: number
    minIntervalHours: number
  }
}

const alertRules: AlertRule[] = [
  {
    id: 'health-critical',
    name: 'Health Score Critical',
    description: 'Health score dropped below 50 (at-risk)',
    conditions: {
      healthScore: { operator: '<', value: 50 }
    },
    severity: 'high',
    recipients: {
      csm: true,
      csmManager: true,
      vp_cs: false,
      account_exec: false,
    },
    channels: ['email', 'slack', 'in_app'],
    throttle: { maxPerDay: 1, minIntervalHours: 24 }
  },

  {
    id: 'churn-imminent',
    name: 'Churn Imminent',
    description: 'Churn probability >80% within 30 days',
    conditions: {
      churnProbability: { operator: '>', value: 80 }
    },
    severity: 'critical',
    recipients: {
      csm: true,
      csmManager: true,
      vp_cs: true,
      account_exec: true,
    },
    channels: ['email', 'slack', 'sms'],
    throttle: { maxPerDay: 3, minIntervalHours: 8 }
  },

  {
    id: 'usage-declining',
    name: 'Usage Declining',
    description: 'Usage down >30% month-over-month',
    conditions: {
      healthTrend: 'declining',
      healthScore: { operator: '<', value: 70 }
    },
    severity: 'medium',
    recipients: {
      csm: true,
      csmManager: false,
      vp_cs: false,
      account_exec: false,
    },
    channels: ['email', 'slack'],
    throttle: { maxPerDay: 1, minIntervalHours: 72 }
  },

  {
    id: 'dormant-customer',
    name: 'Dormant Customer',
    description: 'No usage for 30+ consecutive days',
    conditions: {
      specificEvent: 'usage.inactive_30_days'
    },
    severity: 'critical',
    recipients: {
      csm: true,
      csmManager: true,
      vp_cs: false,
      account_exec: false,
    },
    channels: ['email', 'slack'],
    throttle: { maxPerDay: 1, minIntervalHours: 168 } // Once per week
  },
]
```

**Alert Delivery**:
```typescript
export class AlertingService {
  async send(alert: Alert) {
    // Check throttling (prevent spam)
    if (await this.isThrottled(alert)) {
      return { sent: false, reason: 'throttled' }
    }

    // Determine recipients
    const recipients = await this.getRecipients(alert)

    // Send via each channel
    const promises = alert.channels.map(async channel => {
      switch (channel) {
        case 'email':
          return this.sendEmail(recipients, alert)
        case 'slack':
          return this.sendSlack(recipients, alert)
        case 'in_app':
          return this.sendInApp(recipients, alert)
        case 'sms':
          return this.sendSMS(recipients, alert)
      }
    })

    await Promise.all(promises)

    // Record alert
    await this.db.alert.create({
      data: {
        organizationId: alert.organizationId,
        ruleId: alert.ruleId,
        severity: alert.severity,
        message: alert.message,
        recipients: recipients.map(r => r.email),
        channels: alert.channels,
        sentAt: new Date(),
      }
    })
  }

  async sendSlack(recipients: User[], alert: Alert) {
    const org = await this.db.organization.findUnique({
      where: { id: alert.organizationId }
    })

    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `🚨 ${alert.severity.toUpperCase()}: ${alert.message}`,
        }
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Customer:*\n${org.name}` },
          { type: 'mrkdwn', text: `*ARR:*\n$${org.arr.toLocaleString()}` },
          { type: 'mrkdwn', text: `*Health Score:*\n${alert.healthScore}/100` },
          { type: 'mrkdwn', text: `*Churn Risk:*\n${alert.churnRisk}` },
        ]
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Top Risk Factors:*\n${alert.riskFactors.map(f => `• ${f}`).join('\n')}`
        }
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'View Customer' },
            url: `https://admin.forge.app/customers/${org.id}`,
            style: 'primary',
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Schedule Call' },
            url: `https://admin.forge.app/customers/${org.id}/schedule`,
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Create Task' },
            url: `https://admin.forge.app/customers/${org.id}/tasks/new`,
          },
        ]
      }
    ]

    // Send to #customer-health channel
    await this.slack.postMessage('#customer-health', { blocks })

    // DM each CSM
    for (const recipient of recipients) {
      await this.slack.sendDM(recipient.slackUserId, { blocks })
    }
  }
}
```

### 5. CSM Action Dashboard

**Portfolio View** (`/apps/admin/customer-health`):
```typescript
export default async function CustomerHealthDashboard() {
  const customers = await getEnterpriseCustomers()
  const portfolio = await getPortfolioMetrics()

  return (
    <div className="p-8 space-y-8">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard
          title="Total Customers"
          value={portfolio.totalCustomers}
          icon={<Building2 />}
        />
        <MetricCard
          title="Total ARR"
          value={`$${(portfolio.totalARR / 1000).toFixed(0)}K`}
          icon={<DollarSign />}
        />
        <MetricCard
          title="Avg Health Score"
          value={portfolio.avgHealthScore}
          trend={portfolio.healthTrend}
          icon={<Heart />}
        />
        <MetricCard
          title="At-Risk ARR"
          value={`$${(portfolio.atRiskARR / 1000).toFixed(0)}K`}
          variant="danger"
          icon={<AlertTriangle />}
        />
      </div>

      {/* Health Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Customer Health Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <HealthDistributionChart data={portfolio.healthDistribution} />
        </CardContent>
      </Card>

      {/* Alerts Inbox */}
      <Card>
        <CardHeader>
          <CardTitle>Active Alerts ({portfolio.activeAlerts})</CardTitle>
        </CardHeader>
        <CardContent>
          <AlertsTable alerts={await getActiveAlerts()} />
        </CardContent>
      </Card>

      {/* Customer List */}
      <Card>
        <CardHeader>
          <CardTitle>All Customers</CardTitle>
          <div className="flex gap-2">
            <FilterDropdown label="Health" options={['All', '<50', '50-70', '70-90', '>90']} />
            <FilterDropdown label="Renewal" options={['All', '<30d', '30-60d', '60-90d', '>90d']} />
            <FilterDropdown label="CSM" options={['All', ...portfolio.csms]} />
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={[
              { key: 'name', label: 'Customer', sortable: true },
              { key: 'arr', label: 'ARR', sortable: true, format: 'currency' },
              { key: 'healthScore', label: 'Health', sortable: true, render: (score) => (
                <HealthScoreBadge score={score} />
              )},
              { key: 'trend', label: 'Trend', render: (trend) => (
                <TrendIndicator trend={trend} />
              )},
              { key: 'churnRisk', label: 'Churn Risk', render: (risk) => (
                <ChurnRiskBadge risk={risk} />
              )},
              { key: 'renewalDate', label: 'Renewal', sortable: true, format: 'date' },
              { key: 'csm', label: 'CSM' },
              { key: 'actions', label: '', render: (_, customer) => (
                <DropdownMenu>
                  <DropdownMenuItem onClick={() => router.push(`/customers/${customer.id}`)}>
                    View Details
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => scheduleCall(customer)}>
                    Schedule Call
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => sendUpdate(customer)}>
                    Send Update
                  </DropdownMenuItem>
                </DropdownMenu>
              )}
            ]}
            data={customers}
            defaultSort={{ key: 'healthScore', order: 'asc' }}
          />
        </CardContent>
      </Card>
    </div>
  )
}
```

**Customer Detail View** (`/apps/admin/customers/[id]/health`):
```typescript
export default async function CustomerHealthDetailPage({
  params
}: {
  params: { id: string }
}) {
  const org = await getOrganization(params.id)
  const health = await getHealthScore(params.id)
  const history = await getHealthHistory(params.id, { days: 90 })
  const prediction = await getChurnPrediction(params.id)

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">{org.name}</h1>
          <p className="text-slate-600">
            {org.arr.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} ARR
            · Renews {formatDate(org.renewalDate)}
          </p>
        </div>

        <div className="flex gap-2">
          <HealthScoreBadge score={health.score} size="large" />
          <ChurnRiskBadge risk={prediction.churnRisk} size="large" />
        </div>
      </div>

      {/* Alerts */}
      {health.score < 50 && (
        <Alert variant="danger">
          <AlertTriangle className="h-5 w-5" />
          <AlertTitle>Customer At Risk</AlertTitle>
          <AlertDescription>
            Health score below 50. Immediate intervention required.
          </AlertDescription>
        </Alert>
      )}

      {/* Health Score Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Health Score Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <ScoreBar label="Usage" score={health.usageScore} weight={30} />
            <ScoreBar label="Engagement" score={health.engagementScore} weight={25} />
            <ScoreBar label="Satisfaction" score={health.satisfactionScore} weight={20} />
            <ScoreBar label="Outcomes" score={health.outcomesScore} weight={15} />
            <ScoreBar label="Support" score={health.supportScore} weight={10} />
          </div>
        </CardContent>
      </Card>

      {/* Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Health Score History (90 days)</CardTitle>
        </CardHeader>
        <CardContent>
          <HealthTrendChart data={history} />
        </CardContent>
      </Card>

      {/* Churn Prediction */}
      <Card>
        <CardHeader>
          <CardTitle>Churn Prediction</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-lg">Churn Probability (30 days)</span>
              <span className="text-3xl font-bold text-red-600">
                {prediction.churnProbability.toFixed(0)}%
              </span>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Top Risk Factors:</h4>
              <ul className="list-disc pl-5 space-y-1">
                {prediction.topRiskFactors.map(factor => (
                  <li key={factor}>{factor}</li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recommended Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Recommended Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <RecommendedActions
            healthScore={health.score}
            churnRisk={prediction.churnRisk}
            riskFactors={prediction.topRiskFactors}
          />
        </CardContent>
      </Card>
    </div>
  )
}
```

### 6. Automated Intervention Playbooks

**Playbook Matcher**:
```typescript
// Suggest intervention based on health signals
export class InterventionEngine {
  async suggestInterventions(organizationId: string): Promise<Intervention[]> {
    const health = await getHealthScore(organizationId)
    const prediction = await getChurnPrediction(organizationId)

    const interventions: Intervention[] = []

    // Low usage score
    if (health.usageScore < 50) {
      interventions.push({
        priority: 'high',
        category: 'adoption',
        title: 'Boost Product Adoption',
        actions: [
          'Schedule product training session',
          'Share best practices guide',
          'Identify and remove usage blockers',
          'Offer personalized onboarding refresh',
        ],
        estimatedImpact: '+15 health points',
      })
    }

    // Low engagement score
    if (health.engagementScore < 50) {
      interventions.push({
        priority: 'high',
        category: 'engagement',
        title: 'Re-Engage Users',
        actions: [
          'Send feature spotlight email campaign',
          'Host "What\'s New" webinar',
          'Identify inactive users, send re-activation campaign',
          'Share customer success stories',
        ],
        estimatedImpact: '+12 health points',
      })
    }

    // Low satisfaction score
    if (health.satisfactionScore < 50) {
      interventions.push({
        priority: 'critical',
        category: 'satisfaction',
        title: 'Address Customer Dissatisfaction',
        actions: [
          'Schedule executive alignment call',
          'Conduct "Voice of Customer" interview',
          'Review and address recent support tickets',
          'Offer product roadmap preview (VIP treatment)',
        ],
        estimatedImpact: '+20 health points',
      })
    }

    // Low outcomes score
    if (health.outcomesScore < 50) {
      interventions.push({
        priority: 'high',
        category: 'value',
        title: 'Demonstrate ROI',
        actions: [
          'Build custom ROI report',
          'Schedule QBR to showcase value',
          'Identify quick wins for immediate value',
          'Share case study from similar customer',
        ],
        estimatedImpact: '+18 health points',
      })
    }

    // High support burden
    if (health.supportScore < 50) {
      interventions.push({
        priority: 'medium',
        category: 'support',
        title: 'Reduce Support Friction',
        actions: [
          'Identify root cause of ticket volume',
          'Offer dedicated technical training',
          'Improve documentation for common issues',
          'Assign dedicated support engineer',
        ],
        estimatedImpact: '+10 health points',
      })
    }

    // High churn risk
    if (prediction.churnProbability > 70) {
      interventions.push({
        priority: 'critical',
        category: 'retention',
        title: 'Prevent Churn',
        actions: [
          'Executive escalation (VP CS → Customer C-Suite)',
          'Offer contract concessions (discount, extended terms)',
          'Propose joint success plan with milestones',
          'Deploy "SWAT team" for intensive support',
        ],
        estimatedImpact: 'Reduce churn risk to <50%',
      })
    }

    // Sort by priority
    return interventions.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
      return priorityOrder[a.priority] - priorityOrder[b.priority]
    })
  }
}
```

### 7. Executive Reporting

**Weekly Digest Email**:
```typescript
// Send every Monday at 8am to VP CS, CRO, CEO
@Cron('0 8 * * 1') // Monday 8am
async function sendWeeklyHealthDigest() {
  const metrics = await getPortfolioMetrics()
  const alerts = await getAlertsThisWeek()
  const atRisk = await getAtRiskCustomers()

  const html = `
    <h1>Customer Health Weekly Digest</h1>

    <h2>Portfolio Overview</h2>
    <ul>
      <li>Total Customers: ${metrics.totalCustomers}</li>
      <li>Avg Health Score: ${metrics.avgHealthScore}/100 (${metrics.healthTrend})</li>
      <li>At-Risk ARR: $${metrics.atRiskARR.toLocaleString()}</li>
      <li>Predicted Churn (90d): ${metrics.predictedChurn}%</li>
    </ul>

    <h2>Alerts This Week</h2>
    <ul>
      <li>Critical: ${alerts.critical} customers</li>
      <li>High: ${alerts.high} customers</li>
      <li>Medium: ${alerts.medium} customers</li>
    </ul>

    <h2>Top 5 At-Risk Customers</h2>
    <table>
      <tr>
        <th>Customer</th>
        <th>ARR</th>
        <th>Health</th>
        <th>Churn Risk</th>
        <th>CSM</th>
      </tr>
      ${atRisk.slice(0, 5).map(c => `
        <tr>
          <td>${c.name}</td>
          <td>$${c.arr.toLocaleString()}</td>
          <td>${c.healthScore}/100</td>
          <td>${c.churnProbability.toFixed(0)}%</td>
          <td>${c.csmName}</td>
        </tr>
      `).join('')}
    </table>

    <h2>CSM Activity This Week</h2>
    <ul>
      ${metrics.csmActivity.map(csm => `
        <li>${csm.name}: ${csm.calls} calls, ${csm.emails} emails, ${csm.interventions} interventions</li>
      `).join('')}
    </ul>

    <a href="https://admin.forge.app/customer-health">View Full Dashboard</a>
  `

  await sendEmail({
    to: ['vp-cs@forge.app', 'cro@forge.app', 'ceo@forge.app'],
    subject: `Customer Health Digest - Week of ${format(new Date(), 'MMM d')}`,
    html,
  })
}
```

## Data Model

```prisma
model CustomerHealthScore {
  id             String   @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])

  // Total score
  score          Int      // 0-100
  trend          Trend    // improving, stable, declining
  previousScore  Int?     // for trend calculation

  // Component scores
  usageScore        Int  // 0-100
  engagementScore   Int  // 0-100
  satisfactionScore Int  // 0-100
  outcomesScore     Int  // 0-100
  supportScore      Int  // 0-100

  // Raw metrics (for transparency)
  metrics        Json     // Store all raw metrics

  createdAt      DateTime @default(now())

  @@index([organizationId, createdAt])
  @@index([score, createdAt])
}

enum Trend {
  IMPROVING
  STABLE
  DECLINING
}

model ChurnPrediction {
  id                String   @id @default(cuid())
  organizationId    String
  organization      Organization @relation(fields: [organizationId], references: [id])

  // Prediction outputs
  churnProbability  Float    // 0-1
  churnRisk         ChurnRisk
  confidenceInterval Json    // [lower, upper]

  // Explanation
  topRiskFactors    String[] // Top 5 contributing features
  shapValues        Json     // SHAP values for all features

  // Model metadata
  modelVersion      String
  predictionHorizon Int      // days (30, 60, 90)

  createdAt         DateTime @default(now())

  @@index([organizationId, createdAt])
}

enum ChurnRisk {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

model Alert {
  id             String   @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])

  ruleId         String   // Which alert rule triggered
  ruleName       String

  severity       Severity
  category       String   // 'health', 'usage', 'satisfaction', etc
  message        String

  // Context
  healthScore    Int?
  churnRisk      ChurnRisk?
  riskFactors    String[]

  // Delivery
  recipients     String[] // Emails of who was notified
  channels       String[] // ['email', 'slack', 'sms']
  sentAt         DateTime

  // Follow-up
  acknowledgedBy String?
  acknowledgedAt DateTime?
  resolvedAt     DateTime?

  createdAt      DateTime @default(now())

  @@index([organizationId, severity, createdAt])
  @@index([sentAt])
}

enum Severity {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

model Intervention {
  id             String   @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])

  priority       Priority
  category       String   // 'adoption', 'engagement', 'satisfaction', etc
  title          String
  description    String

  // Actions
  suggestedActions String[]
  completedActions String[]

  // Outcome
  estimatedImpact String
  actualImpact    String?

  // Tracking
  assignedTo     String   // CSM email
  status         InterventionStatus @default(SUGGESTED)

  createdAt      DateTime @default(now())
  completedAt    DateTime?

  @@index([organizationId, status])
  @@index([assignedTo, status])
}

enum Priority {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

enum InterventionStatus {
  SUGGESTED
  IN_PROGRESS
  COMPLETED
  CANCELLED
}
```

## Consequences

### Positive

1. **Proactive Customer Success**:
   - Detect churn signals 60-90 days before renewal (vs 0-7 days currently)
   - Intervene early when issues are fixable
   - 25-40% reduction in churn rate (industry benchmark)

2. **Scalable CS Operations**:
   - CSMs can manage 15-20 accounts (vs 5 currently)
   - Automated monitoring replaces manual checks
   - Data-driven prioritization (focus on highest-risk accounts)

3. **Revenue Protection**:
   - Prevent $300K-$600K in annual churn (20-40% of enterprise ARR)
   - Improve renewal rate from 85% to 95%+ (industry best practice)
   - Identify expansion opportunities (healthy customers likely to expand)

4. **Better Decision Making**:
   - Leadership has real-time portfolio visibility
   - Finance can forecast churn accurately
   - Product team sees feature adoption patterns

5. **Customer Transparency**:
   - Share health score with customers (builds trust)
   - Joint success plans based on data
   - Customers self-correct when they see declining health

### Negative

1. **Data Quality Dependency**:
   - Health score only as good as underlying data
   - Missing data (NPS, support tickets) reduces accuracy
   - Integration failures cause gaps

2. **Alert Fatigue**:
   - Too many alerts = CSMs ignore them
   - False positives reduce trust in system
   - Need careful tuning of thresholds

3. **Model Accuracy**:
   - ML model requires 12+ months of churn data
   - Small sample size (10-15 customers) limits accuracy
   - Model may not generalize to new customer segments

4. **Implementation Complexity**:
   - Integrations with 5+ data sources (product, support, CRM, NPS)
   - ML model training and deployment infrastructure
   - Background jobs and alerting system

### Mitigations

1. **Data Quality**:
   - **Action**: Daily data quality checks (alert if data missing)
   - **Pattern**: Graceful degradation (calculate score with available data)
   - **Tool**: Data validation layer before scoring

2. **Alert Fatigue**:
   - **Action**: Throttling rules (max 1 alert per customer per day)
   - **Pattern**: Intelligent routing (critical alerts to manager, not just CSM)
   - **Tool**: Alert acknowledgement tracking

3. **Model Accuracy**:
   - **Action**: Start with rule-based system, add ML when data available
   - **Pattern**: Ensemble model (combine multiple signals)
   - **Tool**: Monthly model retraining and evaluation

4. **Complexity**:
   - **Action**: Phased rollout (health score → alerts → ML prediction)
   - **Pattern**: Use managed services (Temporal Cloud, AWS SageMaker)
   - **Tool**: Comprehensive monitoring and error tracking

## Metrics & Success Criteria

### Health Monitoring
- **Calculation Frequency**: Daily (2am UTC)
- **Data Freshness**: < 24 hours
- **Calculation Success Rate**: 99%+ (all customers scored daily)
- **Alert Delivery**: < 1 hour from trigger to CSM notification

### Prediction Accuracy
- **AUC**: > 0.85 (excellent discrimination)
- **Precision**: > 0.75 (75%+ of predicted churns actually churn)
- **Recall**: > 0.80 (catch 80%+ of actual churns)
- **False Positive Rate**: < 20%

### Business Impact
- **Renewal Rate**: 95%+ (up from 85% baseline)
- **Churn Reduction**: 30-50% (catch and save at-risk customers)
- **Time to Intervention**: < 24 hours (from alert to CSM action)
- **Revenue Protected**: $300K-$600K annually

### CSM Productivity
- **Accounts per CSM**: 15-20 (up from 5)
- **Proactive Interventions**: 80%+ of at-risk customers contacted before they reach out
- **CSM Satisfaction**: 8+/10 (system helps, doesn't hinder)

## Implementation Plan

### Phase 1: Health Score Foundation (Weeks 1-4)
- [ ] Build health score calculation engine
- [ ] Implement data collection from product database
- [ ] Create health score data model
- [ ] Build basic CSM dashboard (view scores)

### Phase 2: Data Integrations (Weeks 5-8)
- [ ] Integrate Zendesk API (support tickets)
- [ ] Integrate NPS survey platform
- [ ] Integrate Salesforce (contract data)
- [ ] Implement daily background job

### Phase 3: Alerting System (Weeks 9-12)
- [ ] Build alert rules engine
- [ ] Implement email/Slack delivery
- [ ] Add alert throttling logic
- [ ] Build alerts inbox in CSM dashboard

### Phase 4: Predictive Model (Weeks 13-16)
- [ ] Collect historical churn data
- [ ] Train baseline logistic regression model
- [ ] Build prediction pipeline
- [ ] Add churn prediction to dashboard

### Phase 5: Interventions (Weeks 17-20)
- [ ] Build intervention suggestion engine
- [ ] Create intervention playbooks
- [ ] Add intervention tracking
- [ ] Build executive reporting

### Phase 6: Launch (Week 21)
- [ ] Pilot with 3 CSMs
- [ ] Training and documentation
- [ ] Tune alert thresholds based on feedback
- [ ] Production launch

## References

### Industry Research
- [Gainsight: Customer Health Scoring](https://www.gainsight.com/guides/the-essential-guide-to-customer-health-scores/)
- [ChurnZero: Churn Prediction](https://churnzero.net/blog/predict-customer-churn/)
- [Forrester: CS Analytics Best Practices](https://www.forrester.com)

### Technology
- [Scikit-learn: Logistic Regression](https://scikit-learn.org/stable/modules/generated/sklearn.linear_model.LogisticRegression.html)
- [SHAP: Model Explainability](https://shap.readthedocs.io/)
- [Temporal: Workflow Orchestration](https://temporal.io/)

### Internal References
- ADR-019: Enterprise Customer Management
- ADR-020: Super Admin Portal & Platform Administration
- ADR-026: Enterprise Customer Onboarding Automation

## Review Date
April 2026 (3 months)

**Reviewers**: VP Customer Success, Head of Data Science, Engineering Lead

---

**Document Version**: 1.0
**Last Updated**: 2026-01-20
**Authors**: Customer Success & Data Science Team
**Approved By**: VP Customer Success, CTO
