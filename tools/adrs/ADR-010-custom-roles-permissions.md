# ADR-010: Custom Roles & Permissions

## Status
Accepted

## Context
Enterprise customers require fine-grained access control beyond simple user roles. They need:
- Custom roles tailored to their organization structure
- Granular permissions (40+ distinct permissions)
- Role hierarchies and inheritance
- Permission dependencies
- Visual role builder for non-technical admins
- Audit trail of role changes
- Integration with SSO group mapping

Standard roles (Owner, Admin, Member, Viewer) are insufficient for complex organizations with:
- Multiple departments (Engineering, Sales, Support, Finance)
- Compliance requirements (separation of duties)
- Different access levels for contractors vs. employees

## Decision
We will implement a **custom roles system** with a **permission catalog** containing 40+ granular permissions, a **visual role builder**, and **system roles** that cannot be deleted.

## Permission Model

### Permission Structure
```typescript
interface Permission {
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
```

### Permission Catalog (40+ Permissions)
```typescript
const PermissionCatalog: Permission[] = [
  // === Organizations ===
  {
    key: 'organizations:read',
    name: 'View organizations',
    description: 'View organization details and listings',
    category: 'organizations',
  },
  {
    key: 'organizations:write',
    name: 'Create and edit organizations',
    description: 'Create new organizations and edit existing ones',
    category: 'organizations',
    dependencies: ['organizations:read'],
  },
  {
    key: 'organizations:delete',
    name: 'Delete organizations',
    description: 'Permanently delete organizations',
    category: 'organizations',
    dependencies: ['organizations:write'],
    dangerous: true,
  },
  {
    key: 'organizations:archive',
    name: 'Archive organizations',
    description: 'Archive organizations (soft delete)',
    category: 'organizations',
    dependencies: ['organizations:write'],
  },

  // === Users ===
  {
    key: 'users:read',
    name: 'View users',
    description: 'View user details and listings',
    category: 'users',
  },
  {
    key: 'users:invite',
    name: 'Invite users',
    description: 'Send invitations to new users',
    category: 'users',
    dependencies: ['users:read'],
  },
  {
    key: 'users:edit',
    name: 'Edit user details',
    description: 'Modify user information',
    category: 'users',
    dependencies: ['users:read'],
  },
  {
    key: 'users:remove',
    name: 'Remove users',
    description: 'Remove users from the tenant',
    category: 'users',
    dependencies: ['users:edit'],
    dangerous: true,
  },
  {
    key: 'users:manage_roles',
    name: 'Assign roles to users',
    description: 'Change user role assignments',
    category: 'users',
    dependencies: ['users:edit'],
  },

  // === Billing ===
  {
    key: 'billing:read',
    name: 'View billing information',
    description: 'Access billing details, invoices, and usage',
    category: 'billing',
  },
  {
    key: 'billing:manage',
    name: 'Manage subscriptions and payments',
    description: 'Update payment methods, change plans, cancel subscriptions',
    category: 'billing',
    dependencies: ['billing:read'],
    dangerous: true,
  },

  // === Settings ===
  {
    key: 'settings:read',
    name: 'View settings',
    description: 'View tenant settings and configurations',
    category: 'settings',
  },
  {
    key: 'settings:write',
    name: 'Edit settings',
    description: 'Modify tenant settings',
    category: 'settings',
    dependencies: ['settings:read'],
  },
  {
    key: 'settings:sso',
    name: 'Configure SSO',
    description: 'Set up and manage SAML/SCIM integrations',
    category: 'settings',
    dependencies: ['settings:write'],
    dangerous: true,
  },
  {
    key: 'settings:branding',
    name: 'Configure branding',
    description: 'Customize colors, logos, and white-labeling',
    category: 'settings',
    dependencies: ['settings:write'],
  },

  // === Integrations ===
  {
    key: 'integrations:read',
    name: 'View integrations',
    description: 'View connected integrations and API keys',
    category: 'integrations',
  },
  {
    key: 'integrations:manage',
    name: 'Manage integrations and API keys',
    description: 'Connect/disconnect integrations, create API keys',
    category: 'integrations',
    dependencies: ['integrations:read'],
  },
  {
    key: 'webhooks:manage',
    name: 'Manage webhooks',
    description: 'Configure webhook endpoints and events',
    category: 'integrations',
    dependencies: ['integrations:read'],
  },

  // === Admin ===
  {
    key: 'audit:read',
    name: 'View audit logs',
    description: 'Access audit trail and activity logs',
    category: 'admin',
  },
  {
    key: 'audit:export',
    name: 'Export audit logs',
    description: 'Download audit logs for compliance',
    category: 'admin',
    dependencies: ['audit:read'],
  },
  {
    key: 'impersonate',
    name: 'Impersonate users',
    description: 'Log in as other users for support purposes',
    category: 'admin',
    dangerous: true,
  },

  // === Compliance ===
  {
    key: 'compliance:read',
    name: 'View compliance settings',
    description: 'Access data retention and privacy settings',
    category: 'compliance',
  },
  {
    key: 'compliance:manage',
    name: 'Manage data retention and export',
    description: 'Configure retention policies and export user data',
    category: 'compliance',
    dependencies: ['compliance:read'],
    dangerous: true,
  },

  // === Roles (meta-permissions) ===
  {
    key: 'roles:read',
    name: 'View roles',
    description: 'View custom roles and permissions',
    category: 'admin',
  },
  {
    key: 'roles:manage',
    name: 'Manage roles',
    description: 'Create, edit, and delete custom roles',
    category: 'admin',
    dependencies: ['roles:read'],
    dangerous: true,
  },

  // ... 40+ total permissions
];
```

