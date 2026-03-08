'use client';

import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Table, Card, Spinner, Badge } from 'react-bootstrap';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { fetchCalendar, fetchRaceResults, getFirstDnfDriver, ApiCalendarRace } from '@/lib/api';
import { CURRENT_SEASON, LeaderboardEntry } from '@/lib/data';
import { calculateP10Points } from '@/lib/scoring';
import AppNavbar from '@/components/AppNavbar';

interface SimplifiedResults {
  positions: { [driverId: string]: number };
  firstDnf: string | null;
}

export default function LeagueDetailPage() {
  const params = useParams();
  const leagueId = params.id as string;
  
  const [leagueName, setLeagueName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    async function loadLeague() {
      setLoading(true);
      
      // 1. Fetch League Info
      const { data: league, error: leagueError } = await supabase
        .from('leagues')
        .select('name, invite_code')
        .eq('id', leagueId)
        .single();

      if (leagueError) {
        console.error(leagueError);
        setLoading(false);
        return;
      }
      setLeagueName(league.name);
      setInviteCode(league.invite_code);

      // 2. Fetch Race Results (Cached)
      const races = await fetchCalendar(CURRENT_SEASON);
      const raceResultsMap: { [round: string]: SimplifiedResults } = {};
      
      await Promise.all(races.map(async (race: ApiCalendarRace) => {
        const round = race.round;
        const resultsData = localStorage.getItem(`results_${round}`);
        
        if (!resultsData) {
          const apiResults = await fetchRaceResults(CURRENT_SEASON, parseInt(round));
          if (apiResults) {
            const firstDnfDriver = getFirstDnfDriver(apiResults);
            const simplified = {
              positions: apiResults.Results.reduce((acc: { [key: string]: number }, r) => {
                acc[r.Driver.driverId] = parseInt(r.position);
                return acc;
              }, {}),
              firstDnf: firstDnfDriver ? firstDnfDriver.driverId : null
            };
            localStorage.setItem(`results_${round}`, JSON.stringify(simplified));
            raceResultsMap[round] = simplified;
          }
        } else {
          raceResultsMap[round] = JSON.parse(resultsData);
        }
      }));

      // 3. Fetch League Members and their predictions
      const { data: members } = await supabase
        .from('league_members')
        .select('profiles(id, username)')
        .eq('league_id', leagueId);

      const memberIds = members?.map((m: any) => m.profiles.id) || [];
      const { data: predictions } = await supabase
        .from('predictions')
        .select('*')
        .in('user_id', memberIds);

      // 4. Calculate Scores
      const entries: LeaderboardEntry[] = (members || []).map((m: any) => {
        const user = m.profiles;
        let totalPoints = 0;
        let lastRacePoints = 0;
        let latestBreakdown = undefined;

        const userPreds = predictions?.filter(p => p.user_id === user.id) || [];
        const sortedRounds = Object.keys(raceResultsMap).sort((a, b) => parseInt(a) - parseInt(b));

        sortedRounds.forEach((round, index) => {
          const results = raceResultsMap[round];
          const dbMatch = userPreds.find(dp => dp.race_id === `${CURRENT_SEASON}_${round}`);
          
          if (results && dbMatch) {
            const prediction = { p10: dbMatch.p10_driver_id, dnf: dbMatch.dnf_driver_id };
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
          player: user.username,
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
    loadLeague();
  }, [supabase, leagueId]);

  return (
    <main>
      <AppNavbar />
      <Container className="mt-4 mb-5">
        {loading ? (
          <div className="text-center py-5"><Spinner animation="border" variant="danger" /></div>
        ) : (
          <>
            <Row className="mb-4 align-items-end">
              <Col>
                <Badge bg="danger" className="text-uppercase mb-2 letter-spacing-1">League Dashboard</Badge>
                <h1 className="h2 fw-bold text-uppercase mb-0">{leagueName}</h1>
              </Col>
              <Col xs="auto" className="text-end">
                <small className="text-muted text-uppercase d-block mb-1 fw-bold">Invite Code</small>
                <code className="fs-4 text-white bg-dark px-3 py-1 rounded border border-secondary">{inviteCode}</code>
              </Col>
            </Row>

            <Row>
              <Col>
                <Card className="border-secondary shadow-sm">
                  <Card.Header className="bg-dark border-secondary py-3 d-flex justify-content-between align-items-center">
                    <h3 className="h6 mb-0 text-uppercase fw-bold text-danger letter-spacing-1">League Standings</h3>
                    <small className="text-muted">{leaderboard.length} Members</small>
                  </Card.Header>
                  <div className="table-responsive">
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
                        {leaderboard.map((entry) => (
                          <React.Fragment key={entry.player}>
                            <tr 
                              onClick={() => setExpandedPlayer(expandedPlayer === entry.player ? null : entry.player)}
                              style={{ height: '70px', verticalAlign: 'middle', cursor: 'pointer' }}
                              className={expandedPlayer === entry.player ? 'bg-danger bg-opacity-10' : ''}
                            >
                              <td className="ps-4 fw-bold text-muted">
                                {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : entry.rank}
                              </td>
                              <td className="fw-bold fs-5">{entry.player}</td>
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
                        ))}
                      </tbody>
                    </Table>
                  </div>
                </Card>
              </Col>
            </Row>
          </>
        )}
      </Container>
    </main>
  );
}
