# ADR-026: Enterprise Customer Onboarding Automation

## Status
Accepted

## Context

Enterprise customers represent our highest-value segment with an average ARR of $150K per customer and target of 10-15 enterprise accounts in Year 1 ($1.5M-$2.25M total ARR). However, enterprise onboarding is significantly more complex than self-service onboarding:

### Current Challenges

1. **Manual Onboarding Overhead**:
   - Sales → CSM handoff requires 3-5 meetings
   - SSO configuration takes 2-4 weeks (manual back-and-forth)
   - SCIM provisioning requires engineering support
   - Custom contract terms negotiated manually
   - Average time to value: 45-60 days (vs 10 minutes for self-service)

2. **Inconsistent Experience**:
   - Different CSMs follow different processes
   - Missing steps lead to poor initial experience
   - No standardized health checks post-launch
   - Documentation scattered across tools (Notion, Google Docs, Salesforce)

3. **Lack of Visibility**:
   - Sales doesn't know when customer is "live"
   - CSMs can't track onboarding progress across portfolio
   - Finance doesn't know when to start billing
   - Customer doesn't have visibility into next steps

4. **Scale Limitations**:
   - Current process requires 1 CSM per 5 enterprise customers
   - Target is 1 CSM per 15-20 customers (industry benchmark)
   - Manual touchpoints don't scale beyond 15 total customers

### Enterprise Customer Journey

```
Deal Signed → Implementation → Go-Live → Expansion
    |              |              |           |
  45-60d         30-45d         90-180d    Ongoing
```

**Key Milestones**:
1. **Deal Signed** (Day 0): Contract executed, payment received
2. **Kickoff Meeting** (Day 1-3): Introductions, timeline, success criteria
3. **Technical Setup** (Day 3-14): SSO, SCIM, integrations configured
4. **Data Migration** (Day 7-21): Import existing repositories, historical data
5. **User Training** (Day 14-28): Admin training, end-user workshops
6. **Pilot Launch** (Day 21-35): Limited rollout to pilot group (10-20 users)
7. **Full Rollout** (Day 35-60): Company-wide launch
8. **First Value** (Day 45-90): First major refactoring completed
9. **Business Review** (Day 90): QBR to assess ROI and identify expansion

### Requirements

**Must Have**:
- Automated workflow orchestration (reduce manual touchpoints by 70%)
- Self-service SSO/SCIM configuration (reduce time from 2-4 weeks to 2-4 hours)
- Progress tracking dashboard (customer + CSM + internal visibility)
- Automated provisioning (user accounts, licenses, integrations)
- Customizable playbooks (different workflows for different customer sizes)
- Integration with Salesforce (sync deal status, ARR, contacts)
- Health checks at each milestone (prevent "ghost" customers)

**Should Have**:
- Pre-built email sequences (reduce CSM manual outreach)
- Task automation (auto-create onboarding tasks in Linear/Jira)
- Document generation (SOWs, training materials, QBR decks)
- Customer portal (self-service onboarding status)
- Analytics (time to value, bottleneck identification, CSM productivity)

**Could Have**:
- AI-powered recommendations (predict onboarding risks)
- Automated training video assignments
- Gamification (onboarding progress badges)
- Integration with customer's Slack (proactive updates)

## Decision

We will implement an **Enterprise Customer Onboarding Automation System** with the following components:

### 1. Onboarding Workflow Engine
### 2. Self-Service Configuration Wizard
### 3. Progress Tracking Dashboard
### 4. Automated Provisioning Pipeline
### 5. Customer Success Playbooks
### 6. Integration Ecosystem
### 7. Analytics & Reporting

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                  Enterprise Onboarding System                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │  Salesforce  │───▶│  Onboarding  │───▶│   Customer   │      │
│  │    (CRM)     │    │    Engine    │    │    Portal    │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│         │                    │                    │              │
│         │                    ▼                    │              │
│         │            ┌──────────────┐            │              │
│         │            │ Workflow DB  │            │              │
│         │            │  (Postgres)  │            │              │
│         │            └──────────────┘            │              │
│         │                    │                    │              │
│         ▼                    ▼                    ▼              │
│  ┌──────────────────────────────────────────────────────┐      │
│  │              Automation Services Layer                │      │
│  ├──────────────────────────────────────────────────────┤      │
│  │ • SSO Config   • SCIM Sync    • User Provisioning   │      │
│  │ • Email Send   • Task Create  • License Assignment  │      │
│  │ • Data Import  • Health Check • Training Scheduler  │      │
│  └──────────────────────────────────────────────────────┘      │
│         │                    │                    │              │
│         ▼                    ▼                    ▼              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │ CSM Dashboard│    │   Analytics  │    │   Customer   │      │
│  │   (Admin)    │    │   Reports    │    │  Slack Bot   │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 1. Onboarding Workflow Engine

**Implementation**: Temporal Workflow Engine (durable, fault-tolerant)

