'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { Container, Row, Col, Table, Card, Spinner, Badge, Button } from 'react-bootstrap';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { fetchCalendar, fetchRaceResults, getFirstDnfDriver, ApiCalendarRace, DbPrediction } from '@/lib/api';
import { CURRENT_SEASON, LeaderboardEntry } from '@/lib/data';
import { calculateP10Points } from '@/lib/scoring';
import LoadingView from '@/components/LoadingView';
import { Share } from '@capacitor/share';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

interface SimplifiedResults {
  positions: { [driverId: string]: number };
  firstDnf: string | null;
}

function LeagueDetailContent() {
  const searchParams = useSearchParams();
  const leagueId = searchParams.get('id');
  
  const [leagueName, setLeagueName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);

  const supabase = createClient();

  const handleShare = async () => {
    Haptics.impact({ style: ImpactStyle.Medium });
    try {
      await Share.share({
        title: `Join my F1 League: ${leagueName}`,
        text: `Predict the midfield and compete in my P10 Racing league! Join "${leagueName}" using invite code: ${inviteCode}`,
        url: `https://p10-racing.vercel.app/leagues?join=${inviteCode}`,
        dialogTitle: 'Invite Friends to League',
      });
    } catch (error) {
      console.error('Error sharing', error);
    }
  };

  useEffect(() => {
    async function loadLeague() {
      if (!leagueId) return;
      setLoading(true);
      
      // 1. Fetch League Info
      const { data: league, error: leagueError } = await supabase
        .from('leagues')
        .select('name, invite_code, created_at')
        .eq('id', leagueId)
        .single();

      if (leagueError) {
        console.error(leagueError);
        setLoading(false);
        return;
      }
      setLeagueName(league.name);
      setInviteCode(league.invite_code);
      const leagueCreatedAt = new Date(league.created_at);

      // 2. Fetch Race Results (Official Supabase -> API/Cache Fallback)
      const races = await fetchCalendar(CURRENT_SEASON);
      const raceResultsMap: { [round: string]: SimplifiedResults & { date: Date } } = {};
      
      const { data: verifiedData } = await supabase.from('verified_results').select('*');
      
      await Promise.all(races.map(async (race: ApiCalendarRace) => {
        const round = race.round;
        const raceDate = new Date(`${race.date}T${race.time || '00:00:00Z'}`);
        const verifiedMatch = verifiedData?.find(v => v.id === `${CURRENT_SEASON}_${round}`);
        
        if (verifiedMatch) {
          raceResultsMap[round] = { ...(verifiedMatch.data as SimplifiedResults), date: raceDate };
        } else {
          const resultsData = localStorage.getItem(`results_${CURRENT_SEASON}_${round}`);
          if (resultsData) {
            raceResultsMap[round] = { ...JSON.parse(resultsData), date: raceDate };
          } else {
            const apiResults = await fetchRaceResults(CURRENT_SEASON, parseInt(round));
            if (apiResults) {
              const firstDnfDriver = getFirstDnfDriver(apiResults);
              const simplified = {
                positions: apiResults.Results.reduce((acc: { [key: string]: number }, r) => {
                  acc[r.Driver.driverId] = parseInt(r.position);
                  return acc;
                }, {}),
                firstDnf: firstDnfDriver ? firstDnfDriver.driverId : null,
                date: raceDate
              };
              raceResultsMap[round] = simplified;
            }
          }
        }
      }));

      // 3. Fetch League Members and their profiles
      const { data: membersListData, error: membersError } = await supabase
        .from('league_members')
        .select('user_id')
        .eq('league_id', leagueId);
      
      if (membersError) {
        console.error('Error fetching members list:', membersError);
      }

      const memberIds = membersListData?.map(m => m.user_id) || [];
      
      // Fetch Profiles for those members
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', memberIds);

      const members = profilesData || [];

      // Fetch predictions for those members
      const { data: predictionsData } = await supabase
        .from('predictions')
        .select('*')
        .in('user_id', memberIds);
      
      const predictions = predictionsData as DbPrediction[];

      // 4. Calculate Scores
      const entries: LeaderboardEntry[] = members.map((user) => {
        let totalPoints = 0;
        let lastRacePoints = 0;
        let latestBreakdown = undefined;

        const userPreds = predictions?.filter(p => p.user_id === user.id) || [];
        const sortedRounds = Object.keys(raceResultsMap).sort((a, b) => parseInt(a) - parseInt(b));

        sortedRounds.forEach((round, index) => {
          const results = raceResultsMap[round];
          
          // ONLY count scores if the race happened AFTER the league was created
          // We allow some buffer (12 hours) if the race time is exactly 00:00:00Z to avoid timezone issues
          const isRaceTimeDefault = results.date.toISOString().includes('T00:00:00.000Z');
          const comparisonDate = isRaceTimeDefault ? new Date(results.date.getTime() + 24 * 60 * 60 * 1000) : results.date;

          if (comparisonDate < leagueCreatedAt) return;

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

  if (!leagueId) {
    return <Container className="mt-5 text-center text-white"><p>No league selected.</p></Container>;
  }

  return (
    <Container className="mt-4 mb-5">
      {loading ? (
        <div className="text-center py-5"><Spinner animation="border" variant="danger" /></div>
      ) : (
        <>
          <Row className="mb-4 align-items-end">
            <Col>
              <Badge bg="danger" className="text-uppercase mb-2 letter-spacing-1 fw-bold">League Dashboard</Badge>
              <h1 className="h2 fw-bold text-uppercase mb-0 text-white">{leagueName}</h1>
            </Col>
            <Col xs="auto" className="text-end">
              <small className="text-muted text-uppercase d-block mb-1 fw-bold">Invite Code</small>
              <div className="d-flex align-items-center gap-2">
                <code className="fs-4 text-white bg-dark px-3 py-1 rounded border border-secondary">{inviteCode}</code>
                <Button variant="outline-danger" size="sm" className="rounded-pill px-3 fw-bold" onClick={handleShare}>
                  SHARE
                </Button>
              </div>
            </Col>
          </Row>

          <Row>
            <Col>
              <Card className="border-secondary shadow-lg">
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
                            <td className="fw-bold fs-5 text-white">
                              {entry.player}
                              {entry.rank === 1 && !loading && leaderboard.length > 1 && (
                                <span className="ms-2 badge bg-warning text-dark small p-1" style={{ fontSize: '0.6rem' }}>LEAGUE CHAMPION</span>
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
                                  <div className="row g-4 text-white">
                                    <div className="col-md-6 border-end border-secondary">
                                      <small className="text-muted text-uppercase d-block mb-2 fw-bold">P10 Pick Result</small>
                                      <div className="d-flex justify-content-between align-items-center">
                                        <span className="fw-bold fs-5">{entry.breakdown.p10Driver.toUpperCase()}</span>
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
  );
}

export default function LeagueDetailPage() {
  return (
    <>
      <Suspense fallback={<LoadingView />}>
        <LeagueDetailContent />
      </Suspense>
    </>
  );
}
