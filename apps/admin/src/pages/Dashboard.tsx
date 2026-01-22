/**
 * @prompt-id forge-v4.1:feature:admin:001
 * @generated-at 2026-01-21T00:00:00Z
 * @model claude-opus-4-5
 */

import { useMemo } from 'react';
import { Card, useTokens } from '@forge/design-system';
import type { PageMeta, DashboardStats, AuditLogEntry } from '../types';
import { formatRelativeTime, getStatusColor, getSeverityColor, formatBytes, formatPercent } from '../utils';

export const dashboardMeta: PageMeta = {
  title: 'Dashboard',
  description: 'System overview and key metrics',
};

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  status?: 'success' | 'warning' | 'error' | 'info';
}

function StatCard({ title, value, subtitle, status }: StatCardProps): JSX.Element {
  const tokens = useTokens();

  const cardStyle = useMemo<React.CSSProperties>(
    () => ({
      padding: tokens.spacing[6],
      minWidth: '200px',
    }),
    [tokens]
  );

  const titleStyle = useMemo<React.CSSProperties>(
    () => ({
      fontSize: tokens.typography.fontSizes.sm,
      color: tokens.colors.foreground.muted,
      marginBottom: tokens.spacing[2],
      fontWeight: tokens.typography.fontWeights.medium,
    }),
    [tokens]
  );

  const valueStyle = useMemo<React.CSSProperties>(
    () => ({
      fontSize: tokens.typography.fontSizes['3xl'],
      fontWeight: tokens.typography.fontWeights.bold,
      color: tokens.colors.foreground.primary,
      marginBottom: tokens.spacing[1],
    }),
    [tokens]
  );

  const getStatusColorValue = (s: string) => {
    switch (s) {
      case 'success':
        return tokens.colors.success[500];
      case 'warning':
        return tokens.colors.warning[500];
      case 'error':
        return tokens.colors.error[500];
      default:
        return tokens.colors.gray[500];
    }
  };

  const subtitleStyle = useMemo<React.CSSProperties>(
    () => ({
      fontSize: tokens.typography.fontSizes.sm,
      color: status ? getStatusColorValue(status) : tokens.colors.gray[500],
    }),
    [tokens, status]
  );

  return (
    <Card variant="outlined" style={cardStyle}>
      <div style={titleStyle}>{title}</div>
      <div style={valueStyle}>{value}</div>
      {subtitle && <div style={subtitleStyle}>{subtitle}</div>}
    </Card>
  );
}

interface RecentEventItemProps {
  event: AuditLogEntry;
}

function RecentEventItem({ event }: RecentEventItemProps): JSX.Element {
  const tokens = useTokens();

  const containerStyle = useMemo<React.CSSProperties>(
    () => ({
      padding: `${tokens.spacing[4]} 0`,
      borderBottom: `1px solid ${tokens.colors.border.muted}`,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    }),
    [tokens]
  );

  const contentStyle = useMemo<React.CSSProperties>(
    () => ({
      flex: 1,
    }),
    []
  );

  const actionStyle = useMemo<React.CSSProperties>(
    () => ({
      fontSize: tokens.typography.fontSizes.sm,
      fontWeight: tokens.typography.fontWeights.medium,
      color: tokens.colors.foreground.primary,
      marginBottom: tokens.spacing[1],
    }),
    [tokens]
  );

  const detailsStyle = useMemo<React.CSSProperties>(
    () => ({
      fontSize: tokens.typography.fontSizes.sm,
      color: tokens.colors.foreground.muted,
      marginBottom: tokens.spacing[1],
    }),
    [tokens]
  );

  const timeStyle = useMemo<React.CSSProperties>(
    () => ({
      fontSize: tokens.typography.fontSizes.xs,
      color: tokens.colors.gray[400],
    }),
    [tokens]
  );

  const severityColor = getSeverityColor(event.severity);
  const severityStyle = useMemo<React.CSSProperties>(
    () => ({
      fontSize: tokens.typography.fontSizes.xs,
      fontWeight: tokens.typography.fontWeights.medium,
      padding: `${tokens.spacing[0.5]} ${tokens.spacing[2]}`,
      borderRadius: tokens.borderRadii.full,
      backgroundColor:
        severityColor === 'error'
          ? tokens.colors.error[100]
          : severityColor === 'warning'
            ? tokens.colors.warning[100]
            : tokens.colors.gray[100],
      color:
        severityColor === 'error'
          ? tokens.colors.error[700]
          : severityColor === 'warning'
            ? tokens.colors.warning[700]
            : tokens.colors.gray[700],
    }),
    [tokens, severityColor]
  );

  return (
    <div style={containerStyle}>
      <div style={contentStyle}>
        <div style={actionStyle}>{event.action}</div>
        <div style={detailsStyle}>
          {event.actor.name || event.actor.email || 'System'} - {event.type}
        </div>
        <div style={timeStyle}>{formatRelativeTime(event.timestamp)}</div>
      </div>
      <span style={severityStyle}>{event.severity}</span>
    </div>
  );
}

// Mock data for demonstration
const mockStats: DashboardStats = {
  totalUsers: 1234,
  activeUsers: 892,
  totalTenants: 45,
  activeTenants: 42,
  totalStorage: 1099511627776, // 1 TB
  usedStorage: 549755813888, // 500 GB
  recentEvents: 156,
  systemHealth: 'healthy',
};