**Workflow Structure**:
```typescript
// Enterprise onboarding workflow (60-day timeline)
interface EnterpriseOnboardingWorkflow {
  // Inputs
  organizationId: string
  contractId: string
  tier: 'startup' | 'growth' | 'enterprise'
  expectedUsers: number
  csmEmail: string
  customerContacts: {
    executive: string    // Decision maker
    champion: string     // Internal advocate
    technical: string    // IT/security lead
    endUsers: string[]   // Pilot group
  }

  // Workflow stages
  stages: {
    1: 'kickoff'           // Days 1-3
    2: 'technical_setup'   // Days 3-14
    3: 'data_migration'    // Days 7-21
    4: 'training'          // Days 14-28
    5: 'pilot'             // Days 21-35
    6: 'rollout'           // Days 35-60
    7: 'first_value'       // Days 45-90
    8: 'qbr'               // Day 90
  }

  // Current state
  currentStage: number
  completedMilestones: string[]
  blockedTasks: string[]
  healthScore: number  // 0-100
  riskLevel: 'low' | 'medium' | 'high'
}
```

**Workflow Activities** (executed by Temporal workers):
```typescript
// Stage 1: Kickoff (Days 1-3)
async function kickoffStage(workflow: EnterpriseOnboardingWorkflow) {
  // Auto-execute within 24 hours of contract signing
  await activities.createWelcomeEmail({
    to: workflow.customerContacts.executive,
    template: 'enterprise-welcome',
    variables: {
      organizationName: workflow.organizationId,
      csmName: workflow.csmEmail,
      kickoffMeetingLink: '...',
    },
  })

  await activities.scheduleKickoffMeeting({
    attendees: [
      workflow.csmEmail,
      workflow.customerContacts.executive,
      workflow.customerContacts.champion,
      workflow.customerContacts.technical,
    ],
    duration: 60, // minutes
    agenda: 'Welcome, timeline, success criteria, Q&A',
    withinDays: 3,
  })

  await activities.createOnboardingTasks({
    assignee: workflow.csmEmail,
    tasks: [
      { title: 'Review contract terms', dueInDays: 1 },
      { title: 'Prepare kickoff deck', dueInDays: 2 },
      { title: 'Send pre-meeting questionnaire', dueInDays: 1 },
    ],
  })

  await activities.createCustomerPortalAccount({
    organizationId: workflow.organizationId,
    primaryContact: workflow.customerContacts.executive,
  })

  // Wait for kickoff meeting completion (human signal)
  await waitForSignal('kickoff_meeting_completed')

  return { stage: 'kickoff', status: 'completed' }
}

// Stage 2: Technical Setup (Days 3-14)
async function technicalSetupStage(workflow: EnterpriseOnboardingWorkflow) {
  // SSO Configuration
  await activities.sendSSOSetupLink({
    to: workflow.customerContacts.technical,
    wizard: 'https://admin.forge.app/onboarding/sso',
  })

  // Wait for SSO configuration (or 7-day timeout)
  const ssoConfigured = await waitForSignalOrTimeout(
    'sso_configured',
    { days: 7 }
  )

  if (!ssoConfigured) {
    await activities.escalateToCSM({
      issue: 'SSO configuration blocked',
      action: 'Schedule technical call with IT team',
    })
  }

  // SCIM Provisioning
  await activities.sendSCIMSetupGuide({
    to: workflow.customerContacts.technical,
    includeEndpoint: true,
    includeBearerToken: true,
  })

  await waitForSignalOrTimeout('scim_configured', { days: 7 })

  // Integration Setup
  await activities.offerIntegrations({
    availableIntegrations: ['github', 'gitlab', 'jira', 'slack'],
    recommendedFor: workflow.tier,
  })

  // Network allowlisting (if required)
  if (workflow.tier === 'enterprise') {
    await activities.sendNetworkRequirements({
      ipRanges: ['52.12.34.0/24'],
      domains: ['*.forge.app', 'api.forge.app'],
    })
  }

  return { stage: 'technical_setup', status: 'completed' }
}

// Stage 3: Data Migration (Days 7-21)
async function dataMigrationStage(workflow: EnterpriseOnboardingWorkflow) {
  // Discover repositories
  await activities.triggerRepositoryDiscovery({
    organizationId: workflow.organizationId,
    vcsProvider: 'github', // from integration
    importAll: false, // require manual selection
  })

  // Wait for repository selection
  await waitForSignal('repositories_selected')

  // Import historical data (if upgrading from competitor)
  if (workflow.migrationSource) {
    await activities.scheduleDataImport({
      source: workflow.migrationSource, // e.g., 'sonarqube'
      mapping: '...', // field mapping
      validation: true,
    })

    await waitForSignal('migration_validated')
  }

  // Run initial analyses
  await activities.triggerBulkAnalysis({
    repositoryIds: workflow.selectedRepositories,
    priority: 'high',
    notifyOnComplete: workflow.customerContacts.technical,
  })

  return { stage: 'data_migration', status: 'completed' }
}

// Stage 4: Training (Days 14-28)
async function trainingStage(workflow: EnterpriseOnboardingWorkflow) {
  // Admin training
  await activities.scheduleTrainingSession({
    type: 'admin',
    attendees: [
      workflow.customerContacts.technical,
      workflow.customerContacts.champion,
    ],
    duration: 90,
    topics: [
      'User management',
      'SSO/SCIM configuration',
      'Billing & usage',
      'Security & compliance',
    ],
  })

  await waitForSignal('admin_training_completed')

  // End-user training
  await activities.scheduleTrainingSession({
    type: 'end_user',
    attendees: workflow.customerContacts.endUsers,
    duration: 60,
    topics: [
      'Navigating the dashboard',
      'Running analyses',
      'Understanding AI-Readiness Score',
      'Creating refactoring jobs',
    ],
  })

  // Assign self-paced learning
  await activities.assignTrainingModules({
    users: workflow.customerContacts.endUsers,
    modules: [
      { id: 'intro-to-forge', duration: 15 },
      { id: 'first-analysis', duration: 20 },
      { id: 'ai-readiness-explained', duration: 25 },
    ],
  })

  // Track completion
  await waitForCondition(() => {
    return activities.getTrainingCompletion(workflow.organizationId) >= 0.8
  })

  return { stage: 'training', status: 'completed' }
}

// Stage 5: Pilot Launch (Days 21-35)
async function pilotStage(workflow: EnterpriseOnboardingWorkflow) {
  // Create pilot group
  await activities.createUserGroup({
    name: 'Pilot Group',
    userEmails: workflow.customerContacts.endUsers,
    features: ['all'], // full access
  })

  // Set pilot success criteria
  await activities.definePilotGoals({
    criteria: [
      { metric: 'active_users', target: 0.8, threshold: 'at_least' },
      { metric: 'analyses_run', target: 50, threshold: 'at_least' },
      { metric: 'nps', target: 7, threshold: 'at_least' },
    ],
    duration: 14, // days
  })

  // Send pilot launch announcement
  await activities.sendPilotLaunchEmail({
    to: workflow.customerContacts.endUsers,
    cc: workflow.customerContacts.champion,
    includeGettingStartedGuide: true,
  })

  // Daily health checks during pilot
  for (let day = 1; day <= 14; day++) {
    await sleep({ days: 1 })

    const health = await activities.checkPilotHealth({
      organizationId: workflow.organizationId,
      day,
    })

    if (health.score < 50) {
      await activities.escalateToCSM({
        issue: 'Pilot health score below threshold',
        currentScore: health.score,
        blockers: health.blockers,
      })
    }
  }

  // Pilot retrospective
  await activities.scheduleRetrospective({
    attendees: [
      workflow.csmEmail,
      workflow.customerContacts.champion,
      ...workflow.customerContacts.endUsers.slice(0, 5), // sample
    ],
    agenda: 'What worked, what didn\'t, rollout readiness',
  })

  await waitForSignal('pilot_retrospective_completed')

  return { stage: 'pilot', status: 'completed' }
}

// Stage 6: Full Rollout (Days 35-60)
async function rolloutStage(workflow: EnterpriseOnboardingWorkflow) {
  // Provision all users
  await activities.bulkProvisionUsers({
    organizationId: workflow.organizationId,
    source: workflow.scimEnabled ? 'scim' : 'csv_upload',
    defaultRole: 'member',
    sendInvitations: true,
  })

  // Send rollout announcement
  await activities.sendRolloutAnnouncement({
    to: 'all_users',
    from: workflow.customerContacts.executive,
    template: 'company_wide_rollout',
  })

  // Monitor adoption
  for (let week = 1; week <= 4; week++) {
    await sleep({ days: 7 })

    const adoption = await activities.measureAdoption({
      organizationId: workflow.organizationId,
      week,
    })

    // Adoption targets by week
    const targets = [0.3, 0.5, 0.7, 0.8] // 30%, 50%, 70%, 80%

    if (adoption.activeUserRate < targets[week - 1]) {
      await activities.createAdoptionCampaign({
        targetSegment: 'inactive_users',
        tactics: ['email_reminder', 'manager_outreach', 'training_offer'],
      })
    }
  }

  return { stage: 'rollout', status: 'completed' }
}

// Stage 7: First Value (Days 45-90)
async function firstValueStage(workflow: EnterpriseOnboardingWorkflow) {
  // Wait for first major refactoring completion
  await waitForCondition(() => {
    return activities.hasCompletedRefactoring(workflow.organizationId)
  })

  // Capture success story
  await activities.requestSuccessStory({
    from: workflow.customerContacts.champion,
    format: 'case_study',
    incentive: '$500_amazon_gift_card',
  })

  // Measure initial ROI
  const roi = await activities.calculateROI({
    organizationId: workflow.organizationId,
    timeframe: 90, // days
  })

  if (roi.multiple >= 5) {
    await activities.markAsReferenceable({
      organizationId: workflow.organizationId,
      roiMultiple: roi.multiple,
    })
  }

  return { stage: 'first_value', status: 'completed', roi }
}

// Stage 8: QBR (Day 90)
async function qbrStage(workflow: EnterpriseOnboardingWorkflow) {
  // Auto-generate QBR deck
  const qbrDeck = await activities.generateQBRDeck({
    organizationId: workflow.organizationId,
    sections: [
      'executive_summary',
      'usage_statistics',
      'roi_analysis',
      'adoption_trends',
      'success_stories',
      'roadmap_preview',
      'expansion_opportunities',
    ],
  })

  // Schedule QBR
  await activities.scheduleQBR({
    attendees: [
      workflow.csmEmail,
      workflow.customerContacts.executive,
      workflow.customerContacts.champion,
    ],
    duration: 60,
    deck: qbrDeck.url,
  })

  await waitForSignal('qbr_completed')

  // Onboarding complete!
  await activities.markOnboardingComplete({
    organizationId: workflow.organizationId,
    completedInDays: workflow.elapsedDays,
    healthScore: workflow.healthScore,
  })

  // Transition to steady-state CS motion
  await activities.createOngoingCSTasks({
    cadence: 'monthly',
    tasks: ['usage_review', 'health_check', 'roadmap_update'],
  })

  return { stage: 'qbr', status: 'completed', onboardingComplete: true }
}
```

