'use client';

import React from 'react';
import { Container } from 'react-bootstrap';
import { AlertCircle, RefreshCw, Home, CheckCircle } from 'lucide-react';
import HapticButton from './HapticButton';
import HapticLink from './HapticLink';
import { gatherDiagnostics } from '@/lib/utils/diagnostics';
import { createClient } from '@/lib/supabase/client';

// Module-level flag for in-memory prevention
let hasReportedGlobal = false;

// Helper to check sessionStorage for a recent report to prevent duplicates 
// across hydration retries or fast reloads.
const checkSessionGuard = (error: Error): boolean => {
  if (typeof window === 'undefined') return true; // Don't report on server
  try {
    const key = `p10_crash_${error.message.substring(0, 20)}`;
    const lastReport = sessionStorage.getItem(key);
    const now = Date.now();
    
    if (lastReport && (now - parseInt(lastReport)) < 30000) {
      return true; // Already reported in the last 30s
    }
    
    sessionStorage.setItem(key, now.toString());
    return false;
  } catch {
    return false; // Fallback to in-memory only
  }
};

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  reportingStatus: 'idle' | 'reporting' | 'reported' | 'failed';
}

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      reportingStatus: 'idle'
    };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  async componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('P10 ErrorBoundary caught an error:', error, errorInfo);
    
    // Automatically report the crash to Supabase
    this.reportCrash(error, errorInfo);
  }

  async reportCrash(error: Error, errorInfo: React.ErrorInfo) {
    if (hasReportedGlobal) return;
    if (checkSessionGuard(error)) return;

    hasReportedGlobal = true;
    this.setState({ reportingStatus: 'reporting' });

    try {
      const supabase = createClient();
      const diagnostics = await gatherDiagnostics();
      const { data: { session } } = await supabase.auth.getSession();

      const { error: insertError } = await supabase
        .from('bug_reports')
        .insert([{
          user_id: session?.user?.id || null,
          title: `CRITICAL CRASH: ${error.message.substring(0, 50)}`,
          description: `### Crash Details\n**Error:** ${error.message}\n**Component Stack:**\n\`\`\`\n${errorInfo.componentStack}\n\`\`\`\n\n**Stack Trace:**\n\`\`\`\n${error.stack}\n\`\`\``,
          severity: 'Blocker',
          device_info: diagnostics,
          status: 'open'
        }]);

      if (insertError) throw insertError;
      this.setState({ reportingStatus: 'reported' });
    } catch (err) {
      console.error('Failed to report crash:', err);
      this.setState({ reportingStatus: 'failed' });
    }
  }

  handleReset = () => {
    hasReportedGlobal = false;
    this.setState({ hasError: false, error: null, reportingStatus: 'idle' });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const { reportingStatus } = this.state;

      return (
        <Container 
          className="d-flex flex-column align-items-center justify-content-center text-center px-4"
          style={{ 
            minHeight: '100dvh',
            paddingTop: 'env(safe-area-inset-top, 0px)',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)'
          }}
        >
          <div className="f1-glass-card p-4 border-danger border-opacity-25 shadow-lg w-100" style={{ maxWidth: '400px' }}>
            <div className="bg-danger bg-opacity-10 p-3 rounded-circle d-inline-flex align-items-center justify-content-center mb-3 border border-danger border-opacity-20">
              <AlertCircle size={48} className="text-danger" />
            </div>
            
            <h1 className="h3 fw-bold text-white mb-2 letter-spacing-1 uppercase">ENGINE FAILURE</h1>
            <p className="text-white opacity-60 mb-4 small">
              Something went wrong in the pit lane. The app encountered an unexpected error and had to stop.
            </p>

            <div className="mb-4 d-flex align-items-center justify-content-center gap-2">
              {reportingStatus === 'reporting' && (
                <div className="extra-small text-muted letter-spacing-1 uppercase animate-pulse">
                  Sending automated report...
                </div>
              )}
              {reportingStatus === 'reported' && (
                <div className="extra-small text-success fw-bold letter-spacing-1 uppercase d-flex align-items-center">
                  <CheckCircle size={14} className="me-1" /> Automated report sent
                </div>
              )}
              {reportingStatus === 'failed' && (
                <div className="extra-small text-warning letter-spacing-1 uppercase">
                  Report failed (offline?)
                </div>
              )}
            </div>
            
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
                onClick={() => {
                  hasReportedGlobal = false;
                  this.setState({ hasError: false, error: null, reportingStatus: 'idle' });
                }}
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
