import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleGoHome = () => {
    window.location.hash = '#repos';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div style={styles.container}>
          <div style={styles.card}>
            <div style={styles.iconWrapper}>
              <svg
                width="48"
                height="48"
                viewBox="0 0 48 48"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle cx="24" cy="24" r="22" stroke="#ff3b30" strokeWidth="2" fill="none" />
                <path d="M24 14v12" stroke="#ff3b30" strokeWidth="2.5" strokeLinecap="round" />
                <circle cx="24" cy="33" r="2" fill="#ff3b30" />
              </svg>
            </div>
            <h2 style={styles.title}>页面出现了问题</h2>
            <p style={styles.message}>
              {this.state.error?.message || '发生了未知错误，请稍后重试。'}
            </p>
            {this.state.errorInfo && (
              <details style={styles.details}>
                <summary style={styles.summary}>查看详细信息</summary>
                <pre style={styles.stackTrace}>
                  {this.state.error?.stack}
                </pre>
              </details>
            )}
            <div style={styles.actions}>
              <button onClick={this.handleRetry} style={styles.retryButton}>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  style={{ marginRight: 6, verticalAlign: 'middle' }}
                >
                  <path
                    d="M13.65 2.35A8 8 0 1 0 15 8h-2a6 6 0 1 1-1.76-4.24L10 5h5V0l-1.35 2.35z"
                    fill="currentColor"
                  />
                </svg>
                重试
              </button>
              <button onClick={this.handleGoHome} style={styles.homeButton}>
                返回首页
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    padding: '20px',
    background: 'var(--mac-bg, #f5f5f7)',
  },
  card: {
    background: 'var(--mac-glass, rgba(255, 255, 255, 0.72))',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderRadius: '16px',
    padding: '40px',
    maxWidth: '480px',
    width: '100%',
    textAlign: 'center',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
    border: '1px solid var(--mac-border, rgba(0, 0, 0, 0.06))',
  },
  iconWrapper: {
    marginBottom: '20px',
  },
  title: {
    margin: '0 0 8px 0',
    fontSize: '20px',
    fontWeight: 600,
    color: 'var(--mac-text, #1d1d1f)',
    letterSpacing: '-0.01em',
  },
  message: {
    margin: '0 0 20px 0',
    fontSize: '14px',
    lineHeight: '1.5',
    color: 'var(--mac-text-secondary, #86868b)',
  },
  details: {
    textAlign: 'left',
    marginBottom: '20px',
    borderRadius: '8px',
    background: 'rgba(0, 0, 0, 0.03)',
    border: '1px solid var(--mac-border, rgba(0, 0, 0, 0.06))',
    overflow: 'hidden',
  },
  summary: {
    padding: '10px 14px',
    fontSize: '13px',
    color: 'var(--mac-text-secondary, #86868b)',
    cursor: 'pointer',
    outline: 'none',
    userSelect: 'none',
  },
  stackTrace: {
    margin: 0,
    padding: '10px 14px',
    fontSize: '12px',
    lineHeight: '1.5',
    color: 'var(--mac-text-secondary, #86868b)',
    overflow: 'auto',
    maxHeight: '150px',
    borderTop: '1px solid var(--mac-border, rgba(0, 0, 0, 0.06))',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
  },
  actions: {
    display: 'flex',
    gap: '10px',
    justifyContent: 'center',
  },
  retryButton: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '8px 20px',
    fontSize: '14px',
    fontWeight: 500,
    color: '#fff',
    background: 'var(--mac-accent, #007aff)',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'background 0.2s, transform 0.1s',
  },
  homeButton: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '8px 20px',
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--mac-accent, #007aff)',
    background: 'transparent',
    border: '1px solid var(--mac-accent, #007aff)',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'background 0.2s, transform 0.1s',
  },
};

export default ErrorBoundary;
