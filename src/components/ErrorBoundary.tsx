import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * Error boundary for Send flows and wallet components.
 * Shows inline card message on error.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="content-container-centered">
            <div className="card" style={{ padding: '24px', textAlign: 'center' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px' }}>
                Couldn't load balance
              </h2>
              <p style={{ color: '#666', marginBottom: '16px', fontSize: '14px' }}>
                Pull to refresh or try again later.
              </p>
              <button
                className="btn btn-primary"
                onClick={() => {
                  this.setState({ hasError: false, error: undefined });
                  window.location.reload();
                }}
                style={{ width: '100%' }}
              >
                Refresh
              </button>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

