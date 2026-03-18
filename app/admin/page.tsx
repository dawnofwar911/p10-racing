'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Container, Row, Col, Form, Button, Card, Table, Spinner, Alert, Modal } from 'react-bootstrap';
import { DRIVERS as FALLBACK_DRIVERS, RACES, CURRENT_SEASON } from '@/lib/data';
import { fetchRaceResults, getFirstDnfDriver, fetchDrivers, fetchCalendar, ApiCalendarRace } from '@/lib/api';
import { Driver, TEAM_COLORS } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import { Haptics, NotificationType } from '@capacitor/haptics';
import { useRouter } from 'next/navigation';
import { withTimeout } from '@/lib/utils/sync-queue';
import { STORAGE_KEYS, getResultsKey } from '@/lib/utils/storage';

interface AdminDriver {
  id: string;
  name: string;
  team: string;
  color: string;
}

export default function AdminPage() {
  const supabase = createClient();
  const router = useRouter();
  const mountedRef = useRef(true);

  // 1. Synchronous Cache Initialization
  const [isAdmin, setIsAdmin] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEYS.IS_ADMIN) === 'true';
  });

  const [drivers, setDrivers] = useState<AdminDriver[]>(FALLBACK_DRIVERS);
  const [results, setResults] = useState<{ [driverId: string]: number }>({});
  const [firstDnf, setFirstDnf] = useState('');
  const [availableRaces, setAvailableRaces] = useState<ApiCalendarRace[]>([]);
  const [selectedRace, setSelectedRace] = useState(RACES[0].id);
  const [season, setSeason] = useState(CURRENT_SEASON);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<{message: string, variant: string} | null>(null);
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [showConfirmPublish, setShowConfirmPublish] = useState(false);
  const [existingResult, setExistingResult] = useState<{p10: string, dnf: string} | null>(null);

  // Lifecycle
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (status) {
      const timer = setTimeout(() => setStatus(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  const checkExistingResults = useCallback(async () => {
    if (!isAdmin || !selectedRace) return;
    try {
      const { data } = await withTimeout(supabase
        .from('verified_results')
        .select('data')
        .eq('id', `${season}_${selectedRace}`)
        .maybeSingle());
      
      if (data?.data && mountedRef.current) {
        const d = data.data as { positions: { [key: string]: number }, firstDnf: string };
        const p10Id = d.positions ? Object.entries(d.positions).find(([, pos]) => pos === 10)?.[0] || 'Unknown' : 'Unknown';
        setExistingResult({ p10: p10Id, dnf: d.firstDnf || 'None' });
      } else if (mountedRef.current) {
        setExistingResult(null);
      }
    } catch (e) {
      console.error('Admin: Error checking results:', e);
    }
  }, [isAdmin, season, selectedRace, supabase]);

  const init = useCallback(async () => {
    try {
      // 2. Truth check
      const { data: { session } } = await withTimeout(supabase.auth.getSession());
      if (!session) {
        router.push('/auth');
        return;
      }

      const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', session.user.id).maybeSingle();
      if (!profile?.is_admin) {
        router.push('/');
        return;
      }

      if (mountedRef.current) {
        setIsAdmin(true);
        localStorage.setItem(STORAGE_KEYS.IS_ADMIN, 'true');
        setLoading(false);
      }
      checkExistingResults();
    } catch (err) {
      console.error('Admin: Init error:', err);
    }
  }, [supabase, router, checkExistingResults]);

  useEffect(() => {
    init();
    const handleResume = () => {
      console.log('Admin: App resumed, refreshing...');
      init();
    };
    window.addEventListener('p10:app_resume', handleResume);
    return () => window.removeEventListener('p10:app_resume', handleResume);
  }, [init]);

  const fallbackRaces = useMemo(() => RACES.map(r => ({
    round: r.id,
    raceName: r.name,
    Circuit: { circuitName: r.circuit },
    date: r.date,
    season: CURRENT_SEASON.toString()
  })), []);

  useEffect(() => {
    if (!isAdmin) return;
    async function load() {
      if (mountedRef.current) setFirstDnf(''); 
      const d = await fetchDrivers(season);
      if (mountedRef.current) {
        if (d.length > 0) {
          setDrivers(d);
          setResults(Object.fromEntries(d.map((driver: Driver, i: number) => [driver.id, i + 1])));
        } else {
          setDrivers(FALLBACK_DRIVERS);
          setResults(Object.fromEntries(FALLBACK_DRIVERS.map((driver, i) => [driver.id, i + 1])));
        }
      }
      const cal = await fetchCalendar(season);
      if (mountedRef.current) {
        if (cal.length > 0) {
          setAvailableRaces(cal);
          setSelectedRace(cal[0].round);
        } else {
          setAvailableRaces(fallbackRaces);
          setSelectedRace(fallbackRaces[0].round);
        }
      }
    }
    load();
  }, [season, isAdmin, fallbackRaces]);

  const handlePositionChange = (driverId: string, position: number) => {
    setResults(prev => ({ ...prev, [driverId]: position }));
  };

  const handleFetchFromApi = async () => {
    setLoading(true);
    setError(null);
    const raceInfo = availableRaces.find(r => r.round === selectedRace);
    if (!raceInfo) {
      setLoading(false);
      return;
    }
    try {
      const data = await fetchRaceResults(season, parseInt(raceInfo.round));
      if (data && mountedRef.current) {
        const participatingDrivers = data.Results.map(r => ({
          id: r.Driver.driverId,
          name: `${r.Driver.givenName} ${r.Driver.familyName}`,
          team: r.Constructor.name,
          color: TEAM_COLORS[r.Constructor.constructorId] || '#B6BABD'
        }));
        setDrivers(participatingDrivers);
        const newResults: { [driverId: string]: number } = {};
        data.Results.forEach(r => { newResults[r.Driver.driverId] = parseInt(r.position); });
        setResults(newResults);
        const dnf = getFirstDnfDriver(data);
        setFirstDnf(dnf?.driverId || '');
        setStatus({ message: 'Data fetched successfully from API.', variant: 'success' });
      } else if (mountedRef.current) {
        setError(`No results found for Season ${season}, Round ${raceInfo.round}.`);
      }
    } catch (err) {
      console.error(err);
      if (mountedRef.current) setError('Failed to fetch data from API.');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  const handleSaveResults = async (target: 'local' | 'global') => {
    if (target === 'global' && existingResult && !showConfirmPublish) {
      setShowConfirmPublish(true);
      return;
    }
    const simplifiedResults = { positions: results, firstDnf: firstDnf };
    if (target === 'local') {
      localStorage.setItem(getResultsKey(season, selectedRace), JSON.stringify(simplifiedResults));
      setStatus({ message: `Results for Round ${selectedRace} saved locally!`, variant: 'info' });
    } else {
      setLoading(true);
      const { error: dbError } = await withTimeout(supabase.from('verified_results').upsert({
        id: `${season}_${selectedRace}`,
        data: simplifiedResults,
        updated_at: new Date().toISOString()
      }));
      if (mountedRef.current) {
        setLoading(false);
        setShowConfirmPublish(false);
        if (dbError) {
          setStatus({ message: 'Global publish error: ' + dbError.message, variant: 'danger' });
        } else {
          setStatus({ message: `Results published! Leaderboard updated GLOBALLY for Round ${selectedRace}.`, variant: 'success' });
          Haptics.notification({ type: NotificationType.Success });
          checkExistingResults();
        }
      }
    }
  };

  const handleNotifyQuali = async () => {
    setShowNotifyModal(false);
    setLoading(true);
    const raceName = availableRaces.find(r => r.round === selectedRace)?.raceName;
    const { error: rpcError } = await withTimeout(supabase.rpc('send_broadcast_notification', {
      p_title: 'Qualifying Results Are In!',
      p_body: `The grid for the ${raceName} is ready. Make your P10 picks now!`,
      p_type: 'quali',
      p_url: '/predict'
    }));
    if (mountedRef.current) {
      setLoading(false);
      if (rpcError) {
        setStatus({ message: 'Notification error: ' + rpcError.message, variant: 'danger' });
      } else {
        setStatus({ message: 'Broadcast notification sent!', variant: 'success' });
        Haptics.notification({ type: NotificationType.Success });
      }
    }
  };

  const handleSendTestNotification = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setLoading(true);
    const { error: rpcError } = await withTimeout(supabase.rpc('send_test_notification', { p_user_id: user.id }));
    if (mountedRef.current) {
      setLoading(false);
      if (rpcError) {
        setStatus({ message: 'Test notification error: ' + rpcError.message, variant: 'danger' });
      } else {
        setStatus({ message: 'Test notification sent to your device!', variant: 'success' });
        Haptics.notification({ type: NotificationType.Success });
      }
    }
  };

  if (!isAdmin || (loading && drivers.length === 0)) {
    return (
      <Container className="vh-100 d-flex align-items-center justify-content-center">
        <Spinner animation="border" variant="danger" />
      </Container>
    );
  }

  return (
    <>
      <Container className="mt-4 mb-5">
        {status && (<Alert variant={status.variant} onClose={() => setStatus(null)} dismissible className="sticky-top mt-2 shadow-sm border-secondary">{status.message}</Alert>)}
        <Row className="mb-4">
          <Col><h1 className="h2 fw-bold text-uppercase letter-spacing-1">Admin Results Entry</h1><div className="d-flex gap-3 align-items-end mt-3 flex-wrap"><Form.Group style={{ maxWidth: '150px' }}><Form.Label className="small text-muted text-uppercase fw-bold">Season</Form.Label><Form.Control type="number" value={season} onChange={(e) => setSeason(parseInt(e.target.value))} className="bg-dark text-white border-secondary" /></Form.Group><Form.Group style={{ maxWidth: '300px' }}><Form.Label className="small text-muted text-uppercase fw-bold">Select Race</Form.Label><Form.Select value={selectedRace} onChange={(e) => setSelectedRace(e.target.value)} className="bg-dark text-white border-secondary" >{availableRaces.map(race => (<option key={race.round} value={race.round}>{race.raceName} (R{race.round})</option>))}</Form.Select></Form.Group><Button variant="outline-info" onClick={handleFetchFromApi} disabled={loading} className="px-4 fw-bold">{loading ? <Spinner animation="border" size="sm" /> : 'FETCH API'}</Button></div>{error && <Alert variant="danger" className="mt-3 py-2">{error}</Alert>}</Col>
        </Row>
        <Row>
          <Col lg={8}>
            <Card className="border-secondary shadow-sm">
              <Card.Header className="bg-dark border-secondary py-3"><h3 className="h6 mb-0 text-uppercase fw-bold text-white">Finishing Order</h3></Card.Header>
              <Card.Body className="p-0"><Table variant="dark" hover responsive className="mb-0"><thead><tr className="bg-dark bg-opacity-50 small text-uppercase"><th className="ps-4 py-3">Driver</th><th>Team</th><th className="pe-4 text-end" style={{ width: '120px' }}>Position</th></tr></thead><tbody>{drivers.map((driver) => (<tr key={driver.id} style={{ height: '60px', verticalAlign: 'middle' }}><td className="ps-4 fw-bold text-white">{driver.name}</td><td className="text-muted small">{driver.team}</td><td className="pe-4"><Form.Control type="number" min="1" max="22" value={results[driver.id] || ''} onChange={(e) => handlePositionChange(driver.id, parseInt(e.target.value))} className="bg-dark text-white border-secondary text-end" /></td></tr>))}</tbody></Table></Card.Body>
            </Card>
          </Col>
          <Col lg={4}>
            {existingResult && (<Card className="border-warning border-opacity-50 mb-4 shadow-sm bg-dark"><Card.Header className="bg-warning bg-opacity-10 border-warning border-opacity-25 py-2"><h3 className="h6 mb-0 text-uppercase fw-bold text-warning" style={{ fontSize: '0.65rem' }}>Existing Verified Data</h3></Card.Header><Card.Body className="p-3"><div className="d-flex justify-content-between mb-2"><span className="small text-white opacity-50 text-uppercase">Current P10:</span><span className="small fw-bold text-white text-uppercase">{existingResult.p10.replace('_', ' ')}</span></div><div className="d-flex justify-content-between"><span className="small text-white opacity-50 text-uppercase">Current DNF:</span><span className="small fw-bold text-danger text-uppercase">{existingResult.dnf.replace('_', ' ')}</span></div></Card.Body></Card>)}
            <Card className="border-secondary mb-4 shadow-sm">
              <Card.Header className="bg-dark border-secondary py-3"><h3 className="h6 mb-0 text-uppercase fw-bold text-white">Verification</h3></Card.Header>
              <Card.Body className="p-4"><Form.Group className="mb-4"><Form.Label className="small text-muted text-uppercase fw-bold">First DNF</Form.Label><Form.Select value={firstDnf} onChange={(e) => setFirstDnf(e.target.value)} className="bg-dark text-white border-secondary" ><option value="">None / All Finished</option>{drivers.map(driver => (<option key={driver.id} value={driver.id}>{driver.name}</option>))}</Form.Select></Form.Group><div className="d-grid gap-3"><Button variant={existingResult ? "warning" : "danger"} size="lg" onClick={() => handleSaveResults('global')} disabled={loading} className={`fw-bold py-3 ${existingResult ? 'text-dark' : ''}`}>{existingResult ? 'CORRECT & RE-CALCULATE' : 'PUBLISH GLOBALLY'}</Button><Button variant="outline-light" onClick={() => handleSaveResults('local')} disabled={loading} className="fw-bold py-2">PUBLISH LOCALLY</Button></div>{existingResult && (<div className="mt-3 extra-small text-warning text-center fw-bold opacity-75">⚠️ THIS WILL RE-CALCULATE ALL PLAYER SCORES</div>)}</Card.Body>
            </Card>
            <Card className="border-secondary mb-4 shadow-sm bg-dark"><Card.Header className="bg-dark border-secondary py-3"><h3 className="h6 mb-0 text-uppercase fw-bold text-white">Push Notifications</h3></Card.Header><Card.Body className="p-4"><div className="d-grid gap-2"><Button variant="warning" onClick={() => setShowNotifyModal(true)} disabled={loading} className="fw-bold text-dark">NOTIFY QUALI FINISHED</Button><Button variant="outline-info" onClick={handleSendTestNotification} disabled={loading} className="fw-bold">SEND TEST TO ME</Button></div><div className="mt-3 small text-muted">Note: Broadcast sends to ALL users with registered tokens.</div></Card.Body></Card>
            <div className="text-center mt-4 opacity-25"><small className="text-uppercase letter-spacing-1">Admin Mode Active</small></div>
          </Col>
        </Row>
      </Container>
      <Modal show={showNotifyModal} onHide={() => setShowNotifyModal(false)} centered contentClassName="bg-dark border-secondary"><Modal.Header closeButton closeVariant="white" className="border-secondary"><Modal.Title className="text-white text-uppercase letter-spacing-1 fs-5 fw-bold">Broadcast Notification?</Modal.Title></Modal.Header><Modal.Body className="text-white opacity-75">This will send a push notification to <strong>ALL</strong> users who have enabled them.<div className="mt-3 p-3 bg-warning bg-opacity-10 border border-warning border-opacity-25 rounded small text-warning">Title: Qualifying Results Are In!<br/>Target Race: {availableRaces.find(r => r.round === selectedRace)?.raceName}</div></Modal.Body><Modal.Footer className="border-secondary"><Button variant="outline-light" onClick={() => setShowNotifyModal(false)} className="rounded-pill px-4">CANCEL</Button><Button variant="warning" onClick={handleNotifyQuali} className="rounded-pill px-4 fw-bold text-dark">SEND BROADCAST</Button></Modal.Footer></Modal>
      <Modal show={showConfirmPublish} onHide={() => setShowConfirmPublish(false)} centered contentClassName="bg-dark border-secondary"><Modal.Header closeButton closeVariant="white" className="border-secondary"><Modal.Title className="text-white text-uppercase letter-spacing-1 fs-5 fw-bold">Correct Global Results?</Modal.Title></Modal.Header><Modal.Body className="text-white opacity-75">You are about to overwrite the verified results for <strong>{availableRaces.find(r => r.round === selectedRace)?.raceName}</strong>.<div className="mt-3 p-3 bg-danger bg-opacity-10 border border-danger border-opacity-25 rounded small text-danger fw-bold">THIS WILL IMMEDIATELY UPDATE THE LEADERBOARD AND POINTS FOR ALL PLAYERS.</div></Modal.Body><Modal.Footer className="border-secondary"><Button variant="outline-light" onClick={() => setShowConfirmPublish(false)} className="rounded-pill px-4">CANCEL</Button><Button variant="warning" onClick={() => handleSaveResults('global')} className="rounded-pill px-4 fw-bold text-dark">CONFIRM & RE-CALCULATE</Button></Modal.Footer></Modal>
    </>
  );
}
