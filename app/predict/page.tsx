'use client';

import { useState, useEffect, Suspense, useCallback, useRef } from 'react';
import { Container, Row, Col, Form, Card, Modal } from 'react-bootstrap';
import { DRIVERS as FALLBACK_DRIVERS, CURRENT_SEASON } from '@/lib/data';
import { fetchCalendar, fetchDrivers, fetchQualifyingResults, fetchRaceResults, ApiResult } from '@/lib/api';
import { Driver } from '@/lib/types';
import { fetchAllSimplifiedResults } from '@/lib/results';
import { triggerLightHaptic, triggerMediumHaptic, triggerHeavyHaptic, triggerSelectionHaptic } from '@/lib/utils/haptics';
import { createClient } from '@/lib/supabase/client';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
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
import HapticButton from '@/components/HapticButton';
import SwipeablePageLayout, { TabOption } from '@/components/SwipeablePageLayout';
import StandardPageHeader from '@/components/StandardPageHeader';
import { LayoutGrid, Target, Flame } from 'lucide-react';

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

type PredictTab = 'grid' | 'p10' | 'dnf';

function PredictPage() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const { showNotification } = useNotification();
  const mountedRef = useRef(true);
  
  const { session, currentUser, isAuthLoading, syncVersion, triggerRefresh } = useAuth();
  const username = currentUser || '';

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

  const [activeTab, setActiveTab] = useState<PredictTab>('p10');

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
            const parsedGrid = JSON.parse(cachedGrid);
            setStartingGrid(parsedGrid);
            hasCachedGrid = parsedGrid.length > 0;
            if (hasCachedGrid) setActiveTab('grid');
          }

          const cachedCommunity = localStorage.getItem(getCommunityKey(cachedRace.round));
          if (cachedCommunity) setCommunityPredictions(JSON.parse(cachedCommunity));
        } catch (e) { console.error('Predict: Error parsing cached race', e); }
      }
    }

    const fingerprint = session?.user.id || currentUser || 'guest';
    const isFirstView = sessionTracker.isFirstView('predict', fingerprint);
    const hasData = (nextRace || cachedRace) && (drivers.length >= 20) && (startingGrid.length > 0 || hasCachedGrid);
    
    if (!isFirstView && hasData && p10Driver && dnfDriver) {
      if (mountedRef.current) setLoadingRace(false);
      return;
    }

    try {
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

          const raceStartTime = new Date(`${currentRace.date}T${currentRace.time}`);
          const lockTime = new Date(raceStartTime.getTime() + 120000);
          if (now > lockTime || finished) {
            setIsLocked(true);
          }

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
            if (finalGrid.length > 0 && !hasCachedGrid) setActiveTab('grid');
          }

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

          const { data: dbPreds } = await supabase.from('predictions').select('user_id, p10_driver_id, dnf_driver_id').eq('race_id', `${CURRENT_SEASON}_${currentRace.id}`);
          let formattedDbPreds: CommunityPrediction[] = [];
          const userIds = (dbPreds as unknown as CommunityPredictionData[] || []).map(p => p.user_id);

          if (userIds.length > 0) {
            const { data: profiles } = await supabase.from('profiles').select('id, username').in('id', userIds);
            const profilesMap = new Map<string, string | null>((profiles || []).map(p => [p.id, p.username]));
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
  }, [supabase, session, username, currentUser, drivers.length, nextRace, startingGrid.length, isEditing, p10Driver, dnfDriver, syncVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    init();
    const handleResume = () => {
      console.log('Predict: App resumed, refreshing data...');
      triggerRefresh();
    };
    window.addEventListener('p10:app_resume', handleResume);
    return () => window.removeEventListener('p10:app_resume', handleResume);
  }, [init, triggerRefresh]);

  const performSubmit = async (p10: string, dnf: string) => {
    if (!p10 || !dnf || !nextRace) {
      console.error('Predict: Attempted submit with missing data', { p10, dnf, nextRace });
      return;
    }

    console.log('Predict: Submitting prediction...', { p10, dnf, raceId: nextRace.id });
    
    try {
      triggerHeavyHaptic();
      const prediction = { username: username || 'User', p10, dnf, raceId: nextRace.id, season: CURRENT_SEASON };

      if (session) {
        const { error } = await supabase.from('predictions').upsert({
          user_id: session.user.id,
          race_id: `${CURRENT_SEASON}_${nextRace.id}`,
          p10_driver_id: p10,
          dnf_driver_id: dnf,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id, race_id' });
        
        if (error) {
          console.error('Predict: Supabase error:', error);
          showNotification('Error saving prediction: ' + error.message, 'error');
          return;
        }
        console.log('Predict: Saved to Supabase successfully');
        const storageUser = username || session.user.id;
        setStorageItem(getPredictionKey(CURRENT_SEASON, storageUser, nextRace.id), JSON.stringify(prediction));
      } else {
        console.log('Predict: Saving guest prediction to local storage');
        setStorageItem(getPredictionKey(CURRENT_SEASON, username, nextRace.id), JSON.stringify(prediction));
        const players = JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAYERS_LIST) || '[]');
        if (!players.includes(username)) {
          players.push(username);
          localStorage.setItem(STORAGE_KEYS.PLAYERS_LIST, JSON.stringify(players));
        }
      }
      setSubmitted(true);
      setIsEditing(false);
    } catch (err) {
      console.error('Predict: Submit catch block:', err);
    }
  };

  const selectUser = (name: string) => {
    triggerSelectionHaptic();
    setStorageItem(STORAGE_KEYS.CURRENT_USER, name);
    if (!nextRace) return;
    const finalized = localStorage.getItem(getPredictionKey(CURRENT_SEASON, name, nextRace.id));
    if (finalized) {
      const parsed = JSON.parse(finalized);
      setP10Driver(parsed.p10);
      setDnfDriver(parsed.dnf);
      setIsEditing(false);
    } else {
      setP10Driver('');
      setDnfDriver('');
      setIsEditing(true);
    }
  };

  const handleGuestLogin = (e: React.FormEvent) => {
    e.preventDefault();
    triggerMediumHaptic();
    const cleanName = tempUsername.trim();
    if (cleanName.length >= 3) {
      selectUser(cleanName);
    } else {
      showNotification('Name must be at least 3 characters.', 'error');
    }
  };

  const handleSwitchGuest = () => {
    triggerLightHaptic();
    removeStorageItem(STORAGE_KEYS.CURRENT_USER);
    setTempUsername('');
  };

  const handleShare = async () => {
    if (!nextRace) return;
    triggerMediumHaptic();
    const p10Name = getDriverDisplayName(p10Driver, drivers as Driver[]);
    const dnfName = getDriverDisplayName(dnfDriver, drivers as Driver[]);
    const text = `🏎️ My P10 Racing Picks for the ${nextRace.name}!\n\n🎯 P10 Finisher: ${p10Name}\n🔥 First DNF: ${dnfName}\n\nCan you master the midfield? #P10Racing #F1`;
    
    try {
      await Share.share({ title: 'P10 Racing Predictions', text: text, url: 'https://p10racing.app/predict', dialogTitle: 'Share your Picks' });
    } catch (error) {
      console.log('Share dismissed or failed:', error);
      if (!Capacitor.isNativePlatform() && !navigator.share && navigator.clipboard) {
        navigator.clipboard.writeText(text + '\n\nhttps://p10racing.app/predict');
        showNotification('Picks copied to clipboard!', 'success');
      }
    }
  };

  const handleP10Select = (id: string) => {
    triggerSelectionHaptic();
    setP10Driver(id);
    setTimeout(() => {
      if (mountedRef.current) setActiveTab('dnf');
    }, 300);
  };
