# Features Summary & Quick Reference

**Version:** 1.0
**Date:** 2026-01-19
**Status:** Complete

---

## Fully Documented Features (5)

| ID | Feature | File | Status |
|----|---------|------|--------|
| FF-001 | Repository Analyzer | `01-repository-analyzer.md` | ✅ Complete |
| FF-002 | CLAUDE.md Generator | `02-claude-md-generator.md` | ✅ Complete |
| FF-003 | GitHub Integration | `03-github-integration.md` | ✅ Complete |
| FF-004 | LLM Provider Integration | `04-llm-provider-integration.md` | ✅ Complete |
| FF-005 | Authentication System | `05-authentication-system.md` | ✅ Complete |

---

## Phase 1 (P0) - MVP Features Summary

### FF-006: SSO/SAML Integration
**Schema:** `saml_configurations`, `sso_sessions`
**Key Endpoints:**
- `POST /api/v1/auth/saml/login` - Initiate SAML SSO
- `POST /api/v1/auth/saml/acs` - Assertion Consumer Service
- `GET /api/v1/auth/saml/metadata` - SP metadata

**Implementation:** 3 weeks

### FF-007: Session Management
**Schema:** `user_sessions`, `device_registry`
**Key Endpoints:**
- `GET /api/v1/auth/sessions` - List active sessions
- `DELETE /api/v1/auth/sessions/:id` - Revoke session
- `POST /api/v1/auth/sessions/revoke-all` - Sign out everywhere

**Implementation:** 1 week

### FF-008: Organization Management
**Schema:**
```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  plan_tier TEXT NOT NULL, -- free, team, business, enterprise
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Key Endpoints:**
- `POST /api/v1/organizations` - Create org
- `GET /api/v1/organizations/:id` - Get org
- `PATCH /api/v1/organizations/:id` - Update org
- `GET /api/v1/organizations/:id/usage` - Usage stats

**Implementation:** 2 weeks

### FF-009: Team Management
**Schema:**
```sql
CREATE TABLE organization_members (
  organization_id UUID REFERENCES organizations(id),
  user_id UUID REFERENCES users(id),
  role TEXT NOT NULL, -- owner, admin, member, viewer
  invited_by UUID REFERENCES users(id),
  invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_id, user_id)
);

CREATE TABLE invitations (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id),
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  token VARCHAR(64) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_by UUID REFERENCES users(id)
);
```

**Key Endpoints:**
- `POST /api/v1/organizations/:id/members/invite` - Invite member
- `POST /api/v1/invitations/:token/accept` - Accept invite
- `DELETE /api/v1/organizations/:orgId/members/:userId` - Remove member
- `PATCH /api/v1/organizations/:orgId/members/:userId/role` - Update role

**Implementation:** 2 weeks

### FF-010: Role-Based Access Control (RBAC)
**Permissions System:**
```typescript
enum Permission {
  // Repository
  REPO_READ = 'repo:read',
  REPO_WRITE = 'repo:write',
  REPO_DELETE = 'repo:delete',

  // Analysis
  ANALYSIS_READ = 'analysis:read',
  ANALYSIS_CREATE = 'analysis:create',

  // Refactoring
  REFACTOR_CREATE = 'refactor:create',
  REFACTOR_APPROVE = 'refactor:approve',

  // Team
  TEAM_READ = 'team:read',
  TEAM_WRITE = 'team:write',

  // Settings
  SETTINGS_READ = 'settings:read',
  SETTINGS_WRITE = 'settings:write',

  // Billing
  BILLING_READ = 'billing:read',
  BILLING_WRITE = 'billing:write',
}

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  owner: ['*'], // All permissions
  admin: [...], // All except billing:write
  member: [...], // Read/write repos and analysis
  viewer: [...], // Read-only
};
```

**Middleware:**
```typescript
export const authorize = (requiredPerms: Permission[]) => {
  return async (request, reply) => {
    const userPerms = await getUserPermissions(request.user, request.organization);
    const hasPermission = requiredPerms.every(p => userPerms.includes(p));

    if (!hasPermission) {
      return reply.code(403).send({ error: 'Insufficient permissions' });
    }
  };
};
```

**Implementation:** 2 weeks

### FF-011: API Key Management
**Schema:**
```sql
CREATE TABLE api_keys (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id),
  user_id UUID REFERENCES users(id),
  name TEXT NOT NULL,
  key_prefix VARCHAR(8) NOT NULL, -- First 8 chars for display
  key_hash VARCHAR(64) UNIQUE NOT NULL, -- SHA256 hash
  scopes TEXT[], -- Array of permissions
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Key Format:** `ff_live_1234567890abcdef` (Stripe-style)

