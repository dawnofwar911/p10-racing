'use client';

import { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Navbar, Spinner, Table } from 'react-bootstrap';
import { CURRENT_SEASON } from '@/lib/data';
import { fetchCalendar, fetchRaceResults, getFirstDnfDriverId } from '@/lib/api';
import Link from 'next/link';
import AppNavbar from '@/components/AppNavbar';

export default function HistoryPage() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadHistory() {
      const races = await fetchCalendar(CURRENT_SEASON);
      const now = new Date();
      const finished = races.filter(r => new Date(r.date) < now);

      const historyData = await Promise.all(finished.map(async (r) => {
        const results = await fetchRaceResults(CURRENT_SEASON, parseInt(r.round));
        if (results) {
          const p10 = results.Results.find((res: any) => res.position === "10");
          const dnfId = getFirstDnfDriverId(results);
          return {
            round: r.round,
            name: r.raceName,
            p10: p10 ? `${p10.Driver.givenName} ${p10.Driver.familyName}` : 'N/A',
            dnf: dnfId || 'None',
            winner: `${results.Results[0].Driver.givenName} ${results.Results[0].Driver.familyName}`
          };
        }
        return null;
      }));

      setHistory(historyData.filter(h => h !== null).reverse());
      setLoading(false);
    }
    loadHistory();
  }, []);

  return (
    <main>
      <AppNavbar />

      <Container className="mt-4">
        <h1 className="h2 mb-4">Race History</h1>
        
        {loading ? (
          <div className="text-center py-5">
            <Spinner animation="border" variant="danger" />
          </div>
        ) : (
          <Row>
            {history.map(race => (
              <Col md={6} lg={4} key={race.round} className="mb-4">
                <Card className="h-100 border-secondary">
                  <Card.Header className="bg-dark border-secondary d-flex justify-content-between">
                    <span className="fw-bold">Round {race.round}</span>
                    <span className="text-muted small">{race.name}</span>
                  </Card.Header>
                  <Card.Body>
                    <div className="mb-3">
                      <small className="text-muted text-uppercase d-block">P10 Finisher</small>
                      <span className="fs-5 fw-bold text-white">{race.p10}</span>
                    </div>
                    <div className="mb-3">
                      <small className="text-muted text-uppercase d-block">First DNF</small>
                      <span className="fs-5 fw-bold text-danger">{race.dnf}</span>
                    </div>
                    <div>
                      <small className="text-muted text-uppercase d-block">Race Winner</small>
                      <span className="small text-white">{race.winner}</span>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            ))}
            {history.length === 0 && (
              <Col className="text-center py-5">
                <p className="text-muted">No races have finished yet in the {CURRENT_SEASON} season.</p>
              </Col>
            )}
          </Row>
        )}
      </Container>
    </main>
  );
}
