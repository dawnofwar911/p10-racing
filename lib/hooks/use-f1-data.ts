'use client';

import { useState, useEffect, useCallback } from 'react';
import { ApiCalendarRace, fetchDrivers, fetchCalendar } from '@/lib/api';
import { Driver } from '@/lib/types';
import { CURRENT_SEASON, DRIVERS as FALLBACK_DRIVERS } from '@/lib/data';
import { STORAGE_KEYS } from '@/lib/utils/storage';

export interface UseF1DataReturn {
  drivers: Driver[];
  calendar: ApiCalendarRace[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/**
 * Custom hook to fetch and cache F1 drivers and calendar data.
 * It provides immediate data from localStorage (if available) to avoid pop-in.
 */
export function useF1Data(season: number = CURRENT_SEASON): UseF1DataReturn {
  const [drivers, setDrivers] = useState<Driver[]>(() => {
    if (typeof window === 'undefined') return FALLBACK_DRIVERS as unknown as Driver[];
    const cached = localStorage.getItem(STORAGE_KEYS.CACHE_DRIVERS);
    return cached ? JSON.parse(cached) : FALLBACK_DRIVERS as unknown as Driver[];
  });

  const [calendar, setCalendar] = useState<ApiCalendarRace[]>(() => {
    if (typeof window === 'undefined') return [];
    // Note: If we don't have a full calendar cache key yet, we'll just start empty.
    const fullCalendar = localStorage.getItem(STORAGE_KEYS.CACHE_CALENDAR); 
    return fullCalendar ? JSON.parse(fullCalendar) : [];
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [driversData, calendarData] = await Promise.all([
        fetchDrivers(season),
        fetchCalendar(season)
      ]);

      if (driversData.length > 0) {
        setDrivers(driversData);
        localStorage.setItem(STORAGE_KEYS.CACHE_DRIVERS, JSON.stringify(driversData));
      }

      if (calendarData.length > 0) {
        setCalendar(calendarData);
        localStorage.setItem(STORAGE_KEYS.CACHE_CALENDAR, JSON.stringify(calendarData));
      }

      setError(null);
    } catch (err) {
      console.error('Error in useF1Data:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch F1 data'));
    } finally {
      setLoading(false);
    }
  }, [season]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { drivers, calendar, loading, error, refresh: fetchData };
}
