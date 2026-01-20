# Feature: Organization Management

**Feature ID:** FF-008
**Version:** 1.0
**Status:** Draft
**Owner:** Engineering Team
**Dependencies:** FF-005 (Authentication System)
**Estimated Effort:** 2 weeks
**Priority:** P0 (Critical for Multi-Tenancy)

---

## Overview

Organization Management is the foundation of Forge Factory's multi-tenant architecture. It enables businesses to create organizations, manage settings, track usage, and isolate data between tenants.

### Business Context

**Why Organizations Matter:**
- **B2B SaaS Model:** Organizations are the billing entity, not individual users
- **Team Collaboration:** Multiple users work within the same organization context
- **Data Isolation:** Critical for security and compliance (tenant separation)
- **Scaling:** Organizations scale independently (10 users vs. 1,000 users)

**Market Requirements:**
- Slack, GitHub, Notion all use organization/workspace model
- Enterprise buyers expect team-based collaboration
- Average 12 users per organization (based on similar dev tools)

---

## User Stories

### Business Owner
```
As a business owner,
I want to create an organization for my company,
So that my team can collaborate on code analysis and refactoring.
```

### Organization Admin
```
As an organization admin,
I want to configure organization settings and branding,
So that I can customize the platform for my team.
```

### Team Member
```
As a team member,
I want to see which organizations I belong to,
So that I can switch between my personal and work contexts.
```

### Platform Admin
```
As a platform admin,
I want to monitor organization usage and health,
So that I can proactively support customers.
```

---

## Success Criteria

### Functional Requirements
- ✅ Create, read, update organizations
- ✅ Unique organization slugs (e.g., `acme-corp`)
- ✅ Organization settings (name, logo, timezone, etc.)
- ✅ Multiple users per organization
- ✅ User can belong to multiple organizations
- ✅ Organization switching in UI
- ✅ Usage tracking per organization
- ✅ Soft delete with 30-day recovery period

### Non-Functional Requirements
- ✅ Support 100,000+ organizations
- ✅ Organization context resolved in <5ms
- ✅ Complete data isolation (no cross-org data leaks)
- ✅ URL-based org context: `/org/:slug/...`
- ✅ GDPR-compliant data deletion

---

## Vertical Slice Architecture

### 1. Database Schema

