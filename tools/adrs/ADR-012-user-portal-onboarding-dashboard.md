# ADR-012: User Portal - Onboarding & Dashboard Experience

## Status
Accepted

## Context

The User Portal (`/apps/portal`) is the primary customer-facing application where developers interact with Forge Factory. Success metrics from our product spec indicate that **activation rate** (time to first value) and **retention** are critical to achieving our North Star goals:

- **North Star Metric**: 75% AI-Readiness Score improvement within 30 days
- **Activation Rate**: 60%+ (user completes first analysis within 7 days)
- **Retention**: 80%+ weekly active users (WAU)
- **Time to Value**: < 10 minutes from signup to first insight

### Current Challenges

1. **Onboarding Complexity**: Users need to:
   - Connect GitHub/GitLab account
   - Select repository
   - Understand AI-Readiness Score
   - Configure first analysis

2. **Dashboard Overwhelm**: Data-heavy analytics can confuse new users
   - 7 metrics in AI-Readiness Score
   - 50+ recommendations per analysis
   - Multiple visualizations (trends, heatmaps, distribution)

3. **Multi-Tenant Context**: Users belong to 2.3 organizations on average
   - Tenant switching must be seamless
   - Context must be clear (which org am I viewing?)

4. **Diverse User Personas**: (from product spec)
   - **Sarah Chen** (Team Lead): Wants team-wide insights
   - **Michael Rodriguez** (CTO): Wants ROI metrics
   - **Alex Thompson** (IC Developer): Wants code-level recommendations

### Requirements

- **Self-Service**: No human intervention required (reduces CAC)
- **Progressive Disclosure**: Show complexity gradually (prevent overwhelm)
- **Mobile-Responsive**: 40% of users access on mobile (analytics data)
- **Accessible**: WCAG 2.1 AA compliance (enterprise customers require it)
- **Fast**: LCP < 2.5s, INP < 200ms (Core Web Vitals)
- **Personalized**: Role-based views (IC vs Manager vs Executive)

## Decision

We will implement a **progressive onboarding flow** and **role-adaptive dashboard** with the following components:

### 1. Multi-Step Onboarding Wizard
### 2. Role-Based Dashboard Layouts
### 3. Command Palette for Power Users
### 4. Contextual Empty States
### 5. Interactive Walkthroughs
### 6. Smart Defaults

## Architecture

### Onboarding Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Onboarding Journey                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Step 1: Welcome & Role Selection (30s)                     │
│  ┌────────────────────────────────────────────┐             │
│  │ "I am a..."                                 │             │
│  │  ○ Individual Contributor                   │             │
│  │  ○ Team Lead / Manager                      │             │
│  │  ○ CTO / VP Engineering                     │             │
│  └────────────────────────────────────────────┘             │
│           │                                                   │
│           ▼                                                   │
│  Step 2: Connect Source Control (60s)                       │
│  ┌────────────────────────────────────────────┐             │
│  │ [GitHub Button]  [GitLab Button]           │             │
│  │ OAuth flow → Repository selection          │             │
│  └────────────────────────────────────────────┘             │
│           │                                                   │
│           ▼                                                   │
│  Step 3: Select First Repository (45s)                      │
│  ┌────────────────────────────────────────────┐             │
│  │ "Which repo should we analyze first?"      │             │
│  │ [Search: _____________________]             │             │
│  │ ✓ acme-corp/api-service (125K LOC)         │             │
│  │   acme-corp/web-app (87K LOC)              │             │
│  └────────────────────────────────────────────┘             │
│           │                                                   │
│           ▼                                                   │
│  Step 4: Start First Analysis (15s)                         │
│  ┌────────────────────────────────────────────┐             │
│  │ "Running AI-Readiness analysis..."         │             │
│  │ [████████████░░░░░░░░░░] 60%               │             │
│  │ Analyzing code complexity...                │             │
│  └────────────────────────────────────────────┘             │
│           │                                                   │
│           ▼                                                   │
│  Step 5: First Value Moment (Interactive)                   │
│  ┌────────────────────────────────────────────┐             │
│  │ 🎉 AI-Readiness Score: 62/100              │             │
│  │                                              │             │
│  │ Top 3 Quick Wins:                           │             │
│  │ 1. Add docstrings → +8 points               │             │
│  │ 2. Reduce complexity in auth.ts → +5        │             │
│  │ 3. Add unit tests → +12 points              │             │
│  │                                              │             │
│  │ [View Full Report] [Start Refactoring]     │             │
│  └────────────────────────────────────────────┘             │
│           │                                                   │
│           ▼                                                   │
│  Dashboard (Personalized by Role)                            │
│                                                               │
└─────────────────────────────────────────────────────────────┘