### 2. Self-Service Configuration Wizard

**Customer Portal UI** (`/apps/customer-portal/onboarding`):

```typescript
// SSO Self-Service Wizard
export default function SSOWizardPage() {
  const [step, setStep] = useState(1)
  const form = useForm<SSOConfiguration>()

  return (
    <WizardLayout currentStep={step} totalSteps={5}>
      {step === 1 && (
        <ProviderSelection
          options={['saml', 'oidc', 'azure_ad', 'okta', 'google']}
          onSelect={(provider) => {
            form.setValue('provider', provider)
            setStep(2)
          }}
        />
      )}

      {step === 2 && (
        <ProviderConfiguration
          provider={form.watch('provider')}
          fields={{
            saml: ['issuer_url', 'sso_url', 'certificate'],
            oidc: ['client_id', 'client_secret', 'discovery_url'],
            azure_ad: ['tenant_id', 'client_id', 'client_secret'],
          }}
          onSubmit={() => setStep(3)}
        />
      )}

      {step === 3 && (
        <AttributeMapping
          defaultMapping={{
            email: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
            firstName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname',
            lastName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname',
          }}
          onSubmit={() => setStep(4)}
        />
      )}

      {step === 4 && (
        <TestConnection
          onTestSuccess={async () => {
            await saveConfiguration(form.getValues())
            setStep(5)
          }}
          onTestFailure={(error) => {
            toast.error(`SSO test failed: ${error.message}`)
          }}
        />
      )}

      {step === 5 && (
        <EnableSSO
          testMode={true} // Allow password fallback initially
          onEnable={async () => {
            await enableSSO({ testMode: true })
            await notifyCSM({ event: 'sso_configured' })
            router.push('/onboarding/scim')
          }}
        />
      )}
    </WizardLayout>
  )
}
```

