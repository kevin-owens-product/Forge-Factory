/**
 * @package @forge/design-system
 * @description Theme provider component
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
import { Theme, ThemeMode, ThemeContextValue } from '../design-system.types';
import { getDesignTokens, generateCSSVariables } from './tokens';

/**
 * Theme context
 */
export const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Storage key for persisting theme preference
 */
const THEME_STORAGE_KEY = 'forge-theme-mode';

/**
 * Get system color scheme preference
 */
function getSystemColorScheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') {
    return 'light';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Get stored theme preference
 */
function getStoredTheme(): ThemeMode | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored;
  }
  return null;
}

/**
 * Store theme preference
 */
function storeTheme(mode: ThemeMode): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  }
}

/**
 * Theme provider props
 */
export interface ThemeProviderProps {
  /** Child components */
  children: ReactNode;
  /** Default theme mode */
  defaultMode?: ThemeMode;
  /** Disable persistence */
  disablePersistence?: boolean;
  /** Custom storage key */
  storageKey?: string;
}

/**
 * Theme provider component
 */
export function ThemeProvider({
  children,
  defaultMode = 'system',
  disablePersistence = false,
}: ThemeProviderProps): JSX.Element {
  // Initialize mode from storage or default
  const [mode, setModeState] = useState<ThemeMode>(() => {
    if (!disablePersistence) {
      const stored = getStoredTheme();
      if (stored) return stored;
    }
    return defaultMode;
  });

  // Track system color scheme
  const [systemScheme, setSystemScheme] = useState<'light' | 'dark'>(() => getSystemColorScheme());

  // Resolve actual mode (light or dark)
  const resolvedMode = useMemo<'light' | 'dark'>(() => {
    if (mode === 'system') {
      return systemScheme;
    }
    return mode;
  }, [mode, systemScheme]);

  // Create theme
  const theme = useMemo<Theme>(() => {
    return {
      mode,
      tokens: getDesignTokens(resolvedMode),
    };
  }, [mode, resolvedMode]);

  // Set mode with persistence
  const setMode = useCallback(
    (newMode: ThemeMode) => {
      setModeState(newMode);
      if (!disablePersistence) {
        storeTheme(newMode);
      }
    },
    [disablePersistence]
  );

  // Toggle between light and dark
  const toggleMode = useCallback(() => {
    const newMode = resolvedMode === 'light' ? 'dark' : 'light';
    setMode(newMode);
  }, [resolvedMode, setMode]);

  // Listen for system color scheme changes
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (event: MediaQueryListEvent) => {
      setSystemScheme(event.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Apply CSS variables to document
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const variables = generateCSSVariables(theme.tokens);
    const root = document.documentElement;

    for (const [key, value] of Object.entries(variables)) {
      root.style.setProperty(key, value);
    }

    // Set data attribute for CSS selectors
    root.setAttribute('data-theme', resolvedMode);

    // Set color-scheme for native elements
    root.style.colorScheme = resolvedMode;
  }, [theme, resolvedMode]);

  // Context value
  const contextValue = useMemo<ThemeContextValue>(
    () => ({
      theme,
      mode,
      setMode,
      toggleMode,
      resolvedMode,
    }),
    [theme, mode, setMode, toggleMode, resolvedMode]
  );

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>;
}

/**
 * Hook to access theme context
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }

  return context;
}

/**
 * Hook to access design tokens
 */
export function useTokens() {
  const { theme } = useTheme();
  return theme.tokens;
}

/**
 * Hook to check if dark mode is active
 */
export function useIsDarkMode(): boolean {
  const { resolvedMode } = useTheme();
  return resolvedMode === 'dark';
}

/**
 * Hook to get color value
 */
export function useColor(
  colorScheme: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' | 'gray',
  shade: keyof import('../design-system.types').ColorScale = 500
): string {
  const { theme } = useTheme();
  return theme.tokens.colors[colorScheme][shade];
}
