'use client';

import { useState, useEffect } from 'react';
import { Container, Row, Col, Button, Navbar, Spinner } from 'react-bootstrap';
import Link from 'next/link';
import { RACES, CURRENT_SEASON, DRIVERS as FALLBACK_DRIVERS } from '@/lib/data';
import { fetchCalendar, fetchDrivers } from '@/lib/api';
import AppNavbar from '@/components/AppNavbar';

export default function Home() {
  const [nextRace, setNextRace] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [userPrediction, setUserPrediction] = useState<any>(null);
  const [countdown, setCountdown] = useState({ d: 0, h: 0, m: 0, s: 0 });
  const [allDrivers, setAllDrivers] = useState<any[]>(FALLBACK_DRIVERS);

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
        const upcoming = races.find(r => {
          const raceTime = new Date(`${r.date}T${r.time || '00:00:00Z'}`);
          return raceTime > now;
        }) || races[0];

        const raceObj = {
          id: upcoming.round,
          name: upcoming.raceName,
          circuit: upcoming.Circuit.circuitName,
          date: upcoming.date,
          time: upcoming.time || '00:00:00Z',
          round: parseInt(upcoming.round)
        };
        setNextRace(raceObj);

        if (user) {
          const pred = localStorage.getItem(`final_pred_${user}_${raceObj.id}`);
          if (pred) setUserPrediction(JSON.parse(pred));
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
      const target = new Date(`${nextRace.date}T${nextRace.time}`).getTime();
      const distance = target - now;

      if (distance < 0) {
        clearInterval(timer);
      } else {
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

  if (loading) {
    return (
      <main>
        <AppNavbar />
        <Container className="mt-5 text-center p-5">
          <Spinner animation="border" variant="danger" />
          <p className="mt-3 text-muted">Loading Formula 1 data...</p>
        </Container>
      </main>
    );
  }

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
            
            {nextRace && !loading && (
              <div className="d-flex justify-content-center gap-3 mb-5">
                {[
                  { label: 'Days', val: countdown.d },
                  { label: 'Hrs', val: countdown.h },
                  { label: 'Min', val: countdown.m },
                  { label: 'Sec', val: countdown.s }
                ].map(item => (
                  <div key={item.label} className="p-3 bg-dark border border-secondary rounded" style={{ minWidth: '80px' }}>
                    <div className="fs-3 fw-bold">{item.val}</div>
                    <div className="small text-muted text-uppercase">{item.label}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="d-grid gap-3 d-sm-flex justify-content-sm-center mb-5">
              <Link href="/predict" passHref legacyBehavior>
                <Button size="lg" className="btn-f1 px-5">
                  {userPrediction ? 'Update Prediction' : 'Make Prediction'}
                </Button>
              </Link>
              <Link href="/leaderboard" passHref legacyBehavior>
                <Button variant="outline-light" size="lg" className="px-5">
                  Leaderboard
                </Button>
              </Link>
            </div>
          </Col>
        </Row>

        <Row className="mt-4 g-4">
          <Col md={6}>
            <div className="p-4 border border-secondary rounded h-100 bg-dark bg-opacity-25">
              <h3 className="h5 text-uppercase" style={{ color: '#e10600' }}>Next Race</h3>
              {loading ? (
                <Spinner animation="border" size="sm" variant="danger" />
              ) : (
                <>
                  <p className="fs-4 fw-bold mb-0">{nextRace?.name}</p>
                  <p className="text-muted mb-0">{nextRace?.circuit}</p>
                  <small className="text-light opacity-50">
                    {nextRace && new Date(nextRace.date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </small>
                </>
              )}
            </div>
          </Col>
          
          {currentUser && (
            <Col md={6}>
              <div className="p-4 border border-danger rounded h-100 bg-danger bg-opacity-10">
                <h3 className="h5 text-uppercase text-white">Your Prediction</h3>
                {userPrediction ? (
                  <Row className="mt-3">
                    <Col xs={6}>
                      <small className="text-muted d-block text-uppercase">P10 Pick</small>
                      <span className="fw-bold text-white">
                        {allDrivers.find(d => d.id === userPrediction.p10)?.name || userPrediction.p10.toUpperCase()}
                      </span>
                    </Col>
                    <Col xs={6}>
                      <small className="text-muted d-block text-uppercase">First DNF</small>
                      <span className="fw-bold text-white">
                        {allDrivers.find(d => d.id === userPrediction.dnf)?.name || userPrediction.dnf.toUpperCase()}
                      </span>
                    </Col>
                  </Row>
                ) : (
                  <div className="mt-3">
                    <p className="small text-muted mb-0">No prediction submitted for this race yet.</p>
                    <Link href="/predict" className="small text-danger text-decoration-none">Predict now →</Link>
                  </div>
                )}
              </div>
            </Col>
          )}
        </Row>
      </Container>

      <footer className="mt-5 py-4 border-top border-secondary text-center">
        <p className="text-muted small">© 2026 P10 Racing</p>
        <Link href="/admin" className="text-muted small text-decoration-none opacity-50">Admin</Link>
      </footer>
    </main>
  );
}
