'use client';

import { useState, useEffect, useMemo } from 'react';
import { Container, Row, Col, Form, Button, Card, Table, Spinner, Alert } from 'react-bootstrap';
import { DRIVERS as FALLBACK_DRIVERS, RACES, CURRENT_SEASON } from '@/lib/data';
import { fetchRaceResults, getFirstDnfDriver, fetchDrivers, fetchCalendar, TEAM_COLORS, AppDriver, ApiCalendarRace } from '@/lib/api';
import { createClient } from '@/lib/supabase/client';
import AppNavbar from '@/components/AppNavbar';

interface AdminDriver {
  id: string;
  name: string;
  team: string;
  color: string;
}

export default function AdminPage() {
  const [drivers, setDrivers] = useState<AdminDriver[]>(FALLBACK_DRIVERS);
  const [results, setResults] = useState<{ [driverId: string]: number }>({});
  const [firstDnf, setFirstDnf] = useState('');
  const [availableRaces, setAvailableRaces] = useState<ApiCalendarRace[]>([]);
  const [selectedRace, setSelectedRace] = useState(RACES[0].id);
  const [season, setSeason] = useState(CURRENT_SEASON);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const supabase = createClient();

  const fallbackRaces = useMemo(() => RACES.map(r => ({
    round: r.id,
    raceName: r.name,
    Circuit: { circuitName: r.circuit },
    date: r.date,
    season: CURRENT_SEASON.toString()
  })), []);

  useEffect(() => {
    async function load() {
      if (loading) return;
      
      setFirstDnf(''); 
      const d = await fetchDrivers(season);
      if (d.length > 0) {
        setDrivers(d);
        setResults(Object.fromEntries(d.map((driver: AppDriver, i: number) => [driver.id, i + 1])));
      } else {
        setDrivers(FALLBACK_DRIVERS);
        setResults(Object.fromEntries(FALLBACK_DRIVERS.map((driver, i) => [driver.id, i + 1])));
      }

      const cal = await fetchCalendar(season);
      if (cal.length > 0) {
        setAvailableRaces(cal);
        setSelectedRace(cal[0].round);
      } else {
        setAvailableRaces(fallbackRaces);
        setSelectedRace(fallbackRaces[0].round);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season]);

  const handlePositionChange = (driverId: string, position: number) => {
    setResults(prev => ({ ...prev, [driverId]: position }));
  };

  const handleFetchFromApi = async () => {
    setLoading(true);
    setError(null);
    const raceInfo = availableRaces.find(r => r.round === selectedRace);
    if (!raceInfo) {
      setLoading(false);
      return;
    }

    try {
      const data = await fetchRaceResults(season, parseInt(raceInfo.round));
      if (data) {
        const participatingDrivers = data.Results.map(r => ({
          id: r.Driver.driverId,
          name: `${r.Driver.givenName} ${r.Driver.familyName}`,
          team: r.Constructor.name,
          color: TEAM_COLORS[r.Constructor.constructorId] || '#B6BABD'
        }));
        setDrivers(participatingDrivers);

        const newResults: { [driverId: string]: number } = {};
        data.Results.forEach(r => {
          newResults[r.Driver.driverId] = parseInt(r.position);
        });
        setResults(newResults);
        
        const dnf = getFirstDnfDriver(data);
        if (dnf) {
          setFirstDnf(dnf.driverId);
        } else {
          setFirstDnf('');
        }
      } else {
        setError(`No results found for Season ${season}, Round ${raceInfo.round}.`);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to fetch data from API.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveResults = async (target: 'local' | 'global') => {
    const key = prompt(`Enter Admin Key to Publish ${target.toUpperCase()}:`);
    if (key !== 'p10admin') {
      alert('Invalid Key.');
      return;
    }

    const simplifiedResults = {
      positions: results,
      firstDnf: firstDnf
    };

    if (target === 'local') {
      localStorage.setItem(`results_${selectedRace}`, JSON.stringify(simplifiedResults));
      alert(`Results for Round ${selectedRace} published and saved locally!`);
    } else {
      setLoading(true);
      const { error: dbError } = await supabase
        .from('verified_results')
        .upsert({
          id: `${season}_${selectedRace}`,
          data: simplifiedResults,
          updated_at: new Date().toISOString()
        });
      
      setLoading(false);
      if (dbError) {
        alert('Global publish error: ' + dbError.message);
      } else {
        alert(`Results for Round ${selectedRace} published GLOBALLY to Supabase!`);
      }
    }
  };

  const handleResetGame = () => {
    const key = prompt('Enter Admin Key to RESET EVERYTHING:');
    if (key !== 'p10admin') {
      alert('Invalid Key.');
      return;
    }

    if (confirm('Are you sure you want to RESET the entire game? This will delete all users, predictions, and results.')) {
      localStorage.clear();
      alert('Game data has been reset.');
      window.location.href = '/';
    }
  };

  return (
    <main>
      <AppNavbar />

      <Container className="mt-4 mb-5">
        <Row className="mb-4">
          <Col>
            <h1 className="h2 fw-bold text-uppercase letter-spacing-1">Admin Results Entry</h1>
            <div className="d-flex gap-3 align-items-end mt-3 flex-wrap">
              <Form.Group style={{ maxWidth: '150px' }}>
                <Form.Label className="small text-muted text-uppercase fw-bold">Season</Form.Label>
                <Form.Control type="number" value={season} onChange={(e) => setSeason(parseInt(e.target.value))} className="bg-dark text-white border-secondary" />
              </Form.Group>
              <Form.Group style={{ maxWidth: '300px' }}>
                <Form.Label className="small text-muted text-uppercase fw-bold">Select Race</Form.Label>
                <Form.Select value={selectedRace} onChange={(e) => setSelectedRace(e.target.value)} className="bg-dark text-white border-secondary" >
                  {availableRaces.map(race => (
                    <option key={race.round} value={race.round}>{race.raceName} (R{race.round})</option>
                  ))}
                </Form.Select>
              </Form.Group>
              <Button variant="outline-info" onClick={handleFetchFromApi} disabled={loading} className="px-4 fw-bold">
                {loading ? <Spinner animation="border" size="sm" /> : 'FETCH API'}
              </Button>
            </div>
            {error && <Alert variant="danger" className="mt-3 py-2">{error}</Alert>}
          </Col>
        </Row>

        <Row>
          <Col lg={8}>
            <Card className="border-secondary shadow-sm">
              <Card.Header className="bg-dark border-secondary py-3"><h3 className="h6 mb-0 text-uppercase fw-bold text-white">Finishing Order</h3></Card.Header>
              <Card.Body className="p-0">
                <Table variant="dark" hover responsive className="mb-0">
                  <thead>
                    <tr className="bg-dark bg-opacity-50 small text-uppercase">
                      <th className="ps-4 py-3">Driver</th>
                      <th>Team</th>
                      <th className="pe-4 text-end" style={{ width: '120px' }}>Position</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drivers.map((driver) => (
                      <tr key={driver.id} style={{ height: '60px', verticalAlign: 'middle' }}>
                        <td className="ps-4 fw-bold text-white">{driver.name}</td>
                        <td className="text-muted small">{driver.team}</td>
                        <td className="pe-4">
                          <Form.Control type="number" min="1" max="22" value={results[driver.id] || ''} onChange={(e) => handlePositionChange(driver.id, parseInt(e.target.value))} className="bg-dark text-white border-secondary text-end" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Card.Body>
            </Card>
          </Col>

          <Col lg={4}>
            <Card className="border-secondary mb-4 shadow-sm">
              <Card.Header className="bg-dark border-secondary py-3"><h3 className="h6 mb-0 text-uppercase fw-bold text-white">Verification</h3></Card.Header>
              <Card.Body className="p-4">
                <Form.Group className="mb-4">
                  <Form.Label className="small text-muted text-uppercase fw-bold">First DNF</Form.Label>
                  <Form.Select value={firstDnf} onChange={(e) => setFirstDnf(e.target.value)} className="bg-dark text-white border-secondary" >
                    <option value="">None / All Finished</option>
                    {drivers.map(driver => (
                      <option key={driver.id} value={driver.id}>{driver.name}</option>
                    ))}
                  </Form.Select>
                </Form.Group>

                <div className="d-grid gap-3">
                  <Button variant="danger" size="lg" onClick={() => handleSaveResults('global')} disabled={loading} className="fw-bold py-3">PUBLISH GLOBALLY</Button>
                  <Button variant="outline-light" onClick={() => handleSaveResults('local')} disabled={loading} className="fw-bold py-2">PUBLISH LOCALLY</Button>
                </div>
              </Card.Body>
            </Card>

            <Button variant="outline-danger" size="sm" className="w-100 opacity-50 mt-4" onClick={handleResetGame}>RESET ALL GAME DATA</Button>
          </Col>
        </Row>
      </Container>
    </main>
  );
}
