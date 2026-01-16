# The Forge Method v4.1
## Feature-Oriented Rapid Generation Engine

### The Complete Production-Grade Approach to AI-Native Enterprise SaaS Development

---

## Table of Contents

1. [What is Forge?](#what-is-forge)
2. [Core Principles](#core-principles)
3. [The Forge Stack](#the-forge-stack)
4. [Project Structure](#project-structure)
5. [Package Specifications](#package-specifications)
   - [Core Packages](#core-packages)
   - [Data Packages](#data-packages)
   - [Communication Packages](#communication-packages)
   - [Enterprise Packages](#enterprise-packages)
   - [Analytics Packages](#analytics-packages)
   - [Customer Experience Packages](#customer-experience-packages)
   - [Governance Packages](#governance-packages)
6. [Forge Generators](#forge-generators)
7. [The 32 Laws of the Forge](#the-32-laws-of-the-forge)
8. [Developer Experience](#developer-experience)
9. [Data & State Management](#data--state-management)
10. [Database Architecture](#database-architecture)
11. [Multi-Region Architecture](#multi-region-architecture)
12. [Security](#security)
13. [Operations](#operations)
14. [Performance](#performance)
15. [Testing Strategy](#testing-strategy)
16. [Documentation Standards](#documentation-standards)
17. [Forge Workflow](#forge-workflow)
18. [First Forge: Organization Management](#first-forge-organization-management)
19. [Architecture Decision Records](#architecture-decision-records)
20. [Glossary](#glossary)
21. [Execution Directive](#execution-directive)

---

## What is Forge?

**Forge** is a methodology for building enterprise SaaS applications where:

- **AI generates 70-95% of code** — but every line traces back to a prompt or human decision
- **Vertical slices ship complete** — not layers that integrate later
- **Compliance is foundational** — not retrofitted
- **Enterprise features are built-in** — SSO, multi-region, white-labeling, custom roles from day one
- **Service extraction is planned** — not premature

The name reflects the process: raw requirements enter the forge, generators shape them, AI provides the heat, and production-grade features emerge.

### Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Multi-tenancy | Region-aware, tenant isolation at data + application layer |
| Multi-region | Data residency compliance (EU, US, APAC) |
| Compliance | SOC-2 / GDPR / HIPAA / CCPA ready from day one |
| First slice delivery | < 2 days of work |
| Local dev startup | < 60 seconds on M1 Mac |
| API latency | p99 < 400ms at 500 rps |
| Core Web Vitals | LCP < 2.5s, FID < 100ms, CLS < 0.1 |
| Bundle size | < 200KB initial JS (gzipped) |
| Deployment frequency | Multiple times per day |
| MTTR | < 1 hour for SEV1 |
| Uptime target | 99.9% (8.76 hours downtime/year) |
| i18n | Support for 10+ languages, RTL-ready |
| Database connections | Pooled, max 80% utilization |

---

## Core Principles

### 1. Scaffold First, Feature Never

Before writing any feature code, establish:
- Project structure with all packages
- Design system tokens and base components
- Testing infrastructure and factories
- Admin module (grows with features, not bolted on)
- Compliance utilities (audit, consent, retention, SIEM export)
- Operational tooling (observability, deployment, runbooks)
- Enterprise foundations (SSO, i18n, multi-region, custom roles)
- Governance (approval workflows, sandbox environments)

The scaffold is the **mold**. Every feature poured into it takes the same shape.

### 2. Vertical Over Horizontal

Never build:
- All UI, then all API, then all tests

Always build:
- One complete feature: schema + API + UI + admin + tests + docs + translations

One PR. Fully integrated. Shippable.

### 3. Trace Everything

Every line of code traces to either:
- A **prompt-id** linking to the versioned prompt that generated it
- A **human decision record** explaining why a human wrote it

No orphan code. No "I don't know why this is here."

### 4. CI as Constitution

Rules are meaningless without enforcement. The CI pipeline is the constitution:
- Circular dependencies → fail
- Missing audit calls → fail
- Uncovered AI-generated code → fail
- Missing feature flag → fail
- Security vulnerabilities → fail
- Accessibility violations → fail
- Performance budget exceeded → fail
- Missing translations → fail

If it matters, CI checks it.

### 5. Generators as Institutional Knowledge

Patterns live in generators, not documentation. When you solve a problem well:
1. Extract the pattern into a generator
2. Link it to the prompt that created it
3. Now every future feature inherits the solution

The codebase gets smarter with every slice.

### 6. Operations are Features

Deployment pipelines, runbooks, monitoring dashboards — these aren't afterthoughts. They're features that ship alongside code. A feature isn't done until it's observable, deployable, and recoverable.

### 7. Enterprise-Ready from Day One

Don't bolt on enterprise features later. SSO, audit logs, white-labeling, multi-region, custom roles, approval workflows — build the hooks from the start. The cost of retrofitting is 10x the cost of including.

---

## The Forge Stack

### Core Runtime

| Layer | Technology | Version |
|-------|------------|---------|
| Package manager | PNPM | workspace mode |
| Language | TypeScript | 5.6 |
| Runtime | Node.js | 22 LTS |
| Orchestration | NX | latest |

### Applications

| App | Technology | Purpose |
|-----|------------|---------|
| API | NestJS | REST + tRPC hybrid, tenant-aware |
| Portal | React 19 | Customer SPA |
| Admin | React-Admin | Operations SPA |
| Docs | Mintlify | API docs, guides, changelog |
| Developer Portal | Custom | API keys, webhooks, OAuth apps |

### API Strategy

| Consumer | Approach | Documentation |
|----------|----------|---------------|
| Portal / Admin (internal) | tRPC | Type inference, no codegen |
| External integrations | NestJS REST | OpenAPI 3.1 via `@nestjs/swagger` |
| Webhooks (outbound) | Custom | Event catalog, signed payloads |
| Real-time | WebSocket | Socket.io with Redis adapter |

### Data Layer

| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| Primary database | PostgreSQL | 16 | ACID, JSON, RLS |
| Connection pooling | PgBouncer | 1.22 | Connection management |
| ORM | Prisma | 6 | Type-safe queries |
| Cache | Redis | 7 | Sessions, rate limiting, cache |
| Search | PostgreSQL FTS → Typesense | — | Full-text search |
| Queue | BullMQ | 5 | Background jobs |
| File storage | S3 / R2 | — | Uploads, exports |
| Real-time | Redis Pub/Sub | 7 | Presence, live updates |

### Frontend

| Component | Technology | Purpose |
|-----------|------------|---------|
| Framework | React 19 | UI library |
| Routing | React Router 7 | Navigation |
| State | Zustand + React Query | Client + server state |
| Styling | Tailwind CSS | Utility-first CSS |
| Components | Radix UI | Accessible primitives |
| Forms | React Hook Form + Zod | Form handling |
| i18n | react-i18next | Internationalization |
| Charts | Recharts | Data visualization |

### Testing

| Type | Tool | Purpose |
|------|------|---------|
| Unit | Vitest | Fast, ESM-native |
| Integration | MSW | API mocking |
| E2E | Playwright | Cross-browser |
| Property | fast-check | Invariants |
| Visual regression | Chromatic | Design consistency |
| Load | k6 | Performance |
| Contract | Pact | External consumers |
| Chaos | Gremlin / custom | Resilience |
| Accessibility | axe-core | WCAG compliance |
| Synthetic | Checkly | Prod monitoring |
| Performance | Lighthouse CI | Web vitals |

### Security

| Purpose | Tool |
|---------|------|
| Secret scanning | gitleaks |
| Dependency vulnerabilities | Snyk / Socket |
| Dependency updates | Renovate |
| SAST | Semgrep |
| Container scanning | Trivy |
| WAF | AWS WAF |
| DDoS protection | CloudFront + Shield |

### Observability

| Signal | Tool |
|--------|------|
| Traces | OpenTelemetry → Tempo |
| Metrics | Prometheus |
| Logs | Loki |
| Errors | Sentry |
| Alerts | PagerDuty |
| Status page | Instatus |
| Synthetic monitoring | Checkly |
| Product analytics | PostHog |
| Session replay | PostHog |
| SIEM export | Splunk / Datadog / custom |

### Infrastructure

| Component | Technology |
|-----------|------------|
| CI/CD | GitHub Actions |
| Auth provider | Auth0 (with SAML/SCIM) |
| Compute | AWS ECS Fargate |
| CDN | CloudFront |
| WAF | AWS WAF |
| Secrets | AWS Secrets Manager |
| IaC | Terraform |
| Feature flags | Unleash |
| Billing | Stripe |
| Email | SendGrid / SES |
| SMS | Twilio |
| Connection pooling | PgBouncer (RDS Proxy) |

---

## Project Structure

```
apps/
  api/                           – NestJS API server
    src/
      modules/                   – Feature modules (slices land here)
      common/                    – Guards, interceptors, filters
      trpc/                      – tRPC router (internal clients)
      webhooks/                  – Inbound webhook handlers
      websocket/                 – Real-time gateway
  portal/                        – Customer React SPA
  admin/                         – React-Admin operations SPA
  docs/                          – API documentation site
  developer-portal/              – API keys, OAuth apps, webhooks UI

packages/
  # === Core Packages ===
  auth/                          – RBAC, API keys, OAuth, SSO, SCIM, sessions
  billing/                       – Stripe, metering, entitlements, SLA
  cache/                         – Redis patterns, invalidation
  compliance/                    – Audit, consent, retention, export, legal
  design-system/                 – Tokens, components, stories, themes
  errors/                        – Typed error codes, serialization
  eslint-config/                 – Linting rules
  feature-flags/                 – Evaluation, plan-gating, A/B tests
  prisma/                        – Schema, migrations, tenant isolation
  shared-types/                  – Branded types, Prisma types
  forge-generators/              – NX generators (@forge/nx:*)

  # === Data Packages ===
  database/                      – Connection pooling, health checks, migrations
  queue/                         – Job definitions, processors, DLQ
  search/                        – Full-text search abstraction
  storage/                       – S3 abstraction, signed URLs, scanning
  import/                        – Bulk import, validation, preview
  realtime/                      – WebSocket, presence, pub/sub

  # === Communication Packages ===
  notifications/                 – Email, in-app, SMS, push, Slack, Teams
  webhooks-outbound/             – Event catalog, delivery, signatures

  # === Enterprise Packages ===
  i18n/                          – Translations, locale, formatting
  sso/                           – SAML, SCIM, directory sync
  white-label/                   – Custom domains, branding, themes
  multi-region/                  – Data residency, region routing
  ip-allowlist/                  – IP restrictions, access control
  siem/                          – Audit log export, SIEM integration

  # === Governance Packages ===
  roles/                         – Custom roles builder, permission management
  approvals/                     – Approval workflows, request management
  sandbox/                       – Demo/trial environments, data isolation

  # === Analytics Packages ===
  analytics/                     – Product analytics, tracking
  ab-testing/                    – Experiment framework

  # === Customer Experience Packages ===
  support/                       – Help desk integration, tickets
  feedback/                      – In-app feedback, NPS, feature requests
  changelog/                     – Product updates, release notes
  legal/                         – ToS, Privacy Policy, DPA tracking

tools/
  adrs/                          – Architecture Decision Records
    ADR-001-vertical-slice-architecture.md
    ADR-002-api-strategy.md
    ADR-003-tenant-isolation.md
    ADR-004-caching-strategy.md
    ADR-005-deployment-strategy.md
    ADR-006-multi-region.md
    ADR-007-i18n-strategy.md
    ADR-008-sso-architecture.md
    ADR-009-connection-pooling.md
    ADR-010-custom-roles.md
    ADR-011-approval-workflows.md
    ADR-012-sandbox-environments.md
    review-queue.md
  diagrams/                      – C4, data flow, architecture visuals
  docker/                        – Local development environment
  ide/                           – VS Code, Cursor configurations
  k6/                            – Load test scripts
  chaos/                         – Chaos test definitions
  lighthouse/                    – Performance budget configs
  onboarding/                    – New engineer guides
  prompts/                       – Versioned AI prompts
  runbooks/                      – Incident response
  terraform/
    modules/
      region/                    – Per-region infrastructure
      global/                    – Global resources (DNS, CDN)
      pgbouncer/                 – Connection pooling
    environments/
      dev/
      staging/
      prod-us/
      prod-eu/
      prod-apac/
  translations/                  – Source translation files
  legal/                         – Legal document templates

.env.example                     – Documented environment variables
.nvmrc                           – Node version pinning
CLAUDE.md                        – AI assistant conventions
FORGE.md                         – Methodology documentation
SECURITY.md                      – Security policies
```

---

## Package Specifications

### Core Packages

#### packages/auth

Complete authentication and authorization with enterprise SSO and custom roles.

```typescript
// === Branded Types ===
type TenantId = string & { __brand: 'TenantId' };
type UserId = string & { __brand: 'UserId' };
type SessionId = string & { __brand: 'SessionId' };
type ApiKeyId = string & { __brand: 'ApiKeyId' };
type RoleId = string & { __brand: 'RoleId' };
type Permission = string & { __brand: 'Permission' };

// === Request Context ===
interface RequestContext {
  tenantId: TenantId;
  userId: UserId;
  sessionId: SessionId;
  permissions: Permission[];
  roles: RoleId[];
  authMethod: 'jwt' | 'api_key' | 'oauth' | 'saml';
  impersonatedBy?: UserId;
  apiKeyId?: ApiKeyId;
  scopes?: string[];
  locale: string;
  timezone: string;
  region: Region;
}

// === Session Management ===
interface Session {
  id: SessionId;
  userId: UserId;
  tenantId: TenantId;
  deviceInfo: DeviceInfo;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
  lastActiveAt: Date;
  expiresAt: Date;
  revokedAt?: Date;
}

interface SessionService {
  create(userId: UserId, deviceInfo: DeviceInfo): Promise<Session>;
  validate(sessionId: SessionId): Promise<Session | null>;
  revoke(sessionId: SessionId): Promise<void>;
  revokeAll(userId: UserId): Promise<void>;
  list(userId: UserId): Promise<Session[]>;
  getActive(userId: UserId): Promise<number>;
}

// === Session Limits (per plan) ===
const SessionLimits = {
  free: 3,
  pro: 10,
  enterprise: 'unlimited',
};

// === API Key Management ===
interface ApiKey {
  id: ApiKeyId;
  tenantId: TenantId;
  name: string;
  prefix: string;
  hashedKey: string;
  scopes: string[];
  ipAllowlist?: string[];
  lastUsedAt?: Date;
  expiresAt?: Date;
  createdBy: UserId;
}

// === OAuth Provider ===
interface OAuthClient {
  clientId: string;
  clientSecret: string;
  name: string;
  description: string;
  logoUrl?: string;
  redirectUris: string[];
  scopes: string[];
  tenantId: TenantId;
  published: boolean;
  createdBy: UserId;
}

// === Guards ===
@TenantGuard()
@PermissionGuard('org:write')
@RoleGuard('admin')
@RateLimitGuard({ points: 100, duration: 60 })
@ApiKeyGuard({ scopes: ['read:orgs'] })
@IpAllowlistGuard()
@SessionLimitGuard()
@ApprovalRequiredGuard('sensitive_action')  // Triggers approval workflow
```

**Exports:**
- `AuthModule` — NestJS module
- All guards
- `RequestContext` — Type + injection token
- `SessionService` — Session management
- `ApiKeyService` — API key CRUD
- `OAuthService` — OAuth2 server

---

#### packages/sso

Enterprise Single Sign-On with SAML 2.0 and SCIM.

```typescript
// === SAML Configuration (per tenant) ===
interface SamlConfig {
  tenantId: TenantId;
  enabled: boolean;
  idpEntityId: string;
  idpSsoUrl: string;
  idpCertificate: string;
  spEntityId: string;
  spAcsUrl: string;
  attributeMapping: {
    email: string;
    firstName: string;
    lastName: string;
    groups?: string;
  };
  defaultRoleId: RoleId;       // Uses custom role
  jitProvisioning: boolean;
  forceSso: boolean;
}

// === SCIM Configuration ===
interface ScimConfig {
  tenantId: TenantId;
  enabled: boolean;
  bearerToken: string;
  baseUrl: string;
  syncGroups: boolean;
  groupToRoleMapping: Record<string, RoleId>;  // Maps IdP groups to custom roles
}

// === SCIM Endpoints ===
// GET    /scim/v2/Users
// POST   /scim/v2/Users
// GET    /scim/v2/Users/:id
// PATCH  /scim/v2/Users/:id
// DELETE /scim/v2/Users/:id
// GET    /scim/v2/Groups
// POST   /scim/v2/Groups
// PATCH  /scim/v2/Groups/:id
// DELETE /scim/v2/Groups/:id

// === Directory Sync ===
interface DirectorySync {
  tenantId: TenantId;
  provider: 'okta' | 'azure_ad' | 'google_workspace' | 'onelogin';
  lastSyncAt?: Date;
  syncStatus: 'idle' | 'syncing' | 'error';
  userCount: number;
  groupCount: number;
}

// === SSO Service ===
interface SsoService {
  initiateSamlLogin(tenantId: TenantId): Promise<string>;
  handleSamlCallback(samlResponse: string): Promise<User>;
  handleScimRequest(req: ScimRequest): Promise<ScimResponse>;
  triggerSync(tenantId: TenantId): Promise<void>;
  getSyncStatus(tenantId: TenantId): Promise<DirectorySync>;
}
```

**Exports:**
- `SsoModule` — NestJS module
- `SamlController` — SAML endpoints
- `ScimController` — SCIM 2.0 endpoints
- `SsoService` — Core SSO logic
- `DirectorySyncService` — Sync management

---

### Governance Packages

#### packages/roles

Custom roles builder with granular permissions.

```typescript
// === Permission Definition ===
interface PermissionDefinition {
  key: string;                   // e.g., 'organizations:write'
  name: string;                  // e.g., 'Create and edit organizations'
  description: string;
  category: PermissionCategory;
  dependencies?: string[];       // Other permissions required
  dangerous?: boolean;           // Requires additional confirmation
}

type PermissionCategory = 
  | 'organizations'
  | 'users'
  | 'billing'
  | 'settings'
  | 'integrations'
  | 'admin'
  | 'compliance';

// === Permission Catalog ===
const PermissionCatalog: PermissionDefinition[] = [
  // Organizations
  { key: 'organizations:read', name: 'View organizations', category: 'organizations' },
  { key: 'organizations:write', name: 'Create and edit organizations', category: 'organizations', dependencies: ['organizations:read'] },
  { key: 'organizations:delete', name: 'Delete organizations', category: 'organizations', dependencies: ['organizations:write'], dangerous: true },
  { key: 'organizations:archive', name: 'Archive organizations', category: 'organizations', dependencies: ['organizations:write'] },
  
  // Users
  { key: 'users:read', name: 'View users', category: 'users' },
  { key: 'users:invite', name: 'Invite users', category: 'users', dependencies: ['users:read'] },
  { key: 'users:edit', name: 'Edit user details', category: 'users', dependencies: ['users:read'] },
  { key: 'users:remove', name: 'Remove users', category: 'users', dependencies: ['users:edit'], dangerous: true },
  { key: 'users:manage_roles', name: 'Assign roles to users', category: 'users', dependencies: ['users:edit'] },
  
  // Billing
  { key: 'billing:read', name: 'View billing information', category: 'billing' },
  { key: 'billing:manage', name: 'Manage subscriptions and payments', category: 'billing', dependencies: ['billing:read'] },
  
  // Settings
  { key: 'settings:read', name: 'View settings', category: 'settings' },
  { key: 'settings:write', name: 'Edit settings', category: 'settings', dependencies: ['settings:read'] },
  { key: 'settings:sso', name: 'Configure SSO', category: 'settings', dependencies: ['settings:write'] },
  { key: 'settings:branding', name: 'Configure branding', category: 'settings', dependencies: ['settings:write'] },
  
  // Integrations
  { key: 'integrations:read', name: 'View integrations', category: 'integrations' },
  { key: 'integrations:manage', name: 'Manage integrations and API keys', category: 'integrations', dependencies: ['integrations:read'] },
  { key: 'webhooks:manage', name: 'Manage webhooks', category: 'integrations', dependencies: ['integrations:read'] },
  
  // Admin
  { key: 'audit:read', name: 'View audit logs', category: 'admin' },
  { key: 'audit:export', name: 'Export audit logs', category: 'admin', dependencies: ['audit:read'] },
  { key: 'impersonate', name: 'Impersonate users', category: 'admin', dangerous: true },
  
  // Compliance
  { key: 'compliance:read', name: 'View compliance settings', category: 'compliance' },
  { key: 'compliance:manage', name: 'Manage data retention and export', category: 'compliance', dependencies: ['compliance:read'] },
];

// === Role Definition ===
interface Role {
  id: RoleId;
  tenantId: TenantId;
  
  // Metadata
  name: string;
  description: string;
  color: string;                 // For UI display
  icon?: string;
  
  // Permissions
  permissions: Permission[];
  
  // System role flags
  isSystem: boolean;             // Cannot be edited/deleted
  isDefault: boolean;            // Assigned to new users
  
  // Limits (for plan-gated features)
  inheritsFrom?: RoleId;         // For role hierarchy
  
  // Audit
  createdAt: Date;
  updatedAt: Date;
  createdBy: UserId;
  updatedBy?: UserId;
}

// === System Roles (pre-defined, cannot be deleted) ===
const SystemRoles = {
  OWNER: {
    name: 'Owner',
    description: 'Full access to all features. Cannot be removed.',
    permissions: ['*'],  // All permissions
    isSystem: true,
  },
  ADMIN: {
    name: 'Admin',
    description: 'Full access except owner-only actions.',
    permissions: PermissionCatalog.filter(p => p.key !== 'impersonate').map(p => p.key),
    isSystem: true,
  },
  MEMBER: {
    name: 'Member',
    description: 'Standard access for team members.',
    permissions: ['organizations:read', 'users:read', 'settings:read'],
    isSystem: true,
    isDefault: true,
  },
  VIEWER: {
    name: 'Viewer',
    description: 'Read-only access.',
    permissions: ['organizations:read', 'users:read'],
    isSystem: true,
  },
};

// === Role Service ===
interface RoleService {
  // CRUD
  create(tenantId: TenantId, role: CreateRoleDto): Promise<Role>;
  update(roleId: RoleId, updates: UpdateRoleDto): Promise<Role>;
  delete(roleId: RoleId): Promise<void>;
  list(tenantId: TenantId): Promise<Role[]>;
  get(roleId: RoleId): Promise<Role>;
  
  // Assignment
  assignToUser(userId: UserId, roleId: RoleId): Promise<void>;
  removeFromUser(userId: UserId, roleId: RoleId): Promise<void>;
  getUserRoles(userId: UserId): Promise<Role[]>;
  
  // Permissions
  getUserPermissions(userId: UserId): Promise<Permission[]>;
  hasPermission(userId: UserId, permission: Permission): Promise<boolean>;
  hasAnyPermission(userId: UserId, permissions: Permission[]): Promise<boolean>;
  hasAllPermissions(userId: UserId, permissions: Permission[]): Promise<boolean>;
  
  // Validation
  validatePermissions(permissions: Permission[]): ValidationResult;
  getDependencies(permission: Permission): Permission[];
  
  // Catalog
  getPermissionCatalog(): PermissionDefinition[];
}

// === React Components ===
// <RoleBuilder /> — Visual role editor with permission picker
// <PermissionPicker /> — Category-organized permission selector
// <RoleAssignment /> — Assign roles to users
// <RoleBadge /> — Display role with color
// <PermissionGate /> — Conditionally render based on permission
```

**Exports:**
- `RolesModule` — NestJS module
- `RoleService` — Core logic
- `RoleGuard`, `PermissionGuard` — Guards
- `PermissionCatalog` — Permission definitions
- React components for role management

---

#### packages/approvals

Approval workflows for sensitive operations.

```typescript
// === Approval Policy ===
interface ApprovalPolicy {
  id: string;
  tenantId: TenantId;
  
  // Trigger
  name: string;
  description: string;
  triggerAction: ApprovalTrigger;
  
  // Conditions (when to require approval)
  conditions?: ApprovalCondition[];
  
  // Approvers
  approverType: 'role' | 'user' | 'manager' | 'custom';
  approverRoleId?: RoleId;
  approverUserIds?: UserId[];
  
  // Settings
  requiredApprovals: number;     // How many approvers needed
  autoApproveAfter?: number;     // Hours, null = never
  autoRejectAfter?: number;      // Hours, null = never
  allowSelfApproval: boolean;
  
  // Notifications
  notifyOnRequest: boolean;
  notifyOnApproval: boolean;
  notifyOnRejection: boolean;
  
  // Status
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

type ApprovalTrigger = 
  | 'user.delete'
  | 'user.role_change'
  | 'organization.delete'
  | 'billing.plan_change'
  | 'settings.sso_change'
  | 'api_key.create'
  | 'data_export.request'
  | 'custom';

interface ApprovalCondition {
  field: string;                 // e.g., 'user.role', 'amount'
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'contains';
  value: unknown;
}

// === Approval Request ===
interface ApprovalRequest {
  id: string;
  tenantId: TenantId;
  policyId: string;
  
  // Request details
  action: ApprovalTrigger;
  resourceType: string;
  resourceId: string;
  requestedChanges: Record<string, unknown>;
  justification?: string;
  
  // Requester
  requestedBy: UserId;
  requestedAt: Date;
  
  // Status
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled';
  
  // Approvals
  approvals: Approval[];
  requiredApprovals: number;
  
  // Resolution
  resolvedAt?: Date;
  resolvedBy?: UserId;
  resolutionNote?: string;
  
  // Execution
  executedAt?: Date;
  executionError?: string;
}

interface Approval {
  approverId: UserId;
  decision: 'approved' | 'rejected';
  decidedAt: Date;
  note?: string;
}

// === Approval Service ===
interface ApprovalService {
  // Policies
  createPolicy(policy: CreatePolicyDto): Promise<ApprovalPolicy>;
  updatePolicy(policyId: string, updates: UpdatePolicyDto): Promise<ApprovalPolicy>;
  deletePolicy(policyId: string): Promise<void>;
  listPolicies(tenantId: TenantId): Promise<ApprovalPolicy[]>;
  
  // Check if action needs approval
  requiresApproval(tenantId: TenantId, action: ApprovalTrigger, context: unknown): Promise<ApprovalPolicy | null>;
  
  // Requests
  createRequest(request: CreateRequestDto): Promise<ApprovalRequest>;
  approve(requestId: string, approverId: UserId, note?: string): Promise<ApprovalRequest>;
  reject(requestId: string, approverId: UserId, note?: string): Promise<ApprovalRequest>;
  cancel(requestId: string, userId: UserId): Promise<ApprovalRequest>;
  
  // Queries
  getPendingRequests(approverId: UserId): Promise<ApprovalRequest[]>;
  getMyRequests(userId: UserId): Promise<ApprovalRequest[]>;
  getRequest(requestId: string): Promise<ApprovalRequest>;
  
  // Execution (after approval)
  executeApprovedAction(requestId: string): Promise<void>;
}

// === Approval Guard (for API endpoints) ===
@ApprovalRequired('user.delete')
async deleteUser(userId: UserId) {
  // If policy exists for this action:
  // 1. Create approval request instead of executing
  // 2. Return 202 Accepted with request ID
  // 3. Execute when approved
}

// === Workflow Integration ===
// When action triggers approval:
// 1. Create ApprovalRequest
// 2. Notify approvers (email, in-app, Slack)
// 3. Approvers review in Admin UI or via email link
// 4. When threshold met, execute action automatically
// 5. Notify requester of outcome

// === React Components ===
// <ApprovalPolicyBuilder /> — Create/edit policies
// <ApprovalRequestList /> — Pending approvals inbox
// <ApprovalRequestDetail /> — Review and decide
// <ApprovalTimeline /> — History of approvals
// <RequestApprovalModal /> — Request with justification
```

**Exports:**
- `ApprovalsModule` — NestJS module
- `ApprovalService` — Core logic
- `ApprovalRequiredGuard` — Guard for endpoints
- `@ApprovalRequired` — Decorator
- React components for approval UI

---

#### packages/sandbox

Demo and trial environments with data isolation.

```typescript
// === Sandbox Environment ===
interface SandboxEnvironment {
  id: string;
  tenantId: TenantId;
  
  // Metadata
  name: string;
  description?: string;
  type: SandboxType;
  
  // Lifecycle
  status: 'creating' | 'active' | 'expired' | 'deleted';
  createdAt: Date;
  expiresAt: Date;
  lastAccessedAt?: Date;
  
  // Data
  seedDataSet: string;           // Which seed data to use
  dataIsolationLevel: 'full' | 'shared_schema';
  
  // Access
  createdBy: UserId;
  accessibleBy: UserId[];
  publicAccessToken?: string;    // For demo links
  
  // Limits
  maxUsers: number;
  maxApiCalls: number;
  
  // Reset
  autoResetInterval?: number;    // Hours, null = never
  lastResetAt?: Date;
}

type SandboxType = 
  | 'trial'           // New customer trial
  | 'demo'            // Sales demo
  | 'development'     // Developer testing
  | 'training';       // User training

// === Seed Data Sets ===
interface SeedDataSet {
  id: string;
  name: string;
  description: string;
  
  // What to create
  organizations: number;
  usersPerOrg: number;
  dataPerOrg: SeedDataConfig;
  
  // Personas
  personas: SeedPersona[];
}

interface SeedPersona {
  email: string;
  name: string;
  roleId: RoleId;
  password: string;              // Default password for demos
}

const DefaultSeedDataSets: SeedDataSet[] = [
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Just the basics - 1 org, 2 users',
    organizations: 1,
    usersPerOrg: 2,
    dataPerOrg: { light: true },
    personas: [
      { email: 'admin@demo.com', name: 'Demo Admin', roleId: 'admin', password: 'demo123' },
      { email: 'user@demo.com', name: 'Demo User', roleId: 'member', password: 'demo123' },
    ],
  },
  {
    id: 'realistic',
    name: 'Realistic',
    description: 'Realistic data for demos - 3 orgs, varied data',
    organizations: 3,
    usersPerOrg: 5,
    dataPerOrg: { realistic: true },
    personas: [
      { email: 'ceo@acme.demo', name: 'Jane Smith', roleId: 'owner', password: 'demo123' },
      { email: 'manager@acme.demo', name: 'John Doe', roleId: 'admin', password: 'demo123' },
      { email: 'employee@acme.demo', name: 'Bob Wilson', roleId: 'member', password: 'demo123' },
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Large-scale data for enterprise demos',
    organizations: 10,
    usersPerOrg: 20,
    dataPerOrg: { large: true },
    personas: [/* ... */],
  },
];

// === Sandbox Service ===
interface SandboxService {
  // Lifecycle
  create(tenantId: TenantId, options: CreateSandboxDto): Promise<SandboxEnvironment>;
  delete(sandboxId: string): Promise<void>;
  extend(sandboxId: string, hours: number): Promise<SandboxEnvironment>;
  
  // Data
  reset(sandboxId: string): Promise<void>;
  changeSeedData(sandboxId: string, seedDataSetId: string): Promise<void>;
  
  // Access
  generateAccessLink(sandboxId: string): Promise<string>;
  revokeAccessLink(sandboxId: string): Promise<void>;
  addUser(sandboxId: string, userId: UserId): Promise<void>;
  removeUser(sandboxId: string, userId: UserId): Promise<void>;
  
  // Queries
  list(tenantId: TenantId): Promise<SandboxEnvironment[]>;
  get(sandboxId: string): Promise<SandboxEnvironment>;
  getByAccessToken(token: string): Promise<SandboxEnvironment | null>;
  
  // Auto-cleanup
  cleanupExpired(): Promise<number>;  // Returns count deleted
}

// === Sandbox Middleware ===
// Detects sandbox context from:
// 1. Subdomain: sandbox-{id}.app.forge.io
// 2. Header: X-Sandbox-Id
// 3. Query param: ?sandbox={id}
// 4. Access token: ?demo={token}

// Injects sandbox context into request:
interface SandboxContext {
  sandboxId: string;
  isDemo: boolean;
  restrictions: SandboxRestrictions;
}

interface SandboxRestrictions {
  canInviteRealUsers: false;
  canConnectRealIntegrations: false;
  canExportData: false;
  canAccessBilling: false;
  watermarkEnabled: true;
}

// === Trial to Paid Conversion ===
interface TrialConversionService {
  // Check trial status
  getTrialStatus(tenantId: TenantId): Promise<TrialStatus>;
  
  // Extend trial (sales override)
  extendTrial(tenantId: TenantId, days: number, reason: string): Promise<void>;
  
  // Convert to paid
  convertToPaid(tenantId: TenantId, planId: string): Promise<void>;
  
  // Migrate data from sandbox to production
  migrateData(sandboxId: string, targetTenantId: TenantId): Promise<MigrationResult>;
}

interface TrialStatus {
  isActive: boolean;
  daysRemaining: number;
  expiresAt: Date;
  canExtend: boolean;
  extensionsUsed: number;
  maxExtensions: number;
}

// === React Components ===
// <SandboxBanner /> — "You're in a demo environment" banner
// <SandboxManager /> — Create/manage sandboxes (admin)
// <TrialCountdown /> — Days remaining in trial
// <DemoAccessLink /> — Generate shareable demo link
// <SandboxWatermark /> — Watermark for screenshots
```

**Exports:**
- `SandboxModule` — NestJS module
- `SandboxService` — Core logic
- `SandboxMiddleware` — Detect sandbox context
- `TrialConversionService` — Trial management
- React components for sandbox UI

---

#### packages/siem

Audit log export and SIEM integration.

```typescript
// === SIEM Configuration ===
interface SiemConfig {
  tenantId: TenantId;
  enabled: boolean;
  
  // Destination
  destination: SiemDestination;
  
  // Filtering
  eventTypes: AuditEventType[];   // Which events to export
  minSeverity: 'info' | 'warning' | 'critical';
  
  // Format
  format: 'json' | 'cef' | 'leef';
  includeRawPayload: boolean;
  
  // Delivery
  batchSize: number;
  flushIntervalSeconds: number;
  
  // Status
  lastExportAt?: Date;
  lastExportStatus: 'success' | 'error';
  lastError?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

type SiemDestination = 
  | { type: 'splunk'; url: string; token: string; index: string }
  | { type: 'datadog'; apiKey: string; site: string }
  | { type: 'sumo_logic'; url: string }
  | { type: 'elastic'; url: string; apiKey: string; index: string }
  | { type: 'azure_sentinel'; workspaceId: string; sharedKey: string }
  | { type: 's3'; bucket: string; prefix: string; region: string }
  | { type: 'webhook'; url: string; headers: Record<string, string> };

// === Audit Event Types ===
type AuditEventType = 
  // Authentication
  | 'auth.login'
  | 'auth.logout'
  | 'auth.login_failed'
  | 'auth.mfa_enabled'
  | 'auth.mfa_disabled'
  | 'auth.password_changed'
  | 'auth.password_reset'
  | 'auth.session_revoked'
  
  // Authorization
  | 'authz.permission_denied'
  | 'authz.role_assigned'
  | 'authz.role_removed'
  
  // Users
  | 'user.created'
  | 'user.updated'
  | 'user.deleted'
  | 'user.invited'
  | 'user.suspended'
  
  // Organizations
  | 'organization.created'
  | 'organization.updated'
  | 'organization.deleted'
  | 'organization.archived'
  
  // API Keys
  | 'api_key.created'
  | 'api_key.deleted'
  | 'api_key.used'
  
  // Settings
  | 'settings.updated'
  | 'sso.configured'
  | 'sso.updated'
  
  // Data
  | 'data.exported'
  | 'data.imported'
  | 'data.deleted'
  
  // Billing
  | 'billing.subscription_created'
  | 'billing.subscription_cancelled'
  | 'billing.plan_changed'
  | 'billing.payment_failed'
  
  // Admin
  | 'admin.impersonation_started'
  | 'admin.impersonation_ended'
  | 'admin.tenant_suspended'
  
  // Security
  | 'security.ip_blocked'
  | 'security.rate_limited'
  | 'security.suspicious_activity';

// === Audit Event Format ===
interface AuditEvent {
  // Identity
  id: string;
  tenantId: TenantId;
  
  // Event
  eventType: AuditEventType;
  severity: 'info' | 'warning' | 'critical';
  timestamp: Date;
  
  // Actor
  actor: {
    type: 'user' | 'api_key' | 'system' | 'admin';
    id: string;
    email?: string;
    ipAddress?: string;
    userAgent?: string;
  };
  
  // Resource
  resource: {
    type: string;
    id: string;
    name?: string;
  };
  
  // Details
  action: string;
  outcome: 'success' | 'failure';
  changes?: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  };
  
  // Context
  requestId: string;
  sessionId?: string;
  geoLocation?: {
    country: string;
    region: string;
    city: string;
  };
  
  // Raw (if enabled)
  rawPayload?: unknown;
}

// === CEF Format (Common Event Format) ===
// CEF:0|Forge|SaaS Platform|1.0|auth.login|User Login|3|
//   src=192.168.1.1 suser=john@example.com outcome=success

// === LEEF Format (Log Event Extended Format) ===
// LEEF:1.0|Forge|SaaS Platform|1.0|auth.login|
//   src=192.168.1.1 usrName=john@example.com

// === SIEM Service ===
interface SiemService {
  // Configuration
  configure(tenantId: TenantId, config: CreateSiemConfigDto): Promise<SiemConfig>;
  updateConfig(tenantId: TenantId, updates: UpdateSiemConfigDto): Promise<SiemConfig>;
  deleteConfig(tenantId: TenantId): Promise<void>;
  getConfig(tenantId: TenantId): Promise<SiemConfig | null>;
  
  // Test connection
  testConnection(tenantId: TenantId): Promise<TestResult>;
  
  // Manual export
  exportRange(tenantId: TenantId, startDate: Date, endDate: Date): Promise<ExportJob>;
  
  // Export status
  getExportStatus(tenantId: TenantId): Promise<ExportStatus>;
  getExportHistory(tenantId: TenantId): Promise<ExportRecord[]>;
  
  // Internal (called by audit service)
  queueEvent(event: AuditEvent): Promise<void>;
  flush(tenantId: TenantId): Promise<void>;
}

// === Real-time Streaming ===
// For enterprise customers who need real-time:
interface RealtimeExportConfig {
  tenantId: TenantId;
  enabled: boolean;
  destination: 'websocket' | 'kafka' | 'kinesis';
  connectionConfig: unknown;
}

// WebSocket endpoint for real-time audit stream:
// wss://api.forge.io/audit/stream?token={api_key}

// === React Components ===
// <SiemConfigForm /> — Configure SIEM destination
// <SiemTestConnection /> — Test and validate
// <AuditLogExport /> — Manual export UI
// <SiemStatus /> — Export status dashboard
```

**Exports:**
- `SiemModule` — NestJS module
- `SiemService` — Core logic
- `AuditExportJob` — Background job
- Format converters (JSON → CEF, LEEF)
- React components for SIEM configuration

---

### Data Packages

#### packages/database

Connection pooling, health checks, and database utilities.

```typescript
// === Connection Pool Configuration ===
interface PoolConfig {
  // PgBouncer settings
  mode: 'transaction' | 'session' | 'statement';
  
  // Pool sizing
  defaultPoolSize: number;        // Per-database
  minPoolSize: number;
  maxPoolSize: number;
  reservePoolSize: number;        // Emergency connections
  
  // Timeouts
  serverConnectTimeout: number;   // Seconds
  serverIdleTimeout: number;
  clientIdleTimeout: number;
  queryTimeout: number;
  
  // Limits
  maxClientConnections: number;
  maxDbConnections: number;
  
  // Health
  serverCheckDelay: number;       // Seconds between health checks
}

// === Default Pool Configuration ===
const DefaultPoolConfig: PoolConfig = {
  mode: 'transaction',
  
  defaultPoolSize: 20,
  minPoolSize: 5,
  maxPoolSize: 100,
  reservePoolSize: 5,
  
  serverConnectTimeout: 10,
  serverIdleTimeout: 600,
  clientIdleTimeout: 300,
  queryTimeout: 30,
  
  maxClientConnections: 1000,
  maxDbConnections: 200,
  
  serverCheckDelay: 30,
};

// === Per-Tenant Pool Limits ===
// Enterprise tenants can have dedicated pools
interface TenantPoolConfig {
  tenantId: TenantId;
  dedicated: boolean;
  poolSize?: number;
  maxConnections?: number;
}

// === Connection Health ===
interface ConnectionHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  
  // Pool stats
  activeConnections: number;
  idleConnections: number;
  waitingClients: number;
  
  // Utilization
  utilizationPercent: number;
  
  // Errors
  connectionErrors: number;
  queryTimeouts: number;
  
  // Latency
  avgQueryTime: number;
  p99QueryTime: number;
  
  timestamp: Date;
}

// === Database Service ===
interface DatabaseService {
  // Health
  getHealth(): Promise<ConnectionHealth>;
  getHealthHistory(period: Period): Promise<ConnectionHealth[]>;
  
  // Pool management
  getPoolStats(): Promise<PoolStats>;
  resizePool(newSize: number): Promise<void>;
  
  // Connection testing
  testConnection(): Promise<boolean>;
  
  // Maintenance
  runVacuum(table?: string): Promise<void>;
  runAnalyze(table?: string): Promise<void>;
  getTableStats(): Promise<TableStats[]>;
  
  // Read replicas
  getReplicaLag(): Promise<number>;  // Bytes
  routeToReplica<T>(query: () => Promise<T>): Promise<T>;
}

// === PgBouncer Integration ===
// Terraform module provisions:
// - RDS Proxy (AWS managed PgBouncer)
// - Or self-hosted PgBouncer in ECS

// === Prisma Configuration ===
// prisma/schema.prisma
// datasource db {
//   provider = "postgresql"
//   url      = env("DATABASE_URL")  // Points to PgBouncer
//   directUrl = env("DATABASE_DIRECT_URL")  // Direct for migrations
// }

// === Connection String Format ===
// PgBouncer: postgresql://user:pass@pgbouncer:6432/forge?pgbouncer=true
// Direct: postgresql://user:pass@rds:5432/forge

// === Read Replica Routing ===
// For heavy read queries, route to replica:
@UseReadReplica()
async getAnalytics() {
  // Automatically routes to read replica
}

// === Query Timeout Handling ===
// Wrap long-running queries:
async function longQuery() {
  return await withTimeout(
    prisma.analytics.aggregate({ /* ... */ }),
    30000,  // 30 second timeout
    'Analytics query timed out'
  );
}

// === Monitoring Queries ===
const MonitoringQueries = {
  // Connection count
  activeConnections: `
    SELECT count(*) FROM pg_stat_activity 
    WHERE state = 'active'
  `,
  
  // Long-running queries
  longQueries: `
    SELECT pid, now() - pg_stat_activity.query_start AS duration, query
    FROM pg_stat_activity
    WHERE state = 'active' AND now() - pg_stat_activity.query_start > interval '5 seconds'
  `,
  
  // Table bloat
  tableBloat: `
    SELECT schemaname, tablename, 
           pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) as size
    FROM pg_tables 
    WHERE schemaname = 'public'
    ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC
  `,
  
  // Index usage
  indexUsage: `
    SELECT relname, indexrelname, idx_scan, idx_tup_read, idx_tup_fetch
    FROM pg_stat_user_indexes
    ORDER BY idx_scan DESC
  `,
};
```

**Exports:**
- `DatabaseModule` — NestJS module
- `DatabaseService` — Pool management
- `@UseReadReplica` — Decorator for read routing
- `withTimeout` — Query timeout wrapper
- Health check indicators

---

### Communication Packages

#### packages/notifications (Extended)

Now includes Slack, Teams, and push notifications.

```typescript
// === Notification Channels ===
type NotificationChannel = 
  | 'email'
  | 'in_app'
  | 'sms'
  | 'push'           // Web push + mobile
  | 'slack'
  | 'teams';

// === Channel Configurations ===
interface SlackConfig {
  tenantId: TenantId;
  enabled: boolean;
  webhookUrl: string;
  channel: string;
  botToken?: string;         // For richer interactions
  events: NotificationEvent[];
}

interface TeamsConfig {
  tenantId: TenantId;
  enabled: boolean;
  webhookUrl: string;
  events: NotificationEvent[];
}

interface PushConfig {
  tenantId: TenantId;
  enabled: boolean;
  vapidPublicKey: string;
  vapidPrivateKey: string;
}

// === User Notification Preferences ===
interface NotificationPreferences {
  userId: UserId;
  
  // Per-event-type preferences
  preferences: Record<NotificationEvent, ChannelPreference>;
  
  // Global settings
  quietHours?: {
    enabled: boolean;
    start: string;      // HH:mm
    end: string;
    timezone: string;
  };
  
  // Channel-specific
  emailDigest: 'instant' | 'daily' | 'weekly' | 'never';
  pushEnabled: boolean;
  slackDmEnabled: boolean;
}

interface ChannelPreference {
  email: boolean;
  inApp: boolean;
  push: boolean;
  slack: boolean;
  teams: boolean;
}

// === Slack Message Formatting ===
interface SlackMessage {
  channel?: string;
  text: string;
  blocks?: SlackBlock[];
  attachments?: SlackAttachment[];
}

// Rich Slack notifications with actions:
const approvalRequestSlack: SlackMessage = {
  text: 'New approval request',
  blocks: [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*Approval Request*\n<@user> requested to delete user John Doe',
      },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Approve' },
          style: 'primary',
          action_id: 'approve_request',
          value: 'request_123',
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Reject' },
          style: 'danger',
          action_id: 'reject_request',
          value: 'request_123',
        },
      ],
    },
  ],
};

// === Teams Adaptive Card ===
interface TeamsMessage {
  type: 'message';
  attachments: [{
    contentType: 'application/vnd.microsoft.card.adaptive';
    content: AdaptiveCard;
  }];
}

// === Push Notification ===
interface PushNotification {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: Record<string, unknown>;
  actions?: PushAction[];
  requireInteraction?: boolean;
}

interface PushAction {
  action: string;
  title: string;
  icon?: string;
}

// === Notification Service (Extended) ===
interface NotificationService {
  // Send
  send(notification: SendNotificationDto): Promise<void>;
  sendToChannel(channel: NotificationChannel, notification: ChannelNotification): Promise<void>;
  
  // Slack
  sendSlackMessage(tenantId: TenantId, message: SlackMessage): Promise<void>;
  handleSlackInteraction(payload: SlackInteractionPayload): Promise<void>;
  
  // Teams
  sendTeamsMessage(tenantId: TenantId, message: TeamsMessage): Promise<void>;
  
  // Push
  sendPush(userId: UserId, notification: PushNotification): Promise<void>;
  registerPushSubscription(userId: UserId, subscription: PushSubscription): Promise<void>;
  
  // Preferences
  getPreferences(userId: UserId): Promise<NotificationPreferences>;
  updatePreferences(userId: UserId, prefs: Partial<NotificationPreferences>): Promise<void>;
}
```

**Exports:**
- `NotificationsModule` — NestJS module
- `NotificationService` — Core logic
- Channel-specific services
- React components: `NotificationPreferences`, `PushOptIn`

---

## Forge Generators

| Generator | Command | Creates |
|-----------|---------|---------|
| **Init** | `nx g @forge/nx:init` | Complete scaffold from scratch |
| **Feature** | `nx g @forge/nx:feature` | Vertical slice: schema, API, UI, admin, tests, docs, translations |
| **Tenant** | `nx g @forge/nx:tenant` | Tenant isolation migration + seed |
| **Compliance** | `nx g @forge/nx:compliance` | GDPR data type + retention job |
| **Service** | `nx g @forge/nx:service` | Microservice extraction skeleton |
| **Job** | `nx g @forge/nx:job` | Background job with DLQ, retry, metrics |
| **Notification** | `nx g @forge/nx:notification` | Notification template + delivery (all channels) |
| **Migration** | `nx g @forge/nx:migration` | Data migration with rollback |
| **Integration** | `nx g @forge/nx:integration` | Third-party client with circuit breaker |
| **Webhook** | `nx g @forge/nx:webhook` | Outbound webhook event type |
| **Report** | `nx g @forge/nx:report` | Async report generation job |
| **API Scope** | `nx g @forge/nx:api-scope` | New API key scope + guards |
| **Import** | `nx g @forge/nx:import` | Bulk import for entity type |
| **Experiment** | `nx g @forge/nx:experiment` | A/B test setup |
| **Translation** | `nx g @forge/nx:translation` | Add translations for new feature |
| **Legal** | `nx g @forge/nx:legal` | New legal document type |
| **Permission** | `nx g @forge/nx:permission` | New permission + catalog entry |
| **Approval** | `nx g @forge/nx:approval` | New approval workflow policy |
| **Sandbox Seed** | `nx g @forge/nx:sandbox-seed` | New sandbox data set |
| **SIEM Event** | `nx g @forge/nx:siem-event` | New audit event type |

### Generator Output Pattern

Every generator creates:

```
feature-name/
  README.md                    – Usage documentation
  PROMPT.md                    – Link to prompt-id
  CHANGELOG.md                 – Version history
  index.ts                     – Public exports
  *.test.ts                    – Unit tests
  *.integration.test.ts        – Integration tests
  *.e2e.test.ts                – E2E tests (where applicable)
  *.stories.tsx                – Storybook (for UI)
  *.a11y.test.ts               – Accessibility tests (for UI)
  translations/                – Translation keys
    en-US.json
```

---

## The 32 Laws of the Forge

### Structure (1-5)

1. Every package exports: `index.ts`, `*.test.ts`, `README.md`, `CHANGELOG.md`
2. UI packages also export: `*.stories.tsx`, `*.a11y.test.ts`
3. No cross-imports between `portal ↔ admin` except via `shared-types`
4. All shared code lives in packages, never duplicated in apps
5. Every feature includes translations for all supported locales

### Data (6-11)

6. Every table has: `id`, `created_at`, `updated_at`, `tenant_id`, `created_by`
7. No raw SQL outside `packages/prisma`
8. Tenant isolation verified by property tests on every query
9. All PII fields marked in Prisma schema with `/// @pii` comment
10. Soft delete by default; hard delete only via compliance jobs
11. All database queries go through connection pool; direct connections forbidden

### API (12-17)

12. Every mutation calls `audit(req, entity, delta)`
13. Every endpoint has explicit rate limits
14. Every endpoint documents error codes in OpenAPI
15. Errors use typed codes from `packages/errors`
16. OpenAPI diff must be 0 in CI
17. Breaking API changes require version bump + migration guide

### Security (18-22)

18. No secrets in code; all via environment variables
19. All user input validated with zod schemas
20. All file uploads scanned for malware
21. IP allowlist checked for enterprise tenants
22. Dangerous permissions require approval workflow

### Testing (23-26)

23. Property test for every pure function with > 3 branches
24. Storybook story + a11y test for every UI component
25. E2E test for every critical user journey
26. Performance budget checked in CI (LCP < 2.5s, bundle < 200KB)

### Traceability (27-28)

27. Every generator emits `prompt-id` linking to `tools/prompts/`
28. AI-generation ratio tracked per category

### Process (29-32)

29. ADR review every 30 days
30. Feature flags required for changes to existing user-visible behavior
31. Legal document updates require user re-acceptance flow
32. All user-facing strings must use i18n; hardcoded strings fail CI

---

## Database Architecture

### Connection Pooling (ADR-009)

```
                    ┌─────────────────────────────────────┐
                    │          Application                │
                    │     (Multiple Instances)            │
                    └─────────────┬───────────────────────┘
                                  │
                                  │ max_connections = 100 per instance
                                  │
                    ┌─────────────▼───────────────────────┐
                    │         PgBouncer                   │
                    │    (Transaction Pooling)            │
                    │                                     │
                    │  max_client_conn = 1000             │
                    │  default_pool_size = 20             │
                    │  reserve_pool_size = 5              │
                    └─────────────┬───────────────────────┘
                                  │
                                  │ max_connections = 200
                                  │
                    ┌─────────────▼───────────────────────┐
                    │       PostgreSQL Primary            │
                    │                                     │
                    │  max_connections = 200              │
                    │  shared_buffers = 4GB               │
                    │  effective_cache_size = 12GB        │
                    └─────────────┬───────────────────────┘
                                  │
                    ┌─────────────▼───────────────────────┐
                    │       PostgreSQL Replica            │
                    │        (Read Queries)               │
                    └─────────────────────────────────────┘
```

### Connection Management

| Setting | Value | Rationale |
|---------|-------|-----------|
| Pool mode | Transaction | Best for web apps with short queries |
| Default pool size | 20 | Per-database; scales with traffic |
| Max client connections | 1000 | Handles traffic spikes |
| Server idle timeout | 600s | Release idle connections |
| Query timeout | 30s | Prevent runaway queries |
| Utilization target | < 80% | Leave headroom for spikes |

### Health Monitoring

```typescript
// Prometheus metrics exposed:
// - pgbouncer_active_connections
// - pgbouncer_waiting_connections
// - pgbouncer_pool_utilization
// - pgbouncer_query_time_p99

// Alert thresholds:
// - utilization > 80% for 5 min → warning
// - utilization > 95% for 1 min → critical
// - waiting_connections > 10 for 1 min → warning
```

---

## Multi-Region Architecture

### Region Configuration

```typescript
const Regions = {
  'us-east-1': {
    name: 'US East',
    location: 'N. Virginia',
    flag: '🇺🇸',
    compliance: ['SOC2', 'HIPAA'],
    isDefault: true,
  },
  'eu-west-1': {
    name: 'EU West',
    location: 'Ireland',
    flag: '🇪🇺',
    compliance: ['SOC2', 'GDPR'],
  },
  'eu-central-1': {
    name: 'EU Central',
    location: 'Frankfurt',
    flag: '🇩🇪',
    compliance: ['SOC2', 'GDPR'],
  },
  'ap-southeast-1': {
    name: 'Asia Pacific',
    location: 'Singapore',
    flag: '🇸🇬',
    compliance: ['SOC2'],
  },
};
```

### Data Residency

| Data Type | Scope | Replication |
|-----------|-------|-------------|
| User PII | Regional | Never |
| Tenant data | Regional | Never |
| Audit logs | Regional (write), Global (read) | Read replicas |
| Feature flags | Global | Full sync |
| Billing | Global | Stripe handles |
| Sessions | Regional | Global invalidation |

---

## Security

### Authentication Methods

| Method | Use Case | Implementation |
|--------|----------|----------------|
| JWT | Portal/Admin users | Auth0 OIDC |
| SAML 2.0 | Enterprise SSO | Auth0 + custom |
| API Key | External integrations | Custom |
| OAuth2 | Third-party apps | Custom OAuth server |
| SCIM | User provisioning | Custom |

### Custom Roles

| Feature | Description |
|---------|-------------|
| Permission catalog | 40+ granular permissions |
| Role builder | Visual permission picker |
| Role hierarchy | Inherit from parent roles |
| System roles | Owner, Admin, Member, Viewer (immutable) |
| Custom roles | Tenant-defined (enterprise) |

### Approval Workflows

| Trigger | Default Policy |
|---------|----------------|
| User deletion | Manager approval |
| Role change | Admin approval |
| API key creation | None (can enable) |
| Data export | Admin approval |
| SSO configuration | Owner approval |

---

## Operations

### Deployment Strategy

| Environment | Branch | Deploy | Regions |
|-------------|--------|--------|---------|
| Development | feature/* | Manual | us-east-1 |
| Staging | main | Auto | us-east-1 |
| Production | main | Manual approval | All |

### Incident Severity

| Level | Response | Examples |
|-------|----------|----------|
| SEV1 | 15 min | Complete outage |
| SEV2 | 1 hour | Major feature broken |
| SEV3 | 4 hours | Minor feature broken |
| SEV4 | Next day | Cosmetic |

### Backup & DR

| Data | Frequency | Retention | RTO | RPO |
|------|-----------|-----------|-----|-----|
| Database | Continuous | 30 days | 1 hr | 1 hr |
| Files | Continuous | Versioned | 1 hr | 0 |
| Redis | Hourly | 24 hours | 15 min | 1 hr |

---

## Performance

### Performance Budgets

| Metric | Target |
|--------|--------|
| LCP | < 2.5s |
| FID | < 100ms |
| CLS | < 0.1 |
| Initial JS | < 200KB gzip |
| API p99 | < 400ms |
| DB connections | < 80% utilization |

---

## Testing Strategy

### Test Pyramid

```
              ┌───────────────┐
              │     E2E       │  10%
              ├───────────────┤
              │  Integration  │  30%
              ├───────────────┤
              │     Unit      │  60%
              └───────────────┘
```

---

## Architecture Decision Records

| ADR | Title | Status |
|-----|-------|--------|
| 001 | Vertical Slice Architecture | Accepted |
| 002 | API Strategy (REST + tRPC) | Accepted |
| 003 | Tenant Isolation | Accepted |
| 004 | Caching Strategy | Accepted |
| 005 | Deployment Strategy | Accepted |
| 006 | Multi-Region Architecture | Accepted |
| 007 | i18n Strategy | Accepted |
| 008 | SSO Architecture | Accepted |
| 009 | Connection Pooling (PgBouncer) | Accepted |
| 010 | Custom Roles & Permissions | Accepted |
| 011 | Approval Workflows | Accepted |
| 012 | Sandbox Environments | Accepted |
| 013 | SIEM Integration | Accepted |

---

## First Forge: Organization Management

### User Stories

| Actor | Action | Outcome |
|-------|--------|---------|
| Portal user | Create organization | Onboard company |
| Portal user | Rename organization | Correct mistakes |
| Portal user | Archive organization | Clean up |
| Admin | List organizations | Monitor platform |
| Admin | Impersonate organization | Debug issues |
| Admin | Suspend organization | Enforce ToS |
| API consumer | CRUD organizations | Integrate systems |

### Permissions Required

```typescript
// New permissions for organizations
const OrganizationPermissions = [
  'organizations:read',
  'organizations:write',
  'organizations:delete',
  'organizations:archive',
  'organizations:admin',       // Admin-only actions
];
```

### Approval Workflow

```typescript
// Delete requires approval by default
const orgDeletePolicy: ApprovalPolicy = {
  triggerAction: 'organization.delete',
  approverType: 'role',
  approverRoleId: 'admin',
  requiredApprovals: 1,
  allowSelfApproval: false,
};
```

### Audit Events

```typescript
// SIEM-exportable events
const OrganizationAuditEvents: AuditEventType[] = [
  'organization.created',
  'organization.updated',
  'organization.deleted',
  'organization.archived',
  'organization.suspended',
  'organization.impersonated',
];
```

### Implementation Order

```bash
# 1. Generate slice
nx g @forge/nx:feature organization-management

# 2. Add permissions
nx g @forge/nx:permission organizations:read organizations:write organizations:delete

# 3. Add approval policy
nx g @forge/nx:approval organization-delete

# 4. Add SIEM events
nx g @forge/nx:siem-event organization.created organization.updated

# 5. Add translations
nx g @forge/nx:translation organization-management

# 6. Implement (AI-assisted)

# 7. Test
pnpm test
pnpm test:e2e
pnpm test:a11y
pnpm lighthouse

# 8. Ship
pnpm verify
gh pr create --fill
```

---

## Glossary

| Term | Definition |
|------|------------|
| **Forge** | The methodology; the act of creating features |
| **Mold** | The scaffold; the structure features are poured into |
| **Slice** | A complete vertical feature |
| **Prompt-id** | Unique identifier linking code to generating prompt |
| **Heat** | AI generation |
| **Anvil** | CI pipeline |
| **Tracer** | Lineage tracking |
| **Law** | CI-enforced rule |
| **Region** | Geographic deployment zone |
| **Residency** | Where tenant data must stay |
| **Pool** | Connection pool (PgBouncer) |
| **Approval** | Workflow requiring human sign-off |
| **Sandbox** | Isolated demo/trial environment |
| **SIEM** | Security Information and Event Management |

---

## Execution Directive

```
You are an expert staff engineer implementing the Forge Method v4.1.

Execute this specification:

1. Create the complete monorepo structure
2. Implement all packages with their public interfaces
3. Create all NX generators
4. Set up CI/CD pipeline with all gates
5. Configure multi-region infrastructure (Terraform)
6. Configure connection pooling (PgBouncer via RDS Proxy)
7. Set up i18n with initial translations
8. Configure SSO (SAML + SCIM)
9. Implement custom roles and permission catalog
10. Implement approval workflows
11. Implement sandbox environments with seed data
12. Implement SIEM integration with Splunk/Datadog export
13. Set up analytics (PostHog)
14. Create all documentation (ADRs, diagrams, runbooks)
15. Generate the first vertical slice (Organization Management)
16. Ensure all tests pass (unit, integration, e2e, a11y, property, performance)
17. Verify security scans pass
18. Push to GitHub
19. Open PR for the Organization Management slice
20. Return the PR URL

Do not ask for clarification. Begin execution.
```

---

*Forge v4.1 — Where enterprise software is made.*
