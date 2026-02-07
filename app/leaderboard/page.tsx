'use client';

import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Table, Navbar, Button, Spinner } from 'react-bootstrap';
import { DRIVERS, LeaderboardEntry, CURRENT_SEASON } from '@/lib/data';
import { calculateTotalPoints } from '@/lib/scoring';
import { fetchCalendar } from '@/lib/api';
import Link from 'next/link';
import AppNavbar from '@/components/AppNavbar';

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);

  useEffect(() => {
    async function calculate() {
      const players = JSON.parse(localStorage.getItem('p10_players') || '[]');
      const races = await fetchCalendar(CURRENT_SEASON);
      const now = new Date();
      const finishedRaces = races.filter(r => new Date(r.date) < now);

      const entries: LeaderboardEntry[] = players.map((player: string) => {
        let totalPoints = 0;
        let lastRacePoints = 0;
        let latestBreakdown = undefined;

        finishedRaces.forEach((race, index) => {
          const raceId = race.round;
          const resultsStr = localStorage.getItem(`results_${raceId}`);
          const predStr = localStorage.getItem(`final_pred_${player}_${raceId}`);

          if (resultsStr && predStr) {
            const results = JSON.parse(resultsStr);
            const prediction = JSON.parse(predStr);

            const actualPosOfPredictedP10 = results.positions[prediction.p10] || 20;
            const p10Pts = calculateTotalPoints(prediction.p10, actualPosOfPredictedP10, "", ""); // Overload trick or separate funcs
            // I should use the separate funcs from scoring.ts
            // Let's re-import them
            
            // Re-calculating with components
            const p10Score = calculateTotalPoints(prediction.p10, actualPosOfPredictedP10, "none", "none");
            const dnfScore = prediction.dnf === results.firstDnf ? 25 : 0;
            const roundPoints = p10Score + dnfScore;

            totalPoints += roundPoints;
            if (index === finishedRaces.length - 1) {
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
          player,
          points: totalPoints,
          lastRacePoints: lastRacePoints,
          breakdown: latestBreakdown
        };
      });

      // Sort and rank
      const sorted = entries.sort((a, b) => b.points - a.points);
      const ranked = sorted.map((entry, index) => ({ ...entry, rank: index + 1 }));
      
      setLeaderboard(ranked);
      setLoading(false);
    }
    calculate();
  }, []);

  return (
    <main>
      <AppNavbar />

      <Container className="mt-4">
        <Row className="mb-4 align-items-center">
          <Col>
            <h1 className="h2 mb-1">Global Leaderboard</h1>
            <p className="text-muted">Dynamic Standings</p>
          </Col>
          <Col xs="auto">
             <Link href="/predict" passHref legacyBehavior>
                <Button className="btn-f1">Predict Now</Button>
             </Link>
          </Col>
        </Row>

        <Row>
          <Col>
            <div className="table-responsive rounded border border-secondary">
              {loading ? (
                <div className="text-center py-5">
                  <Spinner animation="border" variant="danger" />
                </div>
              ) : (
                <Table variant="dark" hover className="mb-0">
                  <thead>
                    <tr>
                      <th className="ps-4">Pos</th>
                      <th>Player</th>
                      <th className="text-end">Last Race</th>
                      <th className="text-end pe-4">Total Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.length > 0 ? leaderboard.map((entry) => (
                      <React.Fragment key={entry.player}>
                        <tr 
                          onClick={() => setExpandedPlayer(expandedPlayer === entry.player ? null : entry.player)}
                          style={{ height: '60px', verticalAlign: 'middle', cursor: 'pointer' }}
                        >
                          <td className="ps-4 fw-bold">
                            {entry.rank === 1 ? '🏆' : entry.rank}
                          </td>
                          <td className="fw-bold">{entry.player}</td>
                          <td className="text-end text-muted">+{entry.lastRacePoints}</td>
                          <td className="text-end fw-bold pe-4 fs-5">{entry.points}</td>
                        </tr>
                        {expandedPlayer === entry.player && entry.breakdown && (
                          <tr className="bg-dark bg-opacity-50">
                            <td colSpan={4} className="p-4 border-start border-danger border-4">
                              <div className="row">
                                <div className="col-md-6 border-end border-secondary">
                                  <small className="text-muted text-uppercase d-block">P10 Pick Breakdown</small>
                                  <div className="d-flex justify-content-between mt-2">
                                    <span>Pick: <strong className="text-white">{entry.breakdown.p10Driver}</strong></span>
                                    <span>Result: <strong className="text-white">P{entry.breakdown.actualP10Pos}</strong></span>
                                  </div>
                                  <div className="text-danger fw-bold mt-1">+{entry.breakdown.p10Points} pts</div>
                                </div>
                                <div className="col-md-6 ps-4">
                                  <small className="text-muted text-uppercase d-block">First DNF Bonus</small>
                                  <div className="mt-2">
                                    {entry.breakdown.dnfPoints > 0 ? (
                                      <span className="text-success fw-bold">✅ Correct (+25 pts)</span>
                                    ) : (
                                      <span className="text-muted">❌ Incorrect (+0 pts)</span>
                                    )}
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
                          No predictions submitted yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </Table>
              )}
            </div>
          </Col>
        </Row>
      </Container>
    </main>
  );
}
