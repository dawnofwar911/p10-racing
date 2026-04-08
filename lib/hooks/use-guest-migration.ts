'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { STORAGE_KEYS, getPredictionKey, setStorageItem } from '@/lib/utils/storage';
import { CURRENT_SEASON } from '@/lib/data';
import { triggerHeavyHaptic, triggerSuccessHaptic } from '@/lib/utils/haptics';
import { useAuth } from '@/components/AuthProvider';

export function useGuestMigration() {
  const supabase = createClient();
  const { session, triggerRefresh, displayName } = useAuth();
  const [localGuests, setLocalGuests] = useState<string[]>([]);
  const [importingGuest, setImportingGuest] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const loadLocalGuests = useCallback(() => {
    try {
      let guests: string[] = [];
      const stored = localStorage.getItem(STORAGE_KEYS.PLAYERS_LIST);
      if (stored) {
        try {
          guests = JSON.parse(stored);
        } catch (e) {
          console.warn('useGuestMigration: Failed to parse players list from storage', e);
        }
      }
      
      const validatedGuests = (Array.isArray(guests) ? guests : []).filter((g: unknown) => 
        typeof g === 'string' && g.trim().length > 0
      ) as string[];

      // Dynamically scan localStorage for orphaned guest predictions
      const prefix = `${STORAGE_KEYS.PRED_PREFIX}${CURRENT_SEASON}_`;
      const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          const remainder = key.substring(prefix.length);
          const parts = remainder.split('_');
          if (parts.length >= 2) {
            parts.pop(); // Remove raceId
            const username = parts.join('_');
            
            // Exclude valid UUIDs (which signify authenticated users)
            if (username && !isUUID(username) && !validatedGuests.includes(username)) {
              validatedGuests.push(username);
            }
          }
        }
      }

      if (mountedRef.current) {
        setLocalGuests(validatedGuests.filter(g => typeof g === 'string' && g.trim().length > 0));
      }
    } catch (e) {
      console.warn('useGuestMigration: Fatal error during load', e);
      if (mountedRef.current) setLocalGuests([]);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    loadLocalGuests();
    return () => { mountedRef.current = false; };
  }, [loadLocalGuests, session]);

  const importGuestData = async (guestName: string) => {
    if (!session) {
      setError('You must be signed in to import data.');
      return;
    }

    setImportingGuest(guestName);
    setError(null);
    setSuccess(null);
    triggerHeavyHaptic();

    try {
      let count = 0;
      const predictionsToSync: {round: number, p10: string, dnf: string}[] = [];
      const upsertPayloads: {
        user_id: string;
        race_id: string;
        p10_driver_id: string;
        dnf_driver_id: string;
        updated_at: string;
      }[] = [];
      
      // Check all 24 rounds for predictions
      for (let round = 1; round <= 24; round++) {
        const key = getPredictionKey(CURRENT_SEASON, guestName, round);
        const predStr = localStorage.getItem(key);
        
        if (predStr) {
          try {
            const pred = JSON.parse(predStr);
            predictionsToSync.push({ round, p10: pred.p10, dnf: pred.dnf });
            upsertPayloads.push({
              user_id: session.user.id,
              race_id: `${CURRENT_SEASON}_${round}`,
              p10_driver_id: pred.p10,
              dnf_driver_id: pred.dnf,
              updated_at: new Date().toISOString()
            });
            count++;
          } catch (e) {
            console.warn(`useGuestMigration: Failed to parse prediction for ${guestName} round ${round}`, e);
          }
        }
      }

      if (upsertPayloads.length === 0) {
        throw new Error(`No predictions found to import for ${guestName}.`);
      }

      // Bulk Upsert for efficiency and atomicity
      const { error: upsertError } = await supabase
        .from('predictions')
        .upsert(upsertPayloads, { onConflict: 'user_id, race_id' });
      
      if (upsertError) {
        console.error('Migration error:', upsertError);
        throw new Error('Failed to import predictions. Please try again.');
      }

      // Sync to local cache for the AUTH user
      predictionsToSync.forEach(pred => {
        const authKey = getPredictionKey(CURRENT_SEASON, session.user.id, pred.round);
        setStorageItem(authKey, JSON.stringify({
          p10: pred.p10,
          dnf: pred.dnf,
          username: displayName,
          raceId: String(pred.round),
          season: CURRENT_SEASON
        }));
      });

      // Success! Cleanup local storage
      if (mountedRef.current) {
        setSuccess(`Successfully imported ${count} predictions from ${guestName}!`);
        triggerSuccessHaptic();
        triggerRefresh();
      }

      // Update players list and state (Cleanup)
      const updatedPlayers = localGuests.filter(p => p !== guestName);
      localStorage.setItem(STORAGE_KEYS.PLAYERS_LIST, JSON.stringify(updatedPlayers));
      if (mountedRef.current) setLocalGuests(updatedPlayers);
      
      // Remove individual prediction keys
      for (let round = 1; round <= 24; round++) {
        localStorage.removeItem(getPredictionKey(CURRENT_SEASON, guestName, round));
      }

    } catch (err: unknown) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Import failed');
      }
    } finally {
      if (mountedRef.current) setImportingGuest(null);
    }
  };

  return {
    localGuests,
    isImporting: !!importingGuest,
    importingGuest,
    error,
    success,
    importGuestData,
    refreshGuests: loadLocalGuests
  };
}
