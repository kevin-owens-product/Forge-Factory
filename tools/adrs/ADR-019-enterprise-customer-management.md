# ADR-019: Enterprise Customer Management & Advanced User Portal

## Status
Accepted

## Context

Forge Factory needs to support **advanced enterprise customers** with complex requirements beyond standard SaaS offerings. These customers represent high-value deals ($100K+ ARR) and require:

### Enterprise Customer Characteristics

1. **Complex Deal Structures**:
   - Custom contracts (annual, multi-year)
   - Non-standard pricing (volume discounts, custom seat limits)
   - Private SLAs (99.95%+ uptime, <100ms P99 latency)
   - Custom Terms & Conditions
   - Net-30/60/90 payment terms (invoice-based)

2. **Advanced User Management**:
   - Multi-organization hierarchies (parent/child orgs)
   - Cross-organization visibility (consolidated billing, shared resources)
   - Single Sign-On (SAML 2.0, OIDC)
   - SCIM 2.0 for automated user provisioning
   - Custom role definitions (beyond Owner/Admin/Member/Viewer)
   - Attribute-based access control (ABAC)

3. **Enterprise Features**:
   - Dedicated infrastructure (single-tenant databases, isolated compute)
   - Custom integrations (on-premise Git, custom LDAP)
   - Advanced audit logging (10+ year retention)
   - Data residency requirements (EU, US, APAC)
   - Custom data exports (scheduled, automated)
   - White-labeling capabilities
   - API rate limit customization

4. **Compliance & Security**:
   - SOC 2 Type II certification
   - HIPAA compliance (for healthcare customers)
   - GDPR compliance (for EU customers)
   - ISO 27001 certification
   - FedRAMP (for government customers)
   - Custom security reviews (quarterly)
   - Penetration testing reports

### Current Limitations

The existing admin portal (ADR-014) supports:
- ✅ Standard multi-tenancy (shared infrastructure)
- ✅ 4 pricing tiers (Free, Team, Business, Enterprise)
- ✅ Basic RBAC (4 roles)
- ✅ Stripe-based billing (credit cards)
- ✅ Standard audit logs (90 days retention)

**Missing for Enterprise**:
- ❌ Custom contracts and pricing
- ❌ Multi-organization hierarchies
- ❌ SSO/SCIM provisioning
- ❌ Custom roles and permissions
- ❌ Extended audit log retention
- ❌ Data residency controls
- ❌ Dedicated infrastructure options
- ❌ White-labeling

### Target Customers (Year 1)

Based on market research:
- **10-15 enterprise customers** (target)
- Average deal size: **$150K ARR**
- Average organization size: **500-2,000 users**
- Typical structure: **Parent org + 3-5 subsidiary orgs**
- Industries: **Healthcare, Finance, Government, Technology**

### Business Requirements

From Product & Sales teams:

1. **Self-Service Enterprise Onboarding**:
   - Enterprise customers can create parent/child org structures
   - Configure SSO without engineering support
   - Define custom roles without engineering support
   - Manage API rate limits self-service

2. **Account Management**:
   - Dedicated Customer Success Manager (CSM) assigned
   - CSM dashboard shows health scores, usage, renewals
   - Quarterly Business Reviews (QBRs) data auto-generated
   - Automated renewal reminders (90/60/30 days)

3. **Billing Flexibility**:
   - Invoice-based billing (Net-30/60/90)
   - Custom pricing models (volume tiers, committed use)
   - Multi-currency support (USD, EUR, GBP)
   - Purchase Order (PO) tracking

## Decision

We will build an **Enterprise Customer Management System** that extends the existing admin portal with enterprise-specific capabilities.

### Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│           Enterprise Customer Management Architecture            │
├──────────────────────────────────────────────────────────────────┤
│                                                                    │
│  User Portal                  Admin Portal            CSM Portal  │
│  ┌──────────────┐            ┌──────────────┐       ┌──────────┐ │
│  │ Standard     │            │ Tenant Admin │       │ Customer │ │
│  │ Features     │            │ (ADR-014)    │       │ Success  │ │
│  │              │            │              │       │ Manager  │ │
│  │ + SSO Login  │            │ + Org        │       │ Dashboard│ │
│  │ + Org Switch │            │   Hierarchy  │       │          │ │
│  │              │            │ + Custom     │       │ • Health │ │
│  └──────────────┘            │   Roles      │       │ • Usage  │ │
│                               │ + SSO Config │       │ • QBRs   │ │
│                               │ + Advanced   │       │ • Risks  │ │
│                               │   Audit Logs │       │          │ │
│                               └──────────────┘       └──────────┘ │
│                                      │                     │       │
│                                      └──────────┬──────────┘       │
│                                                 ▼                  │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │              Enterprise Management API Layer                  │ │
│  │  /api/v1/enterprise/                                          │ │
│  │    /organizations/hierarchy                                   │ │
│  │    /sso/configure                                             │ │
│  │    /scim/users                                                │ │
│  │    /roles/custom                                              │ │
│  │    /contracts                                                 │ │
│  │    /health-scores                                             │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                   │                                │
│                                   ▼                                │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │                  Database Schema Extensions                   │ │
│  │                                                               │ │
│  │  OrganizationHierarchy                                       │ │
│  │  ├─ parentOrganizationId                                     │ │
│  │  ├─ childOrganizations[]                                     │ │
│  │  └─ hierarchyPath (ltree)                                    │ │
│  │                                                               │ │
│  │  EnterpriseContract                                          │ │
│  │  ├─ organizationId                                           │ │
│  │  ├─ annualValue                                              │ │
│  │  ├─ startDate / endDate                                      │ │
│  │  ├─ paymentTerms (Net-30/60/90)                              │ │
│  │  ├─ slaCommitments (JSON)                                    │ │
│  │  ├─ customPricing (JSON)                                     │ │
│  │  └─ renewalDate                                              │ │
│  │                                                               │ │
│  │  SSOConfiguration                                            │ │
│  │  ├─ organizationId                                           │ │
│  │  ├─ provider (SAML, OIDC)                                    │ │
│  │  ├─ idpMetadata (XML/JSON)                                   │ │
│  │  ├─ ssoUrl                                                   │ │
│  │  ├─ entityId                                                 │ │
│  │  └─ attributeMapping (JSON)                                  │ │
│  │                                                               │ │
│  │  SCIMConfiguration                                           │ │
│  │  ├─ organizationId                                           │ │
│  │  ├─ bearerToken                                              │ │
│  │  ├─ scimBaseUrl                                              │ │
│  │  └─ syncEnabled                                              │ │
│  │                                                               │ │
│  │  CustomRole                                                  │ │
│  │  ├─ organizationId                                           │ │
│  │  ├─ name                                                     │ │
│  │  ├─ permissions[] (100+ granular permissions)               │ │
│  │  └─ isSystemRole (false for custom)                         │ │
│  │                                                               │ │
│  │  CustomerHealthScore                                         │ │
│  │  ├─ organizationId                                           │ │
│  │  ├─ score (0-100)                                            │ │
│  │  ├─ lastActiveDate                                           │ │
│  │  ├─ featureAdoption (%)                                      │ │
│  │  ├─ supportTicketCount                                       │ │
│  │  ├─ nps (Net Promoter Score)                                │ │
│  │  └─ renewalRisk (low/medium/high)                            │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                    │
└──────────────────────────────────────────────────────────────────┘
```

## Detailed Decisions

### 1. Multi-Organization Hierarchy

**Requirement**: Enterprise customers need parent/child organization structures (e.g., Acme Corp → Acme North America → Acme Canada).

**Implementation**:

```typescript
/**
 * @prompt-id forge-v4.1:enterprise:org-hierarchy:001
 * @generated-at 2026-01-20T00:00:00Z
 * @model claude-sonnet-4-5
 */

// Database schema (Prisma)
model Organization {
  id                    String   @id @default(cuid())
  name                  String

  // Hierarchy support
  parentOrganizationId  String?
  parentOrganization    Organization?  @relation("OrgHierarchy", fields: [parentOrganizationId], references: [id])
  childOrganizations    Organization[] @relation("OrgHierarchy")
  hierarchyPath         String?        // ltree path: root.child1.child2
  hierarchyLevel        Int @default(0)

  // Enterprise flags
  isEnterpriseCustomer  Boolean @default(false)

  // Relations
  contract              EnterpriseContract?
  ssoConfig             SSOConfiguration?
  scimConfig            SCIMConfiguration?
  customRoles           CustomRole[]
  healthScore           CustomerHealthScore?

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@index([parentOrganizationId])
  @@index([hierarchyPath])
  @@index([isEnterpriseCustomer])
}

