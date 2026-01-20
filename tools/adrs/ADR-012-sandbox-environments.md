# ADR-012: Sandbox Environments

## Status
Accepted

## Context
We need sandbox/demo environments for:
- **Sales demos**: Let prospects explore without data entry
- **Free trials**: Allow customers to test before buying
- **Training**: Onboard new users safely
- **Development**: Test integrations without affecting production
- **Marketing**: Interactive product tours

Requirements:
- Isolated from production data
- Pre-populated with realistic data
- Automatic reset capability
- Time-limited expiration
- Easy sharing (demo links)
- Restrictions to prevent misuse

## Decision
We will implement **isolated sandbox environments** with pre-seeded data, automatic expiration, and restrictions on external integrations.

## Sandbox Model

```typescript
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
  publicAccessToken?: string;    // For shareable demo links

  // Limits
  maxUsers: number;
  maxApiCalls: number;
  apiCallsUsed: number;

  // Reset
  autoResetInterval?: number;    // Hours, null = never
  lastResetAt?: Date;
}

type SandboxType =
  | 'trial'           // New customer trial
  | 'demo'            // Sales demo
  | 'development'     // Developer testing
  | 'training';       // User training
```

## Seed Data Sets

### Predefined Datasets
```typescript
interface SeedDataSet {
  id: string;
  name: string;
  description: string;

  // What to create
  organizations: number;
  usersPerOrg: number;
  dataPerOrg: SeedDataConfig;

  // Personas (pre-created users with passwords)
  personas: SeedPersona[];
}

interface SeedPersona {
  email: string;
  name: string;
  roleId: RoleId;
  password: string;              // Default password for demos
  avatar?: string;
}

const SeedDataSets: SeedDataSet[] = [
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Just the basics - 1 org, 2 users',
    organizations: 1,
    usersPerOrg: 2,
    dataPerOrg: {
      organizations: 3,
      projects: 5,
      tasks: 20,
    },
    personas: [
      {
        email: 'admin@demo.forge.io',
        name: 'Demo Admin',
        roleId: 'admin',
        password: 'demo123',
        avatar: '/avatars/admin.png',
      },
      {
        email: 'user@demo.forge.io',
        name: 'Demo User',
        roleId: 'member',
        password: 'demo123',
        avatar: '/avatars/user.png',
      },
    ],
  },
  {
    id: 'realistic',
    name: 'Realistic',
    description: 'Realistic data for demos - 3 orgs, varied data',
    organizations: 3,
    usersPerOrg: 5,
    dataPerOrg: {
      organizations: 10,
      projects: 25,
      tasks: 150,
      comments: 300,
    },
    personas: [
      {
        email: 'ceo@acme.demo',
        name: 'Jane Smith',
        roleId: 'owner',
        password: 'demo123',
      },
      {
        email: 'manager@acme.demo',
        name: 'John Doe',
        roleId: 'admin',
        password: 'demo123',
      },
      {
        email: 'employee@acme.demo',
        name: 'Bob Wilson',
        roleId: 'member',
        password: 'demo123',
      },
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Large-scale data for enterprise demos',
    organizations: 10,
    usersPerOrg: 20,
    dataPerOrg: {
      organizations: 50,
      projects: 100,
      tasks: 1000,
      comments: 5000,
    },
    personas: [/* ... */],
  },
];
```

## Sandbox Creation

```typescript
async function createSandbox(
  tenantId: TenantId,
  options: CreateSandboxDto
): Promise<SandboxEnvironment> {
  // 1. Create sandbox record
  const sandbox = await prisma.sandboxEnvironment.create({
    data: {
      tenantId,
      name: options.name,
      type: options.type,
      seedDataSet: options.seedDataSet || 'minimal',
      expiresAt: calculateExpiration(options.type),
      status: 'creating',
      maxUsers: getMaxUsers(options.type),
      maxApiCalls: getMaxApiCalls(options.type),
    }
  });

  // 2. Seed data in background
  await seedSandboxData(sandbox.id, options.seedDataSet);

  // 3. Mark as active
  await prisma.sandboxEnvironment.update({
    where: { id: sandbox.id },
    data: { status: 'active' }
  });

  return sandbox;
}

function calculateExpiration(type: SandboxType): Date {
  const days = {
    trial: 14,
    demo: 7,
    development: 30,
    training: 90,
  };

  return new Date(Date.now() + days[type] * 86400000);
}
```

