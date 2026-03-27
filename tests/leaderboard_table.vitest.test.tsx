import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import LeaderboardTable from '@/components/LeaderboardTable';
import { LeaderboardEntry } from '@/lib/data';
import { Driver } from '@/lib/types';

// Mock drivers data
const mockDrivers: Driver[] = [
  { id: 'max_verstappen', name: 'Max Verstappen', code: 'VER', color: '#3671C6', team: 'Red Bull Racing', teamId: 'red_bull', number: 1, points: 0 },
  { id: 'leclerc', name: 'Charles Leclerc', code: 'LEC', color: '#E8002D', team: 'Ferrari', teamId: 'ferrari', number: 16, points: 0 },
  { id: 'norris', name: 'Lando Norris', code: 'NOR', color: '#FF8000', team: 'McLaren', teamId: 'mclaren', number: 4, points: 0 },
  { id: 'albon', name: 'Alexander Albon', code: 'ALB', color: '#64C4FF', team: 'Williams', teamId: 'williams', number: 23, points: 0 },
];

describe('LeaderboardTable Component', () => {
  const mockEntries: LeaderboardEntry[] = [
    { rank: 1, player: 'Verstappen', points: 300, lastRacePoints: 25, breakdown: { p10Driver: 'verstappen', p10Points: 25, actualP10Pos: 1, dnfDriver: 'leclerc', dnfPoints: 0 }, history: [] },
    { rank: 2, player: 'Leclerc', points: 250, lastRacePoints: 18, breakdown: { p10Driver: 'sainz', p10Points: 0, actualP10Pos: 10, dnfDriver: 'leclerc', dnfPoints: 25 }, history: [] },
    { rank: 3, player: 'Norris', points: 200, lastRacePoints: 10, breakdown: { p10Driver: 'norris', p10Points: 0, actualP10Pos: 9, dnfDriver: 'hamilton', dnfPoints: 0 }, history: [] },
  ];

  it('renders loading spinner when loading', () => {
    render(
      <LeaderboardTable 
        entries={[]} 
        loading={true} 
        currentUser="testuser" 
        drivers={mockDrivers}
      />
    );
    expect(screen.getByTestId('loading-spinner')).toBeDefined();
  });

  it('renders empty message when no entries are provided and not loading', () => {
    render(
      <LeaderboardTable 
        entries={[]} 
        loading={false} 
        currentUser="testuser" 
        drivers={mockDrivers}
      />
    );
    expect(screen.getByText('No entries yet.')).toBeDefined();
  });

  it('renders leaderboard entries correctly', () => {
    render(
      <LeaderboardTable 
        entries={mockEntries} 
        loading={false} 
        currentUser="Verstappen" 
        drivers={mockDrivers}
      />
    );

    expect(screen.getByText('Pos')).toBeDefined();
    expect(screen.getByText('Player')).toBeDefined();
    expect(screen.getByText('Total')).toBeDefined();
    
    expect(screen.getByText('Verstappen')).toBeDefined();
    expect(screen.getByText('300')).toBeDefined();
    expect(screen.getByText('YOU')).toBeDefined();
  });

  it('renders champion badge when season is complete', () => {
    render(
      <LeaderboardTable 
        entries={mockEntries} 
        loading={false} 
        isSeasonComplete={true} 
        drivers={mockDrivers}
      />
    );
    expect(screen.getByText('CHAMPION')).toBeDefined();
  });
});
