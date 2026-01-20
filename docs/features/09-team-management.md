# Feature: Team Management

**Feature ID:** FF-009
**Version:** 1.0
**Status:** Draft
**Owner:** Engineering Team
**Dependencies:** FF-005 (Authentication), FF-008 (Organization Management)
**Estimated Effort:** 2 weeks
**Priority:** P0 (Critical for Collaboration)

---

## Overview

Team Management enables organizations to invite members, assign roles, and manage team collaboration. It's essential for B2B SaaS where teams work together on code analysis and refactoring projects.

### Business Context

**Why Team Management Matters:**
- **Collaboration:** Average 8-12 developers per team using dev tools
- **Permission Control:** Different team members need different access levels
- **Onboarding:** Smooth invitation flow reduces friction for new users
- **Seat-Based Billing:** Track active members for usage-based pricing

**Industry Benchmarks:**
- GitHub: Avg 10 members per organization
- Slack: Avg 15 members per workspace
- **Forge Factory Target:** 5-20 members per organization

---

## User Stories

### Organization Admin
```
As an organization admin,
I want to invite team members via email,
So that my team can collaborate on codebase improvements.
```

### Team Member
```
As a team member,
I want to accept an invitation to join an organization,
So that I can access shared repositories and analyses.
```

### Organization Owner
```
As an organization owner,
I want to manage member roles and remove members,
So that I can control access to sensitive code and features.
```

### New User
```
As a new user receiving an invitation,
I want to sign up and automatically join the organization,
So that I can get started quickly.
```

---

## Success Criteria

### Functional Requirements
- ✅ Invite members via email address
- ✅ Send invitation email with magic link
- ✅ Accept/decline invitations
- ✅ Auto-create account on invitation acceptance
- ✅ Update member roles (viewer → member → admin → owner)
- ✅ Remove members from organization
- ✅ Transfer ownership to another member
- ✅ Bulk invite (CSV import)
- ✅ Resend invitations
- ✅ Cancel pending invitations

### Non-Functional Requirements
- ✅ Invitation emails delivered in <30 seconds
- ✅ Support 1,000+ members per organization (Enterprise tier)
- ✅ Invitation links expire after 7 days
- ✅ GDPR-compliant invitation data handling
- ✅ Audit log for all team changes

---

## Vertical Slice Architecture

### 1. Database Schema

```sql
-- Organization Members (from FF-008, extended)
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
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active', 'inactive', 'suspended'
  deactivated_at TIMESTAMPTZ,
  deactivated_by UUID REFERENCES users(id),

  PRIMARY KEY (organization_id, user_id)
);

CREATE INDEX idx_organization_members_user_id ON organization_members(user_id);
CREATE INDEX idx_organization_members_organization_id ON organization_members(organization_id);
CREATE INDEX idx_organization_members_role ON organization_members(role);
CREATE INDEX idx_organization_members_status ON organization_members(status) WHERE status = 'active';

-- Invitations (from FF-008, extended)
CREATE TABLE invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Invitee
  email TEXT NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'member',

  -- Token
  token VARCHAR(64) UNIQUE NOT NULL, -- Secure random token

  -- Personal message (optional)
  message TEXT,

  -- Expiration
  expires_at TIMESTAMPTZ NOT NULL,

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'declined', 'expired', 'cancelled'
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES users(id),
  declined_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES users(id),

  -- Audit
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invitations_token ON invitations(token);
CREATE INDEX idx_invitations_email ON invitations(email);
CREATE INDEX idx_invitations_organization_id ON invitations(organization_id);
CREATE INDEX idx_invitations_status ON invitations(status);
CREATE INDEX idx_invitations_expires_at ON invitations(expires_at) WHERE status = 'pending';

-- Invitation history (for analytics)
CREATE TABLE invitation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id UUID NOT NULL REFERENCES invitations(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Event
  event_type VARCHAR(50) NOT NULL, -- 'invited', 'email_opened', 'accepted', 'declined', 'expired', 'cancelled'

  -- Context
  user_id UUID REFERENCES users(id),
  ip_address INET,
  user_agent TEXT,
  metadata JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invitation_events_invitation_id ON invitation_events(invitation_id, created_at DESC);
CREATE INDEX idx_invitation_events_event_type ON invitation_events(event_type, created_at DESC);

-- Team audit log (subset of organization_audit_log)
CREATE TABLE team_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Actor
  actor_user_id UUID REFERENCES users(id), -- Who performed the action
  target_user_id UUID REFERENCES users(id), -- Who was affected

  -- Action
  action VARCHAR(100) NOT NULL, -- 'member.invited', 'member.added', 'member.removed', 'member.role_changed', 'ownership.transferred'

  -- Details
  old_value JSONB,
  new_value JSONB,

  -- Context
  ip_address INET,
  user_agent TEXT,
  metadata JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_team_audit_log_organization_id ON team_audit_log(organization_id, created_at DESC);
CREATE INDEX idx_team_audit_log_actor ON team_audit_log(actor_user_id, created_at DESC);
CREATE INDEX idx_team_audit_log_target ON team_audit_log(target_user_id, created_at DESC);
CREATE INDEX idx_team_audit_log_action ON team_audit_log(action, created_at DESC);
```