```sql
-- Organizations (the core tenant entity)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL, -- URL-friendly identifier

  -- Subscription
  plan_tier VARCHAR(50) NOT NULL DEFAULT 'free', -- 'free', 'team', 'business', 'enterprise'

  -- Branding
  logo_url TEXT,
  brand_color VARCHAR(7), -- Hex color like #3B82F6

  -- Settings
  timezone VARCHAR(50) DEFAULT 'UTC',
  locale VARCHAR(10) DEFAULT 'en-US',
  settings JSONB DEFAULT '{}'::jsonb,

  -- Contact
  company_size VARCHAR(50), -- '1-10', '11-50', '51-200', '201-500', '500+'
  industry VARCHAR(100),
  website_url TEXT,

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active', 'suspended', 'deleted'
  suspended_at TIMESTAMPTZ,
  suspended_reason TEXT,

  -- Soft delete
  deleted_at TIMESTAMPTZ,
  deletion_scheduled_at TIMESTAMPTZ, -- Permanent deletion after 30 days

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_status ON organizations(status) WHERE status = 'active';
CREATE INDEX idx_organizations_plan_tier ON organizations(plan_tier);
CREATE INDEX idx_organizations_created_at ON organizations(created_at DESC);
CREATE INDEX idx_organizations_deleted_at ON organizations(deleted_at) WHERE deleted_at IS NULL;

-- Organization Members (many-to-many)
CREATE TABLE organization_members (
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Role
  role VARCHAR(20) NOT NULL DEFAULT 'member', -- 'owner', 'admin', 'member', 'viewer'

  -- Invitation
  invited_by UUID REFERENCES users(id),
  invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  joined_at TIMESTAMPTZ, -- NULL if invitation pending

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active', 'inactive'

  PRIMARY KEY (organization_id, user_id)
);

CREATE INDEX idx_organization_members_user_id ON organization_members(user_id);
CREATE INDEX idx_organization_members_organization_id ON organization_members(organization_id);
CREATE INDEX idx_organization_members_role ON organization_members(role);

-- Organization Settings (structured settings)
CREATE TABLE organization_settings (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,

  -- Security
  enforce_2fa BOOLEAN DEFAULT FALSE,
  session_timeout_minutes INTEGER DEFAULT 480, -- 8 hours
  allowed_email_domains TEXT[], -- Restrict members to certain email domains

  -- Notifications
  notify_on_analysis_complete BOOLEAN DEFAULT TRUE,
  notify_on_refactoring_complete BOOLEAN DEFAULT TRUE,
  notify_on_pr_created BOOLEAN DEFAULT TRUE,
  notification_channels JSONB DEFAULT '{"email": true, "slack": false}'::jsonb,

  -- Repository Defaults
  default_branch_protection JSONB DEFAULT '{
    "require_pr_reviews": true,
    "require_ci_pass": true,
    "allowed_merge_strategies": ["squash", "merge"]
  }'::jsonb,

  -- Analysis Defaults
  auto_analyze_on_push BOOLEAN DEFAULT TRUE,
  auto_generate_claude_md BOOLEAN DEFAULT TRUE,

  -- Billing
  billing_email TEXT,
  invoice_emails TEXT[], -- CC invoices to these emails

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES users(id)
);

-- Organization Invitations
CREATE TABLE invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Invitee
  email TEXT NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'member',

  -- Token
  token VARCHAR(64) UNIQUE NOT NULL, -- Secure random token

  -- Expiration
  expires_at TIMESTAMPTZ NOT NULL,

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'declined', 'expired'
  accepted_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,

  -- Audit
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invitations_token ON invitations(token);
CREATE INDEX idx_invitations_email ON invitations(email);
CREATE INDEX idx_invitations_organization_id ON invitations(organization_id);
CREATE INDEX idx_invitations_status ON invitations(status);
CREATE INDEX idx_invitations_expires_at ON invitations(expires_at) WHERE status = 'pending';

-- Organization Usage (aggregate statistics)
CREATE TABLE organization_usage (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,

  -- Current billing period
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,

  -- Usage metrics
  repositories_connected INTEGER DEFAULT 0,
  analyses_run INTEGER DEFAULT 0,
  loc_transformed BIGINT DEFAULT 0,
  prs_created INTEGER DEFAULT 0,
  api_calls INTEGER DEFAULT 0,

  -- Seat usage
  active_members INTEGER DEFAULT 0,

  -- Quotas (from plan)
  repositories_limit INTEGER,
  analyses_limit INTEGER,
  loc_limit BIGINT,
  api_calls_limit INTEGER,

  -- Overage
  repositories_overage INTEGER DEFAULT 0,
  analyses_overage INTEGER DEFAULT 0,
  loc_overage BIGINT DEFAULT 0,

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_organization_usage_period ON organization_usage(period_start, period_end);

-- Audit log for organization changes
CREATE TABLE organization_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Actor
  user_id UUID REFERENCES users(id),
  ip_address INET,

  -- Action
  action VARCHAR(100) NOT NULL, -- 'organization.created', 'organization.updated', 'settings.updated', 'member.added', etc.
  resource_type VARCHAR(50),
  resource_id UUID,

  -- Changes
  old_values JSONB,
  new_values JSONB,

  -- Metadata
  user_agent TEXT,
  metadata JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_organization_audit_log_organization_id ON organization_audit_log(organization_id, created_at DESC);
CREATE INDEX idx_organization_audit_log_user_id ON organization_audit_log(user_id, created_at DESC);
CREATE INDEX idx_organization_audit_log_action ON organization_audit_log(action, created_at DESC);
```

### 2. API Endpoints

#### Organization CRUD

