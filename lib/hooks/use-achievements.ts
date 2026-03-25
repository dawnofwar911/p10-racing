import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { CURRENT_SEASON } from '@/lib/data';
import { fetchAllSimplifiedResults } from '@/lib/results';
import { calculateSeasonPoints } from '@/lib/scoring';
import { getUnlockedAchievements, syncAchievements } from '@/lib/utils/achievements';
import { UnlockedAchievement, ACHIEVEMENTS } from '@/lib/achievements';
import { createClient } from '@/lib/supabase/client';
import { DbPrediction } from '@/lib/types';
import { useNotification } from '@/components/Notification';

export function useAchievements() {
  const { session, currentUser } = useAuth();
  const { showNotification } = useNotification();
  const [unlocked, setUnlocked] = useState<UnlockedAchievement[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshAchievements = useCallback(async () => {
    setLoading(true);
    const userId = session?.user?.id;
    
    // 1. Get currently unlocked
    const currentUnlocked = await getUnlockedAchievements(userId);
    setUnlocked(currentUnlocked);

    // 2. Evaluate for new ones
    try {
      const raceResultsMap = await fetchAllSimplifiedResults();
      const supabase = createClient();
      
      const playerPredictions: { [round: string]: { p10: string, dnf: string } } = {};

      if (userId) {
        // Fetch from Supabase
        const { data } = await supabase
          .from('predictions')
          .select('*')
          .ilike('race_id', `${CURRENT_SEASON}_%`);
        
        if (data) {
          data.forEach((p: DbPrediction) => {
            const round = p.race_id.split('_')[1];
            playerPredictions[round] = { p10: p.p10_driver_id, dnf: p.dnf_driver_id };
          });
        }
      } else if (currentUser) {
        // Fetch from localStorage for Guest
        Object.keys(raceResultsMap).forEach(round => {
          const key = `final_pred_${CURRENT_SEASON}_${currentUser}_${round}`;
          const stored = localStorage.getItem(key);
          if (stored) playerPredictions[round] = JSON.parse(stored);
        });
      }

      const { history } = calculateSeasonPoints(playerPredictions, raceResultsMap);
      const newlyUnlockedIds = await syncAchievements(history, userId);
      
      if (newlyUnlockedIds.length > 0) {
        const updated = await getUnlockedAchievements(userId);
        setUnlocked(updated);

        // Show notifications for new unlocks
        newlyUnlockedIds.forEach(id => {
          const achievement = ACHIEVEMENTS.find(a => a.id === id);
          if (achievement) {
            showNotification(
              `Trophy Unlocked: ${achievement.name}! ${achievement.icon}`,
              'success'
            );
          }
        });
      }
    } catch (e) {
      console.error('Failed to sync achievements:', e);
    } finally {
      setLoading(false);
    }
  }, [session, currentUser, showNotification]);

  useEffect(() => {
    refreshAchievements();
  }, [refreshAchievements]);

  return { 
    unlocked, 
    allAchievements: ACHIEVEMENTS,
    loading, 
    refresh: refreshAchievements 
  };
}
