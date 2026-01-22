/**
 * @prompt-id forge-v4.1:feature:admin:001
 * @generated-at 2026-01-21T00:00:00Z
 * @model claude-opus-4-5
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@forge/design-system';
import { NotFound } from '../NotFound';

function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <MemoryRouter>{children}</MemoryRouter>
    </ThemeProvider>
  );
}

describe('NotFound', () => {
  it('should render not found page', () => {
    render(
      <TestWrapper>
        <NotFound />
      </TestWrapper>
    );

    expect(screen.getByTestId('not-found-page')).toBeInTheDocument();
  });

  it('should render 404 code', () => {
    render(
      <TestWrapper>
        <NotFound />
      </TestWrapper>
    );

    expect(screen.getByText('404')).toBeInTheDocument();
  });

  it('should render page title', () => {
    render(
      <TestWrapper>
        <NotFound />
      </TestWrapper>
    );

    expect(screen.getByText('Page Not Found')).toBeInTheDocument();
  });

  it('should render description', () => {
    render(
      <TestWrapper>
        <NotFound />
      </TestWrapper>
    );

    expect(
      screen.getByText(/Sorry, we couldn't find the page you're looking for/)
    ).toBeInTheDocument();
  });

  it('should render back to dashboard button', () => {
    render(
      <TestWrapper>
        <NotFound />
      </TestWrapper>
    );

    expect(screen.getByRole('button', { name: 'Back to Dashboard' })).toBeInTheDocument();
  });

  it('should have link to dashboard', () => {
    render(
      <TestWrapper>
        <NotFound />
      </TestWrapper>
    );

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/dashboard');
  });
});
