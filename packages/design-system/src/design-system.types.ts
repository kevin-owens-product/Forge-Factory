/**
 * @package @forge/design-system
 * @description TypeScript interfaces for design system
 */

import { CSSProperties, ReactNode } from 'react';

// ============================================
// Color Types
// ============================================

/**
 * Color scale (50-950)
 */
export interface ColorScale {
  50: string;
  100: string;
  200: string;
  300: string;
  400: string;
  500: string;
  600: string;
  700: string;
  800: string;
  900: string;
  950: string;
}

/**
 * Semantic colors
 */
export interface SemanticColors {
  primary: ColorScale;
  secondary: ColorScale;
  success: ColorScale;
  warning: ColorScale;
  error: ColorScale;
  info: ColorScale;
  gray: ColorScale;
}

/**
 * Theme colors
 */
export interface ThemeColors extends SemanticColors {
  background: {
    primary: string;
    secondary: string;
    tertiary: string;
  };
  foreground: {
    primary: string;
    secondary: string;
    muted: string;
    inverse: string;
  };
  border: {
    default: string;
    muted: string;
    strong: string;
  };
  focus: string;
  overlay: string;
}

// ============================================
// Typography Types
// ============================================

/**
 * Font family tokens
 */
export interface FontFamilies {
  sans: string;
  serif: string;
  mono: string;
}

/**
 * Font size scale
 */
export interface FontSizes {
  xs: string;
  sm: string;
  base: string;
  lg: string;
  xl: string;
  '2xl': string;
  '3xl': string;
  '4xl': string;
  '5xl': string;
}

/**
 * Font weight scale
 */
export interface FontWeights {
  thin: number;
  light: number;
  normal: number;
  medium: number;
  semibold: number;
  bold: number;
  extrabold: number;
}

/**
 * Line height scale
 */
export interface LineHeights {
  none: number;
  tight: number;
  snug: number;
  normal: number;
  relaxed: number;
  loose: number;
}

/**
 * Letter spacing scale
 */
export interface LetterSpacings {
  tighter: string;
  tight: string;
  normal: string;
  wide: string;
  wider: string;
  widest: string;
}

/**
 * Typography configuration
 */
export interface Typography {
  fontFamilies: FontFamilies;
  fontSizes: FontSizes;
  fontWeights: FontWeights;
  lineHeights: LineHeights;
  letterSpacings: LetterSpacings;
}

// ============================================
// Spacing Types
// ============================================

/**
 * Spacing scale
 */
export interface SpacingScale {
  0: string;
  px: string;
  0.5: string;
  1: string;
  1.5: string;
  2: string;
  2.5: string;
  3: string;
  3.5: string;
  4: string;
  5: string;
  6: string;
  7: string;
  8: string;
  9: string;
  10: string;
  11: string;
  12: string;
  14: string;
  16: string;
  20: string;
  24: string;
  28: string;
  32: string;
  36: string;
  40: string;
  44: string;
  48: string;
  52: string;
  56: string;
  60: string;
  64: string;
  72: string;
  80: string;
  96: string;
}

// ============================================
// Shadow Types
// ============================================

/**
 * Shadow scale
 */
export interface Shadows {
  none: string;
  sm: string;
  default: string;
  md: string;
  lg: string;
  xl: string;
  '2xl': string;
  inner: string;
}

// ============================================
// Border Types
// ============================================

/**
 * Border radius scale
 */
export interface BorderRadii {
  none: string;
  sm: string;
  default: string;
  md: string;
  lg: string;
  xl: string;
  '2xl': string;
  '3xl': string;
  full: string;
}

/**
 * Border width scale
 */
export interface BorderWidths {
  0: string;
  1: string;
  2: string;
  4: string;
  8: string;
}

// ============================================
// Animation Types
// ============================================

/**
 * Transition durations
 */
export interface Durations {
  fastest: string;
  fast: string;
  normal: string;
  slow: string;
  slowest: string;
}

/**
 * Easing functions
 */
export interface Easings {
  linear: string;
  easeIn: string;
  easeOut: string;
  easeInOut: string;
}

/**
 * Animation configuration
 */
export interface Animations {
  durations: Durations;
  easings: Easings;
}

// ============================================
// Breakpoint Types
// ============================================

/**
 * Responsive breakpoints
 */
export interface Breakpoints {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  '2xl': string;
}

// ============================================
// Z-Index Types
// ============================================

/**
 * Z-index scale
 */
