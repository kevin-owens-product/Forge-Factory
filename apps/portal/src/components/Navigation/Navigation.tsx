/**
 * @prompt-id forge-v4.1:feature:portal:001
 * @generated-at 2026-01-21T00:00:00Z
 * @model claude-opus-4-5
 */

import { useMemo, useCallback } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTokens } from '@forge/design-system';
import { ROUTES } from '../../constants';
import type { NavItem } from '../../types';

const navigationItems: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    path: ROUTES.DASHBOARD,
  },
  {
    id: 'profile',
    label: 'Profile',
    path: ROUTES.PROFILE,
  },
  {
    id: 'settings',
    label: 'Settings',
    path: ROUTES.SETTINGS,
  },
];

interface NavItemComponentProps {
  item: NavItem;
  isActive: boolean;
}

function NavItemComponent({ item, isActive }: NavItemComponentProps): JSX.Element {
  const tokens = useTokens();

  const linkStyle = useMemo<React.CSSProperties>(
    () => ({
      display: 'flex',
      alignItems: 'center',
      padding: `${tokens.spacing[3]} ${tokens.spacing[4]}`,
      borderRadius: tokens.borderRadii.md,
      textDecoration: 'none',
      fontSize: tokens.typography.fontSizes.sm,
      fontWeight: isActive ? tokens.typography.fontWeights.semibold : tokens.typography.fontWeights.medium,
      color: isActive ? tokens.colors.primary[600] : tokens.colors.foreground.muted,
      backgroundColor: isActive ? tokens.colors.primary[50] : 'transparent',
      transition: `all ${tokens.animations.durations.fast} ${tokens.animations.easings.easeInOut}`,
    }),
    [tokens, isActive]
  );

  return (
    <NavLink to={item.path} style={linkStyle} aria-current={isActive ? 'page' : undefined}>
      {item.label}
    </NavLink>
  );
}

export function Navigation(): JSX.Element {
  const tokens = useTokens();
  const location = useLocation();

  const isActive = useCallback(
    (path: string) => {
      return location.pathname === path || (path !== '/' && location.pathname.startsWith(path));
    },
    [location.pathname]
  );

  const navStyle = useMemo<React.CSSProperties>(
    () => ({
      display: 'flex',
      flexDirection: 'column' as const,
      gap: tokens.spacing[1],
      padding: tokens.spacing[2],
    }),
    [tokens]
  );

  return (
    <nav style={navStyle} aria-label="Main navigation" data-testid="main-navigation">
      {navigationItems.map((item) => (
        <NavItemComponent key={item.id} item={item} isActive={isActive(item.path)} />
      ))}
    </nav>
  );
}