const mockRecentEvents: AuditLogEntry[] = [
  {
    id: '1',
    type: 'AUTH',
    subtype: 'LOGIN',
    severity: 'LOW',
    outcome: 'SUCCESS',
    actor: { id: 'user-1', type: 'USER', name: 'John Doe', email: 'john@example.com' },
    action: 'User logged in',
    tenantId: 'tenant-1',
    timestamp: new Date(Date.now() - 1000 * 60 * 5), // 5 minutes ago
  },
  {
    id: '2',
    type: 'ADMIN_ACTION',
    subtype: 'USER_CREATED',
    severity: 'MEDIUM',
    outcome: 'SUCCESS',
    actor: { id: 'admin-1', type: 'USER', name: 'Admin User' },
    action: 'New user created',
    tenantId: 'tenant-1',
    timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
  },
  {
    id: '3',
    type: 'SECURITY',
    subtype: 'BRUTE_FORCE_DETECTED',
    severity: 'HIGH',
    outcome: 'FAILURE',
    actor: { id: 'unknown', type: 'ANONYMOUS' },
    action: 'Multiple failed login attempts detected',
    tenantId: 'tenant-2',
    timestamp: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
  },
  {
    id: '4',
    type: 'DATA_CHANGE',
    subtype: 'RECORD_UPDATED',
    severity: 'LOW',
    outcome: 'SUCCESS',
    actor: { id: 'user-2', type: 'USER', name: 'Jane Smith' },
    action: 'Settings updated',
    tenantId: 'tenant-1',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
  },
];

export function Dashboard(): JSX.Element {
  const tokens = useTokens();

  const containerStyle = useMemo<React.CSSProperties>(
    () => ({
      padding: tokens.spacing[6],
    }),
    [tokens]
  );

  const headerStyle = useMemo<React.CSSProperties>(
    () => ({
      marginBottom: tokens.spacing[6],
    }),
    [tokens]
  );

  const titleStyle = useMemo<React.CSSProperties>(
    () => ({
      fontSize: tokens.typography.fontSizes['2xl'],
      fontWeight: tokens.typography.fontWeights.bold,
      color: tokens.colors.foreground.primary,
      marginBottom: tokens.spacing[2],
    }),
    [tokens]
  );

  const subtitleStyle = useMemo<React.CSSProperties>(
    () => ({
      fontSize: tokens.typography.fontSizes.base,
      color: tokens.colors.foreground.muted,
    }),
    [tokens]
  );

  const statsGridStyle = useMemo<React.CSSProperties>(
    () => ({
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: tokens.spacing[4],
      marginBottom: tokens.spacing[8],
    }),
    [tokens]
  );

  const sectionTitleStyle = useMemo<React.CSSProperties>(
    () => ({
      fontSize: tokens.typography.fontSizes.lg,
      fontWeight: tokens.typography.fontWeights.semibold,
      color: tokens.colors.foreground.primary,
      marginBottom: tokens.spacing[4],
    }),
    [tokens]
  );

  const gridStyle = useMemo<React.CSSProperties>(
    () => ({
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
      gap: tokens.spacing[6],
    }),
    [tokens]
  );

  const cardStyle = useMemo<React.CSSProperties>(
    () => ({
      padding: tokens.spacing[6],
    }),
    [tokens]
  );

  const statusColor = getStatusColor(mockStats.systemHealth);
  const healthStatusStyle = useMemo<React.CSSProperties>(
    () => ({
      display: 'inline-flex',
      alignItems: 'center',
      gap: tokens.spacing[2],
      padding: `${tokens.spacing[1]} ${tokens.spacing[3]}`,
      borderRadius: tokens.borderRadii.full,
      backgroundColor: statusColor === 'success' ? tokens.colors.success[100] : tokens.colors.error[100],
      color: statusColor === 'success' ? tokens.colors.success[700] : tokens.colors.error[700],
      fontSize: tokens.typography.fontSizes.sm,
      fontWeight: tokens.typography.fontWeights.medium,
    }),
    [tokens, statusColor]
  );

  return (
    <div style={containerStyle} data-testid="dashboard-page">
      <header style={headerStyle}>
        <h1 style={titleStyle}>{dashboardMeta.title}</h1>
        <p style={subtitleStyle}>{dashboardMeta.description}</p>
      </header>

      <section aria-label="Statistics">
        <div style={statsGridStyle}>
          <StatCard
            title="Total Users"
            value={mockStats.totalUsers.toLocaleString()}
            subtitle={`${mockStats.activeUsers.toLocaleString()} active`}
            status="success"
          />
          <StatCard
            title="Tenants"
            value={mockStats.totalTenants}
            subtitle={`${mockStats.activeTenants} active`}
            status="success"
          />
          <StatCard
            title="Storage Used"
            value={formatBytes(mockStats.usedStorage)}
            subtitle={`${formatPercent(mockStats.usedStorage / mockStats.totalStorage)} of ${formatBytes(mockStats.totalStorage)}`}
            status="info"
          />
          <StatCard
            title="Recent Events"
            value={mockStats.recentEvents}
            subtitle="Last 24 hours"
            status="info"
          />
        </div>
      </section>

      <section aria-label="Details">
        <div style={gridStyle}>
          <div>
            <h2 style={sectionTitleStyle}>System Health</h2>
            <Card variant="outlined" style={cardStyle}>
              <div style={{ marginBottom: tokens.spacing[4] }}>
                <span style={healthStatusStyle}>
                  {mockStats.systemHealth === 'healthy' ? 'Healthy' : 'Issues Detected'}
                </span>
              </div>
              <p style={{ fontSize: tokens.typography.fontSizes.sm, color: tokens.colors.foreground.muted }}>
                All systems operational. No issues detected in the last 24 hours.
              </p>
            </Card>
          </div>

          <div>
            <h2 style={sectionTitleStyle}>Recent Activity</h2>
            <Card variant="outlined" style={cardStyle}>
              {mockRecentEvents.map((event) => (
                <RecentEventItem key={event.id} event={event} />
              ))}
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}
