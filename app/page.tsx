'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Container, Row, Col, Spinner } from 'react-bootstrap';
import { CURRENT_SEASON } from '@/lib/data';
import { DbPrediction } from '@/lib/types';
import { fetchAllSimplifiedResults } from '@/lib/results';
import { triggerLightHaptic, triggerMediumHaptic } from '@/lib/utils/haptics';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { calculateSeasonPoints } from '@/lib/scoring';
import { createClient } from '@/lib/supabase/client';
import { useNotification } from '@/components/Notification';
import { getDriverDisplayName } from '@/lib/utils/drivers';
import { getActiveRaceIndex } from '@/lib/utils/races';
import HowToPlayButton from '@/components/HowToPlayButton';
import { STORAGE_KEYS, getPredictionKey, STORAGE_UPDATE_EVENT, setStorageItem } from '@/lib/utils/storage';
import { motion, AnimatePresence } from 'framer-motion';
import { sessionTracker } from '@/lib/utils/session';
import { useAuth } from '@/components/AuthProvider';
import HapticButton from '@/components/HapticButton';
import HapticLink from '@/components/HapticLink';
import { useF1Data } from '@/lib/hooks/use-f1-data';
import { useRealtimeSync } from '@/lib/hooks/use-realtime-sync';

interface HomeRace {
  id: string;
  name: string;
  circuit: string;
  date: string;
  time: string;
  round: number;
}

interface HomePrediction {
  p10: string;
  dnf: string;
}

