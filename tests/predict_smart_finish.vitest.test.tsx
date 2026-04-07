import { render, screen, act } from '@testing-library/react';
import React from 'react';
import PredictPage from '@/app/predict/page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
          limit: vi.fn().mockResolvedValue({ data: [], error: null })
        }),
        in: vi.fn().mockResolvedValue({ data: [], error: null })
      })
    })
  })
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: vi.fn(() => ({
    session: null,
    currentUser: 'TestUser',
    displayName: 'Test User',
    isAdmin: false,
    hasSession: false,
    isAuthLoading: false,
    syncVersion: 0,
    profile: null,
    setProfile: vi.fn(),
    logout: vi.fn(),
    refreshAuth: vi.fn(),
    triggerRefresh: vi.fn(),
  }))
}));

vi.mock('@/components/Notification', () => ({
  useNotification: () => ({ showNotification: vi.fn() })
}));

vi.mock('@/lib/hooks/use-sync-predictions', () => ({
  useSyncPredictions: vi.fn(() => ({
    prediction: { p10: 'albon', dnf: 'perez' },
    loading: false,
    submitPrediction: vi.fn()
  }))
}));

vi.mock('@/lib/hooks/use-realtime-sync', () => ({
  useRealtimeSync: vi.fn()
}));

vi.mock('@/lib/hooks/use-f1-live-timing', () => ({
  useF1LiveTiming: vi.fn(() => ({
    data: { status: 'Finished', results: [], lastUpdated: new Date().toISOString() },
    loading: false,
    error: null,
    isStale: false,
    refetch: vi.fn()
  }))
}));

vi.mock('@/lib/api', () => ({
  fetchQualifyingResults: vi.fn().mockResolvedValue([]),
  fetchRaceResults: vi.fn().mockResolvedValue({ results: [], firstDnf: null }),
  fetchDrivers: vi.fn().mockResolvedValue([
    { id: 'albon', name: 'Alexander Albon', code: 'ALB', number: 23, team: 'Williams', teamId: 'williams', color: '#00A0DE', points: 0 },
    { id: 'perez', name: 'Sergio Perez', code: 'PER', number: 11, team: 'Red Bull Racing', teamId: 'red_bull', color: '#3671C6', points: 0 },
  ]),
  fetchCalendar: vi.fn().mockResolvedValue([
    { id: '1', round: '1', date: '2026-03-01', time: '10:00:00Z', raceName: 'Test GP', Circuit: { circuitName: 'Test Circuit' }, season: '2026' }
  ]),
  fetchRecentResults: vi.fn().mockResolvedValue({})
}));

vi.mock('@/lib/results', () => ({
  fetchAllSimplifiedResults: vi.fn().mockResolvedValue({})
}));

// Mock timer so the race is evaluated as "in progress"
const RACE_START = new Date('2026-03-01T10:00:00Z').getTime();
const CURRENT_TIME = RACE_START + 3600 * 1000; // 1 hour into the race

vi.mock('@/lib/data', () => ({
  CURRENT_SEASON: {
    year: '2026',
    races: [
      { id: '1', round: '1', date: '2026-03-01', time: '10:00:00Z', raceName: 'Test GP', Circuit: { circuitName: 'Test Circuit' }, season: '2026' }
    ],
    drivers: [
      { id: 'albon', name: 'Alexander Albon', code: 'ALB', number: 23, team: 'Williams', teamId: 'williams', color: '#00A0DE', points: 0 },
      { id: 'perez', name: 'Sergio Perez', code: 'PER', number: 11, team: 'Red Bull Racing', teamId: 'red_bull', color: '#3671C6', points: 0 },
    ],
    teams: []
  },
  LEGACY_FALLBACK_SEASON: '2024'
}));

vi.mock('@/lib/utils/time', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    isRaceActive: vi.fn().mockReturnValue(true)
  };
});

describe('PredictPage Smart Finish Integration', () => {

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-03-01T11:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('unmounts LiveRaceCenter and mounts RESULTS PENDING badge when race finishes', async () => {
    // We expect the proxy hit -> 'Finished' -> LiveRaceCenter calls onRaceFinish -> Page sets hasRaceFinished=true
    render(<PredictPage />);
    
    try {
      // We should see the results pending badge instead of "Predictions Closed"
      const badge = await screen.findByText('RESULTS PENDING', {}, { timeout: 3000 });
      const subtitle = await screen.findByText('Results Pending', {}, { timeout: 1000 });
      expect(badge).toBeDefined();
      expect(subtitle).toBeDefined();
    } catch(e) {
      throw e;
    }
  });
});
