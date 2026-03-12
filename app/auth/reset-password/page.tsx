'use client';

import { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, Spinner } from 'react-bootstrap';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import LoadingView from '@/components/LoadingView';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    console.log('ResetPasswordPage mounted. Hash:', window.location.hash);
    
    // Listen for the initial session or recovery event
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth event in ResetPasswordPage:', event, session ? 'Session exists' : 'No session');
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && window.location.hash.includes('type=recovery'))) {
        console.log('Detected password recovery flow');
        setCheckingAuth(false);
      } else if (session) {
        setCheckingAuth(false);
      }
    });

    // Fallback: check if we already have a session after a brief delay
    // to allow the URL fragment to be processed
    const timer = setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      console.log('Fallback session check:', session ? 'Session exists' : 'No session');
      
      if (!session) {
        // Double check if there is a recovery token in the hash but Supabase missed it
        if (window.location.hash.includes('access_token=') && window.location.hash.includes('type=recovery')) {
          console.log('Hash contains recovery token but no session found. Attempting manual session refresh...');
          // Sometimes refreshing the page or waiting longer helps, but let's try to show the form anyway
          // as the hash is present.
          setCheckingAuth(false);
        } else {
          setError('Invalid or expired reset link. Please request a new one from the login page.');
          setCheckingAuth(false);
        }
      } else {
        setCheckingAuth(false);
      }
    }, 5000); // Increased to 5 seconds for slower connections/processing

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, [supabase]);

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
    Haptics.impact({ style: ImpactStyle.Medium });

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) throw updateError;
      
      setMessage('Password updated successfully! Redirecting to login...');
      Haptics.notification({ type: NotificationType.Success });
      
      setTimeout(() => {
        router.push('/auth');
      }, 2000);
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

  if (checkingAuth) {
    return <LoadingView />;
  }

  return (
    <Container className="mt-5">
      <Row className="justify-content-center">
        <Col md={6} lg={5}>
          <Card className="border-secondary shadow-lg overflow-hidden">
            <div className="bg-danger py-2 px-4 text-white fw-bold text-uppercase letter-spacing-1 small">
              Set New Password
            </div>
            <Card.Body className="p-4 p-md-5">
              <div className="text-center mb-4">
                <h1 className="h3 fw-bold text-white mb-2">P10 RACING</h1>
                <p className="text-muted small">Enter your new password below.</p>
              </div>

              {error && <Alert variant="danger" className="py-2 small">{error}</Alert>}
              {message && <Alert variant="success" className="py-2 small">{message}</Alert>}

              {!message && (
                <Form onSubmit={handleUpdatePassword}>
                  <Form.Group className="mb-3">
                    <Form.Label className="text-muted small text-uppercase fw-bold">New Password</Form.Label>
                    <Form.Control 
                      type="password" 
                      placeholder="••••••••" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="bg-dark text-white border-secondary py-2"
                    />
                  </Form.Group>

                  <Form.Group className="mb-4">
                    <Form.Label className="text-muted small text-uppercase fw-bold">Confirm Password</Form.Label>
                    <Form.Control 
                      type="password" 
                      placeholder="••••••••" 
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="bg-dark text-white border-secondary py-2"
                    />
                  </Form.Group>

                  <Button 
                    type="submit" 
                    className="btn-f1 w-100 py-3 fw-bold mb-3" 
                    disabled={loading || !!error}
                  >
                    {loading ? <Spinner animation="border" size="sm" /> : 'UPDATE PASSWORD'}
                  </Button>
                </Form>
              )}

              {error && (
                <div className="text-center">
                  <Button 
                    variant="link" 
                    className="text-danger text-decoration-none small fw-bold"
                    onClick={() => router.push('/auth')}
                  >
                    BACK TO LOGIN
                  </Button>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}