## Role Model

```typescript
interface Role {
  id: RoleId;
  tenantId: TenantId;

  // Metadata
  name: string;
  description: string;
  color: string;                 // For UI display (#hex)
  icon?: string;                 // Icon identifier

  // Permissions
  permissions: Permission[];

  // System role flags
  isSystem: boolean;             // Cannot be edited/deleted
  isDefault: boolean;            // Assigned to new users

  // Role hierarchy
  inheritsFrom?: RoleId;         // Inherit permissions from parent

  // Plan gating (enterprise only)
  minimumPlan?: PlanTier;        // 'team' | 'business' | 'enterprise'

  // Audit
  createdAt: Date;
  updatedAt: Date;
  createdBy: UserId;
  updatedBy?: UserId;
}
```

## System Roles (Immutable)

```typescript
const SystemRoles: Role[] = [
  {
    id: 'owner',
    name: 'Owner',
    description: 'Full access to all features. Cannot be removed.',
    permissions: ['*'],  // All permissions
    isSystem: true,
    color: '#8B5CF6',
  },
  {
    id: 'admin',
    name: 'Admin',
    description: 'Full access except owner-only actions (billing, dangerous operations).',
    permissions: PermissionCatalog
      .filter(p => !['billing:manage', 'impersonate', 'compliance:manage'].includes(p.key))
      .map(p => p.key),
    isSystem: true,
    color: '#3B82F6',
  },
  {
    id: 'member',
    name: 'Member',
    description: 'Standard access for team members.',
    permissions: [
      'organizations:read',
      'organizations:write',
      'users:read',
      'settings:read',
    ],
    isSystem: true,
    isDefault: true,
    color: '#10B981',
  },
  {
    id: 'viewer',
    name: 'Viewer',
    description: 'Read-only access.',
    permissions: [
      'organizations:read',
      'users:read',
      'settings:read',
    ],
    isSystem: true,
    color: '#6B7280',
  },
];
```

## Role Service

```typescript
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

  // Permission checking
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
```

## Permission Checking

### Guard Implementation
```typescript
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly requiredPermissions: Permission[]) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user.id;

    // Get user's permissions (from cache or DB)
    const userPermissions = await this.roleService.getUserPermissions(userId);

    // Check if user has all required permissions
    return this.requiredPermissions.every(permission =>
      userPermissions.includes(permission) || userPermissions.includes('*')
    );
  }
}

// Usage in controller
@UseGuards(PermissionGuard(['organizations:write']))
@Post('organizations')
async createOrganization() {
  // ...
}
```

### React Component
```typescript
// Frontend permission check
function PermissionGate({
  children,
  permissions,
  requireAll = true
}: {
  children: React.ReactNode;
  permissions: Permission[];
  requireAll?: boolean;
}) {
  const { user } = useAuth();

  const hasPermission = requireAll
    ? permissions.every(p => user.permissions.includes(p))
    : permissions.some(p => user.permissions.includes(p));

  return hasPermission ? <>{children}</> : null;
}

// Usage
<PermissionGate permissions={['organizations:write']}>
  <Button>Create Organization</Button>
</PermissionGate>
```

## Role Builder UI

### Visual Permission Picker
```typescript
function RoleBuilder({ roleId }: { roleId?: RoleId }) {
  const [selectedPermissions, setSelectedPermissions] = useState<Permission[]>([]);
  const catalog = usePermissionCatalog();

  // Group by category
  const groupedPermissions = groupBy(catalog, 'category');

  return (
    <form>
      <Input label="Role Name" />
      <Input label="Description" />
      <ColorPicker label="Color" />

      <h3>Permissions</h3>

      {Object.entries(groupedPermissions).map(([category, permissions]) => (
        <div key={category}>
          <h4>{category}</h4>

          {permissions.map(permission => (
            <Checkbox
              key={permission.key}
              label={permission.name}
              description={permission.description}
              checked={selectedPermissions.includes(permission.key)}
              onChange={(checked) => handlePermissionChange(permission, checked)}
              disabled={hasUnmetDependencies(permission)}
              warning={permission.dangerous}
            />
          ))}
        </div>
      ))}

      <Button type="submit">Save Role</Button>
    </form>
  );
}
```