Total Time: < 10 minutes
Steps: 5 (industry best practice: 3-7 steps)
Completion Rate Goal: 75%+
```

### Dashboard Layouts (Role-Based)

```typescript
// Dashboard adapts based on user role

┌─────────────────────────────────────────────────────────────┐
│  INDIVIDUAL CONTRIBUTOR VIEW                                 │
├─────────────────────────────────────────────────────────────┤
│  Header: [My Repositories ▼] [Search] [🔔] [Avatar]        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Active Tasks                      Recent Analysis           │
│  ┌──────────────────────┐         ┌───────────────────┐    │
│  │ • Refactor auth.ts   │         │ api-service       │    │
│  │   In Progress        │         │ AI Score: 62/100  │    │
│  │                      │         │ 47 issues found   │    │
│  │ • Add tests to API   │         │ [View Report]     │    │
│  │   Ready to Review    │         └───────────────────┘    │
│  └──────────────────────┘                                    │
│                                                               │
│  Code Quality Trends (My Repos)                              │
│  ┌─────────────────────────────────────────────────┐        │
│  │        Complexity ↓  Test Coverage ↑             │        │
│  │  100 │         ╱╲                                │        │
│  │   75 │        ╱  ╲        ╱────                  │        │
│  │   50 │    ───╱    ╲──────╱                       │        │
│  │   25 │                                            │        │
│  │    0 └────────────────────────────────           │        │
│  │      Jan   Feb   Mar   Apr   May                 │        │
│  └─────────────────────────────────────────────────┘        │
│                                                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  TEAM LEAD / MANAGER VIEW                                    │
├─────────────────────────────────────────────────────────────┤
│  Header: [Acme Corp ▼] [Team] [Insights] [🔔] [Avatar]     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Team Velocity              Repository Health                │
│  ┌──────────────────┐      ┌─────────────────────────┐      │
│  │ 23 Refactorings  │      │ api-service      ⚠️ 62  │      │
│  │ 89% Completed    │      │ web-app          ✅ 84  │      │
│  │ 4.2 days avg     │      │ mobile-app       ⚠️ 58  │      │
│  └──────────────────┘      │ analytics-svc    🔴 41  │      │
│                             └─────────────────────────┘      │
│                                                               │
│  Team Members (Leaderboard)                                  │
│  ┌───────────────────────────────────────────────┐          │
│  │ 🥇 Sarah Chen        12 PRs   +340 AI Score   │          │
│  │ 🥈 Alex Thompson     9 PRs    +280 AI Score   │          │
│  │ 🥉 Jordan Lee        7 PRs    +210 AI Score   │          │
│  └───────────────────────────────────────────────┘          │
│                                                               │
│  Code Quality Distribution                                   │
│  ┌─────────────────────────────────────────────────┐        │
│  │     Files by Complexity                          │        │
│  │ Low    ████████████████████ 58%                  │        │
│  │ Medium ████████ 29%                              │        │
│  │ High   ███ 13%                                   │        │
│  └─────────────────────────────────────────────────┘        │
│                                                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  CTO / VP ENGINEERING VIEW                                   │
├─────────────────────────────────────────────────────────────┤
│  Header: [All Orgs ▼] [ROI] [Compliance] [🔔] [Avatar]     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Business Impact Metrics                                     │
│  ┌──────────────────────────────────────────────────┐       │
│  │ Technical Debt Reduction     $47,500 saved/month │       │
│  │ Developer Velocity           +34% (sprint pts)   │       │
│  │ Bug Rate                     -28% (production)   │       │
│  │ AI-Readiness Score           62 → 78 (+26%)      │       │
│  └──────────────────────────────────────────────────┘       │
│                                                               │
│  Repository Portfolio Health                                 │
│  ┌─────────────────────────────────────────────────┐        │
│  │        ●                                          │        │
│  │  100 │    ● ●       ● = Repository size          │        │
│  │   80 │  ●   ●   ●                                │        │
│  │   60 │●       ● ●                                │        │
│  │   40 │  ●                                         │        │
│  │   20 │                                            │        │
│  │    0 └────────────────────────────────           │        │
│  │       0    50K  100K  150K  200K (LOC)           │        │
│  └─────────────────────────────────────────────────┘        │
│                                                               │
│  Compliance & Security                                       │
│  ┌───────────────────────────────────────────────┐          │
│  │ ✅ SOC 2 Audit Ready    12/12 repos             │          │
│  │ ⚠️  Secrets Detected     2 repos (review)       │          │
│  │ ✅ Vulnerability Scan    0 critical             │          │
│  └───────────────────────────────────────────────┘          │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Detailed Decisions