**Configuration API**:
```typescript
// apps/api/src/modules/onboarding/sso-config.service.ts
export class SSOConfigService {
  async validateConfiguration(config: SSOConfiguration): Promise<ValidationResult> {
    switch (config.provider) {
      case 'saml':
        return this.validateSAML(config)
      case 'oidc':
        return this.validateOIDC(config)
      case 'azure_ad':
        return this.validateAzureAD(config)
    }
  }

  async testConnection(config: SSOConfiguration): Promise<TestResult> {
    // Attempt test authentication
    const testUser = { email: 'test@example.com' }

    try {
      const result = await this.ssoProvider.authenticate(testUser, config)

      return {
        success: true,
        userAttributes: result.attributes,
        warnings: this.detectWarnings(result),
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        troubleshooting: this.getTroubleshootingSteps(error),
      }
    }
  }

  async enableSSO(organizationId: string, testMode: boolean): Promise<void> {
    await this.db.ssoConfiguration.update({
      where: { organizationId },
      data: {
        enabled: true,
        testMode, // If true, allow password fallback
        enabledAt: new Date(),
      },
    })

    // Signal to workflow
    await this.temporal.signal('sso_configured', { organizationId })

    // Audit log
    await this.audit.log({
      event: 'sso.enabled',
      organizationId,
      metadata: { testMode },
    })
  }
}
```

### 3. Progress Tracking Dashboard

**CSM Dashboard** (`/apps/admin/customers/[id]/onboarding`):

```typescript
export default async function CustomerOnboardingPage({
  params
}: {
  params: { id: string }
}) {
  const workflow = await getOnboardingWorkflow(params.id)
  const timeline = await getOnboardingTimeline(params.id)
  const health = await getOnboardingHealth(params.id)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{workflow.organizationName}</h1>
          <p className="text-slate-600">
            Onboarding Day {workflow.elapsedDays} of 90
          </p>
        </div>

        <HealthScoreBadge score={health.score} />
      </div>

      {/* Progress Timeline */}
      <OnboardingTimeline
        stages={[
          { id: 'kickoff', label: 'Kickoff', days: '1-3', status: 'completed' },
          { id: 'technical', label: 'Technical Setup', days: '3-14', status: 'in_progress', progress: 0.6 },
          { id: 'migration', label: 'Data Migration', days: '7-21', status: 'pending' },
          { id: 'training', label: 'Training', days: '14-28', status: 'pending' },
          { id: 'pilot', label: 'Pilot', days: '21-35', status: 'pending' },
          { id: 'rollout', label: 'Rollout', days: '35-60', status: 'pending' },
          { id: 'first_value', label: 'First Value', days: '45-90', status: 'pending' },
          { id: 'qbr', label: 'QBR', days: '90', status: 'pending' },
        ]}
        current={workflow.currentStage}
      />

      {/* Blockers (if any) */}
      {workflow.blockedTasks.length > 0 && (
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{workflow.blockedTasks.length} Blockers</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4 mt-2">
              {workflow.blockedTasks.map((task) => (
                <li key={task.id}>{task.description}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Current Stage Details */}
      <Card>
        <CardHeader>
          <CardTitle>Current Stage: Technical Setup</CardTitle>
        </CardHeader>
        <CardContent>
          <TaskList
            tasks={[
              { id: 1, title: 'SSO Configuration', status: 'completed', completedAt: '2026-01-18' },
              { id: 2, title: 'SCIM Provisioning', status: 'in_progress', assignee: 'customer-it-team' },
              { id: 3, title: 'GitHub Integration', status: 'pending' },
              { id: 4, title: 'Network Allowlisting', status: 'blocked', blocker: 'Waiting on security approval' },
            ]}
          />
        </CardContent>
      </Card>

      {/* Upcoming Milestones */}
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Milestones</CardTitle>
        </CardHeader>
        <CardContent>
          <MilestoneList
            milestones={[
              { date: '2026-01-25', title: 'Data migration kickoff', owner: 'CSM' },
              { date: '2026-02-01', title: 'Admin training session', owner: 'CSM' },
              { date: '2026-02-08', title: 'End-user training', owner: 'CSM' },
              { date: '2026-02-15', title: 'Pilot launch', owner: 'Customer Champion' },
            ]}
          />
        </CardContent>
      </Card>

      {/* Health Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          title="SSO Adoption"
          value="87%"
          trend="up"
          description="Users logging in via SSO"
        />
        <MetricCard
          title="Training Completion"
          value="64%"
          trend="up"
          description="Users completed onboarding modules"
        />
        <MetricCard
          title="Active Users"
          value="23/50"
          trend="neutral"
          description="Users active in last 7 days"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button onClick={() => sendUpdate()} variant="outline">
          Send Update to Customer
        </Button>
        <Button onClick={() => scheduleCheckin()} variant="outline">
          Schedule Check-in
        </Button>
        <Button onClick={() => escalate()} variant="destructive">
          Escalate to Leadership
        </Button>
      </div>
    </div>
  )
}
```

