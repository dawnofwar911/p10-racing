'use client';

import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Table, Navbar, Button, Spinner } from 'react-bootstrap';
import { LeaderboardEntry, CURRENT_SEASON } from '@/lib/data';
import { calculateTotalPoints } from '@/lib/scoring';
import { fetchCalendar, fetchRaceResults, getFirstDnfDriver } from '@/lib/api';
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
      
      // We need results for all races that have them
      const raceResultsMap: { [round: string]: any } = {};
      await Promise.all(races.map(async (race) => {
        const round = race.round;
        let resultsData = localStorage.getItem(`results_${round}`);
        
        if (!resultsData) {
          // Fetch and cache if not in localStorage
          const apiResults = await fetchRaceResults(CURRENT_SEASON, parseInt(round));
          if (apiResults) {
            const firstDnfDriver = getFirstDnfDriver(apiResults);
            const simplifiedResults = {
              positions: apiResults.Results.reduce((acc: any, r: any) => {
                acc[r.Driver.driverId] = parseInt(r.position);
                return acc;
              }, {}),
              firstDnf: firstDnfDriver ? firstDnfDriver.driverId : null
            };
            localStorage.setItem(`results_${round}`, JSON.stringify(simplifiedResults));
            raceResultsMap[round] = simplifiedResults;
          }
        } else {
          raceResultsMap[round] = JSON.parse(resultsData);
        }
      }));

      const entries: LeaderboardEntry[] = players.map((player: string) => {
        let totalPoints = 0;
        let lastRacePoints = 0;
        let latestBreakdown = undefined;

        // Sort rounds to find the "last race" correctly
        const sortedRounds = Object.keys(raceResultsMap).sort((a, b) => parseInt(a) - parseInt(b));

        sortedRounds.forEach((round, index) => {
          const results = raceResultsMap[round];
          const predStr = localStorage.getItem(`final_pred_${player}_${round}`);

          if (results && predStr) {
            const prediction = JSON.parse(predStr);

            const actualPosOfPredictedP10 = results.positions[prediction.p10] || 20;
            const p10Score = calculateTotalPoints(prediction.p10, actualPosOfPredictedP10, "none", "none");
            const dnfScore = (prediction.dnf && prediction.dnf === results.firstDnf) ? 25 : 0;
            const roundPoints = p10Score + dnfScore;

            totalPoints += roundPoints;
            
            // Mark as last race points if it's the highest round we have results for
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
            <h1 className="h2 mb-1 text-uppercase fw-bold">Leaderboard</h1>
            <p className="text-muted small mb-0">Total points across all completed races</p>
          </Col>
          <Col xs="auto">
             <Link href="/predict" passHref legacyBehavior>
                <Button className="btn-f1 px-4">Make Predictions</Button>
             </Link>
          </Col>
        </Row>

        <Row>
          <Col>
            <div className="table-responsive rounded border border-secondary shadow-sm">
              <Table variant="dark" hover className="mb-0">
                <thead>
                  <tr className="bg-dark bg-opacity-50">
                    <th className="ps-4 py-3">Pos</th>
                    <th className="py-3">Player</th>
                    <th className="text-end py-3">Last Race</th>
                    <th className="text-end pe-4 py-3">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.length > 0 ? leaderboard.map((entry) => (
                    <React.Fragment key={entry.player}>
                      <tr 
                        onClick={() => setExpandedPlayer(expandedPlayer === entry.player ? null : entry.player)}
                        style={{ height: '70px', verticalAlign: 'middle', cursor: 'pointer' }}
                        className={expandedPlayer === entry.player ? 'bg-danger bg-opacity-10' : ''}
                      >
                        <td className="ps-4 fw-bold">
                          {entry.rank === 1 ? '🏆' : entry.rank}
                        </td>
                        <td className="fw-bold fs-5">{entry.player}</td>
                        <td className="text-end text-muted small">
                          <span className={entry.lastRacePoints > 0 ? 'text-success' : ''}>
                            +{entry.lastRacePoints}
                          </span>
                        </td>
                        <td className="text-end fw-bold pe-4 fs-4 text-white">{entry.points}</td>
                      </tr>
                      {expandedPlayer === entry.player && entry.breakdown && (
                        <tr className="bg-dark bg-opacity-75">
                          <td colSpan={4} className="p-0 border-0">
                            <div className="p-4 border-start border-danger border-4 m-3 bg-dark rounded border border-secondary">
                              <div className="row g-4">
                                <div className="col-md-6 border-end border-secondary">
                                  <small className="text-muted text-uppercase d-block mb-2">P10 Pick Result</small>
                                  <div className="d-flex justify-content-between align-items-center">
                                    <span className="text-white fw-bold">{entry.breakdown.p10Driver.toUpperCase()}</span>
                                    <span className="badge bg-secondary">P{entry.breakdown.actualP10Pos}</span>
                                  </div>
                                  <div className="mt-2 text-danger fw-bold">+{entry.breakdown.p10Points} PTS</div>
                                </div>
                                <div className="col-md-6 ps-md-4">
                                  <small className="text-muted text-uppercase d-block mb-2">First DNF Bonus</small>
                                  <div className="mt-1">
                                    {entry.breakdown.dnfPoints > 0 ? (
                                      <div className="text-success fw-bold d-flex align-items-center">
                                        <span className="fs-4 me-2">✅</span> Correct (+25 PTS)
                                      </div>
                                    ) : (
                                      <div className="text-muted d-flex align-items-center">
                                        <span className="fs-4 me-2">❌</span> Incorrect (+0 PTS)
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
                        No predictions submitted yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </div>
          </Col>
        </Row>
      </Container>
    </main>
  );
}
