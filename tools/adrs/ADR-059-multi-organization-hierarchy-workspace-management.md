# ADR-059: Multi-Organization Hierarchy & Workspace Management

**Status:** Accepted
**Date:** 2026-01-21
**Priority:** P1 - Enterprise Ready
**Complexity:** High

---

## Context

Enterprise customers need flexible organization structures to manage teams, departments, and subsidiaries. A hierarchical organization model with workspaces enables delegation, resource isolation, and billing rollup.

### Business Requirements

- **Hierarchy:** Parent/child organization relationships
- **Workspaces:** Logical grouping of projects within organizations
- **Teams:** Cross-project collaboration groups
- **Isolation:** Resource and data isolation between organizations
- **Billing:** Usage rollup through hierarchy
- **Administration:** Delegated administration at each level

### Organizational Structures

| Structure | Use Case | Example |
|-----------|----------|---------|
| Single Org | Small company | Startup with one product |
| Multi-Workspace | Medium company | Company with multiple products |
| Parent-Child | Enterprise | Holding company with subsidiaries |
| Federated | Consortium | Multiple companies sharing platform |

---

## Decision

We will implement a **hierarchical multi-tenant architecture** with:

1. **Organization Hierarchy** - Parent/child relationships
2. **Workspace Management** - Project grouping within orgs
3. **Team Management** - Cross-functional collaboration
4. **Resource Isolation** - Data and resource boundaries
5. **Delegated Administration** - Role-based org management

### Architecture Overview

```typescript
interface OrganizationSystem {
  // Organization management
  createOrganization(data: CreateOrgInput): Promise<Organization>;
  createChildOrganization(parentId: string, data: CreateOrgInput): Promise<Organization>;
  updateOrganization(id: string, data: UpdateOrgInput): Promise<Organization>;

  // Workspace management
  createWorkspace(orgId: string, data: CreateWorkspaceInput): Promise<Workspace>;
  moveProject(projectId: string, workspaceId: string): Promise<void>;

  // Team management
  createTeam(orgId: string, data: CreateTeamInput): Promise<Team>;
  addTeamMember(teamId: string, userId: string, role: TeamRole): Promise<void>;

  // Hierarchy queries
  getOrganizationHierarchy(orgId: string): Promise<OrgHierarchy>;
  getAncestors(orgId: string): Promise<Organization[]>;
  getDescendants(orgId: string): Promise<Organization[]>;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  type: 'root' | 'child' | 'federated';

  // Hierarchy
  parentId?: string;
  path: string;              // Materialized path: "org1/org2/org3"
  depth: number;             // Depth in hierarchy

  // Settings
  settings: OrganizationSettings;
  features: FeatureFlags;

  // Limits
  limits: OrganizationLimits;

  // Status
  status: 'active' | 'suspended' | 'archived';
  createdAt: Date;
  updatedAt: Date;
}

interface Workspace {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  description?: string;

  // Settings
  settings: WorkspaceSettings;
  defaultProjectSettings: ProjectSettings;

  // Members
  members: WorkspaceMember[];

  // Projects
  projectCount: number;

  // Status
  status: 'active' | 'archived';
  createdAt: Date;
}

interface Team {
  id: string;
  organizationId: string;
  name: string;
  description?: string;

  // Membership
  members: TeamMember[];

  // Permissions
  permissions: TeamPermission[];

  // Access
  workspaceAccess: WorkspaceAccess[];
  projectAccess: ProjectAccess[];

  createdAt: Date;
}
```

### Component 1: Organization Hierarchy

Manage parent/child organization relationships.

