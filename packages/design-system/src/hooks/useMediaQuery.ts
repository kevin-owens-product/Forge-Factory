/**
 * @package @forge/design-system
 * @description Media query hook
 */

import { useState, useEffect } from 'react';
import { breakpoints } from '../theme/spacing';

/**
 * Breakpoint keys
 */
export type BreakpointKey = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

/**
 * Hook to subscribe to a media query
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia(query);
    setMatches(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [query]);

  return matches;
}

/**
 * Hook to check if viewport is above a breakpoint
 */
export function useBreakpoint(breakpoint: BreakpointKey): boolean {
  const minWidth = breakpoints[breakpoint];
  return useMediaQuery(`(min-width: ${minWidth})`);
}

/**
 * Hook to check if viewport is below a breakpoint
 */
export function useBreakpointDown(breakpoint: BreakpointKey): boolean {
  const minWidth = breakpoints[breakpoint];
  return useMediaQuery(`(max-width: calc(${minWidth} - 1px))`);
}

/**
 * Hook to check if viewport is between two breakpoints
 */
export function useBreakpointBetween(
  lower: BreakpointKey,
  upper: BreakpointKey
): boolean {
  const lowerWidth = breakpoints[lower];
  const upperWidth = breakpoints[upper];
  return useMediaQuery(
    `(min-width: ${lowerWidth}) and (max-width: calc(${upperWidth} - 1px))`
  );
}

/**
 * Hook to get current breakpoint
 */
export function useCurrentBreakpoint(): BreakpointKey {
  const isXs = useBreakpointDown('sm');
  const isSm = useBreakpointBetween('sm', 'md');
  const isMd = useBreakpointBetween('md', 'lg');
  const isLg = useBreakpointBetween('lg', 'xl');
  const isXl = useBreakpointBetween('xl', '2xl');

  if (isXs) return 'xs';
  if (isSm) return 'sm';
  if (isMd) return 'md';
  if (isLg) return 'lg';
  if (isXl) return 'xl';
  return '2xl';
}

/**
 * Hook to check for mobile viewport
 */
export function useIsMobile(): boolean {
  return useBreakpointDown('md');
}

/**
 * Hook to check for tablet viewport
 */
export function useIsTablet(): boolean {
  return useBreakpointBetween('md', 'lg');
}

/**
 * Hook to check for desktop viewport
 */
export function useIsDesktop(): boolean {
  return useBreakpoint('lg');
}

/**
 * Hook for reduced motion preference
 */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

/**
 * Hook for color scheme preference
 */
export function usePrefersColorScheme(): 'light' | 'dark' {
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
  return prefersDark ? 'dark' : 'light';
}

/**
 * Responsive value resolver
 */
export function useResponsiveValue<T>(
  values: Partial<Record<BreakpointKey, T>> & { base?: T }
): T | undefined {
  const currentBreakpoint = useCurrentBreakpoint();

  // Order of breakpoints from largest to smallest
  const breakpointOrder: BreakpointKey[] = ['2xl', 'xl', 'lg', 'md', 'sm', 'xs'];

  // Find the first defined value at or below the current breakpoint
  const currentIndex = breakpointOrder.indexOf(currentBreakpoint);

  for (let i = currentIndex; i < breakpointOrder.length; i++) {
    const bp = breakpointOrder[i];
    if (values[bp] !== undefined) {
      return values[bp];
    }
  }

  // Fall back to base value
  return values.base;
}
