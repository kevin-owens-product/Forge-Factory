/**
 * @prompt-id forge-v4.1:feature:portal:001
 * @generated-at 2026-01-21T00:00:00Z
 * @model claude-opus-4-5
 */

import { describe, it, expect } from 'vitest';
import type { User, AuthState, NavItem, PageMeta, ThemePreference, PortalConfig, Notification } from '../index';

describe('Type Definitions', () => {
  describe('User', () => {
    it('should allow valid user object', () => {
      const user: User = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        tenantId: 'tenant-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(user.id).toBe('user-1');
      expect(user.role).toBe('user');
    });

    it('should allow optional avatar', () => {
      const user: User = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        avatar: 'https://example.com/avatar.png',
        role: 'admin',
        tenantId: 'tenant-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(user.avatar).toBe('https://example.com/avatar.png');
    });
  });

  describe('AuthState', () => {
    it('should allow authenticated state', () => {
      const state: AuthState = {
        isAuthenticated: true,
        isLoading: false,
        user: {
          id: 'user-1',
          email: 'test@example.com',
          name: 'Test User',
          role: 'user',
          tenantId: 'tenant-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        error: null,
      };

      expect(state.isAuthenticated).toBe(true);
      expect(state.user).not.toBeNull();
    });

    it('should allow unauthenticated state', () => {
      const state: AuthState = {
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: null,
      };

      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
    });

    it('should allow error state', () => {
      const state: AuthState = {
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: 'Invalid credentials',
      };

      expect(state.error).toBe('Invalid credentials');
    });
  });

  describe('NavItem', () => {
    it('should allow basic nav item', () => {
      const item: NavItem = {
        id: 'dashboard',
        label: 'Dashboard',
        path: '/dashboard',
      };

      expect(item.id).toBe('dashboard');
      expect(item.path).toBe('/dashboard');
    });

    it('should allow nav item with badge', () => {
      const item: NavItem = {
        id: 'notifications',
        label: 'Notifications',
        path: '/notifications',
        badge: 5,
      };

      expect(item.badge).toBe(5);
    });

    it('should allow nested nav items', () => {
      const item: NavItem = {
        id: 'settings',
        label: 'Settings',
        path: '/settings',
        children: [
          { id: 'profile', label: 'Profile', path: '/settings/profile' },
          { id: 'account', label: 'Account', path: '/settings/account' },
        ],
      };

      expect(item.children).toHaveLength(2);
    });
  });

  describe('PageMeta', () => {
    it('should allow basic page meta', () => {
      const meta: PageMeta = {
        title: 'Dashboard',
      };

      expect(meta.title).toBe('Dashboard');
    });

    it('should allow page meta with description', () => {
      const meta: PageMeta = {
        title: 'Dashboard',
        description: 'Overview of your account',
      };

      expect(meta.description).toBe('Overview of your account');
    });
  });

  describe('ThemePreference', () => {
    it('should allow light theme', () => {
      const theme: ThemePreference = 'light';
      expect(theme).toBe('light');
    });

    it('should allow dark theme', () => {
      const theme: ThemePreference = 'dark';
      expect(theme).toBe('dark');
    });

    it('should allow system theme', () => {
      const theme: ThemePreference = 'system';
      expect(theme).toBe('system');
    });
  });

  describe('PortalConfig', () => {
    it('should allow basic config', () => {
      const config: PortalConfig = {
        appName: 'Forge Portal',
        features: {
          darkMode: true,
          notifications: true,
          realtime: false,
        },
      };

      expect(config.appName).toBe('Forge Portal');
      expect(config.features.darkMode).toBe(true);
    });

    it('should allow optional fields', () => {
      const config: PortalConfig = {
        appName: 'Forge Portal',
        logoUrl: 'https://example.com/logo.png',
        supportEmail: 'support@example.com',
        features: {
          darkMode: true,
          notifications: true,
          realtime: true,
        },
      };

      expect(config.logoUrl).toBe('https://example.com/logo.png');
      expect(config.supportEmail).toBe('support@example.com');
    });
  });

  describe('Notification', () => {
    it('should allow notification object', () => {
      const notification: Notification = {
        id: 'notif-1',
        type: 'info',
        title: 'New Message',
        message: 'You have a new message',
        read: false,
        createdAt: new Date(),
      };

      expect(notification.type).toBe('info');
      expect(notification.read).toBe(false);
    });

    it('should allow all notification types', () => {
      const types: Notification['type'][] = ['info', 'success', 'warning', 'error'];

      types.forEach((type) => {
        const notification: Notification = {
          id: 'notif-1',
          type,
          title: 'Test',
          message: 'Test message',
          read: true,
          createdAt: new Date(),
        };

        expect(notification.type).toBe(type);
      });
    });
  });
});