const handleDnfSelect = (id: string) => {
  triggerSelectionHaptic();
  setDnfDriver(id);
  // If we're not locked and have both picks, auto-submit after a small delay
  if (!isLocked && p10Driver) {
    setTimeout(() => {
      if (mountedRef.current) {
        // Pass 'id' directly to avoid closure/stale state issues
        performSubmit(p10Driver, id);
      }
    }, 300);
  }
};

  if (!nextRace && (loadingRace || isAuthLoading)) {
    return <LoadingView />;
  }

  const getGuestSelection = () => {
    if (typeof window === 'undefined' || !nextRace) return null;
    try {
      const players: string[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAYERS_LIST) || '[]');
      for (const player of players) {
        const key = getPredictionKey(CURRENT_SEASON, player, nextRace.id);
        const val = localStorage.getItem(key);
        if (val) return JSON.parse(val) as CommunityPrediction;
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
                  <HapticButton variant="danger" className="w-100 py-3 fw-bold mb-2 shadow-sm">
                    SIGN IN / CREATE ACCOUNT
                  </HapticButton>
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
                      <HapticButton key={p} variant="outline-light" size="sm" onClick={() => selectUser(p)} className="rounded-pill px-3 fw-bold">{p}</HapticButton>
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
                <HapticButton hapticStyle="medium" type="submit" className="btn-f1 w-100 py-2 fw-bold shadow-sm">PLAY AS GUEST</HapticButton>
              </Form>
            </Card>
          </Col>
        </Row>
      </Container>
    );
  }

  const hasPicks = p10Driver && dnfDriver;
  const showSummary = (submitted || hasPicks) && !isEditing;

  // REUSABLE SUB-VIEWS
  const GridView = () => (
    <Card className="border-secondary bg-dark bg-opacity-50 shadow-sm overflow-hidden h-100">
      <Card.Header className="bg-dark border-secondary py-2 d-flex justify-content-between align-items-center">
        <h3 className="extra-small mb-0 text-uppercase fw-bold text-danger letter-spacing-1" style={{ fontSize: '0.65rem' }}>Starting Grid</h3>
        <span className="extra-small text-muted text-uppercase fw-bold" style={{ fontSize: '0.6rem' }}>Target: P10</span>
      </Card.Header>
      <Card.Body className="p-2 bg-black bg-opacity-40">
        <div className="row g-2">
          {startingGrid.map((result) => {
            const pos = parseInt(result.position);
            const isLeft = pos % 2 !== 0;
            const isP10 = result.position === "10";
            const driverInfo = drivers.find(d => d.id === result.Driver.driverId);
            const teamColor = driverInfo?.color || '#B6BABD';
            return (
              <div key={result.Driver.driverId} className="col-6">
                <div className={`position-relative p-0 rounded overflow-hidden shadow-sm ${isP10 ? 'ring-1 ring-danger' : ''}`} style={{ backgroundColor: '#1a1a1a', border: isP10 ? '1.5px solid #e10600' : '1px solid rgba(255,255,255,0.1)', transform: !isLeft ? 'translateY(8px)' : 'none', zIndex: isP10 ? 10 : 1 }}>
                  <div style={{ height: '3px', backgroundColor: teamColor }}></div>
                  <div className="p-1 px-2 d-flex align-items-center" style={{ minHeight: '38px' }}>
                    <div className={`fw-bold me-1 ${isP10 ? 'text-danger' : 'text-muted'}`} style={{ fontSize: '0.75rem', width: '18px' }}>{result.position}</div>
                    <div className="flex-grow-1 overflow-hidden">
                      <div className="text-white fw-bold text-uppercase letter-spacing-1 text-truncate" style={{ fontSize: '0.7rem' }}>{result.Driver.code}</div>
                      <div className="text-muted extra-small text-uppercase fw-semibold text-truncate" style={{ fontSize: '0.55rem', opacity: 0.7 }}>{driverInfo?.team?.split(' ')[0] || result.Constructor.name.split(' ')[0]}</div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card.Body>
    </Card>
  );

  const SelectionList = ({ type, currentPick, onSelect, isHighlighted = false }: { type: 'p10' | 'dnf', currentPick: string, onSelect: (id: string) => void, isHighlighted?: boolean }) => (
    <div className={`mx-auto w-100 h-100 p-3 rounded transition-all ${isHighlighted ? 'f1-focus-glow' : ''}`} style={{ maxWidth: '500px', border: isHighlighted ? 'none' : '1px solid transparent' }}>
      <h3 className={`h6 mb-3 border-start border-4 border-${type === 'p10' ? 'danger' : 'warning'} ps-2 fw-bold text-uppercase letter-spacing-1`}>
        {type === 'p10' ? 'P10 Finisher' : 'First DNF'}
      </h3>
      <div className="driver-list-scroll px-1" style={{ maxHeight: '60vh', overflowY: 'auto', overscrollBehavior: 'contain', paddingBottom: '80px' }}>
        {drivers.map((driver) => (
          <div key={`${type}-${driver.id}`} className={`d-flex align-items-center p-2 mb-2 rounded-pill border transition-all cursor-pointer ${currentPick === driver.id ? 'border-danger bg-danger bg-opacity-20 shadow-sm' : 'border-secondary border-opacity-25 bg-dark bg-opacity-50'}`} onClick={() => onSelect(driver.id)} style={{ borderLeft: `6px solid ${driver.color} !important` }}>
            <div className="driver-number ms-3 me-3 text-white fw-bold d-flex align-items-center" style={{ width: '45px' }}>
              <div className="flex-shrink-0 rounded-circle me-2" style={{ width: '8px', height: '8px', backgroundColor: driver.color }}></div>
              <span style={{ fontSize: '1.1rem', opacity: 0.8 }}>{driver.number}</span>
            </div>
            <div className="flex-grow-1">
              <div className="fw-bold text-white small">{driver.name}</div>
              <div className="extra-small text-uppercase fw-bold opacity-75" style={{ fontSize: '0.55rem', color: driver.color }}>{driver.team}</div>
            </div>
            {currentPick === driver.id && <div className="text-danger me-3">●</div>}
          </div>
        ))}
      </div>
    </div>
  );

  const SummaryPills = ({ isSideBySide = false }) => (
    <div className={`d-flex flex-column ${isSideBySide ? 'flex-md-row' : ''} gap-2 mb-3 align-items-center justify-content-center`}>
      <div className="p-2 px-3 bg-dark rounded-pill border border-secondary border-opacity-50 d-flex align-items-center justify-content-center" style={{ minWidth: '240px', width: 'fit-content' }}>
        <div className="d-flex align-items-center" style={{ width: '45px' }}>
          <div className="flex-shrink-0 rounded-circle me-2" style={{ width: '8px', height: '8px', backgroundColor: drivers.find(d => d.id === p10Driver)?.color || '#B6BABD' }}></div>
          <small className="text-white opacity-50 text-uppercase fw-bold letter-spacing-1" style={{ fontSize: '0.55rem' }}>P10</small>
        </div>
        <span className="fw-bold text-white small flex-grow-1 text-start ps-2">{getDriverDisplayName(p10Driver, drivers)}</span>
      </div>
      <div className="p-2 px-3 bg-dark rounded-pill border border-secondary border-opacity-50 d-flex align-items-center justify-content-center" style={{ minWidth: '240px', width: 'fit-content' }}>
        <div className="d-flex align-items-center" style={{ width: '45px' }}>
          <div className="flex-shrink-0 rounded-circle me-2" style={{ width: '8px', height: '8px', backgroundColor: drivers.find(d => d.id === dnfDriver)?.color || '#B6BABD' }}></div>
          <small className="text-white opacity-50 text-uppercase fw-bold letter-spacing-1" style={{ fontSize: '0.55rem' }}>DNF</small>
        </div>
        <span className="text-danger fw-bold small flex-grow-1 text-start ps-2">{getDriverDisplayName(dnfDriver, drivers)}</span>
      </div>
    </div>
  );

  const summaryView = (
    <Container className="mt-4 mb-4">
      <StandardPageHeader
        title={nextRace?.name || 'Grand Prix'}
        subtitle={session ? `Logged in as: ${username}` : `Playing as Guest: ${username}`}
        icon={<Target size={24} className="text-white" />}
        rightElement={
          <div className="d-flex gap-2 align-items-center">
            {!isLocked && !session && (<HapticButton variant="outline-warning" size="sm" onClick={handleSwitchGuest} className="rounded-pill small">Switch</HapticButton>)}
            <HowToPlayButton onClick={() => { triggerLightHaptic(); setShowHowToPlay(true); }} />
          </div>
        }
      />
      <div className="text-center mt-3">
        <Card className={`p-4 border-${isLocked ? 'danger' : 'success'} bg-dark mb-4 shadow-sm mx-auto`} style={{ maxWidth: '900px' }}>
          <div className="display-6 mb-2">{isSeasonFinished ? '🏆' : (isLocked ? '🔒' : '✅')}</div>
          <h2 className="h4 mb-3 fw-bold">
            {isSeasonFinished ? 'Season Finished' : (isLocked ? 'Predictions Closed' : (submitted ? 'Locked and Loaded!' : 'Current Picks'))}
          </h2>
          
          <Row className="text-start justify-content-center">
            <Col xs={12} lg={isLocked ? 6 : 8} className="mb-4">
              <div className="p-4 border border-secondary rounded bg-dark bg-opacity-50 h-100 shadow-sm">
                <h3 className="h6 mb-4 text-uppercase border-bottom border-secondary pb-3 fw-bold text-danger letter-spacing-1 text-center">
                  Your Selection {isLocked && '🔒'}
                </h3>
                {hasPicks ? <SummaryPills isSideBySide={true} /> : <p className="text-warning small mb-0 text-center">No prediction submitted.</p>}
                
                {!isSeasonFinished && hasPicks && (
                  <div className="mt-4 text-center">
                    <HapticButton variant="success" className="w-100 py-2 fw-bold shadow-sm rounded-pill small" style={{ maxWidth: '300px' }} onClick={handleShare}>SHARE YOUR PICKS ↗</HapticButton>
                  </div>
                )}
              </div>
            </Col>

            {isLocked && (
              <Col xs={12} lg={6} className="mb-4">
                <div className="p-4 border border-secondary rounded bg-dark bg-opacity-50 h-100 shadow-sm">
                  <h3 className="h6 mb-4 text-uppercase border-bottom border-secondary pb-3 fw-bold text-danger letter-spacing-1 text-center">Community</h3>
                  {communityPredictions.length > 0 ? (
                    <div className="table-responsive">
                      <table className="table table-dark table-hover mb-0 small">
                        <thead><tr className="text-muted extra-small text-uppercase opacity-50"><th>Player</th><th className="text-center">P10</th><th className="text-center">DNF</th></tr></thead>
                        <tbody>{communityPredictions.map((pred, idx) => (
                          <tr key={idx} className="align-middle">
                            <td className="text-white fw-bold py-2">{pred.username}</td>
                            <td className="text-center">
                              <div className="d-flex align-items-center justify-content-center gap-2">
                                <div className="rounded-circle" style={{ width: '6px', height: '6px', backgroundColor: drivers.find(d => d.id === pred.p10)?.color || '#B6BABD' }}></div>
                                <span className="badge bg-secondary bg-opacity-25 rounded-pill px-2 py-1">{drivers.find(d => d.id === pred.p10)?.code || pred.p10}</span>
                              </div>
                            </td>
                            <td className="text-center">
                              <div className="d-flex align-items-center justify-content-center gap-2">
                                <div className="rounded-circle" style={{ width: '6px', height: '6px', backgroundColor: drivers.find(d => d.id === pred.dnf)?.color || '#B6BABD' }}></div>
                                <span className="badge bg-danger bg-opacity-10 text-danger rounded-pill px-2 py-1 border border-danger border-opacity-25">{drivers.find(d => d.id === pred.dnf)?.code || pred.dnf}</span>
                              </div>
                            </td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  ) : <p className="text-muted small text-center">Only you so far!</p>}
                </div>
              </Col>
            )}
          </Row>
        </Card>
        <div className="d-flex justify-content-center gap-3">
          {!isLocked && (
            <HapticButton variant="outline-danger" size="lg" onClick={() => { setIsEditing(true); setSubmitted(false); setActiveTab('p10'); }} className="px-5 fw-bold rounded-pill">
              Change Picks
            </HapticButton>
          )}
          <Link href="/" passHref legacyBehavior><HapticButton variant="outline-light" size="lg" className="px-5 fw-bold rounded-pill">Back Home</HapticButton></Link>
        </div>
      </div>
    </Container>
  );

  const tabs: TabOption<PredictTab>[] = [];
  if (startingGrid.length > 0) {
    tabs.push({ id: 'grid', label: 'Grid', icon: <LayoutGrid size={16} /> });
  }
  tabs.push({ id: 'p10', label: 'Pick P10', icon: <Target size={16} /> });
  tabs.push({ id: 'dnf', label: 'Pick DNF', icon: <Flame size={16} /> });

  if (showSummary || isLocked) {
    return (
      <>
        {summaryView}
        <Modal show={showHowToPlay} onHide={() => setShowHowToPlay(false)} centered size="lg" contentClassName="bg-dark border-secondary">
          <Modal.Header closeButton closeVariant="white" className="border-secondary">
            <Modal.Title className="fw-bold text-uppercase letter-spacing-1 fs-5">How to <span className="text-danger">Play</span></Modal.Title>
          </Modal.Header>
          <Modal.Body className="px-4 py-4">
            <section className="mb-4">
              <h3 className="h6 fw-bold text-danger text-uppercase letter-spacing-2 mb-2">The Objective</h3>
              <p className="text-white opacity-75 small">Predict the chaos of the F1 midfield! You need to pick the driver who finishes in <span className="fw-bold text-white">10th Place</span> and the driver who is the <span className="fw-bold text-danger">First DNF</span>.</p>
            </section>
            <section className="mb-4">
              <h3 className="h6 fw-bold text-danger text-uppercase letter-spacing-2 mb-3">Scoring: P10 Finisher</h3>
              <div className="bg-black bg-opacity-50 border border-secondary border-opacity-25 rounded overflow-hidden">
                <table className="table table-dark table-sm mb-0 extra-small">
                  <thead><tr className="text-uppercase opacity-50" style={{ fontSize: '0.6rem' }}><th className="ps-3 py-2">Actual Finish</th><th className="pe-3 py-2 text-end">Points</th></tr></thead>
                  <tbody>
                    <tr className="table-active fw-bold"><td className="ps-3 py-1">P10 (Exact)</td><td className="pe-3 py-1 text-end text-danger">25</td></tr>
                    {['18', '15', '12', '10', '8', '6', '4', '2', '1'].map((pts, i) => (
                      <tr key={pts}><td className="ps-3 py-1">{i === 8 ? 'P1 or P19+' : `P${9-i} or P${11+i}`}</td><td className="pe-3 py-1 text-end">{pts}</td></tr>
                    ))}
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
            <HapticButton variant="danger" className="w-100 fw-bold py-2 rounded-pill" onClick={() => setShowHowToPlay(false)}>GOT IT</HapticButton>
          </Modal.Footer>
        </Modal>
      </>
    );
  }

  // CUSTOM SPLIT LAYOUT FOR LARGE SCREENS
  const splitLayout = (
    <div className="w-100">
      <Row className="g-4">
        {startingGrid.length > 0 && (
          <Col xs={12} className="mb-2">
            <GridView />
          </Col>
        )}
        <Col xs={12} lg={6}>
          <SelectionList type="p10" currentPick={p10Driver} onSelect={handleP10Select} />
        </Col>
        <Col xs={12} lg={6} className={!p10Driver ? 'opacity-25' : 'opacity-100 transition-all'}>
          <SelectionList 
            type="dnf" 
            currentPick={dnfDriver} 
            onSelect={handleDnfSelect} 
            isHighlighted={!!p10Driver && !dnfDriver}
          />
        </Col>
      </Row>
    </div>
  );

  return (
    <>
      <SwipeablePageLayout
        title={nextRace?.name || 'Grand Prix'}
        subtitle={session ? `Logged in as: ${username}` : `Playing as Guest: ${username}`}
        icon={<Target size={24} className="text-white" />}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        tabs={tabs}
        onRefresh={undefined}
        splitOnWide={true}
        customSplitLayout={splitLayout}
        rightElement={
          <div className="d-flex gap-2 align-items-center">
            {isEditing && (
              <HapticButton variant="outline-danger" size="sm" onClick={() => setIsEditing(false)} className="rounded-pill px-3 fw-bold small">Cancel</HapticButton>
            )}
            {!isLocked && !session && (<HapticButton variant="outline-warning" size="sm" onClick={handleSwitchGuest} className="rounded-pill small">Switch</HapticButton>)}
            <HowToPlayButton onClick={() => { triggerLightHaptic(); setShowHowToPlay(true); }} />
          </div>
        }
      >
        <div className="mt-3 flex-grow-1 d-flex flex-column pb-10 mb-5">
          {activeTab === 'grid' && startingGrid.length > 0 && <GridView />}
          {activeTab === 'p10' && <SelectionList type="p10" currentPick={p10Driver} onSelect={handleP10Select} />}
          {activeTab === 'dnf' && <SelectionList type="dnf" currentPick={dnfDriver} onSelect={handleDnfSelect} />}
        </div>
      </SwipeablePageLayout>

      <Modal show={showHowToPlay} onHide={() => setShowHowToPlay(false)} centered size="lg" contentClassName="bg-dark border-secondary">
        <Modal.Header closeButton closeVariant="white" className="border-secondary">
          <Modal.Title className="fw-bold text-uppercase letter-spacing-1 fs-5">How to <span className="text-danger">Play</span></Modal.Title>
          <Modal.Body className="px-4 py-4">
            <section className="mb-4">
              <h3 className="h6 fw-bold text-danger text-uppercase letter-spacing-2 mb-2">The Objective</h3>
              <p className="text-white opacity-75 small">Predict the chaos of the F1 midfield! You need to pick the driver who finishes in <span className="fw-bold text-white">10th Place</span> and the driver who is the <span className="fw-bold text-danger">First DNF</span>.</p>
            </section>
            <section className="mb-4">
              <h3 className="h6 fw-bold text-danger text-uppercase letter-spacing-2 mb-3">Scoring: P10 Finisher</h3>
              <div className="bg-black bg-opacity-50 border border-secondary border-opacity-25 rounded overflow-hidden">
                <table className="table table-dark table-sm mb-0 extra-small">
                  <thead><tr className="text-uppercase opacity-50" style={{ fontSize: '0.6rem' }}><th className="ps-3 py-2">Actual Finish</th><th className="pe-3 py-2 text-end">Points</th></tr></thead>
                  <tbody>
                    <tr className="table-active fw-bold"><td className="ps-3 py-1">P10 (Exact)</td><td className="pe-3 py-1 text-end text-danger">25</td></tr>
                    {['18', '15', '12', '10', '8', '6', '4', '2', '1'].map((pts, i) => (
                      <tr key={pts}><td className="ps-3 py-1">{i === 8 ? 'P1 or P19+' : `P${9-i} or P${11+i}`}</td><td className="pe-3 py-1 text-end">{pts}</td></tr>
                    ))}
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
            <HapticButton variant="danger" className="w-100 fw-bold py-2 rounded-pill" onClick={() => setShowHowToPlay(false)}>GOT IT</HapticButton>
          </Modal.Footer>
        </Modal.Header>
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