### 1. Onboarding Wizard (Multi-Step)

**Implementation**: React Hook Form + Zustand

**Features**:
- **Progress Indicator**: Show 5 steps with current position
- **Skip Option**: "I'll do this later" for steps 2-3 (reduce friction)
- **Smart Defaults**: Pre-select most active repository based on commits
- **Exit & Resume**: Save progress if user abandons (resume next login)
- **Analytics Tracking**: Measure drop-off at each step (optimize funnel)

**Code Structure**:
```typescript
// apps/portal/app/(onboarding)/layout.tsx
export default function OnboardingLayout({ children }: { children: ReactNode }) {
  const { step, totalSteps } = useOnboardingStore()

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <ProgressBar current={step} total={totalSteps} />
      <main className="container max-w-2xl py-16">{children}</main>
    </div>
  )
}

// apps/portal/app/(onboarding)/steps/role-selection/page.tsx
export default function RoleSelectionStep() {
  const form = useForm<{ role: UserRole }>()
  const { setRole, nextStep } = useOnboardingStore()

  const onSubmit = form.handleSubmit((data) => {
    setRole(data.role)
    nextStep()
    trackEvent('onboarding:role_selected', { role: data.role })
  })

  return (
    <form onSubmit={onSubmit}>
      <h1 className="text-4xl font-bold mb-4">Welcome to Forge Factory!</h1>
      <p className="text-lg text-slate-600 mb-8">
        Let's personalize your experience. I am a...
      </p>

      <RadioGroup {...form.register('role')}>
        <RoleOption
          value="ic"
          title="Individual Contributor"
          description="I write code and want recommendations for my work"
        />
        <RoleOption
          value="lead"
          title="Team Lead / Manager"
          description="I manage a team and want visibility into code quality"
        />
        <RoleOption
          value="executive"
          title="CTO / VP Engineering"
          description="I need ROI metrics and portfolio-wide insights"
        />
      </RadioGroup>

      <Button type="submit" size="lg" className="mt-8">
        Continue →
      </Button>
    </form>
  )
}
```

**Completion Tracking**:
```typescript
// Track onboarding progress
interface OnboardingState {
  step: number
  completedAt: Date | null
  role: UserRole | null
  connectedProvider: 'github' | 'gitlab' | null
  selectedRepoId: string | null
  firstAnalysisId: string | null
}

// Persist to database for analytics
await db.userOnboarding.create({
  data: {
    userId: user.id,
    step: 5,
    completedAt: new Date(),
    timeToComplete: 480, // seconds
  },
})
```

### 2. Role-Based Dashboard

**Implementation**: Server Components + Conditional Rendering

**Approach**:
- Fetch user role on server (zero client JS overhead)
- Render role-specific components
- Lazy-load heavy widgets (charts, tables)
- Cache dashboard data for 5 minutes

