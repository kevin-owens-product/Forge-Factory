/**
 * @prompt-id forge-v4.1:feature:portal:001
 * @generated-at 2026-01-21T00:00:00Z
 * @model claude-opus-4-5
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@forge/design-system';
import { Navigation } from '../Navigation';

function TestWrapper({
  children,
  initialEntries = ['/dashboard'],
}: {
  children: React.ReactNode;
  initialEntries?: string[];
}) {
  return (
    <ThemeProvider>
      <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
    </ThemeProvider>
  );
}

describe('Navigation', () => {
  it('should render the navigation', () => {
    render(
      <TestWrapper>
        <Navigation />
      </TestWrapper>
    );

    expect(screen.getByTestId('main-navigation')).toBeInTheDocument();
  });

  it('should display dashboard link', () => {
    render(
      <TestWrapper>
        <Navigation />
      </TestWrapper>
    );

    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
  });

  it('should display profile link', () => {
    render(
      <TestWrapper>
        <Navigation />
      </TestWrapper>
    );

    expect(screen.getByRole('link', { name: 'Profile' })).toBeInTheDocument();
  });

  it('should display settings link', () => {
    render(
      <TestWrapper>
        <Navigation />
      </TestWrapper>
    );

    expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument();
  });

  it('should have correct link destinations', () => {
    render(
      <TestWrapper>
        <Navigation />
      </TestWrapper>
    );

    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/dashboard');
    expect(screen.getByRole('link', { name: 'Profile' })).toHaveAttribute('href', '/profile');
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings');
  });

  it('should mark active link with aria-current', () => {
    render(
      <TestWrapper initialEntries={['/dashboard']}>
        <Navigation />
      </TestWrapper>
    );

    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
  });

  it('should not mark inactive links with aria-current', () => {
    render(
      <TestWrapper initialEntries={['/dashboard']}>
        <Navigation />
      </TestWrapper>
    );

    expect(screen.getByRole('link', { name: 'Profile' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: 'Settings' })).not.toHaveAttribute('aria-current');
  });

  it('should update active state when route changes', () => {
    render(
      <TestWrapper initialEntries={['/settings']}>
        <Navigation />
      </TestWrapper>
    );

    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current');
  });

  it('should have accessible navigation landmark', () => {
    render(
      <TestWrapper>
        <Navigation />
      </TestWrapper>
    );

    expect(screen.getByRole('navigation', { name: /main navigation/i })).toBeInTheDocument();
  });

  it('should render all navigation items', () => {
    render(
      <TestWrapper>
        <Navigation />
      </TestWrapper>
    );

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(3);
  });
});
