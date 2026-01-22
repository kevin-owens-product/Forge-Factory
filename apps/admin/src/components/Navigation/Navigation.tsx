/**
 * @prompt-id forge-v4.1:feature:admin:001
 * @generated-at 2026-01-21T00:00:00Z
 * @model claude-opus-4-5
 */

import { useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTokens } from '@forge/design-system';
import type { NavItem } from '../../types';
import { ROUTES } from '../../constants';

interface NavigationProps {
  collapsed?: boolean;
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', path: ROUTES.DASHBOARD },
  { id: 'users', label: 'Users', path: ROUTES.USERS },
  { id: 'tenants', label: 'Tenants', path: ROUTES.TENANTS },
  { id: 'audit-log', label: 'Audit Log', path: ROUTES.AUDIT_LOG },
  { id: 'settings', label: 'Settings', path: ROUTES.SETTINGS },
];

export function Navigation({ collapsed = false }: NavigationProps): JSX.Element {
  const tokens = useTokens();
  const location = useLocation();

  const navStyle = useMemo<React.CSSProperties>(
    () => ({
      display: 'flex',
      flexDirection: 'column' as const,
      gap: tokens.spacing[1],
    }),
    [tokens]
  );

  const navItemStyle = useMemo<React.CSSProperties>(
    () => ({
      display: 'flex',
      alignItems: 'center',
      padding: collapsed ? tokens.spacing[3] : `${tokens.spacing[3]} ${tokens.spacing[4]}`,
      borderRadius: tokens.borderRadii.md,
      textDecoration: 'none',
      color: tokens.colors.foreground.muted,
      fontSize: tokens.typography.fontSizes.sm,
      fontWeight: tokens.typography.fontWeights.medium,
      transition: 'all 0.15s ease',
      justifyContent: collapsed ? 'center' : 'flex-start',
    }),
    [tokens, collapsed]
  );

  const activeNavItemStyle = useMemo<React.CSSProperties>(
    () => ({
      ...navItemStyle,
      color: tokens.colors.primary[600],
      backgroundColor: tokens.colors.primary[50],
    }),
    [navItemStyle, tokens]
  );

  const hoverStyle = useMemo<React.CSSProperties>(
    () => ({
      backgroundColor: tokens.colors.background.tertiary,
    }),
    [tokens]
  );

  const getNavItemStyle = (path: string): React.CSSProperties => {
    const isActive = location.pathname === path;
    return isActive ? activeNavItemStyle : navItemStyle;
  };

  const iconStyle = useMemo<React.CSSProperties>(
    () => ({
      width: '20px',
      height: '20px',
      marginRight: collapsed ? 0 : tokens.spacing[3],
      flexShrink: 0,
    }),
    [tokens, collapsed]
  );

  const getIcon = (id: string): string => {
    const icons: Record<string, string> = {
      dashboard: 'D',
      users: 'U',
      tenants: 'T',
      'audit-log': 'A',
      settings: 'S',
    };
    return icons[id] || '?';
  };

  return (
    <nav style={navStyle} data-testid="admin-navigation" aria-label="Main navigation">
      {navItems.map((item) => (
        <NavLink
          key={item.id}
          to={item.path}
          style={({ isActive }) => ({
            ...getNavItemStyle(item.path),
            ...(isActive ? {} : {}),
          })}
          onMouseEnter={(e) => {
            if (location.pathname !== item.path) {
              Object.assign(e.currentTarget.style, hoverStyle);
            }
          }}
          onMouseLeave={(e) => {
            if (location.pathname !== item.path) {
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
          data-testid={`nav-${item.id}`}
        >
          <span style={iconStyle}>{getIcon(item.id)}</span>
          {!collapsed && <span>{item.label}</span>}
        </NavLink>
      ))}
    </nav>
  );
}
