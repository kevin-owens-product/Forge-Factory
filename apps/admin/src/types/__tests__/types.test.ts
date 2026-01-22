/**
 * @prompt-id forge-v4.1:feature:admin:001
 * @generated-at 2026-01-21T00:00:00Z
 * @model claude-opus-4-5
 */

import { describe, it, expect } from 'vitest';
import type {
  AdminUser,
  ManagedUser,
  Tenant,
  AuthState,
  NavItem,
  PageMeta,
  ThemePreference,
  AdminConfig,
  TableColumn,
  PaginationState,
  SortState,
  FilterState,
  DashboardStats,
  SystemSetting,
  AuditLogEntry,
} from '../index';

describe('Type definitions', () => {
  it('should allow creating AdminUser objects', () => {
    const user: AdminUser = {
      id: 'admin-1',
      email: 'admin@example.com',
      name: 'Admin User',
      role: 'super_admin',
      tenantId: 'tenant-1',
      permissions: ['users:read', 'users:write'],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(user.id).toBe('admin-1');
    expect(user.role).toBe('super_admin');
  });

  it('should allow creating ManagedUser objects', () => {
    const user: ManagedUser = {
      id: 'user-1',
      email: 'user@example.com',
      name: 'Test User',
      role: 'user',
      tenantId: 'tenant-1',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(user.status).toBe('active');
  });

  it('should allow creating Tenant objects', () => {
    const tenant: Tenant = {
      id: 'tenant-1',
      name: 'Test Tenant',
      slug: 'test',
      plan: 'professional',
      status: 'active',
      userCount: 10,
      storageUsed: 1000000,
      storageLimit: 10000000,
      features: ['sso', 'audit'],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(tenant.plan).toBe('professional');
  });

  it('should allow creating AuthState objects', () => {
    const authState: AuthState = {
      isAuthenticated: true,
      isLoading: false,
      user: null,
      error: null,
    };
    expect(authState.isAuthenticated).toBe(true);
  });

  it('should allow creating NavItem objects', () => {
    const navItem: NavItem = {
      id: 'dashboard',
      label: 'Dashboard',
      path: '/dashboard',
    };
    expect(navItem.path).toBe('/dashboard');
  });

  it('should allow creating nested NavItem objects', () => {
    const navItem: NavItem = {
      id: 'admin',
      label: 'Admin',
      path: '/admin',
      children: [
        { id: 'users', label: 'Users', path: '/admin/users' },
        { id: 'settings', label: 'Settings', path: '/admin/settings' },
      ],
    };
    expect(navItem.children).toHaveLength(2);
  });

  it('should allow creating PageMeta objects', () => {
    const meta: PageMeta = {
      title: 'Dashboard',
      description: 'Admin dashboard',
    };
    expect(meta.title).toBe('Dashboard');
  });

  it('should allow ThemePreference values', () => {
    const preferences: ThemePreference[] = ['light', 'dark', 'system'];
    expect(preferences).toContain('light');
    expect(preferences).toContain('dark');
    expect(preferences).toContain('system');
  });

  it('should allow creating AdminConfig objects', () => {
    const config: AdminConfig = {
      appName: 'Forge Admin',
      features: {
        darkMode: true,
        notifications: true,
        realtime: true,
        auditLog: true,
        userManagement: true,
        tenantManagement: true,
      },
    };
    expect(config.features.darkMode).toBe(true);
  });

  it('should allow creating TableColumn objects', () => {
    const column: TableColumn<{ name: string }> = {
      id: 'name',
      header: 'Name',
      accessor: 'name',
      sortable: true,
    };
    expect(column.sortable).toBe(true);
  });

  it('should allow creating TableColumn with function accessor', () => {
    const column: TableColumn<{ name: string; age: number }> = {
      id: 'combined',
      header: 'Combined',
      accessor: (row) => `${row.name} (${row.age})`,
    };
    expect(typeof column.accessor).toBe('function');
  });

  it('should allow creating PaginationState objects', () => {
    const pagination: PaginationState = {
      page: 1,
      pageSize: 25,
      total: 100,
    };
    expect(pagination.page).toBe(1);
  });

  it('should allow creating SortState objects', () => {
    const sort: SortState = {
      column: 'name',
      direction: 'asc',
    };
    expect(sort.direction).toBe('asc');
  });

  it('should allow creating FilterState objects', () => {
    const filter: FilterState = {
      search: 'test',
      filters: {
        status: 'active',
        role: ['admin', 'user'],
      },
    };
    expect(filter.search).toBe('test');
  });

  it('should allow creating DashboardStats objects', () => {
    const stats: DashboardStats = {
      totalUsers: 1000,
      activeUsers: 800,
      totalTenants: 50,
      activeTenants: 45,
      totalStorage: 1000000000,
      usedStorage: 500000000,
      recentEvents: 100,
      systemHealth: 'healthy',
    };
    expect(stats.systemHealth).toBe('healthy');
  });

  it('should allow creating SystemSetting objects', () => {
    const setting: SystemSetting = {
      id: 'setting-1',
      key: 'app.name',
      value: 'Forge',
      type: 'string',
      category: 'general',
      isSecret: false,
      updatedAt: new Date(),
    };
    expect(setting.type).toBe('string');
  });

  it('should allow creating AuditLogEntry objects', () => {
    const entry: AuditLogEntry = {
      id: 'event-1',
      type: 'AUTH',
      severity: 'LOW',
      outcome: 'SUCCESS',
      actor: {
        id: 'user-1',
        type: 'USER',
        name: 'Test User',
      },
      action: 'User logged in',
      tenantId: 'tenant-1',
      timestamp: new Date(),
    };
    expect(entry.severity).toBe('LOW');
  });
});
