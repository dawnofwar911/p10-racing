import { createClient } from './client';
import { Session } from '@supabase/supabase-js';

/**
 * Attempts to sync any pending predictions from localStorage to Supabase.
 * Returns true if a sync was attempted and successful, or if no pending sync exists.
 * Returns false if a sync was attempted but failed.
 */
export async function syncPendingPredictions(session: Session | null): Promise<boolean> {
  if (!session) return true;
  
  const pendingKey = `pending_pred_${session.user.id}`;
  const pendingData = localStorage.getItem(pendingKey);
  
  if (!pendingData) return true;

  const supabase = createClient();
  try {
    const pending = JSON.parse(pendingData);
    const { error } = await supabase
      .from('predictions')
      .upsert({
        user_id: session.user.id,
        race_id: pending.race_id,
        p10_driver_id: pending.p10_driver_id,
        dnf_driver_id: pending.dnf_driver_id,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id, race_id' });
    
    if (!error) {
      localStorage.removeItem(pendingKey);
      console.log('Sync complete: Pending prediction uploaded to cloud.');
      return true;
    } else {
      console.warn('Sync failed: Supabase error', error);
      return false;
    }
  } catch (e) {
    console.error('Sync failed: Catch error', e);
    return false;
  }
}

/**
 * Checks if there is a pending prediction for the current user.
 */
export function hasPendingPrediction(userId: string | undefined): boolean {
  if (!userId) return false;
  return !!localStorage.getItem(`pending_pred_${userId}`);
}
