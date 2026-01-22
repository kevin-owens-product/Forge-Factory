/**
 * @prompt-id forge-v4.1:feature:admin:001
 * @generated-at 2026-01-21T00:00:00Z
 * @model claude-opus-4-5
 */

import type { RouteObject } from 'react-router-dom';
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard, Users, Tenants, Settings, AuditLog, NotFound } from './pages';

/**
 * Route configuration for the admin application
 */
export const routes: RouteObject[] = [
  {
    path: '/',
    element: (
      <Layout>
        <Outlet />
      </Layout>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: 'dashboard',
        element: <Dashboard />,
      },
      {
        path: 'users',
        element: <Users />,
      },
      {
        path: 'tenants',
        element: <Tenants />,
      },
      {
        path: 'settings',
        element: <Settings />,
      },
      {
        path: 'audit-log',
        element: <AuditLog />,
      },
      {
        path: '*',
        element: <NotFound />,
      },
    ],
  },
];

/**
 * Create the router instance - this is created lazily in App.tsx
 * to avoid type inference issues with the remix-run router type
 */
export function getRouter(): ReturnType<typeof createBrowserRouter> {
  return createBrowserRouter(routes);
}

// Re-export from constants to avoid circular dependencies
export { ROUTES, type RoutePath } from './constants';