**Customer-Facing Portal**:
```typescript
// apps/customer-portal/onboarding/status
export default function OnboardingStatusPage() {
  const { organization } = useAuth()
  const workflow = useOnboardingStatus(organization.id)

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-4xl font-bold mb-2">Welcome to Forge Factory!</h1>
      <p className="text-lg text-slate-600 mb-8">
        You're {workflow.percentComplete}% through onboarding. Here's what's next:
      </p>

      <ProgressBar value={workflow.percentComplete} className="mb-12" />

      {/* Next Action */}
      <Card className="mb-8 border-2 border-blue-500">
        <CardHeader>
          <CardTitle>⚡ Next Step: {workflow.nextAction.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4">{workflow.nextAction.description}</p>
          <Button size="lg" onClick={() => router.push(workflow.nextAction.url)}>
            {workflow.nextAction.cta}
          </Button>
        </CardContent>
      </Card>

      {/* Checklist */}
      <h2 className="text-2xl font-bold mb-4">Onboarding Checklist</h2>
      <div className="space-y-2">
        {workflow.checklist.map((item) => (
          <ChecklistItem
            key={item.id}
            title={item.title}
            status={item.status}
            dueDate={item.dueDate}
            onClick={() => router.push(item.url)}
          />
        ))}
      </div>

      {/* Contact CSM */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Need Help?</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4">
            Your Customer Success Manager is here to help:
          </p>
          <div className="flex items-center gap-4">
            <Avatar src={workflow.csm.avatar} size="lg" />
            <div>
              <p className="font-semibold">{workflow.csm.name}</p>
              <p className="text-sm text-slate-600">{workflow.csm.email}</p>
              <Button variant="link" onClick={() => scheduleCall(workflow.csm)}>
                Schedule a call →
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

### 4. Automated Provisioning Pipeline

**User Provisioning Service**:
```typescript
// apps/api/src/modules/onboarding/provisioning.service.ts
export class ProvisioningService {
  async provisionEnterpriseCustomer(params: {
    organizationId: string
    contractId: string
    licenses: number
    features: string[]
  }): Promise<ProvisioningResult> {
    const tasks = []

    // 1. Create organization
    tasks.push(
      this.createOrganization({
        id: params.organizationId,
        tier: 'enterprise',
        status: 'onboarding',
      })
    )

    // 2. Allocate licenses
    tasks.push(
      this.allocateLicenses({
        organizationId: params.organizationId,
        count: params.licenses,
        type: 'named', // vs 'concurrent'
      })
    )

    // 3. Enable features
    tasks.push(
      this.enableFeatures({
        organizationId: params.organizationId,
        features: params.features,
      })
    )

    // 4. Set quotas
    tasks.push(
      this.setQuotas({
        organizationId: params.organizationId,
        quotas: {
          repositories: 1000,
          linesOfCode: 50_000_000,
          apiCallsPerMonth: 1_000_000,
          storageGB: 500,
        },
      })
    )

    // 5. Configure defaults
    tasks.push(
      this.configureDefaults({
        organizationId: params.organizationId,
        defaults: {
          dataRetention: 365, // days
          auditLogRetention: 2555, // 7 years for compliance
          backupFrequency: 'daily',
          region: 'us-east-1',
        },
      })
    )

    // 6. Create admin user
    tasks.push(
      this.createAdminUser({
        organizationId: params.organizationId,
        email: params.adminEmail,
        role: 'owner',
        sendWelcomeEmail: true,
      })
    )

    // 7. Initialize integrations
    tasks.push(
      this.initializeIntegrations({
        organizationId: params.organizationId,
        integrations: ['github', 'slack', 'jira'],
        status: 'available', // not configured yet
      })
    )

    // Execute all in parallel
    await Promise.all(tasks)

    // Notify CSM
    await this.notifyCSM({
      event: 'customer_provisioned',
      organizationId: params.organizationId,
    })

    return { success: true, organizationId: params.organizationId }
  }
}
```

### 5. Customer Success Playbooks

**Playbook Structure**:
```typescript
interface OnboardingPlaybook {
  id: string
  name: string
  applicableFor: {
    tier: ('startup' | 'growth' | 'enterprise')[]
    userCount: { min: number; max: number }
    industry?: string[]
  }

