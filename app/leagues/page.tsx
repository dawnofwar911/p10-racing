'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, Spinner, Table } from 'react-bootstrap';
import { createClient } from '@/lib/supabase/client';
import { Session, PostgrestError } from '@supabase/supabase-js';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { CURRENT_SEASON } from '@/lib/data';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import LoadingView from '@/components/LoadingView';

interface League {
  id: string;
  name: string;
  invite_code: string;
  created_at: string;
}

function LeaguesContent() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [newLeagueName, setNewLeagueName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [localGuests, setLocalGuests] = useState<string[]>([]);

  const supabase = createClient();
  const searchParams = useSearchParams();

  const fetchLeagues = useCallback(async (userId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('leagues')
        .select('*, league_members!inner(user_id)')
        .eq('league_members.user_id', userId);

      if (error) throw error;
      setLeagues(data || []);
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    async function init() {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      setSession(currentSession);
      
      // Load local guests for migration
      const guests = JSON.parse(localStorage.getItem('p10_players') || '[]');
      setLocalGuests(guests);

      if (currentSession) {
        fetchLeagues(currentSession.user.id);
      } else {
        setLoading(false);
      }

      // Check for join parameter
      const joinCode = searchParams.get('join');
      if (joinCode) {
        setInviteCode(joinCode);
      }
    }
    init();
  }, [supabase, fetchLeagues, searchParams]);

  const handleImport = async (guestName: string) => {
    if (!session) return;
    setActionLoading(true);
    setError(null);
    Haptics.impact({ style: ImpactStyle.Heavy });

    try {
      // Find all predictions for this guest in localStorage
      let count = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;

        let season = CURRENT_SEASON;
        let raceId = '';
        let match = false;

        // Pattern 1: final_pred_SEASON_USERNAME_ROUND
        if (key.startsWith('final_pred_')) {
          const parts = key.split('_');
          if (parts.length >= 5 && parts[3] === guestName) {
            season = parseInt(parts[2]);
            raceId = parts[4];
            match = true;
          } 
          // Pattern 2: final_pred_USERNAME_ROUND (Old style)
          else if (parts.length === 4 && parts[2] === guestName) {
            season = CURRENT_SEASON; // Default to current
            raceId = parts[3];
            match = true;
          }
        }

        if (match) {
          const predStr = localStorage.getItem(key);
          if (!predStr) continue;
          const pred = JSON.parse(predStr);
          
          if (pred) {
            const { error: upsertError } = await supabase
              .from('predictions')
              .upsert({
                user_id: session.user.id,
                race_id: `${season}_${raceId}`,
                p10_driver_id: pred.p10,
                dnf_driver_id: pred.dnf,
                updated_at: new Date().toISOString()
              }, { onConflict: 'user_id, race_id' });
            
            if (!upsertError) count++;
          }
        }
      }
      setSuccess(`Successfully imported ${count} predictions to your cloud account!`);
      
      // Post-migration cleanup
      const currentGuests = JSON.parse(localStorage.getItem('p10_players') || '[]');
      const filteredGuests = currentGuests.filter((g: string) => g !== guestName);
      localStorage.setItem('p10_players', JSON.stringify(filteredGuests));
      setLocalGuests(filteredGuests);
      
      // Cleanup the actual prediction keys
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && (key.includes(`_final_pred_${guestName}_`) || key.startsWith(`final_pred_${guestName}_`) || (key.startsWith('final_pred_') && key.includes(`_${guestName}_`)))) {
          localStorage.removeItem(key);
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError('Migration failed: ' + err.message);
      } else {
        setError('Migration failed with an unknown error.');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateLeague = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) {
      setError('You must be signed in to create a league.');
      return;
    }
    setActionLoading(true);
    setError(null);
    setSuccess(null);
    Haptics.impact({ style: ImpactStyle.Medium });

    try {
      // 1. Insert league
      const { data: leagues, error: leagueError } = await supabase
        .from('leagues')
        .insert([{ 
          name: newLeagueName.trim(), 
          created_by: session.user.id 
        }])
        .select();

      if (leagueError) throw leagueError;

      if (!leagues || leagues.length === 0) {
        throw new Error('League created but no data returned.');
      }

      const league = leagues[0];

      // 2. Add creator as first member
      const { error: memberError } = await supabase
        .from('league_members')
        .insert([{ 
          league_id: league.id, 
          user_id: session.user.id 
        }]);

      if (memberError) {
        setError(`League created, but failed to join: ${memberError.message}`);
      } else {
        setSuccess(`League "${league.name}" created!`);
        setNewLeagueName('');
      }

      // 3. Refresh list
      fetchLeagues(session.user.id);
    } catch (err: unknown) {
      console.error('Full creation flow error:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred during league creation.');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleJoinLeague = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    setActionLoading(true);
    Haptics.impact({ style: ImpactStyle.Medium });

    try {
      const { data: league, error: leagueError } = await supabase
        .from('leagues')
        .select('id, name')
        .eq('invite_code', inviteCode.trim())
        .single();

      if (leagueError) throw new Error('Invalid invite code.');

      const { error: joinError } = await supabase
        .from('league_members')
        .insert([{ league_id: league.id, user_id: session.user.id }]);

      if (joinError) {
        const pgErr = joinError as PostgrestError;
        if (pgErr.code === '23505') throw new Error('You are already a member of this league.');
        throw joinError;
      }

      setInviteCode('');
      if (session?.user?.id) fetchLeagues(session.user.id);
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (!session && !loading) {
    return (
      <Container className="mt-5 text-center">
        <div className="display-4 mb-4">🏆</div>
        <h1 className="fw-bold text-white">Multiplayer Leagues</h1>
        <p className="text-muted mb-5">Sign in to create or join private leagues and compete with your friends.</p>
        <Link href="/auth" passHref legacyBehavior>
          <Button className="btn-f1 px-5 py-3 fw-bold">SIGN IN TO PLAY</Button>
        </Link>
      </Container>
    );
  }

  if (loading && !leagues.length) {
    return <LoadingView />;
  }

  return (
    <>
      <Container className="mt-4 mb-5">
        <h1 className="h2 fw-bold text-uppercase letter-spacing-1 mb-4 text-white">Your Leagues</h1>

        {error && <Alert variant="danger" dismissible onClose={() => setError(null)}>{error}</Alert>}
        {success && <Alert variant="success" dismissible onClose={() => setSuccess(null)}>{success}</Alert>}

        <Row className="g-4">
          <Col lg={8}>
            <Card className="border-secondary shadow-sm mb-4">
              <Card.Header className="bg-dark border-secondary py-3">
                <h3 className="h6 mb-0 text-uppercase fw-bold text-danger letter-spacing-1">Active Competitions</h3>
              </Card.Header>
              <Card.Body className="p-0">
                {loading ? (
                  <div className="text-center py-5"><Spinner animation="border" variant="danger" /></div>
                ) : leagues.length > 0 ? (
                  <Table variant="dark" hover responsive className="mb-0">
                    <thead>
                      <tr className="bg-dark bg-opacity-50 text-uppercase letter-spacing-1 small">
                        <th className="ps-4 py-3">League Name</th>
                        <th className="py-3">Invite Code</th>
                        <th className="text-end pe-4 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leagues.map(league => (
                        <tr key={league.id} style={{ height: '60px', verticalAlign: 'middle' }}>
                          <td className="ps-4 fw-bold text-white fs-5">{league.name}</td>
                          <td><code className="text-danger fw-bold">{league.invite_code}</code></td>
                          <td className="text-end pe-4">
                            <Link href={`/leagues/view?id=${league.id}`} passHref legacyBehavior>
                              <Button variant="outline-light" size="sm" className="rounded-pill px-4 fw-bold">VIEW</Button>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                ) : (
                  <div className="text-center py-5 text-muted">
                    <p>You haven&apos;t joined any leagues yet.</p>
                  </div>
                )}
              </Card.Body>
            </Card>

            {session && localGuests.length > 0 && (
              <Card className="border-warning border-opacity-50 shadow-sm bg-warning bg-opacity-10 mb-4">
                <Card.Header className="bg-dark border-warning border-opacity-25 py-3">
                  <h3 className="h6 mb-0 text-uppercase fw-bold text-warning letter-spacing-1">Import Local Data</h3>
                </Card.Header>
                <Card.Body className="p-4">
                  <p className="small text-white opacity-75 mb-4">We found existing scores on this phone. Select a name to move those points into your new cloud account.</p>
                  <div className="d-flex flex-wrap gap-3">
                    {localGuests.map(guest => (
                      <div key={guest} className="d-flex align-items-center bg-dark p-2 rounded border border-secondary">
                        <span className="fw-bold me-3 ps-2 text-white">{guest}</span>
                        <Button 
                          variant="warning" 
                          size="sm" 
                          className="fw-bold" 
                          onClick={() => handleImport(guest)}
                          disabled={actionLoading}
                        >
                          IMPORT
                        </Button>
                      </div>
                    ))}
                  </div>
                </Card.Body>
              </Card>
            )}
          </Col>

          <Col lg={4}>
            <Card className="border-secondary mb-4 shadow-sm">
              <Card.Header className="bg-dark border-secondary py-3">
                <h3 className="h6 mb-0 text-uppercase fw-bold text-white letter-spacing-1">Create League</h3>
              </Card.Header>
              <Card.Body className="p-4">
                <Form onSubmit={handleCreateLeague}>
                  <Form.Group className="mb-3">
                    <Form.Label className="small text-muted text-uppercase fw-bold">League Name</Form.Label>
                    <Form.Control type="text" placeholder="e.g. The Silverstone Club" value={newLeagueName} onChange={(e) => setNewLeagueName(e.target.value)} required className="bg-dark text-white border-secondary py-2" />
                  </Form.Group>
                  <Button type="submit" className="btn-f1 w-100 py-2 fw-bold" disabled={actionLoading}>
                    {actionLoading ? <Spinner animation="border" size="sm" /> : 'CREATE'}
                  </Button>
                </Form>
              </Card.Body>
            </Card>

            <Card className="border-danger border-opacity-50 shadow-sm">
              <Card.Header className="bg-dark border-danger border-opacity-25 py-3">
                <h3 className="h6 mb-0 text-uppercase fw-bold text-white letter-spacing-1">Join League</h3>
              </Card.Header>
              <Card.Body className="p-4">
                <Form onSubmit={handleJoinLeague}>
                  <Form.Group className="mb-3">
                    <Form.Label className="small text-muted text-uppercase fw-bold">Invite Code</Form.Label>
                    <Form.Control type="text" placeholder="Enter 8-digit code" value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} required className="bg-dark text-white border-secondary py-2" />
                  </Form.Group>
                  <Button type="submit" variant="outline-danger" className="w-100 py-2 fw-bold" disabled={actionLoading}>
                    {actionLoading ? <Spinner animation="border" size="sm" /> : 'JOIN'}
                  </Button>
                </Form>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    </>
  );
}

export default function LeaguesPage() {
  return (
    <Suspense fallback={<LoadingView />}>
      <LeaguesContent />
    </Suspense>
  );
}
