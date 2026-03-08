'use client';

import { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Spinner } from 'react-bootstrap';
import { CURRENT_SEASON } from '@/lib/data';
import { fetchCalendar, fetchRaceResults, getFirstDnfDriver, ApiCalendarRace } from '@/lib/api';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import Link from 'next/link';
import AppNavbar from '@/components/AppNavbar';

interface HistoryEntry {
  round: string;
  name: string;
  p10: string;
  dnf: string;
  winner: string;
}

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const triggerHaptic = () => {
    Haptics.impact({ style: ImpactStyle.Light });
  };

  useEffect(() => {
    async function loadHistory() {
      const races = await fetchCalendar(CURRENT_SEASON);
      const historyData = await Promise.all(races.map(async (r: ApiCalendarRace) => {
        const results = await fetchRaceResults(CURRENT_SEASON, parseInt(r.round));
        if (results) {
          const p10 = results.Results.find((res) => res.position === "10");
          const dnf = getFirstDnfDriver(results);
          return {
            round: r.round,
            name: r.raceName,
            p10: p10 ? `${p10.Driver.givenName} ${p10.Driver.familyName}` : 'N/A',
            dnf: dnf ? `${dnf.givenName} ${dnf.familyName}` : 'None',
            winner: `${results.Results[0].Driver.givenName} ${results.Results[0].Driver.familyName}`
          };
        }
        return null;
      }));

      setHistory(historyData.filter((h): h is HistoryEntry => h !== null).reverse());
      setLoading(false);
    }
    loadHistory();
  }, []);

  return (
    <main>
      <AppNavbar />

      <Container className="mt-4">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h1 className="h2 fw-bold text-uppercase letter-spacing-1">Race History</h1>
          <Link href="/" onClick={triggerHaptic} className="btn btn-sm btn-outline-light rounded-pill px-3 opacity-75 text-decoration-none">Back</Link>
        </div>
        
        {loading ? (
          <div className="text-center py-5">
            <Spinner animation="border" variant="danger" />
          </div>
        ) : (
          <Row>
            {history.map(race => (
              <Col md={6} lg={4} key={race.round} className="mb-4">
                <Card className="h-100 border-secondary shadow-sm overflow-hidden" style={{ borderLeft: '4px solid var(--f1-red)' }}>
                  <Card.Header className="bg-dark border-secondary d-flex justify-content-between align-items-center py-3">
                    <span className="fw-bold text-danger">ROUND {race.round}</span>
                    <span className="text-muted small text-uppercase fw-bold">{race.name}</span>
                  </Card.Header>
                  <Card.Body className="p-4">
                    <div className="mb-4">
                      <small className="text-muted text-uppercase d-block mb-1 letter-spacing-1 fw-bold" style={{ fontSize: '0.65rem' }}>P10 Finisher</small>
                      <span className="fs-4 fw-bold text-white">{race.p10}</span>
                    </div>
                    <div className="mb-4">
                      <small className="text-muted text-uppercase d-block mb-1 letter-spacing-1 fw-bold" style={{ fontSize: '0.65rem' }}>First DNF</small>
                      <span className="fs-4 fw-bold text-danger">{race.dnf}</span>
                    </div>
                    <div className="pt-3 border-top border-secondary border-opacity-50">
                      <small className="text-muted text-uppercase d-block mb-1 fw-bold" style={{ fontSize: '0.6rem' }}>Race Winner</small>
                      <span className="text-white fw-semibold">{race.winner}</span>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            ))}
            {history.length === 0 && (
              <Col className="text-center py-5">
                <p className="text-muted">No race results available yet for the {CURRENT_SEASON} season.</p>
              </Col>
            )}
          </Row>
        )}
      </Container>
    </main>
  );
}
