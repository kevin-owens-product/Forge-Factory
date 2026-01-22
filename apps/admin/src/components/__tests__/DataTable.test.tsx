/**
 * @prompt-id forge-v4.1:feature:admin:001
 * @generated-at 2026-01-21T00:00:00Z
 * @model claude-opus-4-5
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '@forge/design-system';
import { DataTable } from '../DataTable';
import type { TableColumn } from '../../types';

interface TestData {
  id: string;
  name: string;
  email: string;
  age: number;
}

const testData: TestData[] = [
  { id: '1', name: 'John Doe', email: 'john@example.com', age: 30 },
  { id: '2', name: 'Jane Smith', email: 'jane@example.com', age: 25 },
  { id: '3', name: 'Bob Wilson', email: 'bob@example.com', age: 35 },
];

const columns: TableColumn<TestData>[] = [
  { id: 'name', header: 'Name', accessor: 'name', sortable: true },
  { id: 'email', header: 'Email', accessor: 'email', sortable: true },
  { id: 'age', header: 'Age', accessor: 'age', sortable: true, align: 'right' },
];

function TestWrapper({ children }: { children: React.ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

describe('DataTable', () => {
  it('should render table with data', () => {
    render(
      <TestWrapper>
        <DataTable columns={columns} data={testData} keyExtractor={(row) => row.id} />
      </TestWrapper>
    );

    expect(screen.getByTestId('data-table')).toBeInTheDocument();
    expect(screen.getByTestId('table')).toBeInTheDocument();
    expect(screen.getAllByTestId('table-row')).toHaveLength(3);
  });

  it('should render column headers', () => {
    render(
      <TestWrapper>
        <DataTable columns={columns} data={testData} keyExtractor={(row) => row.id} />
      </TestWrapper>
    );

    expect(screen.getByTestId('column-name')).toHaveTextContent('Name');
    expect(screen.getByTestId('column-email')).toHaveTextContent('Email');
    expect(screen.getByTestId('column-age')).toHaveTextContent('Age');
  });

  it('should render data values', () => {
    render(
      <TestWrapper>
        <DataTable columns={columns} data={testData} keyExtractor={(row) => row.id} />
      </TestWrapper>
    );

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    expect(screen.getByText('35')).toBeInTheDocument();
  });

  it('should show empty message when no data', () => {
    render(
      <TestWrapper>
        <DataTable
          columns={columns}
          data={[]}
          keyExtractor={(row) => row.id}
          emptyMessage="No records found"
        />
      </TestWrapper>
    );

    expect(screen.getByText('No records found')).toBeInTheDocument();
  });

  it('should show loading state', () => {
    render(
      <TestWrapper>
        <DataTable columns={columns} data={testData} keyExtractor={(row) => row.id} loading={true} />
      </TestWrapper>
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should render title', () => {
    render(
      <TestWrapper>
        <DataTable columns={columns} data={testData} keyExtractor={(row) => row.id} title="Test Table" />
      </TestWrapper>
    );

    expect(screen.getByText('Test Table')).toBeInTheDocument();
  });

  it('should render search input when onSearchChange provided', () => {
    const onSearchChange = vi.fn();
    render(
      <TestWrapper>
        <DataTable
          columns={columns}
          data={testData}
          keyExtractor={(row) => row.id}
          search=""
          onSearchChange={onSearchChange}
        />
      </TestWrapper>
    );

    const searchInput = screen.getByTestId('table-search');
    expect(searchInput).toBeInTheDocument();
    fireEvent.change(searchInput, { target: { value: 'test' } });
    expect(onSearchChange).toHaveBeenCalledWith('test');
  });

  it('should render actions', () => {
    render(
      <TestWrapper>
        <DataTable
          columns={columns}
          data={testData}
          keyExtractor={(row) => row.id}
          actions={<button data-testid="add-button">Add</button>}
        />
      </TestWrapper>
    );

    expect(screen.getByTestId('add-button')).toBeInTheDocument();
  });

  it('should call onSortChange when clicking sortable header', () => {
    const onSortChange = vi.fn();
    render(
      <TestWrapper>
        <DataTable
          columns={columns}
          data={testData}
          keyExtractor={(row) => row.id}
          onSortChange={onSortChange}
        />
      </TestWrapper>
    );

    fireEvent.click(screen.getByTestId('column-name'));
    expect(onSortChange).toHaveBeenCalledWith('name');
  });

  it('should display sort indicator', () => {
    render(
      <TestWrapper>
        <DataTable
          columns={columns}
          data={testData}
          keyExtractor={(row) => row.id}
          sort={{ column: 'name', direction: 'asc' }}
          onSortChange={vi.fn()}
        />
      </TestWrapper>
    );

    expect(screen.getByTestId('column-name')).toHaveTextContent('Name ^');
  });

  it('should display desc sort indicator', () => {
    render(
      <TestWrapper>
        <DataTable
          columns={columns}
          data={testData}
          keyExtractor={(row) => row.id}
          sort={{ column: 'name', direction: 'desc' }}
          onSortChange={vi.fn()}
        />
      </TestWrapper>
    );

    expect(screen.getByTestId('column-name')).toHaveTextContent('Name v');
  });

  it('should render pagination controls', () => {
    render(
      <TestWrapper>
        <DataTable
          columns={columns}
          data={testData}
          keyExtractor={(row) => row.id}
          pagination={{ page: 1, pageSize: 25, total: 100 }}
          onPageChange={vi.fn()}
        />
      </TestWrapper>
    );

    expect(screen.getByTestId('prev-page')).toBeInTheDocument();
    expect(screen.getByTestId('next-page')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 4')).toBeInTheDocument();
  });

  it('should call onPageChange when clicking next page', () => {
    const onPageChange = vi.fn();
    render(
      <TestWrapper>
        <DataTable
          columns={columns}
          data={testData}
          keyExtractor={(row) => row.id}
          pagination={{ page: 1, pageSize: 25, total: 100 }}
          onPageChange={onPageChange}
        />
      </TestWrapper>
    );

    fireEvent.click(screen.getByTestId('next-page'));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('should disable prev button on first page', () => {
    render(
      <TestWrapper>
        <DataTable
          columns={columns}
          data={testData}
          keyExtractor={(row) => row.id}
          pagination={{ page: 1, pageSize: 25, total: 100 }}
          onPageChange={vi.fn()}
        />
      </TestWrapper>
    );

    expect(screen.getByTestId('prev-page')).toBeDisabled();
  });

  it('should disable next button on last page', () => {
    render(
      <TestWrapper>
        <DataTable
          columns={columns}
          data={testData}
          keyExtractor={(row) => row.id}
          pagination={{ page: 4, pageSize: 25, total: 100 }}
          onPageChange={vi.fn()}
        />
      </TestWrapper>
    );

    expect(screen.getByTestId('next-page')).toBeDisabled();
  });

  it('should render page size selector', () => {
    const onPageSizeChange = vi.fn();
    render(
      <TestWrapper>
        <DataTable
          columns={columns}
          data={testData}
          keyExtractor={(row) => row.id}
          pagination={{ page: 1, pageSize: 25, total: 100 }}
          onPageSizeChange={onPageSizeChange}
        />
      </TestWrapper>
    );

    const select = screen.getByTestId('page-size-select');
    expect(select).toBeInTheDocument();
    fireEvent.change(select, { target: { value: '50' } });
    expect(onPageSizeChange).toHaveBeenCalledWith(50);
  });

  it('should render pagination info', () => {
    render(
      <TestWrapper>
        <DataTable
          columns={columns}
          data={testData}
          keyExtractor={(row) => row.id}
          pagination={{ page: 2, pageSize: 25, total: 100 }}
        />
      </TestWrapper>
    );

    expect(screen.getByText('Showing 26 to 50 of 100 results')).toBeInTheDocument();
  });

  it('should show no results message when total is 0', () => {
    render(
      <TestWrapper>
        <DataTable
          columns={columns}
          data={[]}
          keyExtractor={(row) => row.id}
          pagination={{ page: 1, pageSize: 25, total: 0 }}
        />
      </TestWrapper>
    );

    expect(screen.getByText('No results')).toBeInTheDocument();
  });

  it('should render custom accessor function', () => {
    const customColumns: TableColumn<TestData>[] = [
      { id: 'custom', header: 'Custom', accessor: (row) => `${row.name} (${row.age})` },
    ];

    render(
      <TestWrapper>
        <DataTable columns={customColumns} data={testData} keyExtractor={(row) => row.id} />
      </TestWrapper>
    );

    expect(screen.getByText('John Doe (30)')).toBeInTheDocument();
  });

  it('should handle Date accessor', () => {
    interface DateData {
      id: string;
      createdAt: Date;
    }
    // Use explicit local time to avoid timezone issues
    const dateData: DateData[] = [{ id: '1', createdAt: new Date(2024, 5, 15) }]; // June 15, 2024
    const dateColumns: TableColumn<DateData>[] = [
      { id: 'date', header: 'Date', accessor: 'createdAt' },
    ];

    render(
      <TestWrapper>
        <DataTable columns={dateColumns} data={dateData} keyExtractor={(row) => row.id} />
      </TestWrapper>
    );

    // Date should be formatted - use flexible regex to handle different date formats
    expect(screen.getByText(/6\/15\/2024|15\/6\/2024|Jun(e)?\s+15/i)).toBeInTheDocument();
  });
});
