'use client';

import { useState } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, Spinner } from 'react-bootstrap';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import AppNavbar from '@/components/AppNavbar';

export default function AuthPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const supabase = createClient();
  const router = useRouter();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    Haptics.impact({ style: ImpactStyle.Medium });

    try {
      if (isSignUp) {
        // 1. Sign up the user
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
        });

        if (authError) throw authError;

        if (authData.user) {
          // 2. Create the public profile
          const { error: profileError } = await supabase
            .from('profiles')
            .upsert([
              { id: authData.user.id, username: username }
            ]);

          if (profileError) throw profileError;
        }
        
        alert('Check your email for the confirmation link (if enabled)!');
      } else {
        // Login
        const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (loginError) throw loginError;

        // PROFILE REPAIR: Ensure profile exists on login
        if (loginData.user) {
          const { data: existingProfile } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', loginData.user.id)
            .single();
          
          if (!existingProfile) {
            // If profile is missing, try to create one using email prefix as guest fallback
            const fallbackName = loginData.user.email?.split('@')[0] || 'User';
            await supabase.from('profiles').upsert([{ id: loginData.user.id, username: fallbackName }]);
          }
        }
        
        router.push('/');
        router.refresh();
      }
    } catch (err: any) {
      console.error('Detailed Auth Error:', err);
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main>
      <AppNavbar />
      <Container className="mt-5">
        <Row className="justify-content-center">
          <Col md={6} lg={5}>
            <Card className="border-secondary shadow-lg overflow-hidden">
              <div className="bg-danger py-2 px-4 text-white fw-bold text-uppercase letter-spacing-1 small">
                {isSignUp ? 'New Player Registration' : 'Player Login'}
              </div>
              <Card.Body className="p-4 p-md-5">
                <div className="text-center mb-4">
                  <h1 className="h3 fw-bold text-white mb-2">P10 RACING</h1>
                  <p className="text-muted small">Enter the midfield battle.</p>
                </div>

                {error && <Alert variant="danger" className="py-2 small">{error}</Alert>}

                <Form onSubmit={handleAuth}>
                  {isSignUp && (
                    <Form.Group className="mb-3">
                      <Form.Label className="text-muted small text-uppercase fw-bold">Username</Form.Label>
                      <Form.Control 
                        type="text" 
                        placeholder="e.g. LandoFan4" 
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        className="bg-dark text-white border-secondary py-2"
                      />
                    </Form.Group>
                  )}

                  <Form.Group className="mb-3">
                    <Form.Label className="text-muted small text-uppercase fw-bold">Email Address</Form.Label>
                    <Form.Control 
                      type="email" 
                      placeholder="name@example.com" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="bg-dark text-white border-secondary py-2"
                    />
                  </Form.Group>

                  <Form.Group className="mb-4">
                    <Form.Label className="text-muted small text-uppercase fw-bold">Password</Form.Label>
                    <Form.Control 
                      type="password" 
                      placeholder="••••••••" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="bg-dark text-white border-secondary py-2"
                    />
                  </Form.Group>

                  <Button 
                    type="submit" 
                    className="btn-f1 w-100 py-3 fw-bold mb-3" 
                    disabled={loading}
                  >
                    {loading ? <Spinner animation="border" size="sm" /> : (isSignUp ? 'CREATE ACCOUNT' : 'SIGN IN')}
                  </Button>

                  <div className="text-center">
                    <button 
                      type="button"
                      className="btn btn-link text-danger text-decoration-none small fw-bold"
                      onClick={() => setIsSignUp(!isSignUp)}
                    >
                      {isSignUp ? 'ALREADY HAVE AN ACCOUNT? LOGIN' : 'NEED AN ACCOUNT? SIGN UP'}
                    </button>
                  </div>
                </Form>
              </Card.Body>
            </Card>
            <p className="text-center text-muted small mt-4">
              🛡️ Passwords are encrypted and never stored in plain text.
            </p>
          </Col>
        </Row>
      </Container>
    </main>
  );
}
