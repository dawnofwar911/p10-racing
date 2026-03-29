'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface LiveResult {
  driverId: string;
  acronym: string;
  position: number;
  gap: string;
  interval: string;
  isRetired: boolean;
  inPit: boolean;
  number: string;
  tyres?: {
    compound: string;
    isNew: boolean;
    laps: number;
  };
}

export interface LiveRaceData {
  status: string;
  trackStatus: string;
  trackMessage: string;
  meeting: string;
  session: string;
  results: LiveResult[];
  lastUpdated: string;
}

const STALE_DATA_THRESHOLD_MS = 120000; // 2 minutes

export function useF1LiveTiming(enabled: boolean = false, intervalMs: number = 15000) {
  const [data, setData] = useState<LiveRaceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const supabase = useMemo(() => createClient(), []);
  const mountedRef = useRef(true);

  useEffect(() => {
    if (!enabled || !data?.lastUpdated) return;
    const interval = setInterval(() => setNow(Date.now()), 30000); // Check every 30s
    return () => clearInterval(interval);
  }, [enabled, data?.lastUpdated]);

  const isStale = useMemo(() => {
    if (!data?.lastUpdated) return false;
    const lastUpdate = new Date(data.lastUpdated).getTime();
    return (now - lastUpdate) > STALE_DATA_THRESHOLD_MS;
  }, [data?.lastUpdated, now]);

  const fetchData = useCallback(async () => {
    if (!enabled) return;
    
    try {
      if (mountedRef.current) setLoading(true);
      
      const { data: response, error: funcError } = await supabase.functions.invoke('f1-live-proxy', {
        headers: {
          'X-Cron-Secret': process.env.NEXT_PUBLIC_CRON_SECRET || ''
        }
      });
      
      if (funcError) throw funcError;
      
      if (mountedRef.current) {
        setData(response);
        setError(null);
      }
    } catch (err) {
      console.error('useF1LiveTiming: Error fetching live data:', err);
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch live data');
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [enabled, supabase]);

  useEffect(() => {
    mountedRef.current = true;
    
    if (enabled) {
      fetchData();
      const interval = setInterval(fetchData, intervalMs);
      return () => {
        clearInterval(interval);
        mountedRef.current = false;
      };
    }
    
    return () => {
      mountedRef.current = false;
    };
  }, [enabled, fetchData, intervalMs]);

  return { data, loading, error, isStale, refetch: fetchData };
}