model EnterpriseContract {
  id                String   @id @default(cuid())
  organizationId    String   @unique
  organization      Organization @relation(fields: [organizationId], references: [id])

  // Contract terms
  annualValue       Int               // in cents ($150,000 = 15000000)
  startDate         DateTime
  endDate           DateTime
  renewalDate       DateTime
  paymentTerms      PaymentTerms      // NET_30, NET_60, NET_90
  billingCycle      BillingCycle      // MONTHLY, QUARTERLY, ANNUAL

  // Custom pricing
  customPricing     Json              // { seatPrice: 89, locPrice: 0.0008, ... }
  volumeDiscounts   Json              // { "500+": 0.15, "1000+": 0.25 }

  // SLA commitments
  slaUptime         Float             // 99.95
  slaLatencyP99     Int               // 100ms
  slaSupport        SupportLevel      // STANDARD, PREMIUM, ENTERPRISE

  // Account management
  csmUserId         String?           // Customer Success Manager
  accountExecutive  String?

  // Contract status
  status            ContractStatus    // ACTIVE, EXPIRED, CANCELLED

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@index([organizationId])
  @@index([renewalDate])
  @@index([status])
}

enum PaymentTerms {
  NET_30
  NET_60
  NET_90
  IMMEDIATE
}

enum BillingCycle {
  MONTHLY
  QUARTERLY
  ANNUAL
}

enum SupportLevel {
  STANDARD      // Email support, 24h response
  PREMIUM       // Email + Chat, 4h response
  ENTERPRISE    // Dedicated CSM, 1h response, phone support
}

enum ContractStatus {
  ACTIVE
  EXPIRED
  CANCELLED
  RENEWAL_PENDING
}
```

**Hierarchy Management API**:

```typescript
// apps/api/src/modules/enterprise/organization-hierarchy.controller.ts

@Controller('api/v1/enterprise/organizations')
@UseGuards(EnterpriseGuard)
export class OrganizationHierarchyController {

  // Get full organization hierarchy
  @Get(':id/hierarchy')
  async getHierarchy(@Param('id') orgId: string) {
    const org = await this.db.organization.findUnique({
      where: { id: orgId },
      include: {
        parentOrganization: true,
        childOrganizations: {
          include: {
            childOrganizations: true, // 2 levels deep
            _count: { select: { members: true } },
          },
        },
      },
    })

    return {
      root: this.buildHierarchyTree(org),
      totalOrganizations: this.countDescendants(org),
      totalUsers: await this.countTotalUsers(org),
    }
  }

  // Create child organization
  @Post(':id/children')
  async createChildOrganization(
    @Param('id') parentId: string,
    @Body() dto: CreateChildOrgDto
  ) {
    const parent = await this.db.organization.findUniqueOrThrow({
      where: { id: parentId },
    })

    // Validate hierarchy depth (max 5 levels)
    if (parent.hierarchyLevel >= 4) {
      throw new BadRequestException('Maximum hierarchy depth exceeded')
    }

    const child = await this.db.organization.create({
      data: {
        name: dto.name,
        parentOrganizationId: parentId,
        hierarchyPath: `${parent.hierarchyPath}.${dto.name.toLowerCase()}`,
        hierarchyLevel: parent.hierarchyLevel + 1,
        isEnterpriseCustomer: parent.isEnterpriseCustomer,
      },
    })

    await this.auditLog.log({
      action: 'organization.child_created',
      organizationId: parentId,
      metadata: { childId: child.id, childName: child.name },
    })

    return child
  }

