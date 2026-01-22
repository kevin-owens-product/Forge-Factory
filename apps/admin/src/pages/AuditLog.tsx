/**
 * @prompt-id forge-v4.1:feature:admin:001
 * @generated-at 2026-01-21T00:00:00Z
 * @model claude-opus-4-5
 */

import { useMemo, useState, useCallback } from 'react';
import { Button, Select, useTokens } from '@forge/design-system';
import { DataTable } from '../components/DataTable';
import type { PageMeta, AuditLogEntry, TableColumn } from '../types';
import { AUDIT_TYPE_LABELS, AUDIT_SEVERITY_LABELS } from '../constants';
import { usePagination, useSort, useDebounce } from '../hooks';
import { formatDateTime, getSeverityColor, getStatusColor, filterBySearch, sortBy } from '../utils';

export const auditLogMeta: PageMeta = {
  title: 'Audit Log',
  description: 'View system audit events and security logs',
};

// Mock audit data for demonstration
const mockAuditEvents: AuditLogEntry[] = [
  {
    id: 'event-1',
    type: 'AUTH',
    subtype: 'LOGIN',
    severity: 'LOW',
    outcome: 'SUCCESS',
    actor: { id: 'user-1', type: 'USER', name: 'John Doe', email: 'john@example.com' },
    action: 'User logged in',
    tenantId: 'tenant-1',
    timestamp: new Date(Date.now() - 1000 * 60 * 5),
  },
  {
    id: 'event-2',
    type: 'ADMIN_ACTION',
    subtype: 'USER_CREATED',
    severity: 'MEDIUM',
    outcome: 'SUCCESS',
    actor: { id: 'admin-1', type: 'USER', name: 'Admin User', email: 'admin@example.com' },
    action: 'Created new user account',
    message: 'Created user jane@example.com',
    tenantId: 'tenant-1',
    timestamp: new Date(Date.now() - 1000 * 60 * 30),
  },
  {
    id: 'event-3',
    type: 'SECURITY',
    subtype: 'BRUTE_FORCE_DETECTED',
    severity: 'HIGH',
    outcome: 'FAILURE',
    actor: { id: 'unknown', type: 'ANONYMOUS' },
    action: 'Multiple failed login attempts detected',
    message: 'IP: 192.168.1.100 - 5 failed attempts',
    tenantId: 'tenant-2',
    timestamp: new Date(Date.now() - 1000 * 60 * 60),
  },
  {
    id: 'event-4',
    type: 'DATA_CHANGE',
    subtype: 'RECORD_UPDATED',
    severity: 'LOW',
    outcome: 'SUCCESS',
    actor: { id: 'user-2', type: 'USER', name: 'Jane Smith', email: 'jane@example.com' },
    action: 'Updated user profile',
    tenantId: 'tenant-1',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
  },
  {
    id: 'event-5',
    type: 'AUTH',
    subtype: 'LOGIN_FAILED',
    severity: 'MEDIUM',
    outcome: 'FAILURE',
    actor: { id: 'unknown', type: 'ANONYMOUS', email: 'test@example.com' },
    action: 'Failed login attempt',
    message: 'Invalid password',
    tenantId: 'tenant-1',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3),
  },
  {
    id: 'event-6',
    type: 'ADMIN_ACTION',
    subtype: 'SETTINGS_CHANGED',
    severity: 'MEDIUM',
    outcome: 'SUCCESS',
    actor: { id: 'admin-1', type: 'USER', name: 'Admin User' },
    action: 'Updated system settings',
    message: 'Changed session timeout from 1800 to 3600',
    tenantId: 'tenant-1',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4),
  },
  {
    id: 'event-7',
    type: 'SECURITY',
    subtype: 'PRIVILEGE_ESCALATION',
    severity: 'CRITICAL',
    outcome: 'FAILURE',
    actor: { id: 'user-3', type: 'USER', name: 'Bob Wilson' },
    action: 'Attempted unauthorized access',
    message: 'Attempted to access admin panel without permission',
    tenantId: 'tenant-3',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5),
  },
  {
    id: 'event-8',
    type: 'DATA_CHANGE',
    subtype: 'BULK_EXPORT',
    severity: 'MEDIUM',
    outcome: 'SUCCESS',
    actor: { id: 'admin-1', type: 'USER', name: 'Admin User' },
    action: 'Exported audit logs',
    message: 'Exported 500 records to CSV',
    tenantId: 'tenant-1',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6),
  },
];

const typeOptions = [
  { value: '', label: 'All Types' },
  { value: 'AUTH', label: 'Authentication' },
  { value: 'ACCESS', label: 'Access Control' },
  { value: 'DATA_CHANGE', label: 'Data Change' },
  { value: 'ADMIN_ACTION', label: 'Admin Action' },
  { value: 'SECURITY', label: 'Security' },
  { value: 'SYSTEM', label: 'System' },
];

const severityOptions = [
  { value: '', label: 'All Severities' },
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'CRITICAL', label: 'Critical' },
];

const outcomeOptions = [
  { value: '', label: 'All Outcomes' },
  { value: 'SUCCESS', label: 'Success' },
  { value: 'FAILURE', label: 'Failure' },
  { value: 'PARTIAL', label: 'Partial' },
];

