/**
 * @prompt-id forge-v4.1:feature:admin:001
 * @generated-at 2026-01-21T00:00:00Z
 * @model claude-opus-4-5
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@forge/design-system';
import { Dashboard, dashboardMeta } from '../Dashboard';

function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <MemoryRouter>{children}</MemoryRouter>
    </ThemeProvider>
  );
}

describe('Dashboard', () => {
  it('should render dashboard page', () => {
    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
  });

  it('should render page title and description', () => {
    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    expect(screen.getByText(dashboardMeta.title)).toBeInTheDocument();
    expect(screen.getByText(dashboardMeta.description!)).toBeInTheDocument();
  });

  it('should render statistics cards', () => {
    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    expect(screen.getByText('Total Users')).toBeInTheDocument();
    expect(screen.getByText('Tenants')).toBeInTheDocument();
    expect(screen.getByText('Storage Used')).toBeInTheDocument();
    expect(screen.getByText('Recent Events')).toBeInTheDocument();
  });

  it('should render statistics values', () => {
    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    expect(screen.getByText('1,234')).toBeInTheDocument(); // Total Users
    expect(screen.getByText('45')).toBeInTheDocument(); // Tenants
  });

  it('should render system health section', () => {
    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    expect(screen.getByText('System Health')).toBeInTheDocument();
    expect(screen.getByText('Healthy')).toBeInTheDocument();
  });

  it('should render recent activity section', () => {
    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    expect(screen.getByText('Recent Activity')).toBeInTheDocument();
  });

  it('should render recent events', () => {
    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    expect(screen.getByText('User logged in')).toBeInTheDocument();
    expect(screen.getByText('New user created')).toBeInTheDocument();
    expect(screen.getByText('Multiple failed login attempts detected')).toBeInTheDocument();
  });

  it('should render event severity badges', () => {
    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    expect(screen.getAllByText('LOW').length).toBeGreaterThan(0);
    expect(screen.getByText('MEDIUM')).toBeInTheDocument();
    expect(screen.getByText('HIGH')).toBeInTheDocument();
  });

  it('should have statistics section with aria label', () => {
    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    expect(screen.getByRole('region', { name: 'Statistics' })).toBeInTheDocument();
  });

  it('should have details section with aria label', () => {
    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    expect(screen.getByRole('region', { name: 'Details' })).toBeInTheDocument();
  });
});
