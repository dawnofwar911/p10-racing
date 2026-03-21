'use client';

import { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Spinner } from 'react-bootstrap';
import { CURRENT_SEASON } from '@/lib/data';
import { fetchCalendar, fetchDrivers } from '@/lib/api';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import HapticButton from '@/components/HapticButton';
import { History } from 'lucide-react';

interface HistoryEntry {
  round: string;
  name: string;
  p10: string;
  dnf: string;
  winner: string;
}

const supabase = createClient();

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function loadHistory() {
      // 1. Fetch all verified results from Supabase (filtered by current season)
      const { data: dbResults } = await supabase
        .from('verified_results')
        .select('*')
        .like('id', `${CURRENT_SEASON}_%`);

      if (!dbResults || dbResults.length === 0) {
        setLoading(false);
        return;
      }

      // 2. Fetch Drivers and Calendar to map names
      const [drivers, races] = await Promise.all([
        fetchDrivers(CURRENT_SEASON),
        fetchCalendar(CURRENT_SEASON)
      ]);

      const historyData: HistoryEntry[] = dbResults.map(res => {
        const round = res.id.split('_')[1];
        const raceInfo = races.find(r => r.round === round);
        const data = res.data as { positions: { [id: string]: number }, firstDnf: string | null };

        const p10Id = Object.entries(data.positions).find(([, pos]) => pos === 10)?.[0];
        const winnerId = Object.entries(data.positions).find(([, pos]) => pos === 1)?.[0];

        const p10Driver = drivers.find(d => d.id === p10Id);
        const dnfDriver = drivers.find(d => d.id === data.firstDnf);
        const winnerDriver = drivers.find(d => d.id === winnerId);

        return {
          round: round,
          name: raceInfo?.raceName || `Round ${round}`,
          p10: p10Driver ? p10Driver.name : 'Unknown',
          dnf: dnfDriver ? dnfDriver.name : (data.firstDnf === 'None' ? 'None' : 'None'),
          winner: winnerDriver ? winnerDriver.name : 'Unknown'
        };
      });

      setHistory(historyData.sort((a, b) => parseInt(b.round) - parseInt(a.round)));
      setLoading(false);
    }
    loadHistory();
  }, []);

  return (
    <>
      <Container className="mt-4 mb-4">
        <Row className="mb-4 align-items-center">
          <Col xs={12} md={8}>
            <div className="d-flex align-items-center">
              <div className="bg-danger rounded-circle p-2 me-3 d-flex align-items-center justify-content-center shadow-sm" style={{ width: '45px', height: '45px' }}>
                <History size={24} className="text-white" />
              </div>
              <div>
                <h1 className="h2 mb-0 f1-page-title text-white">Season History</h1>
                <small className="text-muted text-uppercase fw-bold letter-spacing-1" style={{ fontSize: '0.65rem' }}>{CURRENT_SEASON} Race Results</small>
              </div>
            </div>
          </Col>
          <Col xs={12} md={4} className="text-md-end mt-3 mt-md-0">
            <HapticButton 
              variant="outline-light"
              size="sm"
              onClick={() => { router.back(); }} 
              className="rounded-pill px-4 py-2 opacity-75 fw-bold text-uppercase"
              style={{ fontSize: '0.75rem' }}
            >
              Go Back
            </HapticButton>
          </Col>
        </Row>
        
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
    </>
  );
}