### 2. API Endpoints

#### Invitation Endpoints

**POST /api/v1/organizations/:orgId/members/invite**
```typescript
/**
 * @prompt-id forge-v4.1:feature:team:invite-endpoint
 * @generated-at 2026-01-20T00:00:00Z
 */

// Request (requires admin or owner role)
{
  email: string | string[]; // Single email or array for bulk invite
  role: 'viewer' | 'member' | 'admin'; // Cannot invite as owner
  message?: string; // Optional personal message
}

// Response
{
  invitations: Array<{
    id: string;
    email: string;
    role: string;
    expiresAt: string;
    inviteUrl: string;
  }>;
  errors?: Array<{
    email: string;
    error: string;
  }>;
}

// Errors
// 400: Invalid email format
// 403: Insufficient permissions
// 409: User already a member
// 429: Too many invitations (rate limit)
```

**POST /api/v1/invitations/:token/accept**
```typescript
// Accept invitation (public endpoint, no auth required)

// Response
{
  organization: {
    id: string;
    name: string;
    slug: string;
  };
  role: string;
  message: string; // "Welcome to {org}!"
}

// Errors
// 400: Invalid or expired token
// 409: User already member of org
```

**POST /api/v1/invitations/:token/decline**
```typescript
// Decline invitation (public endpoint)

// Response
{
  success: true;
  message: "Invitation declined";
}
```

**GET /api/v1/users/me/invitations**
```typescript
// Get all pending invitations for current user

// Response
{
  invitations: Array<{
    id: string;
    token: string;
    organization: {
      id: string;
      name: string;
      slug: string;
      logoUrl: string | null;
    };
    role: string;
    message: string | null;
    invitedBy: {
      name: string;
      email: string;
    };
    expiresAt: string;
    createdAt: string;
  }>;
}
```

**GET /api/v1/organizations/:orgId/invitations**
```typescript
// List all invitations for organization (requires admin or owner)

// Query params
{
  status?: 'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled';
  limit?: number;
  offset?: number;
}

// Response
{
  invitations: Array<{
    id: string;
    email: string;
    role: string;
    status: string;
    message: string | null;
    invitedBy: {
      name: string;
      email: string;
    };
    expiresAt: string;
    createdAt: string;
  }>;
  total: number;
}
```

**POST /api/v1/organizations/:orgId/invitations/:inviteId/resend**
```typescript
// Resend invitation email (requires admin or owner)

// Response
{
  success: true;
  message: "Invitation resent";
}
```

**DELETE /api/v1/organizations/:orgId/invitations/:inviteId**
```typescript
// Cancel invitation (requires admin or owner)

// Response
{
  success: true;
  message: "Invitation cancelled";
}
```

#### Member Management Endpoints

**GET /api/v1/organizations/:orgId/members**
```typescript
// List organization members

// Query params
{
  role?: 'owner' | 'admin' | 'member' | 'viewer';
  status?: 'active' | 'inactive' | 'suspended';
  search?: string; // Search by name or email
  limit?: number;
  offset?: number;
  sortBy?: 'name' | 'joinedAt' | 'role';
  sortOrder?: 'asc' | 'desc';
}

// Response
{
  members: Array<{
    user: {
      id: string;
      name: string;
      email: string;
      avatarUrl: string | null;
    };
    role: string;
    status: string;
    joinedAt: string;
    lastActiveAt: string | null;
    invitedBy: {
      name: string;
      email: string;
    } | null;
  }>;
  total: number;
  summary: {
    totalMembers: number;
    byRole: {
      owner: number;
      admin: number;
      member: number;
      viewer: number;
    };
    activeMembers: number;
  };
}
```

