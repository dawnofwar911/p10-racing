'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Container, Row, Col, Spinner } from 'react-bootstrap';
import { CURRENT_SEASON } from '@/lib/data';
import { DbPrediction } from '@/lib/types';
import { fetchAllSimplifiedResults } from '@/lib/results';
import { triggerMediumHaptic } from '@/lib/utils/haptics';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { calculateSeasonPoints, mapPredictionsByUser } from '@/lib/scoring';
import { createClient } from '@/lib/supabase/client';
import { useNotification } from '@/components/Notification';
import { isTestAccount } from '@/lib/utils/profiles';
import { getDriverDisplayName } from '@/lib/utils/drivers';
import { getActiveRaceIndex } from '@/lib/utils/races';
import HowToPlayButton from '@/components/HowToPlayButton';
import { STORAGE_KEYS, getPredictionKey, setStorageItem } from '@/lib/utils/storage';
import { motion, AnimatePresence } from 'framer-motion';
import { sessionTracker } from '@/lib/utils/session';
import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import HapticButton from '@/components/HapticButton';
import HapticLink from '@/components/HapticLink';
import { useF1Data } from '@/lib/hooks/use-f1-data';
import { useRealtimeSync } from '@/lib/hooks/use-realtime-sync';
import { useSyncPredictions } from '@/lib/hooks/use-sync-predictions';
import StandardPageHeader from '@/components/StandardPageHeader';
import { User } from 'lucide-react';

interface HomeRace {
  id: string;
  name: string;
  circuit: string;
  date: string;
  time: string;
  round: number;
}

