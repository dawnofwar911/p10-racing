import { createClient } from '@/lib/supabase/client';
import { STORAGE_KEYS } from './storage';
import { UnlockedAchievement, evaluateAchievements } from '@/lib/achievements';

/**
 * Loads unlocked achievements from localStorage or Supabase.
 */
export async function getUnlockedAchievements(userId?: string): Promise<UnlockedAchievement[]> {
  // 1. Try local cache first
  const cacheKey = userId ? `${STORAGE_KEYS.CACHE_ACHIEVEMENTS}_${userId}` : STORAGE_KEYS.CACHE_ACHIEVEMENTS;
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) {
      console.warn('Failed to parse cached achievements', e);
    }
  }

  // 2. If Auth user, fetch from Supabase
  if (userId) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('user_achievements')
      .select('achievement_id, unlocked_at, round')
      .eq('user_id', userId);

    if (data && !error) {
      const achievements: UnlockedAchievement[] = data.map(d => ({
        achievementId: d.achievement_id,
        unlockedAt: d.unlocked_at,
        round: d.round
      }));
      localStorage.setItem(cacheKey, JSON.stringify(achievements));
      return achievements;
    }
  }

  return [];
}

/**
 * Saves a new achievement.
 */
export async function unlockAchievement(achievementId: string, userId?: string, round?: string): Promise<void> {
  const newAchievement: UnlockedAchievement = {
    achievementId,
    unlockedAt: new Date().toISOString(),
    round
  };

  // 1. Update local cache
  const cacheKey = userId ? `${STORAGE_KEYS.CACHE_ACHIEVEMENTS}_${userId}` : STORAGE_KEYS.CACHE_ACHIEVEMENTS;
  const current = await getUnlockedAchievements(userId);
  if (current.some(a => a.achievementId === achievementId)) return; // Already unlocked

  const updated = [...current, newAchievement];
  localStorage.setItem(cacheKey, JSON.stringify(updated));

  // 2. If Auth user, sync to Supabase
  if (userId) {
    const supabase = createClient();
    await supabase.from('user_achievements').upsert({
      user_id: userId,
      achievement_id: achievementId,
      unlocked_at: newAchievement.unlockedAt,
      round
    }, { onConflict: 'user_id, achievement_id' });
  }
}

/**
 * Evaluates and syncs achievements based on race history.
 */
export async function syncAchievements(
  history: { round: string, points: number, p10Pos: number, dnfCorrect: boolean, totalSoFar: number }[],
  userId?: string
): Promise<string[]> {
  const newlyUnlocked: string[] = [];
  const existing = await getUnlockedAchievements(userId);
  const existingIds = new Set(existing.map(a => a.achievementId));

  const evaluatedIds = evaluateAchievements(history);

  for (const id of evaluatedIds) {
    if (!existingIds.has(id)) {
      await unlockAchievement(id, userId);
      newlyUnlocked.push(id);
    }
  }

  return newlyUnlocked;
}