**Key Endpoints:**
- `POST /api/v1/api-keys` - Create API key
- `GET /api/v1/api-keys` - List keys
- `DELETE /api/v1/api-keys/:id` - Revoke key
- `POST /api/v1/api-keys/:id/rotate` - Rotate key

**Implementation:** 1 week

### FF-012: Subscription Management
**Schema:**
```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY,
  organization_id UUID UNIQUE REFERENCES organizations(id),
  plan VARCHAR(50) NOT NULL, -- free, team, business, enterprise
  status VARCHAR(20) NOT NULL, -- active, canceled, past_due, trialing

  -- Stripe fields
  stripe_subscription_id VARCHAR(255) UNIQUE,
  stripe_customer_id VARCHAR(255),

  -- Billing
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,

  -- Usage
  seats_purchased INTEGER DEFAULT 0,
  seats_used INTEGER DEFAULT 0,

  trial_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE subscription_items (
  id UUID PRIMARY KEY,
  subscription_id UUID REFERENCES subscriptions(id),
  stripe_price_id VARCHAR(255) NOT NULL,
  quantity INTEGER NOT NULL,
  type VARCHAR(50) NOT NULL -- 'seat', 'usage'
);
```

**Plans:**
```typescript
export const PLANS = {
  free: {
    price: 0,
    seats: 3,
    repositories: 3,
    locPerMonth: 10000,
    features: ['basic_analysis', 'github'],
  },
  team: {
    price: 39, // per seat/month
    seats: 'unlimited',
    repositories: 50,
    locPerMonth: 100000,
    usagePrice: 0.001, // per LOC above limit
    features: ['all_analysis', 'all_integrations', 'email_support'],
  },
  business: {
    price: 99, // per seat/month
    seats: 'unlimited',
    repositories: 'unlimited',
    locPerMonth: 500000,
    usagePrice: 0.0008,
    features: ['all_features', 'sso', 'priority_support', 'sla'],
  },
  enterprise: {
    price: 'custom',
    features: ['all_features', 'on_premise', 'dedicated_support', 'custom_sla'],
  },
};
```

**Key Endpoints:**
- `GET /api/v1/subscriptions/current` - Current subscription
- `POST /api/v1/subscriptions/upgrade` - Upgrade plan
- `POST /api/v1/subscriptions/cancel` - Cancel subscription
- `GET /api/v1/subscriptions/preview` - Preview plan change

**Implementation:** 3 weeks

### FF-013: Usage Tracking & Quotas
**Schema:**
```sql
CREATE TABLE usage_events (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id),
  user_id UUID REFERENCES users(id),
  event_type VARCHAR(50) NOT NULL, -- 'loc_transformed', 'analysis_run', 'api_call'
  quantity INTEGER NOT NULL,
  metadata JSONB,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE usage_quotas (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id),
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,

  -- Current usage
  loc_transformed BIGINT DEFAULT 0,
  analyses_run INTEGER DEFAULT 0,
  api_calls INTEGER DEFAULT 0,

  -- Limits
  loc_limit BIGINT,
  analyses_limit INTEGER,
  api_calls_limit INTEGER,

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Quota Enforcement:**
```typescript
export async function checkQuota(
  organizationId: string,
  eventType: string,
  quantity: number
): Promise<boolean> {
  const quota = await db.usageQuota.findUnique({
    where: { organizationId },
  });

  switch (eventType) {
    case 'loc_transformed':
      return quota.locTransformed + quantity <= quota.locLimit;
    case 'analysis_run':
      return quota.analysesRun + 1 <= quota.analysesLimit;
    default:
      return true;
  }
}

