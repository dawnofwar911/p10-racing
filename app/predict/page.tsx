'use client';

import { useState, useEffect } from 'react';
import { Container, Row, Col, Form, Button, Card, Spinner } from 'react-bootstrap';
import { DRIVERS as FALLBACK_DRIVERS, RACES, CURRENT_SEASON, Driver } from '@/lib/data';
import { fetchCalendar, fetchDrivers, fetchQualifyingResults, fetchRaceResults, ApiCalendarRace, AppDriver, ApiResult } from '@/lib/api';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { getContrastColor } from '@/lib/utils/colors';
import { createClient } from '@/lib/supabase/client';
import { Session } from '@supabase/supabase-js';
import Link from 'next/link';
import AppNavbar from '@/components/AppNavbar';

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

export default function PredictPage() {
  const [username, setUsername] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const [p10Driver, setP10Driver] = useState('');
  const [dnfDriver, setDnfDriver] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [nextRace, setNextRace] = useState<PredictRace>(RACES[0] as unknown as PredictRace);
  const [loadingRace, setLoadingRace] = useState(true);
  const [drivers, setDrivers] = useState<Driver[]>(FALLBACK_DRIVERS);
  const [isLocked, setIsLocked] = useState(false);
  const [startingGrid, setStartingGrid] = useState<ApiResult[]>([]);
  const [existingPlayers, setExistingPlayers] = useState<string[]>([]);
  const [communityPredictions, setCommunityPredictions] = useState<CommunityPrediction[]>([]);
  
  const supabase = createClient();

  useEffect(() => {
    async function init() {
      // 1. Handle Session
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      setSession(currentSession);
      
      let currentUsername = '';
      if (currentSession) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', currentSession.user.id)
          .single();
        if (profile) {
          currentUsername = profile.username;
          setUsername(profile.username);
        }
      } else {
        const savedUser = localStorage.getItem('p10_current_user');
        if (savedUser) {
          currentUsername = savedUser;
          setUsername(savedUser);
        }
      }

      // 2. Get Race Data
      const races = await fetchCalendar(CURRENT_SEASON);
      let currentRace: PredictRace = RACES[0] as unknown as PredictRace;
      if (races.length > 0) {
        const now = new Date();
        let activeIndex = races.findIndex((r: ApiCalendarRace) => {
          const raceTime = new Date(`${r.date}T${r.time || '00:00:00Z'}`);
          const fourHoursLater = new Date(raceTime.getTime() + 4 * 60 * 60 * 1000);
          return fourHoursLater > now;
        });

        if (activeIndex === -1) activeIndex = races.length - 1;

        if (activeIndex > 0) {
          const prevRace = races[activeIndex - 1];
          const results = await fetchRaceResults(CURRENT_SEASON, parseInt(prevRace.round));
          if (!results) {
            activeIndex--;
          }
        }

        const upcoming = races[activeIndex];
        currentRace = {
          id: upcoming.round,
          name: upcoming.raceName,
          circuit: upcoming.Circuit.circuitName,
          date: upcoming.date,
          time: upcoming.time || '00:00:00Z',
          round: parseInt(upcoming.round)
        };
        setNextRace(currentRace);

        const apiDrivers = await fetchDrivers(CURRENT_SEASON);
        const finalDriverList = apiDrivers.length > 0 ? apiDrivers : FALLBACK_DRIVERS;
        finalDriverList.sort((a: AppDriver, b: AppDriver) => a.team.localeCompare(b.team));
        setDrivers(finalDriverList);

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
        setStartingGrid(finalGrid);

        const raceStartTime = new Date(`${currentRace.date}T${currentRace.time}`);
        const lockTime = new Date(raceStartTime.getTime() + 120000);
        if (now > lockTime) {
          setIsLocked(true);
        }

        // 3. Load Prediction
        if (currentSession) {
          const { data: dbPred } = await supabase
            .from('predictions')
            .select('*')
            .eq('user_id', currentSession.user.id)
            .eq('race_id', `${CURRENT_SEASON}_${currentRace.id}`)
            .single();
          
          if (dbPred) {
            setP10Driver(dbPred.p10_driver_id);
            setDnfDriver(dbPred.dnf_driver_id);
          }
        } else if (currentUsername) {
          const finalized = localStorage.getItem(`final_pred_${currentUsername}_${currentRace.id}`);
          if (finalized) {
            const parsed = JSON.parse(finalized);
            setP10Driver(parsed.p10);
            setDnfDriver(parsed.dnf);
          }
        }

        // 4. Fetch community predictions (Supabase + LocalStorage fallback)
        // For now, we'll just stick to LocalStorage for community view until we have more DB data
        const playersList: string[] = JSON.parse(localStorage.getItem('p10_players') || '[]');
        const allPreds = playersList
          .filter((p: string) => p !== currentUsername)
          .map((p: string) => {
            const pred = localStorage.getItem(`final_pred_${p}_${currentRace.id}`);
            return pred ? JSON.parse(pred) : null;
          }).filter(p => p !== null);
        setCommunityPredictions(allPreds);
      }
      setLoadingRace(false);

      const existingPlayersList: string[] = JSON.parse(localStorage.getItem('p10_players') || '[]');
      setExistingPlayers(existingPlayersList);
    }
    init();
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (p10Driver && dnfDriver) {
      Haptics.impact({ style: ImpactStyle.Heavy });
      
      if (session) {
        // Save to Supabase
        const { error } = await supabase
          .from('predictions')
          .upsert({
            user_id: session.user.id,
            race_id: `${CURRENT_SEASON}_${nextRace.id}`,
            p10_driver_id: p10Driver,
            dnf_driver_id: dnfDriver,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id, race_id' });
        
        if (error) {
          alert('Error saving prediction: ' + error.message);
          return;
        }
      } else {
        // Save to LocalStorage
        const prediction = { username, p10: p10Driver, dnf: dnfDriver, raceId: nextRace.id };
        localStorage.setItem(`final_pred_${username}_${nextRace.id}`, JSON.stringify(prediction));
        const players = JSON.parse(localStorage.getItem('p10_players') || '[]');
        if (!players.includes(username)) {
          players.push(username);
          localStorage.setItem('p10_players', JSON.stringify(players));
        }
      }

      setSubmitted(true);
    }
  };

  const selectUser = (name: string) => {
    Haptics.selectionChanged();
    localStorage.setItem('p10_current_user', name);
    setUsername(name);
    // Reload local prediction for this user
    const finalized = localStorage.getItem(`final_pred_${name}_${nextRace.id}`);
    if (finalized) {
      const parsed = JSON.parse(finalized);
      setP10Driver(parsed.p10);
      setDnfDriver(parsed.dnf);
    } else {
      setP10Driver('');
      setDnfDriver('');
    }
  };

  if (!session && !username) {
    return (
      <main>
        <AppNavbar />
        <Container className="mt-5">
          <Row className="justify-content-center">
            <Col md={5}>
              <Card className="p-4 border-secondary shadow">
                <h2 className="h4 mb-4 fw-bold">Who&apos;s Predicting?</h2>
                
                <div className="mb-4">
                  <Link href="/auth" passHref legacyBehavior>
                    <Button variant="danger" className="w-100 py-3 fw-bold mb-2">SIGN IN / CREATE ACCOUNT</Button>
                  </Link>
                  <p className="text-center text-muted small mt-2">OR PLAY AS GUEST (LOCAL ONLY)</p>
                </div>

                {existingPlayers.length > 0 && (
                  <div className="mb-4">
                    <Form.Label className="text-muted small text-uppercase fw-semibold">Recent Players</Form.Label>
                    <div className="d-flex flex-wrap gap-2">
                      {existingPlayers.map(p => (
                        <Button key={p} variant="outline-light" size="sm" onClick={() => selectUser(p)} className="rounded-pill px-3">{p}</Button>
                      ))}
                    </div>
                    <hr className="border-secondary mt-4" />
                  </div>
                )}
                <Form onSubmit={(e) => { e.preventDefault(); if (username.trim()) selectUser(username); }}>
                  <Form.Group className="mb-3">
                    <Form.Label>Guest Name</Form.Label>
                    <Form.Control type="text" placeholder="Enter name" value={username} onChange={(e) => setUsername(e.target.value)} className="bg-dark text-white border-secondary py-2" />
                  </Form.Group>
                  <Button type="submit" className="btn-f1 w-100 py-2 fw-bold">CONTINUE AS GUEST</Button>
                </Form>
              </Card>
            </Col>
          </Row>
        </Container>
      </main>
    );
  }

  const handleShare = () => {
    const p10Name = drivers.find(d => d.id === p10Driver)?.name || p10Driver;
    const dnfName = drivers.find(d => d.id === dnfDriver)?.name || dnfDriver;
    const text = `🏎️ My P10 Racing Picks for the ${nextRace.name}!\n\n🎯 P10 Finisher: ${p10Name}\n🔥 First DNF: ${dnfName}\n\nCan you master the midfield? #P10Racing #F1`;
    if (navigator.share) {
      navigator.share({ title: 'P10 Racing Predictions', text: text }).catch(console.error);
    } else {
      navigator.clipboard.writeText(text);
      alert('Prediction copied to clipboard!');
    }
  };

  if (submitted) {
    return (
      <main>
        <AppNavbar />
        <Container className="mt-5 text-center">
          <div className="mb-4 display-1">🏁</div>
          <h2 className="display-6 mb-4 fw-bold">Locked and Loaded!</h2>
          <p className="lead mb-5 text-muted">Good luck for the {nextRace.name}, <span className="text-white fw-bold">{username}</span>.</p>
          <div className="d-grid gap-3 d-sm-flex justify-content-sm-center">
            <Button variant="success" size="lg" onClick={handleShare} className="px-5 fw-bold">Share Picks ↗</Button>
            <Link href="/" passHref legacyBehavior><Button variant="outline-light" size="lg" className="px-5">Home</Button></Link>
          </div>
        </Container>
      </main>
    );
  }

  if (loadingRace) {
    return (
      <main>
        <AppNavbar />
        <Container className="mt-5 text-center">
          <Spinner animation="border" variant="danger" />
          <p className="mt-3 text-muted">Loading race data...</p>
        </Container>
      </main>
    );
  }

  return (
    <main>
      <AppNavbar />
      <Container className="mt-4 mb-5">
        <Row className="mb-4 align-items-center">
          <Col>
            <h1 className="h2 mb-1 fw-bold text-uppercase">{nextRace.name}</h1>
            <p className="text-muted mb-0">{session ? 'Logged in as: ' : 'Playing as Guest: '}<strong className="text-white">{username}</strong></p>
          </Col>
          <Col xs="auto" className="d-flex gap-2">
            {!isLocked && !session && (
              <Button variant="outline-warning" size="sm" onClick={() => { localStorage.removeItem('p10_current_user'); setUsername(''); }} className="rounded-pill">Switch Guest</Button>
            )}
          </Col>
        </Row>
        
        {startingGrid.length > 0 && !isLocked && (
          <Row className="mb-4">
            <Col>
              <Card className="border-secondary bg-dark bg-opacity-50 shadow-sm">
                <Card.Header className="bg-dark border-secondary py-2"><h3 className="h6 mb-0 text-uppercase fw-bold text-danger letter-spacing-1">Current Grid Order</h3></Card.Header>
                <Card.Body className="py-2">
                  <div className="d-flex flex-wrap gap-2">
                    {startingGrid.map((result) => (
                      <div key={result.number} className="small border-end border-secondary pe-2">
                        <span className="text-muted me-1">{result.position}.</span> 
                        <span className="text-white fw-bold">{result.Driver.code}</span>
                      </div>
                    ))}
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        )}

        {isLocked ? (
          <div className="text-center">
            <Card className="p-5 border-danger bg-dark mb-4 shadow">
              <div className="display-4 mb-3">🔒</div>
              <h2 className="mb-4 fw-bold">Predictions Closed</h2>
              <p className="lead mb-4 text-muted">The {nextRace.name} is underway. Good luck!</p>
              <Row className="text-start">
                <Col lg={6} className="mb-4">
                  <div className="p-4 border border-secondary rounded bg-dark bg-opacity-50 h-100">
                    <h3 className="h5 mb-4 text-uppercase border-bottom border-secondary pb-3 fw-bold text-danger">Your Prediction</h3>
                    {p10Driver && dnfDriver ? (
                      <Row className="g-3">
                        <Col sm={6}><div className="p-3 border border-secondary rounded bg-dark"><div className="text-muted small text-uppercase mb-1">P10 Pick</div><div className="h4 mb-0 text-white fw-bold">{drivers.find(d => d.id === p10Driver)?.name || p10Driver}</div></div></Col>
                        <Col sm={6}><div className="p-3 border border-secondary rounded bg-dark"><div className="text-muted small text-uppercase mb-1">DNF Pick</div><div className="h4 mb-0 text-danger fw-bold">{drivers.find(d => d.id === dnfDriver)?.name || dnfDriver}</div></div></Col>
                      </Row>
                    ) : <p className="text-warning">No prediction submitted.</p>}
                  </div>
                </Col>
                <Col lg={6} className="mb-4">
                  <div className="p-4 border border-secondary rounded bg-dark bg-opacity-50 h-100">
                    <h3 className="h5 mb-4 text-uppercase border-bottom border-secondary pb-3 fw-bold text-danger">Community</h3>
                    {communityPredictions.length > 0 ? (
                      <div className="table-responsive">
                        <table className="table table-dark table-hover mb-0 small">
                          <thead><tr className="text-muted"><th>Player</th><th>P10</th><th>DNF</th></tr></thead>
                          <tbody>
                            {communityPredictions.map((pred, idx) => (
                              <tr key={idx}><td className="text-white fw-bold">{pred.username}</td><td>{drivers.find(d => d.id === pred.p10)?.code || pred.p10}</td><td className="text-danger">{drivers.find(d => d.id === pred.dnf)?.code || pred.dnf}</td></tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : <p className="text-muted small">Only you so far!</p>}
                  </div>
                </Col>
              </Row>
            </Card>
            <Link href="/" passHref legacyBehavior><Button variant="outline-light" size="lg" className="px-5">Back Home</Button></Link>
          </div>
        ) : (
          <Form onSubmit={handleSubmit}>
            <Row>
              <Col md={6} className="mb-4">
                <Card className="h-100 shadow-sm border-secondary">
                  <Card.Body className="p-4">
                    <h3 className="h5 mb-4 border-start border-4 border-danger ps-3 fw-bold text-uppercase">P10 Finisher</h3>
                    <div className="driver-list-scroll" style={{ maxHeight: '600px', overflowY: 'auto', paddingRight: '10px' }}>
                      {drivers.map((driver) => (
                        <div key={`p10-${driver.id}`} className={`d-flex align-items-center p-3 mb-2 rounded border transition-all cursor-pointer ${p10Driver === driver.id ? 'border-danger bg-danger bg-opacity-25 shadow-sm' : 'border-secondary opacity-75'}`} onClick={() => { Haptics.selectionChanged(); setP10Driver(driver.id); }} style={{ borderLeft: `6px solid ${driver.color} !important` }}>
                          <div className="driver-number me-3 text-white fw-bold" style={{ width: '30px', fontSize: '1.2rem' }}>{driver.number}</div>
                          <div className="flex-grow-1"><div className="fw-bold text-white">{driver.name}</div><span className="team-pill" style={{ backgroundColor: driver.color, color: getContrastColor(driver.color), fontSize: '0.6rem' }}>{driver.team}</span></div>
                          {p10Driver === driver.id && <div className="text-danger">●</div>}
                        </div>
                      ))}
                    </div>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={6} className="mb-4">
                <Card className="h-100 shadow-sm border-secondary">
                  <Card.Body className="p-4">
                    <h3 className="h5 mb-4 border-start border-4 border-danger ps-3 fw-bold text-uppercase">First DNF</h3>
                    <div className="driver-list-scroll" style={{ maxHeight: '600px', overflowY: 'auto', paddingRight: '10px' }}>
                      {drivers.map((driver) => (
                        <div key={`dnf-${driver.id}`} className={`d-flex align-items-center p-3 mb-2 rounded border transition-all cursor-pointer ${dnfDriver === driver.id ? 'border-danger bg-danger bg-opacity-25 shadow-sm' : 'border-secondary opacity-75'}`} onClick={() => { Haptics.selectionChanged(); setDnfDriver(driver.id); }} style={{ borderLeft: `6px solid ${driver.color} !important` }}>
                          <div className="driver-number me-3 text-white fw-bold" style={{ width: '30px', fontSize: '1.2rem' }}>{driver.number}</div>
                          <div className="flex-grow-1"><div className="fw-bold text-white">{driver.name}</div><span className="team-pill" style={{ backgroundColor: driver.color, color: getContrastColor(driver.color), fontSize: '0.6rem' }}>{driver.team}</span></div>
                          {dnfDriver === driver.id && <div className="text-danger">●</div>}
                        </div>
                      ))}
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
            <div className="d-grid gap-2 mt-4"><Button type="submit" size="lg" className="btn-f1 py-3 fw-bold" disabled={!p10Driver || !dnfDriver}>LOCK IN PREDICTION</Button></div>
          </Form>
        )}
      </Container>
    </main>
  );
}
