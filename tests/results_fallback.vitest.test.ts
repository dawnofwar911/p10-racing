import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchAllSimplifiedResults } from '@/lib/results';
import { fetchCalendar, fetchRaceResults } from '@/lib/api';
import { createClient } from '@/lib/supabase/client';
import { CURRENT_SEASON } from '@/lib/data';
import { getResultsKey } from '@/lib/utils/storage';

// Mock dependencies
vi.mock('@/lib/api', () => ({
  fetchCalendar: vi.fn(),
  fetchRaceResults: vi.fn(),
  fetchRecentResults: vi.fn(),
  getFirstDnfDriver: vi.fn(),
  CURRENT_SEASON: 2026,
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(),
}));

describe('fetchAllSimplifiedResults fallback logic', () => {
  const mockSupabase = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    like: vi.fn().mockReturnThis(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (createClient as any).mockReturnValue(mockSupabase);
    window.localStorage.clear();
  });

  it('should prioritize Supabase verified_results (Gold Standard)', async () => {
    const mockRaces = [{ round: '1', date: '2026-03-15', time: '05:00:00Z', raceName: 'Australia', Circuit: { circuitName: 'Albert Park' } }];
    (fetchCalendar as any).mockResolvedValue(mockRaces);
    
    // Supabase returns verified results
    (mockSupabase.like as any).mockResolvedValue({
      data: [{ id: '2026_1', data: { positions: { 'verstappen': 1 }, firstDnf: 'sainz' } }]
    });

    const results = await fetchAllSimplifiedResults();
    
    expect(results['1']).toBeDefined();
    expect(results['1'].positions['verstappen']).toBe(1);
    expect(results['1'].firstDnf).toBe('sainz');
    expect(fetchRaceResults).not.toHaveBeenCalled();
  });

  it('should fall back to localStorage if Supabase results are missing', async () => {
    const mockRaces = [{ round: '1', date: '2026-03-15', time: '05:00:00Z', raceName: 'Australia', Circuit: { circuitName: 'Albert Park' } }];
    (fetchCalendar as any).mockResolvedValue(mockRaces);
    
    // Supabase returns empty
    (mockSupabase.like as any).mockResolvedValue({ data: [] });

    // localStorage has results
    const cachedData = { positions: { 'leclerc': 1 }, firstDnf: 'russell' };
    window.localStorage.setItem(getResultsKey(CURRENT_SEASON, 1), JSON.stringify(cachedData));

    const results = await fetchAllSimplifiedResults();
    
    expect(results['1']).toBeDefined();
    expect(results['1'].positions['leclerc']).toBe(1);
    expect(results['1'].firstDnf).toBe('russell');
    expect(fetchRaceResults).not.toHaveBeenCalled();
  });

  it('should fall back to API fetch if both Supabase and localStorage are missing', async () => {
    const mockRaces = [{ round: '1', date: '2026-03-15', time: '05:00:00Z', raceName: 'Australia', Circuit: { circuitName: 'Albert Park' } }];
    (fetchCalendar as any).mockResolvedValue(mockRaces);
    
    // Supabase returns empty
    (mockSupabase.like as any).mockResolvedValue({ data: [] });

    // API returns results
    const apiResult = {
      Results: [{ position: '1', Driver: { driverId: 'norris' } }],
    };
    (fetchRaceResults as any).mockResolvedValue(apiResult);
    
    // Mock getFirstDnfDriver return value
    const { getFirstDnfDriver } = await import('@/lib/api');
    (getFirstDnfDriver as any).mockReturnValue({ driverId: 'perez' });

    const results = await fetchAllSimplifiedResults();
    
    expect(results['1']).toBeDefined();
    expect(results['1'].positions['norris']).toBe(1);
    expect(results['1'].firstDnf).toBe('perez');
    expect(fetchRaceResults).toHaveBeenCalledWith(CURRENT_SEASON, 1);
    
    // Should also cache the result in localStorage
    expect(window.localStorage.getItem(getResultsKey(CURRENT_SEASON, 1))).toContain('norris');
  });
});
