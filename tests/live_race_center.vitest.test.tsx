import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import LiveRaceCenter from '@/components/LiveRaceCenter';
import { useF1LiveTiming } from '@/lib/hooks/use-f1-live-timing';

// Mock the hook
vi.mock('@/lib/hooks/use-f1-live-timing', () => ({
  useF1LiveTiming: vi.fn()
}));

const mockDrivers = [
  { id: 'max_verstappen', name: 'Max Verstappen', code: 'VER', color: '#3671C6', team: 'Red Bull Racing', teamId: 'red_bull', number: 1, points: 0 },
  { id: 'leclerc', name: 'Charles Leclerc', code: 'LEC', color: '#E8002D', team: 'Ferrari', teamId: 'ferrari', number: 16, points: 0 },
  { id: 'norris', name: 'Lando Norris', code: 'NOR', color: '#FF8000', team: 'McLaren', teamId: 'mclaren', number: 4, points: 0 },
  { id: 'albon', name: 'Alexander Albon', code: 'ALB', color: '#64C4FF', team: 'Williams', teamId: 'williams', number: 23, points: 0 },
  { id: 'alonso', name: 'Fernando Alonso', code: 'ALO', color: '#27F4D2', team: 'Aston Martin', teamId: 'aston_martin', number: 14, points: 0 },
  { id: 'hamilton', name: 'Lewis Hamilton', code: 'HAM', color: '#27F4D2', team: 'Mercedes', teamId: 'mercedes', number: 44, points: 0 },
  { id: 'perez', name: 'Sergio Perez', code: 'PER', color: '#3671C6', team: 'Red Bull Racing', teamId: 'red_bull', number: 11, points: 0 },
  { id: 'sainz', name: 'Carlos Sainz', code: 'SAI', color: '#E8002D', team: 'Ferrari', teamId: 'ferrari', number: 55, points: 0 },
  { id: 'russell', name: 'George Russell', code: 'RUS', color: '#27F4D2', team: 'Mercedes', teamId: 'mercedes', number: 63, points: 0 },
  { id: 'piastri', name: 'Oscar Piastri', code: 'PIA', color: '#FF8000', team: 'McLaren', teamId: 'mclaren', number: 81, points: 0 }
];

describe('LiveRaceCenter Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not render if race is not in progress', () => {
    (useF1LiveTiming as any).mockReturnValue({ data: null, loading: false, error: null });
    
    const { container } = render(
      <LiveRaceCenter 
        p10Prediction="albon" 
        dnfPrediction="perez" 
        drivers={mockDrivers as any} 
        isRaceInProgress={false} 
      />
    );
    
    expect(container.firstChild).toBeNull();
  });

  it('should show loading state', () => {
    (useF1LiveTiming as any).mockReturnValue({ data: null, loading: true, error: null });
    
    render(
      <LiveRaceCenter 
        p10Prediction="albon" 
        dnfPrediction="perez" 
        drivers={mockDrivers as any} 
        isRaceInProgress={true} 
      />
    );
    
    expect(screen.getByText(/Connecting to Track/i)).toBeDefined();
  });

  it('should render live results and highlight user picks', async () => {
    const mockData = {
      status: 'Green',
      results: [
        { driverId: 'max_verstappen', acronym: 'VER', position: 1, isRetired: false },
        { driverId: 'leclerc', acronym: 'LEC', position: 8, isRetired: false },
        { driverId: 'norris', acronym: 'NOR', position: 9, isRetired: false },
        { driverId: 'albon', acronym: 'ALB', position: 10, isRetired: false },
        { driverId: 'alonso', acronym: 'ALO', position: 11, isRetired: false },
        { driverId: 'hamilton', acronym: 'HAM', position: 12, isRetired: false },
        { driverId: 'perez', acronym: 'PER', position: 19, isRetired: true }
      ],
      lastUpdated: new Date().toISOString()
    };

    (useF1LiveTiming as any).mockReturnValue({ data: mockData, loading: false, error: null });
    
    render(
      <LiveRaceCenter 
        p10Prediction="albon" 
        dnfPrediction="perez" 
        drivers={mockDrivers as any} 
        isRaceInProgress={true} 
      />
    );
    
    // Check P10 status badge (Albon is P10 in mock data)
    const p10Badge = screen.getByText('P10');
    expect(p10Badge.className).toContain('bg-success');

    // Check DNF status badge (Perez is retired in mock data)
    const dnfBadge = screen.getByText('DNF');
    expect(dnfBadge.className).toContain('bg-success');

    // Check P10 battle list
    expect(screen.getByText('Alexander Albon')).toBeDefined();
    expect(screen.getByText('YOUR PICK')).toBeDefined();
    expect(screen.getByText('RETIRED:')).toBeDefined();
    // Use getAllByText because PER appears in DNF pick and Retired list
    expect(screen.getAllByText('PER').length).toBe(2);
  });

  it('should handle error state', () => {
    (useF1LiveTiming as any).mockReturnValue({ data: null, loading: false, error: 'API Error' });
    
    render(
      <LiveRaceCenter 
        p10Prediction="albon" 
        dnfPrediction="perez" 
        drivers={mockDrivers as any} 
        isRaceInProgress={true} 
      />
    );
    
    expect(screen.getByText(/Waiting for live timing data/i)).toBeDefined();
  });
});