**GET /api/v1/organizations/:orgId/members/:userId**
```typescript
// Get specific member details

// Response
{
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string;
  };
  role: string;
  status: string;
  joinedAt: string;
  invitedBy: {
    name: string;
    email: string;
  };
  permissions: string[]; // Array of permissions based on role
  activity: {
    lastActiveAt: string;
    repositoriesAccessed: number;
    analysesRun: number;
    prsCreated: number;
  };
}
```

**PATCH /api/v1/organizations/:orgId/members/:userId/role**
```typescript
// Update member role (requires admin or owner)

// Request
{
  role: 'viewer' | 'member' | 'admin' | 'owner';
}

// Response: Updated member

// Errors
// 400: Cannot change own role
// 403: Insufficient permissions (only owner can promote to admin/owner)
// 409: Cannot have multiple owners (must transfer ownership)
```

**DELETE /api/v1/organizations/:orgId/members/:userId**
```typescript
// Remove member from organization (requires admin or owner)

// Response
{
  success: true;
  message: "Member removed from organization";
}

// Errors
// 400: Cannot remove yourself (use leave endpoint)
// 403: Cannot remove owner (must transfer ownership first)
```

**POST /api/v1/organizations/:orgId/leave**
```typescript
// Leave organization (self-service)

// Response
{
  success: true;
  message: "You have left the organization";
}

// Errors
// 400: Owners cannot leave (must transfer ownership first)
```

**POST /api/v1/organizations/:orgId/transfer-ownership**
```typescript
// Transfer ownership to another member (requires owner role)

// Request
{
  newOwnerId: string;
  confirmEmail: string; // Must match owner's email for security
}

// Response
{
  success: true;
  message: "Ownership transferred successfully";
  newOwner: {
    id: string;
    name: string;
    email: string;
  };
}

// Errors
// 400: Target user must be an existing member
// 403: Only owner can transfer ownership
// 409: Confirmation email mismatch
```

#### Bulk Operations

**POST /api/v1/organizations/:orgId/members/import**
```typescript
// Bulk import members from CSV (requires admin or owner)

// Request (multipart/form-data)
{
  file: File; // CSV with columns: email, role, message
}

// Response
{
  imported: number;
  errors: Array<{
    row: number;
    email: string;
    error: string;
  }>;
  invitations: Array<{
    email: string;
    role: string;
  }>;
}
```

**POST /api/v1/organizations/:orgId/members/bulk-update**
```typescript
// Bulk update member roles

// Request
{
  updates: Array<{
    userId: string;
    role: 'viewer' | 'member' | 'admin';
  }>;
}

// Response
{
  updated: number;
  errors: Array<{
    userId: string;
    error: string;
  }>;
}
```

### 3. Business Logic

#### Team Service

