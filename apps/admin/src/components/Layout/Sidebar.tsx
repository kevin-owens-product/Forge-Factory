/**
 * @prompt-id forge-v4.1:feature:admin:001
 * @generated-at 2026-01-21T00:00:00Z
 * @model claude-opus-4-5
 */

import { useMemo, useState } from 'react';
import { Button, useTokens } from '@forge/design-system';
import { Navigation } from '../Navigation';

export function Sidebar(): JSX.Element {
  const tokens = useTokens();
  const [collapsed, setCollapsed] = useState(false);

  const sidebarStyle = useMemo<React.CSSProperties>(
    () => ({
      width: collapsed ? '64px' : '240px',
      height: 'calc(100vh - 64px)',
      position: 'fixed' as const,
      top: '64px',
      left: 0,
      backgroundColor: tokens.colors.background.primary,
      borderRight: `1px solid ${tokens.colors.border.muted}`,
      overflowY: 'auto' as const,
      overflowX: 'hidden' as const,
      padding: tokens.spacing[4],
      transition: 'width 0.2s ease-in-out',
      display: 'flex',
      flexDirection: 'column' as const,
    }),
    [tokens, collapsed]
  );

  const toggleButtonContainerStyle = useMemo<React.CSSProperties>(
    () => ({
      marginTop: 'auto',
      paddingTop: tokens.spacing[4],
      borderTop: `1px solid ${tokens.colors.border.muted}`,
    }),
    [tokens]
  );

  return (
    <aside style={sidebarStyle} data-testid="admin-sidebar" role="navigation" aria-label="Admin navigation">
      <Navigation collapsed={collapsed} />
      <div style={toggleButtonContainerStyle}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{ width: '100%' }}
        >
          {collapsed ? '>' : '<'}
        </Button>
      </div>
    </aside>
  );
}
