import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import SelectionList from '@/components/SelectionList';

const mockDrivers = [
  { id: 'verstappen', name: 'Max Verstappen', team: 'Red Bull', teamId: 'red_bull', code: 'VER', number: 1, color: '#3671C6', points: 100 },
  { id: 'hamilton', name: 'Lewis Hamilton', team: 'Mercedes', teamId: 'mercedes', code: 'HAM', number: 44, color: '#27F4D2', points: 80 }
];

const mockForm = {
  'verstappen': [{ pos: 1, status: 'Finished' }, { pos: 1, status: 'Finished' }],
  'hamilton': [{ pos: 10, status: 'Finished' }, { pos: 15, status: 'Finished' }, { pos: 20, status: 'Accident' }]
};

describe('SelectionList - Driver Form Guides', () => {
  it('renders form badges with correct colors based on position and status', () => {
    render(
      <SelectionList 
        type="p10"
        currentPick=""
        onSelect={vi.fn()}
        drivers={mockDrivers}
        driverForm={mockForm}
      />
    );

    // Max Verstappen: P1, P1 (Success Green)
    const verstappenRow = screen.getByText('Max Verstappen').closest('.cursor-pointer');
    const vBadges = verstappenRow?.querySelectorAll('.rounded-circle');
    expect(vBadges).toHaveLength(2);
    // @ts-ignore
    expect(vBadges?.[0].style.backgroundColor).toBe('rgb(25, 135, 84)'); // #198754

    // Lewis Hamilton: P10 (Success), P15 (Secondary), Accident (Danger)
    const hamiltonRow = screen.getByText('Lewis Hamilton').closest('.cursor-pointer');
    const hBadges = hamiltonRow?.querySelectorAll('.rounded-circle');
    expect(hBadges).toHaveLength(3);
    
    // @ts-ignore
    expect(hBadges?.[0].style.backgroundColor).toBe('rgb(25, 135, 84)'); // P10
    // @ts-ignore
    expect(hBadges?.[1].style.backgroundColor).toBe('rgb(108, 117, 125)'); // P15
    // @ts-ignore
    expect(hBadges?.[2].style.backgroundColor).toBe('rgb(220, 53, 69)'); // DNF
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
