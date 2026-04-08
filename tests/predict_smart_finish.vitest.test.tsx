import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import PredictPage from '@/app/predict/page';
import { server } from './setup';
import { http, HttpResponse } from 'msw';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// --- Mocks for non-cloud components/hooks ---
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: vi.fn(() => ({
    session: { user: { id: 'test-user-uuid' } },
    currentUser: 'test-user-uuid',
    displayName: 'Test User',
    isAdmin: false,
    hasSession: true,
    isAuthLoading: false,
    syncVersion: 0,
    profile: { username: 'test-user' },
    setProfile: vi.fn(),
    logout: vi.fn(),
    refreshAuth: vi.fn(),
    triggerRefresh: vi.fn(),
  }))
}));

vi.mock('@/components/Notification', () => ({
  useNotification: () => ({ showNotification: vi.fn() })
}));

vi.mock('@/lib/hooks/use-realtime-sync', () => ({
  useRealtimeSync: vi.fn()
}));

// We still mock time-related utils to control the "race active" state
vi.mock('@/lib/utils/time', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    isRaceActive: vi.fn().mockReturnValue(true)
  };
});

// For some constants and helpers that we don't want to rely on live data for
vi.mock('@/lib/data', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    CURRENT_SEASON: 2026
  };
});

describe('PredictPage Smart Finish Integration (MSW)', () => {
  const mockDrivers = [
    { driverId: 'albon', givenName: 'Alexander', familyName: 'Albon', code: 'ALB', permanentNumber: '23' },
    { driverId: 'perez', givenName: 'Sergio', familyName: 'Perez', code: 'PER', permanentNumber: '11' }
  ];

  const mockStandings = {
    MRData: {
      StandingsTable: {
        StandingsLists: [{
          DriverStandings: mockDrivers.map(d => ({
            points: '0',
            Driver: d,
            Constructors: [{ constructorId: 'williams', name: 'Williams' }]
          }))
        }]
      }
    }
  };

  const mockCalendar = {
    MRData: {
      RaceTable: {
        Races: [
          { 
            season: '2026', 
            round: '1', 
            raceName: 'Test GP', 
            date: '2026-03-01', 
            time: '10:00:00Z',
            Circuit: { circuitName: 'Test Circuit' }
          }
        ]
      }
    }
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    // Set time to 1 hour after race start
    vi.setSystemTime(new Date('2026-03-01T11:00:00Z'));

    // MSW Handlers for Ergast & Supabase
    server.use(
      // 1. Ergast Calendar
      http.get('https://api.jolpi.ca/ergast/f1/2026.json', () => {
        return HttpResponse.json(mockCalendar);
      }),
      // 2. Ergast Driver Standings
      http.get('https://api.jolpi.ca/ergast/f1/2026/driverStandings.json', () => {
        return HttpResponse.json(mockStandings);
      }),
      // 3. Ergast Round 1 results (fallback for numbers)
      http.get('https://api.jolpi.ca/ergast/f1/2026/1/results.json', () => {
        return HttpResponse.json({ MRData: { RaceTable: { Races: [] } } });
      }),
      // 4. Ergast Recent Results
      http.get('https://api.jolpi.ca/ergast/f1/2026/results.json', () => {
        return HttpResponse.json({ MRData: { RaceTable: { Races: [] } } });
      }),
      // 5. Supabase Predictions
      http.get('https://mock-project.supabase.co/rest/v1/predictions', () => {
        return HttpResponse.json([{ p10_driver_id: 'albon', dnf_driver_id: 'perez' }]);
      }),
      // 6. Supabase Profiles
      http.get('https://mock-project.supabase.co/rest/v1/profiles', () => {
        return HttpResponse.json([]);
      }),
      // 7. Supabase Live Proxy (Edge Function)
      http.post('https://mock-project.supabase.co/functions/v1/f1-live-proxy', () => {
        return HttpResponse.json({ 
          status: 'Finished', 
          results: [], 
          lastUpdated: new Date().toISOString() 
        });
      })
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    server.resetHandlers();
  });

  it('unmounts LiveRaceCenter and mounts RESULTS PENDING badge when race finishes', async () => {
    render(<PredictPage />);
    
    // We should see the results pending badge instead of "Live Timing" or "Predictions Closed"
    // The sequence:
    // 1. PredictPage initializes
    // 2. useF1Data fetches Ergast data
    // 3. useF1LiveTiming fetches Supabase proxy (returns 'Finished')
    // 4. LiveRaceCenter receives 'Finished' and calls handleRaceFinish
    // 5. PredictPage sets hasRaceFinished=true
    // 6. Render RESULTS PENDING
    
    const badge = await screen.findByText('RESULTS PENDING', {}, { timeout: 5000 });
    const subtitle = await screen.findByText('Results Pending', {}, { timeout: 1000 });
    
    expect(badge).toBeDefined();
    expect(subtitle).toBeDefined();
    
    // Verify LiveRaceCenter is no longer rendered (it has a specific test-id or text)
    // LiveRaceCenter shows "LIVE DATA" badge when active
    const liveBadge = screen.queryByText('LIVE DATA');
    expect(liveBadge).toBeNull();
  });
});
