'use client';

import { useState, useEffect } from 'react';
import { Container, Row, Col, Button, Spinner } from 'react-bootstrap';
import Link from 'next/link';
import { CURRENT_SEASON, DRIVERS as FALLBACK_DRIVERS } from '@/lib/data';
import { fetchCalendar, fetchDrivers, ApiCalendarRace, AppDriver } from '@/lib/api';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import AppNavbar from '@/components/AppNavbar';

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
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [userPrediction, setUserPrediction] = useState<HomePrediction | null>(null);
  const [countdown, setCountdown] = useState({ d: 0, h: 0, m: 0, s: 0 });
  const [showCountdown, setShowCountdown] = useState(false);
  const [allDrivers, setAllDrivers] = useState<AppDriver[]>(FALLBACK_DRIVERS as unknown as AppDriver[]);

  useEffect(() => {
    async function init() {
      const user = localStorage.getItem('p10_current_user');
      setCurrentUser(user);

      const [races, drivers] = await Promise.all([
        fetchCalendar(CURRENT_SEASON),
        fetchDrivers(CURRENT_SEASON)
      ]);

      if (drivers.length > 0) {
        setAllDrivers(drivers);
      }

      if (races.length > 0) {
        const now = new Date();
        const upcoming = races.find((r: ApiCalendarRace) => {
          const raceTime = new Date(`${r.date}T${r.time || '00:00:00Z'}`);
          return raceTime > now;
        }) || races[0];

        const raceObj: HomeRace = {
          id: upcoming.round,
          name: upcoming.raceName,
          circuit: upcoming.Circuit.circuitName,
          date: upcoming.date,
          time: upcoming.time || '00:00:00Z',
          round: parseInt(upcoming.round)
        };
        setNextRace(raceObj);

        if (user) {
          const predStr = localStorage.getItem(`final_pred_${user}_${raceObj.id}`);
          if (predStr) setUserPrediction(JSON.parse(predStr));
        }
      }
      setLoading(false);
    }
    init();
  }, []);

  useEffect(() => {
    if (!nextRace) return;

    const timer = setInterval(() => {
      const now = new Date().getTime();
      const targetStr = `${nextRace.date}T${nextRace.time}`;
      const target = new Date(targetStr).getTime();
      const distance = target - now;

      if (distance < 0) {
        setShowCountdown(false);
        clearInterval(timer);
      } else {
        setShowCountdown(true);
        setCountdown({
          d: Math.floor(distance / (1000 * 60 * 60 * 24)),
          h: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          m: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
          s: Math.floor((distance % (1000 * 60)) / 1000)
        });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [nextRace]);

  const triggerHaptic = () => {
    Haptics.impact({ style: ImpactStyle.Medium });
  };

  return (
    <main style={{ backgroundColor: '#15151e', minHeight: '100vh' }}>
      <AppNavbar />

      <Container className="mt-5">
        <Row className="justify-content-center text-center">
          <Col md={8}>
            <h1 className="display-4 fw-bold mb-4 text-white">Master the Midfield.</h1>
            <p className="lead mb-5 text-white opacity-75">
              Predict the 10th place finisher and the first DNF of the {nextRace?.name || 'next Grand Prix'}.
            </p>
            
            {nextRace && !loading && showCountdown && (
              <div className="d-flex justify-content-center gap-2 gap-md-3 mb-5 px-2">
                {[
                  { label: 'DAYS', val: countdown.d },
                  { label: 'HRS', val: countdown.h },
                  { label: 'MINS', val: countdown.m },
                  { label: 'SECS', val: countdown.s }
                ].map(item => (
                  <div key={item.label} className="p-3 bg-dark border border-secondary rounded flex-fill shadow-sm" style={{ minWidth: '75px', maxWidth: '110px' }}>
                    <div className="fs-2 fw-bold text-white mb-1">{item.val}</div>
                    <div className="text-danger text-uppercase fw-bold" style={{ fontSize: '0.7rem', letterSpacing: '1.5px' }}>{item.label}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="d-grid gap-3 d-sm-flex justify-content-sm-center mb-5">
              <Link href="/predict" passHref legacyBehavior>
                <Button size="lg" className="btn-f1 px-5 py-3 fw-bold" onClick={triggerHaptic}>
                  {userPrediction ? 'UPDATE PREDICTION' : 'MAKE PREDICTION'}
                </Button>
              </Link>
              <Link href="/leaderboard" passHref legacyBehavior>
                <Button variant="outline-light" size="lg" className="px-5 py-3 fw-bold" onClick={triggerHaptic}>
                  LEADERBOARD
                </Button>
              </Link>
            </div>
          </Col>
        </Row>

        <Row className="mt-4 g-4 px-2">
          <Col md={4}>
            <div className="p-4 border border-secondary rounded h-100 bg-dark shadow-sm">
              <h3 className="h6 text-uppercase fw-bold text-danger letter-spacing-1 mb-3">Next Race</h3>
              {loading ? (
                <Spinner animation="border" size="sm" variant="danger" />
              ) : (
                <>
                  <p className="fs-3 fw-bold mb-0 text-white">{nextRace?.name}</p>
                  <p className="text-white opacity-50 mb-3">{nextRace?.circuit}</p>
                  <div className="badge bg-danger bg-opacity-25 text-danger px-3 py-2 border border-danger border-opacity-25 rounded-pill fw-bold">
                    {nextRace && new Date(nextRace.date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </div>
                </>
              )}
            </div>
          </Col>

          <Col md={4}>
            <div className="p-4 border border-secondary rounded h-100 bg-dark shadow-sm">
              <h3 className="h6 text-uppercase fw-bold text-white opacity-50 letter-spacing-1 mb-3">Your Leagues</h3>
              <p className="fs-4 fw-bold mb-2 text-white">Compete with Friends</p>
              <Link href="/leagues" className="btn btn-outline-danger btn-sm rounded-pill px-4 fw-bold mt-2" onClick={triggerHaptic}>
                View Leagues →
              </Link>
            </div>
          </Col>
          
          {currentUser && (
            <Col md={4}>
              <div className="p-4 border border-danger border-opacity-50 rounded h-100 bg-danger bg-opacity-10 shadow-sm">
                <h3 className="h6 text-uppercase text-white fw-bold letter-spacing-1 mb-3">Your Prediction</h3>
                {userPrediction ? (
                  <Row className="mt-3 g-4">
                    <Col xs={6}>
                      <small className="text-white opacity-50 d-block text-uppercase mb-1 fw-bold letter-spacing-1" style={{ fontSize: '0.65rem' }}>P10 Pick</small>
                      <span className="fs-5 fw-bold text-white">
                        {allDrivers.find(d => d.id === userPrediction.p10)?.name || (userPrediction.p10 && userPrediction.p10.toUpperCase().replace('_', ' '))}
                      </span>
                    </Col>
                    <Col xs={6}>
                      <small className="text-white opacity-50 d-block text-uppercase mb-1 fw-bold letter-spacing-1" style={{ fontSize: '0.65rem' }}>First DNF</small>
                      <span className="fs-5 fw-bold text-danger">
                        {allDrivers.find(d => d.id === userPrediction.dnf)?.name || (userPrediction.dnf && userPrediction.dnf.toUpperCase().replace('_', ' '))}
                      </span>
                    </Col>
                  </Row>
                ) : (
                  <div className="mt-3">
                    <p className="small text-white opacity-50 mb-3">No prediction submitted for this race yet.</p>
                    <Link href="/predict" className="btn btn-sm btn-outline-danger px-4 rounded-pill fw-bold" onClick={triggerHaptic}>Predict Now →</Link>
                  </div>
                )}
              </div>
            </Col>
          )}
        </Row>

        {!currentUser && (
          <Row className="mt-5 justify-content-center">
            <Col md={8}>
              <div className="p-5 border border-primary border-opacity-25 rounded bg-primary bg-opacity-10 text-center shadow-sm">
                <h2 className="h4 fw-bold text-white mb-3">Ready to Join the Grid?</h2>
                <p className="text-white opacity-75 mb-4">Create an account to save your predictions across devices and compete in private leagues with your friends.</p>
                <Link href="/auth" passHref legacyBehavior>
                  <Button variant="primary" className="px-5 py-3 fw-bold rounded-pill" onClick={triggerHaptic}>GET STARTED</Button>
                </Link>
              </div>
            </Col>
          </Row>
        )}
      </Container>

      <footer className="mt-auto py-5 border-top border-secondary border-opacity-25 text-center mt-5">
        <p className="text-white opacity-25 small mb-1 fw-bold letter-spacing-1">© 2026 P10 RACING • v1.0.0</p>
        <Link href="/privacy.html" className="text-white small text-decoration-none opacity-25" onClick={triggerHaptic}>PRIVACY</Link>
      </footer>
    </main>
  );
}
