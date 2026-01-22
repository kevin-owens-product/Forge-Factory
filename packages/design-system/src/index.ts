/**
 * @package @forge/design-system
 * @description Design system component library for Forge Factory
 *
 * Features:
 * - Theme system with light/dark mode support
 * - Design tokens (colors, typography, spacing, shadows)
 * - Accessible components following WCAG 2.1 AA
 * - TypeScript-first with full type safety
 * - Responsive design utilities
 */

// Theme
export {
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
  // Spacing and other tokens
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
  // Combined tokens
  lightTokens,
  darkTokens,
  getDesignTokens,
  createTheme,
  lightTheme,
  darkTheme,
  generateCSSVariables,
  generateCSSString,
  // Theme provider
  ThemeProvider,
  useTheme,
  useTokens,
  useIsDarkMode,
  useColor,
  ThemeContext,
} from './theme';
export type { ThemeProviderProps, TextStyleKey } from './theme';

// Hooks
export {
  useMediaQuery,
  useBreakpoint,
  useBreakpointDown,
  useBreakpointBetween,
  useCurrentBreakpoint,
  useIsMobile,
  useIsTablet,
  useIsDesktop,
  usePrefersReducedMotion,
  usePrefersColorScheme,
  useResponsiveValue,
} from './hooks';
export type { BreakpointKey } from './hooks';

// Components
export {
  Button,
  Input,
  Select,
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ToastProvider,
  useToast,
  ToastContext,
} from './components';
export type { ToastProviderProps } from './components';

// Types
export type {
  // Color types
  ColorScale,
  SemanticColors,
  ThemeColors,
  // Typography types
  FontFamilies,
  FontSizes,
  FontWeights,
  LineHeights,
  LetterSpacings,
  Typography,
  // Spacing types
  SpacingScale,
  Shadows,
  BorderRadii,
  BorderWidths,
  // Animation types
  Durations,
  Easings,
  Animations,
  // Breakpoint types
  Breakpoints,
  ZIndices,
  // Theme types
  ThemeMode,
  DesignTokens,
  Theme,
  ThemeContextValue,
  // Component types
  ComponentSize,
  ComponentVariant,
  ColorScheme,
  BaseComponentProps,
  // Button types
  ButtonProps,
  // Input types
  InputProps,
  // Select types
  SelectOption,
  SelectProps,
  // Card types
  CardProps,
  CardHeaderProps,
  CardBodyProps,
  CardFooterProps,
  // Modal types
  ModalProps,
  ModalHeaderProps,
  ModalBodyProps,
  ModalFooterProps,
  // Toast types
  ToastStatus,
  ToastPosition,
  ToastConfig,
  Toast,
  ToastContextValue,
  // Utility types
  ResponsiveValue,
  StyleProps,
} from './design-system.types';
