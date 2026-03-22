'use client';

import React, { useState, useEffect, useCallback, Suspense, useRef } from 'react';
import { Spinner, Badge } from 'react-bootstrap';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { fetchCalendar, fetchDrivers } from '@/lib/api';
import { DbPrediction, Driver } from '@/lib/types';
import { CURRENT_SEASON, LeaderboardEntry, DRIVERS as FALLBACK_DRIVERS } from '@/lib/data';
import { calculateSeasonPoints } from '@/lib/scoring';
import { fetchAllSimplifiedResults } from '@/lib/results';
import { isTestAccount } from '@/lib/utils/profiles';
import { STORAGE_KEYS } from '@/lib/utils/storage';
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
  const [allDrivers, setAllDrivers] = useState<Driver[]>(() => {
    if (typeof window === 'undefined') return FALLBACK_DRIVERS as unknown as Driver[];
    const cached = localStorage.getItem(STORAGE_KEYS.CACHE_DRIVERS);
    return cached ? JSON.parse(cached) : FALLBACK_DRIVERS as unknown as Driver[];
  });

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
      const [races, driversData] = await Promise.all([
        fetchCalendar(CURRENT_SEASON),
        fetchDrivers(CURRENT_SEASON)
      ]);
      
      if (driversData.length > 0 && mountedRef.current) {
        setAllDrivers(driversData);
      }
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

  return (
    <SwipeablePageLayout
      title={leagueName || 'Loading...'}
      subtitle="League Leaderboard"
      icon={<Users size={24} className="text-white" />}
      onBack={() => { triggerLightHaptic(); router.push('/leagues'); }}
      activeTab="standings"
      onTabChange={() => {}}
      onRefresh={() => loadLeague(true)}
      badge={isSeasonComplete && <Badge bg="warning" text="dark" className="rounded-pill fw-bold" style={{ fontSize: '0.6rem' }}>FINAL</Badge>}
      tabs={[{ id: 'standings', label: 'Standings', icon: <Users size={16} /> }]}
    >
      <div className="mt-2">
        <div className="f1-glass-card mb-4 p-3 border-secondary border-opacity-50">
          {/* Subtle accent line */}
          <div className="position-absolute top-0 start-0 w-100 bg-danger opacity-50" style={{ height: '2px' }}></div>
          
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <small className="text-muted text-uppercase fw-bold letter-spacing-2 d-block mb-1" style={{ fontSize: '0.6rem' }}>League Invite Code</small>
              <code className="text-white fw-bold letter-spacing-2 fs-4" style={{ fontFamily: 'monospace' }}>{inviteCode}</code>
            </div>
            <HapticButton variant="danger" className="rounded-pill px-4 py-2 fw-bold text-uppercase d-flex align-items-center gap-2 shadow-sm" style={{ fontSize: '0.75rem' }} onClick={handleShare}>
              SHARE LINK
            </HapticButton>
          </div>
        </div>
        
        {loading ? (
          <div className="text-center py-5"><Spinner animation="border" variant="danger" /></div>
        ) : (
          <LeaderboardTable 
            entries={leaderboard} 
            loading={loading} 
            isSeasonComplete={isSeasonComplete}
            drivers={allDrivers}
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
