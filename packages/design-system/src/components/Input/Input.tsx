/**
 * @package @forge/design-system
 * @description Input component
 */

import React, { forwardRef, useMemo, useId } from 'react';
import { InputProps, ComponentSize } from '../../design-system.types';
import { useTokens } from '../../theme/ThemeProvider';

/**
 * Input size styles
 */
const sizeStyles: Record<ComponentSize, { height: string; padding: string; fontSize: string }> = {
  xs: { height: '1.5rem', padding: '0 0.5rem', fontSize: '0.75rem' },
  sm: { height: '2rem', padding: '0 0.75rem', fontSize: '0.875rem' },
  md: { height: '2.5rem', padding: '0 1rem', fontSize: '0.875rem' },
  lg: { height: '3rem', padding: '0 1.25rem', fontSize: '1rem' },
  xl: { height: '3.5rem', padding: '0 1.5rem', fontSize: '1.125rem' },
};

/**
 * Input component
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    value,
    defaultValue,
    placeholder,
    type = 'text',
    size = 'md',
    disabled = false,
    readOnly = false,
    error = false,
    errorMessage,
    helperText,
    label,
    required = false,
    leftAddon,
    rightAddon,
    fullWidth = false,
    onChange,
    onFocus,
    onBlur,
    id,
    name,
    autoComplete,
    className,
    style,
    testId,
    ...props
  },
  ref
) {
  const tokens = useTokens();
  const generatedId = useId();
  const inputId = id || generatedId;
  const errorId = `${inputId}-error`;
  const helperId = `${inputId}-helper`;

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

  const inputWrapperStyles = useMemo<React.CSSProperties>(() => ({
    display: 'flex',
    alignItems: 'center',
    position: 'relative' as const,
  }), []);

  const inputStyles = useMemo<React.CSSProperties>(() => {
    const sizeStyle = sizeStyles[size];
    const borderColor = error ? tokens.colors.error[500] : tokens.colors.border.default;

    return {
      fontFamily: tokens.typography.fontFamilies.sans,
      fontSize: sizeStyle.fontSize,
      height: sizeStyle.height,
      padding: sizeStyle.padding,
      paddingLeft: leftAddon ? '2.5rem' : sizeStyle.padding.split(' ')[1],
      paddingRight: rightAddon ? '2.5rem' : sizeStyle.padding.split(' ')[1],
      backgroundColor: disabled ? tokens.colors.background.secondary : tokens.colors.background.primary,
      color: tokens.colors.foreground.primary,
      border: `1px solid ${borderColor}`,
      borderRadius: tokens.borderRadii.md,
      outline: 'none',
      transition: `all ${tokens.animations.durations.fast} ${tokens.animations.easings.easeInOut}`,
      width: '100%',
      cursor: disabled ? 'not-allowed' : 'text',
      opacity: disabled ? 0.6 : 1,
      ...style,
    };
  }, [size, error, disabled, leftAddon, rightAddon, tokens, style]);

  const addonStyles = useMemo<React.CSSProperties>(() => ({
    position: 'absolute' as const,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    width: '2.5rem',
    color: tokens.colors.foreground.muted,
    pointerEvents: 'none',
  }), [tokens]);

  const helperStyles = useMemo<React.CSSProperties>(() => ({
    fontFamily: tokens.typography.fontFamilies.sans,
    fontSize: tokens.typography.fontSizes.xs,
    color: error ? tokens.colors.error[500] : tokens.colors.foreground.muted,
  }), [tokens, error]);

  const describedBy = [
    errorMessage && error ? errorId : null,
    helperText ? helperId : null,
  ].filter(Boolean).join(' ') || undefined;

  return (
    <div style={containerStyles} className={className}>
      {label && (
        <label htmlFor={inputId} style={labelStyles}>
          {label}
          {required && <span style={{ color: tokens.colors.error[500], marginLeft: '0.25rem' }}>*</span>}
        </label>
      )}
      <div style={inputWrapperStyles}>
        {leftAddon && <span style={{ ...addonStyles, left: 0 }}>{leftAddon}</span>}
        <input
          ref={ref}
          id={inputId}
          name={name}
          type={type}
          value={value}
          defaultValue={defaultValue}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          required={required}
          autoComplete={autoComplete}
          onChange={onChange}
          onFocus={onFocus}
          onBlur={onBlur}
          style={inputStyles}
          aria-invalid={error}
          aria-describedby={describedBy}
          aria-required={required}
          data-testid={testId}
          {...props}
        />
        {rightAddon && <span style={{ ...addonStyles, right: 0 }}>{rightAddon}</span>}
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

Input.displayName = 'Input';
