/**
 * @package @forge/design-system
 * @description Toast component
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import {
  Toast as ToastType,
  ToastConfig,
  ToastContextValue,
  ToastStatus,
  ToastPosition,
} from '../../design-system.types';
import { useTokens } from '../../theme/ThemeProvider';

/**
 * Toast context
 */
const ToastContext = createContext<ToastContextValue | null>(null);

/**
 * Default toast duration
 */
const DEFAULT_DURATION = 5000;

/**
 * Position styles
 */
const positionStyles: Record<ToastPosition, React.CSSProperties> = {
  top: { top: '1rem', left: '50%', transform: 'translateX(-50%)' },
  'top-left': { top: '1rem', left: '1rem' },
  'top-right': { top: '1rem', right: '1rem' },
  bottom: { bottom: '1rem', left: '50%', transform: 'translateX(-50%)' },
  'bottom-left': { bottom: '1rem', left: '1rem' },
  'bottom-right': { bottom: '1rem', right: '1rem' },
};

/**
 * Status icons
 */
function StatusIcon({ status }: { status: ToastStatus }) {
  const iconProps = { width: 20, height: 20, viewBox: '0 0 20 20', fill: 'currentColor' };

  switch (status) {
    case 'success':
      return (
        <svg {...iconProps}>
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clipRule="evenodd"
          />
        </svg>
      );
    case 'error':
      return (
        <svg {...iconProps}>
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
            clipRule="evenodd"
          />
        </svg>
      );
    case 'warning':
      return (
        <svg {...iconProps}>
          <path
            fillRule="evenodd"
            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
      );
    case 'info':
    default:
      return (
        <svg {...iconProps}>
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
            clipRule="evenodd"
          />
        </svg>
      );
  }
}

/**
 * Close icon
 */
function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M4.293 4.293a1 1 0 011.414 0L8 6.586l2.293-2.293a1 1 0 111.414 1.414L9.414 8l2.293 2.293a1 1 0 01-1.414 1.414L8 9.414l-2.293 2.293a1 1 0 01-1.414-1.414L6.586 8 4.293 5.707a1 1 0 010-1.414z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/**
 * Individual toast component
 */
function ToastItem({
  toast,
  onClose,
}: {
  toast: ToastType;
  onClose: (id: string) => void;
}) {
  const tokens = useTokens();
  const status = toast.status || 'info';

  const statusColors: Record<ToastStatus, string> = {
    info: tokens.colors.info[500],
    success: tokens.colors.success[500],
    warning: tokens.colors.warning[500],
    error: tokens.colors.error[500],
  };

  const statusBgColors: Record<ToastStatus, string> = {
    info: tokens.colors.info[50],
    success: tokens.colors.success[50],
    warning: tokens.colors.warning[50],
    error: tokens.colors.error[50],
  };

  const containerStyles = useMemo<React.CSSProperties>(() => ({
    display: 'flex',
    alignItems: 'flex-start',
    gap: tokens.spacing[3],
    padding: tokens.spacing[4],
    backgroundColor: statusBgColors[status],
    borderRadius: tokens.borderRadii.lg,
    boxShadow: tokens.shadows.lg,
    minWidth: '280px',
    maxWidth: '420px',
    border: `1px solid ${statusColors[status]}20`,
  }), [tokens, status, statusColors, statusBgColors]);

  const iconStyles = useMemo<React.CSSProperties>(() => ({
    color: statusColors[status],
    flexShrink: 0,
  }), [status, statusColors]);

  const contentStyles = useMemo<React.CSSProperties>(() => ({
    flex: 1,
    minWidth: 0,
  }), []);

  const titleStyles = useMemo<React.CSSProperties>(() => ({
    fontFamily: tokens.typography.fontFamilies.sans,
    fontSize: tokens.typography.fontSizes.sm,
    fontWeight: tokens.typography.fontWeights.semibold,
    color: tokens.colors.foreground.primary,
    margin: 0,
  }), [tokens]);

  const descriptionStyles = useMemo<React.CSSProperties>(() => ({
    fontFamily: tokens.typography.fontFamilies.sans,
    fontSize: tokens.typography.fontSizes.sm,
    color: tokens.colors.foreground.secondary,
    marginTop: toast.title ? tokens.spacing[1] : 0,
  }), [tokens, toast.title]);

  const closeButtonStyles = useMemo<React.CSSProperties>(() => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spacing[1],
    background: 'none',
    border: 'none',
    borderRadius: tokens.borderRadii.sm,
    color: tokens.colors.foreground.muted,
    cursor: 'pointer',
    flexShrink: 0,
  }), [tokens]);

  // Auto-dismiss
  useEffect(() => {
    if (toast.duration === null) return;

    const duration = toast.duration ?? DEFAULT_DURATION;
    const timer = setTimeout(() => {
      onClose(toast.id);
    }, duration);

    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onClose]);

  return (
    <div style={containerStyles} role="alert" aria-live="polite">
      <span style={iconStyles}>
        {toast.icon || <StatusIcon status={status} />}
      </span>
      <div style={contentStyles}>
        {toast.title && <p style={titleStyles}>{toast.title}</p>}
        {toast.description && <p style={descriptionStyles}>{toast.description}</p>}
      </div>
      {toast.isClosable !== false && (
        <button
          type="button"
          style={closeButtonStyles}
          onClick={() => onClose(toast.id)}
          aria-label="Close notification"
        >
          <CloseIcon />
        </button>
      )}
    </div>
  );
}