```typescript
class OrganizationService {
  constructor(
    private orgStore: OrganizationStore,
    private billingService: BillingService,
    private auditLogger: AuditLogger
  ) {}

  async createOrganization(
    data: CreateOrgInput,
    creator: User
  ): Promise<Organization> {
    // Validate org limits
    if (data.parentId) {
      await this.validateChildOrgCreation(data.parentId, creator);
    }

    const org: Organization = {
      id: generateId(),
      name: data.name,
      slug: await this.generateUniqueSlug(data.name),
      type: data.parentId ? 'child' : 'root',
      parentId: data.parentId,
      path: await this.calculatePath(data.parentId),
      depth: await this.calculateDepth(data.parentId),
      settings: data.settings || this.getDefaultSettings(),
      features: await this.inheritFeatures(data.parentId),
      limits: await this.calculateLimits(data.parentId, data.plan),
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.orgStore.create(org);

    // Create default workspace
    await this.workspaceService.create(org.id, {
      name: 'Default',
      isDefault: true,
    });

    // Add creator as owner
    await this.membershipService.addMember(org.id, creator.id, 'owner');

    // Set up billing
    if (!data.parentId) {
      await this.billingService.createCustomer(org);
    }

    await this.auditLogger.log({
      action: 'organization.created',
      resourceType: 'organization',
      resourceId: org.id,
      actorId: creator.id,
      details: { name: org.name, parentId: data.parentId },
    });

    return org;
  }

  async createChildOrganization(
    parentId: string,
    data: CreateOrgInput,
    creator: User
  ): Promise<Organization> {
    const parent = await this.orgStore.findById(parentId);
    if (!parent) {
      throw new NotFoundError('Parent organization not found');
    }

    // Check hierarchy depth limit
    if (parent.depth >= 3) {
      throw new ValidationError('Maximum organization hierarchy depth exceeded');
    }

    // Check permission
    const canCreate = await this.authzService.checkPermission(
      { user: creator, organization: parent },
      { action: 'organization:create_child', resource: `organization:${parentId}` }
    );

    if (!canCreate) {
      throw new ForbiddenError('Not authorized to create child organization');
    }

    return this.createOrganization({ ...data, parentId }, creator);
  }

  private async calculatePath(parentId?: string): Promise<string> {
    if (!parentId) {
      return '';
    }

    const parent = await this.orgStore.findById(parentId);
    return parent.path ? `${parent.path}/${parentId}` : parentId;
  }

  private async calculateDepth(parentId?: string): Promise<number> {
    if (!parentId) {
      return 0;
    }

    const parent = await this.orgStore.findById(parentId);
    return parent.depth + 1;
  }

  async getOrganizationHierarchy(orgId: string): Promise<OrgHierarchy> {
    const org = await this.orgStore.findById(orgId);

    // Get ancestors
    const ancestors = await this.getAncestors(orgId);

    // Get descendants
    const descendants = await this.getDescendants(orgId);

    // Get siblings
    const siblings = org.parentId
      ? await this.orgStore.findByParent(org.parentId)
      : [];

    return {
      organization: org,
      ancestors,
      descendants,
      siblings: siblings.filter(s => s.id !== orgId),
    };
  }

  async getAncestors(orgId: string): Promise<Organization[]> {
    const org = await this.orgStore.findById(orgId);

    if (!org.path) {
      return [];
    }

    const ancestorIds = org.path.split('/').filter(Boolean);
    return this.orgStore.findByIds(ancestorIds);
  }

  async getDescendants(orgId: string): Promise<Organization[]> {
    // Use materialized path for efficient query
    return this.orgStore.findByPathPrefix(`${orgId}`);
  }

  async moveOrganization(orgId: string, newParentId: string): Promise<void> {
    const org = await this.orgStore.findById(orgId);
    const newParent = await this.orgStore.findById(newParentId);

    // Validate move
    if (newParent.path.includes(orgId)) {
      throw new ValidationError('Cannot move organization under its own descendant');
    }

    // Update organization
    const oldPath = org.path;
    org.parentId = newParentId;
    org.path = await this.calculatePath(newParentId);
    org.depth = await this.calculateDepth(newParentId);

    await this.orgStore.update(org);

    // Update all descendants' paths
    const descendants = await this.orgStore.findByPathPrefix(oldPath);
    for (const desc of descendants) {
      desc.path = desc.path.replace(oldPath, org.path);
      desc.depth = desc.path.split('/').length;
      await this.orgStore.update(desc);
    }
  }
}
```

### Component 2: Workspace Management

Logical grouping of projects within organizations.

