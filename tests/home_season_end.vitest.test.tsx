import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import Home from '@/app/page';
import * as api from '@/lib/api';
import * as results from '@/lib/results';
import { STORAGE_KEYS } from '@/lib/utils/storage';

// Mock useAuth
vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({
    currentUser: 'test_champion',
    session: null,
    hasSession: false,
    isAuthLoading: false,
    syncVersion: 0,
    logout: vi.fn(),
    triggerRefresh: vi.fn(),
  }),
}));

// Mock Supabase
vi.mock('@/lib/supabase/client', () => {
  const mockFrom = vi.fn((table: string) => {
    return {
      select: vi.fn((query: string) => {
        const result = {
          data: [],
          error: null,
          ilike: vi.fn(() => Promise.resolve({ data: [], error: null })),
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
          })),
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        };
        // If it's the profiles table, return empty data for now, 
        // but it MUST be a Promise that resolves to {data, error}
        return Object.assign(Promise.resolve(result), result);
      }),
    };
  });

  return {
    createClient: vi.fn(() => ({
      auth: {
        getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
      },
      from: mockFrom,
    })),
  };
});

// Mock API
vi.mock('@/lib/api', () => ({
  fetchCalendar: vi.fn(),
  fetchDrivers: vi.fn(),
  fetchRaceResults: vi.fn(),
  fetchRecentResults: vi.fn(),
  getFirstDnfDriver: vi.fn(),
}));

// Mock results
vi.mock('@/lib/results', () => ({
  fetchAllSimplifiedResults: vi.fn(),
}));

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, initial, animate, transition, ...props }: any) => (
      <div className={className} {...props}>{children}</div>
    ),
    h2: ({ children, className, ...props }: any) => (
      <h2 className={className} {...props}>{children}</h2>
    ),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock other components/hooks
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

vi.mock('@/components/Notification', () => ({
  useNotification: () => ({ showNotification: vi.fn() }),
}));

// Mock useF1Data
vi.mock('@/lib/hooks/use-f1-data', () => ({
  useF1Data: vi.fn(() => ({
    drivers: [{ id: 'max_verstappen', name: 'Max Verstappen', code: 'VER', color: '#3671C6' }],
    calendar: [{
      round: '1',
      raceName: 'Season Finale GP',
      Circuit: { circuitName: 'Yas Marina' },
      date: '2026-12-01',
      time: '14:00:00Z'
    }],
    loading: false,
    error: null,
    refresh: vi.fn(),
  })),
}));

// Mock isTestAccount
vi.mock('@/lib/utils/profiles', () => ({
  isTestAccount: vi.fn(() => false),
}));

describe('Home Page - Season End Celebration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.useFakeTimers({ toFake: ['Date'] });
    
    // Mock drivers
    (api.fetchDrivers as any).mockResolvedValue([
      { id: 'max_verstappen', name: 'Max Verstappen', code: 'VER', color: '#3671C6' }
    ]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the Season Champion card when the season is finished', async () => {
    const lastRace = {
      round: '1',
      raceName: 'Season Finale GP',
      Circuit: { circuitName: 'Yas Marina' },
      date: '2026-12-01',
      time: '14:00:00Z'
    };
    
    (api.fetchCalendar as any).mockResolvedValue([lastRace]);
    
    // Mock results for the last race
    const mockResults = {
      '1': {
        positions: { 'max_verstappen': 10 },
        firstDnf: 'leclerc',
        date: new Date('2026-12-01T14:00:00Z')
      }
    };
    (results.fetchAllSimplifiedResults as any).mockResolvedValue(mockResults);

    // Mock localStorage predictions for a champion
    localStorage.setItem(STORAGE_KEYS.PLAYERS_LIST, JSON.stringify(['test_champion']));
    // test_champion predicted P10 correctly. USE THE CORRECT PREFIX!
    const predKey = `final_pred_2026_test_champion_1`;
    localStorage.setItem(predKey, JSON.stringify({ p10: 'max_verstappen', dnf: 'leclerc' }));

    // Set time to AFTER the last race + 4 hours
    vi.setSystemTime(new Date('2026-12-02T12:00:00Z'));

    render(<Home />);

    // Wait for "Season Champion" text
    await waitFor(() => {
      expect(screen.getByText(/Season Champion/i)).toBeDefined();
    }, { timeout: 3000 });

    // Verify the champion's name is displayed
    expect(screen.getByText(/TEST_CHAMPION/i)).toBeDefined();
    
    // Verify the CTA button
    expect(screen.getByText(/VIEW FINAL STANDINGS/i)).toBeDefined();
    
    // Ensure "Make Prediction" is NOT shown, but "View Season Recap" IS (or History)
    expect(screen.queryByText(/MAKE PREDICTION/i)).toBeNull();
    expect(screen.getByText(/VIEW SEASON RECAP/i)).toBeDefined();
  });
});
