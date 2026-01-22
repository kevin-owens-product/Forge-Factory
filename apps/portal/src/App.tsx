/**
 * @prompt-id forge-v4.1:feature:portal:001
 * @generated-at 2026-01-21T00:00:00Z
 * @model claude-opus-4-5
 */

import { useMemo } from 'react';
import { RouterProvider } from 'react-router-dom';
import { ThemeProvider } from '@forge/design-system';
import { getRouter } from './routes';

/**
 * Portal application root component
 * Provides theme, i18n, feature flags, and routing
 */
export function App(): JSX.Element {
  const router = useMemo(() => getRouter(), []);

  return (
    <ThemeProvider defaultMode="system">
      <RouterProvider router={router} />
    </ThemeProvider>
  );
}
