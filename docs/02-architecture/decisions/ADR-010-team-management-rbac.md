# ADR-010: Team Management and Role-Based Access Control (RBAC)

## Status
Accepted

## Context
As an enterprise SaaS platform, Forge Factory needs comprehensive team management and access control:
- Multiple users per organization/tenant
- Hierarchical team structures
- Role-based permissions (RBAC)
- Fine-grained resource permissions
- Invitation and onboarding workflows
- SSO and SAML integration
- Audit logging of access and changes
- Compliance with SOC 2, GDPR requirements

## Decision
We will implement a **flexible RBAC system** with predefined roles, custom permissions, and team-based access control.

### RBAC Architecture

```
┌──────────────────────────────────────────────────────────────┐
│              Team Management & RBAC Architecture              │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  Tenant                                                       │
│  ├── Organization                                            │
│  │   ├── Teams                                               │
│  │   │   ├── Team A (Engineering)                            │
│  │   │   │   ├── Members (with roles)                        │
│  │   │   │   └── Projects                                    │
│  │   │   └── Team B (Product)                                │
│  │   │       ├── Members (with roles)                        │
│  │   │       └── Projects                                    │
│  │   └── Users                                               │
│  │       ├── User 1 (Owner)                                  │
│  │       ├── User 2 (Admin)                                  │
│  │       ├── User 3 (Member)                                 │
│  │       └── User 4 (Guest)                                  │
│  └── Permissions                                             │
│      ├── Global roles (Owner, Admin, Member, Guest)          │
│      ├── Team roles (Team Lead, Team Member)                 │
│      ├── Resource permissions (read, write, delete)          │
│      └── Custom permissions                                  │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

## Implementation

### 1. Data Model

```prisma
// packages/prisma/schema.prisma

model User {
  id              String   @id @default(cuid())
  email           String   @unique
  name            String
  avatar          String?

  // Authentication
  passwordHash    String?
  emailVerified   DateTime?
  twoFactorEnabled Boolean @default(false)

  // Multi-tenancy
  memberships     OrganizationMember[]
  teamMemberships TeamMember[]

  // Activity
  lastLoginAt     DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  // Relations
  createdTasks    Task[]   @relation("TaskCreator")
  assignedTasks   Task[]   @relation("TaskAssignee")
  workflows       Workflow[]
  comments        Comment[]
  activities      TaskActivity[]
}

model Organization {
  id              String   @id @default(cuid())
  tenantId        String   @unique
  name            String
  slug            String   @unique
  logo            String?

  // Subscription
  plan            String   // free, pro, enterprise
  seats           Int      // licensed seats
  maxSeats        Int

  // Settings
  settings        Json?
  features        String[] // feature flags

  // Members
  members         OrganizationMember[]
  teams           Team[]

  // Resources
  projects        Project[]
  repositories    Repository[]

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([tenantId])
}