```typescript
/**
 * @prompt-id forge-v4.1:feature:team:service
 * @generated-at 2026-01-20T00:00:00Z
 */

import crypto from 'crypto';
import { sendEmail } from '@/lib/email';

export class TeamService {
  /**
   * Invite member(s) to organization
   */
  async inviteMembers(
    organizationId: string,
    inviterId: string,
    invites: Array<{
      email: string;
      role: string;
      message?: string;
    }>
  ): Promise<{
    invitations: Invitation[];
    errors: Array<{ email: string; error: string }>;
  }> {
    const invitations: Invitation[] = [];
    const errors: Array<{ email: string; error: string }> = [];

    const organization = await db.organization.findUnique({
      where: { id: organizationId },
    });

    const inviter = await db.user.findUnique({
      where: { id: inviterId },
    });

    for (const invite of invites) {
      try {
        // Validate email
        if (!this.isValidEmail(invite.email)) {
          errors.push({ email: invite.email, error: 'Invalid email format' });
          continue;
        }

        // Check if already a member
        const existingMember = await db.organizationMember.findFirst({
          where: {
            organizationId,
            user: { email: invite.email },
          },
        });

        if (existingMember) {
          errors.push({
            email: invite.email,
            error: 'Already a member of this organization',
          });
          continue;
        }

        // Check for pending invitation
        const pendingInvite = await db.invitation.findFirst({
          where: {
            organizationId,
            email: invite.email,
            status: 'pending',
            expiresAt: { gt: new Date() },
          },
        });

        if (pendingInvite) {
          errors.push({
            email: invite.email,
            error: 'Invitation already sent',
          });
          continue;
        }

        // Generate secure token
        const token = crypto.randomBytes(32).toString('hex');

        // Calculate expiration (7 days)
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        // Create invitation
        const invitation = await db.invitation.create({
          data: {
            organizationId,
            email: invite.email,
            role: invite.role,
            message: invite.message,
            token,
            expiresAt,
            createdBy: inviterId,
          },
        });

        invitations.push(invitation);

        // Log event
        await db.invitationEvent.create({
          data: {
            invitationId: invitation.id,
            organizationId,
            eventType: 'invited',
            userId: inviterId,
          },
        });

        // Send invitation email
        await this.sendInvitationEmail(
          invitation,
          organization,
          inviter
        );

        // Audit log
        await db.teamAuditLog.create({
          data: {
            organizationId,
            actorUserId: inviterId,
            action: 'member.invited',
            newValue: {
              email: invite.email,
              role: invite.role,
            },
          },
        });
      } catch (error) {
        errors.push({
          email: invite.email,
          error: error.message || 'Failed to create invitation',
        });
      }
    }

    return { invitations, errors };
  }

  /**
   * Accept invitation
   */
  async acceptInvitation(
    token: string,
    userId: string
  ): Promise<{ organization: Organization; member: OrganizationMember }> {
    // Find invitation
    const invitation = await db.invitation.findUnique({
      where: { token },
      include: { organization: true },
    });

    if (!invitation) {
      throw new Error('Invitation not found');
    }

    if (invitation.status !== 'pending') {
      throw new Error(`Invitation already ${invitation.status}`);
    }

    if (invitation.expiresAt < new Date()) {
      await db.invitation.update({
        where: { id: invitation.id },
        data: { status: 'expired' },
      });
      throw new Error('Invitation expired');
    }

    // Get user
    const user = await db.user.findUnique({
      where: { id: userId },
    });

    // Verify email matches
    if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      throw new Error('Email mismatch - sign in with the invited email');
    }

    // Check if already a member
    const existingMember = await db.organizationMember.findFirst({
      where: {
        organizationId: invitation.organizationId,
        userId,
      },
    });

    if (existingMember) {
      // Mark invitation as accepted but user already member
      await db.invitation.update({
        where: { id: invitation.id },
        data: {
          status: 'accepted',
          acceptedAt: new Date(),
          acceptedBy: userId,
        },
      });
      return { organization: invitation.organization, member: existingMember };
    }

    // Add user to organization
    const member = await db.organizationMember.create({
      data: {
        organizationId: invitation.organizationId,
        userId,
        role: invitation.role,
        invitedBy: invitation.createdBy,
        joinedAt: new Date(),
      },
    });

    // Update invitation
    await db.invitation.update({
      where: { id: invitation.id },
      data: {
        status: 'accepted',
        acceptedAt: new Date(),
        acceptedBy: userId,
      },
    });

    // Increment active members count
    await db.organizationUsage.update({
      where: { organizationId: invitation.organizationId },
      data: {
        activeMembers: { increment: 1 },
      },
    });

    // Log event
    await db.invitationEvent.create({
      data: {
        invitationId: invitation.id,
        organizationId: invitation.organizationId,
        eventType: 'accepted',
        userId,
      },
    });

    // Audit log
    await db.teamAuditLog.create({
      data: {
        organizationId: invitation.organizationId,
        targetUserId: userId,
        action: 'member.added',
        newValue: {
          email: user.email,
          role: invitation.role,
        },
      },
    });

    return { organization: invitation.organization, member };
  }

  /**
   * Decline invitation
   */
  async declineInvitation(token: string): Promise<void> {
    const invitation = await db.invitation.findUnique({
      where: { token },
    });

    if (!invitation || invitation.status !== 'pending') {
      throw new Error('Invalid invitation');
    }

    await db.invitation.update({
      where: { id: invitation.id },
      data: {
        status: 'declined',
        declinedAt: new Date(),
      },
    });

    // Log event
    await db.invitationEvent.create({
      data: {
        invitationId: invitation.id,
        organizationId: invitation.organizationId,
        eventType: 'declined',
      },
    });
  }

  /**
   * Update member role
   */
  async updateMemberRole(
    organizationId: string,
    targetUserId: string,
    newRole: string,
    actorUserId: string
  ): Promise<OrganizationMember> {
    // Get current member
    const member = await db.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: targetUserId,
        },
      },
    });

    if (!member) {
      throw new Error('Member not found');
    }

    const oldRole = member.role;

    // Prevent self role change
    if (actorUserId === targetUserId) {
      throw new Error('Cannot change your own role');
    }

    // Owner transfer requires special endpoint
    if (newRole === 'owner') {
      throw new Error('Use transfer-ownership endpoint to change ownership');
    }

    // Update role
    const updated = await db.organizationMember.update({
      where: {
        organizationId_userId: {
          organizationId,
          userId: targetUserId,
        },
      },
      data: { role: newRole },
    });

    // Audit log
    await db.teamAuditLog.create({
      data: {
        organizationId,
        actorUserId,
        targetUserId,
        action: 'member.role_changed',
        oldValue: { role: oldRole },
        newValue: { role: newRole },
      },
    });

    return updated;
  }

  /**
   * Remove member
   */
  async removeMember(
    organizationId: string,
    targetUserId: string,
    actorUserId: string
  ): Promise<void> {
    const member = await db.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: targetUserId,
        },
      },
    });

    if (!member) {
      throw new Error('Member not found');
    }

    // Cannot remove owner
    if (member.role === 'owner') {
      throw new Error('Cannot remove owner - transfer ownership first');
    }

    // Cannot remove self (use leave endpoint)
    if (actorUserId === targetUserId) {
      throw new Error('Use leave endpoint to remove yourself');
    }

    // Remove member
    await db.organizationMember.delete({
      where: {
        organizationId_userId: {
          organizationId,
          userId: targetUserId,
        },
      },
    });

    // Decrement active members
    await db.organizationUsage.update({
      where: { organizationId },
      data: {
        activeMembers: { decrement: 1 },
      },
    });

    // Audit log
    await db.teamAuditLog.create({
      data: {
        organizationId,
        actorUserId,
        targetUserId,
        action: 'member.removed',
      },
    });
  }

  /**
   * Transfer ownership
   */
  async transferOwnership(
    organizationId: string,
    currentOwnerId: string,
    newOwnerId: string,
    confirmEmail: string
  ): Promise<void> {
    // Verify confirmation email
    const owner = await db.user.findUnique({
      where: { id: currentOwnerId },
    });

    if (owner.email !== confirmEmail) {
      throw new Error('Email confirmation mismatch');
    }

    // Verify new owner is a member
    const newOwnerMember = await db.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: newOwnerId,
        },
      },
    });

    if (!newOwnerMember) {
      throw new Error('New owner must be an existing member');
    }

    // Use transaction for atomic update
    await db.$transaction([
      // Demote current owner to admin
      db.organizationMember.update({
        where: {
          organizationId_userId: {
            organizationId,
            userId: currentOwnerId,
          },
        },
        data: { role: 'admin' },
      }),

      // Promote new owner
      db.organizationMember.update({
        where: {
          organizationId_userId: {
            organizationId,
            userId: newOwnerId,
          },
        },
        data: { role: 'owner' },
      }),

      // Audit log
      db.teamAuditLog.create({
        data: {
          organizationId,
          actorUserId: currentOwnerId,
          targetUserId: newOwnerId,
          action: 'ownership.transferred',
          oldValue: { ownerId: currentOwnerId },
          newValue: { ownerId: newOwnerId },
        },
      }),
    ]);
  }

  /**
   * Send invitation email
   */
  private async sendInvitationEmail(
    invitation: Invitation,
    organization: Organization,
    inviter: User
  ): Promise<void> {
    const inviteUrl = `${process.env.APP_URL}/invitations/${invitation.token}`;

    await sendEmail({
      to: invitation.email,
      subject: `${inviter.name} invited you to join ${organization.name} on Forge Factory`,
      template: 'team-invitation',
      data: {
        organizationName: organization.name,
        inviterName: inviter.name,
        inviterEmail: inviter.email,
        role: invitation.role,
        message: invitation.message,
        inviteUrl,
        expiresAt: invitation.expiresAt,
      },
    });
  }

  /**
   * Email validation
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
```

