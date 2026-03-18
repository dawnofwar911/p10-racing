'use client';

import { useState, useEffect, Suspense, useCallback, useRef } from 'react';
import { Container, Row, Col, Form, Button, Card, Modal } from 'react-bootstrap';
import { DRIVERS as FALLBACK_DRIVERS, CURRENT_SEASON } from '@/lib/data';
import { fetchCalendar, fetchDrivers, fetchQualifyingResults, fetchRaceResults, ApiResult } from '@/lib/api';
import { Driver } from '@/lib/types';
import { fetchAllSimplifiedResults } from '@/lib/results';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { getContrastColor } from '@/lib/utils/colors';
import { createClient } from '@/lib/supabase/client';
import { Share } from '@capacitor/share';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import LoadingView from '@/components/LoadingView';
import { useNotification } from '@/components/Notification';
import { getDriverDisplayName } from '@/lib/utils/drivers';
import { getActiveRaceIndex } from '@/lib/utils/races';
import HowToPlayButton from '@/components/HowToPlayButton';
import { STORAGE_KEYS, getPredictionKey, getGridKey, getCommunityKey, setStorageItem, removeStorageItem } from '@/lib/utils/storage';
import { useAuth } from '@/components/AuthProvider';
import { sessionTracker } from '@/lib/utils/session';

interface PredictRace {
  id: string;
  name: string;
  circuit: string;
  date: string;
  time: string;
  round: number;
}

interface CommunityPrediction {
  username: string;
  p10: string;
  dnf: string;
}

interface CommunityPredictionData {
  user_id: string;
  p10_driver_id: string;
  dnf_driver_id: string;
}

