'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, Spinner, Table } from 'react-bootstrap';
import { createClient } from '@/lib/supabase/client';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { CURRENT_SEASON } from '@/lib/data';
import Link from 'next/link';
import LoadingView from '@/components/LoadingView';
import PullToRefresh from '@/components/PullToRefresh';
import { useAuth } from '@/components/AuthProvider';

interface League {
  id: string;
  name: string;
  invite_code: string;
  created_at: string;
}

const supabase = createClient();

function LeaguesContent() {
  const { session, isLoading: authLoading } = useAuth();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [newLeagueName, setNewLeagueName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [localGuests, setLocalGuests] = useState<string[]>([]);

  const fetchLeagues = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const { data, error } = await supabase
        .from('leagues')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLeagues(data || []);
      localStorage.setItem('p10_cache_leagues', JSON.stringify(data || []));
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    async function init() {
      // 1. Load from cache first
      const cached = localStorage.getItem('p10_cache_leagues');
      let hasCache = false;
      if (cached) {
        setLeagues(JSON.parse(cached));
        setLoading(false);
        hasCache = true;
      }
      
      // Load local guests for migration
      const guestsData = JSON.parse(localStorage.getItem('p10_players') || '[]');
      const guests = (Array.isArray(guestsData) ? guestsData : []).filter((g: string) => typeof g === 'string' && g.trim().length > 0);
      setLocalGuests(guests);

      if (session) {
        fetchLeagues(hasCache);
      } else if (!authLoading) {
        setLoading(false);
      }
    }
    init();
  }, [session, authLoading, fetchLeagues]);

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
      const { data: leaguesData, error: leagueError } = await supabase
        .from('leagues')
        .insert([{ 
          name: newLeagueName.trim(), 
          created_by: session.user.id 
        }])
        .select();

      if (leagueError) throw leagueError;

      if (!leaguesData || leaguesData.length === 0) {
        throw new Error('League created but no data returned.');
      }

      const league = leaguesData[0];

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
      fetchLeagues();
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
      const code = inviteCode.trim().toLowerCase();
      
      // Use the RPC to join. It returns {id, name} on success or throws an error.
      const { data: joinData, error: joinError } = await supabase
        .rpc('join_league_by_code', { code });

      if (joinError) {
        console.error('Join error:', joinError);
        throw new Error(joinError.message || 'Failed to join league. Check code.');
      }

      setSuccess(`Joined league "${joinData.name}"!`);
      setInviteCode('');
      if (session?.user?.id) fetchLeagues();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (authLoading) {
    return <LoadingView />;
  }

  return (
    <PullToRefresh onRefresh={() => fetchLeagues(false)}>
      <Container className="mt-3 mb-4">
        <h1 className="h4 fw-bold text-uppercase letter-spacing-1 mb-3 text-white ps-1">Leagues</h1>

        {!session ? (
          <div className="text-center py-5 bg-dark bg-opacity-25 rounded border border-secondary border-opacity-25 shadow-sm">
            <div className="display-6 mb-3">🏆</div>
            <h2 className="h5 fw-bold text-white mb-2">Multiplayer Leagues</h2>
            <p className="text-muted small mb-4 px-4">Sign in to create or join private leagues and compete with your friends.</p>
            <Link href="/auth" passHref legacyBehavior>
              <Button className="btn-f1 px-5 py-2 fw-bold small">SIGN IN TO PLAY</Button>
            </Link>
          </div>
        ) : (
          <>
            {error && <Alert variant="danger" dismissible onClose={() => setError(null)} className="py-2 small">{error}</Alert>}
            {success && <Alert variant="success" dismissible onClose={() => setSuccess(null)} className="py-2 small">{success}</Alert>}

            <Row className="g-3">
              <Col lg={8}>
                <Card className="border-secondary shadow-sm mb-3">
                  <Card.Header className="bg-dark border-secondary py-2">
                    <h3 className="extra-small mb-0 text-uppercase fw-bold text-danger letter-spacing-1" style={{ fontSize: '0.65rem' }}>Active Competitions</h3>
                  </Card.Header>
                  <Card.Body className="p-0">
                    {loading && !leagues.length ? (
                      <div className="text-center py-4"><Spinner animation="border" variant="danger" /></div>
                    ) : leagues.length > 0 ? (
                      <Table variant="dark" hover responsive className="mb-0">
                        <thead>
                          <tr className="bg-dark bg-opacity-50 text-uppercase letter-spacing-1 small" style={{ fontSize: '0.6rem' }}>
                            <th className="ps-3 py-2">Name</th>
                            <th className="py-2">Code</th>
                            <th className="text-end pe-3 py-2">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {leagues.map(league => (
                            <tr key={league.id} style={{ height: '45px', verticalAlign: 'middle' }}>
                              <td className="ps-3 fw-bold text-white small">{league.name}</td>
                              <td><code className="text-danger fw-bold extra-small">{league.invite_code}</code></td>
                              <td className="text-end pe-3">
                                <Link href={`/leagues/view?id=${league.id}`} passHref legacyBehavior>
                                  <Button variant="outline-light" size="sm" className="rounded-pill px-3 py-0 fw-bold extra-small" style={{ fontSize: '0.6rem' }}>VIEW</Button>
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    ) : (
                      <div className="text-center py-4 text-muted small">
                        <p className="mb-0">No active leagues.</p>
                      </div>
                    )}
                  </Card.Body>
                </Card>

                {session && localGuests.length > 0 && (
                  <Card className="border-warning border-opacity-50 shadow-sm bg-warning bg-opacity-5 mb-3">
                    <Card.Body className="p-3">
                      <h3 className="extra-small mb-2 text-uppercase fw-bold text-warning letter-spacing-1" style={{ fontSize: '0.6rem' }}>Sync Local Data</h3>
                      <div className="d-flex flex-wrap gap-2">
                        {localGuests.map(guest => (
                          <div key={guest} className="d-flex align-items-center bg-dark p-1 px-2 rounded border border-secondary border-opacity-50">
                            <span className="fw-bold me-2 text-white extra-small" style={{ fontSize: '0.65rem' }}>{guest}</span>
                            <Button 
                              variant="warning" 
                              size="sm" 
                              className="fw-bold extra-small py-0" 
                              style={{ fontSize: '0.6rem' }}
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
                <div className="row g-3">
                  <Col xs={12} md={6} lg={12}>
                    <Card className="border-secondary shadow-sm">
                      <Card.Header className="bg-dark border-secondary py-2">
                        <h3 className="extra-small mb-0 text-uppercase fw-bold text-white letter-spacing-1" style={{ fontSize: '0.65rem' }}>Create League</h3>
                      </Card.Header>
                      <Card.Body className="p-3">
                        <Form onSubmit={handleCreateLeague}>
                          <Form.Group className="mb-2">
                            <Form.Control type="text" placeholder="League Name" value={newLeagueName} onChange={(e) => setNewLeagueName(e.target.value)} required className="bg-dark text-white border-secondary py-1 small" />
                          </Form.Group>
                          <Button type="submit" className="btn-f1 w-100 py-1 fw-bold small" disabled={actionLoading}>
                            {actionLoading ? <Spinner animation="border" size="sm" /> : 'CREATE'}
                          </Button>
                        </Form>
                      </Card.Body>
                    </Card>
                  </Col>

                  <Col xs={12} md={6} lg={12}>
                    <Card className="border-danger border-opacity-50 shadow-sm">
                      <Card.Header className="bg-dark border-danger border-opacity-25 py-2">
                        <h3 className="extra-small mb-0 text-uppercase fw-bold text-white letter-spacing-1" style={{ fontSize: '0.65rem' }}>Join League</h3>
                      </Card.Header>
                      <Card.Body className="p-3">
                        <Form onSubmit={handleJoinLeague}>
                          <Form.Group className="mb-2">
                            <Form.Control type="text" placeholder="Invite Code" value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} required className="bg-dark text-white border-secondary py-1 small" />
                          </Form.Group>
                          <Button type="submit" variant="outline-danger" className="w-100 py-1 fw-bold small" disabled={actionLoading}>
                            {actionLoading ? <Spinner animation="border" size="sm" /> : 'JOIN'}
                          </Button>
                        </Form>
                      </Card.Body>
                    </Card>
                  </Col>
                </div>
              </Col>
            </Row>
          </>
        )}
      </Container>
    </PullToRefresh>
  );
}

export default function LeaguesPage() {
  return (
    <Suspense fallback={<LoadingView />}>
      <LeaguesContent />
    </Suspense>
  );
}
