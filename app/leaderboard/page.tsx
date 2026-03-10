'use client';

import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Table, Button, Spinner, ButtonGroup } from 'react-bootstrap';
import { LeaderboardEntry, CURRENT_SEASON } from '@/lib/data';
import { calculateP10Points } from '@/lib/scoring';
import { fetchCalendar, fetchRaceResults, getFirstDnfDriver, ApiCalendarRace, DbPrediction } from '@/lib/api';
import { createClient } from '@/lib/supabase/client';
// import AppNavbar from '@/components/AppNavbar'; // Removed

interface SimplifiedResults {
  positions: { [driverId: string]: number };
  firstDnf: string | null;
}

interface LeaderboardPlayer {
  username: string;
  userId?: string;
  isLocal: boolean;
  dbPredictions?: DbPrediction[];
}

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);
  const [view, setView] = useState<'global' | 'local'>('global');

  const supabase = createClient();

  useEffect(() => {
    async function calculate() {
      setLoading(true);
      
      const races = await fetchCalendar(CURRENT_SEASON);
      const raceResultsMap: { [round: string]: SimplifiedResults } = {};
      
      await Promise.all(races.map(async (race: ApiCalendarRace) => {
        const round = race.round;
        const resultsData = localStorage.getItem(`results_${CURRENT_SEASON}_${round}`);
        
        if (!resultsData) {
          const apiResults = await fetchRaceResults(CURRENT_SEASON, parseInt(round));
          if (apiResults) {
            const firstDnfDriver = getFirstDnfDriver(apiResults);
            const simplifiedResults: SimplifiedResults = {
              positions: apiResults.Results.reduce((acc: { [key: string]: number }, r) => {
                acc[r.Driver.driverId] = parseInt(r.position);
                return acc;
              }, {}),
              firstDnf: firstDnfDriver ? firstDnfDriver.driverId : null
            };
            localStorage.setItem(`results_${CURRENT_SEASON}_${round}`, JSON.stringify(simplifiedResults));
            raceResultsMap[round] = simplifiedResults;
          }
        } else {
          raceResultsMap[round] = JSON.parse(resultsData);
        }
      }));

      let playersData: LeaderboardPlayer[] = [];

      if (view === 'global') {
        const { data: profiles } = await supabase.from('profiles').select('id, username');
        const { data: predictions } = await supabase.from('predictions').select('*') as { data: DbPrediction[] | null };

        if (profiles) {
          playersData = profiles.map(p => ({ 
            username: p.username, 
            userId: p.id, 
            isLocal: false,
            dbPredictions: predictions?.filter(pred => pred.user_id === p.id) || []
          }));
        }
      } else {
        const localPlayers: string[] = JSON.parse(localStorage.getItem('p10_players') || '[]');
        playersData = localPlayers.map(p => ({ username: p, isLocal: true }));
      }

      const entries: LeaderboardEntry[] = playersData.map((player) => {
        let totalPoints = 0;
        let lastRacePoints = 0;
        let latestBreakdown = undefined;

        const sortedRounds = Object.keys(raceResultsMap).sort((a, b) => parseInt(a) - parseInt(b));

        sortedRounds.forEach((round, index) => {
          const results = raceResultsMap[round];
          let prediction: { p10: string, dnf: string } | null = null;

          if (player.isLocal) {
            const predStr = localStorage.getItem(`final_pred_${CURRENT_SEASON}_${player.username}_${round}`);
            if (predStr) prediction = JSON.parse(predStr);
          } else if (player.dbPredictions) {
            const dbMatch = player.dbPredictions.find((dp) => dp.race_id === `${CURRENT_SEASON}_${round}`);
            if (dbMatch) {
              prediction = { p10: dbMatch.p10_driver_id, dnf: dbMatch.dnf_driver_id };
            }
          }

          if (results && prediction) {
            const actualPosOfPredictedP10 = results.positions[prediction.p10] || 20;
            const p10Score = calculateP10Points(actualPosOfPredictedP10);
            const dnfScore = (prediction.dnf && prediction.dnf === results.firstDnf) ? 25 : 0;
            const roundPoints = p10Score + dnfScore;

            totalPoints += roundPoints;
            
            if (index === sortedRounds.length - 1) {
              lastRacePoints = roundPoints;
              latestBreakdown = {
                p10Points: p10Score,
                dnfPoints: dnfScore,
                p10Driver: prediction.p10,
                actualP10Pos: actualPosOfPredictedP10
              };
            }
          }
        });

        return {
          rank: 0,
          player: player.username,
          points: totalPoints,
          lastRacePoints: lastRacePoints,
          breakdown: latestBreakdown
        };
      });

      const sorted = entries.sort((a, b) => b.points - a.points);
      const ranked = sorted.map((entry, index) => ({ ...entry, rank: index + 1 }));
      
      setLeaderboard(ranked);
      setLoading(false);
    }
    calculate();
  }, [supabase, view]);

  return (
    <>
      <Container className="mt-4">
        <Row className="mb-4 align-items-center">
          <Col>
            <h1 className="h2 mb-1 text-uppercase fw-bold letter-spacing-1">Leaderboard</h1>
            <p className="text-muted small mb-0">Live points from the {CURRENT_SEASON} season</p>
          </Col>
          <Col xs="auto">
            <ButtonGroup className="bg-dark rounded border border-secondary p-1">
              <Button 
                variant={view === 'global' ? 'danger' : 'dark'} 
                size="sm" 
                onClick={() => setView('global')}
                className="rounded px-3"
              >
                GLOBAL
              </Button>
              <Button 
                variant={view === 'local' ? 'danger' : 'dark'} 
                size="sm" 
                onClick={() => setView('local')}
                className="rounded px-3"
              >
                GUESTS
              </Button>
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
                          {entry.rank === 1 && !loading && leaderboard.length > 1 && (
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
                      {expandedPlayer === entry.player && entry.breakdown && (
                        <tr className="bg-dark bg-opacity-75">
                          <td colSpan={4} className="p-0 border-0">
                            <div className="p-4 border-start border-danger border-4 m-3 bg-dark rounded border border-secondary shadow-sm">
                              <div className="row g-4">
                                <div className="col-md-6 border-end border-secondary">
                                  <small className="text-muted text-uppercase d-block mb-2 fw-bold">P10 Pick Result</small>
                                  <div className="d-flex justify-content-between align-items-center">
                                    <span className="text-white fw-bold fs-5">{entry.breakdown.p10Driver.toUpperCase()}</span>
                                    <span className="badge bg-secondary">P{entry.breakdown.actualP10Pos}</span>
                                  </div>
                                  <div className="mt-2 text-danger fw-bold">+{entry.breakdown.p10Points} PTS</div>
                                </div>
                                <div className="col-md-6 ps-md-4">
                                  <small className="text-muted text-uppercase d-block mb-2 fw-bold">First DNF Bonus</small>
                                  <div className="mt-1">
                                    {entry.breakdown.dnfPoints > 0 ? (
                                      <div className="text-success fw-bold d-flex align-items-center">
                                        <span className="fs-4 me-2">🏎️💨</span> Correct (+25 PTS)
                                      </div>
                                    ) : (
                                      <div className="text-muted d-flex align-items-center opacity-50">
                                        <span className="fs-4 me-2">🏁</span> Incorrect (+0 PTS)
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )) : (
                    <tr>
                      <td colSpan={4} className="text-center py-5 text-muted">
                        No predictions found for this view.
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </div>
          </Col>
        </Row>
      </Container>
    </>
  );
}
