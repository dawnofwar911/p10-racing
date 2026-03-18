'use client';

import { useState, useEffect, useCallback, Suspense, useRef } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, Spinner, Table } from 'react-bootstrap';
import { createClient } from '@/lib/supabase/client';
import { Haptics, NotificationType } from '@capacitor/haptics';
import { CURRENT_SEASON } from '@/lib/data';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import LoadingView from '@/components/LoadingView';
import PullToRefresh from '@/components/PullToRefresh';
import { withTimeout } from '@/lib/utils/sync-queue';
import { STORAGE_KEYS } from '@/lib/utils/storage';
import { sessionTracker } from '@/lib/utils/session';
import { useAuth } from '@/components/AuthProvider';

interface League {
  id: string;
  name: string;
  invite_code: string;
  created_at: string;
}

function LeaguesContent() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const mountedRef = useRef(true);
  const { session, currentUser, syncVersion, triggerRefresh } = useAuth();

  // 1. Synchronous Cache Initialization
  const [leagues, setLeagues] = useState<League[]>(() => {
    if (typeof window === 'undefined') return [];
    const cached = localStorage.getItem(STORAGE_KEYS.CACHE_LEAGUES);
    return cached ? JSON.parse(cached) : [];
  });

  const [loading, setLoading] = useState(!leagues.length);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [newLeagueName, setNewLeagueName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [localGuests, setLocalGuests] = useState<string[]>([]);

  // Lifecycle
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const fetchLeagues = useCallback(async (quiet = false) => {
    if (!quiet && mountedRef.current) setLoading(true);
    try {
      const { data, error: fetchError } = await withTimeout(supabase
        .from('leagues')
        .select('*')
        .order('created_at', { ascending: false }));

      if (fetchError) throw fetchError;
      if (mountedRef.current) {
        setLeagues(data || []);
        localStorage.setItem(STORAGE_KEYS.CACHE_LEAGUES, JSON.stringify(data || []));
      }
    } catch (err: unknown) {
      if (err instanceof Error && mountedRef.current) setError(err.message);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [supabase]);

  const init = useCallback(async () => {
    try {
      const fingerprint = session?.user.id || currentUser || 'guest';
      const isFirstView = sessionTracker.isFirstView('leagues', fingerprint);
      
      const guestsData = JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAYERS_LIST) || '[]');
      const guests = (Array.isArray(guestsData) ? guestsData : []).filter((g: string) => typeof g === 'string' && g.trim().length > 0);
      if (mountedRef.current) setLocalGuests(guests);

      if (session) {
        // Only refresh leagues if it's the first view or we have none
        if (leagues.length === 0 || isFirstView) {
          await fetchLeagues(leagues.length > 0);
        } else {
          setLoading(false);
        }
      } else if (mountedRef.current) {
        setLoading(false);
      }

      const joinCode = searchParams.get('join');
      if (joinCode && mountedRef.current) setInviteCode(joinCode);
      } catch (err) {
      console.error('Leagues: Init error:', err);
      }
      }, [fetchLeagues, searchParams, leagues.length, session, currentUser, syncVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    init();
    const handleResume = () => {
      console.log('Leagues: App resumed (background).');
      triggerRefresh();
    };
    window.addEventListener('p10:app_resume', handleResume);
    return () => window.removeEventListener('p10:app_resume', handleResume);
  }, [init, triggerRefresh]);

  const handleImport = async (guestName: string) => {
    if (!session) return;
    setActionLoading(true);
    setError(null);
    try {
      // 1. Get guest predictions
      const localPlayers: string[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAYERS_LIST) || '[]');
      if (!localPlayers.includes(guestName)) throw new Error('Guest profile not found.');

      // Check all possible rounds (max 24)
      const importPromises = [];
      for (let round = 1; round <= 24; round++) {
        const key = getPredictionKey(CURRENT_SEASON, guestName, round.toString());
        const predStr = localStorage.getItem(key);
        if (predStr) {
          const pred = JSON.parse(predStr);
          importPromises.push(
            supabase.from('predictions').upsert({
              user_id: session.user.id,
              race_id: `${CURRENT_SEASON}_${round}`,
              p10_driver_id: pred.p10,
              dnf_driver_id: pred.dnf,
              updated_at: new Date().toISOString()
            }, { onConflict: 'user_id, race_id' })
          );
        }
      }

      if (importPromises.length === 0) {
        showNotification('No predictions found to import for this guest.', 'info');
        return;
      }

      const results = await Promise.all(importPromises);
      const errors = results.filter(r => r.error);
      
      if (errors.length > 0) {
        throw new Error('Some predictions failed to import.');
      }

      // 2. Clean up local guest
      const updatedPlayers = localPlayers.filter(p => p !== guestName);
      localStorage.setItem(STORAGE_KEYS.PLAYERS_LIST, JSON.stringify(updatedPlayers));
      if (mountedRef.current) setLocalGuests(updatedPlayers);
      
      // Remove local keys
      for (let round = 1; round <= 24; round++) {
        localStorage.removeItem(getPredictionKey(CURRENT_SEASON, guestName, round.toString()));
      }

      setSuccess(`Successfully imported ${importPromises.length} predictions!`);
      Haptics.notification({ type: NotificationType.Success });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setActionLoading(false);
    }
  };

  const createLeague = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeagueName.trim() || !session) return;
    setActionLoading(true);
    setError(null);
    try {
      const { data, error: createError } = await withTimeout(supabase
        .from('leagues')
        .insert([{ name: newLeagueName.trim(), created_by: session.user.id }])
        .select()
        .single());

      if (createError) throw createError;
      
      // Auto-join creator
      await withTimeout(supabase
        .from('league_members')
        .insert([{ league_id: data.id, user_id: session.user.id }]));

      setSuccess(`League "${data.name}" created!`);
      setNewLeagueName('');
      fetchLeagues(true);
      Haptics.notification({ type: NotificationType.Success });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setActionLoading(false);
    }
  };

  const joinLeague = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim() || !session) return;
    setActionLoading(true);
    setError(null);
    try {
      // 1. Find league by invite code
      const { data: league, error: findError } = await withTimeout(supabase
        .from('leagues')
        .select('id, name')
        .eq('invite_code', inviteCode.trim().toUpperCase())
        .single());

      if (findError || !league) throw new Error('Invalid invite code.');

      // 2. Join it
      const { error: joinError } = await withTimeout(supabase
        .from('league_members')
        .insert([{ league_id: league.id, user_id: session.user.id }]));

      if (joinError) {
        if (joinError.code === '23505') throw new Error('You are already in this league.');
        throw joinError;
      }

      setSuccess(`Successfully joined "${league.name}"!`);
      setInviteCode('');
      fetchLeagues(true);
      Haptics.notification({ type: NotificationType.Success });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Join failed');
    } finally {
      setActionLoading(false);
    }
  };

  function getPredictionKey(season: number, user: string, round: string) {
    return `final_pred_${season}_${user}_${round}`;
  }

  const showNotification = (msg: string, type: 'success' | 'error' | 'info') => {
    // This is handled by Alert in this page for now
    if (type === 'success') setSuccess(msg);
    else setError(msg);
  };

  return (
    <PullToRefresh onRefresh={() => fetchLeagues(false)}>
      <Container className="mt-4 mb-5">
        <Row className="mb-4 align-items-center">
          <Col>
            <h1 className="h2 mb-1 text-uppercase fw-bold letter-spacing-1">Leagues</h1>
            <p className="text-muted small mb-0">Compete with friends and the world</p>
          </Col>
        </Row>

        {error && <Alert variant="danger" dismissible onClose={() => setError(null)} className="mb-4">{error}</Alert>}
        {success && <Alert variant="success" dismissible onClose={() => setSuccess(null)} className="mb-4">{success}</Alert>}

        {!session ? (
          <Card className="p-4 border-danger border-opacity-25 bg-dark mb-4 text-center">
            <div className="display-6 mb-3">🏁</div>
            <h2 className="h4 fw-bold mb-3 text-uppercase">Online Leagues</h2>
            <p className="text-muted mb-4">Sign in to create or join private leagues and see where you rank against the world.</p>
            <Link href="/auth" passHref legacyBehavior>
              <Button variant="danger" className="fw-bold py-2 px-5 rounded-pill shadow-sm">SIGN IN TO COMPETE</Button>
            </Link>
            
            {localGuests.length > 0 && (
              <div className="mt-5 pt-4 border-top border-secondary border-opacity-25">
                <h3 className="h6 text-muted text-uppercase fw-bold mb-3 letter-spacing-1">Found Guest Data</h3>
                <p className="extra-small text-muted mb-3">You have local guest predictions. Sign in to import them into your online profile.</p>
                <div className="d-flex flex-wrap justify-content-center gap-2">
                  {localGuests.map(g => (
                    <Button key={g} variant="outline-secondary" size="sm" className="rounded-pill px-3" onClick={() => handleImport(g)} disabled={actionLoading}>
                      Import {g}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </Card>
        ) : (
          <>
            <Row className="g-4 mb-5">
              <Col md={6}>
                <Card className="h-100 border-secondary bg-dark bg-opacity-50">
                  <Card.Body className="p-4">
                    <h3 className="h5 fw-bold mb-3 text-uppercase letter-spacing-1">Create a League</h3>
                    <Form onSubmit={createLeague}>
                      <Form.Group className="mb-3">
                        <Form.Control type="text" placeholder="League Name" value={newLeagueName} onChange={(e) => setNewLeagueName(e.target.value)} required className="bg-dark text-white border-secondary" />
                      </Form.Group>
                      <Button type="submit" variant="danger" className="w-100 fw-bold py-2 rounded-pill shadow-sm" disabled={actionLoading}>
                        {actionLoading ? <Spinner size="sm" /> : 'CREATE NEW LEAGUE'}
                      </Button>
                    </Form>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={6}>
                <Card className="h-100 border-secondary bg-dark bg-opacity-50">
                  <Card.Body className="p-4">
                    <h3 className="h5 fw-bold mb-3 text-uppercase letter-spacing-1">Join a League</h3>
                    <Form onSubmit={joinLeague}>
                      <Form.Group className="mb-3">
                        <Form.Control type="text" placeholder="8-Digit Invite Code" value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} required className="bg-dark text-white border-secondary text-uppercase" maxLength={8} />
                      </Form.Group>
                      <Button type="submit" variant="outline-danger" className="w-100 fw-bold py-2 rounded-pill shadow-sm" disabled={actionLoading}>
                        JOIN WITH CODE
                      </Button>
                    </Form>
                  </Card.Body>
                </Card>
              </Col>
            </Row>

            <h2 className="h4 fw-bold mb-4 text-uppercase letter-spacing-1 border-bottom border-danger border-4 pb-2 d-inline-block">Your Active Leagues</h2>
            {loading ? (
              <div className="text-center py-5"><Spinner animation="border" variant="danger" /></div>
            ) : leagues.length === 0 ? (
              <Card className="p-5 border-secondary bg-dark bg-opacity-25 text-center">
                <p className="text-muted mb-0">You haven&apos;t joined any leagues yet. Create one above to get started!</p>
              </Card>
            ) : (
              <div className="table-responsive rounded border border-secondary shadow-sm overflow-hidden">
                <Table variant="dark" hover className="mb-0">
                  <thead><tr className="bg-dark bg-opacity-50 text-uppercase letter-spacing-1 small"><th className="ps-4 py-3">League Name</th><th className="py-3 text-center">Invite Code</th><th className="pe-4 py-3 text-end">Action</th></tr></thead>
                  <tbody>
                    {leagues.map((league) => (
                      <tr key={league.id} className="align-middle" style={{ height: '70px' }}>
                        <td className="ps-4 fw-bold">{league.name}</td>
                        <td className="text-center"><code className="bg-black bg-opacity-50 text-danger px-2 py-1 rounded fw-bold letter-spacing-2">{league.invite_code}</code></td>
                        <td className="pe-4 text-end">
                          <Link href={`/leagues/view?id=${league.id}`} passHref legacyBehavior>
                            <Button variant="outline-light" size="sm" className="rounded-pill px-3 fw-bold">VIEW STANDINGS</Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
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
