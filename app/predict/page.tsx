'use client';

import { useState, useEffect, Suspense } from 'react';
import { Container, Row, Col, Form, Button, Card, Modal } from 'react-bootstrap';
import { DRIVERS as FALLBACK_DRIVERS, RACES, CURRENT_SEASON, Driver } from '@/lib/data';
import { fetchCalendar, fetchDrivers, fetchQualifyingResults, fetchRaceResults, ApiCalendarRace, AppDriver, ApiResult, DbPrediction } from '@/lib/api';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { getContrastColor } from '@/lib/utils/colors';
import { createClient } from '@/lib/supabase/client';
import { Session } from '@supabase/supabase-js';
import { Share } from '@capacitor/share';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import LoadingView from '@/components/LoadingView';

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

function PredictContent() {
  const [username, setUsername] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const [p10Driver, setP10Driver] = useState('');
  const [dnfDriver, setDnfDriver] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [nextRace, setNextRace] = useState<PredictRace>(RACES[0] as unknown as PredictRace);
  const [loadingRace, setLoadingRace] = useState(true);
  const [loadingSession, setLoadingSession] = useState(true); 
  const [drivers, setDrivers] = useState<Driver[]>(FALLBACK_DRIVERS);
  const [isLocked, setIsLocked] = useState(false);
  const [startingGrid, setStartingGrid] = useState<ApiResult[]>([]);
  const [existingPlayers, setExistingPlayers] = useState<string[]>([]);
  const [communityPredictions, setCommunityPredictions] = useState<CommunityPrediction[]>([]);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [isSeasonFinished, setIsSeasonFinished] = useState(false);
  
  const supabase = createClient();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get('howto') === 'true') {
      setShowHowToPlay(true);
    }
  }, [searchParams]);

  useEffect(() => {
    async function init() {
      // 1. Handle Session
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      setSession(currentSession);
      
      let currentUsername = '';
      if (currentSession) {
        const cachedUser = localStorage.getItem('p10_cache_username');
        if (cachedUser) {
          setUsername(cachedUser);
          currentUsername = cachedUser;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', currentSession.user.id)
          .single();
        if (profile) {
          currentUsername = profile.username;
          setUsername(profile.username);
          localStorage.setItem('p10_cache_username', profile.username);
        }
      } else {
        const savedUser = localStorage.getItem('p10_current_user');
        if (savedUser) {
          currentUsername = savedUser;
          setUsername(savedUser);
        }
      }
      setLoadingSession(false);

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

        if (activeIndex === -1) {
          activeIndex = races.length - 1;
          setIsSeasonFinished(true);
        }

        if (activeIndex > 0 && !isSeasonFinished) {
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
        if (now > lockTime || isSeasonFinished) {
          setIsLocked(true);
        }

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
          const finalized = localStorage.getItem(`final_pred_${CURRENT_SEASON}_${currentUsername}_${currentRace.id}`);
          if (finalized) {
            const parsed = JSON.parse(finalized);
            setP10Driver(parsed.p10);
            setDnfDriver(parsed.dnf);
          }
        }

        const { data: dbCommunityPreds } = await supabase
          .from('predictions')
          .select('user_id, p10_driver_id, dnf_driver_id, profiles(username)')
          .eq('race_id', `${CURRENT_SEASON}_${currentRace.id}`);

        const formattedDbPreds: CommunityPrediction[] = dbCommunityPreds ? (dbCommunityPreds as unknown as DbPrediction[]).map((p) => ({
          username: p.profiles?.username || 'Unknown',
          p10: p.p10_driver_id,
          dnf: p.dnf_driver_id
        })) : [];

        const otherDbPreds = formattedDbPreds.filter(p => p.username !== currentUsername);

        const playersList: string[] = JSON.parse(localStorage.getItem('p10_players') || '[]');
        const localPreds = playersList
          .filter((p: string) => p !== currentUsername)
          .map((p: string) => {
            const pred = localStorage.getItem(`final_pred_${CURRENT_SEASON}_${p}_${currentRace.id}`);
            return pred ? JSON.parse(pred) : null;
          }).filter(p => p !== null);
        
        const formattedLocalPreds: CommunityPrediction[] = localPreds.map(p => ({
          username: p.username,
          p10: p.p10,
          dnf: p.dnf
        }));

        setCommunityPredictions([...otherDbPreds, ...formattedLocalPreds]);
      }
      setLoadingRace(false);

      const existingPlayersList: string[] = JSON.parse(localStorage.getItem('p10_players') || '[]');
      setExistingPlayers(existingPlayersList);
    }
    init();
  }, [supabase, isSeasonFinished]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (p10Driver && dnfDriver) {
      Haptics.impact({ style: ImpactStyle.Heavy });
      
      if (session) {
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
        const prediction = { username, p10: p10Driver, dnf: dnfDriver, raceId: nextRace.id, season: CURRENT_SEASON };
        localStorage.setItem(`final_pred_${CURRENT_SEASON}_${username}_${nextRace.id}`, JSON.stringify(prediction));
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
    const finalized = localStorage.getItem(`final_pred_${CURRENT_SEASON}_${name}_${nextRace.id}`);
    if (finalized) {
      const parsed = JSON.parse(finalized);
      setP10Driver(parsed.p10);
      setDnfDriver(parsed.dnf);
    } else {
      setP10Driver('');
      setDnfDriver('');
    }
  };

  const handleShare = async () => {
    const p10Name = drivers.find(d => d.id === p10Driver)?.name || p10Driver;
    const dnfName = drivers.find(d => d.id === dnfDriver)?.name || dnfDriver;
    const text = `🏎️ My P10 Racing Picks for the ${nextRace.name}!\n\n🎯 P10 Finisher: ${p10Name}\n🔥 First DNF: ${dnfName}\n\nCan you master the midfield? #P10Racing #F1`;
    
    try {
      await Share.share({
        title: 'P10 Racing Predictions',
        text: text,
        url: 'https://p10racing.app/predict',
        dialogTitle: 'Share your Picks',
      });
    } catch (error) {
      console.error('Error sharing', error);
      // Fallback for non-native or failed share
      if (navigator.share) {
        navigator.share({ title: 'P10 Racing Predictions', text: text, url: 'https://p10racing.app/predict' }).catch(console.error);
      } else {
        navigator.clipboard.writeText(text + '\n\nhttps://p10racing.app/predict');
        alert('Prediction copied to clipboard!');
      }
    }
  };

  if (loadingSession || loadingRace) {
    return <LoadingView />;
  }

  if (!session && !username) {
    return (
      <>
        <Container className="mt-5">
          <Row className="justify-content-center">
            <Col md={5}>
              <Card className="p-4 border-secondary shadow">
                <h2 className="h4 mb-4 fw-bold">Who&apos;s Predicting?</h2>
                <div className="mb-4">
                  <Link href="/auth" passHref legacyBehavior><Button variant="danger" className="w-100 py-3 fw-bold mb-2">SIGN IN / CREATE ACCOUNT</Button></Link>
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
                  <Form.Group className="mb-3"><Form.Label>Guest Name</Form.Label><Form.Control type="text" placeholder="Enter name" value={username} onChange={(e) => setUsername(e.target.value)} className="bg-dark text-white border-secondary py-2" /></Form.Group>
                  <Button type="submit" className="btn-f1 w-100 py-2 fw-bold">CONTINUE AS GUEST</Button>
                </Form>
              </Card>
            </Col>
          </Row>
        </Container>
      </>
    );
  }

  if (submitted) {
    return (
      <>
        <Container className="mt-5 text-center">
          <div className="mb-4 display-1">🏁</div>
          <h2 className="display-6 mb-4 fw-bold">Locked and Loaded!</h2>
          <p className="lead mb-5 text-muted">Good luck for the {nextRace.name}, <span className="text-white fw-bold">{username}</span>.</p>
          <div className="d-grid gap-3 d-sm-flex justify-content-sm-center">
            <Button variant="success" size="lg" onClick={handleShare} className="px-5 fw-bold">Share Picks ↗</Button>
            <Link href="/" passHref legacyBehavior><Button variant="outline-light" size="lg" className="px-5">Home</Button></Link>
          </div>
        </Container>
      </>
    );
  }

  return (
    <>
      <Container className="mt-4 mb-3">
        <Row className="mb-4 align-items-center">
          <Col>
            <div className="d-flex align-items-center gap-2">
              <h1 className="h2 mb-1 fw-bold text-uppercase">{nextRace.name}</h1>
              <Button 
                variant="outline-secondary" 
                size="sm" 
                className="rounded-circle p-0 d-flex align-items-center justify-content-center opacity-50" 
                style={{ width: '22px', height: '22px', fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '4px' }}
                onClick={() => { Haptics.impact({ style: ImpactStyle.Light }); setShowHowToPlay(true); }}
              >
                ?
              </Button>
            </div>
            <p className="text-muted mb-0">{session ? 'Logged in as: ' : 'Playing as Guest: '}<strong className="text-white">{username}</strong></p>
          </Col>
          <Col xs="auto" className="d-flex gap-2">{!isLocked && !session && (<Button variant="outline-warning" size="sm" onClick={() => { localStorage.removeItem('p10_current_user'); setUsername(''); }} className="rounded-pill">Switch Guest</Button>)}</Col>
        </Row>
        {startingGrid.length > 0 && !isLocked && (
          <Row className="mb-4">
            <Col>
              <Card className="border-secondary bg-dark bg-opacity-50 shadow-sm overflow-hidden">
                <Card.Header className="bg-dark border-secondary py-2 d-flex justify-content-between align-items-center">
                  <div className="d-flex align-items-center gap-2">
                    <h3 className="h6 mb-0 text-uppercase fw-bold text-danger letter-spacing-1">Starting Grid</h3>
                  </div>
                  <span className="extra-small text-muted text-uppercase fw-bold" style={{ fontSize: '0.6rem' }}>Target: P10</span>
                </Card.Header>
                <Card.Body className="p-2 bg-black bg-opacity-40" style={{ 
                  backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.01) 0px, rgba(255,255,255,0.01) 1px, transparent 1px, transparent 10px)',
                }}>
                  <div className="position-relative py-2 px-1">
                    {/* Compact Track Line */}
                    <div className="position-absolute start-50 top-0 bottom-0 border-start border-secondary border-opacity-20 d-none d-sm-block" style={{ transform: 'translateX(-50%)', borderStyle: 'dashed !important' }}></div>
                    
                    <div className="row g-2">
                      {startingGrid.map((result) => {
                        const pos = parseInt(result.position);
                        const isLeft = pos % 2 !== 0; // P1, P3, P5 are left
                        const isP10 = result.position === "10";
                        
                        const driverInfo = drivers.find(d => d.id === result.Driver.driverId);
                        const teamColor = driverInfo?.color || '#B6BABD';
                        
                        return (
                          <div key={result.Driver.driverId} className="col-6 mb-1">
                            <div 
                              className={`position-relative p-0 rounded overflow-hidden shadow-sm ${isP10 ? 'ring-1 ring-danger' : ''}`}
                              style={{ 
                                backgroundColor: '#1a1a1a',
                                border: isP10 ? '1.5px solid #e10600' : '1px solid rgba(255,255,255,0.1)',
                                // Subtle stagger: Right column is shifted down slightly
                                transform: !isLeft ? 'translateY(12px)' : 'none',
                                zIndex: isP10 ? 10 : 1
                              }}
                            >
                              {/* Thin Team Color Accent Bar */}
                              <div style={{ height: '3px', backgroundColor: teamColor }}></div>
                              
                              <div className="p-1 px-2 d-flex align-items-center" style={{ minHeight: '38px' }}>
                                <div className={`fw-bold me-1 ${isP10 ? 'text-danger' : 'text-muted'}`} style={{ fontSize: '0.75rem', width: '18px' }}>
                                  {result.position}
                                </div>
                                <div className="flex-grow-1 overflow-hidden">
                                  <div className="text-white fw-bold text-uppercase letter-spacing-1 text-truncate" style={{ fontSize: '0.7rem' }}>
                                    {result.Driver.code}
                                  </div>
                                  <div className="text-muted extra-small text-uppercase fw-semibold text-truncate" style={{ fontSize: '0.5rem', opacity: 0.7 }}>
                                    {driverInfo?.team?.split(' ')[0] || result.Constructor.name.split(' ')[0]}
                                  </div>
                                </div>
                                {isP10 && (
                                  <div className="ms-1">
                                    <span style={{ fontSize: '0.6rem' }}>🎯</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Finish Line Look - More compact */}
                    <div className="mt-4 pt-2 border-top border-secondary border-opacity-50 text-center">
                      <span className="extra-small fw-bold text-muted text-uppercase letter-spacing-2" style={{ fontSize: '0.55rem' }}>START / FINISH</span>
                    </div>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        )}
        {isLocked ? (
          <div className="text-center">
            <Card className="p-5 border-danger bg-dark mb-4 shadow">
              <div className="display-4 mb-3">{isSeasonFinished ? '🏆' : '🔒'}</div>
              <h2 className="mb-4 fw-bold">{isSeasonFinished ? 'Season Finished' : 'Predictions Closed'}</h2>
              <p className="lead mb-4 text-muted">
                {isSeasonFinished 
                  ? `The ${CURRENT_SEASON} season has concluded. See you in ${CURRENT_SEASON + 1}!` 
                  : `The ${nextRace.name} is underway. Good luck!`}
              </p>
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
                          <tbody>{communityPredictions.map((pred, idx) => (<tr key={idx}><td className="text-white fw-bold">{pred.username}</td><td>{drivers.find(d => d.id === pred.p10)?.code || pred.p10}</td><td className="text-danger">{drivers.find(d => d.id === pred.dnf)?.code || pred.dnf}</td></tr>))}</tbody>
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
            <Row className="g-3">
              <Col md={6}>
                <Card className="shadow-sm border-secondary mb-3">
                  <Card.Body className="p-3">
                    <h3 className="h6 mb-3 border-start border-4 border-danger ps-2 fw-bold text-uppercase">P10 Finisher</h3>
                    <div className="driver-list-scroll" style={{ maxHeight: '450px', overflowY: 'auto', paddingRight: '8px', overscrollBehavior: 'contain' }}>
                      {drivers.map((driver) => (
<div key={`p10-${driver.id}`} className={`d-flex align-items-center p-3 mb-2 rounded border transition-all cursor-pointer ${p10Driver === driver.id ? 'border-danger bg-danger bg-opacity-25 shadow-sm' : 'border-secondary opacity-75'}`} onClick={() => { Haptics.selectionChanged(); setP10Driver(driver.id); }} style={{ borderLeft: `6px solid ${driver.color} !important` }}><div className="driver-number me-3 text-white fw-bold" style={{ width: '30px', fontSize: '1.2rem' }}>{driver.number}</div><div className="flex-grow-1"><div className="fw-bold text-white">{driver.name}</div><span className="team-pill" style={{ backgroundColor: driver.color, color: getContrastColor(driver.color), fontSize: '0.6rem' }}>{driver.team}</span></div>{p10Driver === driver.id && <div className="text-danger">●</div>}</div>))}</div></Card.Body></Card>
              </Col>
              <Col md={6}>
                <Card className="shadow-sm border-secondary mb-3">
                  <Card.Body className="p-3">
                    <h3 className="h6 mb-3 border-start border-4 border-danger ps-2 fw-bold text-uppercase">First DNF</h3>
                    <div className="driver-list-scroll" style={{ maxHeight: '450px', overflowY: 'auto', paddingRight: '8px', overscrollBehavior: 'contain' }}>
                      {drivers.map((driver) => (
<div key={`dnf-${driver.id}`} className={`d-flex align-items-center p-3 mb-2 rounded border transition-all cursor-pointer ${dnfDriver === driver.id ? 'border-danger bg-danger bg-opacity-25 shadow-sm' : 'border-secondary opacity-75'}`} onClick={() => { Haptics.selectionChanged(); setDnfDriver(driver.id); }} style={{ borderLeft: `6px solid ${driver.color} !important` }}><div className="driver-number me-3 text-white fw-bold" style={{ width: '30px', fontSize: '1.2rem' }}>{driver.number}</div><div className="flex-grow-1"><div className="fw-bold text-white">{driver.name}</div><span className="team-pill" style={{ backgroundColor: driver.color, color: getContrastColor(driver.color), fontSize: '0.6rem' }}>{driver.team}</span></div>{dnfDriver === driver.id && <div className="text-danger">●</div>}</div>))}</div></Card.Body></Card>
              </Col>
            </Row>
            <div className="d-grid gap-2 mt-4"><Button type="submit" size="lg" className="btn-f1 py-3 fw-bold" disabled={!p10Driver || !dnfDriver}>LOCK IN PREDICTION</Button></div>
          </Form>
        )}
      </Container>

      <Modal show={showHowToPlay} onHide={() => setShowHowToPlay(false)} centered size="lg" contentClassName="bg-dark border-secondary">
        <Modal.Header closeButton closeVariant="white" className="border-secondary">
          <Modal.Title className="fw-bold text-uppercase letter-spacing-1">How to <span className="text-danger">Play</span></Modal.Title>
        </Modal.Header>
        <Modal.Body className="px-4 py-4">
          <section className="mb-4">
            <h3 className="h6 fw-bold text-danger text-uppercase letter-spacing-2 mb-2">The Objective</h3>
            <p className="text-white opacity-75 small">
              Predict the chaos of the F1 midfield! You need to pick the driver who finishes in <span className="fw-bold text-white">10th Place</span> and the driver who is the <span className="fw-bold text-danger">First DNF</span>.
            </p>
          </section>

          <section className="mb-4">
            <h3 className="h6 fw-bold text-danger text-uppercase letter-spacing-2 mb-3">Scoring: P10 Finisher</h3>
            <p className="text-white opacity-75 extra-small mb-3">
              Points are awarded based on how close your pick is to 10th place:
            </p>
            <div className="bg-black bg-opacity-50 border border-secondary border-opacity-25 rounded overflow-hidden">
              <table className="table table-dark table-sm mb-0 extra-small">
                <thead>
                  <tr className="text-uppercase opacity-50" style={{ fontSize: '0.6rem' }}>
                    <th className="ps-3 py-2">Actual Finish</th>
                    <th className="pe-3 py-2 text-end">Points</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="table-active fw-bold"><td className="ps-3 py-1">P10 (Exact)</td><td className="pe-3 py-1 text-end text-danger">25</td></tr>
                  <tr><td className="ps-3 py-1">P9 or P11</td><td className="pe-3 py-1 text-end">18</td></tr>
                  <tr><td className="ps-3 py-1">P8 or P12</td><td className="pe-3 py-1 text-end">15</td></tr>
                  <tr><td className="ps-3 py-1">P7 or P13</td><td className="pe-3 py-1 text-end">12</td></tr>
                  <tr><td className="ps-3 py-1">P6 or P14</td><td className="pe-3 py-1 text-end">10</td></tr>
                  <tr><td className="ps-3 py-1">P5 or P15</td><td className="pe-3 py-1 text-end">8</td></tr>
                  <tr><td className="ps-3 py-1">P4 or P16</td><td className="pe-3 py-1 text-end">6</td></tr>
                  <tr><td className="ps-3 py-1">P3 or P17</td><td className="pe-3 py-1 text-end">4</td></tr>
                  <tr><td className="ps-3 py-1">P2 or P18</td><td className="pe-3 py-1 text-end">2</td></tr>
                  <tr><td className="ps-3 py-1">P1 or P19+</td><td className="pe-3 py-1 text-end">1</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h3 className="h6 fw-bold text-danger text-uppercase letter-spacing-2 mb-2">Scoring: First DNF</h3>
            <p className="text-white opacity-75 small mb-0">
              Get the first driver to retire correctly and earn a massive <span className="fw-bold text-danger">+25 Points</span>.
            </p>
          </section>
        </Modal.Body>
        <Modal.Footer className="border-secondary">
          <Button variant="danger" className="w-100 fw-bold py-2" onClick={() => setShowHowToPlay(false)}>GOT IT</Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

export default function PredictPage() {
  return (
    <Suspense fallback={<LoadingView />}>
      <PredictContent />
    </Suspense>
  );
}
