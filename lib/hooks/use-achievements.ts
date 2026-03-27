import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { CURRENT_SEASON } from '@/lib/data';
import { fetchAllSimplifiedResults } from '@/lib/results';
import { calculateSeasonPoints } from '@/lib/scoring';
import { getUnlockedAchievements, syncAchievements } from '@/lib/utils/achievements';
import { UnlockedAchievement, ACHIEVEMENTS } from '@/lib/achievements';
import { createClient } from '@/lib/supabase/client';
import { DbPrediction } from '@/lib/types';
import { useNotification } from '@/components/Notification';

const CACHE_STALE_MS = 60 * 60 * 1000; // 1 hour

export function useAchievements() {
  const { session, currentUser } = useAuth();
  const { showNotification } = useNotification();
  const supabase = useMemo(() => createClient(), []);

  const getCacheKey = useCallback(() => {
    return session?.user?.id ? `achievements_${session.user.id}` : `achievements_${currentUser || 'guest'}`;
  }, [session?.user?.id, currentUser]);

  const [unlocked, setUnlocked] = useState<UnlockedAchievement[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const cached = localStorage.getItem(getCacheKey());
      if (cached) {
        const { data } = JSON.parse(cached);
        return data || [];
      }
    } catch { /* ignore */ }
    return [];
  });
  const [loading, setLoading] = useState(unlocked.length === 0);

  const refreshAchievements = useCallback(async () => {
    const userId = session?.user?.id;
    setLoading(true);

    try {
      const raceResultsMap = await fetchAllSimplifiedResults();
      const playerPredictions: { [round: string]: { p10: string, dnf: string } } = {};

      if (userId) {
        const { data } = await supabase.from('predictions').select('*').ilike('race_id', `${CURRENT_SEASON}_%`);
        if (data) {
          data.forEach((p: DbPrediction) => {
            const round = p.race_id.split('_')[1];
            playerPredictions[round] = { p10: p.p10_driver_id, dnf: p.dnf_driver_id };
          });
        }
      } else if (currentUser) {
        Object.keys(raceResultsMap).forEach(round => {
          const key = `final_pred_${CURRENT_SEASON}_${currentUser}_${round}`;
          const stored = localStorage.getItem(key);
          if (stored) playerPredictions[round] = JSON.parse(stored);
        });
      }

      const { history } = calculateSeasonPoints(playerPredictions, raceResultsMap);
      const newlyUnlockedIds = await syncAchievements(history, userId);
      
      const updated = await getUnlockedAchievements(userId);
      setUnlocked(updated);
      localStorage.setItem(getCacheKey(), JSON.stringify({ data: updated, timestamp: Date.now() }));

      if (newlyUnlockedIds.length > 0) {
        newlyUnlockedIds.forEach(id => {
          const achievement = ACHIEVEMENTS.find(a => a.id === id);
          if (achievement) {
            showNotification(`Trophy Unlocked: ${achievement.name}! ${achievement.icon}`, 'success');
          }
        });
      }
    } catch (e) {
      console.error('Failed to sync achievements:', e);
    } finally {
      setLoading(false);
    }
  }, [session, currentUser, supabase, getCacheKey, showNotification]);

  useEffect(() => {
    const checkAndRefresh = () => {
      try {
        const cached = localStorage.getItem(getCacheKey());
        if (cached) {
          const { timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_STALE_MS) {
            setLoading(false);
            return; // Cache is fresh, do nothing
          }
        }
      } catch { /* ignore and refresh */ }
      
      refreshAchievements();
    };
    checkAndRefresh();
  }, [refreshAchievements, getCacheKey]);
  
  return { 
    unlocked, 
    allAchievements: ACHIEVEMENTS,
    loading, 
    refresh: refreshAchievements 
  };
}