model OrganizationMember {
  id              String   @id @default(cuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  userId          String
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  role            OrganizationRole
  permissions     String[] // Additional permissions

  // Invitation
  invitedBy       String?
  invitedAt       DateTime @default(now())
  acceptedAt      DateTime?

  // Status
  status          MemberStatus
  lastActiveAt    DateTime?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([organizationId, userId])
  @@index([organizationId])
  @@index([userId])
}

enum OrganizationRole {
  OWNER       // Full access, manage billing
  ADMIN       // Full access, cannot manage billing
  MEMBER      // Standard access
  GUEST       // Limited read-only access
}

enum MemberStatus {
  INVITED
  ACTIVE
  SUSPENDED
  DEACTIVATED
}

model Team {
  id              String   @id @default(cuid())
  tenantId        String
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  name            String
  description     String?
  avatar          String?

  // Hierarchy
  parentId        String?
  parent          Team?    @relation("TeamHierarchy", fields: [parentId], references: [id])
  children        Team[]   @relation("TeamHierarchy")

  // Members
  members         TeamMember[]

  // Resources
  projects        Project[]

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([tenantId])
  @@index([organizationId])
}

model TeamMember {
  id              String   @id @default(cuid())
  tenantId        String
  teamId          String
  team            Team     @relation(fields: [teamId], references: [id], onDelete: Cascade)

  userId          String
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  role            TeamRole

  joinedAt        DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([teamId, userId])
  @@index([tenantId])
  @@index([teamId])
  @@index([userId])
}

enum TeamRole {
  LEAD       // Team leader, can manage team
  MEMBER     // Regular team member
}

model Permission {
  id              String   @id @default(cuid())
  tenantId        String

  // Resource
  resourceType    ResourceType
  resourceId      String?  // null = applies to all resources of type

  // Subject
  subjectType     SubjectType
  subjectId       String   // userId, teamId, or roleId

  // Access
  actions         PermissionAction[]

  // Conditions (optional)
  conditions      Json?    // e.g., { "status": "draft" }

  createdBy       String
  createdAt       DateTime @default(now())

  @@index([tenantId])
  @@index([resourceType, resourceId])
  @@index([subjectType, subjectId])
}

enum ResourceType {
  ORGANIZATION
  TEAM
  PROJECT
  REPOSITORY
  TASK
  WORKFLOW
  AGENT
}

enum SubjectType {
  USER
  TEAM
  ROLE
}

enum PermissionAction {
  CREATE
  READ
  UPDATE
  DELETE
  EXECUTE
  SHARE
  ADMIN
}

model AuditLog {
  id              String   @id @default(cuid())
  tenantId        String

  // Actor
  userId          String
  user            User     @relation(fields: [userId], references: [id])

  // Action
  action          AuditAction
  resourceType    ResourceType
  resourceId      String

  // Context
  ipAddress       String?
  userAgent       String?
  metadata        Json?    // Additional context

  // Changes
  before          Json?
  after           Json?

  createdAt       DateTime @default(now())

  @@index([tenantId])
  @@index([userId])
  @@index([resourceType, resourceId])
  @@index([createdAt])
}

enum AuditAction {
  CREATE
  UPDATE
  DELETE
  ACCESS
  SHARE
  INVITE
  REMOVE
  PERMISSION_CHANGE
}
```

### 2. Permission Check Middleware

```typescript
// apps/api/src/guards/permission.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionService } from '@/modules/permissions/permission.service';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private permissionService: PermissionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermission = this.reflector.get<RequiredPermission>(
      'permission',
      context.getHandler(),
    );

    if (!requiredPermission) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const { user, tenantId } = request;
    const { resourceType, action, resourceIdParam } = requiredPermission;

    // Get resource ID from request params
    const resourceId = resourceIdParam ? request.params[resourceIdParam] : null;

    // Check permission
    const hasPermission = await this.permissionService.checkPermission({
      tenantId,
      userId: user.id,
      resourceType,
      resourceId,
      action,
    });

    return hasPermission;
  }
}

// Decorator for permission requirements
export const RequirePermission = (
  resourceType: ResourceType,
  action: PermissionAction,
  resourceIdParam?: string,
) => SetMetadata('permission', { resourceType, action, resourceIdParam });

// Usage in controller
@Controller('tasks')
@UseGuards(TenantGuard, PermissionGuard)
export class TasksController {
  @Post()
  @RequirePermission('TASK', 'CREATE')
  async createTask(@Body() dto: CreateTaskDto) {
    // ...
  }

  @Put(':id')
  @RequirePermission('TASK', 'UPDATE', 'id')
  async updateTask(@Param('id') id: string, @Body() dto: UpdateTaskDto) {
    // ...
  }

  @Delete(':id')
  @RequirePermission('TASK', 'DELETE', 'id')
  async deleteTask(@Param('id') id: string) {
    // ...
  }
}
```

### 3. Permission Service

```typescript
// apps/api/src/modules/permissions/permission.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@forge/prisma';

@Injectable()
export class PermissionService {
  constructor(private readonly prisma: PrismaService) {}

