'use client';

import { useState, useEffect } from 'react';
import { Container, Row, Col, Form, Button, Card, Navbar, Spinner } from 'react-bootstrap';
import { DRIVERS as FALLBACK_DRIVERS, RACES, CURRENT_SEASON } from '@/lib/data';
import { fetchCalendar, fetchDrivers, fetchQualifyingResults } from '@/lib/api';
import Link from 'next/link';
import AppNavbar from '@/components/AppNavbar';

export default function PredictPage() {
  const [username, setUsername] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [p10Driver, setP10Driver] = useState('');
  const [dnfDriver, setDnfDriver] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [nextRace, setNextRace] = useState<any>(RACES[0]);
  const [loadingRace, setLoadingRace] = useState(true);
  const [drivers, setDrivers] = useState<any[]>(FALLBACK_DRIVERS);
  const [isLocked, setIsLocked] = useState(false);
  const [startingGrid, setStartingGrid] = useState<any[]>([]);
  const [existingPlayers, setExistingPlayers] = useState<string[]>([]);

  // Load race and user from localStorage on mount
  useEffect(() => {
    async function init() {
      // 1. Get real next race
      const races = await fetchCalendar(CURRENT_SEASON);
      let currentRace = RACES[0];
      if (races.length > 0) {
        // ... (rest of race init logic)
        const now = new Date();
        const upcoming = races.find(r => {
          const raceTime = new Date(`${r.date}T${r.time || '00:00:00Z'}`);
          return raceTime > now;
        }) || races[0];

        currentRace = {
          id: upcoming.round,
          name: upcoming.raceName,
          circuit: upcoming.Circuit.circuitName,
          date: upcoming.date,
          time: upcoming.time || '00:00:00Z',
          round: parseInt(upcoming.round)
        };
        setNextRace(currentRace);

        const grid = await fetchQualifyingResults(CURRENT_SEASON, currentRace.round);
        setStartingGrid(grid);

        const raceStartTime = new Date(`${currentRace.date}T${currentRace.time}`);
        if (now > raceStartTime) {
          setIsLocked(true);
        }
      }
      setLoadingRace(false);

      // 2. Fetch dynamic drivers
      const apiDrivers = await fetchDrivers(CURRENT_SEASON);
      if (apiDrivers.length > 0) {
        setDrivers(apiDrivers);
      }

      // 3. Get existing players for switching
      const players = JSON.parse(localStorage.getItem('p10_players') || '[]');
      setExistingPlayers(players);

      // 4. Get user
      const savedUser = localStorage.getItem('p10_current_user');
      if (savedUser) {
        setUsername(savedUser);
        setIsLoggedIn(true);
        
        const savedP10 = localStorage.getItem(`p10_${savedUser}_${currentRace.id}_prediction`);
        const savedDNF = localStorage.getItem(`dnf_${savedUser}_${currentRace.id}_prediction`);
        if (savedP10) setP10Driver(savedP10);
        if (savedDNF) setDnfDriver(savedDNF);
      }
    }
    init();
  }, []);

  const selectUser = (name: string) => {
    localStorage.setItem('p10_current_user', name);
    setUsername(name);
    setIsLoggedIn(true);
    // Load predictions for this user
    const savedP10 = localStorage.getItem(`p10_${name}_${nextRace.id}_prediction`);
    const savedDNF = localStorage.getItem(`dnf_${name}_${nextRace.id}_prediction`);
    
    // Also check for finalized prediction to allow editing
    const finalized = localStorage.getItem(`final_pred_${name}_${nextRace.id}`);
    if (finalized) {
      const parsed = JSON.parse(finalized);
      setP10Driver(parsed.p10);
      setDnfDriver(parsed.dnf);
    } else {
      setP10Driver(savedP10 || '');
      setDnfDriver(savedDNF || '');
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim()) {
      selectUser(username);
    }
  };

  const handleSwitchUser = () => {
    localStorage.removeItem('p10_current_user');
    setIsLoggedIn(false);
    setUsername('');
    setP10Driver('');
    setDnfDriver('');
  };

  const getContrastColor = (hexcolor: string) => {
    // If it's pure white or very light (like Cadillac Gold), use black text
    if (hexcolor.toLowerCase() === '#ffffff' || hexcolor.toLowerCase() === '#ffd700') {
      return '#000';
    }
    return '#fff';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (p10Driver && dnfDriver) {
      const prediction = { username, p10: p10Driver, dnf: dnfDriver, raceId: nextRace.id };
      // Save finalized prediction indexed by race
      localStorage.setItem(`final_pred_${username}_${nextRace.id}`, JSON.stringify(prediction));
      
      const players = JSON.parse(localStorage.getItem('p10_players') || '[]');
      if (!players.includes(username)) {
        players.push(username);
        localStorage.setItem('p10_players', JSON.stringify(players));
      }

      localStorage.removeItem(`p10_${username}_${nextRace.id}_prediction`);
      localStorage.removeItem(`dnf_${username}_${nextRace.id}_prediction`);
      setSubmitted(true);
    }
  };

  if (!isLoggedIn) {
    return (
      <main>
        <AppNavbar />
        <Container className="mt-5">
          <Row className="justify-content-center">
            <Col md={5}>
              <Card className="p-4 border-secondary">
                <h2 className="h4 mb-4">Who are you?</h2>
                
                {existingPlayers.length > 0 && (
                  <div className="mb-4">
                    <Form.Label className="text-muted small text-uppercase">Existing Players</Form.Label>
                    <div className="d-flex flex-wrap gap-2">
                      {existingPlayers.map(p => (
                        <Button 
                          key={p} 
                          variant="outline-light" 
                          size="sm"
                          onClick={() => selectUser(p)}
                        >
                          {p}
                        </Button>
                      ))}
                    </div>
                    <hr className="border-secondary mt-4" />
                  </div>
                )}

                <Form onSubmit={handleLogin}>
                  <Form.Group className="mb-3">
                    <Form.Label>Enter New Username</Form.Label>
                    <Form.Control 
                      type="text" 
                      placeholder="e.g. lando4lyf" 
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      className="bg-dark text-white border-secondary"
                    />
                  </Form.Group>
                  <Button type="submit" className="btn-f1 w-100">Start Predicting</Button>
                </Form>
              </Card>
            </Col>
          </Row>
        </Container>
      </main>
    );
  }

  if (submitted) {
    return (
      <main>
        <AppNavbar />
        <Container className="mt-5 text-center">
          <h2 className="display-6 mb-4">Prediction Received!</h2>
          <p className="lead mb-5">Good luck for the {nextRace.name}.</p>
          <Link href="/" passHref legacyBehavior>
            <Button variant="outline-light">Back to Home</Button>
          </Link>
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
            <h1 className="h2 mb-1">Make Your Prediction</h1>
            <p className="text-muted mb-0">Playing as: <strong className="text-white">{username}</strong> • {nextRace.name}</p>
          </Col>
          <Col xs="auto" className="d-flex gap-2">
            <Button 
              variant="outline-warning" 
              size="sm"
              onClick={handleSwitchUser}
            >
              Switch User
            </Button>
            <Button 
              variant="outline-secondary" 
              size="sm"
              onClick={() => {
                setP10Driver('');
                setDnfDriver('');
                localStorage.removeItem(`p10_${username}_prediction`);
                localStorage.removeItem(`dnf_${username}_prediction`);
              }}
            >
              Clear
            </Button>
          </Col>
        </Row>

        {startingGrid.length > 0 && (
          <Row className="mb-4">
            <Col>
              <Card className="border-secondary bg-dark bg-opacity-50">
                <Card.Header className="bg-dark border-secondary">
                  <h3 className="h6 mb-0 text-uppercase fw-bold text-danger">Starting Grid (Qualifying Results)</h3>
                </Card.Header>
                <Card.Body className="py-2">
                  <div className="d-flex flex-wrap gap-2">
                    {startingGrid.slice(0, 15).map((result) => (
                      <div key={result.number} className="small border-end border-secondary pe-2">
                        <span className="text-muted">{result.position}.</span> <span className="text-white fw-bold">{result.Driver.code}</span>
                      </div>
                    ))}
                    <div className="small text-muted">...</div>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        )}

        <Form onSubmit={handleSubmit}>
          <Row>
            <Col md={6} className="mb-4">
              <Card className="h-100 shadow-sm">
                <Card.Body className="p-4">
                  <h3 className="h5 mb-4 border-start border-4 border-danger ps-3">P10 FINISHER</h3>
                  <p className="small text-muted mb-4">Who will cross the line in 10th place?</p>
                  
                  <Form.Group>
                    {drivers.map((driver) => (
                      <div 
                        key={`p10-${driver.id}`}
                        className={`d-flex align-items-center p-3 mb-2 rounded border transition-all cursor-pointer ${
                          p10Driver === driver.id ? 'border-danger bg-danger bg-opacity-25' : 'border-secondary opacity-75'
                        }`}
                        onClick={() => setP10Driver(driver.id)}
                        style={{ borderLeft: `6px solid ${driver.color} !important` }}
                      >
                        <div className="driver-number me-3 text-white" style={{ width: '40px', opacity: p10Driver === driver.id ? 1 : 0.6 }}>
                          {driver.number}
                        </div>
                        <div className="flex-grow-1">
                          <div className={`fw-bold ${p10Driver === driver.id ? 'text-white' : 'text-light'}`} style={{ fontSize: '1.1rem' }}>{driver.name}</div>
                          <div className="d-flex align-items-center mt-1">
                            <span className="team-pill" style={{ backgroundColor: driver.color, color: getContrastColor(driver.color) }}>
                              {driver.team}
                            </span>
                          </div>
                        </div>
                        {p10Driver === driver.id && (
                          <div className="bg-danger rounded-circle p-1 ms-2" style={{ width: '12px', height: '12px' }}></div>
                        )}
                      </div>
                    ))}
                  </Form.Group>
                </Card.Body>
              </Card>
            </Col>

            <Col md={6} className="mb-4">
              <Card className="h-100 shadow-sm">
                <Card.Body className="p-4">
                  <h3 className="h5 mb-4 border-start border-4 border-danger ps-3">FIRST DNF</h3>
                  <p className="small text-muted mb-4">Which driver will be the first to retire?</p>
                  
                  <Form.Group>
                    {drivers.map((driver) => (
                      <div 
                        key={`dnf-${driver.id}`}
                        className={`d-flex align-items-center p-3 mb-2 rounded border transition-all cursor-pointer ${
                          dnfDriver === driver.id ? 'border-danger bg-danger bg-opacity-25' : 'border-secondary opacity-75'
                        }`}
                        onClick={() => setDnfDriver(driver.id)}
                        style={{ borderLeft: `6px solid ${driver.color} !important` }}
                      >
                        <div className="driver-number me-3 text-white" style={{ width: '40px', opacity: dnfDriver === driver.id ? 1 : 0.6 }}>
                          {driver.number}
                        </div>
                        <div className="flex-grow-1">
                          <div className={`fw-bold ${dnfDriver === driver.id ? 'text-white' : 'text-light'}`} style={{ fontSize: '1.1rem' }}>{driver.name}</div>
                          <div className="d-flex align-items-center mt-1">
                            <span className="team-pill" style={{ backgroundColor: driver.color, color: getContrastColor(driver.color) }}>
                              {driver.team}
                            </span>
                          </div>
                        </div>
                        {dnfDriver === driver.id && (
                          <div className="bg-danger rounded-circle p-1 ms-2" style={{ width: '12px', height: '12px' }}></div>
                        )}
                      </div>
                    ))}
                  </Form.Group>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          <div className="d-grid gap-2 mt-4">
            <Button 
              type="submit" 
              size="lg" 
              className="btn-f1 py-3" 
              disabled={!p10Driver || !dnfDriver || isLocked}
            >
              {isLocked ? 'Predictions Locked (Race Started)' : 'Submit Prediction'}
            </Button>
            {isLocked && (
              <p className="text-center text-danger small mt-2">
                Predictions for the {nextRace.name} are now closed.
              </p>
            )}
          </div>
        </Form>
      </Container>
    </main>
  );
}