export default function Home() {
  const supabase = createClient();
  const { showNotification } = useNotification();
  const mountedRef = useRef(true);
  const router = useRouter();
  
  // Use Global Auth Context
  const { currentUser, displayName, hasSession, session, isAuthLoading, syncVersion, triggerRefresh } = useAuth();
  const { drivers: allDrivers, calendar, loading: f1Loading } = useF1Data(CURRENT_SEASON);

  // 1. Synchronous Cache Initialization (Zero Pop-in)
  const [nextRace, setNextRace] = useState<HomeRace | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const cached = localStorage.getItem(STORAGE_KEYS.CACHE_NEXT_RACE);
      return cached ? JSON.parse(cached) : null;
    } catch (e) {
      console.warn('Home: Failed to parse race cache', e);
      return null;
    }
  });

  const [loading, setLoading] = useState(!nextRace);
  const { prediction: userPrediction } = useSyncPredictions(nextRace?.id);

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
            const { data: { session } } = await supabase.auth.getSession();
            const currentUserId = session?.user?.id;
            
            // 1. Fetch only current season predictions (Optimized fetch)
            const [
              { data: profiles },
              { data: predictions }
            ] = await Promise.all([
              supabase.from('profiles').select('id, username'),
              // Type cast: PostgrestFilterBuilder is thenable but not a standard Promise, 
              // requiring double-casting for use in Promise.all.
              supabase.from('predictions').select('*').ilike('race_id', `${CURRENT_SEASON}_%`) as unknown as Promise<{ data: DbPrediction[] | null }>
            ]);

            if (profiles && Object.keys(raceResultsMap).length > 0) {
              // 2. Pre-process predictions into a Map for O(1) user lookup
              const predByUserId = mapPredictionsByUser(predictions);

              // 3. Map players and calculate points
              const players = profiles
                .filter(p => !isTestAccount(p.username) || p.id === currentUserId)
                .map(p => ({ 
                  username: p.username, 
                  predictions: predByUserId[p.id] || {}
                }));

              // 4. Add local/guest players
              const localPlayers: string[] = [];
              try {
                const stored = localStorage.getItem(STORAGE_KEYS.PLAYERS_LIST);
                const parsed = stored ? JSON.parse(stored) : [];
                if (Array.isArray(parsed)) localPlayers.push(...parsed);
              } catch (e) {
                console.warn('Home: Failed to parse players list', e);
              }

              localPlayers.forEach(lp => {
                const lpPreds: { [round: string]: { p10: string, dnf: string } } = {};
                Object.keys(raceResultsMap).forEach(round => {
                  try {
                    const predStr = localStorage.getItem(getPredictionKey(CURRENT_SEASON, lp, round));
                    if (predStr) lpPreds[round] = JSON.parse(predStr);
                  } catch (e) {
                    console.warn(`Home: Failed to parse prediction for ${lp} round ${round}`, e);
                  }
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
  }, [supabase, nextRace?.id, allDrivers.length, session, currentUser, syncVersion, f1Loading, calendar.length]); // eslint-disable-line react-hooks/exhaustive-deps

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
      <Container className="mt-2 mt-md-3 flex-grow-1">
        <StandardPageHeader 
          title="P10 Racing"
          subtitle={session ? `Hello, ${displayName}` : 'Play as Guest'}
          icon={<User size={24} className="text-white" />}

        />
        <Row className="justify-content-center text-center mt-2 mt-md-3">
          <Col md={10} lg={8} className="mb-1">
            <h1 className="display-5 fw-bold mb-1 text-white letter-spacing-1">MASTER THE <span className="text-danger">MIDFIELD</span></h1>
            <p className="small text-white opacity-75 mb-3 mx-auto" style={{ maxWidth: '600px' }}>
              Predict the 10th place finisher and the first DNF of the<br />
              <span className="text-danger fw-bold">{nextRace?.name || 'next Grand Prix'}</span>.
            </p>
            
            {nextRace && !loading && isSeasonFinished && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.6, type: 'spring' }}
                className="f1-accent-card mb-4 p-4 border-warning border-opacity-50 overflow-hidden position-relative"
              >
                {/* Decorative particles */}
                {[...Array(6)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="position-absolute bg-warning opacity-25 rounded-circle"
                    animate={{
                      y: [0, -100],
                      x: [0, (i % 2 === 0 ? 20 : -20) * (i + 1)],
                      opacity: [0.2, 0],
                      scale: [1, 0]
                    }}
                    transition={{
                      duration: 2 + i,
                      repeat: Infinity,
                      ease: "easeOut",
                      delay: i * 0.5
                    }}
                    style={{
                      width: '8px',
                      height: '8px',
                      bottom: '20px',
                      left: `${15 + (i * 15)}%`,
                      zIndex: 0
                    }}
                  />
                ))}

                <div className="position-relative" style={{ zIndex: 1 }}>
                  <div className="text-uppercase fw-bold text-warning mb-2 letter-spacing-2" style={{ fontSize: '0.8rem' }}>🏆 Season Champion 🏆</div>
                  <motion.h2 
                    className="display-6 fw-bold text-white mb-2"
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    {champion ? champion.toUpperCase() : 'SEASON FINISHED'}
                  </motion.h2>
                  <p className="text-muted small mb-3">Congratulations! Check the leaderboard to see the final standings for {CURRENT_SEASON}.</p>
                  <HapticLink 
                    href="/leaderboard"
                    className="btn btn-warning fw-bold px-4 rounded-pill text-decoration-none d-inline-flex align-items-center justify-content-center shadow"
                    hapticStyle="medium"
                  >
                    VIEW FINAL STANDINGS
                  </HapticLink>
                </div>
              </motion.div>
            )}

            {!isSeasonFinished && (
              <div style={{ minHeight: "100px" }} className="d-flex flex-column align-items-center justify-content-center mb-3" suppressHydrationWarning>
                {nextRace && (
                  <>
                    {showCountdown ? (
                      <motion.div
                        initial={isColdStart ? { opacity: 0, y: 5 } : false}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                      >
                        <div className="text-uppercase fw-bold text-danger mb-1 letter-spacing-2" style={{ fontSize: '0.6rem', opacity: 0.8 }}>Race Starts In</div>
                        <div className="d-flex justify-content-center gap-2 px-2 mx-auto" style={{ maxWidth: '300px' }}>
                          {[
                            { label: 'D', val: countdown.d },
                            { label: 'H', val: countdown.h },
                            { label: 'M', val: countdown.m },
                            { label: 'S', val: countdown.s }
                          ].map(item => (
                            <div key={item.label} className="bg-dark border border-secondary border-opacity-50 rounded shadow-sm d-flex flex-column align-items-center justify-content-center" style={{ width: '55px', height: '55px', flexShrink: 0 }}>
                              <div className="h5 fw-bold text-white mb-0 line-height-1">{item.val}</div>
                              <div className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.5rem', letterSpacing: '0.5px' }}>{item.label}</div>
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
                <HapticLink 
                  href="/predict" 
                  hapticStyle="medium"
                  className="btn btn-f1 btn-lg px-4 py-2 fw-bold text-decoration-none d-inline-flex align-items-center justify-content-center"
                  style={{ fontSize: '0.9rem', minWidth: '200px' }}
                  suppressHydrationWarning
                >
                  {isLocked 
                    ? (userPrediction ? 'VIEW RACE CENTER' : 'PREDICTIONS CLOSED') 
                    : (userPrediction ? 'UPDATE PREDICTION' : 'MAKE PREDICTION')}
                </HapticLink>
              ) : (
                <HapticLink 
                  href="/history" 
                  hapticStyle="medium"
                  className="btn btn-danger btn-lg px-4 py-2 fw-bold text-decoration-none d-inline-flex align-items-center justify-content-center rounded-pill"
                  style={{ fontSize: '0.9rem', minWidth: '200px' }}
                >
                  VIEW SEASON RECAP
                </HapticLink>
              )}
              <HapticLink 
                href="/leaderboard" 
                hapticStyle="medium"
                className="btn btn-outline-light btn-lg px-4 py-2 fw-bold text-decoration-none d-inline-flex align-items-center justify-content-center opacity-75"
                style={{ fontSize: '0.9rem', minWidth: '200px' }}
              >
                {isSeasonFinished ? 'FINAL STANDINGS' : 'LEADERBOARD'}
              </HapticLink>
            </div>
            
            <div className="mb-4">
              <HowToPlayButton onClick={() => router.push('/predict?howto=true')} />
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
              <HapticLink 
                href="/leagues" 
                className="btn btn-outline-danger btn-sm rounded-pill px-3 fw-bold mt-2 align-self-start d-inline-flex text-decoration-none"
              >
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
                    <HapticLink 
                      href="/auth" 
                      hapticStyle="medium"
                      className="btn btn-primary btn-sm px-4 py-1 fw-bold rounded-pill text-decoration-none d-inline-flex align-items-center justify-content-center"
                      style={{ fontSize: '0.7rem' }}
                    >
                      GET STARTED
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