```typescript
class WorkspaceService {
  constructor(
    private workspaceStore: WorkspaceStore,
    private projectStore: ProjectStore
  ) {}

  async create(
    orgId: string,
    data: CreateWorkspaceInput
  ): Promise<Workspace> {
    // Validate workspace limits
    const existingCount = await this.workspaceStore.countByOrg(orgId);
    const limits = await this.orgService.getLimits(orgId);

    if (existingCount >= limits.maxWorkspaces) {
      throw new LimitExceededError('Maximum workspaces limit reached');
    }

    const workspace: Workspace = {
      id: generateId(),
      organizationId: orgId,
      name: data.name,
      slug: await this.generateUniqueSlug(orgId, data.name),
      description: data.description,
      settings: data.settings || {},
      defaultProjectSettings: data.defaultProjectSettings || {},
      members: [],
      projectCount: 0,
      status: 'active',
      createdAt: new Date(),
    };

    await this.workspaceStore.create(workspace);

    return workspace;
  }

  async moveProject(projectId: string, targetWorkspaceId: string): Promise<void> {
    const project = await this.projectStore.findById(projectId);
    const targetWorkspace = await this.workspaceStore.findById(targetWorkspaceId);

    // Validate same organization
    if (project.organizationId !== targetWorkspace.organizationId) {
      throw new ValidationError('Cannot move project to workspace in different organization');
    }

    // Update project
    const sourceWorkspaceId = project.workspaceId;
    project.workspaceId = targetWorkspaceId;
    await this.projectStore.update(project);

    // Update workspace counts
    await this.workspaceStore.decrementProjectCount(sourceWorkspaceId);
    await this.workspaceStore.incrementProjectCount(targetWorkspaceId);
  }

  async getWorkspaceProjects(
    workspaceId: string,
    options: ListOptions
  ): Promise<PaginatedResult<Project>> {
    return this.projectStore.findByWorkspace(workspaceId, options);
  }

  async addWorkspaceMember(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole
  ): Promise<void> {
    const workspace = await this.workspaceStore.findById(workspaceId);

    // Verify user is org member
    const isOrgMember = await this.membershipService.isMember(
      workspace.organizationId,
      userId
    );

    if (!isOrgMember) {
      throw new ValidationError('User must be organization member first');
    }

    const member: WorkspaceMember = {
      userId,
      role,
      addedAt: new Date(),
    };

    workspace.members.push(member);
    await this.workspaceStore.update(workspace);
  }
}
```

### Component 3: Team Management

Cross-functional collaboration groups.

```typescript
class TeamService {
  constructor(
    private teamStore: TeamStore,
    private membershipService: MembershipService
  ) {}

  async create(
    orgId: string,
    data: CreateTeamInput
  ): Promise<Team> {
    const team: Team = {
      id: generateId(),
      organizationId: orgId,
      name: data.name,
      description: data.description,
      members: [],
      permissions: data.permissions || [],
      workspaceAccess: [],
      projectAccess: [],
      createdAt: new Date(),
    };

    await this.teamStore.create(team);

    return team;
  }

  async addMember(
    teamId: string,
    userId: string,
    role: TeamRole
  ): Promise<void> {
    const team = await this.teamStore.findById(teamId);

    // Verify user is org member
    const isOrgMember = await this.membershipService.isMember(
      team.organizationId,
      userId
    );

    if (!isOrgMember) {
      throw new ValidationError('User must be organization member first');
    }

    const member: TeamMember = {
      userId,
      role,
      addedAt: new Date(),
    };

    team.members.push(member);
    await this.teamStore.update(team);

    // Grant team's access to the user
    await this.syncUserTeamAccess(userId, team);
  }

  async grantWorkspaceAccess(
    teamId: string,
    workspaceId: string,
    role: WorkspaceRole
  ): Promise<void> {
    const team = await this.teamStore.findById(teamId);
    const workspace = await this.workspaceStore.findById(workspaceId);

    // Validate same organization
    if (team.organizationId !== workspace.organizationId) {
      throw new ValidationError('Team and workspace must be in same organization');
    }

    const access: WorkspaceAccess = {
      workspaceId,
      role,
      grantedAt: new Date(),
    };

    team.workspaceAccess.push(access);
    await this.teamStore.update(team);

    // Sync access to all team members
    for (const member of team.members) {
      await this.workspaceService.addWorkspaceMember(workspaceId, member.userId, role);
    }
  }

  async grantProjectAccess(
    teamId: string,
    projectId: string,
    role: ProjectRole
  ): Promise<void> {
    const team = await this.teamStore.findById(teamId);
    const project = await this.projectStore.findById(projectId);

    // Validate same organization
    if (team.organizationId !== project.organizationId) {
      throw new ValidationError('Team and project must be in same organization');
    }

    const access: ProjectAccess = {
      projectId,
      role,
      grantedAt: new Date(),
    };

    team.projectAccess.push(access);
    await this.teamStore.update(team);

    // Sync access to all team members
    for (const member of team.members) {
      await this.projectService.addProjectMember(projectId, member.userId, role);
    }
  }

  async getTeamsForUser(userId: string, orgId: string): Promise<Team[]> {
    const allTeams = await this.teamStore.findByOrg(orgId);
    return allTeams.filter(team =>
      team.members.some(m => m.userId === userId)
    );
  }
}
```

