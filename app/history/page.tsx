'use client';

import { useState, useEffect } from 'react';
import { Row, Col, Card } from 'react-bootstrap';
import { CURRENT_SEASON } from '@/lib/data';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { History, Trophy, Lock } from 'lucide-react';
import { triggerLightHaptic, triggerMediumHaptic } from '@/lib/utils/haptics';
import SwipeablePageLayout from '@/components/SwipeablePageLayout';
import LoadingView from '@/components/LoadingView';
import EmptyState from '@/components/EmptyState';
import { useF1Data } from '@/lib/hooks/use-f1-data';
import { useAchievements } from '@/lib/hooks/use-achievements';

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
  const [activeTab, setActiveTab] = useState('history');
  const { drivers, calendar, loading: f1Loading } = useF1Data(CURRENT_SEASON);
  const { unlocked, allAchievements, loading: achieveLoading } = useAchievements();
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

  const loading = f1Loading || dbLoading || (activeTab === 'achievements' && achieveLoading);

  const renderHistory = () => (
    <div className="mt-3">
      {history.length > 0 ? (
        <Row className="g-4 pb-5">
          {history.map(race => (
            <Col xs={12} md={6} xl={4} key={race.round}>
              <Card className="f1-accent-card border-secondary border-opacity-50 h-100">
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
  );

  const renderAchievements = () => (
    <div className="mt-3">
      <div className="text-center mb-4 p-3 bg-dark bg-opacity-25 rounded-3 border border-secondary border-opacity-25">
        <h2 className="display-6 fw-bold text-white mb-1">{unlocked.length} / {allAchievements.length}</h2>
        <p className="text-muted text-uppercase fw-bold letter-spacing-2 small mb-0">Achievements Unlocked</p>
      </div>

      <Row className="g-3 pb-5">
        {allAchievements.map(achievement => {
          const isUnlocked = unlocked.some(u => u.achievementId === achievement.id);
          const unlockData = unlocked.find(u => u.achievementId === achievement.id);

          return (
            <Col xs={12} md={6} key={achievement.id}>
              <Card className={`f1-glass-card border-secondary border-opacity-25 h-100 ${!isUnlocked ? 'opacity-50 grayscale' : ''}`}>
                <Card.Body className="p-3 d-flex align-items-center">
                  <div 
                    className="rounded-circle d-flex align-items-center justify-content-center me-3 shadow-sm" 
                    style={{ 
                      width: '60px', 
                      height: '60px', 
                      backgroundColor: isUnlocked ? achievement.color : '#222',
                      fontSize: '1.8rem',
                      flexShrink: 0
                    }}
                  >
                    {isUnlocked ? achievement.icon : <Lock size={24} className="text-muted" />}
                  </div>
                  <div className="flex-grow-1">
                    <h4 className={`h6 mb-1 fw-bold letter-spacing-1 ${isUnlocked ? 'text-white' : 'text-muted'}`}>
                      {achievement.name.toUpperCase()}
                    </h4>
                    <p className="extra-small text-muted mb-0" style={{ lineHeight: '1.2' }}>
                      {achievement.description}
                    </p>
                    {isUnlocked && unlockData && (
                      <div className="mt-2 badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 fw-bold" style={{ fontSize: '0.55rem' }}>
                        UNLOCKED: {new Date(unlockData.unlockedAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </Card.Body>
              </Card>
            </Col>
          );
        })}
      </Row>
    </div>
  );

  return (
    <SwipeablePageLayout
      title="Season Progress"
      subtitle={`${CURRENT_SEASON} Stats & Milestones`}
      icon={<History size={24} className="text-white" />}
      onBack={() => { triggerLightHaptic(); router.back(); }}
      activeTab={activeTab}
      onTabChange={(id) => { triggerMediumHaptic(); setActiveTab(id); }}
      tabs={[
        { id: 'history', label: 'History', icon: <History size={16} /> },
        { id: 'achievements', label: 'Trophies', icon: <Trophy size={16} /> }
      ]}
    >
      {loading ? (
        <LoadingView text={activeTab === 'history' ? "Loading Season History..." : "Checking Trophies..."} />
      ) : activeTab === 'history' ? renderHistory() : renderAchievements()}
    </SwipeablePageLayout>
  );
}
