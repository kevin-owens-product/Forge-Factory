/**
 * @prompt-id forge-v4.1:feature:portal:001
 * @generated-at 2026-01-21T00:00:00Z
 * @model claude-opus-4-5
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@forge/design-system';
import { NotFound, notFoundMeta } from '../NotFound';

function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <MemoryRouter>{children}</MemoryRouter>
    </ThemeProvider>
  );
}

describe('NotFound', () => {
  it('should render the not found page', () => {
    render(
      <TestWrapper>
        <NotFound />
      </TestWrapper>
    );

    expect(screen.getByTestId('not-found-page')).toBeInTheDocument();
  });

  it('should display 404 error code', () => {
    render(
      <TestWrapper>
        <NotFound />
      </TestWrapper>
    );

    expect(screen.getByText('404')).toBeInTheDocument();
  });

  it('should display the page title', () => {
    render(
      <TestWrapper>
        <NotFound />
      </TestWrapper>
    );

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(notFoundMeta.title);
  });

  it('should display the page description', () => {
    render(
      <TestWrapper>
        <NotFound />
      </TestWrapper>
    );

    expect(screen.getByText(notFoundMeta.description!)).toBeInTheDocument();
  });

  it('should display a link to dashboard', () => {
    render(
      <TestWrapper>
        <NotFound />
      </TestWrapper>
    );

    expect(screen.getByTestId('not-found-home-button')).toBeInTheDocument();
    expect(screen.getByTestId('not-found-home-button')).toHaveTextContent('Go to Dashboard');
  });

  it('should have correct link destination', () => {
    render(
      <TestWrapper>
        <NotFound />
      </TestWrapper>
    );

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/dashboard');
  });

  it('should be accessible with proper landmarks', () => {
    render(
      <TestWrapper>
        <NotFound />
      </TestWrapper>
    );

    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('should have accessible heading', () => {
    render(
      <TestWrapper>
        <NotFound />
      </TestWrapper>
    );

    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveAttribute('id', 'not-found-title');
  });
});

describe('notFoundMeta', () => {
  it('should have correct title', () => {
    expect(notFoundMeta.title).toBe('Page Not Found');
  });

  it('should have correct description', () => {
    expect(notFoundMeta.description).toBe('The page you are looking for does not exist');
  });
});