/**
 * Toast container component
 */
function ToastContainer({ toasts, onClose }: { toasts: ToastType[]; onClose: (id: string) => void }) {
  const tokens = useTokens();

  // Group toasts by position
  const groupedToasts = useMemo(() => {
    const groups: Record<ToastPosition, ToastType[]> = {
      top: [],
      'top-left': [],
      'top-right': [],
      bottom: [],
      'bottom-left': [],
      'bottom-right': [],
    };

    for (const toast of toasts) {
      const position = toast.position || 'top-right';
      groups[position].push(toast);
    }

    return groups;
  }, [toasts]);

  const containerBaseStyles = useMemo<React.CSSProperties>(() => ({
    position: 'fixed',
    zIndex: tokens.zIndices.toast,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacing[2],
    pointerEvents: 'none',
  }), [tokens]);

  const content = (
    <>
      {(Object.entries(groupedToasts) as [ToastPosition, ToastType[]][]).map(
        ([position, positionToasts]) =>
          positionToasts.length > 0 && (
            <div
              key={position}
              style={{
                ...containerBaseStyles,
                ...positionStyles[position],
                flexDirection: position.includes('bottom') ? 'column-reverse' : 'column',
              }}
            >
              {positionToasts.map((toast) => (
                <div key={toast.id} style={{ pointerEvents: 'auto' }}>
                  <ToastItem toast={toast} onClose={onClose} />
                </div>
              ))}
            </div>
          )
      )}
    </>
  );

  if (typeof document !== 'undefined') {
    return createPortal(content, document.body);
  }

  return content;
}

/**
 * Toast provider props
 */
export interface ToastProviderProps {
  children: ReactNode;
}

/**
 * Toast provider component
 */
export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastType[]>([]);

  const toast = useCallback((config: ToastConfig): string => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newToast: ToastType = {
      ...config,
      id,
      createdAt: Date.now(),
    };

    setToasts((prev) => [...prev, newToast]);
    return id;
  }, []);

  const close = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const closeAll = useCallback(() => {
    setToasts([]);
  }, []);

  const contextValue = useMemo<ToastContextValue>(
    () => ({
      toasts,
      toast,
      close,
      closeAll,
    }),
    [toasts, toast, close, closeAll]
  );

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <ToastContainer toasts={toasts} onClose={close} />
    </ToastContext.Provider>
  );
}

/**
 * Hook to access toast context
 */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }

  return context;
}

export { ToastContext };
