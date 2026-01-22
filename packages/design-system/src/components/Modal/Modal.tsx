/**
 * @package @forge/design-system
 * @description Modal component
 */

import React, {
  forwardRef,
  useMemo,
  useEffect,
  useCallback,
  useRef,
  createContext,
  useContext,
} from 'react';
import { createPortal } from 'react-dom';
import {
  ModalProps,
  ModalHeaderProps,
  ModalBodyProps,
  ModalFooterProps,
  ComponentSize,
} from '../../design-system.types';
import { useTokens } from '../../theme/ThemeProvider';

/**
 * Modal size widths
 */
const sizeWidths: Record<ComponentSize | 'full', string> = {
  xs: '20rem',
  sm: '24rem',
  md: '28rem',
  lg: '32rem',
  xl: '36rem',
  full: '100%',
};

/**
 * Modal context
 */
const ModalContext = createContext<{
  onClose: () => void;
  showCloseButton: boolean;
}>({ onClose: () => {}, showCloseButton: true });

/**
 * Close icon component
 */
function CloseIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M15 5L5 15M5 5L15 15"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Modal component
 */
export const Modal = forwardRef<HTMLDivElement, ModalProps>(function Modal(
  {
    children,
    isOpen,
    onClose,
    size = 'md',
    closeOnOverlayClick = true,
    closeOnEsc = true,
    showCloseButton = true,
    isCentered = true,
    className,
    style,
    testId,
    'aria-labelledby': ariaLabelledBy,
    'aria-describedby': ariaDescribedBy,
    ...props
  },
  ref
) {
  const tokens = useTokens();
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  // Handle escape key
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (closeOnEsc && event.key === 'Escape') {
        onClose();
      }
    },
    [closeOnEsc, onClose]
  );

  // Handle overlay click
  const handleOverlayClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (closeOnOverlayClick && event.target === overlayRef.current) {
        onClose();
      }
    },
    [closeOnOverlayClick, onClose]
  );

  // Lock body scroll and add escape listener
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleKeyDown]);

  // Focus trap and initial focus
  useEffect(() => {
    if (!isOpen || !contentRef.current) return;

    const focusableElements = contentRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }
  }, [isOpen]);

  const overlayStyles = useMemo<React.CSSProperties>(() => ({
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: tokens.colors.overlay,
    display: 'flex',
    alignItems: isCentered ? 'center' : 'flex-start',
    justifyContent: 'center',
    padding: isCentered ? tokens.spacing[4] : tokens.spacing[16],
    zIndex: tokens.zIndices.modal,
    overflow: 'auto',
  }), [tokens, isCentered]);

  const contentStyles = useMemo<React.CSSProperties>(() => ({
    backgroundColor: tokens.colors.background.primary,
    borderRadius: size === 'full' ? 0 : tokens.borderRadii.xl,
    boxShadow: tokens.shadows.xl,
    width: sizeWidths[size],
    maxWidth: size === 'full' ? '100%' : `calc(100% - ${tokens.spacing[8]})`,
    maxHeight: size === 'full' ? '100%' : `calc(100vh - ${tokens.spacing[8]})`,
    minHeight: size === 'full' ? '100%' : 'auto',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    ...style,
  }), [tokens, size, style]);

  if (!isOpen) return null;

  const modal = (
    <div
      ref={overlayRef}
      style={overlayStyles}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy}
      data-testid={testId}
    >
      <div
        ref={(node) => {
          contentRef.current = node;
          if (typeof ref === 'function') {
            ref(node);
          } else if (ref) {
            (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
          }
        }}
        style={contentStyles}
        className={className}
        {...props}
      >
        <ModalContext.Provider value={{ onClose, showCloseButton }}>
          {children}
        </ModalContext.Provider>
      </div>
    </div>
  );

  // Use portal to render at document body
  if (typeof document !== 'undefined') {
    return createPortal(modal, document.body);
  }

  return modal;
});

Modal.displayName = 'Modal';

/**
 * Modal header component
 */
export const ModalHeader = forwardRef<HTMLDivElement, ModalHeaderProps>(function ModalHeader(
  { children, className, style, testId, ...props },
  ref
) {
  const tokens = useTokens();
  const { onClose, showCloseButton } = useContext(ModalContext);

  const headerStyles = useMemo<React.CSSProperties>(() => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: tokens.spacing[4],
    borderBottom: `1px solid ${tokens.colors.border.muted}`,
    ...style,
  }), [tokens, style]);

  const titleStyles = useMemo<React.CSSProperties>(() => ({
    fontFamily: tokens.typography.fontFamilies.sans,
    fontSize: tokens.typography.fontSizes.lg,
    fontWeight: tokens.typography.fontWeights.semibold,
    color: tokens.colors.foreground.primary,
    margin: 0,
  }), [tokens]);

  const closeButtonStyles = useMemo<React.CSSProperties>(() => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spacing[1],
    background: 'none',
    border: 'none',
    borderRadius: tokens.borderRadii.md,
    color: tokens.colors.foreground.muted,
    cursor: 'pointer',
    transition: `all ${tokens.animations.durations.fast} ${tokens.animations.easings.easeInOut}`,
  }), [tokens]);

  return (
    <div ref={ref} style={headerStyles} className={className} data-testid={testId} {...props}>
      <div style={titleStyles}>{children}</div>
      {showCloseButton && (
        <button
          type="button"
          style={closeButtonStyles}
          onClick={onClose}
          aria-label="Close modal"
        >
          <CloseIcon />
        </button>
      )}
    </div>
  );
});

ModalHeader.displayName = 'ModalHeader';

/**
 * Modal body component
 */
export const ModalBody = forwardRef<HTMLDivElement, ModalBodyProps>(function ModalBody(
  { children, className, style, testId, ...props },
  ref
) {
  const tokens = useTokens();

  const bodyStyles = useMemo<React.CSSProperties>(() => ({
    padding: tokens.spacing[4],
    flex: 1,
    overflow: 'auto',
    ...style,
  }), [tokens, style]);

  return (
    <div ref={ref} style={bodyStyles} className={className} data-testid={testId} {...props}>
      {children}
    </div>
  );
});

ModalBody.displayName = 'ModalBody';

/**
 * Modal footer component
 */
export const ModalFooter = forwardRef<HTMLDivElement, ModalFooterProps>(function ModalFooter(
  { children, className, style, testId, ...props },
  ref
) {
  const tokens = useTokens();

  const footerStyles = useMemo<React.CSSProperties>(() => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: tokens.spacing[2],
    padding: tokens.spacing[4],
    borderTop: `1px solid ${tokens.colors.border.muted}`,
    ...style,
  }), [tokens, style]);

  return (
    <div ref={ref} style={footerStyles} className={className} data-testid={testId} {...props}>
      {children}
    </div>
  );
});

ModalFooter.displayName = 'ModalFooter';
