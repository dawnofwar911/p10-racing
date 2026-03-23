import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import Home from '@/app/page';
import { createClient } from '@/lib/supabase/client';
import * as api from '@/lib/api';
import { STORAGE_KEYS, getPredictionKey } from '@/lib/utils/storage';

// Mock useAuth
vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({
    currentUser: localStorage.getItem(STORAGE_KEYS.CURRENT_USER),
    session: null,
    hasSession: false,
    isAuthLoading: false,
    syncVersion: 0,
    logout: vi.fn(),
    triggerRefresh: vi.fn(),
  }),
}));

// Mock Supabase
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
    },
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    })),
    removeChannel: vi.fn().mockResolvedValue(null),
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
  })),
}));

// Mock API
vi.mock('@/lib/api', () => ({
  fetchCalendar: vi.fn(),
  fetchDrivers: vi.fn(),
  fetchRaceResults: vi.fn(),
  getFirstDnfDriver: vi.fn(),
}));

// Mock sessionTracker
vi.mock('@/lib/utils/session', () => ({
  sessionTracker: {
    isFirstView: () => true,
    isInitialLoadNeeded: () => true,
    markInitialLoadComplete: vi.fn(),
    resetVisitedPages: vi.fn(),
  }
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
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
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, 'testuser');
    const prediction = { p10: 'max_verstappen', dnf: 'leclerc' };
    localStorage.setItem(getPredictionKey(2026, 'testuser', '1'), JSON.stringify(prediction));

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
    
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, 'testuser');
    // Prediction for Race 1
    localStorage.setItem(getPredictionKey(2026, 'testuser', '1'), JSON.stringify({ p10: 'max_verstappen', dnf: 'leclerc' }));

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
    
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, 'testuser');
    localStorage.setItem(getPredictionKey(2026, 'testuser', '1'), JSON.stringify({ p10: 'max_verstappen', dnf: 'leclerc' }));

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

  it('updates prediction card immediately when STORAGE_UPDATE_EVENT is fired', async () => {
    const { CURRENT_SEASON } = await import('@/lib/data');
    const { getPredictionKey, STORAGE_KEYS, STORAGE_UPDATE_EVENT } = await import('@/lib/utils/storage');
    
    const nextRace = {
      id: '1',
      name: 'Australian Grand Prix',
      circuit: 'Albert Park',
      date: '2026-03-15',
      time: '05:00:00Z',
      round: 1
    };
    (api.fetchCalendar as any).mockResolvedValue([
      {
        round: '1',
        raceName: 'Australian Grand Prix',
        Circuit: { circuitName: 'Albert Park' },
        date: '2026-03-15',
        time: '05:00:00Z'
      }
    ]);
    
    // Seed the race cache and user
    const testUser = 'testuser';
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, testUser);
    localStorage.setItem(STORAGE_KEYS.CACHE_NEXT_RACE, JSON.stringify(nextRace));

    // Mock date to BEFORE the race
    vi.setSystemTime(new Date('2026-03-14T12:00:00Z'));

    const { render: tlRender, act } = await import('@testing-library/react');
    tlRender(<Home />);

    // Wait for the page to show the race name in the hero description
    await waitFor(() => {
      const heroText = screen.getByText(/Predict the 10th place finisher/i);
      expect(heroText.textContent).toContain('Australian Grand Prix');
    });

    // Simulate another page saving a prediction
    const newPred = { p10: 'max_verstappen', dnf: 'leclerc' };
    const predKey = getPredictionKey(CURRENT_SEASON, testUser, '1');
    
    await act(async () => {
      localStorage.setItem(predKey, JSON.stringify(newPred));
      window.dispatchEvent(new CustomEvent(STORAGE_UPDATE_EVENT, { 
        detail: { key: predKey } 
      }));
    });

    // Prediction card should appear without reload
    const cardTitle = await screen.findByText(/Your Australian Grand Prix Picks/i, {}, { timeout: 4000 });
    expect(cardTitle).toBeDefined();
    expect(screen.getByText(/VERSTAPPEN/i)).toBeDefined();
  });
});
