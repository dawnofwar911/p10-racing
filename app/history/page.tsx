'use client';

import { useState, useEffect } from 'react';
import { Row, Col, Card, Spinner } from 'react-bootstrap';
import { CURRENT_SEASON } from '@/lib/data';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { History } from 'lucide-react';
import { triggerLightHaptic } from '@/lib/utils/haptics';
import SwipeablePageLayout from '@/components/SwipeablePageLayout';
import EmptyState from '@/components/EmptyState';
import { useF1Data } from '@/lib/hooks/use-f1-data';

interface HistoryEntry {
  round: string;
  name: string;
  p10: string;
  p10Color: string;
  dnf: string;
  dnfColor: string;
  winner: string;
}

const supabase = createClient();

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [dbLoading, setDbLoading] = useState(true);
  const { drivers, calendar, loading: f1Loading } = useF1Data(CURRENT_SEASON);
  const router = useRouter();

  useEffect(() => {
    async function loadHistory() {
      if (f1Loading) return;

      const { data: dbResults } = await supabase
        .from('verified_results')
        .select('*')
        .like('id', `${CURRENT_SEASON}_%`);

      if (!dbResults || dbResults.length === 0) {
        setDbLoading(false);
        return;
      }

      const historyData: HistoryEntry[] = dbResults.map(res => {
        const round = res.id.split('_')[1];
        const raceInfo = calendar.find(r => r.round === round);
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
          p10Color: p10Driver?.color || '#B6BABD',
          dnf: dnfDriver ? dnfDriver.name : (data.firstDnf === 'None' ? 'None' : 'None'),
          dnfColor: dnfDriver?.color || '#B6BABD',
          winner: winnerDriver ? winnerDriver.name : 'Unknown'
        };
      });

      setHistory(historyData.sort((a, b) => parseInt(b.round) - parseInt(a.round)));
      setDbLoading(false);
    }
    loadHistory();
  }, [drivers, calendar, f1Loading]);

  const loading = f1Loading || dbLoading;

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
            <p className="mt-3 text-muted text-uppercase letter-spacing-1 fw-bold small">Loading History...</p>
          </div>
        ) : history.length > 0 ? (
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
                      <div className="d-flex align-items-center">
                        <div className="f1-driver-line me-2" style={{ backgroundColor: race.p10Color }}></div>
                        <span className="fs-4 fw-bold text-white">{race.p10}</span>
                      </div>
                    </div>
                    <div className="mb-4">
                      <small className="text-muted text-uppercase d-block mb-1 letter-spacing-2 fw-bold" style={{ fontSize: '0.65rem' }}>First DNF</small>
                      <div className="d-flex align-items-center">
                        <div className="f1-driver-line me-2" style={{ backgroundColor: race.dnfColor }}></div>
                        <span className="fs-4 fw-bold text-danger">{race.dnf}</span>
                      </div>
                    </div>
                    <div className="pt-3 border-top border-secondary border-opacity-10">
                      <small className="text-muted text-uppercase d-block mb-1 fw-bold letter-spacing-1" style={{ fontSize: '0.6rem' }}>Race Winner</small>
                      <span className="text-white fw-semibold small opacity-75">{race.winner}</span>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>
        ) : (
          <EmptyState 
            icon={<History size={48} className="text-secondary opacity-25 mb-3" />}
            message={`No race results available yet for the ${CURRENT_SEASON} season.`}
          />
        )}
      </div>
    </SwipeablePageLayout>
  );
}