  stages: OnboardingStage[]

  automations: {
    emails: EmailTemplate[]
    tasks: TaskTemplate[]
    milestones: MilestoneTemplate[]
  }

  successCriteria: {
    timeToValue: number // days
    adoptionRate: number // 0-1
    healthScore: number // 0-100
  }

  customizations: {
    allowSkipStages: boolean
    allowReordering: boolean
    customFields: CustomField[]
  }
}
```

**Example Playbooks**:

```typescript
// Playbook 1: Standard Enterprise (100-500 users)
const standardEnterprisePlaybook: OnboardingPlaybook = {
  id: 'standard-enterprise',
  name: 'Standard Enterprise Onboarding',
  applicableFor: {
    tier: ['enterprise'],
    userCount: { min: 100, max: 500 },
  },

  stages: [
    {
      id: 'kickoff',
      duration: 3,
      tasks: [
        { title: 'Send welcome email', auto: true, owner: 'system' },
        { title: 'Schedule kickoff call', auto: false, owner: 'csm' },
        { title: 'Send pre-call questionnaire', auto: true, owner: 'system' },
      ],
      completionCriteria: { type: 'signal', name: 'kickoff_meeting_completed' },
    },
    // ... other stages
  ],

  successCriteria: {
    timeToValue: 60, // days
    adoptionRate: 0.8,
    healthScore: 75,
  },
}

// Playbook 2: Fast-Track (already familiar with similar tools)
const fastTrackPlaybook: OnboardingPlaybook = {
  id: 'fast-track',
  name: 'Fast-Track Onboarding',
  applicableFor: {
    tier: ['enterprise', 'growth'],
    userCount: { min: 50, max: 200 },
  },

  stages: [
    {
      id: 'technical_setup',
      duration: 7, // compressed
      tasks: [
        { title: 'Self-service SSO setup', auto: true, owner: 'customer' },
        { title: 'Async training videos', auto: true, owner: 'system' },
      ],
    },
  ],

  successCriteria: {
    timeToValue: 21, // 3 weeks
    adoptionRate: 0.9,
    healthScore: 80,
  },
}
```

### 6. Integration Ecosystem

**Salesforce Integration**:
```typescript
// Sync Salesforce Opportunity → Onboarding Workflow
export class SalesforceIntegration {
  async onOpportunityClosed(opportunity: SalesforceOpportunity) {
    if (opportunity.stage === 'Closed Won') {
      // Create onboarding workflow
      const workflow = await this.temporal.start('enterprise-onboarding', {
        organizationId: opportunity.accountId,
        contractId: opportunity.id,
        tier: opportunity.tier,
        expectedUsers: opportunity.seats,
        csmEmail: opportunity.csmEmail,
        customerContacts: {
          executive: opportunity.decisionMaker,
          champion: opportunity.champion,
          technical: opportunity.technicalContact,
        },
      })

      // Update Salesforce with workflow ID
      await this.salesforce.updateOpportunity(opportunity.id, {
        onboardingWorkflowId: workflow.id,
        onboardingStatus: 'In Progress',
        onboardingStartDate: new Date(),
      })
    }
  }

  // Sync workflow progress back to Salesforce
  async syncWorkflowProgress(workflowId: string) {
    const workflow = await this.temporal.getWorkflow(workflowId)

    await this.salesforce.updateOpportunity(workflow.contractId, {
      onboardingStatus: this.mapStatus(workflow.currentStage),
      onboardingHealthScore: workflow.healthScore,
      onboardingPercentComplete: workflow.percentComplete,
      onboardingBlockers: workflow.blockedTasks.map(t => t.description).join('; '),
    })
  }
}
```

**Slack Integration**:
```typescript
// Create dedicated Slack channel for each enterprise customer
export class SlackIntegration {
  async createCustomerChannel(organizationId: string) {
    const org = await this.db.organization.findUnique({ where: { id: organizationId } })

    const channel = await this.slack.createChannel({
      name: `customer-${org.slug}`,
      isPrivate: true,
      description: `Enterprise customer: ${org.name}`,
    })

    // Invite CSM + customer champion
    await this.slack.inviteUsers(channel.id, [
      org.csmEmail,
      org.championEmail,
    ])

    // Send welcome message
    await this.slack.postMessage(channel.id, {
      text: `Welcome to your dedicated Forge Factory support channel! Your CSM ${org.csmEmail} will be your main point of contact.`,
    })

    // Post onboarding timeline
    await this.slack.postMessage(channel.id, {
      blocks: this.buildTimelineBlocks(organizationId),
    })

    return channel
  }

  // Post updates on milestone completion
  async notifyMilestoneComplete(milestone: OnboardingMilestone) {
    await this.slack.postMessage(milestone.slackChannelId, {
      text: `✅ Milestone completed: ${milestone.title}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${milestone.title}* has been completed! 🎉\n\nNext up: ${milestone.nextMilestone}`,
          },
        },
      ],
    })
  }
}
```

### 7. Analytics & Reporting

**Onboarding Analytics Dashboard**:
```typescript
interface OnboardingMetrics {
  // Aggregate metrics
  activeOnboardings: number
  avgTimeToValue: number // days
  avgHealthScore: number
  completionRate: number // % that complete within 90 days

