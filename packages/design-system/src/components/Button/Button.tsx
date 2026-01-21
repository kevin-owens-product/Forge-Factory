/**
 * @package @forge/design-system
 * @description Button component
 */

import React, { forwardRef, useMemo } from 'react';
import { ButtonProps, ComponentSize, ComponentVariant, ColorScheme } from '../../design-system.types';
import { useTokens } from '../../theme/ThemeProvider';

/**
 * Button size styles
 */
const sizeStyles: Record<ComponentSize, { height: string; padding: string; fontSize: string }> = {
  xs: { height: '1.5rem', padding: '0 0.5rem', fontSize: '0.75rem' },
  sm: { height: '2rem', padding: '0 0.75rem', fontSize: '0.875rem' },
  md: { height: '2.5rem', padding: '0 1rem', fontSize: '0.875rem' },
  lg: { height: '3rem', padding: '0 1.25rem', fontSize: '1rem' },
  xl: { height: '3.5rem', padding: '0 1.5rem', fontSize: '1.125rem' },
};

/**
 * Get button styles based on variant and color scheme
 */
function getButtonStyles(
  variant: ComponentVariant,
  colorScheme: ColorScheme,
  tokens: ReturnType<typeof useTokens>
): React.CSSProperties {
  const colorScale = tokens.colors[colorScheme];

  const baseStyles: React.CSSProperties = {
    fontFamily: tokens.typography.fontFamilies.sans,
    fontWeight: tokens.typography.fontWeights.medium,
    borderRadius: tokens.borderRadii.md,
    transition: `all ${tokens.animations.durations.fast} ${tokens.animations.easings.easeInOut}`,
    cursor: 'pointer',
    border: 'none',
    outline: 'none',
  };

  switch (variant) {
    case 'solid':
      return {
        ...baseStyles,
        backgroundColor: colorScale[500],
        color: '#ffffff',
      };
    case 'outline':
      return {
        ...baseStyles,
        backgroundColor: 'transparent',
        color: colorScale[500],
        border: `1px solid ${colorScale[500]}`,
      };
    case 'ghost':
      return {
        ...baseStyles,
        backgroundColor: 'transparent',
        color: colorScale[500],
      };
    case 'link':
      return {
        ...baseStyles,
        backgroundColor: 'transparent',
        color: colorScale[500],
        padding: '0',
        height: 'auto',
      };
    default:
      return baseStyles;
  }
}

/**
 * Spinner component for loading state
 */
function Spinner({ size }: { size: ComponentSize }) {
  const spinnerSize = {
    xs: '0.75rem',
    sm: '0.875rem',
    md: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
  }[size];

  return (
    <svg
      style={{
        width: spinnerSize,
        height: spinnerSize,
        animation: 'spin 1s linear infinite',
      }}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle
        style={{ opacity: 0.25 }}
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        style={{ opacity: 0.75 }}
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

/**
 * Button component
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    children,
    variant = 'solid',
    size = 'md',
    colorScheme = 'primary',
    disabled = false,
    loading = false,
    fullWidth = false,
    leftIcon,
    rightIcon,
    type = 'button',
    onClick,
    className,
    style,
    testId,
    'aria-label': ariaLabel,
    ...props
  },
  ref
) {
  const tokens = useTokens();

  const buttonStyles = useMemo<React.CSSProperties>(() => {
    const variantStyles = getButtonStyles(variant, colorScheme, tokens);
    const sizeStyle = sizeStyles[size];

    return {
      ...variantStyles,
      height: variant === 'link' ? 'auto' : sizeStyle.height,
      padding: variant === 'link' ? '0' : sizeStyle.padding,
      fontSize: sizeStyle.fontSize,
      width: fullWidth ? '100%' : 'auto',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: tokens.spacing[2],
      opacity: disabled || loading ? 0.6 : 1,
      cursor: disabled || loading ? 'not-allowed' : 'pointer',
      ...style,
    };
  }, [variant, colorScheme, size, fullWidth, disabled, loading, tokens, style]);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || loading) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };

  return (
    <button
      ref={ref}
      type={type}
      style={buttonStyles}
      className={className}
      disabled={disabled || loading}
      onClick={handleClick}
      aria-label={ariaLabel}
      aria-disabled={disabled || loading}
      aria-busy={loading}
      data-testid={testId}
      {...props}
    >
      {loading && <Spinner size={size} />}
      {!loading && leftIcon && <span style={{ display: 'flex' }}>{leftIcon}</span>}
      <span>{children}</span>
      {!loading && rightIcon && <span style={{ display: 'flex' }}>{rightIcon}</span>}
    </button>
  );
});

Button.displayName = 'Button';
