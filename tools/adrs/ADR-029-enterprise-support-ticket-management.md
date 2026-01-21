# ADR-029: Enterprise Support Ticket Management & SLA Compliance

## Status
Accepted

## Context

Enterprise customers ($150K avg ARR, $1.5M-$2.25M total) require premium support with guaranteed SLAs, dedicated resources, and proactive assistance. However, our current support model is designed for self-service customers:

### Current State: Support Gaps for Enterprise

1. **No Tiered Support**:
   - All customers (free trial → $500K enterprise) get same support
   - No priority queuing for high-value customers
   - Enterprise tickets mixed with basic questions
   - Average first response time: 6-12 hours (enterprise expects < 1 hour)

2. **No SLA Tracking**:
   - No contractual commitments for response/resolution time
   - No visibility into SLA compliance
   - Can't prove we're meeting enterprise requirements
   - Risk of contract violations and penalties

3. **Limited Support Channels**:
   - Email-only support (no chat, phone, Slack)
   - No emergency hotline for critical issues (P0/P1)
   - No dedicated CSM support for strategic customers
   - After-hours support gaps (enterprise operates 24/7)

4. **Reactive Support Model**:
   - Wait for customer to report issue
   - No proactive monitoring or health checks
   - Miss patterns (same issue reported by 5 customers)
   - Don't track recurring issues per customer

5. **Poor CSM Integration**:
   - CSMs learn about support issues from customers (too late)
   - No automatic escalation for critical tickets
   - Support tickets not linked to health score
   - Support knowledge not shared with CSM team

### Industry Benchmarks

**Enterprise SaaS Support SLAs** (from Zendesk, Freshdesk):

| Priority | Response Time | Resolution Time | Availability |
|----------|--------------|-----------------|--------------|
| P0 (Critical) | < 1 hour | < 4 hours | 24/7 |
| P1 (High) | < 2 hours | < 8 hours | 24/5 |
| P2 (Medium) | < 8 hours | < 24 hours | Business hours |
| P3 (Low) | < 24 hours | < 5 days | Business hours |

**Support Channel Preferences** (enterprise buyers):
- 78% expect live chat
- 65% expect phone support for critical issues
- 54% expect dedicated Slack channel
- 42% expect after-hours support
- 89% expect SLA commitments in contract

**Support Impact on Churn**:
- SLA violations: **72% correlation with churn** (Gainsight data)
- > 10 tickets/month: **68% churn correlation**
- Critical issue mishandled: **3x churn risk**
- Fast resolution: **2.5x higher NPS**

### Requirements

**Must Have**:
- Tiered support levels (Standard, Premium, Enterprise)
- SLA definitions and tracking (response, resolution, uptime)
- Priority ticket routing (enterprise tickets get highest priority)
- Multi-channel support (email, chat, Slack, phone for P0/P1)
- Automatic escalation (SLA breach → escalate to manager → CSM)
- CSM integration (tickets visible in health dashboard)
- After-hours coverage (24/7 for P0, 24/5 for P1)

**Should Have**:
- Self-service knowledge base (reduce ticket volume by 40%)
- AI-powered ticket routing (assign to right expert automatically)
- Proactive support (monitor for issues, reach out before customer reports)
- Recurring issue detection (same customer, same problem → escalate)
- Customer portal (customers track their tickets)
- Support health metrics (time to resolution trends, satisfaction scores)

**Could Have**:
- Video call support (screen sharing for complex issues)
- Developer portal (API docs, status page, incident reports)
- Community forum (peer-to-peer support)
- Automated playbooks (common issues auto-resolved)
- Predictive support (ML detects issues before they occur)

## Decision

We will implement a **Multi-Tier Enterprise Support System** with:

### 1. Support Tier Definitions & SLAs
### 2. Priority-Based Ticket Routing
### 3. Multi-Channel Support Infrastructure
### 4. SLA Monitoring & Escalation
### 5. CSM Support Integration
### 6. Proactive Support & Health Checks
### 7. Support Analytics & Reporting

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│              Enterprise Support System                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Ticket Ingestion Layer                       │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │ • Email (support@forge.app)                              │   │
│  │ • Live Chat (Intercom/Zendesk)                           │   │
│  │ • Slack Connect (dedicated channels)                     │   │
│  │ • Phone (Twilio for P0/P1)                               │   │
│  │ • Customer Portal (ticket submission form)               │   │
│  └──────────────────────────────────────────────────────────┘   │
│                             │                                     │
│                             ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │          Ticket Classification & Routing                  │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │ • Identify customer tier (Enterprise/Premium/Standard)   │   │
│  │ • Auto-detect priority (P0/P1/P2/P3)                     │   │
│  │ • Assign to appropriate queue/agent                      │   │
│  │ • Apply SLA timer based on tier + priority               │   │
│  └──────────────────────────────────────────────────────────┘   │
│                             │                                     │
│                             ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              SLA Monitoring Engine                        │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │ • Track time since ticket created                        │   │
│  │ • Alert approaching SLA breach (80%, 100%, 120%)         │   │
│  │ • Escalate on breach (notify manager, CSM)               │   │
│  │ • Calculate SLA credits (contract penalties)             │   │
│  └──────────────────────────────────────────────────────────┘   │
│                             │                                     │
│                             ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Support Agent Workspace                      │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │ • Prioritized ticket queue (SLA timer visible)           │   │
│  │ • Customer context (health score, contract, history)     │   │
│  │ • Knowledge base suggestions (AI-powered)                │   │
│  │ • Quick actions (escalate, assign, merge tickets)        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                             │                                     │
│                             ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │         CSM Integration & Health Impact                   │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │ • Auto-notify CSM on P0/P1 tickets                       │   │
│  │ • Include tickets in health score calculation            │   │
│  │ • Flag recurring issues (same customer, same problem)    │   │
│  │ • Surface support trends in CSM dashboard                │   │
│  └──────────────────────────────────────────────────────────┘   │
│                             │                                     │
│                             ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │            Analytics & Reporting                          │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │ • SLA compliance rate (% tickets within SLA)             │   │
│  │ • Avg time to first response / resolution                │   │
│  │ • Ticket volume trends (by customer, by type)            │   │
│  │ • CSAT (Customer Satisfaction Score)                     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 1. Support Tier Definitions & SLAs