### 4. UI Components

#### Team Members Page

**File:** `apps/web/src/app/(dashboard)/[orgSlug]/settings/team/page.tsx`

```typescript
/**
 * @prompt-id forge-v4.1:feature:team:members-page
 * @generated-at 2026-01-20T00:00:00Z
 */

'use client';

import { useState } from 'react';
import { MoreHorizontal, UserPlus, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import {
  useTeamMembers,
  useUpdateMemberRole,
  useRemoveMember,
} from '@/hooks/api/team';
import { InviteMemberDialog } from '@/components/team/invite-member-dialog';
import { formatDistanceToNow } from 'date-fns';

export default function TeamMembersPage({
  params,
}: {
  params: { orgSlug: string };
}) {
  const { toast } = useToast();
  const [showInviteDialog, setShowInviteDialog] = useState(false);

  const { data: team, isLoading } = useTeamMembers(params.orgSlug);
  const updateRoleMutation = useUpdateMemberRole(params.orgSlug);
  const removeMemberMutation = useRemoveMember(params.orgSlug);

  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      await updateRoleMutation.mutateAsync({ userId, role: newRole });
      toast({ title: 'Role updated successfully' });
    } catch (error) {
      toast({
        title: 'Failed to update role',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleRemoveMember = async (userId: string, userName: string) => {
    if (!confirm(`Remove ${userName} from the organization?`)) return;

    try {
      await removeMemberMutation.mutateAsync(userId);
      toast({ title: 'Member removed successfully' });
    } catch (error) {
      toast({
        title: 'Failed to remove member',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'owner':
        return 'default';
      case 'admin':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  if (isLoading) {
    return <div>Loading team...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Team Members</h1>
          <p className="text-muted-foreground mt-2">
            Manage your team and invite new members
          </p>
        </div>
        <Button onClick={() => setShowInviteDialog(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Invite Members
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-2xl font-bold">{team?.summary.totalMembers}</div>
          <div className="text-sm text-muted-foreground">Total Members</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold">
            {team?.summary.byRole.admin + team?.summary.byRole.owner}
          </div>
          <div className="text-sm text-muted-foreground">Admins</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold">{team?.summary.byRole.member}</div>
          <div className="text-sm text-muted-foreground">Members</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold">{team?.summary.byRole.viewer}</div>
          <div className="text-sm text-muted-foreground">Viewers</div>
        </Card>
      </div>

      {/* Members List */}
      <Card>
        <div className="divide-y">
          {team?.members.map((member) => (
            <div key={member.user.id} className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Avatar className="h-10 w-10">
                  {member.user.avatarUrl ? (
                    <img src={member.user.avatarUrl} alt={member.user.name} />
                  ) : (
                    <div className="bg-primary text-primary-foreground">
                      {member.user.name.charAt(0)}
                    </div>
                  )}
                </Avatar>
                <div>
                  <div className="font-medium">{member.user.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {member.user.email}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Joined {formatDistanceToNow(new Date(member.joinedAt), { addSuffix: true })}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Badge variant={getRoleBadgeVariant(member.role)}>
                  {member.role}
                </Badge>

                {member.role !== 'owner' && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => handleUpdateRole(member.user.id, 'viewer')}
                        disabled={member.role === 'viewer'}
                      >
                        Change to Viewer
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleUpdateRole(member.user.id, 'member')}
                        disabled={member.role === 'member'}
                      >
                        Change to Member
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleUpdateRole(member.user.id, 'admin')}
                        disabled={member.role === 'admin'}
                      >
                        Change to Admin
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() =>
                          handleRemoveMember(member.user.id, member.user.name)
                        }
                      >
                        Remove from organization
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <InviteMemberDialog
        open={showInviteDialog}
        onClose={() => setShowInviteDialog(false)}
        orgSlug={params.orgSlug}
      />
    </div>
  );
}
```

