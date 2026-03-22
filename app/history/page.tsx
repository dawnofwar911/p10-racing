'use client';

import { useState, useEffect } from 'react';
import { Row, Col, Card, Spinner } from 'react-bootstrap';
import { CURRENT_SEASON } from '@/lib/data';
import { fetchCalendar, fetchDrivers } from '@/lib/api';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { History } from 'lucide-react';
import { triggerLightHaptic } from '@/lib/utils/haptics';
import SwipeablePageLayout from '@/components/SwipeablePageLayout';

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
    <SwipeablePageLayout
      title="Season History"
      subtitle={`${CURRENT_SEASON} Race Results`}
      icon={<History size={24} className="text-white" />}
      onBack={() => { triggerLightHaptic(); router.back(); }}
      activeTab="history"
      onTabChange={() => {}}
      tabs={[{ id: 'history', label: 'History', icon: <History size={16} /> }]}
    >
      <div className="mt-3">
        {loading ? (
          <div className="text-center py-5">
            <Spinner animation="border" variant="danger" />
          </div>
        ) : (
          <Row className="g-4">
            {history.map(race => (
              <Col xs={12} md={6} xl={4} key={race.round}>
                <Card className="f1-accent-card border-secondary border-opacity-50">
                  <div className="f1-card-header d-flex justify-content-between align-items-center">
                    <span className="fw-bold text-danger letter-spacing-1">ROUND {race.round}</span>
                    <span className="text-white opacity-75 small fw-bold letter-spacing-1">{race.name}</span>
                  </div>
                  <Card.Body className="p-4">
                    <div className="mb-4">
                      <small className="text-muted text-uppercase d-block mb-1 letter-spacing-2 fw-bold" style={{ fontSize: '0.65rem' }}>P10 Finisher</small>
                      <span className="fs-4 fw-bold text-white">{race.p10}</span>
                    </div>
                    <div className="mb-4">
                      <small className="text-muted text-uppercase d-block mb-1 letter-spacing-2 fw-bold" style={{ fontSize: '0.65rem' }}>First DNF</small>
                      <span className="fs-4 fw-bold text-danger">{race.dnf}</span>
                    </div>
                    <div className="pt-3 border-top border-secondary border-opacity-10">
                      <small className="text-muted text-uppercase d-block mb-1 fw-bold letter-spacing-1" style={{ fontSize: '0.6rem' }}>Race Winner</small>
                      <span className="text-white fw-semibold small opacity-75">{race.winner}</span>
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
      </div>
    </SwipeablePageLayout>
  );
}