  // By stage
  stageMetrics: {
    stage: string
    avgDuration: number
    dropoffRate: number
    commonBlockers: string[]
  }[]

  // By CSM
  csmMetrics: {
    csmEmail: string
    activeCustomers: number
    avgHealthScore: number
    avgTimeToValue: number
  }[]

  // Trends
  weeklyStarts: number
  weeklyCompletions: number
  weeklyEscalations: number
}
```

**Example Queries**:
```typescript
// Identify bottlenecks
async function findBottlenecks(): Promise<Bottleneck[]> {
  const stageStats = await db.$queryRaw`
    SELECT
      current_stage,
      AVG(EXTRACT(DAY FROM NOW() - updated_at)) as avg_days_stuck,
      COUNT(*) as stuck_count
    FROM onboarding_workflows
    WHERE status = 'in_progress'
      AND updated_at < NOW() - INTERVAL '7 days'
    GROUP BY current_stage
    ORDER BY avg_days_stuck DESC
  `

  return stageStats.filter(s => s.avg_days_stuck > 7)
}

// Predict at-risk onboardings
async function predictAtRisk(): Promise<string[]> {
  const workflows = await db.onboardingWorkflow.findMany({
    where: {
      status: 'in_progress',
      OR: [
        { healthScore: { lt: 50 } },
        { elapsedDays: { gt: 60 }, percentComplete: { lt: 0.7 } },
        { blockedTasks: { length: { gte: 3 } } },
      ],
    },
  })

  return workflows.map(w => w.organizationId)
}
```

## Data Model

```prisma
model OnboardingWorkflow {
  id                String   @id @default(cuid())
  organizationId    String   @unique
  organization      Organization @relation(fields: [organizationId], references: [id])

  contractId        String
  tier              Tier
  expectedUsers     Int

  // CSM assignment
  csmEmail          String
  csmId             String
  csm               User     @relation(fields: [csmId], references: [id])

  // Customer contacts
  executiveEmail    String
  championEmail     String
  technicalEmail    String
  endUserEmails     String[] // JSON array

  // Workflow state
  currentStage      Int      @default(1)
  percentComplete   Float    @default(0)
  healthScore       Int      @default(0)
  riskLevel         RiskLevel @default(LOW)

  status            OnboardingStatus @default(IN_PROGRESS)
  startedAt         DateTime @default(now())
  completedAt       DateTime?
  elapsedDays       Int      @default(0)

  // Tasks
  completedMilestones String[] // JSON array
  blockedTasks       Json[]   // Array of { id, description, blocker, createdAt }

  // Metrics
  ssoConfiguredAt    DateTime?
  scimConfiguredAt   DateTime?
  firstAnalysisAt    DateTime?
  pilotLaunchedAt    DateTime?
  fullRolloutAt      DateTime?
  firstValueAt       DateTime?
  qbrCompletedAt     DateTime?

  // Integrations
  slackChannelId     String?
  salesforceOppId    String?

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@index([status, healthScore])
  @@index([csmId, status])
}

enum OnboardingStatus {
  NOT_STARTED
  IN_PROGRESS
  BLOCKED
  COMPLETED
  ABANDONED
}

enum RiskLevel {
  LOW
  MEDIUM
  HIGH
}

model OnboardingMilestone {
  id                String   @id @default(cuid())
  workflowId        String
  workflow          OnboardingWorkflow @relation(fields: [workflowId], references: [id])

  stage             String
  title             String
  description       String

  dueDate           DateTime
  completedAt       DateTime?
  status            MilestoneStatus @default(PENDING)

  owner             String   // 'csm' | 'customer' | 'system'
  assigneeEmail     String?

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@index([workflowId, status])
}

enum MilestoneStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
  BLOCKED
  SKIPPED
}

