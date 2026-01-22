/**
 * @prompt-id forge-v4.1:feature:portal:001
 * @generated-at 2026-01-21T00:00:00Z
 * @model claude-opus-4-5
 */

import { useMemo, useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, useTokens, useTheme, useIsMobile } from '@forge/design-system';
import { ROUTES } from '../../constants';

export function Header(): JSX.Element {
  const tokens = useTokens();
  const { mode, setMode } = useTheme();
  const isMobile = useIsMobile();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleTheme = useCallback(() => {
    setMode(mode === 'dark' ? 'light' : 'dark');
  }, [mode, setMode]);

  const toggleMenu = useCallback(() => {
    setIsMenuOpen((prev) => !prev);
  }, []);

  const headerStyle = useMemo<React.CSSProperties>(
    () => ({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: '64px',
      padding: `0 ${tokens.spacing[6]}`,
      backgroundColor: tokens.colors.background.primary,
      borderBottom: `1px solid ${tokens.colors.border.muted}`,
      position: 'fixed' as const,
      top: 0,
      left: 0,
      right: 0,
      zIndex: tokens.zIndices.sticky,
    }),
    [tokens]
  );

  const logoStyle = useMemo<React.CSSProperties>(
    () => ({
      fontSize: tokens.typography.fontSizes.xl,
      fontWeight: tokens.typography.fontWeights.bold,
      color: tokens.colors.primary[600],
      textDecoration: 'none',
    }),
    [tokens]
  );

  const actionsStyle = useMemo<React.CSSProperties>(
    () => ({
      display: 'flex',
      alignItems: 'center',
      gap: tokens.spacing[3],
    }),
    [tokens]
  );

  const themeIcon = mode === 'dark' ? '☀️' : '🌙';

  return (
    <header style={headerStyle} data-testid="app-header" role="banner">
      <Link to={ROUTES.DASHBOARD} style={logoStyle} aria-label="Forge Portal Home">
        Forge Portal
      </Link>
      <div style={actionsStyle}>
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleTheme}
          aria-label={`Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`}
          testId="theme-toggle-button"
        >
          {themeIcon}
        </Button>
        {isMobile && (
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleMenu}
            aria-label="Toggle navigation menu"
            aria-expanded={isMenuOpen}
            testId="menu-toggle-button"
          >
            ☰
          </Button>
        )}
      </div>
    </header>
  );
}