**Support Tiers**:

```typescript
interface SupportTier {
  name: string
  pricing: 'included' | 'addon'
  channels: SupportChannel[]
  slas: SLADefinition[]
  features: string[]
  availability: string
}

const supportTiers: Record<Tier, SupportTier> = {
  startup: {
    name: 'Standard Support',
    pricing: 'included',
    channels: ['email', 'customer_portal', 'knowledge_base'],
    slas: [
      { priority: 'P3', firstResponse: '24 hours', resolution: '5 days' },
      { priority: 'P2', firstResponse: '24 hours', resolution: '5 days' },
      { priority: 'P1', firstResponse: '8 hours', resolution: '3 days' },
      { priority: 'P0', firstResponse: '8 hours', resolution: '3 days' },
    ],
    features: [
      'Email support (business hours)',
      'Self-service knowledge base',
      'Community forum access',
    ],
    availability: 'Business hours (M-F, 9am-5pm PT)',
  },

  growth: {
    name: 'Premium Support',
    pricing: 'included',
    channels: ['email', 'chat', 'customer_portal', 'knowledge_base'],
    slas: [
      { priority: 'P3', firstResponse: '8 hours', resolution: '3 days' },
      { priority: 'P2', firstResponse: '4 hours', resolution: '2 days' },
      { priority: 'P1', firstResponse: '2 hours', resolution: '8 hours' },
      { priority: 'P0', firstResponse: '1 hour', resolution: '4 hours' },
    ],
    features: [
      'Email + live chat support (business hours)',
      'Priority ticket routing',
      'Video call support (by appointment)',
      'Quarterly product training',
    ],
    availability: 'Business hours (M-F, 9am-5pm PT)',
  },

  enterprise: {
    name: 'Enterprise Support',
    pricing: 'included',
    channels: ['email', 'chat', 'phone', 'slack', 'customer_portal', 'knowledge_base'],
    slas: [
      { priority: 'P3', firstResponse: '8 hours', resolution: '2 days' },
      { priority: 'P2', firstResponse: '2 hours', resolution: '1 day' },
      { priority: 'P1', firstResponse: '1 hour', resolution: '4 hours' },
      { priority: 'P0', firstResponse: '30 minutes', resolution: '2 hours' },
    ],
    features: [
      'Multi-channel support (email, chat, phone, Slack)',
      '24/7 support for P0 (critical)',
      '24/5 support for P1 (high)',
      'Dedicated CSM',
      'Dedicated Slack channel',
      'Emergency hotline',
      'Quarterly Business Reviews (QBR)',
      'Custom training and onboarding',
      '99.95% uptime SLA',
    ],
    availability: '24/7 for P0, 24/5 for P1, Business hours for P2/P3',
  },
}

type SupportChannel =
  | 'email'
  | 'chat'
  | 'phone'
  | 'slack'
  | 'customer_portal'
  | 'knowledge_base'

type Priority = 'P0' | 'P1' | 'P2' | 'P3'

interface SLADefinition {
  priority: Priority
  firstResponse: string  // Human-readable, e.g., "1 hour"
  resolution: string     // e.g., "4 hours"
  firstResponseMinutes: number  // For calculation
  resolutionMinutes: number
}
```

**Priority Definitions**:

```typescript
interface PriorityDefinition {
  priority: Priority
  name: string
  description: string
  examples: string[]
  autoDetectKeywords: string[]
}

const priorityDefinitions: PriorityDefinition[] = [
  {
    priority: 'P0',
    name: 'Critical',
    description: 'Complete service outage or data loss affecting all users',
    examples: [
      'Application is completely down (500 errors)',
      'Data loss or corruption',
      'Security breach or vulnerability',
      'Payment processing failure',
    ],
    autoDetectKeywords: [
      'down', 'outage', 'critical', 'urgent', 'data loss', 'security breach',
      '500 error', 'cannot access', 'production down'
    ],
  },
  {
    priority: 'P1',
    name: 'High',
    description: 'Major functionality unavailable or severely degraded',
    examples: [
      'Critical feature not working (e.g., SSO login fails)',
      'Severe performance degradation (>10s page load)',
      'API errors affecting multiple customers',
      'Billing/invoicing issues',
    ],
    autoDetectKeywords: [
      'not working', 'broken', 'error', 'failed', 'timeout', 'slow',
      'degraded', 'api error', 'sso issue'
    ],
  },
  {
    priority: 'P2',
    name: 'Medium',
    description: 'Non-critical functionality impaired with workaround available',
    examples: [
      'Feature partially working with workaround',
      'Minor bug affecting single user/team',
      'Integration issue with non-critical system',
      'UI/UX issue affecting productivity',
    ],
    autoDetectKeywords: [
      'issue', 'problem', 'bug', 'not expected', 'incorrect', 'missing'
    ],
  },
  {
    priority: 'P3',
    name: 'Low',
    description: 'General questions, feature requests, or minor issues',
    examples: [
      'How-to questions',
      'Feature requests',
      'Documentation clarification',
      'Minor cosmetic issues',
    ],
    autoDetectKeywords: [
      'how to', 'question', 'feature request', 'documentation', 'suggestion'
    ],
  },
]
```

