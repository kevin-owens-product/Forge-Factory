/**
 * @package @forge/design-system
 * @description Tests for theme system
 */

import { describe, it, expect } from 'vitest';
import {
  // Colors
  primary,
  secondary,
  success,
  warning,
  error,
  info,
  gray,
  semanticColors,
  lightColors,
  darkColors,
  getThemeColors,
  // Typography
  fontFamilies,
  fontSizes,
  fontWeights,
  lineHeights,
  letterSpacings,
  typography,
  textStyles,
  // Spacing
  spacing,
  shadows,
  borderRadii,
  borderWidths,
  animations,
  breakpoints,
  zIndices,
  getSpacing,
  createSpacing,
  // Tokens
  lightTokens,
  darkTokens,
  getDesignTokens,
  createTheme,
  lightTheme,
  darkTheme,
  generateCSSVariables,
  generateCSSString,
} from '../theme';

describe('Colors', () => {
  describe('color scales', () => {
    it('should have all shades for primary', () => {
      expect(primary).toHaveProperty('50');
      expect(primary).toHaveProperty('500');
      expect(primary).toHaveProperty('950');
    });

    it('should have all shades for all semantic colors', () => {
      const colors = [primary, secondary, success, warning, error, info, gray];
      for (const color of colors) {
        expect(Object.keys(color)).toHaveLength(11);
        expect(color[500]).toBeDefined();
      }
    });

    it('should export semanticColors', () => {
      expect(semanticColors.primary).toBe(primary);
      expect(semanticColors.secondary).toBe(secondary);
      expect(semanticColors.success).toBe(success);
      expect(semanticColors.warning).toBe(warning);
      expect(semanticColors.error).toBe(error);
      expect(semanticColors.info).toBe(info);
      expect(semanticColors.gray).toBe(gray);
    });
  });

  describe('theme colors', () => {
    it('should have light theme colors', () => {
      expect(lightColors.background.primary).toBe('#ffffff');
      expect(lightColors.foreground.primary).toBe(gray[900]);
      expect(lightColors.border.default).toBe(gray[200]);
    });

    it('should have dark theme colors', () => {
      expect(darkColors.background.primary).toBe(gray[900]);
      expect(darkColors.foreground.primary).toBe(gray[50]);
      expect(darkColors.border.default).toBe(gray[700]);
    });

    it('should get theme colors by mode', () => {
      expect(getThemeColors('light')).toBe(lightColors);
      expect(getThemeColors('dark')).toBe(darkColors);
    });
  });
});

describe('Typography', () => {
  describe('font families', () => {
    it('should have sans, serif, and mono', () => {
      expect(fontFamilies.sans).toContain('sans-serif');
      expect(fontFamilies.serif).toContain('serif');
      expect(fontFamilies.mono).toContain('monospace');
    });
  });

  describe('font sizes', () => {
    it('should have all size keys', () => {
      expect(fontSizes.xs).toBe('0.75rem');
      expect(fontSizes.base).toBe('1rem');
      expect(fontSizes['5xl']).toBe('3rem');
    });
  });

  describe('font weights', () => {
    it('should have all weight values', () => {
      expect(fontWeights.thin).toBe(100);
      expect(fontWeights.normal).toBe(400);
      expect(fontWeights.bold).toBe(700);
    });
  });

  describe('line heights', () => {
    it('should have all line height values', () => {
      expect(lineHeights.none).toBe(1);
      expect(lineHeights.normal).toBe(1.5);
      expect(lineHeights.loose).toBe(2);
    });
  });

  describe('letter spacings', () => {
    it('should have all letter spacing values', () => {
      expect(letterSpacings.tighter).toBe('-0.05em');
      expect(letterSpacings.normal).toBe('0');
      expect(letterSpacings.widest).toBe('0.1em');
    });
  });

  describe('typography object', () => {
    it('should contain all typography tokens', () => {
      expect(typography.fontFamilies).toBe(fontFamilies);
      expect(typography.fontSizes).toBe(fontSizes);
      expect(typography.fontWeights).toBe(fontWeights);
      expect(typography.lineHeights).toBe(lineHeights);
      expect(typography.letterSpacings).toBe(letterSpacings);
    });
  });

  describe('text styles', () => {
    it('should have heading styles', () => {
      expect(textStyles.h1.fontSize).toBe(fontSizes['5xl']);
      expect(textStyles.h1.fontWeight).toBe(fontWeights.bold);
    });

    it('should have body styles', () => {
      expect(textStyles.body1.fontSize).toBe(fontSizes.base);
      expect(textStyles.body2.fontSize).toBe(fontSizes.sm);
    });

    it('should have code style', () => {
      expect(textStyles.code.fontFamily).toBe(fontFamilies.mono);
    });
  });
});

describe('Spacing', () => {
  describe('spacing scale', () => {
    it('should have base spacing values', () => {
      expect(spacing[0]).toBe('0');
      expect(spacing[1]).toBe('0.25rem');
      expect(spacing[4]).toBe('1rem');
    });

    it('should have fractional spacing values', () => {
      expect(spacing[0.5]).toBe('0.125rem');
      expect(spacing[1.5]).toBe('0.375rem');
    });

    it('should have large spacing values', () => {
      expect(spacing[48]).toBe('12rem');
      expect(spacing[96]).toBe('24rem');
    });
  });

  describe('getSpacing', () => {
    it('should return spacing value', () => {
      expect(getSpacing(4)).toBe('1rem');
      expect(getSpacing(8)).toBe('2rem');
    });
  });

  describe('createSpacing', () => {
    it('should create custom spacing', () => {
      expect(createSpacing(4)).toBe('1rem');
      expect(createSpacing(8)).toBe('2rem');
      expect(createSpacing(1)).toBe('0.25rem');
    });
  });
});