export interface ZIndices {
  hide: number;
  base: number;
  dropdown: number;
  sticky: number;
  fixed: number;
  overlay: number;
  modal: number;
  popover: number;
  tooltip: number;
  toast: number;
}

// ============================================
// Theme Types
// ============================================

/**
 * Theme mode
 */
export type ThemeMode = 'light' | 'dark' | 'system';

/**
 * Design tokens
 */
export interface DesignTokens {
  colors: ThemeColors;
  typography: Typography;
  spacing: SpacingScale;
  shadows: Shadows;
  borderRadii: BorderRadii;
  borderWidths: BorderWidths;
  animations: Animations;
  breakpoints: Breakpoints;
  zIndices: ZIndices;
}

/**
 * Theme configuration
 */
export interface Theme {
  mode: ThemeMode;
  tokens: DesignTokens;
}

/**
 * Theme context value
 */
export interface ThemeContextValue {
  theme: Theme;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
  resolvedMode: 'light' | 'dark';
}

// ============================================
// Component Types
// ============================================

/**
 * Component sizes
 */
export type ComponentSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/**
 * Component variants
 */
export type ComponentVariant = 'solid' | 'outline' | 'ghost' | 'link';

/**
 * Component color schemes
 */
export type ColorScheme = 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' | 'gray';

/**
 * Base component props
 */
export interface BaseComponentProps {
  /** Additional CSS class names */
  className?: string;
  /** Inline styles */
  style?: CSSProperties;
  /** Test ID for testing */
  testId?: string;
}

// ============================================
// Button Types
// ============================================

/**
 * Button props
 */
export interface ButtonProps extends BaseComponentProps {
  /** Button content */
  children: ReactNode;
  /** Button variant */
  variant?: ComponentVariant;
  /** Button size */
  size?: ComponentSize;
  /** Color scheme */
  colorScheme?: ColorScheme;
  /** Disabled state */
  disabled?: boolean;
  /** Loading state */
  loading?: boolean;
  /** Full width */
  fullWidth?: boolean;
  /** Left icon */
  leftIcon?: ReactNode;
  /** Right icon */
  rightIcon?: ReactNode;
  /** Button type */
  type?: 'button' | 'submit' | 'reset';
  /** Click handler */
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  /** Accessible label */
  'aria-label'?: string;
}

// ============================================
// Input Types
// ============================================

/**
 * Input props
 */
export interface InputProps extends BaseComponentProps {
  /** Input value */
  value?: string;
  /** Default value */
  defaultValue?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Input type */
  type?: 'text' | 'password' | 'email' | 'number' | 'tel' | 'url' | 'search';
  /** Input size */
  size?: ComponentSize;
  /** Disabled state */
  disabled?: boolean;
  /** Read-only state */
  readOnly?: boolean;
  /** Error state */
  error?: boolean;
  /** Error message */
  errorMessage?: string;
  /** Helper text */
  helperText?: string;
  /** Label */
  label?: string;
  /** Required field */
  required?: boolean;
  /** Left addon */
  leftAddon?: ReactNode;
  /** Right addon */
  rightAddon?: ReactNode;
  /** Full width */
  fullWidth?: boolean;
  /** Change handler */
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  /** Focus handler */
  onFocus?: (event: React.FocusEvent<HTMLInputElement>) => void;
  /** Blur handler */
  onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void;
  /** ID for accessibility */
  id?: string;
  /** Name attribute */
  name?: string;
  /** Autocomplete attribute */
  autoComplete?: string;
}

// ============================================
// Select Types
// ============================================

/**
 * Select option
 */
export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

/**
 * Select props
 */
export interface SelectProps extends BaseComponentProps {
  /** Select options */
  options: SelectOption[];
  /** Selected value */
  value?: string;
  /** Default value */
  defaultValue?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Select size */
  size?: ComponentSize;
  /** Disabled state */
  disabled?: boolean;
  /** Error state */
  error?: boolean;
  /** Error message */
  errorMessage?: string;
  /** Helper text */
  helperText?: string;
  /** Label */
  label?: string;
  /** Required field */
  required?: boolean;
  /** Full width */
  fullWidth?: boolean;
  /** Change handler */
  onChange?: (value: string) => void;
  /** ID for accessibility */
  id?: string;
  /** Name attribute */
  name?: string;
}

// ============================================
// Card Types
// ============================================

/**
 * Card props
 */
