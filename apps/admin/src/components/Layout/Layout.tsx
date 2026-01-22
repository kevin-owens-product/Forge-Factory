/**
 * @prompt-id forge-v4.1:feature:admin:001
 * @generated-at 2026-01-21T00:00:00Z
 * @model claude-opus-4-5
 */

import { useMemo } from 'react';
import { useTokens } from '@forge/design-system';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps): JSX.Element {
  const tokens = useTokens();

  const containerStyle = useMemo<React.CSSProperties>(
    () => ({
      display: 'flex',
      flexDirection: 'column' as const,
      minHeight: '100vh',
      backgroundColor: tokens.colors.background.secondary,
    }),
    [tokens]
  );

  const mainContainerStyle = useMemo<React.CSSProperties>(
    () => ({
      display: 'flex',
      flex: 1,
      marginTop: '64px',
    }),
    []
  );

  const mainContentStyle = useMemo<React.CSSProperties>(
    () => ({
      flex: 1,
      marginLeft: '240px',
      minHeight: 'calc(100vh - 64px)',
      overflow: 'auto' as const,
    }),
    []
  );

  return (
    <div style={containerStyle} data-testid="admin-layout">
      <Header />
      <div style={mainContainerStyle}>
        <Sidebar />
        <main style={mainContentStyle} role="main" aria-label="Main content">
          {children}
        </main>
      </div>
    </div>
  );
}