export function AuditLog(): JSX.Element {
  const tokens = useTokens();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const { pagination, setPage, setPageSize, setTotal } = usePagination({ total: mockAuditEvents.length });
  const { sort, toggleSort } = useSort('timestamp', 'desc');

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

  const filtersStyle = useMemo<React.CSSProperties>(
    () => ({
      display: 'flex',
      gap: tokens.spacing[4],
      marginBottom: tokens.spacing[4],
      flexWrap: 'wrap' as const,
    }),
    [tokens]
  );

  const getSeverityBadgeStyle = useCallback(
    (severity: string): React.CSSProperties => {
      const color = getSeverityColor(severity);
      const colorMap = {
        success: { bg: tokens.colors.success[100], text: tokens.colors.success[700] },
        warning: { bg: tokens.colors.warning[100], text: tokens.colors.warning[700] },
        error: { bg: tokens.colors.error[100], text: tokens.colors.error[700] },
        info: { bg: tokens.colors.info[100], text: tokens.colors.info[700] },
      };
      const colors = colorMap[color];
      return {
        display: 'inline-block',
        padding: `${tokens.spacing[0.5]} ${tokens.spacing[2]}`,
        borderRadius: tokens.borderRadii.full,
        fontSize: tokens.typography.fontSizes.xs,
        fontWeight: tokens.typography.fontWeights.medium,
        backgroundColor: colors.bg,
        color: colors.text,
      };
    },
    [tokens]
  );

  const getOutcomeBadgeStyle = useCallback(
    (outcome: string): React.CSSProperties => {
      const color = getStatusColor(outcome);
      const colorMap = {
        success: { bg: tokens.colors.success[100], text: tokens.colors.success[700] },
        warning: { bg: tokens.colors.warning[100], text: tokens.colors.warning[700] },
        error: { bg: tokens.colors.error[100], text: tokens.colors.error[700] },
        info: { bg: tokens.colors.gray[100], text: tokens.colors.gray[700] },
      };
      const colors = colorMap[color];
      return {
        display: 'inline-block',
        padding: `${tokens.spacing[0.5]} ${tokens.spacing[2]}`,
        borderRadius: tokens.borderRadii.full,
        fontSize: tokens.typography.fontSizes.xs,
        fontWeight: tokens.typography.fontWeights.medium,
        backgroundColor: colors.bg,
        color: colors.text,
      };
    },
    [tokens]
  );

  const columns: TableColumn<AuditLogEntry>[] = useMemo(
    () => [
      {
        id: 'timestamp',
        header: 'Time',
        accessor: (row) => formatDateTime(row.timestamp),
        sortable: true,
        width: '160px',
      },
      {
        id: 'type',
        header: 'Type',
        accessor: (row) => AUDIT_TYPE_LABELS[row.type] || row.type,
        sortable: true,
        width: '120px',
      },
      {
        id: 'severity',
        header: 'Severity',
        accessor: (row) => (
          <span style={getSeverityBadgeStyle(row.severity)}>{AUDIT_SEVERITY_LABELS[row.severity]}</span>
        ),
        sortable: true,
        width: '100px',
      },
      {
        id: 'outcome',
        header: 'Outcome',
        accessor: (row) => <span style={getOutcomeBadgeStyle(row.outcome)}>{row.outcome}</span>,
        sortable: true,
        width: '100px',
      },
      {
        id: 'actor',
        header: 'Actor',
        accessor: (row) => row.actor.name || row.actor.email || row.actor.type,
        sortable: true,
      },
      {
        id: 'action',
        header: 'Action',
        accessor: (row) => (
          <div>
            <div>{row.action}</div>
            {row.message && (
              <div style={{ fontSize: tokens.typography.fontSizes.xs, color: tokens.colors.foreground.muted }}>
                {row.message}
              </div>
            )}
          </div>
        ),
      },
      {
        id: 'tenantId',
        header: 'Tenant',
        accessor: 'tenantId',
        sortable: true,
        width: '100px',
      },
    ],
    [tokens, getSeverityBadgeStyle, getOutcomeBadgeStyle]
  );

  // Filter and sort data
  const processedData = useMemo(() => {
    let result = filterBySearch(mockAuditEvents, debouncedSearch, ['action', 'type']);

    if (typeFilter) {
      result = result.filter((e) => e.type === typeFilter);
    }
    if (severityFilter) {
      result = result.filter((e) => e.severity === severityFilter);
    }
    if (outcomeFilter) {
      result = result.filter((e) => e.outcome === outcomeFilter);
    }

    if (sort.column) {
      result = sortBy(result, sort.column as keyof AuditLogEntry, sort.direction);
    }

    // Update total for pagination
    setTotal(result.length);

    // Apply pagination
    const start = (pagination.page - 1) * pagination.pageSize;
    const end = start + pagination.pageSize;
    return result.slice(start, end);
  }, [debouncedSearch, typeFilter, severityFilter, outcomeFilter, sort, pagination.page, pagination.pageSize, setTotal]);

  return (
    <div style={containerStyle} data-testid="audit-log-page">
      <header style={headerStyle}>
        <h1 style={titleStyle}>{auditLogMeta.title}</h1>
        <p style={subtitleStyle}>{auditLogMeta.description}</p>
      </header>

      <div style={filtersStyle}>
        <Select
          value={typeFilter}
          onChange={(value) => setTypeFilter(value)}
          options={typeOptions}
          style={{ width: '160px' }}
          data-testid="type-filter"
        />
        <Select
          value={severityFilter}
          onChange={(value) => setSeverityFilter(value)}
          options={severityOptions}
          style={{ width: '160px' }}
          data-testid="severity-filter"
        />
        <Select
          value={outcomeFilter}
          onChange={(value) => setOutcomeFilter(value)}
          options={outcomeOptions}
          style={{ width: '160px' }}
          data-testid="outcome-filter"
        />
      </div>

      <DataTable<AuditLogEntry>
        columns={columns}
        data={processedData}
        keyExtractor={(row) => row.id}
        pagination={pagination}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        sort={sort}
        onSortChange={toggleSort}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search events..."
        emptyMessage="No audit events found"
        actions={
          <Button variant="outline" size="sm">
            Export
          </Button>
        }
      />
    </div>
  );
}
