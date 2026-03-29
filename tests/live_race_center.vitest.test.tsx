import { describe, it, expect, beforeEach, beforeAll, afterEach, afterAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import LiveRaceCenter from '@/components/LiveRaceCenter';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const mockDrivers = [
  { id: 'max_verstappen', name: 'Max Verstappen', code: 'VER', color: '#3671C6', team: 'Red Bull Racing', teamId: 'red_bull', number: 1, points: 0 },
  { id: 'leclerc', name: 'Charles Leclerc', code: 'LEC', color: '#E8002D', team: 'Ferrari', teamId: 'ferrari', number: 16, points: 0 },
  { id: 'norris', name: 'Lando Norris', code: 'NOR', color: '#FF8000', team: 'McLaren', teamId: 'mclaren', number: 4, points: 0 },
  { id: 'albon', name: 'Alexander Albon', code: 'ALB', color: '#64C4FF', team: 'Williams', teamId: 'williams', number: 23, points: 0 },
  { id: 'alonso', name: 'Fernando Alonso', code: 'ALO', color: '#27F4D2', team: 'Aston Martin', teamId: 'aston_martin', number: 14, points: 0 },
  { id: 'hamilton', name: 'Lewis Hamilton', code: 'HAM', color: '#27F4D2', team: 'Mercedes', teamId: 'mercedes', number: 44, points: 0 },
  { id: 'perez', name: 'Sergio Perez', code: 'PER', color: '#3671C6', team: 'Red Bull Racing', teamId: 'red_bull', number: 11, points: 0 }
];

const server = setupServer();

describe('LiveRaceCenter Component', () => {
  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('should not render if race is not in progress', () => {
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

  it('should show loading state', async () => {
    server.use(
      http.post('https://mock-project.supabase.co/functions/v1/f1-live-proxy', () => {
        return new Promise((resolve) => setTimeout(() => resolve(HttpResponse.json({})), 100));
      })
    );

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

    server.use(
      http.post('https://mock-project.supabase.co/functions/v1/f1-live-proxy', () => {
        return HttpResponse.json(mockData);
      })
    );
    
    render(
      <LiveRaceCenter 
        p10Prediction="albon" 
        dnfPrediction="perez" 
        drivers={mockDrivers as any} 
        isRaceInProgress={true} 
      />
    );
    
    // Check P10 status badge (Albon is P10 in mock data)
    expect(await screen.findByText('Your P10 Pick')).toBeDefined();
    const p10PickContainer = screen.getByText('Your P10 Pick').parentElement;
    const p10Badge = p10PickContainer?.querySelector('.badge');
    expect(p10Badge?.className).toMatch(/bg-success/);

    // Check DNF status badge (Perez is retired in mock data)
    expect(await screen.findByText('Your DNF Pick')).toBeDefined();
    const dnfPickContainer = screen.getByText('Your DNF Pick').parentElement;
    const dnfBadge = dnfPickContainer?.querySelector('.badge');
    expect(dnfBadge?.className).toMatch(/bg-success/);

    // Check P10 battle list
    expect(screen.getByText('Alexander Albon')).toBeDefined();
    expect(screen.getByText('YOUR PICK')).toBeDefined();
    expect(screen.getByText('RETIRED:')).toBeDefined();
    expect(screen.getAllByText('PER').length).toBe(2);
  });

  it('should handle error state', async () => {
    server.use(
      http.post('https://mock-project.supabase.co/functions/v1/f1-live-proxy', () => {
        return new HttpResponse(null, { status: 500 });
      })
    );
    
    render(
      <LiveRaceCenter 
        p10Prediction="albon" 
        dnfPrediction="perez" 
        drivers={mockDrivers as any} 
        isRaceInProgress={true} 
      />
    );
    
    expect(await screen.findByText(/Waiting for live timing data/i)).toBeDefined();
  });

  it('should show stale data warning when lastUpdated is old', async () => {
    const staleDate = new Date(Date.now() - 300000).toISOString(); // 5 mins ago
    const mockData = {
      status: 'Finished',
      results: [],
      lastUpdated: staleDate
    };

    server.use(
      http.post('https://mock-project.supabase.co/functions/v1/f1-live-proxy', () => {
        return HttpResponse.json(mockData);
      })
    );
    
    render(
      <LiveRaceCenter 
        p10Prediction="albon" 
        dnfPrediction="perez" 
        drivers={mockDrivers as any} 
        isRaceInProgress={true} 
      />
    );
    
    expect(await screen.findByText(/STALE DATA/i)).toBeDefined();
    expect(screen.getByText(/Outdated data. Reconnecting/i)).toBeDefined();
  });
});
