'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Container, Row, Col, Table, Button, Spinner, ButtonGroup } from 'react-bootstrap';
import { LeaderboardEntry, CURRENT_SEASON } from '@/lib/data';
import { calculateSeasonPoints } from '@/lib/scoring';
import { DbPrediction } from '@/lib/types';
import { fetchCalendar } from '@/lib/api';
import { createClient } from '@/lib/supabase/client';
import PullToRefresh from '@/components/PullToRefresh';
import { fetchAllSimplifiedResults } from '@/lib/results';
import { isTestAccount } from '@/lib/utils/profiles';
import { withTimeout } from '@/lib/utils/sync-queue';
import { STORAGE_KEYS, getPredictionKey } from '@/lib/utils/storage';
import { useAuth } from '@/components/AuthProvider';
import { sessionTracker } from '@/lib/utils/session';

interface LeaderboardPlayer {
  username: string;
  userId?: string;
  isLocal: boolean;
  dbPredictions?: DbPrediction[];
}

export default function LeaderboardPage() {
  const supabase = createClient();
  const mountedRef = useRef(true);
  const { session, currentUser, syncVersion, triggerRefresh } = useAuth();

  // 1. Synchronous Cache Initialization
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(() => {
    if (typeof window === 'undefined') return [];
    const cached = localStorage.getItem(STORAGE_KEYS.CACHE_LEADERBOARD);
    return cached ? JSON.parse(cached) : [];
  });

  const [loading, setLoading] = useState(!leaderboard.length);
  const [isSeasonComplete, setIsSeasonComplete] = useState(false);
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);
  const [view, setView] = useState<'global' | 'local'>('global');

  // Lifecycle
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const calculate = useCallback(async (quiet = false) => {
  if (!quiet && mountedRef.current) setLoading(true);
  try {
    const [raceResultsMap, races] = await Promise.all([
      fetchAllSimplifiedResults(),
      fetchCalendar(CURRENT_SEASON)
    ]);
    
    const resultsFoundCount = Object.keys(raceResultsMap).length;
    if (mountedRef.current) setIsSeasonComplete(resultsFoundCount > 0 && resultsFoundCount >= races.length);

    let playersData: LeaderboardPlayer[] = [];
      if (view === 'global') {
        const currentUserId = session?.user?.id;

        const { data: profiles } = await withTimeout(supabase.from('profiles').select('id, username'));
        const { data: predictions } = await withTimeout(supabase.from('predictions').select('*')) as { data: DbPrediction[] | null };

        if (profiles && mountedRef.current) {
          playersData = profiles
            .filter(p => !isTestAccount(p.username) || p.id === currentUserId)
            .map(p => ({ 
              username: p.username, 
              userId: p.id, 
              isLocal: false,
              dbPredictions: predictions?.filter(pred => pred.user_id === p.id) || []
            }));
        }
      } else {
        const localPlayers: string[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAYERS_LIST) || '[]');
        playersData = localPlayers.map(p => ({ username: p, isLocal: true }));
      }

      const entries: LeaderboardEntry[] = playersData.map((player) => {
        const playerPredictions: { [round: string]: { p10: string, dnf: string } | null } = {};
        Object.keys(raceResultsMap).forEach(round => {
          if (player.isLocal) {
            const predStr = localStorage.getItem(getPredictionKey(CURRENT_SEASON, player.username, round));
            if (predStr) playerPredictions[round] = JSON.parse(predStr);
          } else if (player.dbPredictions) {
            const dbMatch = player.dbPredictions.find((dp) => dp.race_id === `${CURRENT_SEASON}_${round}`);
            if (dbMatch) playerPredictions[round] = { p10: dbMatch.p10_driver_id, dnf: dbMatch.dnf_driver_id };
          }
        });
        const { totalPoints, lastRacePoints, latestBreakdown, history } = calculateSeasonPoints(playerPredictions, raceResultsMap);
        return { rank: 0, player: player.username, points: totalPoints, lastRacePoints, breakdown: latestBreakdown, history };
      });

      const sorted = entries.sort((a, b) => b.points - a.points);
      const ranked = sorted.map((entry, index) => ({ ...entry, rank: index + 1 }));
      
      if (mountedRef.current) {
        setLeaderboard(ranked);
        if (view === 'global') localStorage.setItem(STORAGE_KEYS.CACHE_LEADERBOARD, JSON.stringify(ranked));
      }
    } catch (err) {
      console.error('Leaderboard: Calc error:', err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [supabase, view, session?.user?.id, syncVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const fingerprint = session?.user.id || currentUser || 'guest';
    const isFirstView = sessionTracker.isFirstView('leaderboard', fingerprint);
    
    // Only calculate if we have no data, OR it's the first view for this user
    if (leaderboard.length === 0 || isFirstView) {
      calculate(leaderboard.length > 0);
    }
    
    // Listen for app resume
    const handleResume = () => {
      console.log('Leaderboard: App resumed (background).');
      triggerRefresh();
    };
    window.addEventListener('p10:app_resume', handleResume);
    return () => window.removeEventListener('p10:app_resume', handleResume);
  }, [calculate, session?.user.id, currentUser, leaderboard.length, syncVersion, triggerRefresh]);

  // Real-time subscription
  useEffect(() => {
    if (view !== 'global') return;
    const channel = supabase.channel('leaderboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'verified_results' }, () => calculate(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'predictions' }, () => calculate(true))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, view, calculate]);

  return (
    <PullToRefresh onRefresh={() => calculate(false)}>
      <Container className="mt-4 mb-2">
        <Row className="mb-4 align-items-center">
          <Col>
            <div className="d-flex align-items-center gap-2 mb-1">
              <h1 className="h2 mb-0 text-uppercase fw-bold letter-spacing-1">Leaderboard</h1>
              {isSeasonComplete && <span className="badge bg-warning text-dark fw-bold rounded-pill" style={{ fontSize: '0.6rem' }}>🏆 FINAL STANDINGS</span>}
            </div>
            <p className="text-muted small mb-0">{isSeasonComplete ? `Final results from the ${CURRENT_SEASON} season` : `Live points from the ${CURRENT_SEASON} season`}</p>
          </Col>
          <Col xs="auto">
            <ButtonGroup className="bg-dark rounded border border-secondary p-1">
              <Button variant={view === 'global' ? 'danger' : 'dark'} size="sm" onClick={() => setView('global')} className="rounded px-3">GLOBAL</Button>
              <Button variant={view === 'local' ? 'danger' : 'dark'} size="sm" onClick={() => setView('local')} className="rounded px-3">GUESTS</Button>
            </ButtonGroup>
          </Col>
        </Row>
        <Row>
          <Col>
            <div className="table-responsive rounded border border-secondary shadow-sm">
              <Table variant="dark" hover className="mb-0">
                <thead><tr className="bg-dark bg-opacity-50 text-uppercase letter-spacing-1 small"><th className="ps-4 py-3">Pos</th><th className="py-3">Player</th><th className="text-end py-3">Last Race</th><th className="text-end pe-4 py-3">Total</th></tr></thead>
                <tbody>
                  {loading ? (<tr><td colSpan={4} className="text-center py-5"><Spinner animation="border" variant="danger" /></td></tr>) : leaderboard.length > 0 ? leaderboard.map((entry) => (
                    <React.Fragment key={entry.player}>
                      <tr onClick={() => setExpandedPlayer(expandedPlayer === entry.player ? null : entry.player)} style={{ height: '70px', verticalAlign: 'middle', cursor: 'pointer' }} className={expandedPlayer === entry.player ? 'bg-danger bg-opacity-10' : ''}>
                        <td className="ps-4 fw-bold text-muted">{entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : entry.rank}</td>
                        <td className="fw-bold text-white">{entry.player} {entry.player === currentUser && <span className="badge bg-danger ms-2" style={{ fontSize: '0.5rem' }}>YOU</span>}</td>
                        <td className="text-end fw-bold text-muted">{entry.lastRacePoints > 0 ? `+${entry.lastRacePoints}` : entry.lastRacePoints}</td>
                        <td className="text-end pe-4 fw-bold text-danger">{entry.points}</td>
                      </tr>
                      {expandedPlayer === entry.player && (
                        <tr>
                          <td colSpan={4} className="p-0 border-0">
                            <div className="bg-black bg-opacity-20 p-4 border-top border-bottom border-secondary border-opacity-25">
                              <Row className="g-4">
                                <Col md={6}>
                                  <h4 className="h6 text-uppercase fw-bold text-danger mb-3">Latest Breakdown</h4>
                                  {entry.breakdown ? (
                                    <div className="small">
                                      <div className="d-flex justify-content-between mb-2"><span>P10 Pick:</span><span className="fw-bold text-white">{entry.breakdown.p10Driver} ({entry.breakdown.p10Points} pts)</span></div>
                                      <div className="d-flex justify-content-between"><span>DNF Pick:</span><span className="fw-bold text-white">{entry.breakdown.dnfDriver} ({entry.breakdown.dnfPoints} pts)</span></div>
                                    </div>
                                  ) : <p className="small text-muted">No breakdown available.</p>}
                                </Col>
                                <Col md={6}>
                                  <h4 className="h6 text-uppercase fw-bold text-danger mb-3">Recent Performance</h4>
                                  <div className="d-flex gap-1">
                                    {entry.history && entry.history.slice(-5).map((h, idx) => (
                                      <div key={idx} className="bg-dark border border-secondary rounded p-2 text-center" style={{ minWidth: '40px' }}>
                                        <div className="extra-small text-muted mb-1">R{h.round}</div>
                                        <div className="small fw-bold">{h.points}</div>
                                      </div>
                                    ))}
                                  </div>
                                </Col>
                              </Row>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )) : (<tr><td colSpan={4} className="text-center py-5 text-muted small">No entries found.</td></tr>)}
                </tbody>
              </Table>
            </div>
          </Col>
        </Row>
      </Container>
    </PullToRefresh>
  );
}
