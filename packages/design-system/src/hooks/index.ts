/**
 * @package @forge/design-system
 * @description Hook exports
 */

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
} from './useMediaQuery';
export type { BreakpointKey } from './useMediaQuery';

// Re-export theme hooks
export { useTheme, useTokens, useIsDarkMode, useColor } from '../theme/ThemeProvider';
