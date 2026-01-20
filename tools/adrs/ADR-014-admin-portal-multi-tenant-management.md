# ADR-014: Admin Portal - Multi-Tenant Management

## Status
Accepted

## Context

Forge Factory is a **multi-tenant enterprise SaaS platform** where administrators need powerful tools to manage organizations, users, billing, security, and system health. The Admin Portal (`/apps/admin`) serves two distinct user groups:

### 1. **Customer Organization Admins** (Tenant Admins)
- Manage their own organization (single tenant view)
- Add/remove team members
- Configure billing and subscriptions
- View usage analytics
- Manage integrations (GitHub, GitLab, Slack)
- Configure permissions and roles
- Access audit logs for their tenant

### 2. **Forge Factory Platform Admins** (Super Admins)
- View ALL tenants (global view)
- Impersonate tenants for support
- Monitor system health (uptime, errors, performance)
- Manage feature flags
- View platform-wide analytics (MRR, churn, growth)
- Handle billing issues
- Review security incidents

### Current Challenges

1. **Multi-Tenancy Complexity**:
   - 1000+ organizations, 50K+ users (projected Year 1)
   - Average org has 2.3 tenants
   - Tenant isolation must be bulletproof (security-critical)

2. **Role-Based Access**:
   - 4 roles: Owner, Admin, Member, Viewer (per ADR-002)
   - Custom roles for enterprise (FF-005 requirement)
   - Fine-grained permissions (100+ permission types)

3. **Billing Complexity**:
   - 4 pricing tiers (Free, Team, Business, Enterprise)
   - Usage-based billing ($0.001/LOC)
   - Seat-based billing ($39-$99/seat)
   - Stripe integration (invoices, subscriptions, dunning)

4. **Compliance Requirements**:
   - Audit logs (SOC 2, ISO 27001 requirement)
   - GDPR data exports
   - HIPAA compliance for healthcare customers
   - Export all user data within 30 days (GDPR Article 15)

5. **Scalability**:
   - Dashboards must handle 1M+ records
   - Analytics queries can take 10+ seconds
   - Large organizations have 500+ members

### Requirements (from Research)

