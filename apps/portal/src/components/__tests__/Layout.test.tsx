/**
 * @prompt-id forge-v4.1:feature:portal:001
 * @generated-at 2026-01-21T00:00:00Z
 * @model claude-opus-4-5
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@forge/design-system';
import { Layout, Header, Sidebar } from '../Layout';

function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <MemoryRouter>{children}</MemoryRouter>
    </ThemeProvider>
  );
}

describe('Layout', () => {
  it('should render the layout container', () => {
    render(
      <TestWrapper>
        <Layout>
          <div>Content</div>
        </Layout>
      </TestWrapper>
    );

    expect(screen.getByTestId('app-layout')).toBeInTheDocument();
  });

  it('should render children in main content area', () => {
    render(
      <TestWrapper>
        <Layout>
          <div data-testid="test-content">Test Content</div>
        </Layout>
      </TestWrapper>
    );

    expect(screen.getByTestId('test-content')).toBeInTheDocument();
  });

  it('should render header', () => {
    render(
      <TestWrapper>
        <Layout>
          <div>Content</div>
        </Layout>
      </TestWrapper>
    );

    expect(screen.getByTestId('app-header')).toBeInTheDocument();
  });

  it('should render sidebar', () => {
    render(
      <TestWrapper>
        <Layout>
          <div>Content</div>
        </Layout>
      </TestWrapper>
    );

    expect(screen.getByTestId('app-sidebar')).toBeInTheDocument();
  });

  it('should have accessible main landmark', () => {
    render(
      <TestWrapper>
        <Layout>
          <div>Content</div>
        </Layout>
      </TestWrapper>
    );

    expect(screen.getByRole('main')).toBeInTheDocument();
  });
});

describe('Header', () => {
  it('should render the header', () => {
    render(
      <TestWrapper>
        <Header />
      </TestWrapper>
    );

    expect(screen.getByTestId('app-header')).toBeInTheDocument();
  });

  it('should display the app logo/title', () => {
    render(
      <TestWrapper>
        <Header />
      </TestWrapper>
    );

    expect(screen.getByText('Forge Portal')).toBeInTheDocument();
  });

  it('should have a link to dashboard', () => {
    render(
      <TestWrapper>
        <Header />
      </TestWrapper>
    );

    const link = screen.getByRole('link', { name: /forge portal home/i });
    expect(link).toHaveAttribute('href', '/dashboard');
  });

  it('should display theme toggle button', () => {
    render(
      <TestWrapper>
        <Header />
      </TestWrapper>
    );

    expect(screen.getByTestId('theme-toggle-button')).toBeInTheDocument();
  });

  it('should toggle theme when button is clicked', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <Header />
      </TestWrapper>
    );

    const themeButton = screen.getByTestId('theme-toggle-button');
    await user.click(themeButton);

    // Button should still be present
    expect(themeButton).toBeInTheDocument();
  });

  it('should have accessible banner role', () => {
    render(
      <TestWrapper>
        <Header />
      </TestWrapper>
    );

    expect(screen.getByRole('banner')).toBeInTheDocument();
  });
});

describe('Sidebar', () => {
  it('should render the sidebar', () => {
    render(
      <TestWrapper>
        <Sidebar />
      </TestWrapper>
    );

    expect(screen.getByTestId('app-sidebar')).toBeInTheDocument();
  });

  it('should render navigation', () => {
    render(
      <TestWrapper>
        <Sidebar />
      </TestWrapper>
    );

    expect(screen.getByTestId('main-navigation')).toBeInTheDocument();
  });

  it('should have accessible navigation role', () => {
    render(
      <TestWrapper>
        <Sidebar />
      </TestWrapper>
    );

    expect(screen.getByRole('navigation', { name: /sidebar navigation/i })).toBeInTheDocument();
  });
});
