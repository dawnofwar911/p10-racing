'use client';

import React, { useState, useEffect, useCallback, Suspense, useRef } from 'react';
import { Spinner, Badge } from 'react-bootstrap';
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
import { triggerLightHaptic, triggerMediumHaptic } from '@/lib/utils/haptics';
import { Users, ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import HapticButton from '@/components/HapticButton';
import SwipeablePageLayout from '@/components/SwipeablePageLayout';

const supabase = createClient();

function LeagueDetailContent() {
  const searchParams = useSearchParams();
  const leagueId = searchParams.get('id');
  const router = useRouter();
  const mountedRef = useRef(true);
  
  const [leagueName, setLeagueName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSeasonComplete, setIsSeasonComplete] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const handleShare = async () => {
    triggerMediumHaptic();
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

  const loadLeague = useCallback(async (quiet = false) => {
    if (!leagueId) return;
    if (!quiet && mountedRef.current) setLoading(true);
    
    try {
      // 1. Fetch League Info
      const { data: league, error: leagueError } = await supabase
        .from('leagues')
        .select('name, invite_code, created_at')
        .eq('id', leagueId)
        .single();

      if (leagueError || !league) {
        console.error(leagueError);
        if (mountedRef.current) setLoading(false);
        return;
      }
      if (mountedRef.current) {
        setLeagueName(league.name);
        setInviteCode(league.invite_code);
      }
      const leagueCreatedAt = new Date(league.created_at);

      // 2. Fetch Race Results
      const raceResultsMap = await fetchAllSimplifiedResults();
      const races = await fetchCalendar(CURRENT_SEASON);
      const resultsFoundCount = Object.keys(raceResultsMap).length;

      if (mountedRef.current) setIsSeasonComplete(resultsFoundCount > 0 && resultsFoundCount === races.length);

      // 3. Fetch League Members
      const { data: membersListData } = await supabase
        .from('league_members')
        .select('user_id')
        .eq('league_id', leagueId);
      
      const memberIds = membersListData?.map(m => m.user_id) || [];
      
      // Fetch Profiles and Predictions in parallel
      const [
        { data: profilesData },
        { data: predictionsData },
        { data: { session } }
      ] = await Promise.all([
        supabase.from('profiles').select('id, username').in('id', memberIds),
        supabase.from('predictions').select('*').in('user_id', memberIds),
        supabase.auth.getSession()
      ]);

      const currentUserId = session?.user?.id;
      const members = (profilesData || []).filter(p => {
        return !isTestAccount(p.username) || p.id === currentUserId;
      });

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
      
      if (mountedRef.current) {
        setLeaderboard(ranked);
        setLoading(false);
      }
    } catch (err) {
      console.error('Error loading league:', err);
      if (mountedRef.current) setLoading(false);
    }
  }, [leagueId]);

  useEffect(() => {
    loadLeague();
  }, [loadLeague]);

  // Real-time subscription
  useEffect(() => {
    if (!leagueId) return;

    const channel = supabase
      .channel(`league-${leagueId}-realtime`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'verified_results' }, () => loadLeague(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'predictions' }, () => loadLeague(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'league_members', filter: `league_id=eq.${leagueId}` }, () => loadLeague(true))
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [leagueId, loadLeague]);

  if (!leagueId) {
    return (
      <SwipeablePageLayout
        title="Error"
        icon={<ChevronLeft size={24} className="text-white" />}
        activeTab="error"
        onTabChange={() => {}}
        tabs={[{ id: 'error', label: 'Missing League' }]}
      >
        <div className="text-center py-5 text-white"><p>No league selected.</p></div>
      </SwipeablePageLayout>
    );
  }

  const headerIcon = (
    <div className="d-flex align-items-center">
      <HapticButton 
        variant="link" 
        className="text-white p-0 me-2 opacity-75 hover-opacity-100 border-0"
        onClick={() => { triggerLightHaptic(); router.push('/leagues'); }}
      >
        <ChevronLeft size={28} />
      </HapticButton>
      <Users size={24} className="text-white" />
    </div>
  );

  const invitePill = (
    <div className="d-inline-flex align-items-center gap-2 bg-dark p-1 rounded-pill border border-secondary shadow-sm ps-3">
      <code className="text-white fw-bold letter-spacing-1" style={{ fontSize: '0.9rem' }}>{inviteCode}</code>
      <HapticButton variant="danger" className="rounded-pill px-4 py-2 fw-bold text-uppercase d-flex align-items-center" style={{ fontSize: '0.75rem' }} onClick={handleShare}>
        SHARE
      </HapticButton>
    </div>
  );

  return (
    <SwipeablePageLayout
      title={leagueName || 'Loading...'}
      subtitle="League Leaderboard"
      icon={headerIcon}
      activeTab="standings"
      onTabChange={() => {}}
      onRefresh={() => loadLeague(true)}
      badge={isSeasonComplete && <Badge bg="warning" text="dark" className="rounded-pill fw-bold" style={{ fontSize: '0.6rem' }}>FINAL</Badge>}
      tabs={[{ id: 'standings', label: 'Standings', icon: <Users size={16} /> }]}
    >
      <div className="mt-3">
        <div className="d-flex justify-content-end mb-4">
          {invitePill}
        </div>
        
        {loading ? (
          <div className="text-center py-5"><Spinner animation="border" variant="danger" /></div>
        ) : (
          <LeaderboardTable 
            entries={leaderboard} 
            loading={loading} 
            isSeasonComplete={isSeasonComplete}
            emptyMessage="No members in this league yet."
          />
        )}
      </div>
    </SwipeablePageLayout>
  );
}

export default function LeagueDetailPage() {
  return (
    <Suspense fallback={<LoadingView />}>
      <LeagueDetailContent />
    </Suspense>
  );
}
