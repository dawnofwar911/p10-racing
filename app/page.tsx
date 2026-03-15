'use client';

import { useState, useEffect } from 'react';
import { Container, Row, Col, Button, Spinner } from 'react-bootstrap';
import Link from 'next/link';
import { CURRENT_SEASON, DRIVERS as FALLBACK_DRIVERS, SimplifiedResults } from '@/lib/data';
import { fetchCalendar, fetchDrivers, ApiCalendarRace, AppDriver, DbPrediction } from '@/lib/api';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Share } from '@capacitor/share';
import { calculateSeasonPoints } from '@/lib/scoring';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useNotification } from '@/components/Notification';
import { getDriverDisplayName } from '@/lib/utils/drivers';

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
  const [nextRace, setNextRace] = useState<HomeRace | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [userPrediction, setUserPrediction] = useState<HomePrediction | null>(null);
  const [countdown, setCountdown] = useState({ d: 0, h: 0, m: 0, s: 0 });
  const [showCountdown, setShowCountdown] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [isRaceInProgress, setIsRaceInProgress] = useState(false);
  const [allDrivers, setAllDrivers] = useState<AppDriver[]>(FALLBACK_DRIVERS as unknown as AppDriver[]);
  const [isSeasonFinished, setIsSeasonFinished] = useState(false);
  const [champion, setChampion] = useState<string | null>(null);

  const supabase = createClient();
  const router = useRouter();
  const { showNotification } = useNotification();

  useEffect(() => {
    async function init() {
      // 0. Check for recovery hash or PKCE code - handle Supabase redirecting to home page
      // We ONLY want to redirect to reset-password if it is explicitly a recovery type
      const isRecovery = typeof window !== 'undefined' && window.location.hash.includes('type=recovery');
      const hasRecoveryParam = typeof window !== 'undefined' && window.location.search.includes('type=recovery');

      // We only want to force redirect if it is EXPLICITLY recovery.      // Generic 'code' or 'access_token' are used for signups too.
      if (isRecovery || hasRecoveryParam) {
        console.log('Recovery token detected, redirecting to reset-password');
        const target = '/auth/reset-password' + window.location.search + window.location.hash;
        router.replace(target);
        return;
      }

      // If it's a PKCE code but NOT a recovery type, we let it pass to getSession()
      // Supabase will exchange it for a session automatically.
      const { data: { session } } = await supabase.auth.getSession();

      // Secondary check: if session exists but user came from recovery
      if (session && window.location.hash.includes('type=recovery')) {
        console.log('Recovery bypass detected, signing out and forcing redirect');
        await supabase.auth.signOut();
        router.replace('/auth/reset-password' + window.location.hash);
        return;
      }
      setHasSession(!!session);
      
      const user = localStorage.getItem('p10_current_user');
      setCurrentUser(user);

      // Load from cache first
      const cachedRace = localStorage.getItem('p10_cache_next_race');
      const cachedDrivers = localStorage.getItem('p10_cache_drivers');
      if (cachedRace) setNextRace(JSON.parse(cachedRace));
      if (cachedDrivers) setAllDrivers(JSON.parse(cachedDrivers));
      if (cachedRace || cachedDrivers) setLoading(false);

        const [races, drivers] = await Promise.all([
        fetchCalendar(CURRENT_SEASON),
        fetchDrivers(CURRENT_SEASON)
      ]);

      if (drivers.length > 0) {
        setAllDrivers(drivers);
        localStorage.setItem('p10_cache_drivers', JSON.stringify(drivers));
      }

      if (races.length > 0) {
        const now = new Date();
        // Find the "active" race using the same 4-hour window logic as the predict page
        let activeIndex = races.findIndex((r: ApiCalendarRace) => {
          const raceTime = new Date(`${r.date}T${r.time || '00:00:00Z'}`);
          const fourHoursLater = new Date(raceTime.getTime() + 4 * 60 * 60 * 1000);
          return fourHoursLater > now;
        });

        if (activeIndex === -1) {
          activeIndex = races.length - 1;
        }

        const upcoming = races[activeIndex];

        // Calculate if ALL races in the calendar have results in localStorage
        let resultsCount = 0;
        races.forEach((r: ApiCalendarRace) => {
          if (localStorage.getItem(`results_${CURRENT_SEASON}_${r.round}`)) {
            resultsCount++;
          }
        });
        const allRacesHaveResults = resultsCount > 0 && resultsCount === races.length;

        // Season is finished if activeIndex is at the end and all races have results
        if (activeIndex === races.length - 1 && allRacesHaveResults) {
          setIsSeasonFinished(true);
          // Fetch leaderboard to find champion
          const { data: profiles } = await supabase.from('profiles').select('id, username');
          const { data: predictions } = await supabase.from('predictions').select('*') as { data: DbPrediction[] | null };
          const { data: dbResults } = await supabase.from('verified_results').select('*');

          const raceResultsMap: { [round: string]: SimplifiedResults } = {};
          if (dbResults) {
            dbResults.forEach(res => {
              const round = res.id.split('_')[1];
              raceResultsMap[round] = res.data as unknown as SimplifiedResults;
            });
          }
          
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

            // Include local players for a complete champion search
            const localPlayers: string[] = JSON.parse(localStorage.getItem('p10_players') || '[]');
            localPlayers.forEach(lp => {
              const lpPreds: { [round: string]: { p10: string, dnf: string } } = {};
              Object.keys(raceResultsMap).forEach(round => {
                const predStr = localStorage.getItem(`final_pred_${CURRENT_SEASON}_${lp}_${round}`);
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
        setNextRace(raceObj);
        localStorage.setItem('p10_cache_next_race', JSON.stringify(raceObj));

        // Calculate locking based on start time
        const raceStartTime = new Date(`${raceObj.date}T${raceObj.time}`);
        const lockTime = new Date(raceStartTime.getTime() + (2 * 60 * 1000));
        setIsLocked(now > lockTime);

        if (session) {
          const { data: pred } = await supabase
            .from('predictions')
            .select('*')
            .eq('user_id', session.user.id)
            .eq('race_id', `${CURRENT_SEASON}_${raceObj.id}`)
            .maybeSingle();
          
          if (pred) {
            setUserPrediction({
              p10: pred.p10_driver_id,
              dnf: pred.dnf_driver_id
            });
          } else {
            // Offline/Cache fallback for auth users
            const storageUser = localStorage.getItem('p10_cache_username') || session.user.id;
            const cachedPred = localStorage.getItem(`final_pred_${CURRENT_SEASON}_${storageUser}_${raceObj.id}`);
            if (cachedPred) setUserPrediction(JSON.parse(cachedPred));
          }
        } else if (user) {
          const predStr = localStorage.getItem(`final_pred_${CURRENT_SEASON}_${user}_${raceObj.id}`);
          if (predStr) setUserPrediction(JSON.parse(predStr));
        }
      }
      setLoading(false);
    }
    init();
  }, [supabase, router]);

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

    calculate(); // Run immediately
    const timer = setInterval(calculate, 1000); // Then every second

    return () => clearInterval(timer);
  }, [nextRace]);

  const triggerHaptic = () => {
    Haptics.impact({ style: ImpactStyle.Medium });
  };

  const handleShare = async () => {
    if (!userPrediction || !nextRace) return;
    triggerHaptic();
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
      // Only copy to clipboard if sharing is truly unavailable (e.g. non-secure web or unsupported browser)
      console.log('Share dismissed or failed:', error);
      
      if (!navigator.share && navigator.clipboard) {
        navigator.clipboard.writeText(text + '\n\nhttps://p10racing.app');
        showNotification('Picks copied to clipboard!', 'success');
      }
    }
  };

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
              <div className="mb-4 p-4 border border-warning rounded bg-warning bg-opacity-10 shadow-lg">
                <div className="text-uppercase fw-bold text-warning mb-2 letter-spacing-2" style={{ fontSize: '0.8rem' }}>🏆 Season Champion 🏆</div>
                <h2 className="display-6 fw-bold text-white mb-2">
                  {champion ? champion.toUpperCase() : 'SEASON FINISHED'}
                </h2>
                <p className="text-muted small mb-3">Congratulations! Check the leaderboard to see the final standings for {CURRENT_SEASON}.</p>
                <Link href="/leaderboard" passHref legacyBehavior>
                  <Button variant="warning" className="fw-bold px-4 rounded-pill">VIEW FINAL STANDINGS</Button>
                </Link>
              </div>
            )}

            {nextRace && !loading && !isSeasonFinished && (
              <>
                {showCountdown ? (
                  <div className="mb-4">
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
                  </div>
                ) : isRaceInProgress ? (
                  <div className="mb-4">
                    <div className="text-uppercase fw-bold text-success mb-2 letter-spacing-2 animate-pulse" style={{ fontSize: '0.65rem', opacity: 0.8 }}>Race In Progress</div>
                    <div className="h4 fw-bold text-white mb-0 letter-spacing-1">TRACK ACTION LIVE 🏎️</div>
                  </div>
                ) : null}
              </>
            )}

            <div className="d-flex flex-column flex-sm-row justify-content-center gap-2 mb-2 px-4 px-sm-0">
              {!isSeasonFinished ? (
                <Link href="/predict" passHref legacyBehavior>
                  <Button size="lg" className="btn-f1 px-4 py-2 fw-bold" style={{ fontSize: '0.9rem' }} onClick={triggerHaptic}>
                    {isLocked 
                      ? (userPrediction ? 'VIEW RACE CENTER' : 'PREDICTIONS CLOSED') 
                      : (userPrediction ? 'UPDATE PREDICTION' : 'MAKE PREDICTION')}
                  </Button>
                </Link>
              ) : (
                <Link href="/history" passHref legacyBehavior>
                  <Button size="lg" variant="danger" className="px-4 py-2 fw-bold" style={{ fontSize: '0.9rem' }} onClick={triggerHaptic}>
                    VIEW SEASON RECAP
                  </Button>
                </Link>
              )}
              <Link href="/leaderboard" passHref legacyBehavior>
                <Button variant="outline-light" size="lg" className="px-4 py-2 fw-bold opacity-75" style={{ fontSize: '0.9rem' }} onClick={triggerHaptic}>
                  {isSeasonFinished ? 'FINAL STANDINGS' : 'LEADERBOARD'}
                </Button>
              </Link>
            </div>
            
            <div className="mb-4">
              <Link href="/predict?howto=true" className="text-decoration-none text-danger fw-bold letter-spacing-1 small opacity-75 hover-opacity-100" onClick={triggerHaptic} style={{ fontSize: '0.7rem' }}>
                HOW IT WORKS →
              </Link>
            </div>

            {!isSeasonFinished && userPrediction && nextRace && (
              <div className="mb-4 p-3 border border-danger border-opacity-20 rounded bg-dark bg-opacity-50 shadow-sm mx-auto" style={{ maxWidth: '400px' }}>
                <h3 className="text-uppercase fw-bold text-danger letter-spacing-1 mb-3" style={{ fontSize: '0.65rem' }}>
                  Your {nextRace.name} Picks {isLocked && '🔒'}
                </h3>
                <div className="d-flex justify-content-center gap-4 mb-3">
                  <div>
                    <small className="text-white opacity-50 d-block text-uppercase mb-0 fw-bold letter-spacing-1" style={{ fontSize: '0.55rem' }}>P10</small>
                    <span className="fw-bold text-white h6 mb-0">
                      {getDriverDisplayName(userPrediction.p10, allDrivers)}
                    </span>
                  </div>
                  <div className="border-start border-secondary border-opacity-25 ps-4">
                    <small className="text-white opacity-50 d-block text-uppercase mb-0 fw-bold letter-spacing-1" style={{ fontSize: '0.55rem' }}>DNF</small>
                    <span className="fw-bold text-danger h6 mb-0">
                      {getDriverDisplayName(userPrediction.dnf, allDrivers)}
                    </span>
                  </div>
                </div>
                <Button variant="outline-danger" size="sm" className="rounded-pill px-4 fw-bold w-100" style={{ fontSize: '0.65rem' }} onClick={handleShare}>
                  SHARE PICKS ↗
                </Button>
              </div>
            )}

          </Col>
        </Row>

        <Row className="mt-2 g-3 px-1">
          <Col md={6}>
            <div className="p-3 border border-secondary border-opacity-25 rounded h-100 bg-dark bg-opacity-50 shadow-sm">
              <h3 className="text-uppercase fw-bold text-danger letter-spacing-1 mb-2" style={{ fontSize: '0.65rem' }}>Next Race</h3>
              {loading ? (
                <Spinner animation="border" size="sm" variant="danger" />
              ) : (
                <>
                  <p className="fw-bold mb-0 text-white" style={{ fontSize: '1.1rem' }}>{nextRace?.name}</p>
                  <p className="text-white opacity-50 small mb-2">{nextRace?.circuit}</p>
                  <div className="badge bg-danger bg-opacity-10 text-danger px-2 py-1 border border-danger border-opacity-20 rounded-pill fw-bold" style={{ fontSize: '0.65rem' }}>
                    {nextRace && new Date(nextRace.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                </>
              )}
            </div>
          </Col>

          <Col md={6}>
            <div className="p-3 border border-secondary border-opacity-25 rounded h-100 bg-dark bg-opacity-50 shadow-sm d-flex flex-column justify-content-between">
              <div>
                <h3 className="text-uppercase fw-bold text-white opacity-50 letter-spacing-1 mb-2" style={{ fontSize: '0.65rem' }}>Your Leagues</h3>
                <p className="fw-bold mb-1 text-white" style={{ fontSize: '1.1rem' }}>Compete with Friends</p>
              </div>
              <Link href="/leagues" className="btn btn-outline-danger btn-sm rounded-pill px-3 fw-bold mt-2 align-self-start" style={{ fontSize: '0.65rem' }} onClick={triggerHaptic}>
                View Leagues →
              </Link>
            </div>
          </Col>
        </Row>

        {!loading && !hasSession && !currentUser && (
          <Row className="mt-4 justify-content-center">
            <Col md={6}>
              <div className="p-3 border border-primary border-opacity-20 rounded bg-primary bg-opacity-5 text-center shadow-sm">
                <h2 className="fw-bold text-white mb-1" style={{ fontSize: '1rem' }}>Join the Grid</h2>
                <p className="extra-small text-white opacity-60 mb-2" style={{ fontSize: '0.75rem' }}>Save predictions and compete in leagues.</p>
                <Link href="/auth" passHref legacyBehavior>
                  <Button variant="primary" size="sm" className="px-4 py-1 fw-bold rounded-pill" style={{ fontSize: '0.7rem' }} onClick={triggerHaptic}>GET STARTED</Button>
                </Link>
              </div>
            </Col>
          </Row>
        )}
      </Container>
    </>
  );
}