#### Invite Member Dialog

**File:** `apps/web/src/components/team/invite-member-dialog.tsx`

```typescript
/**
 * @prompt-id forge-v4.1:feature:team:invite-dialog
 * @generated-at 2026-01-20T00:00:00Z
 */

'use client';

import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useInviteMembers } from '@/hooks/api/team';

const inviteSchema = z.object({
  emails: z.string().min(1, 'At least one email is required'),
  role: z.enum(['viewer', 'member', 'admin']),
  message: z.string().optional(),
});

type InviteFormData = z.infer<typeof inviteSchema>;

export function InviteMemberDialog({
  open,
  onClose,
  orgSlug,
}: {
  open: boolean;
  onClose: () => void;
  orgSlug: string;
}) {
  const { toast } = useToast();
  const inviteMutation = useInviteMembers(orgSlug);

  const form = useForm<InviteFormData>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      role: 'member',
    },
  });

  const onSubmit = async (data: InviteFormData) => {
    // Parse emails (comma or newline separated)
    const emails = data.emails
      .split(/[,\n]/)
      .map((e) => e.trim())
      .filter(Boolean);

    try {
      const result = await inviteMutation.mutateAsync({
        emails,
        role: data.role,
        message: data.message,
      });

      const successCount = result.invitations.length;
      const errorCount = result.errors?.length || 0;

      if (successCount > 0) {
        toast({
          title: `${successCount} invitation(s) sent`,
          description:
            errorCount > 0
              ? `${errorCount} invitation(s) failed`
              : 'Team members will receive an email',
        });
      }

      if (errorCount === 0) {
        form.reset();
        onClose();
      }
    } catch (error) {
      toast({
        title: 'Failed to send invitations',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite Team Members</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="emails">Email Addresses</Label>
            <Textarea
              id="emails"
              placeholder="Enter email addresses (one per line or comma-separated)"
              rows={4}
              {...form.register('emails')}
            />
            {form.formState.errors.emails && (
              <p className="text-sm text-destructive mt-1">
                {form.formState.errors.emails.message}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="role">Role</Label>
            <select
              id="role"
              {...form.register('role')}
              className="w-full p-2 border rounded"
            >
              <option value="viewer">Viewer - Read-only access</option>
              <option value="member">Member - Can analyze and refactor</option>
              <option value="admin">Admin - Full management access</option>
            </select>
          </div>

          <div>
            <Label htmlFor="message">Personal Message (Optional)</Label>
            <Textarea
              id="message"
              placeholder="Add a personal note to the invitation..."
              rows={3}
              {...form.register('message')}
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={inviteMutation.isPending}>
              {inviteMutation.isPending ? 'Sending...' : 'Send Invitations'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

### 5. Tests

**File:** `packages/backend/src/features/team/__tests__/team.service.test.ts`

```typescript
/**
 * @prompt-id forge-v4.1:feature:team:service-tests
 * @generated-at 2026-01-20T00:00:00Z
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TeamService } from '../team.service';
import { db } from '@/lib/db';

describe('TeamService', () => {
  let teamService: TeamService;
  let mockOrg: any;
  let mockOwner: any;

  beforeEach(async () => {
    teamService = new TeamService();

    mockOwner = await db.user.create({
      data: {
        email: 'owner@example.com',
        firstName: 'Owner',
        authMethod: 'email',
      },
    });

    mockOrg = await db.organization.create({
      data: {
        name: 'Test Org',
        slug: 'test-org',
        planTier: 'business',
      },
    });

    await db.organizationMember.create({
      data: {
        organizationId: mockOrg.id,
        userId: mockOwner.id,
        role: 'owner',
        joinedAt: new Date(),
      },
    });
  });

  describe('inviteMembers', () => {
    it('should create invitations for valid emails', async () => {
      const result = await teamService.inviteMembers(mockOrg.id, mockOwner.id, [
        { email: 'user1@example.com', role: 'member' },
        { email: 'user2@example.com', role: 'admin' },
      ]);

      expect(result.invitations).toHaveLength(2);
      expect(result.errors).toHaveLength(0);

      const invites = await db.invitation.findMany({
        where: { organizationId: mockOrg.id },
      });
      expect(invites).toHaveLength(2);
    });

    it('should reject invalid email addresses', async () => {
      const result = await teamService.inviteMembers(mockOrg.id, mockOwner.id, [
        { email: 'not-an-email', role: 'member' },
      ]);

      expect(result.invitations).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toContain('Invalid email');
    });

    it('should reject invitation for existing member', async () => {
      const existingUser = await db.user.create({
        data: { email: 'existing@example.com' },
      });

      await db.organizationMember.create({
        data: {
          organizationId: mockOrg.id,
          userId: existingUser.id,
          role: 'member',
        },
      });

      const result = await teamService.inviteMembers(mockOrg.id, mockOwner.id, [
        { email: 'existing@example.com', role: 'member' },
      ]);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toContain('Already a member');
    });
  });

  describe('acceptInvitation', () => {
    it('should accept invitation and add user to org', async () => {
      const newUser = await db.user.create({
        data: { email: 'newuser@example.com' },
      });

      const { invitations } = await teamService.inviteMembers(
        mockOrg.id,
        mockOwner.id,
        [{ email: 'newuser@example.com', role: 'member' }]
      );

      const result = await teamService.acceptInvitation(
        invitations[0].token,
        newUser.id
      );

      expect(result.member.userId).toBe(newUser.id);
      expect(result.member.role).toBe('member');

      const invitation = await db.invitation.findUnique({
        where: { id: invitations[0].id },
      });
      expect(invitation.status).toBe('accepted');
    });

    it('should reject expired invitation', async () => {
      const newUser = await db.user.create({
        data: { email: 'newuser@example.com' },
      });

      const { invitations } = await teamService.inviteMembers(
        mockOrg.id,
        mockOwner.id,
        [{ email: 'newuser@example.com', role: 'member' }]
      );

      // Manually expire invitation
      await db.invitation.update({
        where: { id: invitations[0].id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      await expect(
        teamService.acceptInvitation(invitations[0].token, newUser.id)
      ).rejects.toThrow('expired');
    });
  });

  describe('updateMemberRole', () => {
    it('should update member role', async () => {
      const member = await db.user.create({
        data: { email: 'member@example.com' },
      });

      await db.organizationMember.create({
        data: {
          organizationId: mockOrg.id,
          userId: member.id,
          role: 'viewer',
        },
      });

      const updated = await teamService.updateMemberRole(
        mockOrg.id,
        member.id,
        'member',
        mockOwner.id
      );

      expect(updated.role).toBe('member');
    });

    it('should prevent self role change', async () => {
      await expect(
        teamService.updateMemberRole(
          mockOrg.id,
          mockOwner.id,
          'admin',
          mockOwner.id
        )
      ).rejects.toThrow('Cannot change your own role');
    });
  });

  describe('removeMember', () => {
    it('should remove member from organization', async () => {
      const member = await db.user.create({
        data: { email: 'member@example.com' },
      });

      await db.organizationMember.create({
        data: {
          organizationId: mockOrg.id,
          userId: member.id,
          role: 'member',
        },
      });

      await teamService.removeMember(mockOrg.id, member.id, mockOwner.id);

      const removed = await db.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: mockOrg.id,
            userId: member.id,
          },
        },
      });

      expect(removed).toBeNull();
    });

    it('should not allow removing owner', async () => {
      await expect(
        teamService.removeMember(mockOrg.id, mockOwner.id, mockOwner.id)
      ).rejects.toThrow('Cannot remove owner');
    });
  });

  describe('transferOwnership', () => {
    it('should transfer ownership to another member', async () => {
      const newOwner = await db.user.create({
        data: { email: 'newowner@example.com' },
      });

      await db.organizationMember.create({
        data: {
          organizationId: mockOrg.id,
          userId: newOwner.id,
          role: 'admin',
        },
      });

      await teamService.transferOwnership(
        mockOrg.id,
        mockOwner.id,
        newOwner.id,
        'owner@example.com'
      );

      const newOwnerMember = await db.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: mockOrg.id,
            userId: newOwner.id,
          },
        },
      });

      const oldOwnerMember = await db.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: mockOrg.id,
            userId: mockOwner.id,
          },
        },
      });

      expect(newOwnerMember.role).toBe('owner');
      expect(oldOwnerMember.role).toBe('admin');
    });
  });
});
```

---

## Implementation Plan

### Week 1
**Days 1-2:** Database schema and migrations
**Days 3-4:** TeamService (invite, accept, decline)
**Day 5:** Member management (update role, remove)

### Week 2
**Days 1-2:** UI components (team page, invite dialog)
**Days 3:** Ownership transfer
**Days 4:** Email templates and notifications
**Day 5:** Testing and documentation

---

## Security Considerations

1. **Invitation Security**
   - Cryptographically secure tokens (32 bytes)
   - 7-day expiration
   - Single-use tokens
   - Email verification

2. **Role Management**
   - Enforce role hierarchy
   - Prevent self role changes
   - Audit all role changes
   - Owner transfer requires email confirmation

3. **Data Privacy**
   - Don't expose invitation tokens in logs
   - Hash tokens in database
   - GDPR: Delete invitation data after 90 days

---

## Performance Considerations

1. **Bulk Invitations**
   - Queue email sending (don't block)
   - Batch database inserts
   - Rate limit: 100 invites per hour

2. **Member Queries**
   - Index on (organization_id, user_id)
   - Cache member count in organization_usage

---

## Success Metrics

- 95% invitation acceptance rate
- <30 seconds email delivery time
- <100ms member list page load
- Zero unauthorized role escalations

---

**Status:** Ready for implementation
