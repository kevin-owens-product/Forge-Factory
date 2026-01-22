/**
 * @prompt-id forge-v4.1:feature:portal:001
 * @generated-at 2026-01-21T00:00:00Z
 * @model claude-opus-4-5
 */

import { describe, it, expect } from 'vitest';
import { ROUTES, routes } from './routes';

describe('ROUTES', () => {
  it('should have HOME route', () => {
    expect(ROUTES.HOME).toBe('/');
  });

  it('should have DASHBOARD route', () => {
    expect(ROUTES.DASHBOARD).toBe('/dashboard');
  });

  it('should have SETTINGS route', () => {
    expect(ROUTES.SETTINGS).toBe('/settings');
  });

  it('should have PROFILE route', () => {
    expect(ROUTES.PROFILE).toBe('/profile');
  });
});

describe('routes configuration', () => {
  it('should have root route', () => {
    expect(routes[0].path).toBe('/');
  });

  it('should have child routes', () => {
    const rootRoute = routes[0];
    expect(rootRoute.children).toBeDefined();
    expect(rootRoute.children?.length).toBeGreaterThan(0);
  });

  it('should have index redirect', () => {
    const rootRoute = routes[0];
    const indexRoute = rootRoute.children?.find((r) => r.index);
    expect(indexRoute).toBeDefined();
  });

  it('should have dashboard route', () => {
    const rootRoute = routes[0];
    const dashboardRoute = rootRoute.children?.find((r) => r.path === 'dashboard');
    expect(dashboardRoute).toBeDefined();
  });

  it('should have settings route', () => {
    const rootRoute = routes[0];
    const settingsRoute = rootRoute.children?.find((r) => r.path === 'settings');
    expect(settingsRoute).toBeDefined();
  });

  it('should have profile route', () => {
    const rootRoute = routes[0];
    const profileRoute = rootRoute.children?.find((r) => r.path === 'profile');
    expect(profileRoute).toBeDefined();
  });

  it('should have catch-all 404 route', () => {
    const rootRoute = routes[0];
    const notFoundRoute = rootRoute.children?.find((r) => r.path === '*');
    expect(notFoundRoute).toBeDefined();
  });
});
