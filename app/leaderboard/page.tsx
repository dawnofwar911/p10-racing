'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Container, Row, Col, Table, Button, Spinner, ButtonGroup } from 'react-bootstrap';
import { LeaderboardEntry, CURRENT_SEASON } from '@/lib/data';
import { calculateSeasonPoints } from '@/lib/scoring';
import { fetchCalendar } from '@/lib/api';
import { DbPrediction } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import PullToRefresh from '@/components/PullToRefresh';
import { fetchAllSimplifiedResults } from '@/lib/results';
import { isTestAccount } from '@/lib/utils/profiles';
import { SYNC_COMPLETE_EVENT, withTimeout, APP_READY_EVENT } from '@/lib/utils/sync-queue';

interface LeaderboardPlayer {
  username: string;
  userId?: string;
  isLocal: boolean;
  dbPredictions?: DbPrediction[];
}

export default function LeaderboardPage() {
  const supabase = createClient();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSeasonComplete, setIsSeasonComplete] = useState(false);
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);
  const [view, setView] = useState<'global' | 'local'>('global');
  const mountedRef = useRef(true);

  const calculate = useCallback(async (quiet = false) => {
    try {
      if (!quiet && mountedRef.current) setLoading(true);
      
      const raceResultsMap = await fetchAllSimplifiedResults();
      const races = await fetchCalendar(CURRENT_SEASON);
      const resultsFoundCount = Object.keys(raceResultsMap).length;
      if (mountedRef.current) setIsSeasonComplete(resultsFoundCount > 0 && resultsFoundCount === races.length);

      let playersData: LeaderboardPlayer[] = [];

      if (view === 'global') {
        const { data: sessionData } = await withTimeout(supabase.auth.getSession());
        const session = sessionData?.session;
        const currentUserId = session?.user?.id;

        const [{ data: profiles }, { data: predictions }] = await Promise.all([
          withTimeout(supabase.from('profiles').select('id, username')),
          withTimeout(supabase.from('predictions').select('*'))
        ]);

        if (profiles && mountedRef.current) {
          playersData = (profiles as { id: string; username: string }[])
            .filter((p) => !isTestAccount(p.username) || p.id === currentUserId)
            .map((p) => ({ 
              username: p.username, 
              userId: p.id, 
              isLocal: false,
              dbPredictions: (predictions as DbPrediction[])?.filter((pred) => pred.user_id === p.id) || []
            }));
        }
      } else {
        const localPlayers: string[] = JSON.parse(localStorage.getItem('p10_players') || '[]');
        playersData = localPlayers.map(p => ({ username: p, isLocal: true }));
      }

      const entries: LeaderboardEntry[] = playersData.map((player) => {
        const playerPredictions: { [round: string]: { p10: string, dnf: string } | null } = {};
        Object.keys(raceResultsMap).forEach(round => {
          if (player.isLocal) {
            const predStr = localStorage.getItem(`final_pred_${CURRENT_SEASON}_${player.username}_${round}`);
            if (predStr) playerPredictions[round] = JSON.parse(predStr);
          } else if (player.dbPredictions) {
            const dbMatch = player.dbPredictions.find((dp) => dp.race_id === `${CURRENT_SEASON}_${round}`);
            if (dbMatch) {
              playerPredictions[round] = { p10: dbMatch.p10_driver_id, dnf: dbMatch.dnf_driver_id };
            }
          }
        });

        const { totalPoints, lastRacePoints, latestBreakdown, history } = calculateSeasonPoints(playerPredictions, raceResultsMap);
        return { rank: 0, player: player.username, points: totalPoints, lastRacePoints, breakdown: latestBreakdown, history };
      });

      const sorted = entries.sort((a, b) => b.points - a.points);
      const ranked = sorted.map((entry, index) => ({ ...entry, rank: index + 1 }));
      
      if (mountedRef.current) {
        setLeaderboard(ranked);
        if (view === 'global') localStorage.setItem('p10_cache_leaderboard', JSON.stringify(ranked));
      }
    } catch (error) {
      console.error('Leaderboard: Calculate error:', error);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [view, supabase]);

  useEffect(() => {
    mountedRef.current = true;
    
    if (view === 'global') {
      const cached = localStorage.getItem('p10_cache_leaderboard');
      if (cached && mountedRef.current) {
        setLeaderboard(JSON.parse(cached));
        setLoading(false);
        calculate(true);
      } else {
        calculate();
      }
    } else {
      calculate();
    }

    const handleSyncComplete = () => calculate(true);
    const handleReady = () => {
      console.log('Leaderboard: APP_READY received, re-calculating');
      calculate(true);
    };

    window.addEventListener(SYNC_COMPLETE_EVENT, handleSyncComplete);
    window.addEventListener(APP_READY_EVENT, handleReady);

    return () => {
      mountedRef.current = false;
      window.removeEventListener(SYNC_COMPLETE_EVENT, handleSyncComplete);
      window.removeEventListener(APP_READY_EVENT, handleReady);
    };
  }, [calculate, view]);

  useEffect(() => {
    if (view !== 'global') return;
    const channel = supabase
      .channel('leaderboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'verified_results' }, () => calculate(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'predictions' }, () => calculate(true))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [view, calculate, supabase]);

  return (
    <PullToRefresh onRefresh={calculate}>
      <Container className="mt-4 mb-2">
        <Row className="mb-4 align-items-center">
          <Col>
            <h1 className="h2 mb-1 text-uppercase fw-bold letter-spacing-1">Leaderboard</h1>
            <p className="text-muted small mb-0">Live points from the {CURRENT_SEASON} season</p>
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
                <thead>
                  <tr className="bg-dark bg-opacity-50 text-uppercase letter-spacing-1 small">
                    <th className="ps-4 py-3">Pos</th>
                    <th className="py-3">Player</th>
                    <th className="text-end py-3">Last Race</th>
                    <th className="text-end pe-4 py-3">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={4} className="text-center py-5"><Spinner animation="border" variant="danger" /></td></tr>
                  ) : leaderboard.length > 0 ? leaderboard.map((entry) => (
                    <React.Fragment key={entry.player}>
                      <tr 
                        onClick={() => setExpandedPlayer(expandedPlayer === entry.player ? null : entry.player)}
                        style={{ height: '70px', verticalAlign: 'middle', cursor: 'pointer' }}
                        className={expandedPlayer === entry.player ? 'bg-danger bg-opacity-10' : ''}
                      >
                        <td className="ps-4 fw-bold text-muted">
                          {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : entry.rank}
                        </td>
                        <td className="fw-bold fs-5">
                          {entry.player}
                          {entry.rank === 1 && !loading && leaderboard.length > 1 && isSeasonComplete && (
                            <span className="ms-2 badge bg-warning text-dark small p-1" style={{ fontSize: '0.6rem' }}>SEASON CHAMPION</span>
                          )}
                        </td>
                        <td className="text-end text-muted small">
                          <span className={entry.lastRacePoints > 0 ? 'text-success fw-bold' : ''}>
                            {entry.lastRacePoints > 0 ? `+${entry.lastRacePoints}` : '-'}
                          </span>
                        </td>
                        <td className="text-end fw-bold pe-4 fs-4 text-white">{entry.points}</td>
                      </tr>
                      {expandedPlayer === entry.player && (
                        <tr className="bg-dark bg-opacity-75">
                          <td colSpan={4} className="p-0 border-0">
                            <div className="p-3 p-md-4 m-2 m-md-3 bg-dark rounded border border-secondary shadow-sm">
                              {entry.breakdown && (
                                <div className="row g-3 text-white mb-4 border-bottom border-secondary pb-4">
                                  <div className="col-md-6 border-md-end border-secondary">
                                    <small className="text-muted text-uppercase d-block mb-2 fw-bold" style={{ fontSize: '0.65rem' }}>Latest Race: P10 Result</small>
                                    <div className="d-flex justify-content-between align-items-center">
                                      <span className="fw-bold fs-5 text-uppercase">{entry.breakdown.p10Driver.replace('_', ' ')}</span>
                                      <span className="badge bg-secondary">P{entry.breakdown.actualP10Pos}</span>
                                    </div>
                                    <div className="mt-2 text-danger fw-bold small">+{entry.breakdown.p10Points} PTS</div>
                                  </div>
                                  <div className="col-md-6 ps-md-4">
                                    <small className="text-muted text-uppercase d-block mb-2 fw-bold" style={{ fontSize: '0.65rem' }}>Latest Race: First DNF Bonus</small>
                                    <div className="mt-1">
                                      {entry.breakdown.dnfPoints > 0 ? (
                                        <div className="text-success fw-bold d-flex align-items-center small">
                                          <span className="fs-5 me-2">🏎️💨</span> Correct (+25 PTS)
                                        </div>
                                      ) : (
                                        <div className="text-muted d-flex align-items-center opacity-50 small">
                                          <span className="fs-5 me-2">🏁</span> Incorrect (+0 PTS)
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}

                              <div className="season-history">
                                <h4 className="h6 text-uppercase fw-bold text-danger letter-spacing-2 mb-3">Season History</h4>
                                {entry.history && entry.history.length > 0 ? (
                                  <div className="table-responsive">
                                    <Table variant="dark" size="sm" className="mb-0 extra-small opacity-75">
                                      <thead>
                                        <tr className="text-muted border-bottom border-secondary">
                                          <th>Race</th>
                                          <th>P10 Pick</th>
                                          <th>DNF Pick</th>
                                          <th className="text-end">PTS</th>
                                          <th className="text-end">Total</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {entry.history.map((h, idx) => (
                                          <tr key={idx} className="border-bottom border-secondary border-opacity-25">
                                            <td className="py-2">Round {h.round}</td>
                                            <td className="py-2 text-uppercase">{h.p10Driver.replace('_', ' ')} <span className="ms-1 text-muted">(P{h.p10Pos})</span></td>
                                            <td className="py-2 text-uppercase">{h.dnfDriver.replace('_', ' ')} {h.dnfCorrect ? <span className="ms-1 text-success">✓</span> : <span className="ms-1 text-muted">✗</span>}</td>
                                            <td className="py-2 text-end fw-bold text-white">+{h.points}</td>
                                            <td className="py-2 text-end text-muted">{h.totalSoFar}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </Table>
                                  </div>
                                ) : (
                                  <p className="text-muted small mb-0">No history available for this season.</p>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )) : (
                    <tr><td colSpan={4} className="text-center py-5 text-muted">No predictions found for this view.</td></tr>
                  )}
                </tbody>
              </Table>
            </div>
          </Col>
        </Row>
      </Container>
    </PullToRefresh>
  );
}
