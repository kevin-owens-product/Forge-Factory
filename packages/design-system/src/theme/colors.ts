/**
 * @package @forge/design-system
 * @description Color tokens
 */

import { ColorScale, SemanticColors, ThemeColors } from '../design-system.types';

/**
 * Primary color scale (blue)
 */
export const primary: ColorScale = {
  50: '#eff6ff',
  100: '#dbeafe',
  200: '#bfdbfe',
  300: '#93c5fd',
  400: '#60a5fa',
  500: '#3b82f6',
  600: '#2563eb',
  700: '#1d4ed8',
  800: '#1e40af',
  900: '#1e3a8a',
  950: '#172554',
};

/**
 * Secondary color scale (slate)
 */
export const secondary: ColorScale = {
  50: '#f8fafc',
  100: '#f1f5f9',
  200: '#e2e8f0',
  300: '#cbd5e1',
  400: '#94a3b8',
  500: '#64748b',
  600: '#475569',
  700: '#334155',
  800: '#1e293b',
  900: '#0f172a',
  950: '#020617',
};

/**
 * Success color scale (green)
 */
export const success: ColorScale = {
  50: '#f0fdf4',
  100: '#dcfce7',
  200: '#bbf7d0',
  300: '#86efac',
  400: '#4ade80',
  500: '#22c55e',
  600: '#16a34a',
  700: '#15803d',
  800: '#166534',
  900: '#14532d',
  950: '#052e16',
};

/**
 * Warning color scale (amber)
 */
export const warning: ColorScale = {
  50: '#fffbeb',
  100: '#fef3c7',
  200: '#fde68a',
  300: '#fcd34d',
  400: '#fbbf24',
  500: '#f59e0b',
  600: '#d97706',
  700: '#b45309',
  800: '#92400e',
  900: '#78350f',
  950: '#451a03',
};

/**
 * Error color scale (red)
 */
export const error: ColorScale = {
  50: '#fef2f2',
  100: '#fee2e2',
  200: '#fecaca',
  300: '#fca5a5',
  400: '#f87171',
  500: '#ef4444',
  600: '#dc2626',
  700: '#b91c1c',
  800: '#991b1b',
  900: '#7f1d1d',
  950: '#450a0a',
};

/**
 * Info color scale (cyan)
 */
export const info: ColorScale = {
  50: '#ecfeff',
  100: '#cffafe',
  200: '#a5f3fc',
  300: '#67e8f9',
  400: '#22d3ee',
  500: '#06b6d4',
  600: '#0891b2',
  700: '#0e7490',
  800: '#155e75',
  900: '#164e63',
  950: '#083344',
};

/**
 * Gray color scale
 */
export const gray: ColorScale = {
  50: '#fafafa',
  100: '#f4f4f5',
  200: '#e4e4e7',
  300: '#d4d4d8',
  400: '#a1a1aa',
  500: '#71717a',
  600: '#52525b',
  700: '#3f3f46',
  800: '#27272a',
  900: '#18181b',
  950: '#09090b',
};

/**
 * Semantic colors
 */
export const semanticColors: SemanticColors = {
  primary,
  secondary,
  success,
  warning,
  error,
  info,
  gray,
};

/**
 * Light theme colors
 */
export const lightColors: ThemeColors = {
  ...semanticColors,
  background: {
    primary: '#ffffff',
    secondary: gray[50],
    tertiary: gray[100],
  },
  foreground: {
    primary: gray[900],
    secondary: gray[700],
    muted: gray[500],
    inverse: '#ffffff',
  },
  border: {
    default: gray[200],
    muted: gray[100],
    strong: gray[300],
  },
  focus: primary[500],
  overlay: 'rgba(0, 0, 0, 0.5)',
};

/**
 * Dark theme colors
 */
export const darkColors: ThemeColors = {
  ...semanticColors,
  background: {
    primary: gray[900],
    secondary: gray[800],
    tertiary: gray[700],
  },
  foreground: {
    primary: gray[50],
    secondary: gray[200],
    muted: gray[400],
    inverse: gray[900],
  },
  border: {
    default: gray[700],
    muted: gray[800],
    strong: gray[600],
  },
  focus: primary[400],
  overlay: 'rgba(0, 0, 0, 0.7)',
};

/**
 * Get colors for a theme mode
 */
export function getThemeColors(mode: 'light' | 'dark'): ThemeColors {
  return mode === 'dark' ? darkColors : lightColors;
}