function PredictPage() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const { showNotification } = useNotification();
  const mountedRef = useRef(true);
  
  const { session, currentUser, isAuthLoading } = useAuth();
  const username = currentUser || '';
  const syncId = sessionTracker.getSyncId();

  // 1. Synchronous Cache Initialization
  const [nextRace, setNextRace] = useState<PredictRace | null>(() => {
    if (typeof window === 'undefined') return null;
    const cached = localStorage.getItem(STORAGE_KEYS.CACHE_NEXT_RACE);
    return cached ? JSON.parse(cached) : null;
  });

  const [drivers, setDrivers] = useState<Driver[]>(() => {
    if (typeof window === 'undefined') return FALLBACK_DRIVERS;
    const cached = localStorage.getItem(STORAGE_KEYS.CACHE_DRIVERS);
    return cached ? JSON.parse(cached) : FALLBACK_DRIVERS;
  });

  const [tempUsername, setTempUsername] = useState('');
  
  const [p10Driver, setP10Driver] = useState(() => {
    if (typeof window === 'undefined') return '';
    const user = localStorage.getItem(STORAGE_KEYS.CACHE_USERNAME) || localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    const cachedRaceStr = localStorage.getItem(STORAGE_KEYS.CACHE_NEXT_RACE);
    if (cachedRaceStr && user) {
      try {
        const raceObj = JSON.parse(cachedRaceStr);
        const predStr = localStorage.getItem(getPredictionKey(CURRENT_SEASON, user, raceObj.id));
        return predStr ? JSON.parse(predStr).p10 : '';
      } catch { return ''; }
    }
    return '';
  });

  const [dnfDriver, setDnfDriver] = useState(() => {
    if (typeof window === 'undefined') return '';
    const user = localStorage.getItem(STORAGE_KEYS.CACHE_USERNAME) || localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    const cachedRaceStr = localStorage.getItem(STORAGE_KEYS.CACHE_NEXT_RACE);
    if (cachedRaceStr && user) {
      try {
        const raceObj = JSON.parse(cachedRaceStr);
        const predStr = localStorage.getItem(getPredictionKey(CURRENT_SEASON, user, raceObj.id));
        return predStr ? JSON.parse(predStr).dnf : '';
      } catch { return ''; }
    }
    return '';
  });

  const [submitted, setSubmitted] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [loadingRace, setLoadingRace] = useState(!nextRace);
  const [isLocked, setIsLocked] = useState(false);
  const [startingGrid, setStartingGrid] = useState<ApiResult[]>([]);
  const [existingPlayers, setExistingPlayers] = useState<string[]>([]);
  const [communityPredictions, setCommunityPredictions] = useState<CommunityPrediction[]>([]);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [isSeasonFinished, setIsSeasonFinished] = useState(false);

  // Lifecycle status
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (searchParams.get('howto') === 'true') {
      setShowHowToPlay(true);
    }
  }, [searchParams]);

  const init = useCallback(async () => {
    let cachedRace: PredictRace | null = null;
    let hasCachedGrid = false;

    // 1. Optimistic cache load (Immediate)
    if (typeof window !== 'undefined') {
      const cachedRaceStr = localStorage.getItem(STORAGE_KEYS.CACHE_NEXT_RACE);
      if (cachedRaceStr && mountedRef.current) {
        try {
          cachedRace = JSON.parse(cachedRaceStr) as PredictRace;
          const cachedGrid = localStorage.getItem(getGridKey(cachedRace.round));
          if (cachedGrid) {
            setStartingGrid(JSON.parse(cachedGrid));
            hasCachedGrid = true;
          }

          const cachedCommunity = localStorage.getItem(getCommunityKey(cachedRace.round));
          if (cachedCommunity) setCommunityPredictions(JSON.parse(cachedCommunity));
        } catch (e) { console.error('Predict: Error parsing cached race', e); }
      }
    }

    // 2. Demand-Driven Sync Check
    const fingerprint = session?.user.id || currentUser || 'guest';
    const isFirstView = sessionTracker.isFirstView('predict', fingerprint);
    const hasData = (nextRace || cachedRace) && (drivers.length >= 20) && (startingGrid.length > 0 || hasCachedGrid);
    
    // Skip full background fetch if we've already synced this page for this user AND have data
    // EXCEPT if we are missing the current user's predictions in state
    if (!isFirstView && hasData && p10Driver && dnfDriver) {
      if (mountedRef.current) setLoadingRace(false);
      return;
    }

    try {
      // 3. Parallel Background Fetches
      const [races, apiDrivers, raceResultsMap] = await Promise.all([
        fetchCalendar(CURRENT_SEASON),
        fetchDrivers(CURRENT_SEASON),
        fetchAllSimplifiedResults()
      ]);

      if (mountedRef.current) {
        const finalDriverList = apiDrivers.length > 0 ? apiDrivers : FALLBACK_DRIVERS;
        finalDriverList.sort((a: Driver, b: Driver) => a.team.localeCompare(b.team));
        setDrivers(finalDriverList);
        localStorage.setItem(STORAGE_KEYS.CACHE_DRIVERS, JSON.stringify(finalDriverList));

        if (races.length > 0) {
          const now = new Date();
          const { index: activeIndex, isSeasonFinished: finished } = getActiveRaceIndex(races, raceResultsMap, now);
          setIsSeasonFinished(finished);

          const upcoming = races[activeIndex];
          const currentRace: PredictRace = {
            id: upcoming.round,
            name: upcoming.raceName,
            circuit: upcoming.Circuit.circuitName,
            date: upcoming.date,
            time: upcoming.time || '00:00:00Z',
            round: parseInt(upcoming.round)
          };
          
          setNextRace(prev => {
            if (prev?.id === currentRace.id && prev?.date === currentRace.date && prev?.time === currentRace.time) return prev;
            return currentRace;
          });
          setStorageItem(STORAGE_KEYS.CACHE_NEXT_RACE, JSON.stringify(currentRace));

          // Calculate locking
          const raceStartTime = new Date(`${currentRace.date}T${currentRace.time}`);
          const lockTime = new Date(raceStartTime.getTime() + 120000);
          if (now > lockTime || finished) {
            setIsLocked(true);
          }

          // Fetch Grid
          let finalGrid: ApiResult[] = [];
          const resultsData = await fetchRaceResults(CURRENT_SEASON, currentRace.round);
          if (resultsData && resultsData.Results && resultsData.Results.length > 0) {
            finalGrid = resultsData.Results;
          } else {
            const qualiGrid = await fetchQualifyingResults(CURRENT_SEASON, currentRace.round);
            if (qualiGrid && qualiGrid.length > 0) {
              const presentIds = new Set(qualiGrid.map(q => q.Driver.driverId));
              const missing = finalDriverList.filter(d => !presentIds.has(d.id));
              finalGrid = [...qualiGrid];
              missing.forEach((d, i) => {
                finalGrid.push({
                  position: (qualiGrid.length + i + 1).toString(),
                  number: d.number.toString(),
                  grid: (qualiGrid.length + i + 1).toString(),
                  points: '0', status: 'DNS', laps: '0',
                  Constructor: { constructorId: d.teamId, name: d.team },
                  Driver: {
                    driverId: d.id, code: d.code, permanentNumber: d.number.toString(),
                    givenName: d.name.split(' ')[0], familyName: d.name.split(' ').slice(1).join(' ')
                  }
                });
              });
            }
          }
          if (mountedRef.current) {
            setStartingGrid(finalGrid);
            localStorage.setItem(getGridKey(currentRace.round), JSON.stringify(finalGrid));
          }

          // Fetch User Prediction - Only if we don't have picks or it's the first view
          // And NEVER if the user is currently editing
          if (!isEditing) {
            let finalP10 = '';
            let finalDnf = '';

            if (session) {
              const { data: dbPred } = await supabase.from('predictions').select('*').eq('user_id', session.user.id).eq('race_id', `${CURRENT_SEASON}_${currentRace.id}`).maybeSingle();
              if (dbPred) {
                finalP10 = dbPred.p10_driver_id;
                finalDnf = dbPred.dnf_driver_id;
              } else {
                const storageUser = username || session.user.id;
                const finalized = localStorage.getItem(getPredictionKey(CURRENT_SEASON, storageUser, currentRace.id));
                if (finalized) {
                  const parsed = JSON.parse(finalized);
                  finalP10 = parsed.p10;
                  finalDnf = parsed.dnf;
                }
              }
            } else if (username) {
              const finalized = localStorage.getItem(getPredictionKey(CURRENT_SEASON, username, currentRace.id));
              if (finalized) {
                const parsed = JSON.parse(finalized);
                finalP10 = parsed.p10;
                finalDnf = parsed.dnf;
              }
            }

            if (mountedRef.current && finalP10 && finalDnf) {
              setP10Driver((prev: string) => prev || finalP10);
              setDnfDriver((prev: string) => prev || finalDnf);
            }
          }

          // 4. Community Predictions
          const { data: dbPreds } = await supabase.from('predictions').select('user_id, p10_driver_id, dnf_driver_id').eq('race_id', `${CURRENT_SEASON}_${currentRace.id}`);
          let formattedDbPreds: CommunityPrediction[] = [];
          const userIds = (dbPreds as unknown as CommunityPredictionData[] || []).map(p => p.user_id);

          if (userIds.length > 0) {
            const { data: profiles } = await supabase.from('profiles').select('id, username').in('id', userIds);
            const profilesMap = new Map(profiles?.map(p => [p.id, p.username]));
            formattedDbPreds = (dbPreds as unknown as CommunityPredictionData[] || []).map((p) => ({
              username: profilesMap.get(p.user_id) || 'Unknown',
              p10: p.p10_driver_id,
              dnf: p.dnf_driver_id
            }));
          }

          const otherDbPreds = formattedDbPreds.filter(p => p.username !== username);
          const playersList: string[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAYERS_LIST) || '[]');
          const localPreds = playersList.filter((p: string) => p !== username).map((p: string) => {
            const pred = localStorage.getItem(getPredictionKey(CURRENT_SEASON, p, currentRace.id));
            return pred ? JSON.parse(pred) : null;
          }).filter(p => p !== null);
          
          const combinedCommunity = [...otherDbPreds, ...localPreds.map(p => ({ username: p.username, p10: p.p10, dnf: p.dnf }))];
          if (mountedRef.current) {
            setCommunityPredictions(combinedCommunity);
            localStorage.setItem(getCommunityKey(currentRace.round), JSON.stringify(combinedCommunity));
          }
          sessionTracker.markInitialLoadComplete();
        }
      }
    } catch (error) {
      console.error('Predict: Init error:', error);
    } finally {
      if (mountedRef.current) {
        setLoadingRace(false);
      }
    }

    const parsedPlayers = JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAYERS_LIST) || '[]');
    if (mountedRef.current) setExistingPlayers((Array.isArray(parsedPlayers) ? parsedPlayers : []).filter((p: string) => typeof p === 'string' && p.trim().length >= 3));
  }, [supabase, session, username, currentUser, drivers.length, nextRace, startingGrid.length, isEditing, p10Driver, dnfDriver, syncId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    init();
    const handleResume = () => {
      console.log('Predict: App resumed, refreshing data...');
      init();
    };
    window.addEventListener('p10:app_resume', handleResume);
    return () => window.removeEventListener('p10:app_resume', handleResume);
  }, [init]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (p10Driver && dnfDriver && nextRace) {
      Haptics.impact({ style: ImpactStyle.Heavy });
      const prediction = { username: username || 'User', p10: p10Driver, dnf: dnfDriver, raceId: nextRace.id, season: CURRENT_SEASON };

      if (session) {
        const { error } = await supabase.from('predictions').upsert({
          user_id: session.user.id,
          race_id: `${CURRENT_SEASON}_${nextRace.id}`,
          p10_driver_id: p10Driver,
          dnf_driver_id: dnfDriver,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id, race_id' });
        
        if (error) {
          showNotification('Error saving prediction: ' + error.message, 'error');
          return;
        }
        const storageUser = username || session.user.id;
        setStorageItem(getPredictionKey(CURRENT_SEASON, storageUser, nextRace.id), JSON.stringify(prediction));
      } else {
        setStorageItem(getPredictionKey(CURRENT_SEASON, username, nextRace.id), JSON.stringify(prediction));
        const players = JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAYERS_LIST) || '[]');
        if (!players.includes(username)) {
          players.push(username);
          localStorage.setItem(STORAGE_KEYS.PLAYERS_LIST, JSON.stringify(players));
        }
      }
      setSubmitted(true);
      setIsEditing(false);
    }
  };

  const selectUser = (name: string) => {
    Haptics.selectionChanged();
    setStorageItem(STORAGE_KEYS.CURRENT_USER, name);
    if (!nextRace) return;
    const finalized = localStorage.getItem(getPredictionKey(CURRENT_SEASON, name, nextRace.id));
    if (finalized) {
      const parsed = JSON.parse(finalized);
      setP10Driver(parsed.p10);
      setDnfDriver(parsed.dnf);
      setIsEditing(false); // Switch to summary if they already have picks
    } else {
      setP10Driver('');
      setDnfDriver('');
      setIsEditing(true); // Switch to editing if they don't
    }
  };

  const handleGuestLogin = (e: React.FormEvent) => {
    e.preventDefault();
    Haptics.impact({ style: ImpactStyle.Medium });
    const cleanName = tempUsername.trim();
    if (cleanName.length >= 3) {
      selectUser(cleanName);
    } else {
      showNotification('Name must be at least 3 characters.', 'error');
    }
  };

  const handleSwitchGuest = () => {
    Haptics.impact({ style: ImpactStyle.Light });
    removeStorageItem(STORAGE_KEYS.CURRENT_USER);
    setTempUsername('');
  };

  const handleShare = async () => {
    if (!nextRace) return;
    const p10Name = getDriverDisplayName(p10Driver, drivers as Driver[]);
    const dnfName = getDriverDisplayName(dnfDriver, drivers as Driver[]);
    const text = `🏎️ My P10 Racing Picks for the ${nextRace.name}!\n\n🎯 P10 Finisher: ${p10Name}\n🔥 First DNF: ${dnfName}\n\nCan you master the midfield? #P10Racing #F1`;
    
    try {
      await Share.share({ title: 'P10 Racing Predictions', text: text, url: 'https://p10racing.app/predict', dialogTitle: 'Share your Picks' });
    } catch (error) {
      console.log('Share dismissed or failed:', error);
      if (!navigator.share && navigator.clipboard) {
        navigator.clipboard.writeText(text + '\n\nhttps://p10racing.app/predict');
        showNotification('Picks copied to clipboard!', 'success');
      }
    }
  };

  if (!nextRace && (loadingRace || isAuthLoading)) {
    return <LoadingView />;
  }

  // Pre-auth selection summary check
  const getGuestSelection = () => {
    if (typeof window === 'undefined' || !nextRace) return null;
    
    try {
      const players: string[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAYERS_LIST) || '[]');
      for (const player of players) {
        const key = getPredictionKey(CURRENT_SEASON, player, nextRace.id);
        const val = localStorage.getItem(key);
        if (val) {
          return JSON.parse(val) as CommunityPrediction;
        }
      }
    } catch { return null; }
    
    return null;
  };
  const guestSelection = getGuestSelection();

  if (!session && !username) {
    return (
      <Container className="mt-5">
        <Row className="justify-content-center">
          <Col md={6} lg={5}>
            <Card className="p-4 border-secondary shadow-lg overflow-hidden">
              <h2 className="h4 mb-4 fw-bold text-center">Who&apos;s Predicting?</h2>
              <div className="mb-4">
                <Link href="/auth" passHref legacyBehavior>
                  <Button variant="danger" className="w-100 py-3 fw-bold mb-2 shadow-sm">
                    SIGN IN / CREATE ACCOUNT
                  </Button>
                </Link>
                <p className="text-center text-muted small mt-2">Recommended to save your picks forever.</p>
              </div>

              {guestSelection && (
                <div className="mb-4 p-3 bg-danger bg-opacity-10 border border-danger border-opacity-25 rounded text-center">
                  <div className="text-danger small fw-bold text-uppercase mb-2">Unsaved Picks Found!</div>
                  <div className="d-flex justify-content-center gap-3">
                    <div className="text-center">
                      <div className="extra-small text-muted text-uppercase fw-bold">P10</div>
                      <div className="fw-bold">{getDriverDisplayName(guestSelection.p10, drivers)}</div>
                    </div>
                    <div className="border-start border-secondary opacity-25"></div>
                    <div className="text-center">
                      <div className="extra-small text-muted text-uppercase fw-bold">DNF</div>
                      <div className="fw-bold text-danger">{getDriverDisplayName(guestSelection.dnf, drivers)}</div>
                    </div>
                  </div>
                </div>
              )}

              <div className="text-center mb-4">
                <hr className="border-secondary opacity-25" />
                <span className="bg-dark px-2 text-muted small position-relative" style={{ top: '-13px' }}>OR PLAY AS GUEST</span>
              </div>

              {existingPlayers.length > 0 && (
                <div className="mb-4 text-center">
                  <Form.Label className="text-muted small text-uppercase fw-bold mb-3">Continue as Recent Player</Form.Label>
                  <div className="d-flex flex-wrap justify-content-center gap-2">
                    {existingPlayers.map(p => (
                      <Button key={p} variant="outline-light" size="sm" onClick={() => selectUser(p)} className="rounded-pill px-3 fw-bold">{p}</Button>
                    ))}
                  </div>
                </div>
              )}

              <Form onSubmit={handleGuestLogin}>
                <Form.Group className="mb-3">
                  <Form.Label className="small text-uppercase fw-bold opacity-75">New Guest Name</Form.Label>
                  <Form.Control 
                    type="text" 
                    placeholder="Enter name" 
                    value={tempUsername} 
                    onChange={(e) => setTempUsername(e.target.value)} 
                    minLength={3} 
                    required 
                    className="bg-dark text-white border-secondary py-2 shadow-sm" 
                  />
                </Form.Group>
                <Button type="submit" className="btn-f1 w-100 py-2 fw-bold shadow-sm">PLAY AS GUEST</Button>
              </Form>
            </Card>
          </Col>
        </Row>
      </Container>
    );
  }

  const hasPicks = p10Driver && dnfDriver;
  const showSummary = (submitted || hasPicks) && !isEditing;

  return (
    <>
      <Container className="mt-4 mb-3">
        <Row className="mb-4 align-items-center">
          <Col>
            <div className="d-flex align-items-center gap-3">
              <h1 className="h2 mb-1 fw-bold text-uppercase text-truncate">{nextRace?.name}</h1>
              <HowToPlayButton onClick={() => { Haptics.impact({ style: ImpactStyle.Light }); setShowHowToPlay(true); }} />
            </div>
            <p className="text-muted mb-0">{session ? 'Logged in as: ' : 'Playing as Guest: '}<strong className="text-white">{username}</strong></p>
          </Col>
          <Col xs="auto" className="d-flex gap-2">
            {!isLocked && (
              <Button 
                variant={showSummary ? "outline-danger" : "outline-success"} 
                size="sm" 
                onClick={() => { Haptics.impact({ style: ImpactStyle.Light }); setIsEditing(!isEditing); }} 
                className="rounded-pill px-3 fw-bold"
                disabled={!showSummary && !hasPicks}
              >
                {showSummary ? 'Change Picks' : (hasPicks ? 'View Summary' : 'Cancel')}
              </Button>
            )}
            {!isLocked && !session && (<Button variant="outline-warning" size="sm" onClick={handleSwitchGuest} className="rounded-pill">Switch Guest</Button>)}
          </Col>
        </Row>

        {showSummary || isLocked ? (
          <div className="text-center">
            <Card className={`p-4 p-md-5 border-${isLocked ? 'danger' : 'success'} bg-dark mb-4 shadow`}>
              <div className="display-4 mb-3">{isSeasonFinished ? '🏆' : (isLocked ? '🔒' : '✅')}</div>
              <h2 className="mb-4 fw-bold">
                {isSeasonFinished ? 'Season Finished' : (isLocked ? 'Predictions Closed' : (submitted ? 'Locked and Loaded!' : 'Current Picks'))}
              </h2>
              <p className="lead mb-4 text-muted">
                {isSeasonFinished ? `The ${CURRENT_SEASON} season has concluded.` : (isLocked ? `The ${nextRace?.name} is underway. Good luck!` : `Good luck for the ${nextRace?.name}, ${username}!`)}
              </p>
              
              <Row className="text-start justify-content-center">
                <Col lg={8} className="mb-4">
                  <div className="p-4 border border-secondary rounded bg-dark bg-opacity-50 h-100 shadow-sm">
                    <h3 className="h5 mb-4 text-uppercase border-bottom border-secondary pb-3 fw-bold text-danger">
                      Your Selection {isLocked && '🔒'}
                    </h3>
                    {hasPicks ? (
                      <Row className="g-3">
                        <Col sm={6}>
                          <div className="p-3 border border-secondary rounded bg-dark">
                            <div className="text-muted small text-uppercase mb-1" style={{ fontSize: '0.65rem' }}>P10 Finisher</div>
                            <div className="h4 mb-0 text-white fw-bold">{getDriverDisplayName(p10Driver, drivers)}</div>
                          </div>
                        </Col>
                        <Col sm={6}>
                          <div className="p-3 border border-secondary rounded bg-dark">
                            <div className="text-muted small text-uppercase mb-1" style={{ fontSize: '0.65rem' }}>First DNF</div>
                            <div className="h4 mb-0 text-danger fw-bold">{getDriverDisplayName(dnfDriver, drivers)}</div>
                          </div>
                        </Col>
                      </Row>
                    ) : <p className="text-warning">No prediction submitted.</p>}
                    
                    {!isSeasonFinished && hasPicks && (
                      <div className="mt-4 pt-2">
                        <Button variant="success" className="w-100 py-2 fw-bold shadow-sm" onClick={handleShare}>SHARE YOUR PICKS ↗</Button>
                      </div>
                    )}
                  </div>
                </Col>

                {isLocked && (
                  <Col lg={8} className="mb-4">
                    <div className="p-4 border border-secondary rounded bg-dark bg-opacity-50 h-100 shadow-sm">
                      <h3 className="h5 mb-4 text-uppercase border-bottom border-secondary pb-3 fw-bold text-danger">Community</h3>
                      {communityPredictions.length > 0 ? (
                        <div className="table-responsive">
                          <table className="table table-dark table-hover mb-0 small">
                            <thead><tr className="text-muted"><th>Player</th><th>P10</th><th>DNF</th></tr></thead>
                            <tbody>{communityPredictions.map((pred, idx) => (<tr key={idx}><td className="text-white fw-bold">{pred.username}</td><td>{drivers.find(d => d.id === pred.p10)?.code || pred.p10}</td><td className="text-danger">{drivers.find(d => d.id === pred.dnf)?.code || pred.dnf}</td></tr>))}</tbody>
                          </table>
                        </div>
                      ) : <p className="text-muted small">Only you so far!</p>}
                    </div>
                  </Col>
                )}
              </Row>
            </Card>
            <div className="d-flex justify-content-center gap-3">
              <Link href="/" passHref legacyBehavior><Button variant="outline-light" size="lg" className="px-5">Back Home</Button></Link>
            </div>
          </div>
        ) : (
          <>
            {startingGrid.length > 0 && (
              <Row className="mb-4">
                <Col>
                  <Card className="border-secondary bg-dark bg-opacity-50 shadow-sm overflow-hidden">
                    <Card.Header className="bg-dark border-secondary py-2 d-flex justify-content-between align-items-center">
                      <div className="d-flex align-items-center gap-2">
                        <h3 className="h6 mb-0 text-uppercase fw-bold text-danger letter-spacing-1">Starting Grid</h3>
                      </div>
                      <span className="extra-small text-muted text-uppercase fw-bold" style={{ fontSize: '0.6rem' }}>Target: P10</span>
                    </Card.Header>
                    <Card.Body className="p-2 bg-black bg-opacity-40" style={{ backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.01) 0px, rgba(255,255,255,0.01) 1px, transparent 1px, transparent 10px)', minHeight: '200px' }}>
                      <div className="position-relative py-2 px-1">
                        <div className="mb-3 pb-2 border-bottom border-secondary border-opacity-50 text-center">
                          <span className="extra-small fw-bold text-muted text-uppercase letter-spacing-2" style={{ fontSize: '0.55rem' }}>START / FINISH LINE</span>
                        </div>
                        <div className="position-absolute start-50 top-0 bottom-0 border-start border-secondary border-opacity-20 d-none d-sm-block" style={{ transform: 'translateX(-50%)', borderStyle: 'dashed !important' }}></div>
                        <div className="row g-2">
                          {startingGrid.map((result) => {
                            const pos = parseInt(result.position);
                            const isLeft = pos % 2 !== 0;
                            const isP10 = result.position === "10";
                            const driverInfo = drivers.find(d => d.id === result.Driver.driverId);
                            const teamColor = driverInfo?.color || '#B6BABD';
                            return (
                              <div key={result.Driver.driverId} className="col-6 mb-1">
                                <div className={`position-relative p-0 rounded overflow-hidden shadow-sm ${isP10 ? 'ring-1 ring-danger' : ''}`} style={{ backgroundColor: '#1a1a1a', border: isP10 ? '1.5px solid #e10600' : '1px solid rgba(255,255,255,0.1)', transform: !isLeft ? 'translateY(12px)' : 'none', zIndex: isP10 ? 10 : 1 }}>
                                  <div style={{ height: '3px', backgroundColor: teamColor }}></div>
                                  <div className="p-1 px-2 d-flex align-items-center" style={{ minHeight: '38px' }}>
                                    <div className={`fw-bold me-1 ${isP10 ? 'text-danger' : 'text-muted'}`} style={{ fontSize: '0.75rem', width: '18px' }}>{result.position}</div>
                                    <div className="flex-grow-1 overflow-hidden">
                                      <div className="text-white fw-bold text-uppercase letter-spacing-1 text-truncate" style={{ fontSize: '0.7rem' }}>{result.Driver.code}</div>
                                      <div className="text-muted extra-small text-uppercase fw-semibold text-truncate" style={{ fontSize: '0.5rem', opacity: 0.7 }}>{driverInfo?.team?.split(' ')[0] || result.Constructor.name.split(' ')[0]}</div>
                                    </div>
                                    {isP10 && (<div className="ms-1"><span style={{ fontSize: '0.6rem' }}>🎯</span></div>)}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>
            )}
            
            <Form onSubmit={handleSubmit}>
              <Row className="g-3">
                <Col md={6}>
                  <Card className="shadow-sm border-secondary mb-3">
                    <Card.Body className="p-3">
                      <h3 className="h6 mb-3 border-start border-4 border-danger ps-2 fw-bold text-uppercase">P10 Finisher</h3>
                      <div className="driver-list-scroll" style={{ maxHeight: '450px', minHeight: '450px', overflowY: 'auto', paddingRight: '8px', overscrollBehavior: 'contain' }}>
                        {drivers.map((driver) => (
                          <div key={`p10-${driver.id}`} className={`d-flex align-items-center p-3 mb-2 rounded border transition-all cursor-pointer ${p10Driver === driver.id ? 'border-danger bg-danger bg-opacity-25 shadow-sm' : 'border-secondary opacity-75'}`} onClick={() => { Haptics.selectionChanged(); setP10Driver(driver.id); }} style={{ borderLeft: `6px solid ${driver.color} !important` }}>
                            <div className="driver-number me-3 text-white fw-bold" style={{ width: '30px', fontSize: '1.2rem' }}>{driver.number}</div>
                            <div className="flex-grow-1">
                              <div className="fw-bold text-white">{driver.name}</div>
                              <span className="team-pill" style={{ backgroundColor: driver.color, color: getContrastColor(driver.color), fontSize: '0.6rem' }}>{driver.team}</span>
                            </div>
                            {p10Driver === driver.id && <div className="text-danger">●</div>}
                          </div>
                        ))}
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={6}>
                  <Card className="shadow-sm border-secondary mb-3">
                    <Card.Body className="p-3">
                      <h3 className="h6 mb-3 border-start border-4 border-danger ps-2 fw-bold text-uppercase">First DNF</h3>
                      <div className="driver-list-scroll" style={{ maxHeight: '450px', minHeight: '450px', overflowY: 'auto', paddingRight: '8px', overscrollBehavior: 'contain' }}>
                        {drivers.map((driver) => (
                          <div key={`dnf-${driver.id}`} className={`d-flex align-items-center p-3 mb-2 rounded border transition-all cursor-pointer ${dnfDriver === driver.id ? 'border-danger bg-danger bg-opacity-25 shadow-sm' : 'border-secondary opacity-75'}`} onClick={() => { Haptics.selectionChanged(); setDnfDriver(driver.id); }} style={{ borderLeft: `6px solid ${driver.color} !important` }}>
                            <div className="driver-number me-3 text-white fw-bold" style={{ width: '30px', fontSize: '1.2rem' }}>{driver.number}</div>
                            <div className="flex-grow-1">
                              <div className="fw-bold text-white">{driver.name}</div>
                              <span className="team-pill" style={{ backgroundColor: driver.color, color: getContrastColor(driver.color), fontSize: '0.6rem' }}>{driver.team}</span>
                            </div>
                            {dnfDriver === driver.id && <div className="text-danger">●</div>}
                          </div>
                        ))}
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>
              <div className="d-grid gap-2 mt-4">
                <Button type="submit" size="lg" className="btn-f1 py-3 fw-bold shadow-sm" disabled={!p10Driver || !dnfDriver}>
                  LOCK IN PREDICTION
                </Button>
              </div>
            </Form>
          </>
        )}
      </Container>

      <Modal show={showHowToPlay} onHide={() => setShowHowToPlay(false)} centered size="lg" contentClassName="bg-dark border-secondary">
        <Modal.Header closeButton closeVariant="white" className="border-secondary">
          <Modal.Title className="fw-bold text-uppercase letter-spacing-1">How to <span className="text-danger">Play</span></Modal.Title>
        </Modal.Header>
        <Modal.Body className="px-4 py-4">
          <section className="mb-4">
            <h3 className="h6 fw-bold text-danger text-uppercase letter-spacing-2 mb-2">The Objective</h3>
            <p className="text-white opacity-75 small">Predict the chaos of the F1 midfield! You need to pick the driver who finishes in <span className="fw-bold text-white">10th Place</span> and the driver who is the <span className="fw-bold text-danger">First DNF</span>.</p>
          </section>
          <section className="mb-4">
            <h3 className="h6 fw-bold text-danger text-uppercase letter-spacing-2 mb-3">Scoring: P10 Finisher</h3>
            <p className="text-white opacity-75 extra-small mb-3">Points are awarded based on how close your pick is to 10th place:</p>
            <div className="bg-black bg-opacity-50 border border-secondary border-opacity-25 rounded overflow-hidden">
              <table className="table table-dark table-sm mb-0 extra-small">
                <thead><tr className="text-uppercase opacity-50" style={{ fontSize: '0.6rem' }}><th className="ps-3 py-2">Actual Finish</th><th className="pe-3 py-2 text-end">Points</th></tr></thead>
                <tbody>
                  <tr className="table-active fw-bold"><td className="ps-3 py-1">P10 (Exact)</td><td className="pe-3 py-1 text-end text-danger">25</td></tr>
                  <tr><td className="ps-3 py-1">P9 or P11</td><td className="pe-3 py-1 text-end">18</td></tr>
                  <tr><td className="ps-3 py-1">P8 or P12</td><td className="pe-3 py-1 text-end">15</td></tr>
                  <tr><td className="ps-3 py-1">P7 or P13</td><td className="pe-3 py-1 text-end">12</td></tr>
                  <tr><td className="ps-3 py-1">P6 or P14</td><td className="pe-3 py-1 text-end">10</td></tr>
                  <tr><td className="ps-3 py-1">P5 or P15</td><td className="pe-3 py-1 text-end">8</td></tr>
                  <tr><td className="ps-3 py-1">P4 or P16</td><td className="pe-3 py-1 text-end">6</td></tr>
                  <tr><td className="ps-3 py-1">P3 or P17</td><td className="pe-3 py-1 text-end">4</td></tr>
                  <tr><td className="ps-3 py-1">P2 or P18</td><td className="pe-3 py-1 text-end">2</td></tr>
                  <tr><td className="ps-3 py-1">P1 or P19+</td><td className="pe-3 py-1 text-end">1</td></tr>
                </tbody>
              </table>
            </div>
          </section>
          <section>
            <h3 className="h6 fw-bold text-danger text-uppercase letter-spacing-2 mb-2">Scoring: First DNF</h3>
            <p className="text-white opacity-75 small mb-0">Get the first driver to retire correctly and earn a massive <span className="fw-bold text-danger">+25 Points</span>.</p>
          </section>
        </Modal.Body>
        <Modal.Footer className="border-secondary">
          <Button variant="danger" className="w-100 fw-bold py-2" onClick={() => setShowHowToPlay(false)}>GOT IT</Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

export default function PredictPageWrapper() {
  return (
    <Suspense fallback={<LoadingView />}>
      <PredictPage />
    </Suspense>
  );
}
