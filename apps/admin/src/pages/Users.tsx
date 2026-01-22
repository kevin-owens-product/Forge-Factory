/**
 * @prompt-id forge-v4.1:feature:admin:001
 * @generated-at 2026-01-21T00:00:00Z
 * @model claude-opus-4-5
 */

import { useMemo, useState, useCallback } from 'react';
import { Button, useTokens } from '@forge/design-system';
import { DataTable } from '../components/DataTable';
import type { PageMeta, ManagedUser, TableColumn } from '../types';
import { USER_STATUS_LABELS } from '../constants';
import { usePagination, useSort, useDebounce } from '../hooks';
import { formatDate, getStatusColor, filterBySearch, sortBy } from '../utils';

export const usersMeta: PageMeta = {
  title: 'Users',
  description: 'Manage system users',
};

// Mock data for demonstration
const mockUsers: ManagedUser[] = [
  {
    id: 'user-1',
    email: 'john.doe@example.com',
    name: 'John Doe',
    role: 'admin',
    tenantId: 'tenant-1',
    status: 'active',
    lastLogin: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-06-20'),
  },
  {
    id: 'user-2',
    email: 'jane.smith@example.com',
    name: 'Jane Smith',
    role: 'user',
    tenantId: 'tenant-1',
    status: 'active',
    lastLogin: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
    createdAt: new Date('2024-02-10'),
    updatedAt: new Date('2024-05-15'),
  },
  {
    id: 'user-3',
    email: 'bob.wilson@example.com',
    name: 'Bob Wilson',
    role: 'user',
    tenantId: 'tenant-2',
    status: 'suspended',
    createdAt: new Date('2024-03-05'),
    updatedAt: new Date('2024-07-01'),
  },
  {
    id: 'user-4',
    email: 'alice.johnson@example.com',
    name: 'Alice Johnson',
    role: 'moderator',
    tenantId: 'tenant-1',
    status: 'pending',
    createdAt: new Date('2024-06-01'),
    updatedAt: new Date('2024-06-01'),
  },
  {
    id: 'user-5',
    email: 'charlie.brown@example.com',
    name: 'Charlie Brown',
    role: 'user',
    tenantId: 'tenant-3',
    status: 'inactive',
    lastLogin: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30), // 30 days ago
    createdAt: new Date('2023-12-01'),
    updatedAt: new Date('2024-01-10'),
  },
];

export function Users(): JSX.Element {
  const tokens = useTokens();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const { pagination, setPage, setPageSize, setTotal } = usePagination({ total: mockUsers.length });
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

  const columns: TableColumn<ManagedUser>[] = useMemo(
    () => [
      { id: 'name', header: 'Name', accessor: 'name', sortable: true },
      { id: 'email', header: 'Email', accessor: 'email', sortable: true },
      { id: 'role', header: 'Role', accessor: (row) => row.role.charAt(0).toUpperCase() + row.role.slice(1), sortable: true },
      {
        id: 'status',
        header: 'Status',
        accessor: (row) => (
          <span style={getStatusBadgeStyle(row.status)}>{USER_STATUS_LABELS[row.status]}</span>
        ),
        sortable: true,
      },
      { id: 'tenantId', header: 'Tenant', accessor: 'tenantId', sortable: true },
      {
        id: 'lastLogin',
        header: 'Last Login',
        accessor: (row) => (row.lastLogin ? formatDate(row.lastLogin) : 'Never'),
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
            <Button variant="ghost" size="sm" colorScheme="error">
              Delete
            </Button>
          </div>
        ),
        align: 'right',
      },
    ],
    [tokens, getStatusBadgeStyle]
  );

  // Filter and sort data
  const processedData = useMemo(() => {
    let result = filterBySearch(mockUsers, debouncedSearch, ['name', 'email', 'role']);

    if (sort.column) {
      result = sortBy(result, sort.column as keyof ManagedUser, sort.direction);
    }

    // Update total for pagination
    setTotal(result.length);

    // Apply pagination
    const start = (pagination.page - 1) * pagination.pageSize;
    const end = start + pagination.pageSize;
    return result.slice(start, end);
  }, [debouncedSearch, sort, pagination.page, pagination.pageSize, setTotal]);

  return (
    <div style={containerStyle} data-testid="users-page">
      <header style={headerStyle}>
        <h1 style={titleStyle}>{usersMeta.title}</h1>
        <p style={subtitleStyle}>{usersMeta.description}</p>
      </header>

      <DataTable<ManagedUser>
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
        searchPlaceholder="Search users..."
        emptyMessage="No users found"
        actions={
          <Button variant="solid" colorScheme="primary" size="sm">
            Add User
          </Button>
        }
      />
    </div>
  );
}