**Code Structure**:
```typescript
// apps/portal/app/dashboard/page.tsx
import { getCurrentUser } from '@packages/auth'
import { ICDashboard } from './_components/ic-dashboard'
import { LeadDashboard } from './_components/lead-dashboard'
import { ExecutiveDashboard } from './_components/executive-dashboard'

export default async function DashboardPage() {
  const user = await getCurrentUser()

  switch (user.role) {
    case 'ic':
      return <ICDashboard userId={user.id} />
    case 'lead':
      return <LeadDashboard userId={user.id} />
    case 'executive':
      return <ExecutiveDashboard userId={user.id} />
  }
}

// apps/portal/app/dashboard/_components/ic-dashboard.tsx
export async function ICDashboard({ userId }: { userId: string }) {
  const [tasks, repos, trends] = await Promise.all([
    db.refactoringJob.findMany({ where: { assignedTo: userId }, take: 5 }),
    db.repository.findMany({ where: { ownerId: userId }, take: 5 }),
    db.metrics.getCodeQualityTrends(userId, { months: 6 }),
  ])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <ActiveTasksWidget tasks={tasks} />
      <RecentAnalysisWidget repos={repos} />
      <CodeQualityTrendsChart data={trends} className="lg:col-span-2" />
    </div>
  )
}
```

**Widget Library**:
```
/apps/portal/app/dashboard/_components/
  /widgets/
    active-tasks-widget.tsx
    recent-analysis-widget.tsx
    code-quality-trends-chart.tsx
    team-velocity-widget.tsx
    repository-health-widget.tsx
    team-leaderboard-widget.tsx
    business-impact-metrics.tsx
    repository-portfolio-chart.tsx
    compliance-status-widget.tsx
```

### 3. Command Palette (Power Users)

**Implementation**: cmdk library (by Vercel)

**Features**:
- **Keyboard Shortcut**: `Cmd+K` / `Ctrl+K` to open
- **Search Everything**: Repositories, analyses, settings, actions
- **Recent Items**: Show last 10 accessed items
- **Actions**: "Run analysis", "Create PR", "Invite team member"
- **Fuzzy Search**: Typo-tolerant matching

**Code**:
```typescript
// apps/portal/components/command-palette.tsx
'use client'

import { Command } from 'cmdk'
import { useRouter } from 'next/navigation'
import { useCommandPaletteStore } from '@packages/store'
import { useRepositories } from '@/hooks/use-repositories'

export function CommandPalette() {
  const router = useRouter()
  const { isOpen, close } = useCommandPaletteStore()
  const { data: repos } = useRepositories()

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        open()
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  return (
    <Command.Dialog open={isOpen} onOpenChange={close}>
      <Command.Input placeholder="Search repositories, actions..." />

      <Command.List>
        <Command.Group heading="Repositories">
          {repos?.map((repo) => (
            <Command.Item
              key={repo.id}
              onSelect={() => {
                router.push(`/repos/${repo.id}`)
                close()
              }}
            >
              {repo.name}
            </Command.Item>
          ))}
        </Command.Group>

        <Command.Group heading="Actions">
          <Command.Item onSelect={() => router.push('/repos/new')}>
            + Add Repository
          </Command.Item>
          <Command.Item onSelect={() => router.push('/analysis/new')}>
            ▶️ Run Analysis
          </Command.Item>
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  )
}
```

### 4. Contextual Empty States

**Philosophy**: Empty states are onboarding opportunities

**Examples**:

```typescript
// No repositories connected
<EmptyState
  icon={<GitBranchIcon />}
  title="No repositories yet"
  description="Connect your first repository to start analyzing code quality."
  action={
    <Button onClick={() => router.push('/repos/connect')}>
      Connect Repository
    </Button>
  }
/>

// Analysis in progress
<EmptyState
  icon={<LoaderIcon className="animate-spin" />}
  title="Analysis in progress"
  description="We're analyzing 125,000 lines of code. This usually takes 3-5 minutes."
  progress={<ProgressBar value={62} />}
/>

// No data yet
<EmptyState
  icon={<ChartIcon />}
  title="Not enough data"
  description="Run at least 3 analyses to see trends over time."
  action={<Button>Run Analysis</Button>}
/>
```

### 5. Interactive Walkthroughs

**Implementation**: Driver.js (lightweight tour library, 5KB)

**Use Cases**:
- First-time dashboard visit
- New feature announcements
- Complex UI (e.g., refactoring flow)