### 2. Priority-Based Ticket Routing

**Automatic Priority Detection**:

```typescript
export class TicketClassifier {
  async classifyTicket(ticket: IncomingTicket): Promise<TicketClassification> {
    const org = await this.getOrganization(ticket.from)

    // 1. Detect priority from subject + body
    const priority = this.detectPriority(ticket.subject, ticket.body)

    // 2. Get support tier from organization
    const tier = org.tier
    const sla = this.getSLA(tier, priority)

    // 3. Assign to appropriate queue
    const queue = this.getQueue(tier, priority)

    // 4. Calculate SLA deadlines
    const now = new Date()
    const firstResponseDeadline = addMinutes(now, sla.firstResponseMinutes)
    const resolutionDeadline = addMinutes(now, sla.resolutionMinutes)

    // 5. Auto-escalate critical tickets
    if (priority === 'P0') {
      await this.escalateToCriticalTeam(ticket, org)
      await this.notifyCSM(ticket, org)
      await this.notifyOnCall(ticket)
    }

    return {
      ticketId: ticket.id,
      organizationId: org.id,
      tier,
      priority,
      queue,
      sla,
      firstResponseDeadline,
      resolutionDeadline,
      createdAt: now,
    }
  }

  detectPriority(subject: string, body: string): Priority {
    const text = `${subject} ${body}`.toLowerCase()

    // Check for critical keywords first
    const p0Keywords = priorityDefinitions.find(p => p.priority === 'P0')!.autoDetectKeywords
    if (p0Keywords.some(keyword => text.includes(keyword))) {
      return 'P0'
    }

    // Check for high priority
    const p1Keywords = priorityDefinitions.find(p => p.priority === 'P1')!.autoDetectKeywords
    if (p1Keywords.some(keyword => text.includes(keyword))) {
      return 'P1'
    }

    // Check for medium priority
    const p2Keywords = priorityDefinitions.find(p => p.priority === 'P2')!.autoDetectKeywords
    if (p2Keywords.some(keyword => text.includes(keyword))) {
      return 'P2'
    }

    // Default to low priority
    return 'P3'
  }

  getQueue(tier: Tier, priority: Priority): string {
    // Enterprise customers: Dedicated enterprise queue
    if (tier === 'enterprise') {
      if (priority === 'P0' || priority === 'P1') {
        return 'enterprise-critical'
      }
      return 'enterprise'
    }

    // Premium customers: Premium queue
    if (tier === 'growth') {
      return 'premium'
    }

    // Standard customers: General queue
    return 'standard'
  }

  async escalateToCriticalTeam(ticket: IncomingTicket, org: Organization) {
    // Immediately assign to senior engineer
    const onCallEngineer = await this.getOnCallEngineer()

    await this.assignTicket(ticket.id, onCallEngineer.id)

    // Send SMS + email + Slack
    await Promise.all([
      this.sms.send(onCallEngineer.phone, `🚨 P0 ticket from ${org.name}: ${ticket.subject}`),
      this.email.send(onCallEngineer.email, '...'),
      this.slack.send('#critical-support', '...'),
    ])
  }
}
```

**Queue Management**:

```typescript
interface SupportQueue {
  id: string
  name: string
  description: string
  assignees: string[]  // Agent IDs
  autoAssignment: boolean
  maxTicketsPerAgent: number
  priorityOrder: Priority[]
}

const queues: SupportQueue[] = [
  {
    id: 'enterprise-critical',
    name: 'Enterprise Critical (P0/P1)',
    description: 'Critical and high priority tickets from enterprise customers',
    assignees: ['senior-engineer-1', 'senior-engineer-2', 'on-call'],
    autoAssignment: true,
    maxTicketsPerAgent: 3,
    priorityOrder: ['P0', 'P1'],
  },
  {
    id: 'enterprise',
    name: 'Enterprise (P2/P3)',
    description: 'Medium and low priority tickets from enterprise customers',
    assignees: ['enterprise-support-1', 'enterprise-support-2'],
    autoAssignment: true,
    maxTicketsPerAgent: 10,
    priorityOrder: ['P2', 'P3'],
  },
  {
    id: 'premium',
    name: 'Premium Support',
    description: 'All tickets from Premium (Growth) tier customers',
    assignees: ['support-agent-1', 'support-agent-2', 'support-agent-3'],
    autoAssignment: true,
    maxTicketsPerAgent: 15,
    priorityOrder: ['P0', 'P1', 'P2', 'P3'],
  },
  {
    id: 'standard',
    name: 'Standard Support',
    description: 'All tickets from Standard tier customers',
    assignees: ['support-agent-4', 'support-agent-5'],
    autoAssignment: true,
    maxTicketsPerAgent: 20,
    priorityOrder: ['P1', 'P2', 'P3'],
  },
]
```

### 3. Multi-Channel Support Infrastructure

**Email** (Primary channel):
```typescript
// Inbound email processing
export class EmailSupportChannel {
  async processInboundEmail(email: Email) {
    // Parse email
    const from = email.from
    const subject = email.subject
    const body = email.body
    const attachments = email.attachments

    // Find existing ticket (if reply)
    const existingTicket = await this.findTicketByMessageId(email.inReplyTo)

    if (existingTicket) {
      // Add as comment to existing ticket
      await this.addComment(existingTicket.id, {
        author: from,
        body,
        attachments,
        createdAt: new Date(),
      })
    } else {
      // Create new ticket
      const ticket = await this.createTicket({
        channel: 'email',
        from,
        subject,
        body,
        attachments,
      })

      // Auto-classify and route
      await this.classifier.classifyTicket(ticket)
    }
  }
}
```

