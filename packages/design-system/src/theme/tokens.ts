/**
 * @package @forge/design-system
 * @description Design tokens configuration
 */

import { DesignTokens, Theme, ThemeMode } from '../design-system.types';
import { lightColors, darkColors, getThemeColors } from './colors';
import { typography } from './typography';
import {
  spacing,
  shadows,
  borderRadii,
  borderWidths,
  animations,
  breakpoints,
  zIndices,
} from './spacing';

/**
 * Light theme tokens
 */
export const lightTokens: DesignTokens = {
  colors: lightColors,
  typography,
  spacing,
  shadows,
  borderRadii,
  borderWidths,
  animations,
  breakpoints,
  zIndices,
};

/**
 * Dark theme tokens
 */
export const darkTokens: DesignTokens = {
  colors: darkColors,
  typography,
  spacing,
  shadows,
  borderRadii,
  borderWidths,
  animations,
  breakpoints,
  zIndices,
};

/**
 * Get design tokens for a theme mode
 */
export function getDesignTokens(mode: 'light' | 'dark'): DesignTokens {
  return mode === 'dark' ? darkTokens : lightTokens;
}

/**
 * Create a theme configuration
 */
export function createTheme(mode: ThemeMode): Theme {
  const resolvedMode = mode === 'system' ? 'light' : mode;
  return {
    mode,
    tokens: getDesignTokens(resolvedMode),
  };
}

/**
 * Default light theme
 */
export const lightTheme: Theme = createTheme('light');

/**
 * Default dark theme
 */
export const darkTheme: Theme = createTheme('dark');

/**
 * CSS custom properties for design tokens
 */
export function generateCSSVariables(tokens: DesignTokens): Record<string, string> {
  const variables: Record<string, string> = {};

  // Colors
  const colorKeys = ['primary', 'secondary', 'success', 'warning', 'error', 'info', 'gray'] as const;
  for (const colorKey of colorKeys) {
    const scale = tokens.colors[colorKey];
    for (const [shade, value] of Object.entries(scale)) {
      variables[`--color-${colorKey}-${shade}`] = value;
    }
  }

  // Background colors
  variables['--color-bg-primary'] = tokens.colors.background.primary;
  variables['--color-bg-secondary'] = tokens.colors.background.secondary;
  variables['--color-bg-tertiary'] = tokens.colors.background.tertiary;

  // Foreground colors
  variables['--color-fg-primary'] = tokens.colors.foreground.primary;
  variables['--color-fg-secondary'] = tokens.colors.foreground.secondary;
  variables['--color-fg-muted'] = tokens.colors.foreground.muted;
  variables['--color-fg-inverse'] = tokens.colors.foreground.inverse;

  // Border colors
  variables['--color-border-default'] = tokens.colors.border.default;
  variables['--color-border-muted'] = tokens.colors.border.muted;
  variables['--color-border-strong'] = tokens.colors.border.strong;

  // Focus and overlay
  variables['--color-focus'] = tokens.colors.focus;
  variables['--color-overlay'] = tokens.colors.overlay;

  // Font families
  variables['--font-sans'] = tokens.typography.fontFamilies.sans;
  variables['--font-serif'] = tokens.typography.fontFamilies.serif;
  variables['--font-mono'] = tokens.typography.fontFamilies.mono;

  // Font sizes
  for (const [key, value] of Object.entries(tokens.typography.fontSizes)) {
    variables[`--font-size-${key}`] = value;
  }

  // Spacing
  for (const [key, value] of Object.entries(tokens.spacing)) {
    const sanitizedKey = String(key).replace('.', '-');
    variables[`--spacing-${sanitizedKey}`] = value;
  }

  // Shadows
  for (const [key, value] of Object.entries(tokens.shadows)) {
    variables[`--shadow-${key}`] = value;
  }

  // Border radii
  for (const [key, value] of Object.entries(tokens.borderRadii)) {
    variables[`--radius-${key}`] = value;
  }

  // Durations
  for (const [key, value] of Object.entries(tokens.animations.durations)) {
    variables[`--duration-${key}`] = value;
  }

  // Easings
  for (const [key, value] of Object.entries(tokens.animations.easings)) {
    variables[`--easing-${key}`] = value;
  }

  // Z-indices
  for (const [key, value] of Object.entries(tokens.zIndices)) {
    variables[`--z-${key}`] = String(value);
  }

  return variables;
}

/**
 * Generate CSS string from tokens
 */
export function generateCSSString(tokens: DesignTokens): string {
  const variables = generateCSSVariables(tokens);
  const lines = Object.entries(variables).map(([key, value]) => `  ${key}: ${value};`);
  return `:root {\n${lines.join('\n')}\n}`;
}