  // Get consolidated billing for hierarchy
  @Get(':id/consolidated-billing')
  async getConsolidatedBilling(@Param('id') rootOrgId: string) {
    // Get all descendant orgs using ltree query
    const orgs = await this.db.$queryRaw`
      SELECT id FROM "Organization"
      WHERE hierarchy_path <@ (
        SELECT hierarchy_path FROM "Organization" WHERE id = ${rootOrgId}
      )
    `

    const orgIds = orgs.map((o) => o.id)

    const usage = await this.db.usage.aggregate({
      where: { organizationId: { in: orgIds } },
      _sum: {
        seats: true,
        linesOfCode: true,
        apiCalls: true,
        storageBytes: true,
      },
    })

    const totalCost = await this.calculateTotalCost(usage._sum)

    return {
      organizations: orgIds.length,
      usage: usage._sum,
      totalCost,
      breakdown: await this.getPerOrgBreakdown(orgIds),
    }
  }
}
```

### 2. Single Sign-On (SSO) Configuration

**Requirement**: Enterprise customers need SSO (SAML 2.0, OIDC) without engineering support.

**Implementation**:

```typescript
// Database schema
model SSOConfiguration {
  id                String   @id @default(cuid())
  organizationId    String   @unique
  organization      Organization @relation(fields: [organizationId], references: [id])

  // Provider details
  provider          SSOProvider      // SAML_2_0, OIDC, AZURE_AD, OKTA, GOOGLE_WORKSPACE
  enabled           Boolean @default(false)

  // SAML 2.0 specific
  idpMetadataXml    String?          // Identity Provider metadata
  idpSsoUrl         String?          // IdP login URL
  idpEntityId       String?          // IdP entity ID
  spEntityId        String           // Service Provider entity ID (our app)
  acsUrl            String           // Assertion Consumer Service URL
  sloUrl            String?          // Single Logout URL

  // OIDC specific
  clientId          String?
  clientSecret      String?          // Encrypted
  discoveryUrl      String?          // .well-known/openid-configuration
  authorizationUrl  String?
  tokenUrl          String?

  // Attribute mapping
  emailAttribute    String @default("email")
  nameAttribute     String @default("name")
  roleAttribute     String?          // Optional role mapping

  // Security
  signatureAlgorithm String @default("SHA256")
  encryptAssertions  Boolean @default(false)

  // Testing
  testMode          Boolean @default(true)  // Allows both SSO and password login

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@index([organizationId])
}

enum SSOProvider {
  SAML_2_0
  OIDC
  AZURE_AD
  OKTA
  GOOGLE_WORKSPACE
  ONELOGIN
}
```

**SSO Configuration UI** (Admin Portal):

```tsx
// apps/admin/app/(tenant)/enterprise/sso/page.tsx

export default async function SSOConfigurationPage() {
  const orgId = await getCurrentTenantId()
  const ssoConfig = await db.sSOConfiguration.findUnique({
    where: { organizationId: orgId },
  })

  return (
    <div className="max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Single Sign-On (SSO)</h1>

      <Alert variant="info" className="mb-6">
        ℹ️ SSO allows your team to login using your company's identity provider
        (Okta, Azure AD, Google Workspace, etc.) instead of passwords.
      </Alert>

      {!ssoConfig && <SSOSetupWizard orgId={orgId} />}
      {ssoConfig && <SSOConfigurationForm config={ssoConfig} />}
    </div>
  )
}

