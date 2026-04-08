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
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const loadLocalGuests = useCallback(() => {
    try {
      let guests: string[] = [];
      const stored = localStorage.getItem(STORAGE_KEYS.PLAYERS_LIST);
      if (stored) {
        guests = JSON.parse(stored);
      }
      if (!Array.isArray(guests)) guests = [];

      // Dynamically scan localStorage for orphaned guest predictions
      const prefix = `${STORAGE_KEYS.PRED_PREFIX}${CURRENT_SEASON}_`;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          const remainder = key.substring(prefix.length);
          const parts = remainder.split('_');
          if (parts.length >= 2) {
            parts.pop(); // Remove raceId
            const username = parts.join('_');
            
            // Exclude valid UUIDs (which signify authenticated users)
            if (username && username.length !== 36 && !username.includes('-') && !guests.includes(username)) {
              guests.push(username);
            }
          }
        }
      }

      if (mountedRef.current) setLocalGuests(guests);
    } catch (e) {
      console.warn('useGuestMigration: Failed to parse players list', e);
      if (mountedRef.current) setLocalGuests([]);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    loadLocalGuests();
    return () => { mountedRef.current = false; };
  }, [loadLocalGuests]);

  const importGuestData = async (guestName: string) => {
    if (!session) {
      setError('You must be signed in to import data.');
      return;
    }

    setIsImporting(true);
    setError(null);
    setSuccess(null);
    triggerHeavyHaptic();

    try {
      let count = 0;
      const importPromises = [];
      const predictionsToSync: {round: number, p10: string, dnf: string}[] = [];
      
      // Check all 24 rounds for predictions
      for (let round = 1; round <= 24; round++) {
        const key = getPredictionKey(CURRENT_SEASON, guestName, round);
        const predStr = localStorage.getItem(key);
        
        if (predStr) {
          try {
            const pred = JSON.parse(predStr);
            predictionsToSync.push({ round, p10: pred.p10, dnf: pred.dnf });
            importPromises.push(
              supabase.from('predictions').upsert({
                user_id: session.user.id,
                race_id: `${CURRENT_SEASON}_${round}`,
                p10_driver_id: pred.p10,
                dnf_driver_id: pred.dnf,
                updated_at: new Date().toISOString()
              }, { onConflict: 'user_id, race_id' })
            );
            count++;
          } catch (e) {
            console.warn(`useGuestMigration: Failed to parse prediction for ${guestName} round ${round}`, e);
          }
        }
      }

      if (importPromises.length === 0) {
        throw new Error(`No predictions found to import for ${guestName}.`);
      }

      const results = await Promise.all(importPromises);
      const errors = results.filter(r => r.error);
      
      if (errors.length > 0) {
        console.error('Migration errors:', errors);
        throw new Error('Some predictions failed to import. Please try again.');
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

      // Update players list
      const stored = localStorage.getItem(STORAGE_KEYS.PLAYERS_LIST);
      const currentPlayers = stored ? JSON.parse(stored) : [];
      const updatedPlayers = (Array.isArray(currentPlayers) ? currentPlayers : []).filter(p => p !== guestName);
      
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
      if (mountedRef.current) setIsImporting(false);
    }
  };

  return {
    localGuests,
    isImporting,
    error,
    success,
    importGuestData,
    refreshGuests: loadLocalGuests
  };
}
