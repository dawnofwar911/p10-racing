import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import Home from '@/app/page';
import { createClient } from '@/lib/supabase/client';
import * as api from '@/lib/api';

// Mock Supabase
const mockSupabaseClient = {
  auth: {
    getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
  },
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
      like: vi.fn(() => ({
        select: vi.fn(() => Promise.resolve({ data: [], error: null })),
        // Add support for further chaining if needed
        eq: vi.fn(() => Promise.resolve({ data: [], error: null })),
        single: vi.fn(() => Promise.resolve({ data: null, error: null })),
      })),
      single: vi.fn(() => Promise.resolve({ data: null, error: null })),
    })),
  })),
};

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
  createServerClient: vi.fn(() => mockSupabaseClient),
}));

// Mock API
vi.mock('@/lib/api', () => ({
  fetchCalendar: vi.fn(),
  fetchDrivers: vi.fn(),
  fetchRaceResults: vi.fn(),
  getFirstDnfDriver: vi.fn(),
}));

// Mock useRouter
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: vi.fn(),
    push: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
  }),
}));

// Mock useNotification
vi.mock('@/components/Notification', () => ({
  useNotification: () => ({
    showNotification: vi.fn(),
  }),
}));

// Mock Haptics
vi.mock('@capacitor/haptics', () => ({
  Haptics: {
    impact: vi.fn(),
  },
  ImpactStyle: {
    Medium: 'MEDIUM',
  },
}));

describe('Home Page Prediction Card Visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.useFakeTimers({ toFake: ['Date'] });
    // Default mock implementation
    (api.fetchDrivers as any).mockResolvedValue([{ id: 'max_verstappen', name: 'Max Verstappen' }]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the prediction card when a local prediction exists for the next race', async () => {
    const nextRace = {
      round: '1',
      raceName: 'Australian Grand Prix',
      Circuit: { circuitName: 'Albert Park' },
      date: '2026-03-15',
      time: '05:00:00Z'
    };
    (api.fetchCalendar as any).mockResolvedValue([nextRace]);
    
    // Set current user and prediction in localStorage
    localStorage.setItem('p10_current_user', 'testuser');
    const prediction = { p10: 'max_verstappen', dnf: 'leclerc' };
    localStorage.setItem('final_pred_2026_testuser_1', JSON.stringify(prediction));

    // Mock date to BEFORE the race
    vi.setSystemTime(new Date('2026-03-14T12:00:00Z'));

    render(<Home />);

    await waitFor(() => {
      // Check for the card title specifically
      expect(screen.getByText(/Your Australian Grand Prix Picks/i)).toBeDefined();
    }, { timeout: 2000 });

    expect(screen.getByText(/VERSTAPPEN/i)).toBeDefined();
    expect(screen.getByText(/LECLERC/i)).toBeDefined();
    expect(screen.getByText(/SHARE PICKS/i)).toBeDefined();
  });

  it('keeps the prediction card visible and shows locked status within 4 hours of race start', async () => {
    const race1 = {
      round: '1',
      raceName: 'Australian Grand Prix',
      Circuit: { circuitName: 'Albert Park' },
      date: '2026-03-15',
      time: '05:00:00Z'
    };
    const race2 = {
      round: '2',
      raceName: 'Chinese Grand Prix',
      Circuit: { circuitName: 'Shanghai' },
      date: '2026-03-22',
      time: '07:00:00Z'
    };
    (api.fetchCalendar as any).mockResolvedValue([race1, race2]);
    
    localStorage.setItem('p10_current_user', 'testuser');
    // Prediction for Race 1
    localStorage.setItem('final_pred_2026_testuser_1', JSON.stringify({ p10: 'max_verstappen', dnf: 'leclerc' }));

    // Mock date to 1 HOUR AFTER Race 1 start (still within 4 hour window)
    vi.setSystemTime(new Date('2026-03-15T06:00:00Z'));

    render(<Home />);

    await waitFor(() => {
      // Should STILL show Australian Grand Prix Picks
      expect(screen.getByText(/Your Australian Grand Prix Picks/i)).toBeDefined();
      // Should show the lock icon
      expect(screen.getByText(/🔒/i)).toBeDefined();
      // Should show Race In Progress
      expect(screen.getByText(/Race In Progress/i)).toBeDefined();
    }, { timeout: 2000 });
  });

  it('removes the prediction card and switches to next race after 4 hours', async () => {
    const race1 = {
      round: '1',
      raceName: 'Australian Grand Prix',
      Circuit: { circuitName: 'Albert Park' },
      date: '2026-03-15',
      time: '05:00:00Z'
    };
    const race2 = {
      round: '2',
      raceName: 'Chinese Grand Prix',
      Circuit: { circuitName: 'Shanghai' },
      date: '2026-03-22',
      time: '07:00:00Z'
    };
    (api.fetchCalendar as any).mockResolvedValue([race1, race2]);
    
    localStorage.setItem('p10_current_user', 'testuser');
    localStorage.setItem('final_pred_2026_testuser_1', JSON.stringify({ p10: 'max_verstappen', dnf: 'leclerc' }));

    // Mock date to 5 HOURS AFTER Race 1 start (past 4 hour window)
    vi.setSystemTime(new Date('2026-03-15T10:00:00Z'));

    render(<Home />);

    await waitFor(() => {
      // Should now show Next Race: Chinese Grand Prix
      const nextRaceSection = screen.getByText(/Next Race/i).closest('div');
      expect(nextRaceSection?.textContent).toContain('Chinese Grand Prix');
    }, { timeout: 2000 });

    // Should NOT show the prediction card for Australian Grand Prix anymore
    expect(screen.queryByText(/Your Australian Grand Prix Picks/i)).toBeNull();
  });
});