### Component 4: Resource Isolation

Data and resource boundaries between organizations.

```typescript
class ResourceIsolationService {
  constructor(
    private dbConnectionPool: DatabaseConnectionPool,
    private storageService: StorageService
  ) {}

  getOrganizationContext(orgId: string): OrganizationContext {
    return {
      // Database schema/tenant isolation
      schemaName: `org_${orgId}`,

      // Storage bucket prefix
      storagePath: `organizations/${orgId}`,

      // Cache namespace
      cacheNamespace: `org:${orgId}`,

      // Queue prefix
      queuePrefix: `org-${orgId}`,
    };
  }

  async ensureIsolation(orgId: string): Promise<void> {
    const context = this.getOrganizationContext(orgId);

    // Create dedicated database schema (if using schema-based isolation)
    await this.dbConnectionPool.execute(`
      CREATE SCHEMA IF NOT EXISTS ${context.schemaName}
    `);

    // Create storage bucket
    await this.storageService.ensureBucket(context.storagePath);
  }

  async validateAccess(
    userId: string,
    resourceOrgId: string,
    requesterOrgId: string
  ): Promise<boolean> {
    // Same organization
    if (resourceOrgId === requesterOrgId) {
      return true;
    }

    // Check if requester org is ancestor (parent access)
    const resourceOrg = await this.orgStore.findById(resourceOrgId);
    if (resourceOrg.path.includes(requesterOrgId)) {
      return true;
    }

    // Check if requester org is descendant with delegated access
    const requesterOrg = await this.orgStore.findById(requesterOrgId);
    if (requesterOrg.path.includes(resourceOrgId)) {
      // Child orgs don't automatically get parent access
      return false;
    }

    return false;
  }

  async getAccessibleOrganizations(userId: string): Promise<string[]> {
    // Get user's direct org memberships
    const memberships = await this.membershipService.getUserMemberships(userId);
    const directOrgs = memberships.map(m => m.organizationId);

    const accessibleOrgs = new Set(directOrgs);

    // Add descendant organizations (if user has management permission)
    for (const orgId of directOrgs) {
      const membership = memberships.find(m => m.organizationId === orgId);

      if (membership.role === 'owner' || membership.role === 'admin') {
        const descendants = await this.orgService.getDescendants(orgId);
        descendants.forEach(d => accessibleOrgs.add(d.id));
      }
    }

    return Array.from(accessibleOrgs);
  }
}
```

### Component 5: Delegated Administration

Role-based organization management.