**Code**:
```typescript
import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'

export function startDashboardTour() {
  const driverObj = driver({
    showProgress: true,
    steps: [
      {
        element: '#ai-readiness-score',
        popover: {
          title: 'AI-Readiness Score',
          description: 'Your overall code quality score. Higher = more AI-friendly.',
          position: 'bottom',
        },
      },
      {
        element: '#recommendations',
        popover: {
          title: 'Quick Wins',
          description: 'Top 3 recommendations to improve your score quickly.',
        },
      },
      {
        element: '#command-palette-hint',
        popover: {
          title: 'Power User Tip',
          description: 'Press Cmd+K to search everything quickly.',
        },
      },
    ],
  })

  driverObj.drive()
}
```

### 6. Smart Defaults

**Principles**:
- **Progressive Disclosure**: Show 3 items, "View all" to expand
- **Pre-fill Forms**: Use Git config for user name/email
- **Auto-select**: Choose most active repo by default
- **Sensible Limits**: Default to last 30 days (not all-time)

**Examples**:
```typescript
// Default analysis config
const defaultAnalysisConfig = {
  excludePaths: ['node_modules', 'dist', '.next'],
  languages: detectLanguages(repoFiles), // auto-detect
  maxFileSize: 1_000_000, // 1MB
  complexity: {
    threshold: 10, // industry standard
  },
}

// Default dashboard filters
const defaultFilters = {
  dateRange: 'last_30_days',
  status: 'all',
  sortBy: 'updated_at',
  order: 'desc',
}
```

## Page Structure

```
/apps/portal/app/
  /(auth)/
    /login/
    /signup/
    /verify-email/

  /(onboarding)/           # Dedicated onboarding flow
    /welcome/              # Step 1: Role selection
    /connect/              # Step 2: OAuth connection
    /repositories/         # Step 3: Repository selection
    /analyzing/            # Step 4: First analysis
    /results/              # Step 5: First value moment

  /dashboard/              # Main dashboard (role-based)
    page.tsx               # Role-adaptive
    _components/
      ic-dashboard.tsx
      lead-dashboard.tsx
      executive-dashboard.tsx
      /widgets/            # Reusable widgets

  /repos/
    page.tsx               # Repository list
    /[id]/
      page.tsx             # Repository detail
      /analysis/           # Analysis results
      /settings/           # Repo settings

  /analysis/
    page.tsx               # Analysis history
    /[id]/
      page.tsx             # Analysis detail

  /refactoring/
    page.tsx               # Refactoring jobs
    /[id]/                 # Job detail

  /settings/
    /profile/
    /organization/
    /billing/
    /integrations/

  /docs/                   # Embedded documentation
```

## Consequences

### Positive

1. **Higher Activation**:
   - Progressive onboarding reduces drop-off (target 75%+ completion)
   - First value in < 10 minutes increases retention

2. **Better UX**:
   - Role-based dashboards show relevant data only
   - Command palette speeds up power users (2x faster navigation)
   - Empty states guide users (reduce support tickets)

3. **Personalization**:
   - Executives see ROI, ICs see code recommendations
   - 35% higher engagement with personalized content (industry data)

4. **Accessibility**:
   - Keyboard navigation (command palette)
   - Screen reader friendly (ARIA labels)
   - High contrast themes

5. **Mobile Support**:
   - Responsive layouts work on phones/tablets
   - 40% of users access on mobile

### Negative

1. **Complexity**:
   - 3 dashboard variants = 3x maintenance
   - Onboarding flow = 5 separate pages
   - Need to keep variants in sync

2. **Performance Risk**:
   - Dashboard widgets can be slow to load
   - Charts/tables are computationally expensive
   - Risk of layout shift (CLS)

3. **Data Fetching**:
   - Role-based dashboards need different queries
   - Cache invalidation across roles
   - Potential for over-fetching

4. **Testing Overhead**:
   - Test 3 dashboard variants
   - Test onboarding flow (5 steps)
   - E2E tests for full user journey

### Mitigations

1. **Complexity**:
   - **Action**: Shared widget library (single source of truth)
   - **Pattern**: Composition over duplication
   - **Tool**: Storybook for widget documentation

