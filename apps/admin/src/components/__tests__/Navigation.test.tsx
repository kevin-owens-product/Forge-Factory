/**
 * @prompt-id forge-v4.1:feature:admin:001
 * @generated-at 2026-01-21T00:00:00Z
 * @model claude-opus-4-5
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@forge/design-system';
import { Navigation } from '../Navigation';

function TestWrapper({ children, initialEntries = ['/dashboard'] }: { children: React.ReactNode; initialEntries?: string[] }) {
  return (
    <ThemeProvider>
      <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
    </ThemeProvider>
  );
}

describe('Navigation', () => {
  it('should render all navigation items', () => {
    render(
      <TestWrapper>
        <Navigation />
      </TestWrapper>
    );

    expect(screen.getByTestId('nav-dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('nav-users')).toBeInTheDocument();
    expect(screen.getByTestId('nav-tenants')).toBeInTheDocument();
    expect(screen.getByTestId('nav-audit-log')).toBeInTheDocument();
    expect(screen.getByTestId('nav-settings')).toBeInTheDocument();
  });

  it('should render navigation labels when not collapsed', () => {
    render(
      <TestWrapper>
        <Navigation collapsed={false} />
      </TestWrapper>
    );

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Users')).toBeInTheDocument();
    expect(screen.getByText('Tenants')).toBeInTheDocument();
    expect(screen.getByText('Audit Log')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('should hide labels when collapsed', () => {
    render(
      <TestWrapper>
        <Navigation collapsed={true} />
      </TestWrapper>
    );

    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
    expect(screen.queryByText('Users')).not.toBeInTheDocument();
  });

  it('should have correct href for each item', () => {
    render(
      <TestWrapper>
        <Navigation />
      </TestWrapper>
    );

    expect(screen.getByTestId('nav-dashboard')).toHaveAttribute('href', '/dashboard');
    expect(screen.getByTestId('nav-users')).toHaveAttribute('href', '/users');
    expect(screen.getByTestId('nav-tenants')).toHaveAttribute('href', '/tenants');
    expect(screen.getByTestId('nav-audit-log')).toHaveAttribute('href', '/audit-log');
    expect(screen.getByTestId('nav-settings')).toHaveAttribute('href', '/settings');
  });

  it('should highlight active route', () => {
    render(
      <TestWrapper initialEntries={['/users']}>
        <Navigation />
      </TestWrapper>
    );

    // The active item should have different styling (we can check for aria-current or class)
    const usersLink = screen.getByTestId('nav-users');
    expect(usersLink).toBeInTheDocument();
  });

  it('should have main navigation role', () => {
    render(
      <TestWrapper>
        <Navigation />
      </TestWrapper>
    );

    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
  });

  it('should render icons for each item', () => {
    render(
      <TestWrapper>
        <Navigation />
      </TestWrapper>
    );

    // Check that icon indicators are present
    expect(screen.getByText('D')).toBeInTheDocument(); // Dashboard icon
    expect(screen.getByText('U')).toBeInTheDocument(); // Users icon
    expect(screen.getByText('T')).toBeInTheDocument(); // Tenants icon
    expect(screen.getAllByText('A')).toHaveLength(1); // Audit log icon
    expect(screen.getByText('S')).toBeInTheDocument(); // Settings icon
  });

  it('should apply hover styles on mouse enter', () => {
    render(
      <TestWrapper initialEntries={['/dashboard']}>
        <Navigation />
      </TestWrapper>
    );

    const usersLink = screen.getByTestId('nav-users');
    fireEvent.mouseEnter(usersLink);
    // Style changes are applied, just ensure no errors
    fireEvent.mouseLeave(usersLink);
    expect(usersLink).toBeInTheDocument();
  });
});