export default function Home() {
  const supabase = createClient();
  const { showNotification } = useNotification();
  const mountedRef = useRef(true);
  
  // Use Global Auth Context
  const { currentUser, hasSession, session, isAuthLoading, syncVersion, triggerRefresh } = useAuth();
  const { drivers: allDrivers, calendar, loading: f1Loading } = useF1Data(CURRENT_SEASON);

  // 1. Synchronous Cache Initialization (Zero Pop-in)
  const [nextRace, setNextRace] = useState<HomeRace | null>(() => {
    if (typeof window === 'undefined') return null;
    const cached = localStorage.getItem(STORAGE_KEYS.CACHE_NEXT_RACE);
    return cached ? JSON.parse(cached) : null;
  });

  const [loading, setLoading] = useState(!nextRace);
  const [userPrediction, setUserPrediction] = useState<HomePrediction | null>(() => {
    if (typeof window === 'undefined') return null;
    const user = localStorage.getItem(STORAGE_KEYS.CACHE_USERNAME) || localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    const cachedRaceStr = localStorage.getItem(STORAGE_KEYS.CACHE_NEXT_RACE);
    if (cachedRaceStr && user) {
      try {
        const raceObj = JSON.parse(cachedRaceStr);
        const predStr = localStorage.getItem(getPredictionKey(CURRENT_SEASON, user, raceObj.id));
        return predStr ? JSON.parse(predStr) : null;
      } catch { return null; }
    }
    return null;
  });

  // Reactive Prediction Load: Runs when auth status, sync version or next race changes
  useEffect(() => {
    const loadPrediction = async () => {
      if (!nextRace) return;

      let finalPrediction: HomePrediction | null = null;
      
      // 1. Try local cache FIRST for immediate sync
      const storageUser = session?.user?.id || currentUser || '';
      if (storageUser) {
        const cachedPred = localStorage.getItem(getPredictionKey(CURRENT_SEASON, storageUser, nextRace.id));
        if (cachedPred) {
          finalPrediction = JSON.parse(cachedPred);
        }
      }

      // 2. Try DB as fallback if no cache or to ensure fresh data
      if (!finalPrediction && session) {
        const { data: pred } = await supabase
          .from('predictions')
          .select('*')
          .eq('user_id', session.user.id)
          .eq('race_id', `${CURRENT_SEASON}_${nextRace.id}`)
          .maybeSingle();
        
        if (pred) {
          finalPrediction = { p10: pred.p10_driver_id, dnf: pred.dnf_driver_id };
        }
      }

      if (mountedRef.current) {
        setUserPrediction(prev => {
          if (!finalPrediction) return null;
          if (prev?.p10 === finalPrediction.p10 && prev?.dnf === finalPrediction.dnf) return prev;
          return finalPrediction;
        });
      }
    };

    // Skip if we already performed initial load AND have a prediction (optimistic stability)
    if (!sessionTracker.isInitialLoadNeeded() && userPrediction) {
      const storageUser = session?.user?.id || currentUser || '';
      const cached = localStorage.getItem(getPredictionKey(CURRENT_SEASON, storageUser, nextRace?.id || ''));
      if (cached) {
          const parsed = JSON.parse(cached);
          if (userPrediction.p10 === parsed.p10 && userPrediction.dnf === parsed.dnf) return;
      }
    }

    loadPrediction();
  }, [currentUser, session, nextRace, supabase, userPrediction, syncVersion]);

  // Reactive Storage Listener: If predictions change on another page, update here immediately
  useEffect(() => {
    const handleStorageUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<{ key: string }>;
      const updatedKey = customEvent.detail?.key;
      
      const activeUserId = session?.user?.id;
      const localUsername = localStorage.getItem(STORAGE_KEYS.CACHE_USERNAME) || localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      const storageUser = activeUserId || localUsername || '';
      
      const expectedKey = nextRace ? getPredictionKey(CURRENT_SEASON, storageUser, nextRace.id) : null;

      if (updatedKey === expectedKey || updatedKey === STORAGE_KEYS.CURRENT_USER || updatedKey === STORAGE_KEYS.CACHE_USERNAME) {
        const cachedRaceStr = localStorage.getItem(STORAGE_KEYS.CACHE_NEXT_RACE);
        if (cachedRaceStr && storageUser) {
          try {
            const raceObj = JSON.parse(cachedRaceStr);
            const predStr = localStorage.getItem(getPredictionKey(CURRENT_SEASON, storageUser, raceObj.id));
            if (predStr) {
              const parsed = JSON.parse(predStr);
              setUserPrediction(prev => (prev?.p10 === parsed.p10 && prev?.dnf === parsed.dnf) ? prev : parsed);
            } else {
              setUserPrediction(null);
            }
          } catch { setUserPrediction(null); }
        }
      }
    };

    window.addEventListener(STORAGE_UPDATE_EVENT, handleStorageUpdate);
    return () => window.removeEventListener(STORAGE_UPDATE_EVENT, handleStorageUpdate);
  }, [currentUser, nextRace, syncVersion, session]);

  const [countdown, setCountdown] = useState(() => {
    if (typeof window === 'undefined' || !nextRace) return { d: 0, h: 0, m: 0, s: 0 };
    const now = new Date().getTime();
    const target = new Date(`${nextRace.date}T${nextRace.time}`).getTime();
    const distance = target - now;
    if (distance < 0) return { d: 0, h: 0, m: 0, s: 0 };
    return {
      d: Math.floor(distance / (1000 * 60 * 60 * 24)),
      h: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
      m: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
      s: Math.floor((distance % (1000 * 60)) / 1000)
    };
  });

  const [showCountdown, setShowCountdown] = useState(() => {
    if (typeof window === 'undefined' || !nextRace) return false;
    const now = new Date().getTime();
    const target = new Date(`${nextRace.date}T${nextRace.time}`).getTime();
    return target - now > 0;
  });

  const [isLocked, setIsLocked] = useState(() => {
    if (typeof window === 'undefined' || !nextRace) return false;
    const now = new Date();
    const raceStartTime = new Date(`${nextRace.date}T${nextRace.time}`);
    const lockTime = new Date(raceStartTime.getTime() + (2 * 60 * 1000));
    return now > lockTime;
  });

  const [isRaceInProgress, setIsRaceInProgress] = useState(() => {
    if (typeof window === 'undefined' || !nextRace) return false;
    const now = new Date().getTime();
    const target = new Date(`${nextRace.date}T${nextRace.time}`).getTime();
    const fourHoursLater = target + 4 * 60 * 60 * 1000;
    return now > target && now < fourHoursLater;
  });

  const [isSeasonFinished, setIsSeasonFinished] = useState(false);
  const [champion, setChampion] = useState<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const init = useCallback(async () => {
    if (f1Loading) return;

    const fingerprint = session?.user.id || currentUser || 'guest';
    const isFirstView = sessionTracker.isFirstView('home', fingerprint);
    
    if (!isFirstView && nextRace && allDrivers.length >= 20) {
      if (mountedRef.current) setLoading(false);
      return;
    }

    try {
      if (mountedRef.current) {
        if (calendar.length > 0) {
          const now = new Date();
          const raceResultsMap = await fetchAllSimplifiedResults();
          const { index: activeIndex, isSeasonFinished: finished } = getActiveRaceIndex(calendar, raceResultsMap, now);
          setIsSeasonFinished(finished);

          const upcoming = calendar[activeIndex];
          
          if (finished) {
            const { data: profiles } = await supabase.from('profiles').select('id, username');
            const { data: predictions } = await supabase.from('predictions').select('*') as { data: DbPrediction[] | null };

            if (profiles && predictions && Object.keys(raceResultsMap).length > 0) {
              const players = profiles.map(p => ({ 
                username: p.username, 
                predictions: predictions
                  .filter(pred => pred.user_id === p.id)
                  .reduce((acc, pred) => {
                    const round = pred.race_id.split('_')[1];
                    acc[round] = { p10: pred.p10_driver_id, dnf: pred.dnf_driver_id };
                    return acc;
                  }, {} as { [round: string]: { p10: string, dnf: string } })
              }));

              const localPlayers: string[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAYERS_LIST) || '[]');
              localPlayers.forEach(lp => {
                const lpPreds: { [round: string]: { p10: string, dnf: string } } = {};
                Object.keys(raceResultsMap).forEach(round => {
                  const predStr = localStorage.getItem(getPredictionKey(CURRENT_SEASON, lp, round));
                  if (predStr) lpPreds[round] = JSON.parse(predStr);
                });
                players.push({ username: lp, predictions: lpPreds });
              });

              const ranked = players.map(player => ({
                username: player.username,
                points: calculateSeasonPoints(player.predictions, raceResultsMap).totalPoints
              })).sort((a, b) => b.points - a.points);

              if (ranked.length > 0) setChampion(ranked[0].username);
            }
          }

          const raceObj: HomeRace = {
            id: upcoming.round,
            name: upcoming.raceName,
            circuit: upcoming.Circuit.circuitName,
            date: upcoming.date,
            time: upcoming.time || '00:00:00Z',
            round: parseInt(upcoming.round)
          };
          
          setNextRace(prev => {
            if (prev?.id === raceObj.id && prev?.date === raceObj.date && prev?.time === raceObj.time) return prev;
            return raceObj;
          });
          setStorageItem(STORAGE_KEYS.CACHE_NEXT_RACE, JSON.stringify(raceObj));

          const raceStartTime = new Date(`${raceObj.date}T${raceObj.time}`);
          const lockTime = new Date(raceStartTime.getTime() + (2 * 60 * 1000));
          setIsLocked(now > lockTime);
          setLoading(false);
          sessionTracker.markInitialLoadComplete();
        }
      }
    } catch (error) {
      console.error('Home: Init error:', error);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [supabase, nextRace, allDrivers.length, session, currentUser, syncVersion, f1Loading, calendar]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    init();
    
    // Listen for App Resume
    const handleResume = () => {
      console.log('Home: App resumed, re-initializing...');
      triggerRefresh();
    };
    window.addEventListener('p10:app_resume', handleResume);
    return () => window.removeEventListener('p10:app_resume', handleResume);
  }, [init, triggerRefresh]);

  // Real-time subscription
  useRealtimeSync(useCallback(() => init(), [init]));

  useEffect(() => {
    if (!nextRace) return;

    const calculate = () => {
      const now = new Date().getTime();
      const targetStr = `${nextRace.date}T${nextRace.time}`;
      const target = new Date(targetStr).getTime();
      const distance = target - now;
      const fourHoursLater = target + 4 * 60 * 60 * 1000;

      if (distance < 0) {
        setShowCountdown(false);
        setIsRaceInProgress(now < fourHoursLater);
      } else {
        setShowCountdown(true);
        setIsRaceInProgress(false);
        setCountdown({
          d: Math.floor(distance / (1000 * 60 * 60 * 24)),
          h: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          m: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
          s: Math.floor((distance % (1000 * 60)) / 1000)
        });
      }
    };

    calculate();
    const timer = setInterval(calculate, 1000);
    return () => clearInterval(timer);
  }, [nextRace]);

  const handleShare = async () => {
    if (!userPrediction || !nextRace) return;
    triggerMediumHaptic();
    const p10Name = getDriverDisplayName(userPrediction.p10, allDrivers);
    const dnfName = getDriverDisplayName(userPrediction.dnf, allDrivers);
    const text = `🏎️ My P10 Racing Picks for the ${nextRace.name}!\n\n🎯 P10 Finisher: ${p10Name}\n🔥 First DNF: ${dnfName}\n\nCan you master the midfield? #P10Racing #F1`;
    
    try {
      await Share.share({
        title: 'P10 Racing Predictions',
        text: text,
        url: 'https://p10racing.app',
        dialogTitle: 'Share your Picks',
      });
    } catch (error) {
      console.log('Share dismissed or failed:', error);
      if (!Capacitor.isNativePlatform() && !navigator.share && navigator.clipboard) {
        navigator.clipboard.writeText(text + '\n\nhttps://p10racing.app');
        showNotification('Picks copied to clipboard!', 'success');
      }
    }
  };

  const isColdStart = typeof window !== 'undefined' ? sessionTracker.isFirstView('home') : true;

  return (
    <>
      <Container className="mt-3 mt-md-4 flex-grow-1">
        <Row className="justify-content-center text-center">
          <Col md={8} className="mb-2">
            <h1 className="display-5 fw-bold mb-2 text-white letter-spacing-1">MASTER THE <span className="text-danger">MIDFIELD</span></h1>
            <p className="small text-white opacity-75 mb-4 mx-auto" style={{ maxWidth: '500px' }}>
              Predict the 10th place finisher and the first DNF of the {nextRace?.name || 'next Grand Prix'}.
            </p>
            
            {nextRace && !loading && isSeasonFinished && (
              <div className="f1-accent-card mb-4 p-4 border-warning border-opacity-50">
                <div className="text-uppercase fw-bold text-warning mb-2 letter-spacing-2" style={{ fontSize: '0.8rem' }}>🏆 Season Champion 🏆</div>
                <h2 className="display-6 fw-bold text-white mb-2">
                  {champion ? champion.toUpperCase() : 'SEASON FINISHED'}
                </h2>
                <p className="text-muted small mb-3">Congratulations! Check the leaderboard to see the final standings for {CURRENT_SEASON}.</p>
                <HapticLink href="/leaderboard">
                  <HapticButton hapticStyle="medium" variant="warning" className="fw-bold px-4 rounded-pill">VIEW FINAL STANDINGS</HapticButton>
                </HapticLink>
              </div>
            )}

            {!isSeasonFinished && (
              <div style={{ minHeight: "115px" }} className="d-flex flex-column align-items-center justify-content-center mb-4" suppressHydrationWarning>
                {nextRace && (
                  <>
                    {showCountdown ? (
                      <motion.div
                        initial={isColdStart ? { opacity: 0, y: 5 } : false}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                      >
                        <div className="text-uppercase fw-bold text-danger mb-2 letter-spacing-2" style={{ fontSize: '0.65rem', opacity: 0.8 }}>Race Starts In</div>
                        <div className="d-flex justify-content-center gap-2 px-2 mx-auto" style={{ maxWidth: '320px' }}>
                          {[
                            { label: 'D', val: countdown.d },
                            { label: 'H', val: countdown.h },
                            { label: 'M', val: countdown.m },
                            { label: 'S', val: countdown.s }
                          ].map(item => (
                            <div key={item.label} className="bg-dark border border-secondary border-opacity-50 rounded shadow-sm d-flex flex-column align-items-center justify-content-center" style={{ width: '60px', height: '60px', flexShrink: 0 }}>
                              <div className="h4 fw-bold text-white mb-0 line-height-1">{item.val}</div>
                              <div className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.55rem', letterSpacing: '0.5px' }}>{item.label}</div>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    ) : isRaceInProgress ? (
                      <motion.div
                        initial={isColdStart ? { opacity: 0 } : false}
                        animate={{ opacity: 1 }}
                      >
                        <div className="text-uppercase fw-bold text-success mb-2 letter-spacing-2 animate-pulse" style={{ fontSize: '0.65rem', opacity: 0.8 }}>Race In Progress</div>
                        <div className="h4 fw-bold text-white mb-0 letter-spacing-1">TRACK ACTION LIVE 🏎️</div>
                      </motion.div>
                    ) : (
                      <div className="text-uppercase fw-bold text-danger mb-2 letter-spacing-2" style={{ fontSize: '0.65rem', opacity: 0.8 }}>Race Starts In</div>
                    )}
                  </>
                )}
              </div>
            )}

            <div className="d-flex flex-column flex-sm-row justify-content-center gap-2 mb-2 px-4 px-sm-0">
              {!isSeasonFinished ? (
                <HapticLink href="/predict">
                  <HapticButton hapticStyle="medium" size="lg" className="btn-f1 px-4 py-2 fw-bold" style={{ fontSize: '0.9rem' }} suppressHydrationWarning>
                    {isLocked 
                      ? (userPrediction ? 'VIEW RACE CENTER' : 'PREDICTIONS CLOSED') 
                      : (userPrediction ? 'UPDATE PREDICTION' : 'MAKE PREDICTION')}
                  </HapticButton>
                </HapticLink>
              ) : (
                <HapticLink href="/history">
                  <HapticButton hapticStyle="medium" size="lg" variant="danger" className="px-4 py-2 fw-bold" style={{ fontSize: '0.9rem' }}>
                    VIEW SEASON RECAP
                  </HapticButton>
                </HapticLink>
              )}
              <HapticLink href="/leaderboard">
                <HapticButton hapticStyle="medium" variant="outline-light" size="lg" className="px-4 py-2 fw-bold opacity-75" style={{ fontSize: '0.9rem' }}>
                  {isSeasonFinished ? 'FINAL STANDINGS' : 'LEADERBOARD'}
                </HapticButton>
              </HapticLink>
            </div>
            
            <div className="mb-4">
              <HapticLink href="/predict?howto=true">
                <HowToPlayButton onClick={triggerLightHaptic} />
              </HapticLink>
            </div>

            <AnimatePresence>
              {!isSeasonFinished && userPrediction && nextRace && (
                <motion.div 
                  initial={isColdStart ? { opacity: 0, scale: 0.95 } : false}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="f1-accent-card mb-4 p-3 border-danger border-opacity-20 mx-auto" 
                  style={{ maxWidth: '400px' }}
                >
                  <h3 className="text-uppercase fw-bold text-danger letter-spacing-1 mb-3" style={{ fontSize: '0.65rem' }}>
                    Your {nextRace.name} Picks {isLocked && '🔒'}
                  </h3>
                  <div className="d-flex flex-column gap-2 mb-3 align-items-center">
                    <div className="p-2 px-3 bg-dark rounded-pill border border-secondary border-opacity-50 d-flex align-items-center justify-content-center" style={{ minWidth: '240px', width: 'fit-content' }}>
                      <small className="text-white opacity-50 text-uppercase fw-bold letter-spacing-1 me-2" style={{ fontSize: '0.55rem', width: '30px', display: 'inline-block', textAlign: 'left' }}>P10</small>
                      <div className="f1-driver-line me-2" style={{ backgroundColor: allDrivers.find(d => d.id === userPrediction.p10)?.color || '#B6BABD' }}></div>
                      <span className="fw-bold text-white small flex-grow-1 text-start ps-1">
                        {getDriverDisplayName(userPrediction.p10, allDrivers)}
                      </span>
                    </div>
                    <div className="p-2 px-3 bg-dark rounded-pill border border-secondary border-opacity-50 d-flex align-items-center justify-content-center" style={{ minWidth: '240px', width: 'fit-content' }}>
                      <small className="text-white opacity-50 text-uppercase fw-bold letter-spacing-1 me-2" style={{ fontSize: '0.55rem', width: '30px', display: 'inline-block', textAlign: 'left' }}>DNF</small>
                      <div className="f1-driver-line me-2" style={{ backgroundColor: allDrivers.find(d => d.id === userPrediction.dnf)?.color || '#B6BABD' }}></div>
                      <span className="fw-bold text-danger small flex-grow-1 text-start ps-1">
                        {getDriverDisplayName(userPrediction.dnf, allDrivers)}
                      </span>
                    </div>
                  </div>
                  <HapticButton variant="success" size="sm" className="rounded-pill px-4 fw-bold w-100 py-2 small" onClick={handleShare}>
                    SHARE PICKS ↗
                  </HapticButton>
                </motion.div>
              )}
            </AnimatePresence>

          </Col>
        </Row>

        <Row className="mt-2 g-3 px-1">
          <Col md={6}>
            <div className="f1-glass-card p-3 border-secondary border-opacity-25 h-100" style={{ minHeight: '110px' }}>
              <h3 className="text-uppercase fw-bold text-danger letter-spacing-1 mb-2" style={{ fontSize: '0.65rem' }}>Next Race</h3>
              {loading && !nextRace ? (
                <Spinner animation="border" size="sm" variant="danger" />
              ) : (
                <motion.div
                  initial={isColdStart ? { opacity: 0 } : false}
                  animate={{ opacity: 1 }}
                >
                  <p className="fw-bold mb-0 text-white" style={{ fontSize: '1.1rem' }}>{nextRace?.name}</p>
                  <p className="text-white opacity-50 small mb-2">{nextRace?.circuit}</p>
                  <div className="badge bg-danger bg-opacity-10 text-danger px-2 py-1 border border-danger border-opacity-20 rounded-pill fw-bold" style={{ fontSize: '0.65rem' }}>
                    {nextRace && new Date(nextRace.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                </motion.div>
              )}
            </div>
          </Col>

          <Col md={6}>
            <div className="f1-glass-card p-3 border-secondary border-opacity-25 h-100 d-flex flex-column justify-content-between">
              <div>
                <h3 className="text-uppercase fw-bold text-white opacity-50 letter-spacing-1 mb-2" style={{ fontSize: '0.65rem' }}>Your Leagues</h3>
                <p className="fw-bold mb-1 text-white" style={{ fontSize: '1.1rem' }}>Compete with Friends</p>
              </div>
              <HapticLink href="/leagues" className="btn btn-outline-danger btn-sm rounded-pill px-3 fw-bold mt-2 align-self-start d-inline-flex">
                View Leagues →
              </HapticLink>
            </div>
          </Col>
        </Row>

        <AnimatePresence>
          {(!loading && !hasSession && !currentUser && !isAuthLoading) && (
            <motion.div
              key="guest-join-grid"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <Row className="mt-4 justify-content-center">
                <Col md={6}>
                  <div className="f1-glass-card p-3 border-primary border-opacity-20 text-center shadow-sm bg-primary bg-opacity-5">
                    <h2 className="fw-bold text-white mb-1" style={{ fontSize: '1rem' }}>Join the Grid</h2>
                    <p className="extra-small text-white opacity-60 mb-2" style={{ fontSize: '0.75rem' }}>Save predictions and compete in leagues.</p>
                    <HapticLink href="/auth">
                      <HapticButton hapticStyle="medium" variant="primary" size="sm" className="px-4 py-1 fw-bold rounded-pill" style={{ fontSize: '0.7rem' }}>GET STARTED</HapticButton>
                    </HapticLink>
                  </div>
                </Col>
              </Row>
            </motion.div>
          )}
        </AnimatePresence>
      </Container>
    </>
  );
}
