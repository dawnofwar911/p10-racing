import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import LiveRaceCenter from '@/components/LiveRaceCenter';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const mockDrivers = [
  { id: 'leclerc', name: 'Charles Leclerc', code: 'LEC', color: '#E8002D', team: 'Ferrari', teamId: 'ferrari', number: 16, points: 0 },
  { id: 'albon', name: 'Alexander Albon', code: 'ALB', color: '#64C4FF', team: 'Williams', teamId: 'williams', number: 23, points: 0 },
];

const server = setupServer();

describe('LiveRaceCenter Expanded Features', () => {
  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('should show RESULTS PENDING when status is Completed (Smart Finish)', async () => {
    const mockData = {
      status: 'Completed',
      results: [
        { driverId: 'leclerc', acronym: 'LEC', position: 1, isRetired: false },
        { driverId: 'albon', acronym: 'ALB', position: 10, isRetired: false },
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
    
    expect(await screen.findByText(/RESULTS PENDING/i)).toBeDefined();
    expect(screen.getByText('Completed')).toBeDefined();
  });

  it('should show track status banner when not Green (Track Status)', async () => {
    const mockData = {
      status: 'Active',
      trackStatus: '5', // VSC
      trackMessage: 'VIRTUAL SAFETY CAR',
      results: [
        { driverId: 'leclerc', acronym: 'LEC', position: 1, isRetired: false },
        { driverId: 'albon', acronym: 'ALB', position: 10, isRetired: false },
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
    
    expect(await screen.findByText(/VIRTUAL SAFETY CAR/i)).toBeDefined();
  });

  it('should show tire data in the tracker (Tire Insights)', async () => {
    const mockData = {
      status: 'Active',
      results: [
        { 
          driverId: 'leclerc', 
          acronym: 'LEC', 
          position: 9, 
          isRetired: false,
          tyres: { compound: 'SOFT', laps: 12, isNew: false }
        },
        { 
          driverId: 'albon', 
          acronym: 'ALB', 
          position: 10, 
          isRetired: false,
          tyres: { compound: 'HARD', laps: 30, isNew: true }
        },
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
    
    expect(await screen.findByText('12L')).toBeDefined();
    expect(screen.getByText('30L')).toBeDefined();
  });
});