model OnboardingPlaybook {
  id                String   @id @default(cuid())
  name              String
  description       String

  applicableTiers   Tier[]
  minUsers          Int
  maxUsers          Int
  industries        String[] // optional filter

  stages            Json     // Array of stage definitions
  automations       Json     // Email/task templates

  timeToValueTarget Int      // days
  adoptionTarget    Float    // 0-1
  healthScoreTarget Int      // 0-100

  isActive          Boolean  @default(true)
  version           Int      @default(1)

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}
```

## Consequences

### Positive

1. **Reduced CSM Workload**:
   - 70% fewer manual touchpoints (automated emails, task creation, reminders)
   - CSMs can manage 15-20 enterprise customers (up from 5)
   - CSMs focus on high-touch relationship building, not admin work

2. **Faster Time to Value**:
   - Self-service SSO/SCIM reduces setup from 2-4 weeks to 2-4 hours
   - Target 60-day onboarding (down from 90+ days currently)
   - 25% faster to first refactoring completion

3. **Higher Completion Rate**:
   - Automated follow-ups reduce drop-off by 40%
   - Clear progress visibility keeps customers engaged
   - Proactive blocker detection prevents abandonment

4. **Better Customer Experience**:
   - Customers have self-service portal (know what to expect)
   - Consistent experience regardless of CSM
   - Transparent timeline reduces anxiety

5. **Data-Driven Optimization**:
   - Identify bottlenecks (which stages take longest?)
   - Measure playbook effectiveness (A/B test workflows)
   - Predict at-risk customers (intervene proactively)

6. **Scalable Operations**:
   - Onboard 50+ enterprise customers/year without expanding CS team
   - Playbooks enable consistent quality at scale
   - New CSMs can ramp faster (documented processes)

### Negative

1. **Implementation Complexity**:
   - Temporal workflow engine requires new infrastructure
   - Salesforce/Slack integrations require maintenance
   - Self-service wizards need extensive testing

2. **Over-Automation Risk**:
   - Some customers prefer high-touch onboarding
   - Automated emails may feel impersonal
   - Edge cases may not fit standard playbooks

3. **Technical Debt**:
   - Multiple integrations increase failure points
   - Workflow definitions become code (hard to change)
   - Schema migrations affect running workflows

4. **Change Management**:
   - CSMs must adapt to new tools/processes
   - Customers may resist self-service (want hand-holding)
   - Sales team must set proper expectations

### Mitigations

1. **Complexity**:
   - **Action**: Start with MVP (1 playbook, basic automation)
   - **Pattern**: Iterate based on feedback
   - **Tool**: Temporal Cloud (managed service)

2. **Over-Automation**:
   - **Action**: Allow CSMs to override/pause automation
   - **Pattern**: High-touch mode for strategic accounts
   - **Tool**: Feature flag for automation level

3. **Technical Debt**:
   - **Action**: Version playbooks (backward compatibility)
   - **Pattern**: Canary deployments for workflow changes
   - **Tool**: Comprehensive integration tests

4. **Change Management**:
   - **Action**: CSM training program (2-week ramp)
   - **Pattern**: Pilot with 3 customers before full rollout
   - **Tool**: Runbooks and playbooks documentation

## Metrics & Success Criteria

### Onboarding Efficiency
- **Time to Value**: < 60 days (from contract signing to first value)
- **Completion Rate**: 90%+ (complete onboarding within 90 days)
- **SSO Setup Time**: < 4 hours (customer self-service)
- **CSM Hours per Onboarding**: < 20 hours (down from 60+ hours)

### Customer Success
- **Health Score at Day 90**: > 75 (0-100 scale)
- **Adoption Rate**: 80%+ of provisioned users active within 60 days
- **Training Completion**: 80%+ complete required modules
- **First Refactoring**: 70%+ complete major refactoring within 90 days

### CSM Productivity
- **Customers per CSM**: 15-20 (up from 5)
- **Response Time**: < 4 hours for at-risk customers
- **Proactive Interventions**: 100% of at-risk customers contacted within 24 hours

### System Performance
- **Workflow Reliability**: 99.9%+ successful workflow executions
- **Integration Uptime**: 99.5%+ (Salesforce, Slack, email)
- **Automation Success Rate**: 95%+ automated tasks complete without errors

## Implementation Plan

### Phase 1: Foundation (Weeks 1-4)
- [ ] Set up Temporal workflow engine
- [ ] Build workflow data models (Prisma schema)
- [ ] Create 1 standard playbook (enterprise 100-500 users)
- [ ] Build basic CSM dashboard (view workflow status)

### Phase 2: Self-Service (Weeks 5-8)
- [ ] Build SSO configuration wizard (customer portal)
- [ ] Build SCIM setup guide (customer portal)
- [ ] Implement configuration validation APIs
- [ ] Add test connection functionality

### Phase 3: Automation (Weeks 9-12)
- [ ] Implement email automation (welcome, reminders, milestone)
- [ ] Implement task creation (Linear/Jira integration)
- [ ] Build health check automations
- [ ] Add Slack notifications

### Phase 4: Integrations (Weeks 13-16)
- [ ] Salesforce bidirectional sync
- [ ] Slack channel automation
- [ ] Customer portal onboarding status page
- [ ] Analytics dashboard for leadership

### Phase 5: Expansion (Weeks 17-20)
- [ ] Create 2 additional playbooks (fast-track, strategic)
- [ ] Build playbook customization UI
- [ ] Add AI-powered risk prediction
- [ ] Implement A/B testing for playbooks

### Phase 6: Launch (Week 21)
- [ ] Pilot with 3 new enterprise customers
- [ ] CSM training program
- [ ] Documentation and runbooks
- [ ] Production launch

## References

### Industry Research
- [Gainsight: Onboarding Best Practices](https://www.gainsight.com/customer-success/onboarding/)
- [ChurnZero: Enterprise Onboarding Guide](https://churnzero.net/blog/enterprise-customer-onboarding/)
- [Forrester: CS Automation ROI](https://www.forrester.com)

### Technology
- [Temporal Workflow Engine](https://temporal.io/)
- [Salesforce REST API](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/)
- [Slack Bolt Framework](https://slack.dev/bolt-js/)

### Internal References
- ADR-012: User Portal Onboarding & Dashboard
- ADR-014: Admin Portal - Multi-Tenant Management
- ADR-019: Enterprise Customer Management
- ADR-020: Super Admin Portal & Platform Administration

## Review Date
April 2026 (3 months)

**Reviewers**: VP Customer Success, Head of Product, Engineering Lead

---

**Document Version**: 1.0
**Last Updated**: 2026-01-20
**Authors**: Customer Success & Engineering Team
**Approved By**: VP Customer Success, CTO
