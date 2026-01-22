/**
 * @prompt-id forge-v4.1:feature:portal:001
 * @generated-at 2026-01-21T00:00:00Z
 * @model claude-opus-4-5
 */

/**
 * Route paths for type-safe navigation
 */
export const ROUTES = {
  HOME: '/',
  DASHBOARD: '/dashboard',
  SETTINGS: '/settings',
  PROFILE: '/profile',
} as const;

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];
