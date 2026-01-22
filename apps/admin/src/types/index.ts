/**
 * @prompt-id forge-v4.1:feature:admin:001
 * @generated-at 2026-01-21T00:00:00Z
 * @model claude-opus-4-5
 */

/**
 * Admin user type
 */
export interface AdminUser {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: 'super_admin' | 'admin' | 'moderator';
  tenantId: string;
  permissions: string[];
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User for management (all users in the system)
 */
export interface ManagedUser {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: string;
  tenantId: string;
  status: 'active' | 'suspended' | 'pending' | 'inactive';
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Tenant type
 */
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: 'free' | 'starter' | 'professional' | 'enterprise';
  status: 'active' | 'suspended' | 'trial' | 'cancelled';
  userCount: number;
  storageUsed: number;
  storageLimit: number;
  features: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Authentication state
 */
export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AdminUser | null;
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
  requiredPermission?: string;
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
 * Admin configuration
 */
export interface AdminConfig {
  appName: string;
  logoUrl?: string;
  supportEmail?: string;
  features: {
    darkMode: boolean;
    notifications: boolean;
    realtime: boolean;
    auditLog: boolean;
    userManagement: boolean;
    tenantManagement: boolean;
  };
}

/**
 * Data table column definition
 */
export interface TableColumn<T> {
  id: string;
  header: string;
  accessor: keyof T | ((row: T) => React.ReactNode);
  sortable?: boolean;
  width?: string | number;
  align?: 'left' | 'center' | 'right';
}

/**
 * Pagination state
 */
export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
}

/**
 * Sort state
 */
export interface SortState {
  column: string | null;
  direction: 'asc' | 'desc';
}

/**
 * Filter state
 */
export interface FilterState {
  search: string;
  filters: Record<string, string | string[] | boolean | number>;
}

/**
 * Dashboard statistics
 */
export interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalTenants: number;
  activeTenants: number;
  totalStorage: number;
  usedStorage: number;
  recentEvents: number;
  systemHealth: 'healthy' | 'degraded' | 'critical';
}

/**
 * System setting
 */
export interface SystemSetting {
  id: string;
  key: string;
  value: string | number | boolean;
  type: 'string' | 'number' | 'boolean' | 'json';
  category: string;
  description?: string;
  isSecret: boolean;
  updatedAt: Date;
  updatedBy?: string;
}

/**
 * Audit log entry for display
 */
export interface AuditLogEntry {
  id: string;
  type: string;
  subtype?: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  outcome: 'SUCCESS' | 'FAILURE' | 'PARTIAL' | 'UNKNOWN';
  actor: {
    id: string;
    type: string;
    name?: string;
    email?: string;
  };
  action: string;
  message?: string;
  tenantId: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}
