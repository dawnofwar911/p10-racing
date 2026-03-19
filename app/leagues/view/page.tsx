'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { Container, Row, Col, Card, Table, Spinner, Badge, Button } from 'react-bootstrap';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { fetchCalendar } from '@/lib/api';
import { DbPrediction } from '@/lib/types';
import { CURRENT_SEASON, LeaderboardEntry } from '@/lib/data';
import { calculateSeasonPoints } from '@/lib/scoring';
import { fetchAllSimplifiedResults } from '@/lib/results';
import { isTestAccount } from '@/lib/utils/profiles';
import LoadingView from '@/components/LoadingView';
import LeaderboardTable from '@/components/LeaderboardTable';
import { Share } from '@capacitor/share';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Users } from 'lucide-react';

const supabase = createClient();

function LeagueDetailContent() {
  const searchParams = useSearchParams();
  const leagueId = searchParams.get('id');
  
  const [leagueName, setLeagueName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSeasonComplete, setIsSeasonComplete] = useState(false);
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);

  const handleShare = async () => {
    Haptics.impact({ style: ImpactStyle.Medium });
    try {
      await Share.share({
        title: `Join my F1 League: ${leagueName}`,
        text: `Predict the midfield and compete in my P10 Racing league! Join "${leagueName}" using invite code: ${inviteCode}`,
        url: `https://p10racing.app/leagues?join=${inviteCode}`,
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
    const raceResultsMap = await fetchAllSimplifiedResults();
    const races = await fetchCalendar(CURRENT_SEASON);
    const resultsFoundCount = Object.keys(raceResultsMap).length;

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

    const { data: { session } } = await supabase.auth.getSession();
    const currentUserId = session?.user?.id;

    const members = (profilesData || []).filter(p => {
      return !isTestAccount(p.username) || p.id === currentUserId;
    });

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
  }, [leagueId]);

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
  }, [leagueId, loadLeague]);

  if (!leagueId) {
    return <Container className="mt-5 text-center text-white"><p>No league selected.</p></Container>;
  }

  return (
    <Container className="mt-4 mb-5">
      {loading ? (
        <div className="text-center py-5"><Spinner animation="border" variant="danger" /></div>
      ) : (
        <>
          <Row className="mb-4 align-items-center g-3">
            <Col xs={12} md={7}>
              <div className="d-flex align-items-center">
                <div className="bg-danger rounded-circle p-2 me-3 d-flex align-items-center justify-content-center shadow-sm" style={{ width: '45px', height: '45px' }}>
                  <Users size={24} className="text-white" />
                </div>
                <div>
                  <h1 className="h2 mb-0 f1-page-title text-white">{leagueName}</h1>
                  <small className="text-muted text-uppercase fw-bold letter-spacing-1" style={{ fontSize: '0.65rem' }}>League Leaderboard</small>
                </div>
              </div>
            </Col>
            <Col xs={12} md={5} className="text-md-end">
              <div className="d-inline-flex align-items-center gap-2 bg-dark p-1 rounded border border-secondary shadow-sm">
                <code className="ps-3 text-white fw-bold letter-spacing-1" style={{ fontSize: '0.9rem' }}>{inviteCode}</code>
                <Button variant="danger" size="sm" className="rounded px-3 fw-bold text-uppercase" style={{ fontSize: '0.7rem' }} onClick={handleShare}>
                  SHARE
                </Button>
              </div>
            </Col>
          </Row>

          <Row>
            <Col>
              <LeaderboardTable 
                entries={leaderboard} 
                loading={loading} 
                isSeasonComplete={isSeasonComplete}
                emptyMessage="No members in this league yet."
              />
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