**Live Chat** (Premium/Enterprise):
```typescript
// Intercom/Zendesk integration
export class LiveChatChannel {
  async handleInboundChat(message: ChatMessage) {
    const org = await this.getOrganizationByUserId(message.userId)

    // Check if customer tier supports chat
    const tier = org.tier
    if (tier === 'startup') {
      return this.sendAutoReply({
        message: 'Live chat is available on Premium and Enterprise plans. Please email support@forge.app',
      })
    }

    // Check if business hours (for non-enterprise)
    if (tier === 'growth' && !this.isBusinessHours()) {
      return this.sendAutoReply({
        message: 'Chat support is available M-F, 9am-5pm PT. Please email support@forge.app for after-hours support.',
      })
    }

    // Route to available agent
    const agent = await this.getAvailableAgent(tier)

    if (!agent) {
      return this.sendAutoReply({
        message: 'All agents are currently assisting other customers. Please wait or email support@forge.app',
      })
    }

    // Assign chat to agent
    await this.assignChat(message.chatId, agent.id)
  }
}
```

**Phone** (Enterprise P0/P1 only):
```typescript
// Twilio integration
export class PhoneSupportChannel {
  async handleInboundCall(call: TwilioCall) {
    // IVR menu
    const response = new Twilio.twiml.VoiceResponse()

    response.say('Thank you for calling Forge Factory support.')
    response.pause({ length: 1 })
    response.say('If this is a critical production issue, press 1.')
    response.say('For all other inquiries, please hang up and email support@forge.app or use live chat.')

    const gather = response.gather({
      numDigits: 1,
      action: '/support/phone/route',
    })

    return response
  }

  async routeCriticalCall(call: TwilioCall, organizationId: string) {
    const org = await this.getOrganization(organizationId)

    // Verify enterprise tier
    if (org.tier !== 'enterprise') {
      const response = new Twilio.twiml.VoiceResponse()
      response.say('Phone support is only available for Enterprise customers. Please email support@forge.app')
      response.hangup()
      return response
    }

    // Create P0 ticket
    const ticket = await this.createTicket({
      channel: 'phone',
      organizationId,
      priority: 'P0',
      subject: 'Critical issue reported via phone',
      body: `Customer called ${call.from} at ${new Date().toISOString()}`,
    })

    // Route to on-call engineer
    const onCall = await this.getOnCallEngineer()

    const response = new Twilio.twiml.VoiceResponse()
    response.say(`Connecting you to ${onCall.name}. Please hold.`)
    response.dial(onCall.phone)

    // Log call
    await this.logPhoneCall(ticket.id, call)

    return response
  }
}
```

**Slack Connect** (Enterprise dedicated channels):
```typescript
// Create dedicated Slack channel for each enterprise customer
export class SlackSupportChannel {
  async createDedicatedChannel(organizationId: string) {
    const org = await this.getOrganization(organizationId)

    // Only for enterprise tier
    if (org.tier !== 'enterprise') {
      return null
    }

    // Create Slack Connect channel
    const channel = await this.slack.createChannel({
      name: `support-${org.slug}`,
      isPrivate: true,
      isExternal: true,
    })

    // Invite customer contacts
    await this.slack.inviteUsers(channel.id, [
      org.technicalContact,
      org.champion,
    ])

    // Invite support team
    await this.slack.inviteUsers(channel.id, [
      org.csmEmail,
      'support-lead@forge.app',
    ])

    // Post welcome message
    await this.slack.postMessage(channel.id, {
      text: `Welcome to your dedicated Forge Factory support channel! This channel is monitored by your CSM ${org.csmEmail} and our support team. For critical issues (P0/P1), please call our emergency hotline: 1-800-FORGE-911`,
    })

    // Save channel ID
    await this.db.organization.update({
      where: { id: organizationId },
      data: { supportSlackChannelId: channel.id },
    })

    return channel
  }

  @OnEvent('slack.message_posted')
  async handleSlackMessage(event: SlackMessageEvent) {
    // Find organization by channel
    const org = await this.db.organization.findFirst({
      where: { supportSlackChannelId: event.channelId }
    })

    if (!org) return

    // Auto-create ticket from Slack message
    const ticket = await this.createTicket({
      channel: 'slack',
      organizationId: org.id,
      subject: event.text.substring(0, 100), // First 100 chars as subject
      body: event.text,
      reporter: event.userId,
    })

    // React with emoji to confirm ticket created
    await this.slack.addReaction(event.channelId, event.timestamp, 'ticket')

    // Post link to ticket
    await this.slack.postMessage(event.channelId, {
      thread_ts: event.timestamp,
      text: `Ticket created: ${ticket.id} - We'll respond within ${this.getSLA(org.tier, ticket.priority).firstResponse}`,
    })
  }
}
```

### 4. SLA Monitoring & Escalation

**SLA Timer System**:

```typescript
export class SLAMonitor {
  @Cron('*/5 * * * *') // Every 5 minutes
  async checkSLACompliance() {
    // Find all open tickets with approaching or breached SLAs
    const tickets = await this.db.supportTicket.findMany({
      where: {
        status: { in: ['new', 'in_progress'] },
        firstResponseDeadline: { lte: addMinutes(new Date(), 30) }, // Alert 30 min before breach
      },
      include: { organization: true, assignedTo: true }
    })

    for (const ticket of tickets) {
      const now = new Date()
      const timeRemaining = differenceInMinutes(ticket.firstResponseDeadline, now)

      // SLA breach alert levels
      if (timeRemaining <= 0) {
        // Breached!
        await this.handleSLABreach(ticket, 'first_response')
      } else if (timeRemaining <= 10) {
        // 10 minutes remaining
        await this.sendSLAAlert(ticket, 'critical', timeRemaining)
      } else if (timeRemaining <= 30) {
        // 30 minutes remaining
        await this.sendSLAAlert(ticket, 'warning', timeRemaining)
      }
    }
  }