describe('Shadows', () => {
  it('should have all shadow values', () => {
    expect(shadows.none).toBe('none');
    expect(shadows.sm).toContain('rgb');
    expect(shadows.md).toContain('rgb');
    expect(shadows.inner).toContain('inset');
  });
});

describe('Border radii', () => {
  it('should have all radius values', () => {
    expect(borderRadii.none).toBe('0');
    expect(borderRadii.sm).toBe('0.125rem');
    expect(borderRadii.full).toBe('9999px');
  });
});

describe('Border widths', () => {
  it('should have all width values', () => {
    expect(borderWidths[0]).toBe('0');
    expect(borderWidths[1]).toBe('1px');
    expect(borderWidths[8]).toBe('8px');
  });
});

describe('Animations', () => {
  it('should have durations', () => {
    expect(animations.durations.fastest).toBe('50ms');
    expect(animations.durations.normal).toBe('150ms');
    expect(animations.durations.slowest).toBe('300ms');
  });

  it('should have easings', () => {
    expect(animations.easings.linear).toBe('linear');
    expect(animations.easings.easeInOut).toContain('cubic-bezier');
  });
});

describe('Breakpoints', () => {
  it('should have all breakpoint values', () => {
    expect(breakpoints.xs).toBe('0px');
    expect(breakpoints.sm).toBe('640px');
    expect(breakpoints.md).toBe('768px');
    expect(breakpoints.lg).toBe('1024px');
    expect(breakpoints.xl).toBe('1280px');
    expect(breakpoints['2xl']).toBe('1536px');
  });
});

describe('Z-indices', () => {
  it('should have all z-index values', () => {
    expect(zIndices.hide).toBe(-1);
    expect(zIndices.base).toBe(0);
    expect(zIndices.modal).toBe(1400);
    expect(zIndices.toast).toBe(1700);
  });

  it('should have increasing values for overlay levels', () => {
    expect(zIndices.dropdown).toBeLessThan(zIndices.modal);
    expect(zIndices.modal).toBeLessThan(zIndices.toast);
  });
});

describe('Design Tokens', () => {
  describe('light and dark tokens', () => {
    it('should have complete light tokens', () => {
      expect(lightTokens.colors).toBe(lightColors);
      expect(lightTokens.typography).toBe(typography);
      expect(lightTokens.spacing).toBe(spacing);
      expect(lightTokens.shadows).toBe(shadows);
    });

    it('should have complete dark tokens', () => {
      expect(darkTokens.colors).toBe(darkColors);
      expect(darkTokens.typography).toBe(typography);
      expect(darkTokens.spacing).toBe(spacing);
    });
  });

  describe('getDesignTokens', () => {
    it('should return light tokens for light mode', () => {
      expect(getDesignTokens('light')).toBe(lightTokens);
    });

    it('should return dark tokens for dark mode', () => {
      expect(getDesignTokens('dark')).toBe(darkTokens);
    });
  });

  describe('createTheme', () => {
    it('should create light theme', () => {
      const theme = createTheme('light');
      expect(theme.mode).toBe('light');
      expect(theme.tokens).toBe(lightTokens);
    });

    it('should create dark theme', () => {
      const theme = createTheme('dark');
      expect(theme.mode).toBe('dark');
      expect(theme.tokens).toBe(darkTokens);
    });

    it('should default to light for system mode', () => {
      const theme = createTheme('system');
      expect(theme.mode).toBe('system');
      expect(theme.tokens).toBe(lightTokens);
    });
  });

  describe('pre-created themes', () => {
    it('should have light theme', () => {
      expect(lightTheme.mode).toBe('light');
      expect(lightTheme.tokens).toBe(lightTokens);
    });

    it('should have dark theme', () => {
      expect(darkTheme.mode).toBe('dark');
      expect(darkTheme.tokens).toBe(darkTokens);
    });
  });
});

describe('CSS Variables', () => {
  describe('generateCSSVariables', () => {
    it('should generate color variables', () => {
      const vars = generateCSSVariables(lightTokens);
      expect(vars['--color-primary-500']).toBe(primary[500]);
      expect(vars['--color-gray-900']).toBe(gray[900]);
    });

    it('should generate background variables', () => {
      const vars = generateCSSVariables(lightTokens);
      expect(vars['--color-bg-primary']).toBe(lightColors.background.primary);
    });

    it('should generate foreground variables', () => {
      const vars = generateCSSVariables(lightTokens);
      expect(vars['--color-fg-primary']).toBe(lightColors.foreground.primary);
    });

    it('should generate font variables', () => {
      const vars = generateCSSVariables(lightTokens);
      expect(vars['--font-sans']).toBe(fontFamilies.sans);
      expect(vars['--font-size-base']).toBe(fontSizes.base);
    });

    it('should generate spacing variables', () => {
      const vars = generateCSSVariables(lightTokens);
      expect(vars['--spacing-4']).toBe(spacing[4]);
    });

    it('should generate shadow variables', () => {
      const vars = generateCSSVariables(lightTokens);
      expect(vars['--shadow-md']).toBe(shadows.md);
    });

    it('should generate z-index variables', () => {
      const vars = generateCSSVariables(lightTokens);
      expect(vars['--z-modal']).toBe(String(zIndices.modal));
    });
  });

  describe('generateCSSString', () => {
    it('should generate valid CSS', () => {
      const css = generateCSSString(lightTokens);
      expect(css).toContain(':root {');
      expect(css).toContain('--color-primary-500:');
      expect(css).toContain('}');
    });
  });
});