  async checkPermission(params: {
    tenantId: string;
    userId: string;
    resourceType: ResourceType;
    resourceId?: string;
    action: PermissionAction;
  }): Promise<boolean> {
    const { tenantId, userId, resourceType, resourceId, action } = params;

    // Get user's organization role
    const member = await this.prisma.organizationMember.findFirst({
      where: {
        organization: { tenantId },
        userId,
        status: 'ACTIVE',
      },
    });

    if (!member) {
      return false;
    }

    // Owner and Admin have all permissions
    if (member.role === 'OWNER' || member.role === 'ADMIN') {
      return true;
    }

    // Check specific permissions
    const hasPermission = await this.prisma.permission.findFirst({
      where: {
        tenantId,
        OR: [
          // User-specific permission
          {
            subjectType: 'USER',
            subjectId: userId,
          },
          // Team permission (user's teams)
          {
            subjectType: 'TEAM',
            subjectId: {
              in: await this.getUserTeamIds(userId, tenantId),
            },
          },
          // Role permission
          {
            subjectType: 'ROLE',
            subjectId: member.role,
          },
        ],
        resourceType,
        OR: [
          { resourceId: resourceId },
          { resourceId: null }, // Global permission for this resource type
        ],
        actions: {
          has: action,
        },
      },
    });

    return !!hasPermission;
  }

  private async getUserTeamIds(
    userId: string,
    tenantId: string,
  ): Promise<string[]> {
    const memberships = await this.prisma.teamMember.findMany({
      where: { userId, tenantId },
      select: { teamId: true },
    });

    return memberships.map((m) => m.teamId);
  }

  async grantPermission(params: {
    tenantId: string;
    subjectType: SubjectType;
    subjectId: string;
    resourceType: ResourceType;
    resourceId?: string;
    actions: PermissionAction[];
    createdBy: string;
  }) {
    return this.prisma.permission.create({
      data: params,
    });
  }

  async revokePermission(permissionId: string) {
    return this.prisma.permission.delete({
      where: { id: permissionId },
    });
  }
}
```

### 4. Team Management UI

```tsx
// apps/portal/components/team/team-list.tsx
'use client';

import { useTeams, useCreateTeam } from '@/hooks/use-teams';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { TeamCreateDialog } from './team-create-dialog';
import { useState } from 'react';

