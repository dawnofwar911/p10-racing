'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Badge } from 'react-bootstrap';
import { LeaderboardEntry, CURRENT_SEASON } from '@/lib/data';
import { calculateSeasonPoints, mapPredictionsByUser } from '@/lib/scoring';
import { DbPrediction } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import { fetchAllSimplifiedResults } from '@/lib/results';
import { isTestAccount } from '@/lib/utils/profiles';
import { withTimeout } from '@/lib/utils/sync-queue';
import { STORAGE_KEYS, getPredictionKey } from '@/lib/utils/storage';
import { useAuth } from '@/components/AuthProvider';
import LeaderboardTable from '@/components/LeaderboardTable';
import { Trophy, Globe, Users } from 'lucide-react';
import SwipeablePageLayout, { TabOption } from '@/components/SwipeablePageLayout';
import LoadingView from '@/components/LoadingView';
import { useF1Data } from '@/lib/hooks/use-f1-data';
import { useRealtimeSync } from '@/lib/hooks/use-realtime-sync';

export default function LeaderboardPage() {
  const supabase = createClient();
  const mountedRef = useRef(true);
  const { session, currentUser, syncVersion, triggerRefresh } = useAuth();
  const { drivers, calendar, loading: f1Loading } = useF1Data(CURRENT_SEASON);

  // 1. Separate Cache Initialization
  const [globalLeaderboard, setGlobalLeaderboard] = useState<LeaderboardEntry[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const cached = localStorage.getItem(STORAGE_KEYS.CACHE_LEADERBOARD);
      return cached ? JSON.parse(cached) : [];
    } catch (e) {
      console.warn('Leaderboard: Failed to parse global cache', e);
      return [];
    }
  });

  const [localLeaderboard, setLocalLeaderboard] = useState<LeaderboardEntry[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const cached = localStorage.getItem(STORAGE_KEYS.CACHE_LOCAL_LEADERBOARD);
      return cached ? JSON.parse(cached) : [];
    } catch (e) {
      console.warn('Leaderboard: Failed to parse local cache', e);
      return [];
    }
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
    // Keep loading if F1 data is still pending, but only if we have no cached data
    if (f1Loading && globalLeaderboard.length === 0) {
      if (mountedRef.current) setLoading(true);
      return;
    }
    
    if (!quiet && mountedRef.current) setLoading(true);
    
    try {
      const raceResultsMap = await fetchAllSimplifiedResults();
      
      const resultsFoundCount = Object.keys(raceResultsMap).length;
      // Determine season completion only after calendar is fully loaded and results are fetched
      if (mountedRef.current && calendar.length > 0) {
        setIsSeasonComplete(resultsFoundCount > 0 && resultsFoundCount >= calendar.length);
      }

      const currentUserId = session?.user?.id;


      // 1. GLOBAL CALCULATION
      let globalEntries: LeaderboardEntry[] = [];
      try {
        const [
          { data: profiles },
          { data: predictions },
        ] = await Promise.all([
          withTimeout(supabase.from('profiles').select('id, username')),
          // Type cast: PostgrestFilterBuilder is thenable but not a standard Promise, 
          // requiring double-casting for use in Promise.all.
          withTimeout(supabase.from('predictions').select('*').ilike('race_id', `${CURRENT_SEASON}_%`) as unknown as Promise<{ data: DbPrediction[] | null }>),
        ]);

        if (profiles) {
          // Pre-process predictions into a Map for O(1) user lookup
          const predByUserId = mapPredictionsByUser(predictions);

          const globalPlayers = profiles
            .filter(p => !isTestAccount(p.username) || p.id === currentUserId)
            .map(p => ({ 
              username: p.username, 
              userId: p.id, 
              isLocal: false,
              playerPredictions: predByUserId[p.id] || {}
            }));

          globalEntries = globalPlayers.map((player) => {
            const { totalPoints, lastRacePoints, latestBreakdown, history } = calculateSeasonPoints(player.playerPredictions, raceResultsMap);
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
      let localPlayers: string[] = [];
      try {
        const stored = localStorage.getItem(STORAGE_KEYS.PLAYERS_LIST);
        localPlayers = stored ? JSON.parse(stored) : [];
      } catch (e) {
        console.warn('Leaderboard: Failed to parse players list', e);
      }

      const localEntries: LeaderboardEntry[] = (Array.isArray(localPlayers) ? localPlayers : []).map((username) => {
        const playerPredictions: { [round: string]: { p10: string, dnf: string } | null } = {};
        Object.keys(raceResultsMap).forEach(round => {
          try {
            const predStr = localStorage.getItem(getPredictionKey(CURRENT_SEASON, username, round));
            if (predStr) playerPredictions[round] = JSON.parse(predStr);
          } catch (e) {
            console.warn(`Leaderboard: Failed to parse prediction for ${username} round ${round}`, e);
          }
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
  }, [supabase, session?.user?.id, syncVersion, f1Loading, calendar.length]); // eslint-disable-line react-hooks/exhaustive-deps

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
  useRealtimeSync(useCallback(() => calculate(true), [calculate]));

  const tabs: TabOption<'global' | 'local'>[] = [
    { id: 'global', label: 'Global', icon: <Globe size={16} /> }
  ];
  
  if (localLeaderboard.length > 0) {
    tabs.push({ id: 'local', label: 'Guests', icon: <Users size={16} /> });
  }

  return (
    <SwipeablePageLayout
      title="Leaderboard"
      subtitle={view === 'global' ? `${CURRENT_SEASON} World Rankings` : 'Guest Players on Device'}
      icon={<Trophy size={24} className="text-white" />}
      activeTab={view}
      onTabChange={setView}
      onRefresh={() => calculate(true)}
      splitOnWide={tabs.length > 1}
      badge={!loading && isSeasonComplete && <Badge bg="warning" text="dark" className="rounded-pill fw-bold" style={{ fontSize: '0.6rem' }}>FINAL</Badge>}
      tabs={tabs}
      renderTabContent={(tabId) => (
        loading ? (
          <LoadingView text="Calculating Leaderboard..." />
        ) : (
          <LeaderboardTable 
            entries={tabId === 'global' ? globalLeaderboard : localLeaderboard} 
            loading={false} 
            currentUser={currentUser || undefined}
            isSeasonComplete={isSeasonComplete}
            drivers={drivers}
          />
        )
      )}
    />
  );
}
