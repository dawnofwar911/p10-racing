'use client';

import { useState, useEffect, useCallback } from 'react';
import { ApiCalendarRace, fetchDrivers, fetchCalendar, fetchRecentResults, DriverFormMap } from '@/lib/api';
import { Driver } from '@/lib/types';
import { CURRENT_SEASON, DRIVERS as FALLBACK_DRIVERS } from '@/lib/data';
import { STORAGE_KEYS } from '@/lib/utils/storage';

export interface UseF1DataReturn {
  drivers: Driver[];
  calendar: ApiCalendarRace[];
  driverForm: DriverFormMap;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/**
 * Custom hook to fetch and cache F1 drivers and calendar data.
 * Optimized with stale-while-revalidate and hydration safety.
 */
export function useF1Data(season: number = CURRENT_SEASON): UseF1DataReturn {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [calendar, setCalendar] = useState<ApiCalendarRace[]>([]);
  const [driverForm, setDriverForm] = useState<DriverFormMap>({});
  const [loading, setLoading] = useState(false); // Default to false to prevent layout shift if cache exists
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async (isInitial: boolean = false) => {
    // If initial, and we have valid cache, we can skip full loading state
    if (!isInitial) setLoading(true);
    
    try {
      const results = await Promise.allSettled([
        fetchDrivers(season),
        fetchCalendar(season),
        fetchRecentResults(season)
      ]);

      const [driversResult, calendarResult, formResult] = results;

      if (driversResult.status === 'fulfilled' && driversResult.value.length > 0) {
        setDrivers(driversResult.value);
        localStorage.setItem(`${STORAGE_KEYS.CACHE_DRIVERS}_${season}`, JSON.stringify(driversResult.value));
      }

      if (calendarResult.status === 'fulfilled' && calendarResult.value.length > 0) {
        setCalendar(calendarResult.value);
        localStorage.setItem(`${STORAGE_KEYS.CACHE_CALENDAR}_${season}`, JSON.stringify(calendarResult.value));
      }

      if (formResult.status === 'fulfilled' && Object.keys(formResult.value).length > 0) {
        setDriverForm(formResult.value);
        localStorage.setItem(`${STORAGE_KEYS.CACHE_DRIVER_FORM}_${season}`, JSON.stringify(formResult.value));
      }

      // Only set error if all critical requests failed
      if (driversResult.status === 'rejected' && calendarResult.status === 'rejected') {
        throw new Error('Critical F1 data could not be fetched');
      }

      setError(null);
    } catch (err) {
      console.error('Error in useF1Data:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch F1 data'));
      
      // Fallback to static data ONLY if we have absolutely nothing else and it's the current year
      const currentYear = new Date().getFullYear();
      setDrivers(prev => (prev.length === 0 && season === currentYear) ? (FALLBACK_DRIVERS as unknown as Driver[]) : prev);
    } finally {
      setLoading(false);
    }
  }, [season]);

  // 1. Cache Load & Refresh Trigger
  useEffect(() => {
    // Load from cache for the specific season
    let hasValidCache = false;
    try {
      const cachedDrivers = localStorage.getItem(`${STORAGE_KEYS.CACHE_DRIVERS}_${season}`);
      const cachedCalendar = localStorage.getItem(`${STORAGE_KEYS.CACHE_CALENDAR}_${season}`);
      const cachedForm = localStorage.getItem(`${STORAGE_KEYS.CACHE_DRIVER_FORM}_${season}`);

      if (cachedDrivers && cachedCalendar) {
        setDrivers(JSON.parse(cachedDrivers));
        setCalendar(JSON.parse(cachedCalendar));
        if (cachedForm) setDriverForm(JSON.parse(cachedForm));
        hasValidCache = true;
      } else {
        // Clear stale state from previously viewed seasons if no cache exists for the current one.
        // This ensures the user sees a clean loading state instead of old data.
        setDrivers([]);
        setCalendar([]);
        setDriverForm({});
      }
    } catch (e) {
      console.warn('useF1Data: Failed to load cache', e);
    }

    // Always trigger a background refresh to ensure freshness for the selected season.
    fetchData(hasValidCache);
  }, [fetchData, season]);

  return { drivers, calendar, driverForm, loading, error, refresh: () => fetchData(false) };
}