**POST /api/v1/organizations**
```typescript
/**
 * @prompt-id forge-v4.1:feature:org:create-endpoint
 * @generated-at 2026-01-20T00:00:00Z
 */

// Request
{
  name: string; // "Acme Corporation"
  slug?: string; // Optional: auto-generated from name if not provided
  companySize?: '1-10' | '11-50' | '51-200' | '201-500' | '500+';
  industry?: string;
  websiteUrl?: string;
  timezone?: string; // Default: 'UTC'
}

// Response
{
  id: string;
  name: string;
  slug: string;
  planTier: 'free';
  role: 'owner'; // Creator becomes owner
  createdAt: string;
}

// Errors
// 400: Invalid slug (already taken, invalid characters)
// 402: User has reached org creation limit on free plan
```

**GET /api/v1/organizations/:orgId**
```typescript
// Get organization details

// Response
{
  id: string;
  name: string;
  slug: string;
  planTier: string;
  logoUrl: string | null;
  brandColor: string | null;
  companySize: string;
  industry: string;
  websiteUrl: string;
  timezone: string;
  locale: string;
  status: string;
  memberCount: number;
  repositoryCount: number;
  createdAt: string;
  updatedAt: string;
}

// Errors
// 403: Not a member of this organization
// 404: Organization not found
```

**PATCH /api/v1/organizations/:orgId**
```typescript
// Update organization (requires admin or owner role)

// Request
{
  name?: string;
  slug?: string; // Careful: changes URLs
  logoUrl?: string;
  brandColor?: string;
  companySize?: string;
  industry?: string;
  websiteUrl?: string;
  timezone?: string;
  locale?: string;
}

// Response: Updated organization
```

**DELETE /api/v1/organizations/:orgId**
```typescript
// Soft delete organization (requires owner role)
// Actual deletion happens after 30 days

// Response
{
  success: true;
  deletionScheduledAt: string; // Date when permanent deletion occurs
  message: "Organization will be permanently deleted on 2024-02-15"
}
```

**POST /api/v1/organizations/:orgId/cancel-deletion**
```typescript
// Cancel scheduled deletion (within 30 days)

// Response
{
  success: true;
  message: "Deletion cancelled. Organization restored."
}
```

#### Organization Switching

**GET /api/v1/users/me/organizations**
```typescript
// List all organizations for current user

// Query params
{
  includeInvitations?: boolean; // Default: false
}

// Response
{
  organizations: Array<{
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    role: 'owner' | 'admin' | 'member' | 'viewer';
    planTier: string;
    memberCount: number;
  }>;
  invitations: Array<{
    id: string;
    organizationName: string;
    organizationSlug: string;
    role: string;
    invitedBy: {
      name: string;
      email: string;
    };
    expiresAt: string;
  }>;
}
```

#### Settings

**GET /api/v1/organizations/:orgId/settings**
```typescript
// Get organization settings (requires member role)

// Response: OrganizationSettings object
```

**PATCH /api/v1/organizations/:orgId/settings**
```typescript
// Update organization settings (requires admin or owner role)

// Request: Partial<OrganizationSettings>
// Response: Updated settings
```

#### Usage & Analytics

**GET /api/v1/organizations/:orgId/usage**
```typescript
// Get current usage and quotas

// Response
{
  currentPeriod: {
    start: string;
    end: string;
  };
  usage: {
    repositoriesConnected: number;
    analysesRun: number;
    locTransformed: number;
    prsCreated: number;
    apiCalls: number;
    activeMembers: number;
  };
  limits: {
    repositories: number | null; // null = unlimited
    analyses: number | null;
    loc: number | null;
    apiCalls: number | null;
  };
  percentUsed: {
    repositories: number; // 0-100
    analyses: number;
    loc: number;
    apiCalls: number;
  };
  overage: {
    repositories: number;
    loc: number;
  };
}
```