export function TeamList() {
  const { data: teams = [], isLoading } = useTeams();
  const [showCreate, setShowCreate] = useState(false);

  const columns = [
    {
      accessorKey: 'name',
      header: 'Team Name',
    },
    {
      accessorKey: 'members',
      header: 'Members',
      cell: ({ row }) => row.original.members.length,
    },
    {
      accessorKey: 'projects',
      header: 'Projects',
      cell: ({ row }) => row.original.projects.length,
    },
    {
      id: 'actions',
      cell: ({ row }) => <TeamActions team={row.original} />,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Teams</h2>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Team
        </Button>
      </div>

      <DataTable columns={columns} data={teams} searchKey="name" />

      <TeamCreateDialog open={showCreate} onOpenChange={setShowCreate} />
    </div>
  );
}
```

```tsx
// apps/portal/components/team/team-members.tsx
'use client';

import { useTeamMembers, useRemoveTeamMember } from '@/hooks/use-teams';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { UserMinus } from 'lucide-react';

interface TeamMembersProps {
  teamId: string;
}

export function TeamMembers({ teamId }: TeamMembersProps) {
  const { data: members = [] } = useTeamMembers(teamId);
  const removeMemb = useRemoveTeamMember();

  const handleRemove = (memberId: string) => {
    if (confirm('Remove this member from the team?')) {
      removeMember.mutate({ teamId, memberId });
    }
  };

  return (
    <div className="space-y-4">
      {members.map((member) => (
        <div
          key={member.id}
          className="flex items-center justify-between p-4 border rounded-lg"
        >
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarImage src={member.user.avatar} />
              <AvatarFallback>{member.user.initials}</AvatarFallback>
            </Avatar>
            <div>
              <div className="font-medium">{member.user.name}</div>
              <div className="text-sm text-muted-foreground">
                {member.user.email}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge>{member.role}</Badge>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleRemove(member.id)}
            >
              <UserMinus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
```

### 5. Permission Context (Frontend)

```typescript
// lib/permission-context.tsx
'use client';

import { createContext, useContext, ReactNode } from 'react';
import { usePermissions } from '@/hooks/use-permissions';

interface PermissionContextValue {
  can: (action: string, resource: string) => boolean;
  isOwner: boolean;
  isAdmin: boolean;
}

const PermissionContext = createContext<PermissionContextValue | null>(null);

export function PermissionProvider({ children }: { children: ReactNode }) {
  const { data: permissions } = usePermissions();

  const can = (action: string, resource: string) => {
    if (permissions?.role === 'OWNER' || permissions?.role === 'ADMIN') {
      return true;
    }

    return permissions?.permissions?.some(
      (p) => p.action === action && p.resource === resource
    );
  };

  const isOwner = permissions?.role === 'OWNER';
  const isAdmin = permissions?.role === 'ADMIN' || isOwner;

  return (
    <PermissionContext.Provider value={{ can, isOwner, isAdmin }}>
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermission() {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error('usePermission must be used within PermissionProvider');
  }
  return context;
}

// Usage in components
export function TaskActions({ task }) {
  const { can } = usePermission();

  if (!can('delete', 'task')) {
    return null;
  }

  return <Button onClick={handleDelete}>Delete</Button>;
}
```

## Permission Matrix

### Organization Roles

| Action | Owner | Admin | Member | Guest |
|--------|-------|-------|--------|-------|
| Manage billing | ✓ | - | - | - |
| Manage members | ✓ | ✓ | - | - |
| Manage teams | ✓ | ✓ | - | - |
| Create projects | ✓ | ✓ | ✓ | - |
| Delete projects | ✓ | ✓ | Project owner | - |
| Create tasks | ✓ | ✓ | ✓ | - |
| Delete tasks | ✓ | ✓ | Creator only | - |
| View analytics | ✓ | ✓ | ✓ | - |
| Execute workflows | ✓ | ✓ | ✓ | - |

### Team Roles

| Action | Team Lead | Team Member |
|--------|-----------|-------------|
| Add members | ✓ | - |
| Remove members | ✓ | - |
| Assign tasks | ✓ | - |
| View team analytics | ✓ | ✓ |

## Features

### Team Hierarchy
- Parent-child team relationships
- Permission inheritance
- Aggregate team analytics

### Invitation Workflow
- Email invitations
- Temporary access links
- Bulk invitations
- Invitation expiry

### SSO Integration
- SAML 2.0
- OAuth (Google, GitHub, etc.)
- Just-in-time provisioning
- Automatic role assignment

### Audit Logging
- All permission changes logged
- Resource access tracked
- Exportable for compliance
- Retention policies

## Consequences

### Positive
- **Flexible**: Supports complex permission scenarios
- **Scalable**: Efficient permission checks
- **Auditable**: Complete audit trail
- **Compliant**: Meets SOC 2, GDPR requirements

### Negative
- **Complexity**: RBAC adds system complexity
- **Performance**: Permission checks on every request

### Mitigations
- **Caching**: Cache permissions in Redis
- **Indexing**: Proper database indexes
- **Documentation**: Clear permission model docs

## Alternatives Considered

### 1. Simple Role System
**Rejected**: Insufficient for enterprise needs.

### 2. Attribute-Based Access Control (ABAC)
**Rejected**: Too complex, harder to reason about.

### 3. Third-party Auth (Auth0, Okta)
**Partial**: Use for SSO, but build RBAC ourselves for flexibility.

## References
- [NIST RBAC Model](https://csrc.nist.gov/projects/role-based-access-control)
- [OWASP Access Control](https://owasp.org/www-community/Access_Control)

## Review Date
2024-05-16 (3 months)