```typescript
class DelegatedAdminService {
  constructor(
    private orgService: OrganizationService,
    private authzService: AuthorizationService
  ) {}

  async grantAdminDelegation(
    grantorOrgId: string,
    granteeOrgId: string,
    permissions: AdminPermission[],
    grantor: User
  ): Promise<void> {
    // Verify grantor has permission to delegate
    const canDelegate = await this.authzService.checkPermission(
      { user: grantor, organization: await this.orgService.get(grantorOrgId) },
      { action: 'organization:delegate_admin', resource: `organization:${grantorOrgId}` }
    );

    if (!canDelegate) {
      throw new ForbiddenError('Not authorized to delegate admin permissions');
    }

    // Verify hierarchy relationship
    const grantorOrg = await this.orgService.get(grantorOrgId);
    const granteeOrg = await this.orgService.get(granteeOrgId);

    if (!granteeOrg.path.includes(grantorOrgId)) {
      throw new ValidationError('Can only delegate to child organizations');
    }

    // Create delegation
    const delegation: AdminDelegation = {
      id: generateId(),
      grantorOrgId,
      granteeOrgId,
      permissions,
      grantedBy: grantor.id,
      grantedAt: new Date(),
      expiresAt: null, // No expiration by default
    };

    await this.delegationStore.create(delegation);
  }

  async checkDelegatedPermission(
    userId: string,
    targetOrgId: string,
    permission: AdminPermission
  ): Promise<boolean> {
    // Get user's org memberships
    const memberships = await this.membershipService.getUserMemberships(userId);

    for (const membership of memberships) {
      // Check if this org has delegation to target org
      const delegations = await this.delegationStore.findByGrantee(membership.organizationId);

      for (const delegation of delegations) {
        // Check if delegation covers target org
        const targetOrg = await this.orgService.get(targetOrgId);

        if (
          targetOrg.id === delegation.grantorOrgId ||
          targetOrg.path.includes(delegation.grantorOrgId)
        ) {
          // Check if permission is delegated
          if (delegation.permissions.includes(permission) || delegation.permissions.includes('*')) {
            // Check if user has sufficient role in their org
            if (['owner', 'admin'].includes(membership.role)) {
              return true;
            }
          }
        }
      }
    }

    return false;
  }

  async listDelegations(orgId: string): Promise<AdminDelegation[]> {
    const asGrantor = await this.delegationStore.findByGrantor(orgId);
    const asGrantee = await this.delegationStore.findByGrantee(orgId);

    return [
      ...asGrantor.map(d => ({ ...d, direction: 'granted' as const })),
      ...asGrantee.map(d => ({ ...d, direction: 'received' as const })),
    ];
  }
}
```

---

## Consequences

### Positive

1. **Flexibility:** Supports diverse organizational structures
2. **Isolation:** Strong boundaries between organizations
3. **Delegation:** Distributed administration
4. **Scalability:** Efficient hierarchy queries
5. **Compliance:** Clear data ownership

### Negative

1. **Complexity:** More code to maintain
2. **Performance:** Hierarchy queries can be expensive
3. **Migration:** Complex data migrations
4. **UX:** Users need to understand hierarchy

### Trade-offs

- **Flexibility vs. Simplicity:** More options = more complexity
- **Isolation vs. Sharing:** Strong isolation limits collaboration
- **Performance vs. Features:** Deep hierarchies impact query speed

---

## Implementation Plan

### Phase 1: Organization Hierarchy (Week 1-2)
- Implement org CRUD
- Build hierarchy queries
- Add path management

### Phase 2: Workspaces (Week 3-4)
- Implement workspace management
- Build project organization
- Add workspace roles

### Phase 3: Teams (Week 5-6)
- Implement team management
- Build access propagation
- Add team roles

### Phase 4: Isolation & Delegation (Week 7-8)
- Implement resource isolation
- Build delegated admin
- Add audit logging

---

## References

- [Multi-Tenant SaaS Patterns](https://docs.microsoft.com/en-us/azure/architecture/guide/multitenant/)
- [Materialized Path Pattern](https://www.mongodb.com/docs/manual/tutorial/model-tree-structures-with-materialized-paths/)
- [PostgreSQL Row-Level Security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)

---

**Decision Maker:** Product Lead + Engineering Lead
**Approved By:** Engineering Leadership
**Implementation Owner:** Platform Engineering Team