### Seeding Data
```typescript
async function seedSandboxData(
  sandboxId: string,
  seedDataSetId: string
): Promise<void> {
  const dataset = SeedDataSets.find(ds => ds.id === seedDataSetId);

  // 1. Create organizations
  for (let i = 0; i < dataset.organizations; i++) {
    const org = await createOrganization({
      name: faker.company.name(),
      sandboxId,
    });

    // 2. Create users with personas
    for (const persona of dataset.personas) {
      await createUser({
        email: persona.email,
        name: persona.name,
        password: await hash(persona.password),
        roleId: persona.roleId,
        organizationId: org.id,
        sandboxId,
      });
    }

    // 3. Create data
    await createProjects(org.id, dataset.dataPerOrg.projects);
    await createTasks(org.id, dataset.dataPerOrg.tasks);
  }

  // 4. Add demo watermark flag
  await prisma.sandboxEnvironment.update({
    where: { id: sandboxId },
    data: { status: 'active' }
  });
}
```

## Sandbox Access

### Subdomain Routing
```
sandbox-{id}.app.forge.io → Sandbox environment
```

```typescript
// Middleware detects sandbox from subdomain
async function sandboxMiddleware(req: Request, res: Response, next: NextFunction) {
  const subdomain = req.hostname.split('.')[0];

  if (subdomain.startsWith('sandbox-')) {
    const sandboxId = subdomain.replace('sandbox-', '');

    // Load sandbox context
    const sandbox = await getSandbox(sandboxId);

    if (!sandbox || sandbox.status !== 'active') {
      return res.status(404).send('Sandbox not found or expired');
    }

    // Inject sandbox context
    req.sandboxContext = {
      sandboxId: sandbox.id,
      isDemo: true,
      restrictions: SANDBOX_RESTRICTIONS,
    };

    // Update last accessed
    await updateSandboxAccess(sandboxId);
  }

  next();
}
```

### Public Access Links
```typescript
async function generateAccessLink(sandboxId: string): Promise<string> {
  // Generate secure token
  const token = crypto.randomBytes(32).toString('hex');

  await prisma.sandboxEnvironment.update({
    where: { id: sandboxId },
    data: { publicAccessToken: token }
  });

  return `https://app.forge.io/demo/${token}`;
}

// Access via token
app.get('/demo/:token', async (req, res) => {
  const sandbox = await prisma.sandboxEnvironment.findFirst({
    where: { publicAccessToken: req.params.token }
  });

  if (!sandbox || sandbox.status !== 'active') {
    return res.status(404).send('Demo not found');
  }

  // Redirect to sandbox subdomain with auto-login
  res.redirect(`https://sandbox-${sandbox.id}.app.forge.io?auto_login=demo`);
});
```

## Sandbox Restrictions

```typescript
interface SandboxRestrictions {
  canInviteRealUsers: false;
  canConnectRealIntegrations: false;
  canExportData: false;
  canAccessBilling: false;
  canDeleteSandbox: false;
  watermarkEnabled: true;
  apiRateLimit: number;           // Lower than production
}

// Enforced at API level
async function checkSandboxRestriction(
  ctx: RequestContext,
  restriction: keyof SandboxRestrictions
) {
  if (ctx.sandboxContext && !ctx.sandboxContext.restrictions[restriction]) {
    throw new ForbiddenException(
      `This action is not allowed in sandbox environments`
    );
  }
}

// Example usage
@Post('integrations/github')
async connectGitHub() {
  await checkSandboxRestriction(ctx, 'canConnectRealIntegrations');
  // ...
}
```

## Sandbox UI Indicators

### Watermark Banner
```typescript
function SandboxBanner({ sandbox }: { sandbox: SandboxEnvironment }) {
  const timeRemaining = formatDistanceToNow(sandbox.expiresAt);

  return (
    <Banner variant="info">
      <Icon name="flask" />
      <strong>Sandbox Environment</strong>
      This is a demo environment with sample data.
      Expires in {timeRemaining}.
      <Button onClick={() => convertToProduction(sandbox.id)}>
        Convert to Production
      </Button>
    </Banner>
  );
}
```

### Watermark Overlay
```css
/* Semi-transparent overlay */
.sandbox-watermark {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background: rgba(59, 130, 246, 0.9);
  color: white;
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 12px;
  z-index: 9999;
  pointer-events: none;
}
```

## Auto-Reset

```typescript
@Cron('0 2 * * *')  // 2 AM daily
async function autoResetSandboxes() {
  const sandboxes = await prisma.sandboxEnvironment.findMany({
    where: {
      autoResetInterval: { not: null },
      lastResetAt: {
        lt: new Date(Date.now() - autoResetInterval * 3600000)
      }
    }
  });

  for (const sandbox of sandboxes) {
    await resetSandbox(sandbox.id);
  }
}