export async function recordUsage(
  organizationId: string,
  eventType: string,
  quantity: number
): Promise<void> {
  await db.usageEvent.create({
    data: { organizationId, eventType, quantity },
  });

  await db.usageQuota.update({
    where: { organizationId },
    data: {
      [eventType]: { increment: quantity },
    },
  });
}
```

**Key Endpoints:**
- `GET /api/v1/usage/current` - Current period usage
- `GET /api/v1/usage/history` - Historical usage
- `GET /api/v1/usage/forecast` - Usage forecast

**Implementation:** 2 weeks

---

## Code Transformation Features

### FF-016: Refactoring Engine
**Schema:**
```sql
CREATE TABLE refactoring_jobs (
  id UUID PRIMARY KEY,
  repository_id UUID REFERENCES repositories(id),
  analysis_run_id UUID REFERENCES analysis_runs(id),
  type VARCHAR(50) NOT NULL, -- 'file_split', 'extract_function', 'reduce_complexity'
  status VARCHAR(20) NOT NULL, -- 'pending', 'running', 'completed', 'failed', 'rolled_back'

  -- Configuration
  target_files TEXT[],
  parameters JSONB,

  -- Results
  branch_name TEXT,
  pr_number INTEGER,
  pr_url TEXT,
  files_changed INTEGER,
  lines_added INTEGER,
  lines_deleted INTEGER,

  -- Approval workflow
  requires_approval BOOLEAN DEFAULT TRUE,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
```

**Refactoring Types:**
1. **File Split** - Break files >500 LOC into modules
2. **Extract Function** - Extract complex functions
3. **Reduce Complexity** - Flatten nested logic
4. **Extract Interface** - Create interfaces from implementations
5. **Add Error Handling** - Wrap risky code in try-catch
6. **Dependency Injection** - Convert to DI pattern

**Implementation:** 4 weeks

### FF-017: Test Generation Engine
**Types:**
- Unit tests (Jest, Vitest, pytest)
- Integration tests
- E2E tests (Playwright, Cypress)

**LLM Prompts:**
```typescript
const UNIT_TEST_PROMPT = `
Generate comprehensive unit tests for this function:

\`\`\`typescript
${functionCode}
\`\`\`

Requirements:
- Test all code paths
- Include edge cases
- Mock external dependencies
- Use ${framework} syntax
- Add descriptive test names
- Achieve >80% coverage
`;
```

**Implementation:** 3 weeks

### FF-018: Documentation Generator
**Types:**
- JSDoc/TSDoc (TypeScript)
- Docstrings (Python)
- JavaDoc (Java)
- GoDoc (Go)
- README.md generation

**Implementation:** 2 weeks

### FF-019: Type Annotation Engine
**Languages:**
- TypeScript (add type hints)
- Python (add type hints with mypy)
- PHP (add type declarations)

**Implementation:** 2 weeks

---

## Integration Features (Phase 2)

### FF-020: GitLab Integration
**Similar to FF-003 (GitHub) but for GitLab:**
- OAuth 2.0 authentication
- Repository connection
- Webhook handling (push, merge_request, pipeline)
- MR automation

**Implementation:** 2 weeks

### FF-021: Bitbucket Integration
**Similar structure to GitHub/GitLab**

**Implementation:** 2 weeks

### FF-022: Azure DevOps Integration
**Microsoft-centric enterprises**
- Azure Repos
- Azure Pipelines
- Work Items

**Implementation:** 3 weeks

### FF-023: Jira Integration
**Schema:**
```sql
CREATE TABLE jira_connections (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id),
  jira_url TEXT NOT NULL,
  access_token_encrypted TEXT NOT NULL,
  default_project VARCHAR(50)
);

