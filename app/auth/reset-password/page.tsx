'use client';

import { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Form, Alert, Spinner } from 'react-bootstrap';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { triggerLightHaptic, triggerMediumHaptic, triggerSuccessHaptic } from '@/lib/utils/haptics';
import LoadingView from '@/components/LoadingView';
import HapticButton from '@/components/HapticButton';
import HapticLink from '@/components/HapticLink';

const supabase = createClient();

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isProfileUpdate, setIsProfileUpdate] = useState(false);
  
  const router = useRouter();

  useEffect(() => {
    // Check if we are in profile update mode (from settings)
    const isRecovery = window.location.hash.includes('type=recovery') || window.location.search.includes('type=recovery');
    if (!isRecovery) {
      setIsProfileUpdate(true);
    }

    console.log('ResetPasswordPage mounted. Profile Update:', !isRecovery);
    
    const handleSession = async () => {
      // 1. Check if we already have a session
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (currentSession) {
        console.log('Session already exists');
        setCheckingAuth(false);
        return;
      }

      // 2. Try to parse hash manually (Implicit Flow)
      const hash = window.location.hash.substring(1);
      if (hash) {
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        const type = params.get('type');

        if (accessToken && refreshToken && type === 'recovery') {
          console.log('Manually detected recovery tokens, setting session...');
          const { error: setSessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });

          if (!setSessionError) {
            console.log('Manual session set successful');
            setCheckingAuth(false);
            return;
          }
        }
      }

      // 3. Check for PKCE 'code' in query params
      const searchParams = new URLSearchParams(window.location.search);
      const code = searchParams.get('code');
      if (code) {
        console.log('Detected PKCE code, manually attempting exchange...');
        // On some platforms, Supabase doesn't auto-exchange the code
        // so we manually call it here.
        try {
          // Note: createClient should be browser-safe
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
             console.error('Exchange error:', exchangeError);
             // We don't throw yet, as Supabase might have already done it
          } else {
             console.log('Manual code exchange success!');
             setCheckingAuth(false);
             return;
          }
        } catch (e) {
          console.error('PKCE exchange error:', e);
        }
      }
    };

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth event in ResetPasswordPage:', event);
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && window.location.hash.includes('type=recovery')) || session) {
        setCheckingAuth(false);
      }
    });

    handleSession();

    // Fallback: final check after a delay
    const timer = setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        const hasHashToken = window.location.hash.includes('access_token=');
        const hasCodeParam = window.location.search.includes('code=');

        if (hasHashToken || hasCodeParam) {
           console.log('Token or code present, suppressing error to allow more time');
           // If we still have no session after 8 seconds total, THEN show error
           setTimeout(async () => {
             const { data: { session: lastTry } } = await supabase.auth.getSession();
             if (!lastTry) {
               setError('Invalid or expired reset link. Please request a new one.');
               setCheckingAuth(false);
             }
           }, 4000);
        } else {
          setError('Invalid or expired reset link. Please request a new one from the login page.');
          setCheckingAuth(false);
        }
      } else {
        setCheckingAuth(false);
      }
    }, 4000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);
    triggerMediumHaptic();

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) throw updateError;
      
      // Explicitly sign out to force re-login with new credentials
      await supabase.auth.signOut();
      
      setMessage('🏁 Password updated successfully! Please log in with your new credentials.');
      triggerSuccessHaptic();
      
      setTimeout(() => {
        router.push('/auth');
      }, 3000);
    } catch (err: unknown) {
      console.error('Update Password Error:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (isProfileUpdate) {
      triggerLightHaptic();
      router.push('/settings');
    } else {
      setLoading(true);
      triggerLightHaptic();
      await supabase.auth.signOut();
      router.push('/auth');
    }
  };

  if (checkingAuth) {
    return <LoadingView />;
  }

  return (
    <Container className="mt-5">
      <Row className="justify-content-center">
        <Col md={6} lg={5}>
          <Card className="f1-glass-card border-secondary border-opacity-50">
            <div className={`py-2 px-4 text-white fw-bold text-uppercase letter-spacing-2 small d-flex align-items-center justify-content-between ${isProfileUpdate ? 'bg-secondary bg-opacity-25' : 'bg-danger'}`}>
              <span>{isProfileUpdate ? 'Change Password' : 'Set New Password'}</span>
              <span className="opacity-50" style={{ fontSize: '0.6rem' }}>P10 RACING</span>
            </div>
            <Card.Body className="p-4 p-md-5">
              <div className="text-center mb-4">
                <h1 className="h3 fw-bold text-white mb-2 letter-spacing-1">GRID <span className="text-danger">SECURITY</span></h1>
                <p className="text-muted small opacity-75">
                  {isProfileUpdate ? 'Update your account security.' : 'Account verified via recovery link.'}
                </p>
                {!isProfileUpdate && (
                  <div className="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-20 px-3 py-2 rounded-pill extra-small fw-bold mt-2">
                    ACTION REQUIRED: SET NEW PASSWORD
                  </div>
                )}
              </div>

              {error && <Alert variant="danger" className="py-2 small border-0 bg-danger bg-opacity-10 text-danger mb-4">{error}</Alert>}
              {message && <Alert variant="success" className="py-2 small border-0 bg-success bg-opacity-10 text-success mb-4">{message}</Alert>}

              {!message && (
                <Form onSubmit={handleUpdatePassword}>
                  <Form.Group className="mb-3">
                    <Form.Label className="text-white small text-uppercase fw-bold opacity-75 letter-spacing-1">New Password</Form.Label>
                    <Form.Control 
                      type="password" 
                      placeholder="••••••••" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="f1-input-dark py-2 rounded-3"
                    />
                  </Form.Group>

                  <Form.Group className="mb-4">
                    <Form.Label className="text-white small text-uppercase fw-bold opacity-75 letter-spacing-1">Confirm Password</Form.Label>
                    <Form.Control 
                      type="password" 
                      placeholder="••••••••" 
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="f1-input-dark py-2 rounded-3"
                    />
                  </Form.Group>

                  <HapticButton 
                    hapticStyle="medium"
                    type="submit" 
                    className="btn-f1 w-100 py-3 fw-bold mb-3 rounded-pill" 
                    disabled={loading || !!error}
                  >
                    {loading ? <Spinner animation="border" size="sm" /> : isProfileUpdate ? 'CHANGE PASSWORD' : 'UPDATE PASSWORD'}
                  </HapticButton>

                  <div className="text-center mt-3 pt-3 border-top border-secondary border-opacity-10">
                    <button 
                      type="button" 
                      className="btn btn-link text-muted text-decoration-none extra-small fw-bold opacity-50 hover-opacity-100"
                      onClick={handleCancel}
                      disabled={loading}
                    >
                      {isProfileUpdate ? 'CANCEL' : 'CANCEL & RETURN TO LOGIN'}
                    </button>
                  </div>
                </Form>
              )}

              {error && (
                <div className="text-center mt-3">
                  <HapticLink 
                    href="/auth"
                    className="text-danger text-decoration-none small fw-bold"
                  >
                    BACK TO LOGIN
                  </HapticLink>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}
