/**
 * @prompt-id forge-v4.1:feature:portal:001
 * @generated-at 2026-01-21T00:00:00Z
 * @model claude-opus-4-5
 */

import { useMemo } from 'react';
import { useTokens } from '@forge/design-system';
import { Navigation } from '../Navigation';

export function Sidebar(): JSX.Element {
  const tokens = useTokens();

  const sidebarStyle = useMemo<React.CSSProperties>(
    () => ({
      width: '240px',
      height: 'calc(100vh - 64px)',
      position: 'fixed' as const,
      top: '64px',
      left: 0,
      backgroundColor: tokens.colors.background.primary,
      borderRight: `1px solid ${tokens.colors.border.muted}`,
      overflowY: 'auto' as const,
      padding: tokens.spacing[4],
    }),
    [tokens]
  );

  return (
    <aside style={sidebarStyle} data-testid="app-sidebar" role="navigation" aria-label="Sidebar navigation">
      <Navigation />
    </aside>
  );
}
