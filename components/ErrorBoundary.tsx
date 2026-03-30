'use client';

import React from 'react';
import { Container } from 'react-bootstrap';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import HapticButton from './HapticButton';
import HapticLink from './HapticLink';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('P10 ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <Container className="d-flex flex-column align-items-center justify-content-center min-vh-100 text-center px-4">
          <div className="f1-glass-card p-4 border-danger border-opacity-25 shadow-lg w-100" style={{ maxWidth: '400px' }}>
            <div className="bg-danger bg-opacity-10 p-3 rounded-circle d-inline-flex align-items-center justify-content-center mb-3 border border-danger border-opacity-20">
              <AlertCircle size={48} className="text-danger" />
            </div>
            
            <h1 className="h3 fw-bold text-white mb-2 letter-spacing-1 uppercase">ENGINE FAILURE</h1>
            <p className="text-white opacity-60 mb-4 small">
              Something went wrong in the pit lane. The app encountered an unexpected error and had to stop.
            </p>
            
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="bg-black bg-opacity-50 p-2 rounded mb-4 text-start overflow-auto" style={{ maxHeight: '150px' }}>
                <code className="extra-small text-danger" style={{ fontSize: '0.65rem' }}>
                  {this.state.error.message}
                </code>
              </div>
            )}
            
            <div className="d-grid gap-2">
              <HapticButton 
                variant="danger" 
                haptic="medium" 
                className="btn-lg fw-bold rounded-pill py-3 d-flex align-items-center justify-content-center"
                onClick={this.handleReset}
              >
                <RefreshCw size={18} className="me-2" />
                RETRY SESSION
              </HapticButton>
              
              <HapticLink 
                href="/" 
                haptic="medium" 
                className="btn btn-outline-light btn-lg fw-bold rounded-pill py-3 opacity-75 d-flex align-items-center justify-content-center text-decoration-none"
                onClick={() => this.setState({ hasError: false, error: null })}
              >
                <Home size={18} className="me-2" />
                RETURN HOME
              </HapticLink>
            </div>
          </div>
          
          <p className="mt-4 extra-small text-white opacity-30 letter-spacing-2 uppercase">
            P10 RACING • ERROR CODE 500
          </p>
        </Container>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
