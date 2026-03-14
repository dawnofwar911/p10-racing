import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import Home from '@/app/page';
import { createClient } from '@/lib/supabase/client';
import * as api from '@/lib/api';

// Mock Supabase
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
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
        single: vi.fn(() => Promise.resolve({ data: null, error: null })),
      })),
    })),
  })),
}));

// Mock API
vi.mock('@/lib/api', () => ({
  fetchCalendar: vi.fn(),
  fetchDrivers: vi.fn(),
}));

// Mock useRouter
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: vi.fn(),
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

  it('removes the prediction card once the race has started (and next race is fetched)', async () => {
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
    // Prediction only for Race 1
    localStorage.setItem('final_pred_2026_testuser_1', JSON.stringify({ p10: 'max_verstappen', dnf: 'leclerc' }));

    // Mock date to AFTER Race 1 has started (next race should be Race 2)
    vi.setSystemTime(new Date('2026-03-15T06:00:00Z'));

    render(<Home />);

    await waitFor(() => {
      // Should show Next Race: Chinese Grand Prix in the "Next Race" section
      const nextRaceSection = screen.getByText(/Next Race/i).closest('div');
      expect(nextRaceSection?.textContent).toContain('Chinese Grand Prix');
    }, { timeout: 2000 });

    // Should NOT show the prediction card for Australian Grand Prix anymore
    expect(screen.queryByText(/Your Australian Grand Prix Picks/i)).toBeNull();
    // And should NOT show a card for Chinese GP because no prediction exists yet
    expect(screen.queryByText(/Your Chinese Grand Prix Picks/i)).toBeNull();
  });
});
