import { createClient } from './client';
import { Session } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { storage } from '../storage';

/**
 * Syncs the session and pending status to Preferences so the native 
 * BackgroundRunner can access them.
 */
async function mirrorToPreferences(session: Session | null, pendingData?: any) {
  if (!Capacitor.isNativePlatform()) return;

  if (session) {
    // We store the essential bits for the background fetch in a dedicated key
    // that the background worker knows to look for.
    await storage.setItem('p10_bg_session', JSON.stringify({
      access_token: session.access_token,
      user: { id: session.user.id },
      supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabase_key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    }));

    const pendingKey = `pending_pred_${session.user.id}`;
    if (pendingData) {
      await storage.setItem(pendingKey, JSON.stringify(pendingData));
    } else {
      // Logic handled in storage.removeItem if needed, but here we check existence
      const localPending = storage.getItemSync(pendingKey);
      if (!localPending) {
        await storage.removeItem(pendingKey);
      }
    }
  } else {
    await storage.removeItem('p10_bg_session');
  }
}

/**
 * Attempts to sync any pending predictions from localStorage to Supabase.
 * Returns true if a sync was attempted and successful, or if no pending sync exists.
 * Returns false if a sync was attempted but failed.
 */
export async function syncPendingPredictions(session: Session | null): Promise<boolean> {
  if (!session) return true;
  
  const pendingKey = `pending_pred_${session.user.id}`;
  const pendingData = await storage.getItem(pendingKey);
  
  // Always mirror the current state to Preferences for background worker
  await mirrorToPreferences(session);
  
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
      await storage.removeItem(pendingKey);
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
  return !!storage.getItemSync(`pending_pred_${userId}`);
}

/**
 * Saves a prediction as pending locally and mirrors to Preferences.
 */
export async function savePendingPrediction(session: Session, raceId: string, p10Id: string, dnfId: string) {
  const pendingKey = `pending_pred_${session.user.id}`;
  const data = {
    race_id: raceId,
    p10_driver_id: p10Id,
    dnf_driver_id: dnfId
  };
  
  await storage.setItem(pendingKey, JSON.stringify(data));
  await mirrorToPreferences(session, data);
}