**GET /api/v1/organizations/:orgId/usage/history**
```typescript
// Historical usage data

// Query params
{
  startDate: string;
  endDate: string;
  granularity: 'day' | 'week' | 'month'; // Default: 'day'
}

// Response
{
  periods: Array<{
    start: string;
    end: string;
    analysesRun: number;
    locTransformed: number;
    prsCreated: number;
  }>;
}
```

#### Audit Log

**GET /api/v1/organizations/:orgId/audit-log**
```typescript
// Get audit log (requires admin or owner role)

// Query params
{
  action?: string; // Filter by action type
  userId?: string; // Filter by user
  startDate?: string;
  endDate?: string;
  limit?: number; // Default: 50
  offset?: number;
}

// Response
{
  logs: Array<{
    id: string;
    action: string;
    user: {
      id: string;
      name: string;
      email: string;
    };
    resourceType: string;
    resourceId: string;
    oldValues: object;
    newValues: object;
    ipAddress: string;
    createdAt: string;
  }>;
  total: number;
}
```

### 3. Business Logic

#### Organization Service

```typescript
/**
 * @prompt-id forge-v4.1:feature:org:service
 * @generated-at 2026-01-20T00:00:00Z
 */

import slugify from 'slugify';
import crypto from 'crypto';

export class OrganizationService {
  /**
   * Create new organization
   */
  async createOrganization(
    userId: string,
    data: {
      name: string;
      slug?: string;
      companySize?: string;
      industry?: string;
      websiteUrl?: string;
      timezone?: string;
    }
  ): Promise<Organization> {
    // Generate slug if not provided
    let slug = data.slug || slugify(data.name, { lower: true, strict: true });

    // Ensure slug uniqueness
    const existingOrg = await db.organization.findUnique({ where: { slug } });
    if (existingOrg) {
      // Append random suffix
      slug = `${slug}-${crypto.randomBytes(3).toString('hex')}`;
    }

    // Validate slug format
    if (!/^[a-z0-9-]+$/.test(slug)) {
      throw new Error('Slug must contain only lowercase letters, numbers, and hyphens');
    }

    // Create organization
    const organization = await db.organization.create({
      data: {
        name: data.name,
        slug,
        companySize: data.companySize,
        industry: data.industry,
        websiteUrl: data.websiteUrl,
        timezone: data.timezone || 'UTC',
        planTier: 'free',
        status: 'active',
        createdBy: userId,
      },
    });

    // Add creator as owner
    await db.organizationMember.create({
      data: {
        organizationId: organization.id,
        userId,
        role: 'owner',
        joinedAt: new Date(),
      },
    });

    // Initialize settings
    await db.organizationSettings.create({
      data: {
        organizationId: organization.id,
      },
    });

    // Initialize usage tracking
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    await db.organizationUsage.create({
      data: {
        organizationId: organization.id,
        periodStart: now,
        periodEnd,
        activeMembers: 1,
      },
    });

    // Audit log
    await this.auditLog({
      organizationId: organization.id,
      userId,
      action: 'organization.created',
      newValues: { name: data.name, slug },
    });

    return organization;
  }

  /**
   * Update organization
   */
  async updateOrganization(
    organizationId: string,
    userId: string,
    updates: Partial<Organization>
  ): Promise<Organization> {
    // Get current org for audit
    const currentOrg = await db.organization.findUnique({
      where: { id: organizationId },
    });

    if (!currentOrg) {
      throw new Error('Organization not found');
    }

    // Check if slug is being changed and is unique
    if (updates.slug && updates.slug !== currentOrg.slug) {
      const existingOrg = await db.organization.findUnique({
        where: { slug: updates.slug },
      });

      if (existingOrg) {
        throw new Error('Slug already taken');
      }
    }

    // Update
    const updated = await db.organization.update({
      where: { id: organizationId },
      data: {
        ...updates,
        updatedAt: new Date(),
      },
    });

    // Audit log
    await this.auditLog({
      organizationId,
      userId,
      action: 'organization.updated',
      oldValues: currentOrg,
      newValues: updates,
    });

    return updated;
  }

  /**
   * Soft delete organization
   */
  async deleteOrganization(
    organizationId: string,
    userId: string
  ): Promise<{ deletionScheduledAt: Date }> {
    const now = new Date();
    const deletionDate = new Date(now);
    deletionDate.setDate(deletionDate.getDate() + 30); // 30 days

    await db.organization.update({
      where: { id: organizationId },
      data: {
        status: 'deleted',
        deletedAt: now,
        deletionScheduledAt: deletionDate,
      },
    });

    // Audit log
    await this.auditLog({
      organizationId,
      userId,
      action: 'organization.deleted',
      metadata: { deletionScheduledAt: deletionDate },
    });

    return { deletionScheduledAt: deletionDate };
  }

  /**
   * Cancel deletion
   */
  async cancelDeletion(
    organizationId: string,
    userId: string
  ): Promise<Organization> {
    const org = await db.organization.findUnique({
      where: { id: organizationId },
    });

    if (!org?.deletedAt) {
      throw new Error('Organization is not scheduled for deletion');
    }

    const updated = await db.organization.update({
      where: { id: organizationId },
      data: {
        status: 'active',
        deletedAt: null,
        deletionScheduledAt: null,
      },
    });

    // Audit log
    await this.auditLog({
      organizationId,
      userId,
      action: 'organization.deletion_cancelled',
    });

    return updated;
  }

  /**
   * Get user's role in organization
   */
  async getUserRole(
    userId: string,
    organizationId: string
  ): Promise<string | null> {
    const member = await db.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
      },
    });

    return member?.role || null;
  }

  /**
   * Check if user has permission in organization
   */
  async hasPermission(
    userId: string,
    organizationId: string,
    requiredRole: 'viewer' | 'member' | 'admin' | 'owner'
  ): Promise<boolean> {
    const role = await this.getUserRole(userId, organizationId);
    if (!role) return false;

    const roleHierarchy = {
      viewer: 0,
      member: 1,
      admin: 2,
      owner: 3,
    };

    return roleHierarchy[role] >= roleHierarchy[requiredRole];
  }

  /**
   * Get organization usage
   */
  async getUsage(organizationId: string): Promise<any> {
    const usage = await db.organizationUsage.findUnique({
      where: { organizationId },
    });

    if (!usage) {
      throw new Error('Usage data not found');
    }

    // Calculate percent used
    const percentUsed = {
      repositories: usage.repositoriesLimit
        ? (usage.repositoriesConnected / usage.repositoriesLimit) * 100
        : 0,
      analyses: usage.analysesLimit
        ? (usage.analysesRun / usage.analysesLimit) * 100
        : 0,
      loc: usage.locLimit ? (usage.locTransformed / usage.locLimit) * 100 : 0,
      apiCalls: usage.apiCallsLimit
        ? (usage.apiCalls / usage.apiCallsLimit) * 100
        : 0,
    };

    return {
      currentPeriod: {
        start: usage.periodStart,
        end: usage.periodEnd,
      },
      usage: {
        repositoriesConnected: usage.repositoriesConnected,
        analysesRun: usage.analysesRun,
        locTransformed: usage.locTransformed,
        prsCreated: usage.prsCreated,
        apiCalls: usage.apiCalls,
        activeMembers: usage.activeMembers,
      },
      limits: {
        repositories: usage.repositoriesLimit,
        analyses: usage.analysesLimit,
        loc: usage.locLimit,
        apiCalls: usage.apiCallsLimit,
      },
      percentUsed,
      overage: {
        repositories: usage.repositoriesOverage,
        loc: usage.locOverage,
      },
    };
  }

  /**
   * Increment usage metric
   */
  async incrementUsage(
    organizationId: string,
    metric: 'analysesRun' | 'locTransformed' | 'prsCreated' | 'apiCalls',
    amount: number = 1
  ): Promise<void> {
    await db.organizationUsage.update({
      where: { organizationId },
      data: {
        [metric]: { increment: amount },
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Audit log helper
   */
  private async auditLog(data: {
    organizationId: string;
    userId: string;
    action: string;
    resourceType?: string;
    resourceId?: string;
    oldValues?: any;
    newValues?: any;
    metadata?: any;
  }): Promise<void> {
    await db.organizationAuditLog.create({ data });
  }
}
```

