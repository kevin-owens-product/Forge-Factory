/**
 * @prompt-id forge-v4.1:feature:portal:001
 * @generated-at 2026-01-21T00:00:00Z
 * @model claude-opus-4-5
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@forge/design-system';
import { Dashboard, dashboardMeta } from '../Dashboard';

function TestWrapper({ children }: { children: React.ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

describe('Dashboard', () => {
  it('should render the dashboard page', () => {
    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
  });

  it('should display the page title', () => {
    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(dashboardMeta.title);
  });

  it('should display the page description', () => {
    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    expect(screen.getByText(dashboardMeta.description!)).toBeInTheDocument();
  });

  it('should display statistics cards', () => {
    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    expect(screen.getByText('Total Projects')).toBeInTheDocument();
    expect(screen.getByText('Active Tasks')).toBeInTheDocument();
    expect(screen.getByText('Team Members')).toBeInTheDocument();
    expect(screen.getByText('Storage Used')).toBeInTheDocument();
  });

  it('should display stat values', () => {
    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('28')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('2.4 GB')).toBeInTheDocument();
  });

  it('should display change indicators', () => {
    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    expect(screen.getByText('+2 this month')).toBeInTheDocument();
    expect(screen.getByText('-3 from last week')).toBeInTheDocument();
    expect(screen.getByText('45% of quota')).toBeInTheDocument();
  });

  it('should display recent activity section', () => {
    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    expect(screen.getByRole('heading', { name: 'Recent Activity' })).toBeInTheDocument();
  });

  it('should display activity items', () => {
    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    expect(screen.getByText('Project Updated')).toBeInTheDocument();
    expect(screen.getByText('New Team Member')).toBeInTheDocument();
    expect(screen.getByText('Task Completed')).toBeInTheDocument();
    expect(screen.getByText('File Uploaded')).toBeInTheDocument();
  });

  it('should display activity descriptions', () => {
    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    expect(screen.getByText('Marketing Campaign project was updated')).toBeInTheDocument();
    expect(screen.getByText('Sarah joined the team')).toBeInTheDocument();
  });

  it('should display activity timestamps', () => {
    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    expect(screen.getByText('2 hours ago')).toBeInTheDocument();
    expect(screen.getByText('5 hours ago')).toBeInTheDocument();
    expect(screen.getByText('1 day ago')).toBeInTheDocument();
    expect(screen.getByText('2 days ago')).toBeInTheDocument();
  });

  it('should have accessible sections', () => {
    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    expect(screen.getByRole('region', { name: 'Statistics' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Recent Activity' })).toBeInTheDocument();
  });
});

describe('dashboardMeta', () => {
  it('should have correct title', () => {
    expect(dashboardMeta.title).toBe('Dashboard');
  });

  it('should have correct description', () => {
    expect(dashboardMeta.description).toBe('Overview of your account and recent activity');
  });
});
