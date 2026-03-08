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
      // Ensure we have a valid Date object by handling the ISO format correctly
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
    <main>
      <AppNavbar />

      <Container className="mt-5">
        <Row className="justify-content-center text-center">
          <Col md={8}>
            <h1 className="display-4 fw-bold mb-4">Master the Midfield.</h1>
            <p className="lead mb-5">
              Predict the 10th place finisher and the first DNF of the {nextRace?.name || 'next Grand Prix'}.
            </p>
            
            {nextRace && !loading && showCountdown && (
              <div className="d-flex justify-content-center gap-2 gap-md-3 mb-5 px-2">
                {[
                  { label: 'Days', val: countdown.d },
                  { label: 'Hrs', val: countdown.h },
                  { label: 'Min', val: countdown.m },
                  { label: 'Sec', val: countdown.s }
                ].map(item => (
                  <div key={item.label} className="p-2 p-md-3 bg-dark border border-secondary rounded flex-fill flex-md-none shadow-sm" style={{ minWidth: '70px', maxWidth: '100px' }}>
                    <div className="fs-3 fw-bold text-white">{item.val}</div>
                    <div className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.65rem', letterSpacing: '1px' }}>{item.label}</div>
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
          <Col md={6}>
            <div className="p-4 border border-secondary rounded h-100 bg-dark bg-opacity-25 shadow-sm">
              <h3 className="h6 text-uppercase fw-bold text-danger letter-spacing-1 mb-3">Next Race</h3>
              {loading ? (
                <Spinner animation="border" size="sm" variant="danger" />
              ) : (
                <>
                  <p className="fs-3 fw-bold mb-0 text-white">{nextRace?.name}</p>
                  <p className="text-muted mb-2">{nextRace?.circuit}</p>
                  <div className="badge bg-danger bg-opacity-25 text-danger px-3 py-2 border border-danger border-opacity-25 rounded-pill fw-bold">
                    {nextRace && new Date(nextRace.date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </div>
                </>
              )}
            </div>
          </Col>
          
          {currentUser && (
            <Col md={6}>
              <div className="p-4 border border-danger border-opacity-50 rounded h-100 bg-danger bg-opacity-10 shadow-sm">
                <h3 className="h6 text-uppercase text-white fw-bold letter-spacing-1 mb-3">Your Prediction</h3>
                {userPrediction ? (
                  <Row className="mt-3 g-4">
                    <Col xs={6}>
                      <small className="text-muted d-block text-uppercase mb-1 fw-bold letter-spacing-1" style={{ fontSize: '0.65rem' }}>P10 Pick</small>
                      <span className="fs-5 fw-bold text-white">
                        {allDrivers.find(d => d.id === userPrediction.p10)?.name || (userPrediction.p10 && userPrediction.p10.toUpperCase())}
                      </span>
                    </Col>
                    <Col xs={6}>
                      <small className="text-muted d-block text-uppercase mb-1 fw-bold letter-spacing-1" style={{ fontSize: '0.65rem' }}>First DNF</small>
                      <span className="fs-5 fw-bold text-danger">
                        {allDrivers.find(d => d.id === userPrediction.dnf)?.name || (userPrediction.dnf && userPrediction.dnf.toUpperCase())}
                      </span>
                    </Col>
                  </Row>
                ) : (
                  <div className="mt-3">
                    <p className="small text-muted mb-3">No prediction submitted for this race yet.</p>
                    <Link href="/predict" className="btn btn-sm btn-outline-danger px-4 rounded-pill fw-bold" onClick={triggerHaptic}>Predict Now →</Link>
                  </div>
                )}
              </div>
            </Col>
          )}
        </Row>
      </Container>

      <footer className="mt-auto py-5 border-top border-secondary border-opacity-25 text-center mt-5">
        <p className="text-muted small mb-1 fw-bold letter-spacing-1">© 2026 P10 RACING</p>
        <Link href="/admin" className="text-muted small text-decoration-none opacity-25" onClick={triggerHaptic}>ADMIN</Link>
      </footer>
    </main>
  );
}
