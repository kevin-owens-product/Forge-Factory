/**
 * @package @forge/design-system
 * @description Card component
 */

import React, { forwardRef, useMemo, createContext, useContext } from 'react';
import {
  CardProps,
  CardHeaderProps,
  CardBodyProps,
  CardFooterProps,
  ComponentSize,
} from '../../design-system.types';
import { useTokens } from '../../theme/ThemeProvider';

/**
 * Card padding by size
 */
const paddingStyles: Record<ComponentSize | 'none', string> = {
  none: '0',
  xs: '0.5rem',
  sm: '0.75rem',
  md: '1rem',
  lg: '1.5rem',
  xl: '2rem',
};

/**
 * Card context for sharing padding
 */
const CardContext = createContext<{ padding: ComponentSize | 'none' }>({ padding: 'md' });

/**
 * Card component
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  {
    children,
    variant = 'elevated',
    padding = 'md',
    clickable = false,
    onClick,
    className,
    style,
    testId,
    ...props
  },
  ref
) {
  const tokens = useTokens();

  const cardStyles = useMemo<React.CSSProperties>(() => {
    const baseStyles: React.CSSProperties = {
      borderRadius: tokens.borderRadii.lg,
      backgroundColor: tokens.colors.background.primary,
      overflow: 'hidden',
      transition: `all ${tokens.animations.durations.fast} ${tokens.animations.easings.easeInOut}`,
    };

    switch (variant) {
      case 'elevated':
        return {
          ...baseStyles,
          boxShadow: tokens.shadows.md,
        };
      case 'outlined':
        return {
          ...baseStyles,
          border: `1px solid ${tokens.colors.border.default}`,
        };
      case 'filled':
        return {
          ...baseStyles,
          backgroundColor: tokens.colors.background.secondary,
        };
      default:
        return baseStyles;
    }
  }, [variant, tokens]);

  const clickableStyles = useMemo<React.CSSProperties>(() => {
    if (!clickable) return {};
    return {
      cursor: 'pointer',
    };
  }, [clickable]);

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (clickable && onClick) {
      onClick(event);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (clickable && onClick && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      onClick(event as unknown as React.MouseEvent<HTMLDivElement>);
    }
  };

  return (
    <CardContext.Provider value={{ padding }}>
      <div
        ref={ref}
        style={{ ...cardStyles, ...clickableStyles, ...style }}
        className={className}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role={clickable ? 'button' : undefined}
        tabIndex={clickable ? 0 : undefined}
        data-testid={testId}
        {...props}
      >
        {children}
      </div>
    </CardContext.Provider>
  );
});

Card.displayName = 'Card';

/**
 * Card header component
 */
export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(function CardHeader(
  { children, title, subtitle, action, className, style, testId, ...props },
  ref
) {
  const tokens = useTokens();
  const { padding } = useContext(CardContext);

  const headerStyles = useMemo<React.CSSProperties>(() => ({
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: paddingStyles[padding],
    paddingBottom: padding === 'none' ? '0' : tokens.spacing[3],
    borderBottom: `1px solid ${tokens.colors.border.muted}`,
  }), [padding, tokens]);

  const titleStyles = useMemo<React.CSSProperties>(() => ({
    fontFamily: tokens.typography.fontFamilies.sans,
    fontSize: tokens.typography.fontSizes.lg,
    fontWeight: tokens.typography.fontWeights.semibold,
    color: tokens.colors.foreground.primary,
    margin: 0,
  }), [tokens]);

  const subtitleStyles = useMemo<React.CSSProperties>(() => ({
    fontFamily: tokens.typography.fontFamilies.sans,
    fontSize: tokens.typography.fontSizes.sm,
    color: tokens.colors.foreground.muted,
    marginTop: tokens.spacing[1],
  }), [tokens]);

  return (
    <div ref={ref} style={{ ...headerStyles, ...style }} className={className} data-testid={testId} {...props}>
      <div>
        {title && <h3 style={titleStyles}>{title}</h3>}
        {subtitle && <p style={subtitleStyles}>{subtitle}</p>}
        {!title && !subtitle && children}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
});

CardHeader.displayName = 'CardHeader';

/**
 * Card body component
 */
export const CardBody = forwardRef<HTMLDivElement, CardBodyProps>(function CardBody(
  { children, className, style, testId, ...props },
  ref
) {
  const { padding } = useContext(CardContext);

  const bodyStyles = useMemo<React.CSSProperties>(() => ({
    padding: paddingStyles[padding],
  }), [padding]);

  return (
    <div ref={ref} style={{ ...bodyStyles, ...style }} className={className} data-testid={testId} {...props}>
      {children}
    </div>
  );
});

CardBody.displayName = 'CardBody';

/**
 * Card footer component
 */
export const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(function CardFooter(
  { children, className, style, testId, ...props },
  ref
) {
  const tokens = useTokens();
  const { padding } = useContext(CardContext);

  const footerStyles = useMemo<React.CSSProperties>(() => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: tokens.spacing[2],
    padding: paddingStyles[padding],
    paddingTop: padding === 'none' ? '0' : tokens.spacing[3],
    borderTop: `1px solid ${tokens.colors.border.muted}`,
  }), [padding, tokens]);

  return (
    <div ref={ref} style={{ ...footerStyles, ...style }} className={className} data-testid={testId} {...props}>
      {children}
    </div>
  );
});

CardFooter.displayName = 'CardFooter';
