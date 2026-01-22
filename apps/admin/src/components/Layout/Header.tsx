/**
 * @prompt-id forge-v4.1:feature:admin:001
 * @generated-at 2026-01-21T00:00:00Z
 * @model claude-opus-4-5
 */

import { useMemo } from 'react';
import { Button, useTokens, useTheme } from '@forge/design-system';

export function Header(): JSX.Element {
  const tokens = useTokens();
  const { mode, setMode } = useTheme();

  const headerStyle = useMemo<React.CSSProperties>(
    () => ({
      height: '64px',
      position: 'fixed' as const,
      top: 0,
      left: 0,
      right: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: `0 ${tokens.spacing[6]}`,
      backgroundColor: tokens.colors.background.primary,
      borderBottom: `1px solid ${tokens.colors.border.muted}`,
      zIndex: 100,
    }),
    [tokens]
  );

  const logoStyle = useMemo<React.CSSProperties>(
    () => ({
      display: 'flex',
      alignItems: 'center',
      gap: tokens.spacing[2],
    }),
    [tokens]
  );

  const logoTextStyle = useMemo<React.CSSProperties>(
    () => ({
      fontSize: tokens.typography.fontSizes.xl,
      fontWeight: tokens.typography.fontWeights.bold,
      color: tokens.colors.foreground.primary,
    }),
    [tokens]
  );

  const badgeStyle = useMemo<React.CSSProperties>(
    () => ({
      fontSize: tokens.typography.fontSizes.xs,
      fontWeight: tokens.typography.fontWeights.medium,
      color: tokens.colors.primary[600],
      backgroundColor: tokens.colors.primary[100],
      padding: `${tokens.spacing[0.5]} ${tokens.spacing[2]}`,
      borderRadius: tokens.borderRadii.full,
    }),
    [tokens]
  );

  const actionsStyle = useMemo<React.CSSProperties>(
    () => ({
      display: 'flex',
      alignItems: 'center',
      gap: tokens.spacing[4],
    }),
    [tokens]
  );

  const userInfoStyle = useMemo<React.CSSProperties>(
    () => ({
      display: 'flex',
      alignItems: 'center',
      gap: tokens.spacing[2],
    }),
    [tokens]
  );

  const avatarStyle = useMemo<React.CSSProperties>(
    () => ({
      width: '32px',
      height: '32px',
      borderRadius: tokens.borderRadii.full,
      backgroundColor: tokens.colors.primary[500],
      color: '#ffffff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: tokens.typography.fontSizes.sm,
      fontWeight: tokens.typography.fontWeights.medium,
    }),
    [tokens]
  );

  const userNameStyle = useMemo<React.CSSProperties>(
    () => ({
      fontSize: tokens.typography.fontSizes.sm,
      fontWeight: tokens.typography.fontWeights.medium,
      color: tokens.colors.foreground.primary,
    }),
    [tokens]
  );

  const toggleTheme = () => {
    setMode(mode === 'dark' ? 'light' : 'dark');
  };

  return (
    <header style={headerStyle} data-testid="admin-header">
      <div style={logoStyle}>
        <span style={logoTextStyle}>Forge</span>
        <span style={badgeStyle}>Admin</span>
      </div>

      <div style={actionsStyle}>
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleTheme}
          aria-label={`Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`}
        >
          {mode === 'dark' ? 'Light' : 'Dark'}
        </Button>

        <div style={userInfoStyle}>
          <div style={avatarStyle}>A</div>
          <span style={userNameStyle}>Admin User</span>
        </div>
      </div>
    </header>
  );
}
