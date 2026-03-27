'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CURRENT_SEASON } from '@/lib/data';
import { STORAGE_KEYS, getPredictionKey, setStorageItem, STORAGE_UPDATE_EVENT } from '@/lib/utils/storage';
import { useAuth } from '@/components/AuthProvider';
import { useNotification } from '@/components/Notification';
import { triggerHeavyHaptic } from '@/lib/utils/haptics';

export interface Prediction {
  p10: string;
  dnf: string;
}

export function useSyncPredictions(raceId: string | number | undefined) {
  const supabase = useMemo(() => createClient(), []);
  const { session, currentUser, displayName, syncVersion } = useAuth();
  const { showNotification } = useNotification();
  
  // 1. Synchronous Initialization from Cache
  const [prediction, setPrediction] = useState<Prediction | null>(() => {
    if (typeof window === 'undefined' || !raceId) return null;
    const storageUser = (localStorage.getItem(STORAGE_KEYS.CACHE_USERNAME) || localStorage.getItem(STORAGE_KEYS.CURRENT_USER)) || '';
    if (!storageUser) return null;
    
    try {
      const cachedPred = localStorage.getItem(getPredictionKey(CURRENT_SEASON, storageUser, String(raceId)));
      return cachedPred ? JSON.parse(cachedPred) : null;
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState(() => !prediction);
  const mountedRef = useRef(true);

  const loadPrediction = useCallback(async () => {
    if (!raceId) return;

    let finalPrediction: Prediction | null = null;
    const storageUser = session?.user?.id || currentUser || '';

    // 1. Try local cache FIRST for immediate sync
    if (storageUser) {
      try {
        const cachedPred = localStorage.getItem(getPredictionKey(CURRENT_SEASON, storageUser, String(raceId)));
        if (cachedPred) {
          finalPrediction = JSON.parse(cachedPred);
        }
      } catch (e) {
        console.warn('useSyncPredictions: Failed to parse prediction cache', e);
      }
    }

    // 2. Try DB as fallback if no cache or to ensure fresh data
    if (!finalPrediction && session) {
      try {
        const { data: pred } = await supabase
          .from('predictions')
          .select('p10_driver_id, dnf_driver_id')
          .eq('user_id', session.user.id)
          .eq('race_id', `${CURRENT_SEASON}_${raceId}`)
          .maybeSingle();
        
        if (pred) {
          finalPrediction = { p10: pred.p10_driver_id, dnf: pred.dnf_driver_id };
          // Sync back to local storage for offline use
          setStorageItem(getPredictionKey(CURRENT_SEASON, session.user.id, String(raceId)), JSON.stringify({
            ...finalPrediction,
            username: displayName,
            raceId: String(raceId),
            season: CURRENT_SEASON
          }));
        }
      } catch (err) {
        console.error('useSyncPredictions: DB load error:', err);
      }
    }

    if (mountedRef.current) {
      // Prevent state update if values haven't changed (deep equality check)
      setPrediction(prev => {
        if (!prev && !finalPrediction) return prev;
        if (prev?.p10 === finalPrediction?.p10 && prev?.dnf === finalPrediction?.dnf) return prev;
        return finalPrediction;
      });
      setLoading(false);
    }
  }, [raceId, session, currentUser, displayName, supabase]);

  const submitPrediction = useCallback(async (p10: string, dnf: string) => {
    if (!p10 || !dnf || !raceId) return false;

    try {
      triggerHeavyHaptic();
      const predData = { p10, dnf, username: displayName || 'User', raceId: String(raceId), season: CURRENT_SEASON };

      if (session) {
        const { error } = await supabase.from('predictions').upsert({
          user_id: session.user.id,
          race_id: `${CURRENT_SEASON}_${raceId}`,
          p10_driver_id: p10,
          dnf_driver_id: dnf,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id, race_id' });
        
        if (error) {
          showNotification('Error saving prediction: ' + error.message, 'error');
          return false;
        }
        setStorageItem(getPredictionKey(CURRENT_SEASON, session.user.id, String(raceId)), JSON.stringify(predData));
      } else {
        // Guest mode
        setStorageItem(getPredictionKey(CURRENT_SEASON, displayName, String(raceId)), JSON.stringify(predData));
        
        // Update players list
        let players: string[] = [];
        try {
          const stored = localStorage.getItem(STORAGE_KEYS.PLAYERS_LIST);
          players = stored ? JSON.parse(stored) : [];
        } catch {
          // ignore
        }

        if (Array.isArray(players) && !players.includes(displayName)) {
          players.push(displayName);
          localStorage.setItem(STORAGE_KEYS.PLAYERS_LIST, JSON.stringify(players));
        }
      }

      setPrediction({ p10, dnf });
      return true;
    } catch (err) {
      console.error('useSyncPredictions: Submit error:', err);
      return false;
    }
  }, [raceId, session, displayName, supabase, showNotification]);

  useEffect(() => {
    mountedRef.current = true;
    loadPrediction();
    
    const handleStorageUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<{ key: string }>;
      const updatedKey = customEvent.detail?.key;
      const expectedKey = getPredictionKey(CURRENT_SEASON, session?.user?.id || currentUser || '', String(raceId));
      
      if (updatedKey === expectedKey || updatedKey === STORAGE_KEYS.CURRENT_USER || updatedKey === STORAGE_KEYS.CACHE_USERNAME) {
        loadPrediction();
      }
    };

    window.addEventListener(STORAGE_UPDATE_EVENT, handleStorageUpdate);
    return () => {
      mountedRef.current = false;
      window.removeEventListener(STORAGE_UPDATE_EVENT, handleStorageUpdate);
    };
  }, [loadPrediction, raceId, session?.user?.id, currentUser, syncVersion]);

  return { prediction, loading, submitPrediction, reload: loadPrediction };
}
