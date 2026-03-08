'use client';

import { useState, useEffect } from 'react';
import { Container, Row, Col, Form, Button, Card, Navbar, Table, Spinner, Alert } from 'react-bootstrap';
import { DRIVERS as FALLBACK_DRIVERS, RACES, CURRENT_SEASON } from '@/lib/data';
import { fetchRaceResults, getFirstDnfDriver, fetchDrivers, fetchCalendar, TEAM_COLORS } from '@/lib/api';
import Link from 'next/link';
import AppNavbar from '@/components/AppNavbar';

export default function AdminPage() {
  const [drivers, setDrivers] = useState<any[]>(FALLBACK_DRIVERS);
  const [results, setResults] = useState<{ [driverId: string]: number }>({});
  const [firstDnf, setFirstDnf] = useState('');
  const [availableRaces, setAvailableRaces] = useState<any[]>(RACES);
  const [selectedRace, setSelectedRace] = useState(RACES[0].id);
  const [season, setSeason] = useState(CURRENT_SEASON);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (loading) return;
      
      setFirstDnf(''); 
      const d = await fetchDrivers(season);
      if (d.length > 0) {
        setDrivers(d);
        setResults(Object.fromEntries(d.map((driver, i) => [driver.id, i + 1])));
      } else {
        setDrivers(FALLBACK_DRIVERS);
        setResults(Object.fromEntries(FALLBACK_DRIVERS.map((driver, i) => [driver.id, i + 1])));
      }

      const cal = await fetchCalendar(season);
      if (cal.length > 0) {
        const formattedRaces = cal.map(r => ({
          id: r.round,
          name: r.raceName,
          round: parseInt(r.round)
        }));
        setAvailableRaces(formattedRaces);
        setSelectedRace(formattedRaces[0].id);
      } else {
        setAvailableRaces(RACES);
        setSelectedRace(RACES[0].id);
      }
    }
    load();
  }, [season]);

  const handlePositionChange = (driverId: string, position: number) => {
    setResults(prev => ({ ...prev, [driverId]: position }));
  };

  const handleFetchFromApi = async () => {
    setLoading(true);
    setError(null);
    const raceInfo = availableRaces.find(r => r.id === selectedRace);
    if (!raceInfo) {
      setLoading(false);
      return;
    }

    try {
      const data = await fetchRaceResults(season, raceInfo.round);
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
      setError('Failed to fetch data from API.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveResults = () => {
    const key = prompt('Enter Admin Key to Publish:');
    if (key !== 'p10admin') {
      alert('Invalid Key.');
      return;
    }

    const raceResults = {
      raceId: selectedRace,
      positions: results,
      firstDnf: firstDnf
    };
    localStorage.setItem(`results_${selectedRace}`, JSON.stringify(raceResults));
    alert(`Results for Round ${selectedRace} published and saved locally!`);
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
            <h1 className="h2">Race Results Entry</h1>
            <div className="d-flex gap-3 align-items-end mt-3 flex-wrap">
              <Form.Group style={{ maxWidth: '150px' }}>
                <Form.Label>Season</Form.Label>
                <Form.Control 
                  type="number" 
                  value={season} 
                  onChange={(e) => setSeason(parseInt(e.target.value))}
                  className="bg-dark text-white border-secondary"
                />
              </Form.Group>
              <Form.Group style={{ maxWidth: '300px' }}>
                <Form.Label>Select Race (Round)</Form.Label>
                <Form.Select 
                  value={selectedRace} 
                  onChange={(e) => setSelectedRace(e.target.value)}
                  className="bg-dark text-white border-secondary"
                >
                  {availableRaces.map(race => (
                    <option key={race.id} value={race.id}>{race.name} (R{race.round})</option>
                  ))}
                </Form.Select>
              </Form.Group>
              <Button 
                variant="outline-info" 
                onClick={handleFetchFromApi} 
                disabled={loading}
                className="mb-0"
              >
                {loading ? <Spinner animation="border" size="sm" /> : 'Fetch from API'}
              </Button>
            </div>
            {error && <Alert variant="danger" className="mt-3 py-2">{error}</Alert>}
          </Col>
        </Row>

        <Row>
          <Col lg={8}>
            <Card className="mb-4">
              <Card.Header className="bg-dark border-secondary">
                <h3 className="h5 mb-0">Finishing Order</h3>
              </Card.Header>
              <Card.Body>
                <Table variant="dark" responsive>
                  <thead>
                    <tr>
                      <th>Driver</th>
                      <th>Team</th>
                      <th style={{ width: '120px' }}>Position</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drivers.map((driver) => (
                      <tr key={driver.id}>
                        <td className="text-white fw-bold">{driver.name}</td>
                        <td style={{ color: '#a0a0a5' }} className="small">{driver.team}</td>
                        <td>
                          <Form.Control 
                            type="number" 
                            min="1" 
                            max="22"
                            value={results[driver.id] || ''}
                            onChange={(e) => handlePositionChange(driver.id, parseInt(e.target.value))}
                            className="bg-dark text-white border-secondary"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Card.Body>
            </Card>
          </Col>

          <Col lg={4}>
            <Card className="mb-4">
              <Card.Header className="bg-dark border-secondary">
                <h3 className="h5 mb-0">Retirements</h3>
              </Card.Header>
              <Card.Body>
                <Form.Group>
                  <Form.Label>First DNF</Form.Label>
                  <Form.Select 
                    value={firstDnf} 
                    onChange={(e) => setFirstDnf(e.target.value)}
                    className="bg-dark text-white border-secondary"
                  >
                    <option value="">None / All Finished</option>
                    {drivers.map(driver => (
                      <option key={driver.id} value={driver.id}>{driver.name}</option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Card.Body>
            </Card>

            <div className="d-grid gap-2">
              <Button variant="success" size="lg" onClick={handleSaveResults}>
                Publish Results
              </Button>
              <Button variant="outline-danger" size="sm" className="mt-4" onClick={handleResetGame}>
                Reset All Game Data
              </Button>
            </div>
          </Col>
        </Row>
      </Container>
    </main>
  );
}
