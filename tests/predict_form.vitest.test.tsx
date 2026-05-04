import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import SelectionList from '@/components/SelectionList';
import styles from '@/components/SelectionList.module.css';

const mockDrivers = [
  { id: 'verstappen', name: 'Max Verstappen', team: 'Red Bull', teamId: 'red_bull', code: 'VER', number: 1, color: '#3671C6', points: 100 },
  { id: 'hamilton', name: 'Lewis Hamilton', team: 'Mercedes', teamId: 'mercedes', code: 'HAM', number: 44, color: '#27F4D2', points: 80 }
];

const mockForm = {
  'verstappen': [{ pos: 1, status: 'Finished' }, { pos: 1, status: 'Finished' }],
  'hamilton': [
    { pos: 10, status: 'Finished' }, 
    { pos: 15, status: 'Finished' }, 
    { pos: 20, status: 'Did not start' } // DNS
  ],
  'leclerc': [
    { pos: 18, status: 'Accident' } // DNF
  ]
};

describe('SelectionList - Driver Form Guides', () => {
  it('renders form badges with correct colors and hyphen for DNS', async () => {
    const driversWithLeclerc = [
      ...mockDrivers,
      { id: 'leclerc', name: 'Charles Leclerc', team: 'Ferrari', teamId: 'ferrari', code: 'LEC', number: 16, color: '#E80020', points: 60 }
    ];

    render(
      <SelectionList 
        type="p10"
        currentPick=""
        onSelect={vi.fn()}
        drivers={driversWithLeclerc}
        driverForm={mockForm}
      />
    );

    // Max Verstappen: P1, P1 (Neutral Gray #333)
    const verstappenRow = screen.getByText('Max Verstappen').closest('.cursor-pointer');
    const vBadges = verstappenRow?.querySelectorAll('.rounded-circle');
    expect(vBadges).toHaveLength(2);
    expect(vBadges?.[0]).toHaveClass(styles.dotDefault);
    expect(vBadges?.[1]).toHaveClass(styles.dotDefault);
    expect(vBadges?.[0].textContent).toBe('1');

    // Lewis Hamilton: P10 (Target Red #e10600), P15 (Gray #333), DNS (Gray #333 with -)
    const hamiltonRow = screen.getByText('Lewis Hamilton').closest('.cursor-pointer');
    const hBadges = hamiltonRow?.querySelectorAll('.rounded-circle');
    expect(hBadges).toHaveLength(3);
    
    expect(hBadges?.[0]).toHaveClass(styles.dotP10);
    expect(hBadges?.[0].textContent).toBe('10');
    expect(hBadges?.[1]).toHaveClass(styles.dotDefault);
    expect(hBadges?.[2]).toHaveClass(styles.dotDNS);
    expect(hBadges?.[2].textContent).toBe('-');

    // Charles Leclerc: DNF (Danger Red #dc3545 with R)
    const leclercRow = screen.getByText('Charles Leclerc').closest('.cursor-pointer');
    const lBadges = leclercRow?.querySelectorAll('.rounded-circle');
    expect(lBadges).toHaveLength(1);
    expect(lBadges?.[0]).toHaveClass(styles.dotDNF);
    expect(lBadges?.[0].textContent).toBe('R');
  });

  it('renders nothing when form data is missing', () => {
    render(
      <SelectionList 
        type="p10"
        currentPick=""
        onSelect={vi.fn()}
        drivers={mockDrivers}
        driverForm={{}}
      />
    );

    const badges = screen.queryAllByRole('generic').filter(el => el.classList.contains('rounded-circle'));
    expect(badges).toHaveLength(0);
  });
});
