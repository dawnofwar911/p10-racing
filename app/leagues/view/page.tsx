'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { Container, Row, Col, Table, Card, Spinner, Badge, Button } from 'react-bootstrap';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { fetchCalendar, fetchRaceResults, getFirstDnfDriver, ApiCalendarRace, DbPrediction } from '@/lib/api';
import { CURRENT_SEASON, LeaderboardEntry } from '@/lib/data';
import { calculateSeasonPoints } from '@/lib/scoring';
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
  const [isSeasonComplete, setIsSeasonComplete] = useState(false);
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

  const loadLeague = useCallback(async () => {
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
    
    let resultsFoundCount = 0;
    await Promise.all(races.map(async (race: ApiCalendarRace) => {
      const round = race.round;
      const raceDate = new Date(`${race.date}T${race.time || '00:00:00Z'}`);
      const verifiedMatch = verifiedData?.find(v => v.id === `${CURRENT_SEASON}_${round}`);
      
      if (verifiedMatch) {
        raceResultsMap[round] = { ...(verifiedMatch.data as SimplifiedResults), date: raceDate };
        resultsFoundCount++;
      } else {
        const resultsData = localStorage.getItem(`results_${CURRENT_SEASON}_${round}`);
        if (resultsData) {
          raceResultsMap[round] = { ...JSON.parse(resultsData), date: raceDate };
          resultsFoundCount++;
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
            resultsFoundCount++;
          }
        }
      }
    }));

    setIsSeasonComplete(resultsFoundCount > 0 && resultsFoundCount === races.length);

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
      const userPreds = predictions?.filter(p => p.user_id === user.id) || [];
      const playerPredictions: { [round: string]: { p10: string, dnf: string } | null } = {};
      
      userPreds.forEach(p => {
        const round = p.race_id.split('_')[1];
        playerPredictions[round] = { p10: p.p10_driver_id, dnf: p.dnf_driver_id };
      });

      const { totalPoints, lastRacePoints, latestBreakdown, history } = calculateSeasonPoints(
        playerPredictions,
        raceResultsMap,
        leagueCreatedAt
      );

      return {
        rank: 0,
        player: user.username,
        points: totalPoints,
        lastRacePoints: lastRacePoints,
        breakdown: latestBreakdown,
        history: history
      };
    });

    const sorted = entries.sort((a, b) => b.points - a.points);
    const ranked = sorted.map((entry, index) => ({ ...entry, rank: index + 1 }));
    
    setLeaderboard(ranked);
    setLoading(false);
  }, [supabase, leagueId]);

  useEffect(() => {
    loadLeague();
  }, [loadLeague]);

  // Real-time subscription
  useEffect(() => {
    if (!leagueId) return;

    const channel = supabase
      .channel(`league-${leagueId}-realtime`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'verified_results' },
        () => loadLeague()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'predictions' },
        () => loadLeague()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'league_members', filter: `league_id=eq.${leagueId}` },
        () => loadLeague()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, leagueId, loadLeague]);

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
                              {entry.rank === 1 && !loading && leaderboard.length > 1 && isSeasonComplete && (
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
                          {expandedPlayer === entry.player && (
                            <tr className="bg-dark bg-opacity-75">
                              <td colSpan={4} className="p-0 border-0">
                                <div className="p-3 p-md-4 m-2 m-md-3 bg-dark rounded border border-secondary shadow-sm">
                                  {entry.breakdown && (
                                    <div className="row g-3 text-white mb-4 border-bottom border-secondary pb-4">
                                      <div className="col-md-6 border-end-md border-secondary">
                                        <small className="text-muted text-uppercase d-block mb-2 fw-bold" style={{ fontSize: '0.65rem' }}>Latest Race: P10 Result</small>
                                        <div className="d-flex justify-content-between align-items-center">
                                          <span className="fw-bold fs-5 text-uppercase">{entry.breakdown.p10Driver.replace('_', ' ')}</span>
                                          <Badge bg="secondary">P{entry.breakdown.actualP10Pos}</Badge>
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
                                                <td className="py-2 text-uppercase">
                                                  {h.p10Driver.replace('_', ' ')} 
                                                  <span className="ms-1 text-muted">(P{h.p10Pos})</span>
                                                </td>
                                                <td className="py-2 text-uppercase">
                                                  {h.dnfDriver.replace('_', ' ')}
                                                  {h.dnfCorrect ? <span className="ms-1 text-success">✓</span> : <span className="ms-1 text-muted">✗</span>}
                                                </td>
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