CREATE TABLE issue_linkages (
  id UUID PRIMARY KEY,
  source_type VARCHAR(50) NOT NULL, -- 'analysis', 'refactoring', 'security_finding'
  source_id UUID NOT NULL,
  jira_issue_key VARCHAR(50) NOT NULL,
  jira_issue_url TEXT NOT NULL
);
```

**Auto-create Issues:**
- Critical security findings
- Failed refactorings
- Test coverage gaps

**Implementation:** 2 weeks

### FF-024: Slack Integration
**Features:**
- OAuth bot installation
- Slash commands (`/forge analyze`, `/forge status`)
- Interactive messages (approve refactorings)
- Notifications (analysis complete, PR created)

**Implementation:** 2 weeks

### FF-025: Microsoft Teams Integration
**Similar to Slack with Adaptive Cards**

**Implementation:** 2 weeks

---

## Analytics & Reporting

### FF-026: Analytics Dashboard
**Metrics:**
- AI-Readiness trends over time
- Team productivity (PRs, LOC transformed)
- Cost analysis (LLM usage, compute)
- Repository health scores
- Leaderboards

**Visualizations:**
- Line charts (trends)
- Bar charts (comparisons)
- Heatmaps (problem areas)
- Radar charts (metrics breakdown)

**Implementation:** 3 weeks

### FF-027: Custom Reports
**Export Formats:**
- PDF (for executives)
- CSV (for analysis)
- JSON (for APIs)

**Report Types:**
- Monthly summary
- Quarterly business review
- Compliance audit trail

**Implementation:** 2 weeks

### FF-028: Team Leaderboards
**Gamification:**
- Points for improvements
- Badges for milestones
- Team rankings
- Contribution graphs

**Implementation:** 1 week

---

## Developer Tools

### FF-029: CLI Tool
**Commands:**
```bash
forge login
forge init [repo]
forge analyze [--watch]
forge refactor [type]
forge test generate
forge status
forge logs
```

**Implementation:** 3 weeks

### FF-030: VS Code Extension
**Features:**
- Inline AI-Readiness scores
- Quick actions (analyze, refactor)
- Problem highlighting
- Code suggestions

**Implementation:** 4 weeks

### FF-031: JetBrains Plugin
**Similar to VS Code for IntelliJ, PyCharm, WebStorm**

**Implementation:** 4 weeks

### FF-032: Webhooks
**Events:**
- `analysis.completed`
- `refactoring.completed`
- `pr.created`
- `pr.merged`
- `test.generated`

**Payload:**
```json
{
  "event": "analysis.completed",
  "timestamp": "2024-01-01T00:00:00Z",
  "data": {
    "analysis_id": "...",
    "repository_id": "...",
    "score": 75
  }
}
```

**Implementation:** 1 week

### FF-033: Public API Documentation
**Auto-generated from OpenAPI spec**
- Interactive docs (Swagger UI)
- SDKs (TypeScript, Python, Go)
- Code examples
- Postman collection

**Implementation:** 2 weeks

---

## Enterprise Features

### FF-034: Audit Logging
**All actions logged:**
- User authentication
- Resource access
- Data modifications
- Configuration changes
- API calls

**Retention:** 1 year (configurable)
**Immutable:** Write-once storage

**Implementation:** 2 weeks

### FF-035: Compliance Reports
**SOC 2 Type II:**
- Access control reports
- Change management logs
- Incident reports
- Risk assessments

**ISO 27001:**
- ISMS documentation
- Control evidence
- Audit trails

**Implementation:** 3 weeks

### FF-036: Data Residency
**Regions:**
- US (us-east-1, us-west-2)
- EU (eu-west-1)
- APAC (ap-southeast-1)

**Customer chooses:** Data storage region, backup region

**Implementation:** 4 weeks

### FF-037: On-Premise Deployment
**Kubernetes-based:**
- Helm charts
- Docker Compose (dev)
- Installation guide
- Update mechanism
- Air-gapped support

**Implementation:** 8 weeks

---

## Total Implementation Timeline

**Phase 1 (P0):** 24 weeks (6 months)
**Phase 2 (P1):** 30 weeks (7.5 months)
**Phase 3 (P2):** 36 weeks (9 months)

**Total:** 90 weeks (22.5 months) with 6-8 engineers

**Parallel Development:** With proper team structure, can compress to:
- Phase 1: 12 weeks (3 months)
- Phase 2: 16 weeks (4 months)
- Phase 3: 20 weeks (5 months)

**Total Compressed:** 48 weeks (12 months) with 12-15 engineers

---

**Status:** Feature catalog complete - ready for detailed ADR creation