async function resetSandbox(sandboxId: string): Promise<void> {
  // 1. Delete all sandbox data
  await deleteS andboxData(sandboxId);

  // 2. Re-seed with original dataset
  const sandbox = await getSandbox(sandboxId);
  await seedSandboxData(sandboxId, sandbox.seedDataSet);

  // 3. Update last reset timestamp
  await prisma.sandboxEnvironment.update({
    where: { id: sandboxId },
    data: { lastResetAt: new Date() }
  });

  // 4. Notify users
  await notifySandboxUsers(sandboxId, 'Sandbox has been reset');
}
```

## Expiration & Cleanup

```typescript
@Cron('0 3 * * *')  // 3 AM daily
async function cleanupExpiredSandboxes() {
  // 1. Find expired sandboxes
  const expired = await prisma.sandboxEnvironment.findMany({
    where: {
      status: 'active',
      expiresAt: { lt: new Date() }
    }
  });

  for (const sandbox of expired) {
    // 2. Mark as expired
    await prisma.sandboxEnvironment.update({
      where: { id: sandbox.id },
      data: { status: 'expired' }
    });

    // 3. Notify users
    await notifySandboxUsers(
      sandbox.id,
      'Your sandbox has expired. Extend or convert to production.'
    );
  }

  // 4. Delete sandboxes expired > 30 days ago
  const toDelete = await prisma.sandboxEnvironment.findMany({
    where: {
      status: 'expired',
      expiresAt: { lt: new Date(Date.now() - 30 * 86400000) }
    }
  });

  for (const sandbox of toDelete) {
    await deleteSandbox(sandbox.id);
  }
}
```

## Trial to Production Conversion

```typescript
async function convertToProduction(
  sandboxId: string,
  planId: string
): Promise<Tenant> {
  const sandbox = await getSandbox(sandboxId);

  // 1. Create production tenant
  const tenant = await createTenant({
    name: sandbox.name,
    plan: planId,
    region: await determineRegion(),
  });

  // 2. Migrate data from sandbox
  await migrateSandboxData(sandboxId, tenant.id);

  // 3. Convert sandbox users to real users
  await convertSandboxUsers(sandboxId, tenant.id);

  // 4. Mark sandbox for deletion
  await prisma.sandboxEnvironment.update({
    where: { id: sandboxId },
    data: { status: 'deleted' }
  });

  // 5. Send welcome email
  await sendWelcomeEmail(tenant.id);

  return tenant;
}

async function migrateSandboxData(
  sandboxId: string,
  tenantId: TenantId
): Promise<void> {
  // Migrate organizations, projects, etc.
  // Exclude demo personas, keep real user-created data
}
```

## Usage Tracking

```typescript
interface SandboxMetrics {
  sandboxId: string;
  createdAt: Date;
  lastAccessedAt: Date;
  totalSessions: number;
  uniqueUsers: number;
  apiCallsUsed: number;
  averageSessionDuration: number;
  conversionRate?: number;       // Trial → Paid
}

// Track API usage
async function trackSandboxApiCall(sandboxId: string) {
  await prisma.sandboxEnvironment.update({
    where: { id: sandboxId },
    data: {
      apiCallsUsed: { increment: 1 }
    }
  });

  // Check limit
  const sandbox = await getSandbox(sandboxId);
  if (sandbox.apiCallsUsed >= sandbox.maxApiCalls) {
    throw new TooManyRequestsException('Sandbox API limit reached');
  }
}
```

## Consequences

### Positive
- **Faster sales cycles**: Prospects can explore immediately
- **Lower friction**: No signup required for demos
- **Training safety**: Can't break production
- **Better trials**: Pre-populated data shows value
- **Easy sharing**: Demo links for prospects

### Negative
- **Infrastructure cost**: More environments to run
- **Maintenance**: Cleanup and monitoring
- **Data complexity**: Separate sandbox data
- **Potential abuse**: Free tier exploitation

### Mitigations
- **Time limits**: Auto-expiration prevents long-term abuse
- **API limits**: Prevent excessive usage
- **Monitoring**: Track sandbox creation patterns
- **Cleanup**: Automatic deletion of old sandboxes

## Alternatives Considered

### 1. Shared Demo Environment
**Rejected**: Data conflicts, security concerns

### 2. Production Tenants with "Demo" Flag
**Rejected**: Risk of data leakage, harder isolation

### 3. Docker Containers per Sandbox
**Considered**: May implement for isolated development sandboxes

## References
- [Heroku Review Apps](https://devcenter.heroku.com/articles/github-integration-review-apps)
- [Netlify Deploy Previews](https://www.netlify.com/products/deploy-previews/)

## Review Date
2024-04-16 (3 months)
