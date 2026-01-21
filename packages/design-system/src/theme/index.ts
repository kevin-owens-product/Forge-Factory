/**
 * @package @forge/design-system
 * @description Theme exports
 */

// Colors
export {
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
} from './colors';

// Typography
export {
  fontFamilies,
  fontSizes,
  fontWeights,
  lineHeights,
  letterSpacings,
  typography,
  textStyles,
} from './typography';
export type { TextStyleKey } from './typography';

// Spacing and other tokens
export {
  spacing,
  shadows,
  borderRadii,
  borderWidths,
  durations,
  easings,
  animations,
  breakpoints,
  zIndices,
  getSpacing,
  createSpacing,
} from './spacing';

// Combined tokens
export {
  lightTokens,
  darkTokens,
  getDesignTokens,
  createTheme,
  lightTheme,
  darkTheme,
  generateCSSVariables,
  generateCSSString,
} from './tokens';

// Theme provider
export {
  ThemeProvider,
  useTheme,
  useTokens,
  useIsDarkMode,
  useColor,
  ThemeContext,
} from './ThemeProvider';
export type { ThemeProviderProps } from './ThemeProvider';
