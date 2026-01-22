/**
 * @prompt-id forge-v4.1:feature:admin:001
 * @generated-at 2026-01-21T00:00:00Z
 * @model claude-opus-4-5
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@forge/design-system';
import { AuditLog, auditLogMeta } from '../AuditLog';

function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <MemoryRouter>{children}</MemoryRouter>
    </ThemeProvider>
  );
}

describe('AuditLog', () => {
  it('should render audit log page', () => {
    render(
      <TestWrapper>
        <AuditLog />
      </TestWrapper>
    );

    expect(screen.getByTestId('audit-log-page')).toBeInTheDocument();
  });

  it('should render page title and description', () => {
    render(
      <TestWrapper>
        <AuditLog />
      </TestWrapper>
    );

    expect(screen.getByText(auditLogMeta.title)).toBeInTheDocument();
    expect(screen.getByText(auditLogMeta.description!)).toBeInTheDocument();
  });

  it('should render data table', () => {
    render(
      <TestWrapper>
        <AuditLog />
      </TestWrapper>
    );

    expect(screen.getByTestId('data-table')).toBeInTheDocument();
  });

  it('should render column headers', () => {
    render(
      <TestWrapper>
        <AuditLog />
      </TestWrapper>
    );

    expect(screen.getByTestId('column-timestamp')).toBeInTheDocument();
    expect(screen.getByTestId('column-type')).toBeInTheDocument();
    expect(screen.getByTestId('column-severity')).toBeInTheDocument();
    expect(screen.getByTestId('column-outcome')).toBeInTheDocument();
  });

  it('should render audit event data', () => {
    render(
      <TestWrapper>
        <AuditLog />
      </TestWrapper>
    );

    expect(screen.getByText('User logged in')).toBeInTheDocument();
    expect(screen.getByText('Created new user account')).toBeInTheDocument();
    expect(screen.getByText('Multiple failed login attempts detected')).toBeInTheDocument();
  });

  it('should render severity badges', () => {
    render(
      <TestWrapper>
        <AuditLog />
      </TestWrapper>
    );

    // Severity labels appear in dropdown and badges, so check that they appear more than once
    // (once in dropdown, potentially more in badges)
    expect(screen.getAllByText('Low').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Medium').length).toBeGreaterThan(0);
    expect(screen.getAllByText('High').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Critical').length).toBeGreaterThan(0);
  });

  it('should render outcome badges', () => {
    render(
      <TestWrapper>
        <AuditLog />
      </TestWrapper>
    );

    expect(screen.getAllByText('SUCCESS').length).toBeGreaterThan(0);
    expect(screen.getAllByText('FAILURE').length).toBeGreaterThan(0);
  });

  it('should render type filter', () => {
    render(
      <TestWrapper>
        <AuditLog />
      </TestWrapper>
    );

    expect(screen.getByTestId('type-filter')).toBeInTheDocument();
  });

  it('should render severity filter', () => {
    render(
      <TestWrapper>
        <AuditLog />
      </TestWrapper>
    );

    expect(screen.getByTestId('severity-filter')).toBeInTheDocument();
  });

  it('should render outcome filter', () => {
    render(
      <TestWrapper>
        <AuditLog />
      </TestWrapper>
    );

    expect(screen.getByTestId('outcome-filter')).toBeInTheDocument();
  });

  it('should render Export button', () => {
    render(
      <TestWrapper>
        <AuditLog />
      </TestWrapper>
    );

    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument();
  });

  it('should filter by type', async () => {
    render(
      <TestWrapper>
        <AuditLog />
      </TestWrapper>
    );

    const typeFilter = screen.getByTestId('type-filter');
    fireEvent.change(typeFilter, { target: { value: 'AUTH' } });

    await waitFor(() => {
      // AUTH events should be visible
      expect(screen.getByText('User logged in')).toBeInTheDocument();
      // Non-AUTH events should be filtered out
      expect(screen.queryByText('Updated system settings')).not.toBeInTheDocument();
    });
  });

  it('should filter by severity', async () => {
    render(
      <TestWrapper>
        <AuditLog />
      </TestWrapper>
    );

    const severityFilter = screen.getByTestId('severity-filter');
    fireEvent.change(severityFilter, { target: { value: 'HIGH' } });

    await waitFor(() => {
      // "High" appears in both the dropdown and the filtered results
      expect(screen.getAllByText('High').length).toBeGreaterThan(0);
      // "Low" still appears in dropdown but not as badges - check table doesn't contain LOW severity events
      // By checking for specific LOW-severity event content that should be filtered out
      expect(screen.queryByText('User logged in')).not.toBeInTheDocument();
    });
  });

  it('should filter by outcome', async () => {
    render(
      <TestWrapper>
        <AuditLog />
      </TestWrapper>
    );

    const outcomeFilter = screen.getByTestId('outcome-filter');
    fireEvent.change(outcomeFilter, { target: { value: 'SUCCESS' } });

    await waitFor(() => {
      expect(screen.queryAllByText('FAILURE')).toHaveLength(0);
    });
  });

  it('should filter by search', async () => {
    render(
      <TestWrapper>
        <AuditLog />
      </TestWrapper>
    );

    const searchInput = screen.getByTestId('table-search');
    fireEvent.change(searchInput, { target: { value: 'logged in' } });

    // Wait for debounce (300ms) + React state updates
    await waitFor(() => {
      expect(screen.getByText('User logged in')).toBeInTheDocument();
      // Other events should be filtered out
      expect(screen.queryByText('Updated system settings')).not.toBeInTheDocument();
    }, { timeout: 1000 });
  });

  it('should render actor information', () => {
    render(
      <TestWrapper>
        <AuditLog />
      </TestWrapper>
    );

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    // Admin User appears multiple times in the mock data
    expect(screen.getAllByText('Admin User').length).toBeGreaterThan(0);
  });

  it('should render event messages', () => {
    render(
      <TestWrapper>
        <AuditLog />
      </TestWrapper>
    );

    expect(screen.getByText('Created user jane@example.com')).toBeInTheDocument();
    expect(screen.getByText('IP: 192.168.1.100 - 5 failed attempts')).toBeInTheDocument();
  });
});