export interface CardProps extends BaseComponentProps {
  /** Card content */
  children: ReactNode;
  /** Card variant */
  variant?: 'elevated' | 'outlined' | 'filled';
  /** Padding size */
  padding?: ComponentSize | 'none';
  /** Clickable card */
  clickable?: boolean;
  /** Click handler */
  onClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
}

/**
 * Card header props
 */
export interface CardHeaderProps extends BaseComponentProps {
  /** Header content */
  children: ReactNode;
  /** Title */
  title?: string;
  /** Subtitle */
  subtitle?: string;
  /** Action element */
  action?: ReactNode;
}

/**
 * Card body props
 */
export interface CardBodyProps extends BaseComponentProps {
  /** Body content */
  children: ReactNode;
}

/**
 * Card footer props
 */
export interface CardFooterProps extends BaseComponentProps {
  /** Footer content */
  children: ReactNode;
}

// ============================================
// Modal Types
// ============================================

/**
 * Modal props
 */
export interface ModalProps extends BaseComponentProps {
  /** Modal content */
  children: ReactNode;
  /** Open state */
  isOpen: boolean;
  /** Close handler */
  onClose: () => void;
  /** Modal size */
  size?: ComponentSize | 'full';
  /** Close on overlay click */
  closeOnOverlayClick?: boolean;
  /** Close on escape key */
  closeOnEsc?: boolean;
  /** Show close button */
  showCloseButton?: boolean;
  /** Center vertically */
  isCentered?: boolean;
  /** Accessible title */
  'aria-labelledby'?: string;
  /** Accessible description */
  'aria-describedby'?: string;
}

/**
 * Modal header props
 */
export interface ModalHeaderProps extends BaseComponentProps {
  /** Header content */
  children: ReactNode;
}

/**
 * Modal body props
 */
export interface ModalBodyProps extends BaseComponentProps {
  /** Body content */
  children: ReactNode;
}

/**
 * Modal footer props
 */
export interface ModalFooterProps extends BaseComponentProps {
  /** Footer content */
  children: ReactNode;
}

// ============================================
// Toast Types
// ============================================

/**
 * Toast status
 */
export type ToastStatus = 'info' | 'success' | 'warning' | 'error';

/**
 * Toast position
 */
export type ToastPosition =
  | 'top'
  | 'top-left'
  | 'top-right'
  | 'bottom'
  | 'bottom-left'
  | 'bottom-right';

/**
 * Toast configuration
 */
export interface ToastConfig {
  /** Toast title */
  title?: string;
  /** Toast description */
  description?: string;
  /** Toast status */
  status?: ToastStatus;
  /** Duration in ms (null for persistent) */
  duration?: number | null;
  /** Position */
  position?: ToastPosition;
  /** Closable */
  isClosable?: boolean;
  /** Custom icon */
  icon?: ReactNode;
}

/**
 * Toast instance
 */
export interface Toast extends ToastConfig {
  /** Unique ID */
  id: string;
  /** Created timestamp */
  createdAt: number;
}

/**
 * Toast context value
 */
export interface ToastContextValue {
  /** Active toasts */
  toasts: Toast[];
  /** Show a toast */
  toast: (config: ToastConfig) => string;
  /** Close a toast */
  close: (id: string) => void;
  /** Close all toasts */
  closeAll: () => void;
}

// ============================================
// Utility Types
// ============================================

/**
 * Responsive value
 */
export type ResponsiveValue<T> = T | { base?: T; sm?: T; md?: T; lg?: T; xl?: T; '2xl'?: T };

/**
 * Style props
 */
export interface StyleProps {
  /** Margin */
  m?: ResponsiveValue<string | number>;
  /** Margin top */
  mt?: ResponsiveValue<string | number>;
  /** Margin right */
  mr?: ResponsiveValue<string | number>;
  /** Margin bottom */
  mb?: ResponsiveValue<string | number>;
  /** Margin left */
  ml?: ResponsiveValue<string | number>;
  /** Margin horizontal */
  mx?: ResponsiveValue<string | number>;
  /** Margin vertical */
  my?: ResponsiveValue<string | number>;
  /** Padding */
  p?: ResponsiveValue<string | number>;
  /** Padding top */
  pt?: ResponsiveValue<string | number>;
  /** Padding right */
  pr?: ResponsiveValue<string | number>;
  /** Padding bottom */
  pb?: ResponsiveValue<string | number>;
  /** Padding left */
  pl?: ResponsiveValue<string | number>;
  /** Padding horizontal */
  px?: ResponsiveValue<string | number>;
  /** Padding vertical */
  py?: ResponsiveValue<string | number>;
}