### 4. UI Components

#### Organization Switcher

**File:** `apps/web/src/components/organization-switcher.tsx`

```typescript
/**
 * @prompt-id forge-v4.1:feature:org:switcher
 * @generated-at 2026-01-20T00:00:00Z
 */

'use client';

import { useRouter } from 'next/navigation';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useOrganizations } from '@/hooks/api/organizations';
import { Avatar } from '@/components/ui/avatar';

export function OrganizationSwitcher({
  currentOrgSlug,
}: {
  currentOrgSlug: string;
}) {
  const router = useRouter();
  const { data: orgs } = useOrganizations();

  const currentOrg = orgs?.organizations.find((o) => o.slug === currentOrgSlug);

  const handleSwitch = (slug: string) => {
    router.push(`/${slug}`);
  };

  const handleCreateOrg = () => {
    router.push('/organizations/new');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between"
        >
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              {currentOrg?.logoUrl ? (
                <img src={currentOrg.logoUrl} alt={currentOrg.name} />
              ) : (
                <div className="bg-primary text-primary-foreground text-xs">
                  {currentOrg?.name.charAt(0)}
                </div>
              )}
            </Avatar>
            <span className="truncate">{currentOrg?.name}</span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Organizations</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {orgs?.organizations.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onClick={() => handleSwitch(org.slug)}
            className="cursor-pointer"
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <Avatar className="h-5 w-5">
                  {org.logoUrl ? (
                    <img src={org.logoUrl} alt={org.name} />
                  ) : (
                    <div className="bg-primary text-primary-foreground text-xs">
                      {org.name.charAt(0)}
                    </div>
                  )}
                </Avatar>
                <div>
                  <div className="font-medium">{org.name}</div>
                  <div className="text-xs text-muted-foreground">{org.role}</div>
                </div>
              </div>
              {org.slug === currentOrgSlug && (
                <Check className="h-4 w-4 text-primary" />
              )}
            </div>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleCreateOrg} className="cursor-pointer">
          <Plus className="mr-2 h-4 w-4" />
          Create Organization
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

#### Organization Settings Page

**File:** `apps/web/src/app/(dashboard)/[orgSlug]/settings/general/page.tsx`

```typescript
/**
 * @prompt-id forge-v4.1:feature:org:settings-page
 * @generated-at 2026-01-20T00:00:00Z
 */