  async handleSLABreach(ticket: SupportTicket, type: 'first_response' | 'resolution') {
    // Log breach
    await this.db.sLABreach.create({
      data: {
        ticketId: ticket.id,
        organizationId: ticket.organizationId,
        type,
        breachTime: new Date(),
        deadline: type === 'first_response' ? ticket.firstResponseDeadline : ticket.resolutionDeadline,
        delayMinutes: differenceInMinutes(new Date(), type === 'first_response' ? ticket.firstResponseDeadline : ticket.resolutionDeadline),
      }
    })

    // Escalate
    await this.escalate(ticket, {
      reason: `SLA breach: ${type}`,
      severity: 'high',
    })

    // Notify everyone
    await Promise.all([
      this.notifyAssignee(ticket, 'SLA BREACHED'),
      this.notifyManager(ticket, 'SLA breach'),
      this.notifyCSM(ticket, 'SLA breach - customer may escalate'),
      this.slack.send('#support-alerts', `🚨 SLA breach: Ticket ${ticket.id} (${ticket.organization.name})`),
    ])

    // Calculate SLA credit (if in contract)
    if (ticket.organization.tier === 'enterprise' && ticket.organization.slaCreditsEnabled) {
      await this.calculateSLACredit(ticket)
    }
  }

  async calculateSLACredit(ticket: SupportTicket) {
    const contract = await this.db.enterpriseContract.findFirst({
      where: { organizationId: ticket.organizationId }
    })

    if (!contract) return

    // SLA credit formula (from contract)
    // Example: 5% of monthly fee per breach, capped at 25% per month
    const monthlyFee = contract.arr / 12
    const creditPercent = 0.05 // 5%
    const creditAmount = monthlyFee * creditPercent

    // Check monthly cap
    const thisMonth = startOfMonth(new Date())
    const creditsThisMonth = await this.db.sLACredit.aggregate({
      where: {
        organizationId: ticket.organizationId,
        createdAt: { gte: thisMonth },
      },
      _sum: { amount: true }
    })

    const totalCredits = (creditsThisMonth._sum.amount || 0) + creditAmount
    const maxCredits = monthlyFee * 0.25 // 25% cap

    if (totalCredits <= maxCredits) {
      await this.db.sLACredit.create({
        data: {
          organizationId: ticket.organizationId,
          ticketId: ticket.id,
          amount: creditAmount,
          reason: 'SLA breach',
          month: thisMonth,
        }
      })

      // Notify finance team
      await this.notifyFinance({
        organization: ticket.organization.name,
        amount: creditAmount,
        reason: 'SLA breach',
        ticketId: ticket.id,
      })
    }
  }

