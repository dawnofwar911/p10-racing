'use client';

import { useState, useEffect, useCallback, Suspense, useRef } from 'react';
import { Row, Col, Card, Form, Alert, Spinner, Table } from 'react-bootstrap';
import { createClient } from '@/lib/supabase/client';
import { Session } from '@supabase/supabase-js';
import { triggerMediumHaptic, triggerHeavyHaptic, triggerSuccessHaptic } from '@/lib/utils/haptics';
import { CURRENT_SEASON } from '@/lib/data';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import LoadingView from '@/components/LoadingView';
import { withTimeout } from '@/lib/utils/sync-queue';
import { STORAGE_KEYS } from '@/lib/utils/storage';
import { sessionTracker } from '@/lib/utils/session';
import { useAuth } from '@/components/AuthProvider';
import HapticButton from '@/components/HapticButton';
import SwipeablePageLayout from '@/components/SwipeablePageLayout';
import { Trophy, Settings as SettingsIcon } from 'lucide-react';

interface League {
  id: string;
  name: string;
  invite_code: string;
  created_by: string;
  created_at: string;
}

// --- SUB-VIEWS MOVED OUTSIDE TO PREVENT RE-RENDERING LOOPS ---

const MyLeaguesView = ({ 
  loading, 
  leagues, 
  session, 
  localGuests, 
  actionLoading, 
  handleImport 
}: { 
  loading: boolean, 
  leagues: League[], 
  session: Session | null, 
  localGuests: string[], 
  actionLoading: boolean, 
  handleImport: (name: string) => void 
}) => (
  <>
    <div className="table-responsive rounded border border-secondary shadow-sm mb-3">
      {loading && !leagues.length ? (
        <div className="text-center py-4"><Spinner animation="border" variant="danger" /></div>
      ) : leagues.length > 0 ? (
        <Table variant="dark" hover className="mb-0">
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
                    <HapticButton variant="outline-light" size="sm" className="rounded-pill px-3 py-0 fw-bold extra-small" style={{ fontSize: '0.6rem' }}>VIEW</HapticButton>
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
    </div>

    {session && localGuests.length > 0 && (
      <Card className="border-warning border-opacity-50 shadow-sm bg-warning bg-opacity-5 mb-3">
        <Card.Body className="p-3">
          <h3 className="extra-small mb-2 text-uppercase fw-bold text-warning letter-spacing-1" style={{ fontSize: '0.6rem' }}>Sync Local Data</h3>
          <div className="d-flex flex-wrap gap-2">
            {localGuests.map(guest => (
              <div key={guest} className="d-flex align-items-center bg-dark p-1 px-2 rounded border border-secondary border-opacity-50">
                <span className="fw-bold me-2 text-white extra-small" style={{ fontSize: '0.65rem' }}>{guest}</span>
                <HapticButton hapticStyle="medium" variant="warning" size="sm" className="fw-bold extra-small py-0" style={{ fontSize: '0.6rem' }} onClick={() => handleImport(guest)} disabled={actionLoading}>IMPORT</HapticButton>
              </div>
            ))}
          </div>
        </Card.Body>
      </Card>
    )}
  </>
);

const ManageLeaguesView = ({ 
  newLeagueName, 
  setNewLeagueName, 
  handleCreateLeague, 
  inviteCode, 
  setInviteCode, 
  handleJoinLeague, 
  actionLoading 
}: { 
  newLeagueName: string, 
  setNewLeagueName: (v: string) => void, 
  handleCreateLeague: (e: React.FormEvent) => void, 
  inviteCode: string, 
  setInviteCode: (v: string) => void, 
  handleJoinLeague: (e: React.FormEvent) => void, 
  actionLoading: boolean 
}) => (
  <Row className="g-3">
    <Col xs={12}>
      <Card className="border-secondary shadow-sm">
        <Card.Header className="bg-dark border-secondary py-2">
          <h3 className="extra-small mb-0 text-uppercase fw-bold text-white letter-spacing-1" style={{ fontSize: '0.65rem' }}>Create League</h3>
        </Card.Header>
        <Card.Body className="p-3">
          <Form onSubmit={handleCreateLeague}>
            <Form.Group className="mb-2">
              <Form.Control 
                type="text" 
                placeholder="League Name" 
                value={newLeagueName} 
                onChange={(e) => setNewLeagueName(e.target.value)} 
                required 
                className="bg-dark text-white border-secondary py-1 small" 
              />
            </Form.Group>
            <HapticButton hapticStyle="medium" type="submit" className="btn-f1 w-100 py-1 fw-bold small" disabled={actionLoading}>
              {actionLoading ? <Spinner animation="border" size="sm" /> : 'CREATE'}
            </HapticButton>
          </Form>
        </Card.Body>
      </Card>
    </Col>

    <Col xs={12}>
      <Card className="border-danger border-opacity-50 shadow-sm">
        <Card.Header className="bg-dark border-danger border-opacity-25 py-2">
          <h3 className="extra-small mb-0 text-uppercase fw-bold text-white letter-spacing-1" style={{ fontSize: '0.65rem' }}>Join League</h3>
        </Card.Header>
        <Card.Body className="p-3">
          <Form onSubmit={handleJoinLeague}>
            <Form.Group className="mb-2">
              <Form.Control 
                type="text" 
                placeholder="Invite Code" 
                value={inviteCode} 
                onChange={(e) => setInviteCode(e.target.value)} 
                required 
                className="bg-dark text-white border-secondary py-1 small" 
                maxLength={8}
              />
            </Form.Group>
            <HapticButton hapticStyle="medium" type="submit" variant="outline-danger" className="w-100 py-1 fw-bold small" disabled={actionLoading}>
              JOIN
            </HapticButton>
          </Form>
        </Card.Body>
      </Card>
    </Col>
  </Row>
);

const FeedbackAlerts = ({ 
  error, 
  setError, 
  success, 
  setSuccess 
}: { 
  error: string | null, 
  setError: (v: string | null) => void, 
  success: string | null, 
  setSuccess: (v: string | null) => void 
}) => (
  <>
    {error && <Alert variant="danger" dismissible onClose={() => setError(null)} className="py-2 small">{error}</Alert>}
    {success && <Alert variant="success" dismissible onClose={() => setSuccess(null)} className="py-2 small">{success}</Alert>}
  </>
);

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

  const [activeTab, setActiveTab] = useState<'my-leagues' | 'manage'>('my-leagues');

  // Lifecycle
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const fetchLeagues = useCallback(async (quiet = false) => {
    if (!quiet && mountedRef.current) setLoading(true);
    try {
      const { data: leaguesData, error: fetchError } = await withTimeout(supabase
        .from('leagues')
        .select('*')
        .order('created_at', { ascending: false }));

      if (fetchError) throw fetchError;
      
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const currentUserId = currentSession?.user?.id;

      const creatorIds = [...new Set((leaguesData || []).map(l => l.created_by).filter(Boolean))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', creatorIds);

      const profileMap = (profiles || []).reduce((acc, p) => ({ ...acc, [p.id]: p.username }), {} as Record<string, string>);

      const filteredData = (leaguesData || []).filter(league => {
        const creatorUsername = profileMap[league.created_by];
        const isTest = /\b(tester|reviewer)\b/i.test(creatorUsername || '');
        if (!isTest) return true;
        return league.created_by === currentUserId;
      });

      if (mountedRef.current) {
        setLeagues(filteredData);
        localStorage.setItem(STORAGE_KEYS.CACHE_LEAGUES, JSON.stringify(filteredData));
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
        if (leagues.length === 0 || isFirstView) {
          await fetchLeagues(leagues.length > 0);
        } else {
          setLoading(false);
        }
      } else if (mountedRef.current) {
        setLoading(false);
      }

      const joinCode = searchParams.get('join');
      if (joinCode && mountedRef.current) {
        setInviteCode(joinCode);
        setActiveTab('manage');
      }
    } catch (err) {
      console.error('Leagues: Init error:', err);
    }
  }, [fetchLeagues, searchParams, leagues.length, session, currentUser, syncVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    init();
    const handleResume = () => {
      triggerRefresh();
    };
    window.addEventListener('p10:app_resume', handleResume);
    return () => window.removeEventListener('p10:app_resume', handleResume);
  }, [init, triggerRefresh]);

  const handleImport = async (guestName: string) => {
    if (!session) return;
    setActionLoading(true);
    setError(null);
    triggerHeavyHaptic();

    try {
      let count = 0;
      const importPromises = [];
      for (let round = 1; round <= 24; round++) {
        const key = `final_pred_${CURRENT_SEASON}_${guestName}_${round}`;
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
          count++;
        }
      }

      if (importPromises.length === 0) {
        if (mountedRef.current) setError('No predictions found to import for this guest.');
        return;
      }

      const results = await Promise.all(importPromises);
      const errors = results.filter(r => r.error);
      if (errors.length > 0) throw new Error('Some predictions failed to import.');

      if (mountedRef.current) {
        setSuccess(`Successfully imported ${count} predictions!`);
        triggerSuccessHaptic();
      }

      const localPlayers: string[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAYERS_LIST) || '[]');
      const updatedPlayers = localPlayers.filter(p => p !== guestName);
      localStorage.setItem(STORAGE_KEYS.PLAYERS_LIST, JSON.stringify(updatedPlayers));
      if (mountedRef.current) setLocalGuests(updatedPlayers);
      
      for (let round = 1; round <= 24; round++) {
        localStorage.removeItem(`final_pred_${CURRENT_SEASON}_${guestName}_${round}`);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateLeague = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeagueName.trim() || !session) return;
    setActionLoading(true);
    setError(null);
    setSuccess(null);
    triggerMediumHaptic();
    try {
      const { data: leaguesData, error: leagueError } = await withTimeout(supabase
        .from('leagues')
        .insert([{ name: newLeagueName.trim(), created_by: session.user.id }])
        .select());

      if (leagueError) throw leagueError;
      const league = leaguesData?.[0];
      
      if (league) {
        await withTimeout(supabase
          .from('league_members')
          .insert([{ league_id: league.id, user_id: session.user.id }]));

        if (mountedRef.current) {
          setSuccess(`League "${league.name}" created!`);
          setNewLeagueName('');
          triggerSuccessHaptic();
          setActiveTab('my-leagues');
        }
        fetchLeagues(true);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleJoinLeague = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim() || !session) return;
    setActionLoading(true);
    setError(null);
    triggerMediumHaptic();
    try {
      const { data, error: joinError } = await withTimeout(supabase
        .rpc('join_league_by_code', { code: inviteCode.trim().toUpperCase() }));

      if (joinError) throw joinError;

      if (mountedRef.current) {
        setSuccess(`Successfully joined "${data.name}"!`);
        setInviteCode('');
        triggerSuccessHaptic();
        setActiveTab('my-leagues');
      }
      fetchLeagues(true);
    } catch (err: unknown) {
      if (mountedRef.current) {
        const msg = err instanceof Error ? err.message : 'Join failed';
        setError(msg.includes('23505') ? 'You are already in this league.' : 'Invalid invite code.');
      }
    } finally {
      setActionLoading(false);
    }
  };

  if (!session && !loading) {
    return (
      <SwipeablePageLayout
        title="Leagues"
        subtitle="Private Competitions"
        icon={<Trophy size={24} className="text-white" />}
        activeTab="my-leagues"
        onTabChange={() => {}}
        tabs={[{ id: 'my-leagues', label: 'My Leagues' }]}
      >
        <div className="text-center py-5 bg-dark bg-opacity-25 rounded border border-secondary border-opacity-25 shadow-sm mt-3">
          <div className="display-6 mb-3">🏆</div>
          <h2 className="h5 fw-bold text-white mb-2">Multiplayer Leagues</h2>
          <p className="text-muted small mb-4 px-4">Sign in to create or join private leagues and compete with your friends.</p>
          <Link href="/auth" passHref legacyBehavior><HapticButton className="btn-f1 px-5 py-2 fw-bold small">SIGN IN TO PLAY</HapticButton></Link>
        </div>
      </SwipeablePageLayout>
    );
  }

  const myLeaguesView = (
    <MyLeaguesView 
      loading={loading}
      leagues={leagues}
      session={session}
      localGuests={localGuests}
      actionLoading={actionLoading}
      handleImport={handleImport}
    />
  );

  const manageLeaguesView = (
    <ManageLeaguesView 
      newLeagueName={newLeagueName}
      setNewLeagueName={setNewLeagueName}
      handleCreateLeague={handleCreateLeague}
      inviteCode={inviteCode}
      setInviteCode={setInviteCode}
      handleJoinLeague={handleJoinLeague}
      actionLoading={actionLoading}
    />
  );

  return (
    <SwipeablePageLayout
      title="Leagues"
      subtitle="Private Competitions"
      icon={<Trophy size={24} className="text-white" />}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onRefresh={undefined}
      splitOnWide={true}
      splitWidths={[7, 5]}
      tabs={[
        { id: 'my-leagues', label: 'My Leagues', icon: <Trophy size={16} /> },
        { id: 'manage', label: 'Manage', icon: <SettingsIcon size={16} /> }
      ]}
      renderTabContent={(tabId) => (
        tabId === 'my-leagues' ? myLeaguesView : manageLeaguesView
      )}
    >
      <div className="mt-3">
        <FeedbackAlerts 
          error={error}
          setError={setError}
          success={success}
          setSuccess={setSuccess}
        />
        {activeTab === 'my-leagues' ? myLeaguesView : manageLeaguesView}
      </div>
    </SwipeablePageLayout>
  );
}

export default function LeaguesPage() {
  return (
    <Suspense fallback={<LoadingView />}>
      <LeaguesContent />
    </Suspense>
  );
}