### Dependency Resolution
```typescript
function handlePermissionChange(permission: Permission, checked: boolean) {
  if (checked) {
    // Add permission and all dependencies
    const deps = getAllDependencies(permission);
    setSelectedPermissions([...selectedPermissions, permission.key, ...deps]);
  } else {
    // Remove permission and dependents
    const dependents = getDependents(permission);
    setSelectedPermissions(
      selectedPermissions.filter(p =>
        p !== permission.key && !dependents.includes(p)
      )
    );
  }
}
```

## SSO Group Mapping

### Mapping Configuration
```typescript
interface GroupRoleMapping {
  tenantId: TenantId;
  idpGroupName: string;
  roleId: RoleId;
}

// Example: Map IdP groups to custom roles
const mappings: GroupRoleMapping[] = [
  { tenantId, idpGroupName: 'Engineering', roleId: 'custom_engineer' },
  { tenantId, idpGroupName: 'Sales', roleId: 'custom_sales' },
  { tenantId, idpGroupName: 'Finance', roleId: 'custom_finance' },
];

// On SAML/SCIM user provisioning
async function assignRolesFromGroups(userId: UserId, groups: string[]) {
  for (const group of groups) {
    const mapping = await findGroupMapping(ctx.tenantId, group);
    if (mapping) {
      await assignRole(userId, mapping.roleId);
    }
  }
}
```

## Audit Trail

### Role Change Logging
```typescript
// When role is created/updated/deleted
await auditLog.create({
  tenantId,
  userId,
  action: 'role.created',
  resourceType: 'role',
  resourceId: role.id,
  changes: {
    after: {
      name: role.name,
      permissions: role.permissions,
    }
  }
});

// When user's role is changed
await auditLog.create({
  tenantId,
  userId: adminUserId,
  action: 'user.role_changed',
  resourceType: 'user',
  resourceId: targetUserId,
  changes: {
    before: { roles: oldRoles },
    after: { roles: newRoles },
  }
});
```

## Performance

### Permission Caching
```typescript
// Cache user permissions in Redis
async function getUserPermissions(userId: UserId): Promise<Permission[]> {
  const cacheKey = `permissions:${userId}`;

  // Try cache first
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  // Fetch from database
  const roles = await getUserRoles(userId);
  const permissions = roles.flatMap(role => role.permissions);

  // Cache for 15 minutes
  await redis.setex(cacheKey, 900, JSON.stringify(permissions));

  return permissions;
}

// Invalidate on role change
async function updateUserRole(userId: UserId, roleId: RoleId) {
  await assignRole(userId, roleId);

  // Invalidate cache
  await redis.del(`permissions:${userId}`);
}
```

## Plan Gating

### Enterprise-Only Custom Roles
```typescript
async function createCustomRole(tenantId: TenantId, role: CreateRoleDto) {
  // Check plan
  const tenant = await getTenant(tenantId);

  if (tenant.plan !== 'enterprise') {
    throw new ForbiddenException(
      'Custom roles are only available on Enterprise plan'
    );
  }

  // Check limit
  const existingRoles = await countCustomRoles(tenantId);
  const limit = getRoleLimit(tenant.plan); // Enterprise: unlimited

  if (existingRoles >= limit) {
    throw new ForbiddenException(`Role limit reached (${limit})`);
  }

  return await createRole(role);
}
```

## Consequences

### Positive
- **Flexibility**: Customers can model their org structure
- **Security**: Fine-grained access control
- **Compliance**: Separation of duties
- **SSO Integration**: Map IdP groups to roles
- **Audit**: Full trail of permission changes

### Negative
- **Complexity**: More moving parts
- **UI complexity**: Permission picker can be overwhelming
- **Performance**: Permission checks on every request
- **Support**: Debugging permission issues

### Mitigations
- **Caching**: Redis cache for permissions
- **UI grouping**: Organize permissions by category
- **Validation**: Prevent invalid permission combinations
- **Documentation**: Clear permission descriptions

## Alternatives Considered

### 1. Flat Permissions (No Roles)
**Rejected**: Too granular for users, hard to manage

### 2. RBAC with No Customization
**Rejected**: Doesn't meet enterprise needs

### 3. ABAC (Attribute-Based Access Control)
**Rejected**: Too complex for initial launch, may add later

## References
- [RBAC](https://en.wikipedia.org/wiki/Role-based_access_control)
- [NIST RBAC Standard](https://csrc.nist.gov/projects/role-based-access-control)
- [AWS IAM Policies](https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies.html)

## Review Date
2024-04-16 (3 months)
