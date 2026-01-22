/**
 * @prompt-id forge-v4.1:feature:admin:001
 * @generated-at 2026-01-21T00:00:00Z
 * @model claude-opus-4-5
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@forge/design-system';
import { Tenants, tenantsMeta } from '../Tenants';

function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <MemoryRouter>{children}</MemoryRouter>
    </ThemeProvider>
  );
}

describe('Tenants', () => {
  it('should render tenants page', () => {
    render(
      <TestWrapper>
        <Tenants />
      </TestWrapper>
    );

    expect(screen.getByTestId('tenants-page')).toBeInTheDocument();
  });

  it('should render page title and description', () => {
    render(
      <TestWrapper>
        <Tenants />
      </TestWrapper>
    );

    expect(screen.getByText(tenantsMeta.title)).toBeInTheDocument();
    expect(screen.getByText(tenantsMeta.description!)).toBeInTheDocument();
  });

  it('should render data table', () => {
    render(
      <TestWrapper>
        <Tenants />
      </TestWrapper>
    );

    expect(screen.getByTestId('data-table')).toBeInTheDocument();
  });

  it('should render column headers', () => {
    render(
      <TestWrapper>
        <Tenants />
      </TestWrapper>
    );

    expect(screen.getByTestId('column-name')).toBeInTheDocument();
    expect(screen.getByTestId('column-slug')).toBeInTheDocument();
    expect(screen.getByTestId('column-plan')).toBeInTheDocument();
    expect(screen.getByTestId('column-status')).toBeInTheDocument();
  });

  it('should render tenant data', () => {
    render(
      <TestWrapper>
        <Tenants />
      </TestWrapper>
    );

    expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    expect(screen.getByText('acme')).toBeInTheDocument();
  });

  it('should render plan badges', () => {
    render(
      <TestWrapper>
        <Tenants />
      </TestWrapper>
    );

    expect(screen.getByText('Enterprise')).toBeInTheDocument();
    expect(screen.getByText('Starter')).toBeInTheDocument();
    expect(screen.getAllByText('Professional').length).toBeGreaterThan(0);
  });

  it('should render status badges', () => {
    render(
      <TestWrapper>
        <Tenants />
      </TestWrapper>
    );

    expect(screen.getAllByText('Active').length).toBeGreaterThan(0);
    expect(screen.getByText('Trial')).toBeInTheDocument();
    expect(screen.getByText('Suspended')).toBeInTheDocument();
  });

  it('should render Add Tenant button', () => {
    render(
      <TestWrapper>
        <Tenants />
      </TestWrapper>
    );

    expect(screen.getByRole('button', { name: 'Add Tenant' })).toBeInTheDocument();
  });

  it('should render action buttons for each row', () => {
    render(
      <TestWrapper>
        <Tenants />
      </TestWrapper>
    );

    expect(screen.getAllByRole('button', { name: 'Edit' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'View' }).length).toBeGreaterThan(0);
  });

  it('should render search input', () => {
    render(
      <TestWrapper>
        <Tenants />
      </TestWrapper>
    );

    expect(screen.getByTestId('table-search')).toBeInTheDocument();
  });

  it('should filter tenants on search', async () => {
    render(
      <TestWrapper>
        <Tenants />
      </TestWrapper>
    );

    const searchInput = screen.getByTestId('table-search');
    fireEvent.change(searchInput, { target: { value: 'Acme' } });

    // Wait for debounce (300ms) + React state updates
    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
      expect(screen.queryByText('StartupXYZ')).not.toBeInTheDocument();
    }, { timeout: 1000 });
  });

  it('should render storage column with formatted values', () => {
    render(
      <TestWrapper>
        <Tenants />
      </TestWrapper>
    );

    // Storage values should be formatted
    expect(screen.getByText(/100 GB \/ 1 TB/)).toBeInTheDocument();
  });

  it('should render user count column', () => {
    render(
      <TestWrapper>
        <Tenants />
      </TestWrapper>
    );

    expect(screen.getByText('150')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });
});