// SSO Setup Wizard (step-by-step)
function SSOSetupWizard({ orgId }: { orgId: string }) {
  const [step, setStep] = useState(1)
  const [provider, setProvider] = useState<SSOProvider>()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configure SSO</CardTitle>
        <p className="text-sm text-slate-600">Step {step} of 4</p>
      </CardHeader>
      <CardContent>
        {step === 1 && (
          <div>
            <Label>Select Your Identity Provider</Label>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <ProviderCard
                name="Okta"
                icon="/icons/okta.svg"
                onClick={() => {
                  setProvider('OKTA')
                  setStep(2)
                }}
              />
              <ProviderCard
                name="Azure AD"
                icon="/icons/azure.svg"
                onClick={() => {
                  setProvider('AZURE_AD')
                  setStep(2)
                }}
              />
              <ProviderCard
                name="Google Workspace"
                icon="/icons/google.svg"
                onClick={() => {
                  setProvider('GOOGLE_WORKSPACE')
                  setStep(2)
                }}
              />
              <ProviderCard
                name="Generic SAML 2.0"
                icon="/icons/saml.svg"
                onClick={() => {
                  setProvider('SAML_2_0')
                  setStep(2)
                }}
              />
            </div>
          </div>
        )}

        {step === 2 && provider === 'SAML_2_0' && (
          <SAMLConfigurationForm
            orgId={orgId}
            onComplete={() => setStep(3)}
          />
        )}

        {step === 3 && (
          <div>
            <h3 className="font-semibold mb-4">Test SSO Connection</h3>
            <p className="text-sm text-slate-600 mb-4">
              Click the button below to test your SSO configuration.
              You'll be redirected to your identity provider to login.
            </p>
            <Button onClick={testSSOConnection}>Test SSO Login</Button>
          </div>
        )}

        {step === 4 && (
          <div>
            <Alert variant="success">
              ✅ SSO is configured and working!
            </Alert>
            <div className="mt-4">
              <Label>Enable SSO for all users?</Label>
              <p className="text-sm text-slate-600 mb-4">
                When enabled, all users must login via SSO.
                Password login will be disabled.
              </p>
              <Toggle
                checked={enforceSSO}
                onChange={(enabled) => updateSSOEnforcement(enabled)}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

### 3. SCIM 2.0 User Provisioning

**Requirement**: Enterprise customers need automated user provisioning/deprovisioning via SCIM 2.0.

**Implementation**:

```typescript
// Database schema
model SCIMConfiguration {
  id                String   @id @default(cuid())
  organizationId    String   @unique
  organization      Organization @relation(fields: [organizationId], references: [id])

  // SCIM endpoint credentials
  bearerToken       String           // Encrypted API token
  scimBaseUrl       String           // /api/v1/scim/v2

  // Sync settings
  syncEnabled       Boolean @default(true)
  autoProvision     Boolean @default(true)   // Auto-create users
  autoDeprovision   Boolean @default(true)   // Auto-deactivate users
  autoUpdateProfile Boolean @default(true)   // Update user attributes

  // Default role for provisioned users
  defaultRole       Role @default(MEMBER)

  // Sync stats
  lastSyncAt        DateTime?
  totalSynced       Int @default(0)
  totalErrors       Int @default(0)

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@index([organizationId])
}

// SCIM API endpoints
@Controller('api/v1/scim/v2')
export class SCIMController {

  // List users
  @Get('Users')
  async listUsers(
    @Headers('authorization') auth: string,
    @Query('startIndex') startIndex = 1,
    @Query('count') count = 100
  ) {
    const org = await this.validateSCIMToken(auth)

    const users = await this.db.user.findMany({
      where: {
        organizationMembers: {
          some: { organizationId: org.id },
        },
      },
      skip: startIndex - 1,
      take: count,
    })

    return {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
      totalResults: users.length,
      Resources: users.map(this.toSCIMUser),
    }
  }

  // Create user
  @Post('Users')
  async createUser(
    @Headers('authorization') auth: string,
    @Body() scimUser: SCIMUser
  ) {
    const org = await this.validateSCIMToken(auth)

    const user = await this.db.user.create({
      data: {
        email: scimUser.emails[0].value,
        name: scimUser.name.formatted,
        emailVerified: true, // Trust IdP
        organizationMembers: {
          create: {
            organizationId: org.id,
            role: org.scimConfig.defaultRole,
          },
        },
      },
    })

    await this.auditLog.log({
      action: 'user.scim_provisioned',
      organizationId: org.id,
      userId: user.id,
      metadata: { scimUser },
    })

    return this.toSCIMUser(user)
  }

  // Update user
  @Patch('Users/:id')
  async updateUser(
    @Headers('authorization') auth: string,
    @Param('id') userId: string,
    @Body() patch: SCIMPatch
  ) {
    const org = await this.validateSCIMToken(auth)

    // Handle deactivation
    if (patch.Operations.some(op => op.path === 'active' && op.value === false)) {
      await this.db.organizationMember.update({
        where: {
          userId_organizationId: {
            userId,
            organizationId: org.id,
          },
        },
        data: { status: 'INACTIVE' },
      })

      await this.auditLog.log({
        action: 'user.scim_deprovisioned',
        organizationId: org.id,
        userId,
      })
    }

    // Handle other updates (name, email, etc.)
    // ...

    return this.toSCIMUser(await this.db.user.findUnique({ where: { id: userId } }))
  }

  // Delete user
  @Delete('Users/:id')
  async deleteUser(
    @Headers('authorization') auth: string,
    @Param('id') userId: string
  ) {
    const org = await this.validateSCIMToken(auth)

    await this.db.organizationMember.delete({
      where: {
        userId_organizationId: {
          userId,
          organizationId: org.id,
        },
      },
    })

    await this.auditLog.log({
      action: 'user.scim_deleted',
      organizationId: org.id,
      userId,
    })

    return { status: 204 }
  }
}
```

### 4. Custom Roles & Permissions

**Requirement**: Enterprise customers need custom roles beyond the 4 standard roles.

**Implementation**:

```typescript
// Database schema
model CustomRole {
  id                String   @id @default(cuid())
  organizationId    String
  organization      Organization @relation(fields: [organizationId], references: [id])

  name              String           // "Security Auditor", "Read-Only Billing"
  description       String?

  // Granular permissions (100+ possible)
  permissions       Json             // ["repositories:read", "billing:read", ...]

  // System vs custom
  isSystemRole      Boolean @default(false)  // true for Owner/Admin/Member/Viewer

  // Assignment
  members           OrganizationMember[]

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@unique([organizationId, name])
  @@index([organizationId])
}

// Permission constants
const PERMISSIONS = {
  // Repositories
  'repositories:read': 'View repositories',
  'repositories:write': 'Create/update repositories',
  'repositories:delete': 'Delete repositories',
  'repositories:analyze': 'Run code analysis',

  // Users
  'users:read': 'View team members',
  'users:invite': 'Invite new members',
  'users:remove': 'Remove members',
  'users:change_role': 'Change member roles',

  // Billing
  'billing:read': 'View billing information',
  'billing:write': 'Update billing (payment methods, plans)',

  // Audit Logs
  'audit_logs:read': 'View audit logs',
  'audit_logs:export': 'Export audit logs',

  // Settings
  'settings:read': 'View organization settings',
  'settings:write': 'Update organization settings',
  'settings:sso': 'Configure SSO',

  // Integrations
  'integrations:read': 'View integrations',
  'integrations:write': 'Connect/disconnect integrations',

  // Analytics
  'analytics:read': 'View usage analytics',

  // Support
  'support:create_ticket': 'Create support tickets',

  // (100+ more permissions)
} as const

type Permission = keyof typeof PERMISSIONS
```

**Custom Role Management UI**:

```tsx
// apps/admin/app/(tenant)/enterprise/roles/page.tsx

export default async function CustomRolesPage() {
  const orgId = await getCurrentTenantId()
  const customRoles = await db.customRole.findMany({
    where: { organizationId: orgId, isSystemRole: false },
    include: { _count: { select: { members: true } } },
  })

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Custom Roles</h1>
        <CreateRoleDialog orgId={orgId} />
      </div>

      <Alert variant="info" className="mb-6">
        ℹ️ Create custom roles with specific permissions for your organization.
        Useful for security auditors, billing managers, etc.
      </Alert>

      <div className="grid gap-4">
        {customRoles.map((role) => (
          <Card key={role.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{role.name}</CardTitle>
                  <p className="text-sm text-slate-600">{role.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge>{role._count.members} members</Badge>
                  <DropdownMenu>
                    <DropdownMenuItem onClick={() => editRole(role)}>
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => deleteRole(role.id)} destructive>
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenu>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-semibold mb-2">Permissions:</p>
              <div className="flex flex-wrap gap-2">
                {(role.permissions as Permission[]).map((perm) => (
                  <Badge key={perm} variant="secondary">
                    {PERMISSIONS[perm]}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

function CreateRoleDialog({ orgId }: { orgId: string }) {
  const [selectedPermissions, setSelectedPermissions] = useState<Permission[]>([])

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>+ Create Custom Role</Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Create Custom Role</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <Label>Role Name</Label>
          <Input placeholder="e.g., Security Auditor" {...register('name')} />

          <Label>Description</Label>
          <Textarea placeholder="What can this role do?" {...register('description')} />

          <Label>Permissions</Label>
          <PermissionSelector
            permissions={Object.keys(PERMISSIONS)}
            selected={selectedPermissions}
            onChange={setSelectedPermissions}
          />

          <Button type="submit">Create Role</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

### 5. Customer Success Manager (CSM) Portal

**Requirement**: CSMs need a dashboard to monitor enterprise customer health and usage.

**Implementation**:

```tsx
// apps/admin/app/(platform)/csm/customers/page.tsx

export default async function CSMCustomersPage() {
  const csmUserId = await getCurrentUserId()

  // Get all enterprise customers assigned to this CSM
  const customers = await db.organization.findMany({
    where: {
      isEnterpriseCustomer: true,
      contract: {
        csmUserId,
      },
    },
    include: {
      contract: true,
      healthScore: true,
      _count: {
        select: {
          members: true,
          repositories: true,
        },
      },
    },
    orderBy: { contract: { renewalDate: 'asc' } },
  })

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">My Enterprise Customers</h1>

      {/* Health Summary */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <MetricCard
          title="Total Customers"
          value={customers.length}
        />
        <MetricCard
          title="At-Risk Renewals"
          value={customers.filter(c => c.healthScore?.renewalRisk === 'high').length}
          status="error"
        />
        <MetricCard
          title="Upcoming Renewals (90d)"
          value={customers.filter(c => isWithinDays(c.contract.renewalDate, 90)).length}
        />
        <MetricCard
          title="Total ARR"
          value={`$${customers.reduce((sum, c) => sum + c.contract.annualValue, 0).toLocaleString()}`}
        />
      </div>

      {/* Customer List */}
      <DataTable
        data={customers}
        columns={[
          { key: 'name', label: 'Customer', sortable: true },
          {
            key: 'healthScore.score',
            label: 'Health Score',
            render: (row) => <HealthScoreBadge score={row.healthScore?.score} />,
            sortable: true,
          },
          {
            key: 'contract.annualValue',
            label: 'ARR',
            render: (row) => `$${(row.contract.annualValue / 100).toLocaleString()}`,
            sortable: true,
          },
          {
            key: '_count.members',
            label: 'Users',
            sortable: true,
          },
          {
            key: 'contract.renewalDate',
            label: 'Renewal Date',
            render: (row) => formatDate(row.contract.renewalDate),
            sortable: true,
          },
          {
            key: 'healthScore.renewalRisk',
            label: 'Renewal Risk',
            render: (row) => <RenewalRiskBadge risk={row.healthScore?.renewalRisk} />,
          },
          {
            key: 'actions',
            label: '',
            render: (row) => (
              <Button variant="ghost" onClick={() => viewDetails(row.id)}>
                View Details →
              </Button>
            ),
          },
        ]}
        sortable
        filterable={{
          renewalRisk: ['low', 'medium', 'high'],
        }}
      />
    </div>
  )
}

// Customer Detail View
export async function CustomerDetailPage({ customerId }: { customerId: string }) {
  const customer = await db.organization.findUniqueOrThrow({
    where: { id: customerId },
    include: {
      contract: true,
      healthScore: true,
      childOrganizations: true,
    },
  })

  const usage = await getUsageMetrics(customerId, { last90Days: true })
  const supportTickets = await getSupportTickets(customerId, { last90Days: true })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">{customer.name}</h1>
          <p className="text-slate-600">
            Contract: {formatDate(customer.contract.startDate)} - {formatDate(customer.contract.endDate)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => scheduleQBR(customerId)}>
            📅 Schedule QBR
          </Button>
          <Button onClick={() => impersonateCustomer(customerId)}>
            🔑 Login as Customer
          </Button>
        </div>
      </div>

      {/* Health Score Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Customer Health Score</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-8">
            <div>
              <p className="text-5xl font-bold">{customer.healthScore.score}</p>
              <p className="text-sm text-slate-600">out of 100</p>
            </div>
            <div className="flex-1">
              <HealthScoreBreakdown
                featureAdoption={customer.healthScore.featureAdoption}
                usage={customer.healthScore.usageScore}
                support={customer.healthScore.supportScore}
                nps={customer.healthScore.nps}
              />
            </div>
          </div>

          {customer.healthScore.renewalRisk === 'high' && (
            <Alert variant="error" className="mt-4">
              ⚠️ HIGH RENEWAL RISK: Customer has low engagement and multiple support tickets.
              Recommend scheduling immediate check-in call.
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Usage Trends */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Usage Trends (Last 90 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <UsageChart data={usage.dailyMetrics} />
        </CardContent>
      </Card>

      {/* QBR Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Quarterly Business Review Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <QBRSummaryGenerator customer={customer} usage={usage} />
        </CardContent>
      </Card>
    </div>
  )
}
```

## Consequences

### Positive

1. **Enterprise-Ready**:
   - Supports complex enterprise deals ($100K+ ARR)
   - Self-service SSO/SCIM configuration reduces implementation time from weeks to hours
   - Multi-org hierarchy enables consolidated billing and cross-org visibility

2. **Reduced Support Burden**:
   - 90%+ of enterprise configuration tasks self-service
   - CSM portal reduces manual customer health tracking
   - Automated renewal reminders reduce churn

3. **Competitive Advantage**:
   - SSO/SCIM standard in enterprise SaaS (table stakes)
   - Custom roles differentiate from competitors
   - CSM portal improves customer success outcomes

4. **Revenue Growth**:
   - Target: 10-15 enterprise customers @ $150K ARR = $1.5M-$2.25M ARR
   - Higher ACV than standard tiers (Free: $0, Team: $4.7K, Business: $11.9K)

### Negative

1. **Complexity**:
   - 4 new database models (EnterpriseContract, SSOConfiguration, SCIMConfiguration, CustomRole)
   - SSO/SCIM require deep expertise in identity protocols
   - Multi-org hierarchy adds complexity to all queries

2. **Security Risks**:
   - SSO misconfiguration can lock out entire organizations
   - SCIM token leakage enables unauthorized access
   - Custom roles can grant excessive permissions

3. **Maintenance Burden**:
   - Each SSO provider (Okta, Azure AD, Google) has quirks
   - SCIM 2.0 spec allows provider-specific extensions
   - Customer health score algorithm needs tuning

### Mitigations

1. **Complexity**:
   - **Action**: Comprehensive SSO/SCIM documentation with screenshots
   - **Testing**: E2E tests for each SSO provider
   - **Wizard**: Step-by-step setup wizard reduces misconfiguration

2. **Security**:
   - **Action**: SCIM tokens encrypted at rest (AES-256)
   - **Audit**: All SSO/SCIM actions logged
   - **Testing**: SSO test mode allows password fallback
   - **Validation**: Permission validator prevents invalid custom roles

3. **Maintenance**:
   - **Action**: Provider-specific adapters abstract differences
   - **Monitoring**: SCIM sync errors logged to Datadog
   - **Documentation**: Provider setup guides (Okta, Azure AD, Google)

## Metrics & Success Criteria

### Adoption
- **Target**: 10-15 enterprise customers by end of Year 1
- **SSO Adoption**: 100% of enterprise customers configure SSO
- **SCIM Adoption**: 60%+ of enterprise customers use SCIM

### Self-Service
- **SSO Setup Time**: < 30 minutes (vs 2 weeks with eng support)
- **SCIM Setup Time**: < 15 minutes
- **Custom Role Creation**: < 5 minutes

### Customer Success
- **Health Score Accuracy**: 80%+ correlation with actual churn
- **CSM Response Time**: < 4 hours for at-risk customers
- **Renewal Rate**: 95%+ for enterprise customers

### Revenue
- **ARR Target**: $1.5M+ from enterprise customers (Year 1)
- **Average Deal Size**: $150K ARR
- **Upsell Rate**: 30%+ of Business customers upgrade to Enterprise

## References

### Research Sources
- [SAML 2.0 Specification](https://docs.oasis-open.org/security/saml/Post2.0/sstc-saml-tech-overview-2.0.html)
- [SCIM 2.0 Specification (RFC 7644)](https://datatracker.ietf.org/doc/html/rfc7644)
- [Customer Health Score Best Practices](https://www.gainsight.com/guides/the-essential-guide-to-customer-health-scores/)
- [Multi-Org Hierarchies in SaaS](https://www.chargebee.com/blog/saas-organizational-hierarchy/)

### Internal References
- ADR-002: Tenant Isolation Strategy
- ADR-014: Admin Portal - Multi-Tenant Management
- [Security & Compliance](/docs/technical/security-compliance.md)

## Review Date
April 2026 (3 months)

---

**Document Version**: 1.0
**Last Updated**: 2026-01-20
**Authors**: Engineering & Product Team
**Approved By**: CTO, Head of Sales
