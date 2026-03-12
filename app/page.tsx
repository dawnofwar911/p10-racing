'use client';

import { useState, useEffect } from 'react';
import { Container, Row, Col, Button, Spinner } from 'react-bootstrap';
import Link from 'next/link';
import { CURRENT_SEASON, DRIVERS as FALLBACK_DRIVERS, SimplifiedResults } from '@/lib/data';
import { fetchCalendar, fetchDrivers, ApiCalendarRace, AppDriver, DbPrediction } from '@/lib/api';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { calculateSeasonPoints } from '@/lib/scoring';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

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
  const [allDrivers, setAllDrivers] = useState<AppDriver[]>(FALLBACK_DRIVERS as unknown as AppDriver[]);
  const [isSeasonFinished, setIsSeasonFinished] = useState(false);
  const [champion, setChampion] = useState<string | null>(null);

  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    async function init() {
      // 0. Check for recovery hash or PKCE code - handle Supabase redirecting to home page
      const hasRecoveryToken = typeof window !== 'undefined' && (window.location.hash.includes('type=recovery') || window.location.hash.includes('access_token='));
      const hasRecoveryCode = typeof window !== 'undefined' && window.location.search.includes('code=');

      if (hasRecoveryToken || hasRecoveryCode) {
        console.log('Recovery token/code detected on home page, redirecting to reset-password');
        const target = '/auth/reset-password' + window.location.search + window.location.hash;
        router.replace(target);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();

      // Secondary check: if session exists but user came from recovery
      if (session && window.location.hash.includes('type=recovery')) {
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
        const upcoming = races.find((r: ApiCalendarRace) => {
          const raceTime = new Date(`${r.date}T${r.time || '00:00:00Z'}`);
          return raceTime > now;
        });

        // Calculate if ALL races in the calendar have results in localStorage
        let resultsCount = 0;
        races.forEach((r: ApiCalendarRace) => {
          if (localStorage.getItem(`results_${CURRENT_SEASON}_${r.round}`)) {
            resultsCount++;
          }
        });
        const allRacesHaveResults = resultsCount > 0 && resultsCount === races.length;

        if (!upcoming && allRacesHaveResults) {
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

        const raceToShow = upcoming || races[races.length - 1]; // Use last race if season finished

        const raceObj: HomeRace = {
          id: raceToShow.round,
          name: raceToShow.raceName,
          circuit: raceToShow.Circuit.circuitName,
          date: raceToShow.date,
          time: raceToShow.time || '00:00:00Z',
          round: parseInt(raceToShow.round)
        };
        setNextRace(raceObj);
        localStorage.setItem('p10_cache_next_race', JSON.stringify(raceObj));

        if (user) {
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

      if (distance < 0) {
        setShowCountdown(false);
      } else {
        setShowCountdown(true);
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

            {nextRace && !loading && !isSeasonFinished && showCountdown && (
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
            )}

            <div className="d-flex flex-column flex-sm-row justify-content-center gap-2 mb-2 px-4 px-sm-0">
              {!isSeasonFinished ? (
                <Link href="/predict" passHref legacyBehavior>
                  <Button size="lg" className="btn-f1 px-4 py-2 fw-bold" style={{ fontSize: '0.9rem' }} onClick={triggerHaptic}>
                    {userPrediction ? 'UPDATE PREDICTION' : 'MAKE PREDICTION'}
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
          </Col>
        </Row>

        <Row className="mt-2 g-3 px-1">
          <Col md={4}>
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

          <Col md={4}>
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
          
          {currentUser && (
            <Col md={4}>
              <div className="p-3 border border-danger border-opacity-20 rounded h-100 bg-danger bg-opacity-5 shadow-sm">
                <h3 className="text-uppercase text-white fw-bold letter-spacing-1 mb-2" style={{ fontSize: '0.65rem', opacity: 0.6 }}>Your Prediction</h3>
                {userPrediction ? (
                  <Row className="mt-1 g-2">
                    <Col xs={6}>
                      <small className="text-white opacity-50 d-block text-uppercase mb-0 fw-bold letter-spacing-1" style={{ fontSize: '0.55rem' }}>P10</small>
                      <span className="fw-bold text-white small">
                        {allDrivers.find(d => d.id === userPrediction.p10)?.name?.split(' ').pop() || (userPrediction.p10?.split('_').pop()?.toUpperCase())}
                      </span>
                    </Col>
                    <Col xs={6}>
                      <small className="text-white opacity-50 d-block text-uppercase mb-0 fw-bold letter-spacing-1" style={{ fontSize: '0.55rem' }}>DNF</small>
                      <span className="fw-bold text-danger small">
                        {allDrivers.find(d => d.id === userPrediction.dnf)?.name?.split(' ').pop() || (userPrediction.dnf?.split('_').pop()?.toUpperCase())}
                      </span>
                    </Col>
                  </Row>
                ) : !loading ? (
                  <div>
                    <p className="extra-small text-white opacity-50 mb-2" style={{ fontSize: '0.7rem' }}>No prediction yet.</p>
                    <Link href="/predict" className="btn btn-sm btn-outline-danger px-3 rounded-pill fw-bold" style={{ fontSize: '0.65rem' }} onClick={triggerHaptic}>Predict Now →</Link>
                  </div>
                ) : (
                  <div className="py-2"><Spinner animation="border" size="sm" variant="danger" /></div>
                )}
              </div>
            </Col>
          )}
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