  async escalate(ticket: SupportTicket, params: { reason: string; severity: string }) {
    // Reassign to manager
    const manager = await this.getSupportManager()

    await this.db.supportTicket.update({
      where: { id: ticket.id },
      data: {
        assignedToId: manager.id,
        escalatedAt: new Date(),
        escalationReason: params.reason,
      }
    })

    // Log escalation event
    await this.db.ticketEvent.create({
      data: {
        ticketId: ticket.id,
        type: 'escalated',
        metadata: params,
      }
    })
  }
}
```

### 5. CSM Support Integration

**Auto-notify CSM on Critical Tickets**:

```typescript
export class CSMIntegration {
  @OnEvent('ticket.created')
  async onTicketCreated(event: TicketCreatedEvent) {
    const ticket = event.ticket
    const org = event.organization

    // Notify CSM for P0/P1 tickets
    if (ticket.priority === 'P0' || ticket.priority === 'P1') {
      const csm = await this.getCSM(org.id)

      if (csm) {
        await this.email.send({
          to: csm.email,
          subject: `${ticket.priority} ticket from ${org.name}`,
          body: `
            A ${ticket.priority} ticket has been created by your customer ${org.name}.

            **Ticket:** ${ticket.id}
            **Subject:** ${ticket.subject}
            **Priority:** ${ticket.priority}
            **SLA:** First response within ${ticket.sla.firstResponse}

            **Customer Context:**
            - Health Score: ${org.healthScore}/100
            - ARR: $${org.arr.toLocaleString()}
            - Renewal Date: ${formatDate(org.renewalDate)}

            [View Ticket](https://admin.forge.app/tickets/${ticket.id})
            [View Customer](https://admin.forge.app/customers/${org.id})
          `,
        })

        // Also send Slack DM
        await this.slack.sendDM(csm.slackUserId, {
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `🚨 *${ticket.priority} ticket* from ${org.name}\n\n*${ticket.subject}*`,
              },
            },
            {
              type: 'actions',
              elements: [
                {
                  type: 'button',
                  text: { type: 'plain_text', text: 'View Ticket' },
                  url: `https://admin.forge.app/tickets/${ticket.id}`,
                },
              ],
            },
          ],
        })
      }
    }
  }

  @OnEvent('ticket.sla_breached')
  async onSLABreached(event: SLABreachEvent) {
    const ticket = event.ticket
    const org = event.organization

    // Always notify CSM on SLA breach
    const csm = await this.getCSM(org.id)

    if (csm) {
      await this.email.send({
        to: csm.email,
        subject: `⚠️ SLA BREACH: ${org.name}`,
        body: `
          SLA has been breached for ticket ${ticket.id}.

          **Customer:** ${org.name}
          **Ticket:** ${ticket.subject}
          **Priority:** ${ticket.priority}
          **Breach Type:** ${event.breachType}
          **Delay:** ${event.delayMinutes} minutes

          **Action Required:**
          - Reach out to customer proactively
          - Explain situation and ETA
          - Escalate internally if needed

          This may impact customer health score and renewal.
        `,
      })
    }
  }

  // Include support tickets in health score
  async calculateSupportHealthScore(organizationId: string): Promise<number> {
    const tickets = await this.db.supportTicket.findMany({
      where: {
        organizationId,
        createdAt: { gte: subDays(new Date(), 30) }, // Last 30 days
      },
    })

    // Expected tickets (baseline: 1 per 10 users per month)
    const org = await this.db.organization.findUnique({ where: { id: organizationId } })
    const expectedTickets = org!.seats / 10

    // Score components
    const ticketVolume = Math.max(0, 100 - (tickets.length / expectedTickets * 2) * 100) // Inverse: fewer = better
    const criticalTickets = Math.max(0, 100 - (tickets.filter(t => t.priority === 'P0').length * 20))
    const slaBreaches = Math.max(0, 100 - (tickets.filter(t => t.slaBreached).length * 15))

    return (ticketVolume * 0.4 + criticalTickets * 0.3 + slaBreaches * 0.3)
  }
}
```

**CSM Support Dashboard** (`/apps/admin/customers/[id]/support`):

```typescript
export default async function CustomerSupportPage({ params }: { params: { id: string } }) {
  const org = await getOrganization(params.id)
  const tickets = await getSupportTickets(params.id, { last: 90 })
  const metrics = await getSupportMetrics(params.id)

  return (
    <div className="p-8 space-y-8">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard
          title="Open Tickets"
          value={metrics.openTickets}
          icon={<Ticket />}
        />
        <MetricCard
          title="Avg Response Time"
          value={formatDuration(metrics.avgFirstResponseTime)}
          trend={metrics.responseTrend}
          icon={<Clock />}
        />
        <MetricCard
          title="SLA Compliance"
          value={`${(metrics.slaCompliance * 100).toFixed(0)}%`}
          variant={metrics.slaCompliance >= 0.95 ? 'success' : 'warning'}
          icon={<CheckCircle />}
        />
        <MetricCard
          title="CSAT Score"
          value={`${metrics.csatScore.toFixed(1)}/5`}
          icon={<Star />}
        />
      </div>

      {/* Active Tickets */}
      <Card>
        <CardHeader>
          <CardTitle>Active Tickets ({metrics.openTickets})</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={[
              { key: 'id', label: 'Ticket #' },
              { key: 'subject', label: 'Subject' },
              { key: 'priority', label: 'Priority', render: (priority) => (
                <PriorityBadge priority={priority} />
              )},
              { key: 'status', label: 'Status' },
              { key: 'assignedTo', label: 'Agent' },
              { key: 'slaRemaining', label: 'SLA', render: (minutes) => (
                <SLATimer minutes={minutes} />
              )},
              { key: 'createdAt', label: 'Created', format: 'date' },
            ]}
            data={tickets.filter(t => t.status !== 'closed')}
          />
        </CardContent>
      </Card>

      {/* Ticket Trends */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Ticket Volume (90 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <TicketVolumeChart data={metrics.volumeTrend} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tickets by Priority</CardTitle>
          </CardHeader>
          <CardContent>
            <PriorityDistributionChart data={metrics.byPriority} />
          </CardContent>
        </Card>
      </div>

      {/* Recurring Issues */}
      {metrics.recurringIssues.length > 0 && (
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Recurring Issues Detected</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-5 mt-2">
              {metrics.recurringIssues.map((issue) => (
                <li key={issue.pattern}>
                  {issue.count}x: {issue.pattern}
                </li>
              ))}
            </ul>
            <Button variant="link" onClick={() => scheduleCall(org)}>
              Schedule call to address root cause
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
```

### 6. Proactive Support & Health Checks

**Automated Health Checks**:

```typescript
export class ProactiveSupportService {
  @Cron('0 */6 * * *') // Every 6 hours
  async runHealthChecks() {
    const orgs = await this.db.organization.findMany({
      where: { tier: 'enterprise', status: 'active' }
    })

    for (const org of orgs) {
      const health = await this.checkCustomerHealth(org)

      if (health.issues.length > 0) {
        await this.createProactiveTicket(org, health)
      }
    }
  }

  async checkCustomerHealth(org: Organization): Promise<HealthCheck> {
    const issues: Issue[] = []

    // Check API error rates
    const errorRate = await this.metrics.getErrorRate(org.id, { last: '1h' })
    if (errorRate > 0.05) {
      issues.push({
        severity: 'high',
        category: 'api_errors',
        description: `Elevated API error rate: ${(errorRate * 100).toFixed(1)}%`,
        recommendation: 'Investigate recent API calls and error logs',
      })
    }

    // Check for failed jobs
    const failedJobs = await this.db.refactoringJob.count({
      where: {
        organizationId: org.id,
        status: 'failed',
        createdAt: { gte: subHours(new Date(), 24) },
      },
    })

    if (failedJobs >= 3) {
      issues.push({
        severity: 'medium',
        category: 'failed_jobs',
        description: `${failedJobs} refactoring jobs failed in last 24 hours`,
        recommendation: 'Review job configurations and error logs',
      })
    }

    // Check for integration issues
    const integrations = await this.db.integration.findMany({
      where: { organizationId: org.id }
    })

    for (const integration of integrations) {
      if (integration.status === 'disconnected') {
        issues.push({
          severity: 'low',
          category: 'integration',
          description: `${integration.provider} integration disconnected`,
          recommendation: 'Reconnect integration in settings',
        })
      }
    }

    return { organizationId: org.id, issues }
  }

  async createProactiveTicket(org: Organization, health: HealthCheck) {
    const ticket = await this.db.supportTicket.create({
      data: {
        organizationId: org.id,
        channel: 'proactive',
        priority: this.calculatePriority(health.issues),
        subject: `Proactive health check: ${health.issues.length} issues detected`,
        body: `
          We've detected ${health.issues.length} potential issues with your Forge Factory account:

          ${health.issues.map((issue, i) => `
            ${i + 1}. **${issue.description}** (${issue.severity})
               Recommendation: ${issue.recommendation}
          `).join('\n')}

          Our team is investigating and will reach out if action is needed.
        `,
        status: 'in_progress',
        assignedToId: (await this.getCSM(org.id))?.id,
      },
    })

    // Notify CSM
    const csm = await this.getCSM(org.id)
    if (csm) {
      await this.email.send({
        to: csm.email,
        subject: `Proactive issue detected: ${org.name}`,
        body: `Health check found ${health.issues.length} issues. Ticket created: ${ticket.id}`,
      })
    }
  }
}
```

### 7. Support Analytics & Reporting

**Support Metrics Dashboard** (`/apps/admin/support/analytics`):

```typescript
interface SupportMetrics {
  // Volume
  totalTickets: number
  ticketsThisMonth: number
  ticketsTrend: 'up' | 'down' | 'stable'

  // Performance
  avgFirstResponseTime: number  // minutes
  avgResolutionTime: number     // minutes
  firstResponseSLA: number      // % within SLA
  resolutionSLA: number         // % within SLA

  // By tier
  byTier: {
    enterprise: { tickets: number; slaCompliance: number }
    growth: { tickets: number; slaCompliance: number }
    startup: { tickets: number; slaCompliance: number }
  }

  // By priority
  byPriority: {
    P0: { count: number; avgResolutionTime: number }
    P1: { count: number; avgResolutionTime: number }
    P2: { count: number; avgResolutionTime: number }
    P3: { count: number; avgResolutionTime: number }
  }

  // Satisfaction
  csatScore: number  // 1-5
  csatResponseRate: number  // %

  // Agent performance
  agentMetrics: {
    agentName: string
    ticketsClosed: number
    avgResolutionTime: number
    csatScore: number
  }[]
}
```

## Data Model

```prisma
model SupportTicket {
  id             String   @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])

  // Classification
  channel        SupportChannel
  priority       Priority
  status         TicketStatus @default(NEW)
  category       String?  // e.g., 'api_error', 'billing', 'feature_request'

  // Content
  subject        String
  body           String
  reporter       String   // Email or user ID
  reporterName   String?

  // Assignment
  assignedToId   String?
  assignedTo     User?    @relation(fields: [assignedToId], references: [id])
  queue          String

  // SLA tracking
  tier           Tier
  sla            Json     // SLA definition
  firstResponseDeadline DateTime
  resolutionDeadline    DateTime
  firstResponseAt       DateTime?
  resolvedAt            DateTime?
  slaBreached           Boolean @default(false)

  // Escalation
  escalatedAt    DateTime?
  escalationReason String?

  // Satisfaction
  csatScore      Int?     // 1-5
  csatComment    String?

  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([organizationId, status, priority])
  @@index([assignedToId, status])
  @@index([firstResponseDeadline])
}

enum SupportChannel {
  EMAIL
  CHAT
  PHONE
  SLACK
  CUSTOMER_PORTAL
  PROACTIVE
}

enum TicketStatus {
  NEW
  IN_PROGRESS
  WAITING_ON_CUSTOMER
  ESCALATED
  RESOLVED
  CLOSED
}

model TicketComment {
  id         String   @id @default(cuid())
  ticketId   String
  ticket     SupportTicket @relation(fields: [ticketId], references: [id])

  authorId   String
  author     User     @relation(fields: [authorId], references: [id])

  body       String
  attachments Json[]
  isInternal Boolean  @default(false) // Internal notes vs customer-facing

  createdAt  DateTime @default(now())

  @@index([ticketId, createdAt])
}

model SLABreach {
  id             String   @id @default(cuid())
  ticketId       String
  ticket         SupportTicket @relation(fields: [ticketId], references: [id])
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])

  type           SLABreachType
  deadline       DateTime
  breachTime     DateTime
  delayMinutes   Int

  createdAt      DateTime @default(now())

  @@index([organizationId, createdAt])
}

enum SLABreachType {
  FIRST_RESPONSE
  RESOLUTION
}

model SLACredit {
  id             String   @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])
  ticketId       String?
  ticket         SupportTicket? @relation(fields: [ticketId], references: [id])

  amount         Float    // Dollars
  reason         String
  month          DateTime // Which month this credit applies to

  appliedToInvoice Boolean @default(false)
  invoiceId      String?

  createdAt      DateTime @default(now())

  @@index([organizationId, month])
}
```

## Consequences

### Positive

1. **Enterprise-Grade Support**:
   - SLA commitments backed by contract
   - Multi-channel support (email, chat, phone, Slack)
   - 24/7 coverage for critical issues
   - Dedicated resources for high-value customers

2. **Improved CSAT & Retention**:
   - Fast response times (< 1 hour for P0)
   - Proactive issue detection (before customer reports)
   - Transparent SLA tracking
   - Target: 4.5+/5 CSAT, 95%+ retention

3. **Operational Efficiency**:
   - Automated routing and prioritization
   - Clear escalation paths
   - SLA breach alerting prevents violations
   - Support metrics inform staffing decisions

4. **CSM Integration**:
   - CSMs aware of support issues immediately
   - Tickets factor into health score
   - Recurring issues flagged for CSM intervention
   - Unified customer view

5. **Revenue Protection**:
   - Prevent churn from poor support
   - SLA credits limited by contract caps
   - Proactive support reduces ticket volume
   - Happy customers expand/renew

### Negative

1. **Staffing Requirements**:
   - 24/7 on-call for enterprise P0
   - Dedicated enterprise support team
   - Need senior engineers for critical tickets
   - Estimated: 3-5 support FTEs for 10-15 enterprise customers

2. **SLA Pressure**:
   - Aggressive SLAs (< 1 hour) create stress
   - Breach penalties motivate but also pressure
   - Risk of burnout for on-call team

3. **Multi-Channel Complexity**:
   - Each channel requires integration and maintenance
   - Training agents on all channels
   - Consistency across channels

4. **Cost of SLA Credits**:
   - Breaches cost money (5% of monthly fee)
   - Can add up to 25% of monthly revenue
   - Incentivizes good support but impacts margins

### Mitigations

1. **Staffing**:
   - **Action**: Hire strategically (1 support per 3-4 enterprise customers)
   - **Pattern**: Follow-the-sun coverage (US + Europe + APAC)
   - **Tool**: Automated routing reduces agent burden

2. **SLA Pressure**:
   - **Action**: Realistic SLAs (don't over-promise)
   - **Pattern**: Clear escalation to prevent individual burnout
   - **Tool**: On-call rotation (max 1 week per engineer)

3. **Multi-Channel**:
   - **Action**: Phase rollout (email → chat → phone → Slack)
   - **Pattern**: Unified inbox (all channels in one view)
   - **Tool**: Zendesk or Intercom (multi-channel support platform)

4. **SLA Credits**:
   - **Action**: Proactive monitoring reduces breaches
   - **Pattern**: Cap credits at 25% per month (contract limit)
   - **Tool**: Auto-escalation before breach

## Metrics & Success Criteria

### SLA Compliance
- **First Response SLA**: 95%+ compliance (Enterprise P0: <30 min)
- **Resolution SLA**: 90%+ compliance
- **SLA Breaches**: < 5% of tickets
- **SLA Credits Issued**: < 5% of monthly revenue

### Performance
- **Avg First Response Time**: < 1 hour (Enterprise), < 4 hours (Premium)
- **Avg Resolution Time**: < 4 hours (P0), < 1 day (P1), < 2 days (P2)
- **Ticket Volume**: < 1 ticket per 10 users per month (baseline)

### Satisfaction
- **CSAT Score**: 4.5+/5
- **CSAT Response Rate**: 40%+
- **NPS Impact**: Support tickets < 10/month = higher NPS

### Efficiency
- **Self-Service Deflection**: 40%+ (knowledge base resolves without ticket)
- **First Contact Resolution**: 70%+ (resolved without escalation)
- **Agent Utilization**: 60-80% (not overloaded, not idle)

## Implementation Plan

### Phase 1: Tier Definitions & Routing (Weeks 1-4)
- [ ] Define support tiers and SLAs
- [ ] Build priority detection logic
- [ ] Implement queue-based routing
- [ ] Create support ticket data model

### Phase 2: SLA Monitoring (Weeks 5-8)
- [ ] Build SLA timer system
- [ ] Implement breach alerting
- [ ] Add escalation workflows
- [ ] Create SLA credits system

### Phase 3: Multi-Channel (Weeks 9-12)
- [ ] Integrate email support (existing)
- [ ] Add live chat (Intercom/Zendesk)
- [ ] Set up phone support (Twilio)
- [ ] Create Slack Connect channels

### Phase 4: CSM Integration (Weeks 13-16)
- [ ] Auto-notify CSM on P0/P1 tickets
- [ ] Include support in health score
- [ ] Build CSM support dashboard
- [ ] Add recurring issue detection

### Phase 5: Proactive Support (Weeks 17-20)
- [ ] Build health check automation
- [ ] Create proactive ticket workflows
- [ ] Implement customer portal
- [ ] Add knowledge base

### Phase 6: Analytics (Weeks 21-24)
- [ ] Build support metrics dashboard
- [ ] Add agent performance tracking
- [ ] Create executive reports
- [ ] Implement CSAT surveys

## References

### Industry Research
- [Zendesk: Enterprise Support Best Practices](https://www.zendesk.com/blog/enterprise-customer-support/)
- [Gartner: SLA Management](https://www.gartner.com/en/customer-service-support/trends/sla-management)
- [Freshdesk: Multi-Channel Support Guide](https://freshdesk.com/multi-channel-customer-support)

### Technology
- [Zendesk API](https://developer.zendesk.com/api-reference/)
- [Intercom API](https://developers.intercom.com/)
- [Twilio Voice](https://www.twilio.com/docs/voice)
- [Slack Connect](https://api.slack.com/enterprise/shared-channels)

### Internal References
- ADR-019: Enterprise Customer Management
- ADR-026: Enterprise Customer Onboarding Automation
- ADR-027: Enterprise Customer Health Monitoring

## Review Date
April 2026 (3 months)

**Reviewers**: VP Customer Success, Head of Support, Engineering Lead

---

**Document Version**: 1.0
**Last Updated**: 2026-01-20
**Authors**: Customer Success & Support Team
**Approved By**: VP Customer Success, CTO