2. **Performance**:
   - **Action**: Lazy-load widgets below fold (React.lazy)
   - **Optimization**: Server Components for initial render
   - **Caching**: 5-minute cache for dashboard data
   - **Skeleton**: Loading states to prevent CLS

3. **Data Fetching**:
   - **Action**: React Query with role-specific cache keys
   - **Optimization**: Parallel fetching (Promise.all)
   - **Pagination**: Limit initial data (10 items, "Load more")

4. **Testing**:
   - **Action**: Playwright E2E tests for critical paths
   - **Coverage**: 80%+ test coverage for widgets
   - **Visual**: Chromatic for visual regression

## Metrics & Success Criteria

### Onboarding
- **Completion Rate**: 75%+ (from signup to first analysis)
- **Time to Complete**: < 10 minutes (median)
- **Drop-off**: Identify bottleneck step (< 20% drop-off per step)

### Activation
- **First Analysis**: 60%+ within 7 days
- **First PR Created**: 40%+ within 14 days
- **Return Rate**: 80%+ return within 24 hours

### Engagement
- **WAU**: 80%+ weekly active users
- **Session Duration**: 8+ minutes (industry benchmark: 5-7 min)
- **Pages per Session**: 4.5+ (indicates exploration)

### Performance
- **LCP**: < 2.5s (dashboard load)
- **INP**: < 200ms (interaction responsiveness)
- **CLS**: < 0.1 (layout stability)

### Satisfaction
- **NPS**: 50+ (product spec target)
- **Feature Adoption**: 70%+ use command palette after seeing prompt
- **Support Tickets**: < 5% related to onboarding confusion

## Implementation Plan

### Phase 1: Onboarding (Weeks 1-3)
- [ ] Build onboarding wizard (5 steps)
- [ ] Implement progress tracking (Zustand + DB)
- [ ] Add analytics (Mixpanel/PostHog)
- [ ] Create empty states
- [ ] Test funnel completion

### Phase 2: IC Dashboard (Weeks 4-5)
- [ ] Build widgets (Active Tasks, Recent Analysis, Trends)
- [ ] Implement lazy loading
- [ ] Add skeleton loaders
- [ ] Performance optimization (sub-2.5s LCP)

### Phase 3: Lead Dashboard (Weeks 6-7)
- [ ] Build team-specific widgets (Velocity, Health, Leaderboard)
- [ ] Implement aggregation queries
- [ ] Add drill-down interactions
- [ ] Test with sample data

### Phase 4: Executive Dashboard (Weeks 8-9)
- [ ] Build business metrics widgets (ROI, Compliance)
- [ ] Create portfolio visualization
- [ ] Add export functionality (PDF reports)
- [ ] Test with executive personas

### Phase 5: Enhancements (Weeks 10-11)
- [ ] Implement command palette
- [ ] Add interactive walkthroughs (Driver.js)
- [ ] Mobile responsive testing
- [ ] Accessibility audit (axe-core)

### Phase 6: Launch (Week 12)
- [ ] Beta testing with 50 users
- [ ] Collect feedback
- [ ] Iterate on pain points
- [ ] Production launch

## References

### Research Sources
- [SaaS Development Best Practices 2026](https://www.weweb.io/blog/develop-saas-application-step-by-step-guide)
- [Enterprise SaaS UX Patterns](https://www.cloudzero.com/blog/saas-architecture/)
- [Forrester: UX Impact on Conversion](https://www.forrester.com)

### Documentation
- [cmdk (Command Palette)](https://cmdk.paco.me/)
- [Driver.js (Tours)](https://driverjs.com/)
- [Next.js App Router](https://nextjs.org/docs/app)

### Internal References
- [Product Specification](/docs/product/product-spec.md)
- ADR-010: Frontend Architecture
- ADR-011: State Management
- FF-001: Repository Analyzer

## Review Date
April 2026 (3 months)

**Reviewers**: Product Manager, UX Designer, Engineering Lead

---

**Document Version**: 1.0
**Last Updated**: 2026-01-20
**Authors**: Product & Engineering Team
**Approved By**: Head of Product, CTO
