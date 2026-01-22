/**
 * @prompt-id forge-v4.1:feature:portal:001
 * @generated-at 2026-01-21T00:00:00Z
 * @model claude-opus-4-5
 */

/**
 * User type for the portal
 */
export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: 'user' | 'admin';
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Authentication state
 */
export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  error: string | null;
}

/**
 * Navigation item type
 */
export interface NavItem {
  id: string;
  label: string;
  path: string;
  icon?: React.ReactNode;
  badge?: string | number;
  children?: NavItem[];
}

/**
 * Page meta information
 */
export interface PageMeta {
  title: string;
  description?: string;
}

/**
 * Theme preference
 */
export type ThemePreference = 'light' | 'dark' | 'system';

/**
 * Portal configuration
 */
export interface PortalConfig {
  appName: string;
  logoUrl?: string;
  supportEmail?: string;
  features: {
    darkMode: boolean;
    notifications: boolean;
    realtime: boolean;
  };
}

/**
 * Notification type
 */
export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
}
