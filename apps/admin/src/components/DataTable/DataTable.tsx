/**
 * @prompt-id forge-v4.1:feature:admin:001
 * @generated-at 2026-01-21T00:00:00Z
 * @model claude-opus-4-5
 */

import { useMemo } from 'react';
import { Button, Card, Input, Select, useTokens } from '@forge/design-system';
import type { TableColumn, PaginationState, SortState } from '../../types';
import { PAGE_SIZES } from '../../constants';

interface DataTableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  pagination?: PaginationState;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  sort?: SortState;
  onSortChange?: (column: string) => void;
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  loading?: boolean;
  emptyMessage?: string;
  title?: string;
  actions?: React.ReactNode;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  pagination,
  onPageChange,
  onPageSizeChange,
  sort,
  onSortChange,
  search,
  onSearchChange,
  searchPlaceholder = 'Search...',
  loading = false,
  emptyMessage = 'No data available',
  title,
  actions,
}: DataTableProps<T>): JSX.Element {
  const tokens = useTokens();

  const containerStyle = useMemo<React.CSSProperties>(
    () => ({
      display: 'flex',
      flexDirection: 'column' as const,
      gap: tokens.spacing[4],
    }),
    [tokens]
  );

  const headerStyle = useMemo<React.CSSProperties>(
    () => ({
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: tokens.spacing[4],
    }),
    [tokens]
  );

  const titleStyle = useMemo<React.CSSProperties>(
    () => ({
      fontSize: tokens.typography.fontSizes.lg,
      fontWeight: tokens.typography.fontWeights.semibold,
      color: tokens.colors.foreground.primary,
    }),
    [tokens]
  );

  const toolbarStyle = useMemo<React.CSSProperties>(
    () => ({
      display: 'flex',
      alignItems: 'center',
      gap: tokens.spacing[4],
    }),
    [tokens]
  );

  const tableContainerStyle = useMemo<React.CSSProperties>(
    () => ({
      overflowX: 'auto' as const,
    }),
    []
  );

  const tableStyle = useMemo<React.CSSProperties>(
    () => ({
      width: '100%',
      borderCollapse: 'collapse' as const,
    }),
    []
  );

  const thStyle = useMemo<React.CSSProperties>(
    () => ({
      padding: `${tokens.spacing[3]} ${tokens.spacing[4]}`,
      textAlign: 'left' as const,
      fontSize: tokens.typography.fontSizes.xs,
      fontWeight: tokens.typography.fontWeights.semibold,
      color: tokens.colors.foreground.muted,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.05em',
      backgroundColor: tokens.colors.background.secondary,
      borderBottom: `1px solid ${tokens.colors.border.muted}`,
      cursor: 'default',
    }),
    [tokens]
  );

  const sortableThStyle = useMemo<React.CSSProperties>(
    () => ({
      ...thStyle,
      cursor: 'pointer',
      userSelect: 'none' as const,
    }),
    [thStyle]
  );

  const tdStyle = useMemo<React.CSSProperties>(
    () => ({
      padding: `${tokens.spacing[3]} ${tokens.spacing[4]}`,
      fontSize: tokens.typography.fontSizes.sm,
      color: tokens.colors.foreground.primary,
      borderBottom: `1px solid ${tokens.colors.border.muted}`,
    }),
    [tokens]
  );

  const emptyStyle = useMemo<React.CSSProperties>(
    () => ({
      padding: tokens.spacing[8],
      textAlign: 'center' as const,
      color: tokens.colors.foreground.muted,
      fontSize: tokens.typography.fontSizes.sm,
    }),
    [tokens]
  );

  const loadingStyle = useMemo<React.CSSProperties>(
    () => ({
      padding: tokens.spacing[8],
      textAlign: 'center' as const,
      color: tokens.colors.foreground.muted,
      fontSize: tokens.typography.fontSizes.sm,
    }),
    [tokens]
  );

  const footerStyle = useMemo<React.CSSProperties>(
    () => ({
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: `${tokens.spacing[3]} 0`,
    }),
    [tokens]
  );

  const paginationInfoStyle = useMemo<React.CSSProperties>(
    () => ({
      fontSize: tokens.typography.fontSizes.sm,
      color: tokens.colors.foreground.muted,
    }),
    [tokens]
  );

  const paginationControlsStyle = useMemo<React.CSSProperties>(
    () => ({
      display: 'flex',
      alignItems: 'center',
      gap: tokens.spacing[2],
    }),
    [tokens]
  );

  const getSortIndicator = (columnId: string): string => {
    if (!sort || sort.column !== columnId) return '';
    return sort.direction === 'asc' ? ' ^' : ' v';
  };

  const renderCell = (row: T, column: TableColumn<T>): React.ReactNode => {
    if (typeof column.accessor === 'function') {
      return column.accessor(row);
    }
    const value = row[column.accessor];
    if (value instanceof Date) {
      return value.toLocaleDateString();
    }
    return String(value ?? '');
  };

  const totalPages = pagination ? Math.max(1, Math.ceil(pagination.total / pagination.pageSize)) : 1;
  const startItem = pagination ? (pagination.page - 1) * pagination.pageSize + 1 : 1;
  const endItem = pagination ? Math.min(pagination.page * pagination.pageSize, pagination.total) : data.length;

  return (
    <div style={containerStyle} data-testid="data-table">
      {(title || onSearchChange || actions) && (
        <div style={headerStyle}>
          {title && <h2 style={titleStyle}>{title}</h2>}
          <div style={toolbarStyle}>
            {onSearchChange && (
              <Input
                value={search || ''}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                style={{ width: '250px' }}
                data-testid="table-search"
              />
            )}
            {actions}
          </div>
        </div>
      )}

      <Card variant="outlined" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={tableContainerStyle}>
          <table style={tableStyle} data-testid="table">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.id}
                    style={{
                      ...(column.sortable && onSortChange ? sortableThStyle : thStyle),
                      width: column.width,
                      textAlign: column.align || 'left',
                    }}
                    onClick={column.sortable && onSortChange ? () => onSortChange(column.id) : undefined}
                    data-testid={`column-${column.id}`}
                  >
                    {column.header}
                    {column.sortable && getSortIndicator(column.id)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={columns.length} style={loadingStyle}>
                    Loading...
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} style={emptyStyle}>
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                data.map((row) => (
                  <tr key={keyExtractor(row)} data-testid="table-row">
                    {columns.map((column) => (
                      <td
                        key={column.id}
                        style={{
                          ...tdStyle,
                          textAlign: column.align || 'left',
                        }}
                      >
                        {renderCell(row, column)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pagination && (
          <div style={footerStyle}>
            <div style={paginationInfoStyle}>
              {pagination.total > 0 ? (
                <>
                  Showing {startItem} to {endItem} of {pagination.total} results
                </>
              ) : (
                'No results'
              )}
            </div>
            <div style={paginationControlsStyle}>
              {onPageSizeChange && (
                <Select
                  value={String(pagination.pageSize)}
                  onChange={(value) => onPageSizeChange(Number(value))}
                  options={PAGE_SIZES.map((size) => ({ value: String(size), label: `${size} per page` }))}
                  style={{ width: '130px' }}
                  data-testid="page-size-select"
                />
              )}
              {onPageChange && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(pagination.page - 1)}
                    disabled={pagination.page <= 1}
                    data-testid="prev-page"
                  >
                    Previous
                  </Button>
                  <span style={paginationInfoStyle}>
                    Page {pagination.page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(pagination.page + 1)}
                    disabled={pagination.page >= totalPages}
                    data-testid="next-page"
                  >
                    Next
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
