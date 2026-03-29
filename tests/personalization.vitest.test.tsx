import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import SettingsPage from '@/app/settings/page';

interface SupabaseResponse {
  data: any;
  error: any;
}

// Stable session to avoid infinite re-renders
const mockSession = { user: { id: 'user-123' } };

// Stable profile data for mocks
const mockProfileData = { id: 'user-123', username: 'testuser', favorite_team: 'ferrari', favorite_driver: 'leclerc' };

// Mock Supabase
const mockSupabase = {
  from: vi.fn(() => mockSupabase),
  select: vi.fn(() => mockSupabase),
  update: vi.fn(() => mockSupabase),
  eq: vi.fn(() => mockSupabase),
  single: vi.fn((): Promise<SupabaseResponse> => Promise.resolve({ 
    data: mockProfileData, 
    error: null 
  })),
};

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockSupabase,
}));

// Mock Auth
vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({
    session: mockSession,
    isAdmin: false,
    user: mockSession.user
  }),
}));

// Mock F1 Data
vi.mock('@/lib/hooks/use-f1-data', () => ({
  useF1Data: () => ({
    drivers: [
      { id: 'leclerc', name: 'Charles Leclerc', code: 'LEC', team: 'Ferrari', teamId: 'ferrari', color: '#E80020' },
      { id: 'hamilton', name: 'Lewis Hamilton', code: 'HAM', team: 'Ferrari', teamId: 'ferrari', color: '#E80020' },
      { id: 'verstappen', name: 'Max Verstappen', code: 'VER', team: 'Red Bull Racing', teamId: 'red_bull', color: '#3671C6' },
    ],
    loading: false
  }),
}));

// Mock Notification
const mockShowNotification = vi.fn();
vi.mock('@/components/Notification', () => ({
  useNotification: () => ({
    showNotification: mockShowNotification,
  }),
}));

describe('Settings Page - Personalization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default resolve for profile loading
    mockSupabase.single.mockResolvedValue({ 
      data: mockProfileData, 
      error: null 
    });
  });

  it('should load user profile and show personalization section', async () => {
    render(<SettingsPage />);
    
    expect(await screen.findByText(/Personalization/i)).toBeDefined();
    
    const teamSelect = await screen.findByLabelText(/Favorite Team/i) as HTMLSelectElement;
    const driverSelect = await screen.findByLabelText(/Favorite Driver/i) as HTMLSelectElement;
    
    await waitFor(() => {
      expect(teamSelect.value).toBe('ferrari');
      expect(driverSelect.value).toBe('leclerc');
    });
  });

  it('should update favorite team and show success notification', async () => {
    render(<SettingsPage />);
    
    // First call is for loadProfile, subsequent are for update
    mockSupabase.single
      .mockResolvedValueOnce({ data: mockProfileData, error: null }) // Initial load
      .mockResolvedValue({ data: null, error: null }); // Update result

    await screen.findByText(/Personalization/i);
    const teamSelect = await screen.findByLabelText(/Favorite Team/i);
    
    fireEvent.change(teamSelect, { target: { value: 'red_bull' } });
    
    await waitFor(() => {
      expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
      expect(mockSupabase.update).toHaveBeenCalledWith(expect.objectContaining({
        favorite_team: 'red_bull'
      }));
      expect(mockShowNotification).toHaveBeenCalledWith(expect.stringContaining('successfully'), 'success');
    });
  });

  it('should update favorite driver and show success notification', async () => {
    render(<SettingsPage />);
    
    mockSupabase.single
      .mockResolvedValueOnce({ data: mockProfileData, error: null }) // Initial load
      .mockResolvedValue({ data: null, error: null }); // Update result

    await screen.findByText(/Personalization/i);
    const driverSelect = await screen.findByLabelText(/Favorite Driver/i);
    
    fireEvent.change(driverSelect, { target: { value: 'verstappen' } });
    
    await waitFor(() => {
      expect(mockSupabase.update).toHaveBeenCalledWith(expect.objectContaining({
        favorite_driver: 'verstappen'
      }));
      expect(mockShowNotification).toHaveBeenCalledWith(expect.stringContaining('successfully'), 'success');
    });
  });
});
