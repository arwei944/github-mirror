import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

const ToastContext = createContext(null);

const TOAST_TYPES = {
  success: { color: '#34c759', icon: '✓', label: '成功' },
  error: { color: '#ff3b30', icon: '✕', label: '错误' },
  warning: { color: '#ff9500', icon: '⚠', label: '警告' },
  info: { color: '#007aff', icon: 'ℹ', label: '信息' },
};

const MAX_TOASTS = 3;

let toastIdCounter = 0;

function generateId() {
  return `toast-${++toastIdCounter}-${Date.now()}`;
}

function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

function ToastItem({ toast, onClose }) {
  const [isExiting, setIsExiting] = useState(false);
  const timerRef = useRef(null);
  const typeConfig = TOAST_TYPES[toast.type] || TOAST_TYPES.info;

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      handleClose();
    }, toast.duration || 3000);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [toast.duration]);

  const handleClose = () => {
    if (isExiting) return;
    setIsExiting(true);
    setTimeout(() => {
      onClose(toast.id);
    }, 300);
  };

  return (
    <div
      style={{
        ...styles.toastItem,
        ...(isExiting ? styles.toastExiting : styles.toastEntering),
        borderLeft: `3px solid ${typeConfig.color}`,
      }}
      role="alert"
    >
      <div style={styles.toastIcon} title={typeConfig.label}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          {toast.type === 'success' && (
            <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z" fill={typeConfig.color} />
          )}
          {toast.type === 'error' && (
            <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06z" fill={typeConfig.color} />
          )}
          {toast.type === 'warning' && (
            <path d="M8 1.5l6.5 11h-13L8 1.5zM8 3.5L3.5 11h9L8 3.5zM7.25 7v2.5h1.5V7h-1.5zm0 4v1h1.5v-1h-1.5z" fill={typeConfig.color} />
          )}
          {toast.type === 'info' && (
            <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 1.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11zM7.25 7v3.5h1.5V7h-1.5zM8 4a.75.75 0 1 0 0 1.5A.75.75 0 0 0 8 4z" fill={typeConfig.color} />
          )}
        </svg>
      </div>
      <span style={styles.toastMessage}>{toast.message}</span>
      <button onClick={handleClose} style={styles.closeButton} aria-label="关闭">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

function ToastContainer() {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div style={styles.container}>
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={removeToast} />
      ))}
    </div>
  );
}

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((type, message, duration = 3000) => {
    const newToast = {
      id: generateId(),
      type,
      message,
      duration,
      createdAt: Date.now(),
    };

    setToasts((prev) => {
      const updated = [...prev, newToast];
      if (updated.length > MAX_TOASTS) {
        return updated.slice(updated.length - MAX_TOASTS);
      }
      return updated;
    });
  }, []);

  const success = useCallback((message, duration) => addToast('success', message, duration), [addToast]);
  const error = useCallback((message, duration) => addToast('error', message, duration), [addToast]);
  const warning = useCallback((message, duration) => addToast('warning', message, duration), [addToast]);
  const info = useCallback((message, duration) => addToast('info', message, duration), [addToast]);

  const contextValue = {
    toasts,
    addToast,
    removeToast,
    success,
    error,
    warning,
    info,
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  );
}

const styles = {
  container: {
    position: 'fixed',
    top: '20px',
    right: '20px',
    zIndex: 99999,
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    maxWidth: '380px',
    width: '100%',
    pointerEvents: 'none',
  },
  toastItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 16px',
    background: 'var(--mac-glass, rgba(255, 255, 255, 0.85))',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderRadius: '10px',
    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.12)',
    border: '1px solid var(--mac-border, rgba(0, 0, 0, 0.06))',
    pointerEvents: 'auto',
    transition: 'all 0.3s ease',
  },
  toastEntering: {
    animation: 'toast-slide-in 0.3s ease forwards',
  },
  toastExiting: {
    animation: 'toast-fade-out 0.3s ease forwards',
  },
  toastIcon: {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '20px',
    height: '20px',
  },
  toastMessage: {
    flex: 1,
    fontSize: '13px',
    lineHeight: '1.4',
    color: 'var(--mac-text, #1d1d1f)',
    wordBreak: 'break-word',
  },
  closeButton: {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '20px',
    height: '20px',
    padding: 0,
    border: 'none',
    background: 'transparent',
    color: 'var(--mac-text-secondary, #86868b)',
    cursor: 'pointer',
    borderRadius: '4px',
    transition: 'background 0.15s',
  },
};

const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes toast-slide-in {
    from {
      opacity: 0;
      transform: translateX(100%);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
  @keyframes toast-fade-out {
    from {
      opacity: 1;
      transform: translateX(0);
    }
    to {
      opacity: 0;
      transform: translateX(100%);
    }
  }
`;
if (typeof document !== 'undefined' && !document.getElementById('toast-keyframes')) {
  styleSheet.id = 'toast-keyframes';
  document.head.appendChild(styleSheet);
}

export { ToastContainer, useToast };
export default ToastProvider;