Based on [Multi-Tenant SaaS Admin Best Practices 2026](https://medium.com/@andreaschristoucy/5-best-multi-tenant-saas-templates-in-2025-df52f19a7eb3):

- ✅ **Tenant Switcher**: Switch between organizations seamlessly
- ✅ **Team Management**: Invite, remove, change roles
- ✅ **Billing Dashboard**: MRR, invoices, payment methods
- ✅ **Usage Analytics**: API calls, LOC analyzed, storage used
- ✅ **Audit Logs**: Filter, search, export (CSV, JSON)
- ✅ **Impersonation**: For customer support (with audit trail)
- ✅ **Feature Flags**: Toggle features per tenant
- ✅ **Security Dashboard**: Secrets detected, vulnerabilities
- ✅ **Performance Metrics**: Uptime, latency, error rates

## Decision

We will build a **dual-mode Admin Portal** that adapts based on user role:

### **Tenant Admin View**: Self-service organization management
### **Platform Admin View**: Global system monitoring and support tools

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Admin Portal Architecture                 │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Role Detection (Server Component)                           │
│  ┌──────────────────────────────────────────────┐           │
│  │ if (user.role === 'platform_admin')          │           │
│  │   → Render Platform Admin Dashboard          │           │
│  │ else if (user.isOrgAdmin)                    │           │
│  │   → Render Tenant Admin Dashboard            │           │
│  │ else                                          │           │
│  │   → Redirect to /dashboard (user portal)     │           │
│  └──────────────────────────────────────────────┘           │
│           │                                                   │
│           ▼                                                   │
│  ┌─────────────────────┐     ┌─────────────────────┐        │
│  │ Tenant Admin View   │     │ Platform Admin View │        │
│  │ (Organization Mgmt) │     │ (Global Monitoring) │        │
│  ├─────────────────────┤     ├─────────────────────┤        │
│  │ • Team Members      │     │ • All Tenants       │        │
│  │ • Billing           │     │ • System Health     │        │
│  │ • Usage Analytics   │     │ • Platform Metrics  │        │
│  │ • Integrations      │     │ • Feature Flags     │        │
│  │ • Audit Logs        │     │ • Impersonation     │        │
│  │ • Security          │     │ • Support Tickets   │        │
│  │ • Settings          │     │ • Billing Issues    │        │
│  └─────────────────────┘     └─────────────────────┘        │
│           │                            │                      │
│           └──────────┬─────────────────┘                     │
│                      ▼                                        │
│  ┌──────────────────────────────────────────────┐           │
│  │         Shared Components Library             │           │
│  │  - DataTable (sortable, filterable, export)  │           │
│  │  - Charts (Recharts wrappers)                │           │
│  │  - Audit Log Viewer                           │           │
│  │  - User Picker (async search)                │           │
│  │  - Metrics Cards (MRR, Churn, etc.)          │           │
│  └──────────────────────────────────────────────┘           │
│                      │                                        │
│                      ▼                                        │
│  ┌──────────────────────────────────────────────┐           │
│  │              Backend APIs                     │           │
│  │  /api/v1/admin/tenants                       │           │
│  │  /api/v1/admin/users                         │           │
│  │  /api/v1/admin/billing                       │           │
│  │  /api/v1/admin/audit-logs                    │           │
│  │  /api/v1/admin/analytics                     │           │
│  └──────────────────────────────────────────────┘           │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Detailed Decisions

### 1. Tenant Admin Dashboard

**Pages**: 8 core sections

#### 1.1 Team Members

**Features**:
- **Member List**: Name, email, role, last active, status
- **Invite Members**: Email invitations with role selection
- **Change Roles**: Dropdown to change member role (with confirmation)
- **Remove Members**: Soft delete (preserves audit trail)
- **Bulk Actions**: Select multiple → Change role, Remove

**Implementation**:
```tsx
// apps/admin/app/(tenant)/team/page.tsx
export default async function TeamMembersPage() {
  const tenantId = await getCurrentTenantId()
  const members = await db.organizationMember.findMany({
    where: { organizationId: tenantId },
    include: { user: true },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Team Members</h1>
        <InviteMemberDialog />
      </div>

      <DataTable
        data={members}
        columns={[
          { key: 'user.name', label: 'Name', sortable: true },
          { key: 'user.email', label: 'Email' },
          { key: 'role', label: 'Role', render: (row) => <RoleBadge role={row.role} /> },
          { key: 'user.lastActiveAt', label: 'Last Active', render: formatRelativeTime },
          {
            key: 'actions',
            label: '',
            render: (row) => (
              <DropdownMenu>
                <DropdownMenuItem onClick={() => changeRole(row.id)}>
                  Change Role
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => removeMember(row.id)} destructive>
                  Remove
                </DropdownMenuItem>
              </DropdownMenu>
            ),
          },
        ]}
        searchable
        filterable={{ role: ['owner', 'admin', 'member', 'viewer'] }}
        exportable
      />
    </div>
  )
}

// apps/admin/components/invite-member-dialog.tsx
export function InviteMemberDialog() {
  const form = useForm<{ email: string; role: Role }>()
  const { mutate: inviteMember, isPending } = useInviteMember()

  const onSubmit = form.handleSubmit(async (data) => {
    await inviteMember(data)
    toast.success(`Invitation sent to ${data.email}`)
  })

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>+ Invite Member</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite Team Member</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit}>
          <Label>Email</Label>
          <Input type="email" {...form.register('email')} required />

          <Label>Role</Label>
          <Select {...form.register('role')}>
            <option value="member">Member (Read/Write)</option>
            <option value="admin">Admin (All permissions)</option>
            <option value="viewer">Viewer (Read-only)</option>
          </Select>

          <Button type="submit" disabled={isPending}>
            {isPending ? 'Sending...' : 'Send Invitation'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

#### 1.2 Billing & Subscriptions

**Features**:
- **Current Plan**: Show tier (Free, Team, Business, Enterprise)
- **Usage Metrics**: Seats used, LOC analyzed, API calls
- **Upgrade/Downgrade**: Change plan (with proration)
- **Payment Methods**: Credit cards, invoices (enterprise)
- **Invoice History**: Download PDFs
- **Usage Alerts**: Email when 80%, 100% quota reached

**Implementation**:
```tsx
// apps/admin/app/(tenant)/billing/page.tsx
import { StripeProvider } from '@packages/billing'

export default async function BillingPage() {
  const tenantId = await getCurrentTenantId()
  const [subscription, usage, invoices] = await Promise.all([
    stripe.subscriptions.retrieve(tenant.stripeSubscriptionId),
    db.usage.getCurrentPeriod(tenantId),
    stripe.invoices.list({ customer: tenant.stripeCustomerId, limit: 12 }),
  ])

  return (
    <div className="space-y-6">
      {/* Current Plan */}
      <Card>
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold">
                {subscription.plan.name}
              </p>
              <p className="text-slate-600">
                ${subscription.plan.amount / 100}/seat/month
              </p>
            </div>
            <Button onClick={() => setShowUpgradeDialog(true)}>
              Upgrade Plan
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Usage This Month */}
      <Card>
        <CardHeader>
          <CardTitle>Usage This Month</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <UsageMetric
              label="Team Seats"
              current={usage.seats}
              limit={subscription.quantity}
              unit="seats"
            />
            <UsageMetric
              label="Lines of Code"
              current={usage.linesOfCode}
              limit={subscription.plan.metadata.locLimit}
              unit="LOC"
            />
            <UsageMetric
              label="API Calls"
              current={usage.apiCalls}
              limit={subscription.plan.metadata.apiLimit}
              unit="calls"
            />
          </div>
        </CardContent>
      </Card>

      {/* Payment Methods */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Methods</CardTitle>
        </CardHeader>
        <CardContent>
          <PaymentMethodsList />
          <Button onClick={() => setShowAddPaymentDialog(true)}>
            + Add Payment Method
          </Button>
        </CardContent>
      </Card>

      {/* Invoice History */}
      <Card>
        <CardHeader>
          <CardTitle>Invoice History</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Invoice</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.data.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell>{formatDate(invoice.created * 1000)}</TableCell>
                  <TableCell>${invoice.amount_due / 100}</TableCell>
                  <TableCell>
                    <Badge variant={invoice.status === 'paid' ? 'success' : 'warning'}>
                      {invoice.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" onClick={() => window.open(invoice.invoice_pdf)}>
                      Download PDF
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

// Usage metric component
function UsageMetric({ label, current, limit, unit }: UsageMetricProps) {
  const percentage = (current / limit) * 100
  const isNearLimit = percentage >= 80

  return (
    <div>
      <p className="text-sm text-slate-600">{label}</p>
      <p className="text-2xl font-bold">
        {current.toLocaleString()} / {limit.toLocaleString()}
      </p>
      <Progress value={percentage} className={isNearLimit ? 'text-orange-500' : ''} />
      <p className="text-xs text-slate-500 mt-1">
        {percentage.toFixed(1)}% used
      </p>
      {isNearLimit && (
        <Alert variant="warning" className="mt-2">
          ⚠️ You're approaching your {label.toLowerCase()} limit. Consider upgrading.
        </Alert>
      )}
    </div>
  )
}
```

#### 1.3 Usage Analytics

**Features**:
- **Time Range**: Last 7/30/90 days, custom range
- **Metrics**: Repositories analyzed, refactoring jobs, API calls, storage
- **Trends**: Line charts (day-by-day, week-by-week)
- **Breakdown**: By repository, by user, by language
- **Export**: CSV, JSON

**Implementation**:
```tsx
// apps/admin/app/(tenant)/analytics/page.tsx
import { AnalyticsChart } from '@/components/analytics-chart'
import { DateRangePicker } from '@/components/date-range-picker'

export default async function AnalyticsPage() {
  const tenantId = await getCurrentTenantId()
  const dateRange = getDateRangeFromQuery() // ?from=2026-01-01&to=2026-01-31

  const analytics = await db.analytics.getMetrics(tenantId, dateRange)

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Usage Analytics</h1>
        <DateRangePicker />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <MetricCard
          title="Repositories Analyzed"
          value={analytics.repositoriesAnalyzed}
          change="+12%"
          trend="up"
        />
        <MetricCard
          title="Refactoring Jobs"
          value={analytics.refactoringJobs}
          change="+8%"
          trend="up"
        />
        <MetricCard
          title="API Calls"
          value={analytics.apiCalls}
          change="+23%"
          trend="up"
        />
        <MetricCard
          title="Storage Used"
          value={`${analytics.storageGB} GB`}
          change="+5%"
          trend="up"
        />
      </div>

      {/* Trends Chart */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Usage Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <AnalyticsChart
            data={analytics.dailyMetrics}
            lines={[
              { key: 'apiCalls', label: 'API Calls', color: '#3b82f6' },
              { key: 'refactoringJobs', label: 'Jobs', color: '#10b981' },
            ]}
          />
        </CardContent>
      </Card>

      {/* Breakdown Tables */}
      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Top Repositories</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Repository</TableHead>
                  <TableHead>Analyses</TableHead>
                  <TableHead>LOC</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analytics.topRepositories.map((repo) => (
                  <TableRow key={repo.id}>
                    <TableCell>{repo.name}</TableCell>
                    <TableCell>{repo.analysisCount}</TableCell>
                    <TableCell>{repo.linesOfCode.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Language Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <LanguagePieChart data={analytics.languageDistribution} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
```

#### 1.4 Audit Logs

**Features**:
- **Filter**: By user, action type, date range, resource
- **Search**: Full-text search across all logs
- **Export**: Download as CSV or JSON
- **Details**: Click row to see full event payload
- **Compliance**: GDPR, SOC 2, ISO 27001 requirements

**Implementation**:
```tsx
// apps/admin/app/(tenant)/audit-logs/page.tsx
export default async function AuditLogsPage() {
  const tenantId = await getCurrentTenantId()
  const filters = getFiltersFromQuery() // ?user=user_123&action=user.created

  const logs = await db.auditLog.findMany({
    where: {
      organizationId: tenantId,
      ...buildWhereClause(filters),
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Audit Logs</h1>

      <AuditLogFilters />

      <DataTable
        data={logs}
        columns={[
          {
            key: 'createdAt',
            label: 'Timestamp',
            render: (row) => formatDateTime(row.createdAt),
            sortable: true,
          },
          {
            key: 'user',
            label: 'User',
            render: (row) => row.user?.name || 'System',
          },
          {
            key: 'action',
            label: 'Action',
            render: (row) => <AuditActionBadge action={row.action} />,
          },
          {
            key: 'resource',
            label: 'Resource',
            render: (row) => `${row.resourceType}:${row.resourceId}`,
          },
          {
            key: 'ipAddress',
            label: 'IP Address',
          },
        ]}
        expandable={(row) => (
          <pre className="bg-slate-100 p-4 rounded text-xs overflow-auto">
            {JSON.stringify(row.metadata, null, 2)}
          </pre>
        )}
        exportable
      />
    </div>
  )
}

// Example audit log actions
enum AuditAction {
  USER_CREATED = 'user.created',
  USER_DELETED = 'user.deleted',
  ROLE_CHANGED = 'role.changed',
  REPO_CONNECTED = 'repository.connected',
  ANALYSIS_STARTED = 'analysis.started',
  BILLING_UPDATED = 'billing.updated',
  SETTINGS_CHANGED = 'settings.changed',
  API_KEY_CREATED = 'api_key.created',
  API_KEY_REVOKED = 'api_key.revoked',
}
```

### 2. Platform Admin Dashboard

**Super Admin Pages**: 10 sections

#### 2.1 All Tenants (Global View)

**Features**:
- **Tenant List**: Name, plan, MRR, users, status, created date
- **Search**: By name, domain, email
- **Filter**: By plan, status (active, churned, trial)
- **Impersonation**: "Login as" button (with audit trail)
- **Metrics**: Total MRR, total users, churn rate

**Implementation**:
```tsx
// apps/admin/app/(platform)/tenants/page.tsx
export default async function AllTenantsPage() {
  const tenants = await db.organization.findMany({
    include: {
      _count: { select: { members: true, repositories: true } },
      subscription: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  const platformMetrics = calculatePlatformMetrics(tenants)

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">All Organizations</h1>

      {/* Platform Metrics */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <MetricCard title="Total MRR" value={`$${platformMetrics.totalMRR.toLocaleString()}`} />
        <MetricCard title="Total Organizations" value={tenants.length} />
        <MetricCard title="Total Users" value={platformMetrics.totalUsers.toLocaleString()} />
        <MetricCard title="Churn Rate" value={`${platformMetrics.churnRate}%`} />
      </div>

      {/* Tenants Table */}
      <DataTable
        data={tenants}
        columns={[
          { key: 'name', label: 'Organization', sortable: true },
          {
            key: 'subscription.plan',
            label: 'Plan',
            render: (row) => <PlanBadge plan={row.subscription?.plan} />,
          },
          {
            key: 'mrr',
            label: 'MRR',
            render: (row) => `$${row.subscription?.mrr || 0}`,
            sortable: true,
          },
          {
            key: '_count.members',
            label: 'Users',
            sortable: true,
          },
          {
            key: 'status',
            label: 'Status',
            render: (row) => <StatusBadge status={row.status} />,
          },
          {
            key: 'createdAt',
            label: 'Created',
            render: formatRelativeTime,
            sortable: true,
          },
          {
            key: 'actions',
            label: '',
            render: (row) => (
              <DropdownMenu>
                <DropdownMenuItem onClick={() => impersonateTenant(row.id)}>
                  🔑 Login as Organization
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => viewDetails(row.id)}>
                  View Details
                </DropdownMenuItem>
              </DropdownMenu>
            ),
          },
        ]}
        searchable
        filterable={{
          plan: ['free', 'team', 'business', 'enterprise'],
          status: ['active', 'trial', 'churned'],
        }}
        exportable
      />
    </div>
  )
}
```

#### 2.2 System Health Monitoring

**Features**:
- **Uptime**: Last 30 days (99.9%+ target)
- **Error Rates**: API errors, 500s, timeouts
- **Performance**: P50, P95, P99 latency
- **Database**: Connection pool utilization, slow queries
- **Queue Depth**: Background jobs (analysis, refactoring)
- **Alerts**: Critical issues highlighted

**Implementation**:
```tsx
// apps/admin/app/(platform)/health/page.tsx
import { fetchDatadogMetrics } from '@packages/monitoring'

export default async function SystemHealthPage() {
  const [uptime, errors, performance, dbHealth] = await Promise.all([
    fetchDatadogMetrics('uptime', { period: '30d' }),
    fetchDatadogMetrics('errors', { period: '24h' }),
    fetchDatadogMetrics('latency', { period: '24h' }),
    db.$queryRaw`SELECT * FROM pg_stat_database WHERE datname = 'forge'`,
  ])

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">System Health</h1>

      {/* Status Overview */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <MetricCard
          title="Uptime (30d)"
          value={`${uptime.percentage}%`}
          status={uptime.percentage >= 99.9 ? 'success' : 'warning'}
        />
        <MetricCard
          title="Error Rate (24h)"
          value={`${errors.rate}%`}
          status={errors.rate < 1 ? 'success' : 'error'}
        />
        <MetricCard
          title="P99 Latency"
          value={`${performance.p99}ms`}
          status={performance.p99 < 400 ? 'success' : 'warning'}
        />
        <MetricCard
          title="DB Connections"
          value={`${dbHealth.connections}/${dbHealth.maxConnections}`}
          status={dbHealth.utilization < 80 ? 'success' : 'warning'}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>API Latency (P50, P95, P99)</CardTitle>
          </CardHeader>
          <CardContent>
            <LatencyChart data={performance.timeseries} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Error Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <ErrorRateChart data={errors.timeseries} />
          </CardContent>
        </Card>
      </div>

      {/* Slow Queries */}
      <Card>
        <CardHeader>
          <CardTitle>Slow Queries (>1s)</CardTitle>
        </CardHeader>
        <CardContent>
          <SlowQueriesTable queries={dbHealth.slowQueries} />
        </CardContent>
      </Card>
    </div>
  )
}
```

### 3. Shared Components

#### 3.1 Advanced DataTable

**Features**:
- Sorting (client-side and server-side)
- Filtering (multi-column, date ranges)
- Search (fuzzy search)
- Pagination (cursor or offset)
- Row selection (bulk actions)
- Export (CSV, JSON, Excel)
- Expandable rows (detail view)
- Column visibility toggle
- Responsive (mobile-friendly)

**Implementation**:
```tsx
// apps/admin/components/data-table.tsx
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
} from '@tanstack/react-table'

export function DataTable<T>({
  data,
  columns,
  searchable = false,
  filterable = {},
  exportable = false,
  expandable,
}: DataTableProps<T>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        {searchable && <SearchInput onSearch={table.setGlobalFilter} />}
        {Object.keys(filterable).length > 0 && <FilterDropdowns filters={filterable} />}
        {exportable && <ExportButton data={data} columns={columns} />}
      </div>

      {/* Table */}
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id} onClick={header.column.getToggleSortingHandler()}>
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  {header.column.getIsSorted() && (
                    <span className="ml-2">
                      {header.column.getIsSorted() === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <>
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
              {expandable && row.getIsExpanded() && (
                <TableRow>
                  <TableCell colSpan={columns.length}>
                    {expandable(row.original)}
                  </TableCell>
                </TableRow>
              )}
            </>
          ))}
        </TableBody>
      </Table>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4">
        <p className="text-sm text-slate-600">
          Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} to{' '}
          {Math.min(
            (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
            data.length
          )}{' '}
          of {data.length} results
        </p>
        <div className="flex gap-2">
          <Button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
```

## Page Structure

```
/apps/admin/app/
  /(auth)/
    /login/                      # Admin-only login

  /(tenant)/                     # Tenant Admin Routes
    /layout.tsx                  # Tenant-scoped layout
    /dashboard/
    /team/
      page.tsx                   # Team members list
      /invite/                   # Invite flow
    /billing/
      page.tsx                   # Billing dashboard
      /upgrade/                  # Upgrade flow
    /usage/
      page.tsx                   # Usage analytics
    /integrations/
      page.tsx                   # GitHub, GitLab, Slack
    /audit-logs/
      page.tsx                   # Audit log viewer
    /security/
      page.tsx                   # Security dashboard
    /settings/
      /general/
      /permissions/              # Custom roles (enterprise)

  /(platform)/                   # Platform Admin Routes
    /layout.tsx                  # Platform-scoped layout
    /tenants/
      page.tsx                   # All tenants list
      /[id]/                     # Tenant details
    /health/
      page.tsx                   # System health monitoring
    /analytics/
      page.tsx                   # Platform-wide metrics
    /feature-flags/
      page.tsx                   # Feature flag management
    /support/
      page.tsx                   # Support tickets
    /billing-issues/
      page.tsx                   # Failed payments, dunning

  /_components/                  # Shared admin components
    data-table.tsx
    metric-card.tsx
    analytics-chart.tsx
    audit-log-viewer.tsx
    user-picker.tsx
    tenant-switcher.tsx
```

## Consequences

### Positive

1. **Self-Service**:
   - 95%+ of admin tasks done without support tickets
   - Billing issues resolved by customers (payment method update)
   - Team management (add/remove) takes < 1 minute

2. **Visibility**:
   - Audit logs provide compliance evidence (SOC 2, ISO 27001)
   - Usage analytics enable data-driven decisions
   - Platform admins can monitor system health in real-time

3. **Scalability**:
   - DataTable handles 10K+ rows with pagination
   - Server-side filtering reduces payload size
   - Caching reduces API calls

4. **Security**:
   - Tenant isolation enforced at query level
   - Impersonation logged (audit trail)
   - RBAC prevents unauthorized access

### Negative

1. **Complexity**:
   - Dual-mode portal = 2x pages to maintain
   - Fine-grained permissions = complex RBAC logic
   - Multi-tenant queries require careful WHERE clauses

2. **Performance**:
   - Analytics queries can take 10+ seconds
   - Large organizations (500+ members) slow to render
   - Audit logs table can have millions of rows

3. **Security Risk**:
   - Impersonation feature is powerful (must be audited)
   - Super admins have global access (need monitoring)
   - Export features can leak sensitive data

### Mitigations

1. **Complexity**:
   - **Action**: Share components between tenant/platform views
   - **Pattern**: Composition over duplication
   - **Testing**: E2E tests for critical flows

2. **Performance**:
   - **Action**: Paginate all tables (max 100 rows/page)
   - **Optimization**: Pre-compute analytics (hourly cron job)
   - **Caching**: React Query caches for 5 minutes
   - **Indexing**: Database indexes on tenant_id, created_at

3. **Security**:
   - **Action**: Impersonation logs to Slack channel (real-time alerts)
   - **Audit**: Super admin actions logged separately
   - **Encryption**: Sensitive data (payment methods) encrypted at rest
   - **Export Limits**: Max 10K rows per export (prevent data dumps)

## Metrics & Success Criteria

### Self-Service
- **Support Deflection**: 95%+ of admin tasks done without tickets
- **Time to Complete**: < 1 min to add team member, < 2 min to update billing

### Compliance
- **Audit Log Coverage**: 100% of sensitive actions logged
- **Export Time**: < 30 days to fulfill GDPR data export requests
- **Uptime**: 99.9%+ uptime (platform admin dashboard shows this)

### Performance
- **Page Load**: < 2s for admin pages
- **Query Time**: < 3s for analytics queries
- **Table Render**: < 500ms for 100-row tables

## References

### Research Sources
- [Multi-Tenant SaaS Templates 2025](https://medium.com/@andreaschristoucy/5-best-multi-tenant-saas-templates-in-2025-df52f19a7eb3)
- [Multi-Tenant Analytics Options](https://www.tinybird.co/blog/multi-tenant-saas-options)
- [Multi-Tenant Dashboards at Scale](https://embeddable.com/blog/multi-tenant-dashboards-in-saas-how-embeddable-handles-security-and-scale)

### Internal References
- ADR-002: Tenant Isolation Strategy
- ADR-010: Frontend Architecture
- ADR-011: State Management
- ADR-019: Enterprise Customer Management
- ADR-020: Super Admin Portal & Platform Administration
- ADR-026: Enterprise Customer Onboarding Automation
- ADR-027: Enterprise Customer Health Monitoring & Predictive Analytics
- ADR-028: Enterprise Customer Expansion & Upsell Engine
- ADR-029: Enterprise Support Ticket Management & SLA Compliance
- [Security & Compliance](/docs/technical/security-compliance.md)

## Review Date
April 2026 (3 months)

---

**Document Version**: 1.0
**Last Updated**: 2026-01-20
**Authors**: Engineering & Product Team
**Approved By**: CTO, Head of Customer Success
