'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Badge, Spinner } from 'react-bootstrap';
import { LeaderboardEntry, CURRENT_SEASON } from '@/lib/data';
import { calculateSeasonPoints } from '@/lib/scoring';
import { DbPrediction } from '@/lib/types';
import { fetchCalendar } from '@/lib/api';
import { createClient } from '@/lib/supabase/client';
import { fetchAllSimplifiedResults } from '@/lib/results';
import { isTestAccount } from '@/lib/utils/profiles';
import { withTimeout } from '@/lib/utils/sync-queue';
import { STORAGE_KEYS, getPredictionKey } from '@/lib/utils/storage';
import { useAuth } from '@/components/AuthProvider';
import LeaderboardTable from '@/components/LeaderboardTable';
import { Trophy, Globe, Users } from 'lucide-react';
import SwipeablePageLayout from '@/components/SwipeablePageLayout';

export default function LeaderboardPage() {
  const supabase = createClient();
  const mountedRef = useRef(true);
  const { session, syncVersion, triggerRefresh } = useAuth();

  // 1. Separate Cache Initialization
  const [globalLeaderboard, setGlobalLeaderboard] = useState<LeaderboardEntry[]>(() => {
    if (typeof window === 'undefined') return [];
    const cached = localStorage.getItem(STORAGE_KEYS.CACHE_LEADERBOARD);
    return cached ? JSON.parse(cached) : [];
  });

  const [localLeaderboard, setLocalLeaderboard] = useState<LeaderboardEntry[]>(() => {
    if (typeof window === 'undefined') return [];
    const cached = localStorage.getItem(STORAGE_KEYS.CACHE_LOCAL_LEADERBOARD);
    return cached ? JSON.parse(cached) : [];
  });

  const [loading, setLoading] = useState(!globalLeaderboard.length && !localLeaderboard.length);
  const [isSeasonComplete, setIsSeasonComplete] = useState(false);
  const [view, setView] = useState<'global' | 'local'>('global');

  // Lifecycle
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const calculate = useCallback(async (quiet = false) => {
    if (!quiet && mountedRef.current) setLoading(true);
    try {
      const [raceResultsMap, races] = await Promise.all([
        fetchAllSimplifiedResults(),
        fetchCalendar(CURRENT_SEASON)
      ]);
      
      const resultsFoundCount = Object.keys(raceResultsMap).length;
      if (mountedRef.current) setIsSeasonComplete(resultsFoundCount > 0 && resultsFoundCount >= races.length);

      const currentUserId = session?.user?.id;

      // 1. GLOBAL CALCULATION
      let globalEntries: LeaderboardEntry[] = [];
      try {
        const [
          { data: profiles },
          { data: predictions },
        ] = await Promise.all([
          withTimeout(supabase.from('profiles').select('id, username')),
          withTimeout(supabase.from('predictions').select<'*', DbPrediction>('*')),
        ]);

        if (profiles) {
          const globalPlayers = profiles
            .filter(p => !isTestAccount(p.username) || p.id === currentUserId)
            .map(p => ({ 
              username: p.username, 
              userId: p.id, 
              isLocal: false,
              dbPredictions: predictions?.filter(pred => pred.user_id === p.id) || []
            }));

          globalEntries = globalPlayers.map((player) => {
            const playerPredictions: { [round: string]: { p10: string, dnf: string } | null } = {};
            Object.keys(raceResultsMap).forEach(round => {
              const dbMatch = player.dbPredictions?.find((dp) => dp.race_id === `${CURRENT_SEASON}_${round}`);
              if (dbMatch) playerPredictions[round] = { p10: dbMatch.p10_driver_id, dnf: dbMatch.dnf_driver_id };
            });
            const { totalPoints, lastRacePoints, latestBreakdown, history } = calculateSeasonPoints(playerPredictions, raceResultsMap);
            return { rank: 0, player: player.username, points: totalPoints, lastRacePoints, breakdown: latestBreakdown, history };
          });

          const sortedGlobal = globalEntries.sort((a, b) => b.points - a.points);
          const rankedGlobal = sortedGlobal.map((entry, index) => ({ ...entry, rank: index + 1 }));
          
          if (mountedRef.current) {
            setGlobalLeaderboard(rankedGlobal);
            localStorage.setItem(STORAGE_KEYS.CACHE_LEADERBOARD, JSON.stringify(rankedGlobal));
          }
        }
      } catch (globalErr) {
        console.error('Leaderboard: Global calc error:', globalErr);
      }

      // 2. LOCAL CALCULATION
      const localPlayers: string[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAYERS_LIST) || '[]');
      const localEntries: LeaderboardEntry[] = localPlayers.map((username) => {
        const playerPredictions: { [round: string]: { p10: string, dnf: string } | null } = {};
        Object.keys(raceResultsMap).forEach(round => {
          const predStr = localStorage.getItem(getPredictionKey(CURRENT_SEASON, username, round));
          if (predStr) playerPredictions[round] = JSON.parse(predStr);
        });
        const { totalPoints, lastRacePoints, latestBreakdown, history } = calculateSeasonPoints(playerPredictions, raceResultsMap);
        return { rank: 0, player: username, points: totalPoints, lastRacePoints, breakdown: latestBreakdown, history };
      });

      const sortedLocal = localEntries.sort((a, b) => b.points - a.points);
      const rankedLocal = sortedLocal.map((entry, index) => ({ ...entry, rank: index + 1 }));
      
      if (mountedRef.current) {
        setLocalLeaderboard(rankedLocal);
        localStorage.setItem(STORAGE_KEYS.CACHE_LOCAL_LEADERBOARD, JSON.stringify(rankedLocal));
      }

    } catch (err) {
      console.error('Leaderboard: Calc error:', err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [supabase, session?.user?.id, syncVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const hasData = globalLeaderboard.length > 0 || localLeaderboard.length > 0;
    calculate(hasData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calculate]);

  useEffect(() => {
    const handleResume = () => triggerRefresh();
    window.addEventListener('p10:app_resume', handleResume);
    return () => window.removeEventListener('p10:app_resume', handleResume);
  }, [triggerRefresh]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase.channel('leaderboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'verified_results' }, () => calculate(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'predictions' }, () => calculate(true))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, calculate]);

  return (
    <SwipeablePageLayout
      title="Leaderboard"
      subtitle={view === 'global' ? `${CURRENT_SEASON} World Rankings` : 'Guest Players on Device'}
      icon={<Trophy size={24} className="text-white" />}
      activeTab={view}
      onTabChange={setView}
      onRefresh={() => calculate(true)}
      splitOnWide={true}
      badge={isSeasonComplete && <Badge bg="warning" text="dark" className="rounded-pill fw-bold" style={{ fontSize: '0.6rem' }}>FINAL</Badge>}
      tabs={[
        { id: 'global', label: 'Global', icon: <Globe size={16} /> },
        { id: 'local', label: 'Guests', icon: <Users size={16} /> }
      ]}
    >
      {loading ? (
        <div className="text-center py-5">
          <Spinner animation="border" variant="danger" />
        </div>
      ) : (
        <LeaderboardTable 
          entries={view === 'global' ? globalLeaderboard : localLeaderboard} 
          loading={false} 
          currentUser={session?.user?.id || undefined}
          isSeasonComplete={isSeasonComplete}
          emptyMessage={view === 'global' ? "No global players found." : "No guest data found on this device."}
        />
      )}
    </SwipeablePageLayout>
  );
}
