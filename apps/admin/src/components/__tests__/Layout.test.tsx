/**
 * @prompt-id forge-v4.1:feature:admin:001
 * @generated-at 2026-01-21T00:00:00Z
 * @model claude-opus-4-5
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@forge/design-system';
import { Layout } from '../Layout';
import { Header } from '../Layout/Header';
import { Sidebar } from '../Layout/Sidebar';

function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <MemoryRouter>{children}</MemoryRouter>
    </ThemeProvider>
  );
}

describe('Layout', () => {
  it('should render layout with children', () => {
    render(
      <TestWrapper>
        <Layout>
          <div data-testid="test-content">Test Content</div>
        </Layout>
      </TestWrapper>
    );

    expect(screen.getByTestId('admin-layout')).toBeInTheDocument();
    expect(screen.getByTestId('test-content')).toBeInTheDocument();
  });

  it('should render header and sidebar', () => {
    render(
      <TestWrapper>
        <Layout>
          <div>Content</div>
        </Layout>
      </TestWrapper>
    );

    expect(screen.getByTestId('admin-header')).toBeInTheDocument();
    expect(screen.getByTestId('admin-sidebar')).toBeInTheDocument();
  });

  it('should have main content area', () => {
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
  it('should render header with logo', () => {
    render(
      <TestWrapper>
        <Header />
      </TestWrapper>
    );

    expect(screen.getByText('Forge')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('should render theme toggle button', () => {
    render(
      <TestWrapper>
        <Header />
      </TestWrapper>
    );

    const themeButton = screen.getByRole('button', { name: /switch to/i });
    expect(themeButton).toBeInTheDocument();
  });

  it('should toggle theme on click', () => {
    render(
      <TestWrapper>
        <Header />
      </TestWrapper>
    );

    const themeButton = screen.getByRole('button', { name: /switch to/i });
    const initialText = themeButton.textContent;
    fireEvent.click(themeButton);
    expect(themeButton.textContent).not.toBe(initialText);
  });

  it('should render user info', () => {
    render(
      <TestWrapper>
        <Header />
      </TestWrapper>
    );

    expect(screen.getByText('Admin User')).toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument(); // Avatar
  });
});

describe('Sidebar', () => {
  it('should render sidebar with navigation', () => {
    render(
      <TestWrapper>
        <Sidebar />
      </TestWrapper>
    );

    expect(screen.getByTestId('admin-sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('admin-navigation')).toBeInTheDocument();
  });

  it('should have navigation role', () => {
    render(
      <TestWrapper>
        <Sidebar />
      </TestWrapper>
    );

    expect(screen.getByRole('navigation', { name: 'Admin navigation' })).toBeInTheDocument();
  });

  it('should render collapse button', () => {
    render(
      <TestWrapper>
        <Sidebar />
      </TestWrapper>
    );

    const collapseButton = screen.getByRole('button', { name: /collapse/i });
    expect(collapseButton).toBeInTheDocument();
  });

  it('should toggle collapse on button click', () => {
    render(
      <TestWrapper>
        <Sidebar />
      </TestWrapper>
    );

    const collapseButton = screen.getByRole('button', { name: /collapse/i });
    fireEvent.click(collapseButton);
    expect(screen.getByRole('button', { name: /expand/i })).toBeInTheDocument();
  });
});
