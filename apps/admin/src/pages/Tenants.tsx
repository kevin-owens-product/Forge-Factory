/**
 * @prompt-id forge-v4.1:feature:admin:001
 * @generated-at 2026-01-21T00:00:00Z
 * @model claude-opus-4-5
 */

import { useMemo, useState, useCallback } from 'react';
import { Button, useTokens } from '@forge/design-system';
import { DataTable } from '../components/DataTable';
import type { PageMeta, Tenant, TableColumn } from '../types';
import { TENANT_STATUS_LABELS, TENANT_PLAN_LABELS } from '../constants';
import { usePagination, useSort, useDebounce } from '../hooks';
import { formatDate, formatBytes, getStatusColor, filterBySearch, sortBy } from '../utils';

export const tenantsMeta: PageMeta = {
  title: 'Tenants',
  description: 'Manage organization tenants',
};

// Mock data for demonstration
const mockTenants: Tenant[] = [
  {
    id: 'tenant-1',
    name: 'Acme Corporation',
    slug: 'acme',
    plan: 'enterprise',
    status: 'active',
    userCount: 150,
    storageUsed: 107374182400, // 100 GB
    storageLimit: 1099511627776, // 1 TB
    features: ['sso', 'audit', 'advanced-analytics'],
    createdAt: new Date('2023-06-15'),
    updatedAt: new Date('2024-07-01'),
  },
  {
    id: 'tenant-2',
    name: 'StartupXYZ',
    slug: 'startupxyz',
    plan: 'starter',
    status: 'active',
    userCount: 12,
    storageUsed: 5368709120, // 5 GB
    storageLimit: 53687091200, // 50 GB
    features: ['basic-analytics'],
    createdAt: new Date('2024-01-20'),
    updatedAt: new Date('2024-06-15'),
  },
  {
    id: 'tenant-3',
    name: 'TechGiant Inc',
    slug: 'techgiant',
    plan: 'professional',
    status: 'active',
    userCount: 45,
    storageUsed: 32212254720, // 30 GB
    storageLimit: 214748364800, // 200 GB
    features: ['sso', 'basic-analytics'],
    createdAt: new Date('2023-09-10'),
    updatedAt: new Date('2024-05-20'),
  },
  {
    id: 'tenant-4',
    name: 'FreeTier User',
    slug: 'freetier',
    plan: 'free',
    status: 'trial',
    userCount: 3,
    storageUsed: 1073741824, // 1 GB
    storageLimit: 5368709120, // 5 GB
    features: [],
    createdAt: new Date('2024-07-01'),
    updatedAt: new Date('2024-07-01'),
  },
  {
    id: 'tenant-5',
    name: 'Suspended Corp',
    slug: 'suspended',
    plan: 'professional',
    status: 'suspended',
    userCount: 20,
    storageUsed: 10737418240, // 10 GB
    storageLimit: 214748364800, // 200 GB
    features: ['sso'],
    createdAt: new Date('2023-03-01'),
    updatedAt: new Date('2024-04-15'),
  },
];

export function Tenants(): JSX.Element {
  const tokens = useTokens();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const { pagination, setPage, setPageSize, setTotal } = usePagination({ total: mockTenants.length });
  const { sort, toggleSort } = useSort();

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

  const getStatusBadgeStyle = useCallback(
    (status: string): React.CSSProperties => {
      const color = getStatusColor(status);
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

  const getPlanBadgeStyle = useCallback(
    (plan: string): React.CSSProperties => {
      const planColors: Record<string, { bg: string; text: string }> = {
        free: { bg: tokens.colors.gray[100], text: tokens.colors.gray[700] },
        starter: { bg: tokens.colors.info[100], text: tokens.colors.info[700] },
        professional: { bg: tokens.colors.primary[100], text: tokens.colors.primary[700] },
        enterprise: { bg: tokens.colors.secondary[100], text: tokens.colors.secondary[700] },
      };
      const colors = planColors[plan] || planColors.free;
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

  const columns: TableColumn<Tenant>[] = useMemo(
    () => [
      { id: 'name', header: 'Name', accessor: 'name', sortable: true },
      { id: 'slug', header: 'Slug', accessor: 'slug', sortable: true },
      {
        id: 'plan',
        header: 'Plan',
        accessor: (row) => <span style={getPlanBadgeStyle(row.plan)}>{TENANT_PLAN_LABELS[row.plan]}</span>,
        sortable: true,
      },
      {
        id: 'status',
        header: 'Status',
        accessor: (row) => <span style={getStatusBadgeStyle(row.status)}>{TENANT_STATUS_LABELS[row.status]}</span>,
        sortable: true,
      },
      {
        id: 'userCount',
        header: 'Users',
        accessor: 'userCount',
        sortable: true,
        align: 'right',
      },
      {
        id: 'storage',
        header: 'Storage',
        accessor: (row) => `${formatBytes(row.storageUsed)} / ${formatBytes(row.storageLimit)}`,
        sortable: true,
      },
      {
        id: 'createdAt',
        header: 'Created',
        accessor: (row) => formatDate(row.createdAt),
        sortable: true,
      },
      {
        id: 'actions',
        header: 'Actions',
        accessor: () => (
          <div style={{ display: 'flex', gap: tokens.spacing[2] }}>
            <Button variant="ghost" size="sm">
              Edit
            </Button>
            <Button variant="ghost" size="sm">
              View
            </Button>
          </div>
        ),
        align: 'right',
      },
    ],
    [tokens, getStatusBadgeStyle, getPlanBadgeStyle]
  );

  // Filter and sort data
  const processedData = useMemo(() => {
    let result = filterBySearch(mockTenants, debouncedSearch, ['name', 'slug', 'plan']);

    if (sort.column) {
      result = sortBy(result, sort.column as keyof Tenant, sort.direction);
    }

    // Update total for pagination
    setTotal(result.length);

    // Apply pagination
    const start = (pagination.page - 1) * pagination.pageSize;
    const end = start + pagination.pageSize;
    return result.slice(start, end);
  }, [debouncedSearch, sort, pagination.page, pagination.pageSize, setTotal]);

  return (
    <div style={containerStyle} data-testid="tenants-page">
      <header style={headerStyle}>
        <h1 style={titleStyle}>{tenantsMeta.title}</h1>
        <p style={subtitleStyle}>{tenantsMeta.description}</p>
      </header>

      <DataTable<Tenant>
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
        searchPlaceholder="Search tenants..."
        emptyMessage="No tenants found"
        actions={
          <Button variant="solid" colorScheme="primary" size="sm">
            Add Tenant
          </Button>
        }
      />
    </div>
  );
}
