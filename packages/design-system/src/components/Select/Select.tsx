/**
 * @package @forge/design-system
 * @description Select component
 */

import React, { forwardRef, useMemo, useId } from 'react';
import { SelectProps, ComponentSize } from '../../design-system.types';
import { useTokens } from '../../theme/ThemeProvider';

/**
 * Select size styles
 */
const sizeStyles: Record<ComponentSize, { height: string; padding: string; fontSize: string }> = {
  xs: { height: '1.5rem', padding: '0 1.5rem 0 0.5rem', fontSize: '0.75rem' },
  sm: { height: '2rem', padding: '0 2rem 0 0.75rem', fontSize: '0.875rem' },
  md: { height: '2.5rem', padding: '0 2.5rem 0 1rem', fontSize: '0.875rem' },
  lg: { height: '3rem', padding: '0 3rem 0 1.25rem', fontSize: '1rem' },
  xl: { height: '3.5rem', padding: '0 3.5rem 0 1.5rem', fontSize: '1.125rem' },
};

/**
 * Chevron icon
 */
function ChevronIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M4.22 6.22a.75.75 0 011.06 0L8 8.94l2.72-2.72a.75.75 0 111.06 1.06l-3.25 3.25a.75.75 0 01-1.06 0L4.22 7.28a.75.75 0 010-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/**
 * Select component
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    options,
    value,
    defaultValue,
    placeholder,
    size = 'md',
    disabled = false,
    error = false,
    errorMessage,
    helperText,
    label,
    required = false,
    fullWidth = false,
    onChange,
    id,
    name,
    className,
    style,
    testId,
    ...props
  },
  ref
) {
  const tokens = useTokens();
  const generatedId = useId();
  const selectId = id || generatedId;
  const errorId = `${selectId}-error`;
  const helperId = `${selectId}-helper`;

  const containerStyles = useMemo<React.CSSProperties>(() => ({
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacing[1],
    width: fullWidth ? '100%' : 'auto',
  }), [tokens, fullWidth]);

  const labelStyles = useMemo<React.CSSProperties>(() => ({
    fontFamily: tokens.typography.fontFamilies.sans,
    fontSize: tokens.typography.fontSizes.sm,
    fontWeight: tokens.typography.fontWeights.medium,
    color: tokens.colors.foreground.primary,
  }), [tokens]);

  const selectWrapperStyles = useMemo<React.CSSProperties>(() => ({
    position: 'relative' as const,
    display: 'inline-flex',
    width: fullWidth ? '100%' : 'auto',
  }), [fullWidth]);

  const selectStyles = useMemo<React.CSSProperties>(() => {
    const sizeStyle = sizeStyles[size];
    const borderColor = error ? tokens.colors.error[500] : tokens.colors.border.default;

    return {
      fontFamily: tokens.typography.fontFamilies.sans,
      fontSize: sizeStyle.fontSize,
      height: sizeStyle.height,
      padding: sizeStyle.padding,
      backgroundColor: disabled ? tokens.colors.background.secondary : tokens.colors.background.primary,
      color: tokens.colors.foreground.primary,
      border: `1px solid ${borderColor}`,
      borderRadius: tokens.borderRadii.md,
      outline: 'none',
      transition: `all ${tokens.animations.durations.fast} ${tokens.animations.easings.easeInOut}`,
      width: '100%',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.6 : 1,
      appearance: 'none' as const,
      WebkitAppearance: 'none' as const,
      MozAppearance: 'none' as const,
      ...style,
    };
  }, [size, error, disabled, tokens, style]);

  const iconStyles = useMemo<React.CSSProperties>(() => ({
    position: 'absolute' as const,
    right: tokens.spacing[2],
    top: '50%',
    transform: 'translateY(-50%)',
    color: tokens.colors.foreground.muted,
    pointerEvents: 'none' as const,
  }), [tokens]);

  const helperStyles = useMemo<React.CSSProperties>(() => ({
    fontFamily: tokens.typography.fontFamilies.sans,
    fontSize: tokens.typography.fontSizes.xs,
    color: error ? tokens.colors.error[500] : tokens.colors.foreground.muted,
  }), [tokens, error]);

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    onChange?.(event.target.value);
  };

  const describedBy = [
    errorMessage && error ? errorId : null,
    helperText ? helperId : null,
  ].filter(Boolean).join(' ') || undefined;

  return (
    <div style={containerStyles} className={className}>
      {label && (
        <label htmlFor={selectId} style={labelStyles}>
          {label}
          {required && <span style={{ color: tokens.colors.error[500], marginLeft: '0.25rem' }}>*</span>}
        </label>
      )}
      <div style={selectWrapperStyles}>
        <select
          ref={ref}
          id={selectId}
          name={name}
          value={value}
          defaultValue={defaultValue}
          disabled={disabled}
          required={required}
          onChange={handleChange}
          style={selectStyles}
          aria-invalid={error}
          aria-describedby={describedBy}
          aria-required={required}
          data-testid={testId}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
        <span style={iconStyles}>
          <ChevronIcon />
        </span>
      </div>
      {error && errorMessage && (
        <span id={errorId} style={helperStyles} role="alert">
          {errorMessage}
        </span>
      )}
      {!error && helperText && (
        <span id={helperId} style={helperStyles}>
          {helperText}
        </span>
      )}
    </div>
  );
});

Select.displayName = 'Select';