'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  useOrganization,
  useUpdateOrganization,
} from '@/hooks/api/organizations';

const orgSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  slug: z
    .string()
    .min(3)
    .regex(/^[a-z0-9-]+$/, 'Only lowercase letters, numbers, and hyphens'),
  websiteUrl: z.string().url().optional().or(z.literal('')),
  timezone: z.string(),
});

type OrgFormData = z.infer<typeof orgSchema>;

export default function OrganizationSettingsPage({
  params,
}: {
  params: { orgSlug: string };
}) {
  const { toast } = useToast();
  const { data: org, isLoading } = useOrganization(params.orgSlug);
  const updateMutation = useUpdateOrganization(params.orgSlug);

  const form = useForm<OrgFormData>({
    resolver: zodResolver(orgSchema),
    values: org
      ? {
          name: org.name,
          slug: org.slug,
          websiteUrl: org.websiteUrl || '',
          timezone: org.timezone,
        }
      : undefined,
  });

  const onSubmit = async (data: OrgFormData) => {
    try {
      await updateMutation.mutateAsync(data);
      toast({ title: 'Organization updated successfully' });
    } catch (error) {
      toast({
        title: 'Failed to update organization',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Organization Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your organization's profile and settings
        </p>
      </div>

      <Card className="p-6">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <Label htmlFor="name">Organization Name</Label>
            <Input id="name" {...form.register('name')} />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive mt-1">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="slug">URL Slug</Label>
            <Input id="slug" {...form.register('slug')} />
            <p className="text-sm text-muted-foreground mt-1">
              Used in URLs: forge.factory/{form.watch('slug')}
            </p>
            {form.formState.errors.slug && (
              <p className="text-sm text-destructive mt-1">
                {form.formState.errors.slug.message}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="websiteUrl">Website</Label>
            <Input
              id="websiteUrl"
              type="url"
              placeholder="https://example.com"
              {...form.register('websiteUrl')}
            />
          </div>

          <div>
            <Label htmlFor="timezone">Timezone</Label>
            <select
              id="timezone"
              {...form.register('timezone')}
              className="w-full p-2 border rounded"
            >
              <option value="UTC">UTC</option>
              <option value="America/New_York">Eastern Time</option>
              <option value="America/Chicago">Central Time</option>
              <option value="America/Denver">Mountain Time</option>
              <option value="America/Los_Angeles">Pacific Time</option>
              <option value="Europe/London">London</option>
              <option value="Europe/Paris">Paris</option>
              <option value="Asia/Tokyo">Tokyo</option>
            </select>
          </div>

          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
```

### 5. Tests

**File:** `packages/backend/src/features/organization/__tests__/organization.service.test.ts`

```typescript
/**
 * @prompt-id forge-v4.1:feature:org:service-tests
 * @generated-at 2026-01-20T00:00:00Z
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { OrganizationService } from '../organization.service';
import { db } from '@/lib/db';

describe('OrganizationService', () => {
  let orgService: OrganizationService;
  let mockUser: any;

  beforeEach(async () => {
    orgService = new OrganizationService();

    mockUser = await db.user.create({
      data: {
        email: 'owner@example.com',
        firstName: 'Test',
        authMethod: 'email',
      },
    });
  });

  describe('createOrganization', () => {
    it('should create organization with auto-generated slug', async () => {
      const org = await orgService.createOrganization(mockUser.id, {
        name: 'Acme Corporation',
      });

      expect(org.name).toBe('Acme Corporation');
      expect(org.slug).toBe('acme-corporation');
      expect(org.planTier).toBe('free');

      // Verify creator is owner
      const member = await db.organizationMember.findFirst({
        where: { organizationId: org.id, userId: mockUser.id },
      });
      expect(member?.role).toBe('owner');
    });

    it('should handle duplicate slugs', async () => {
      await orgService.createOrganization(mockUser.id, {
        name: 'Acme Corp',
        slug: 'acme',
      });

      const org2 = await orgService.createOrganization(mockUser.id, {
        name: 'Acme Corp 2',
        slug: 'acme',
      });

      expect(org2.slug).toMatch(/^acme-[a-f0-9]{6}$/);
    });

    it('should initialize organization settings', async () => {
      const org = await orgService.createOrganization(mockUser.id, {
        name: 'Test Org',
      });

      const settings = await db.organizationSettings.findUnique({
        where: { organizationId: org.id },
      });

      expect(settings).toBeDefined();
      expect(settings.enforce2fa).toBe(false);
    });

    it('should initialize usage tracking', async () => {
      const org = await orgService.createOrganization(mockUser.id, {
        name: 'Test Org',
      });

      const usage = await db.organizationUsage.findUnique({
        where: { organizationId: org.id },
      });

      expect(usage).toBeDefined();
      expect(usage.activeMembers).toBe(1);
    });
  });

  describe('updateOrganization', () => {
    it('should update organization fields', async () => {
      const org = await orgService.createOrganization(mockUser.id, {
        name: 'Original Name',
      });

      const updated = await orgService.updateOrganization(
        org.id,
        mockUser.id,
        {
          name: 'Updated Name',
          websiteUrl: 'https://example.com',
        }
      );

      expect(updated.name).toBe('Updated Name');
      expect(updated.websiteUrl).toBe('https://example.com');
    });

    it('should prevent duplicate slug', async () => {
      await orgService.createOrganization(mockUser.id, {
        name: 'Org 1',
        slug: 'org-1',
      });

      const org2 = await orgService.createOrganization(mockUser.id, {
        name: 'Org 2',
        slug: 'org-2',
      });

      await expect(
        orgService.updateOrganization(org2.id, mockUser.id, { slug: 'org-1' })
      ).rejects.toThrow('Slug already taken');
    });
  });

  describe('deleteOrganization', () => {
    it('should soft delete organization', async () => {
      const org = await orgService.createOrganization(mockUser.id, {
        name: 'To Delete',
      });

      const result = await orgService.deleteOrganization(org.id, mockUser.id);

      expect(result.deletionScheduledAt).toBeDefined();

      const deleted = await db.organization.findUnique({
        where: { id: org.id },
      });

      expect(deleted.status).toBe('deleted');
      expect(deleted.deletedAt).not.toBeNull();
    });

    it('should allow cancellation within 30 days', async () => {
      const org = await orgService.createOrganization(mockUser.id, {
        name: 'To Delete',
      });

      await orgService.deleteOrganization(org.id, mockUser.id);
      const restored = await orgService.cancelDeletion(org.id, mockUser.id);

      expect(restored.status).toBe('active');
      expect(restored.deletedAt).toBeNull();
    });
  });

  describe('getUserRole', () => {
    it('should return user role in organization', async () => {
      const org = await orgService.createOrganization(mockUser.id, {
        name: 'Test Org',
      });

      const role = await orgService.getUserRole(mockUser.id, org.id);
      expect(role).toBe('owner');
    });

    it('should return null for non-member', async () => {
      const org = await orgService.createOrganization(mockUser.id, {
        name: 'Test Org',
      });

      const otherUser = await db.user.create({
        data: { email: 'other@example.com' },
      });

      const role = await orgService.getUserRole(otherUser.id, org.id);
      expect(role).toBeNull();
    });
  });

  describe('hasPermission', () => {
    it('should check role hierarchy correctly', async () => {
      const org = await orgService.createOrganization(mockUser.id, {
        name: 'Test Org',
      });

      // Owner has all permissions
      expect(
        await orgService.hasPermission(mockUser.id, org.id, 'owner')
      ).toBe(true);
      expect(
        await orgService.hasPermission(mockUser.id, org.id, 'admin')
      ).toBe(true);
      expect(
        await orgService.hasPermission(mockUser.id, org.id, 'member')
      ).toBe(true);
    });
  });
});
```

---

## Implementation Plan

### Week 1
**Days 1-2:** Database schema and migrations
**Days 3-4:** OrganizationService (CRUD operations)
**Day 5:** API endpoints

### Week 2
**Days 1-2:** UI components (switcher, settings page)
**Days 3-4:** Usage tracking and audit logging
**Day 5:** Testing and documentation

---

## Security Considerations

1. **Data Isolation**
   - All queries MUST include organization_id filter
   - Row-level security policies in PostgreSQL
   - Prevent cross-org data leaks

2. **Slug Security**
   - Validate slug format (no special chars)
   - Prevent SQL injection via slugs
   - Reserve system slugs ('admin', 'api', 'www')

3. **Soft Delete**
   - 30-day recovery period
   - Background job for permanent deletion
   - Cascade delete all related data

4. **Audit Logging**
   - Log all organization changes
   - Immutable audit log
   - Include IP and user agent

---

## Performance Considerations

1. **Organization Context Resolution**
   - Cache org by slug in Redis (5 min TTL)
   - Target: <5ms lookup

2. **Member Queries**
   - Index on (organization_id, user_id)
   - Index on user_id for user's orgs query

3. **Usage Tracking**
   - Async increment (don't block requests)
   - Daily rollup for historical data

---

## Success Metrics

- Support 100,000+ organizations
- <5ms organization context resolution (P95)
- Zero cross-org data leaks
- 95% user satisfaction with org management

---

**Status:** Ready for implementation
