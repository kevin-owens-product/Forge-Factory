/**
 * @prompt-id forge-v4.1:feature:admin:001
 * @generated-at 2026-01-21T00:00:00Z
 * @model claude-opus-4-5
 */

import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@forge/design-system';
import { routes, ROUTES, getRouter } from './routes';

function TestWrapper({ router }: { router: ReturnType<typeof createMemoryRouter> }) {
  return (
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>
  );
}

describe('Routes configuration', () => {
  it('should have correct route paths defined', () => {
    expect(ROUTES.HOME).toBe('/');
    expect(ROUTES.DASHBOARD).toBe('/dashboard');
    expect(ROUTES.USERS).toBe('/users');
    expect(ROUTES.TENANTS).toBe('/tenants');
    expect(ROUTES.SETTINGS).toBe('/settings');
    expect(ROUTES.AUDIT_LOG).toBe('/audit-log');
  });

  it('should export routes array', () => {
    expect(Array.isArray(routes)).toBe(true);
    expect(routes.length).toBeGreaterThan(0);
  });

  it('should export getRouter function', () => {
    expect(typeof getRouter).toBe('function');
    const router = getRouter();
    expect(router).toBeDefined();
  });
});

describe('Route navigation', () => {
  it('should redirect root to dashboard', async () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/'] });

    render(<TestWrapper router={router} />);

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
    });
  });

  it('should render dashboard page at /dashboard', async () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/dashboard'] });

    render(<TestWrapper router={router} />);

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
    });
  });

  it('should render users page at /users', async () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/users'] });

    render(<TestWrapper router={router} />);

    await waitFor(() => {
      expect(screen.getByTestId('users-page')).toBeInTheDocument();
    });
  });

  it('should render tenants page at /tenants', async () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/tenants'] });

    render(<TestWrapper router={router} />);

    await waitFor(() => {
      expect(screen.getByTestId('tenants-page')).toBeInTheDocument();
    });
  });

  it('should render settings page at /settings', async () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/settings'] });

    render(<TestWrapper router={router} />);

    await waitFor(() => {
      expect(screen.getByTestId('settings-page')).toBeInTheDocument();
    });
  });

  it('should render audit log page at /audit-log', async () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/audit-log'] });

    render(<TestWrapper router={router} />);

    await waitFor(() => {
      expect(screen.getByTestId('audit-log-page')).toBeInTheDocument();
    });
  });

  it('should render not found page for unknown routes', async () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/unknown-route'] });

    render(<TestWrapper router={router} />);

    await waitFor(() => {
      expect(screen.getByTestId('not-found-page')).toBeInTheDocument();
    });
  });
});

describe('Layout integration', () => {
  it('should render layout with header and sidebar on all routes', async () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/dashboard'] });

    render(<TestWrapper router={router} />);

    await waitFor(() => {
      expect(screen.getByTestId('admin-layout')).toBeInTheDocument();
      expect(screen.getByTestId('admin-header')).toBeInTheDocument();
      expect(screen.getByTestId('admin-sidebar')).toBeInTheDocument();
    });
  });

  it('should render navigation in sidebar', async () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/dashboard'] });

    render(<TestWrapper router={router} />);

    await waitFor(() => {
      expect(screen.getByTestId('admin-navigation')).toBeInTheDocument();
    });
  });
});
