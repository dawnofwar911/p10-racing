import { describe, it, expect } from 'vitest';

interface GridEntry {
  position: string;
  number: string;
  Driver: {
    driverId: string;
    code: string;
  };
}

/**
 * Logic extracted from PredictPage to merge Quali grid with all drivers.
 */
function mergeGrid(qualiGrid: any[], allDrivers: any[]): GridEntry[] {
  const presentIds = new Set(qualiGrid.map(q => q.Driver.driverId));
  const missing = allDrivers.filter(d => !presentIds.has(d.id));
  
  const finalGrid = [...qualiGrid];
  missing.forEach((d, i) => {
    finalGrid.push({
      position: (qualiGrid.length + i + 1).toString(),
      number: d.number.toString(),
      Driver: {
        driverId: d.id,
        code: d.code
      }
    });
  });
  return finalGrid;
}

describe('Grid Merging Logic', () => {
  const allDrivers = [
    { id: 'norris', code: 'NOR', number: 1 },
    { id: 'piastri', code: 'PIA', number: 81 },
    { id: 'verstappen', code: 'VER', number: 3 },
    { id: 'sainz', code: 'SAI', number: 55 }
  ];

  it('should handle full grid from Quali correctly', () => {
    const quali = [
      { position: '1', Driver: { driverId: 'norris', code: 'NOR' }, number: '1' },
      { position: '2', Driver: { driverId: 'piastri', code: 'PIA' }, number: '81' },
      { position: '3', Driver: { driverId: 'verstappen', code: 'VER' }, number: '3' },
      { position: '4', Driver: { driverId: 'sainz', code: 'SAI' }, number: '55' }
    ];
    const res = mergeGrid(quali, allDrivers);
    expect(res).toHaveLength(4);
    expect(res[0].Driver.driverId).toBe('norris');
  });

  it('should append missing drivers at the back of the grid', () => {
    const quali = [
      { position: '1', Driver: { driverId: 'norris', code: 'NOR' }, number: '1' },
      { position: '2', Driver: { driverId: 'piastri', code: 'PIA' }, number: '81' }
    ];
    // Missing: verstappen, sainz
    const res = mergeGrid(quali, allDrivers);
    expect(res).toHaveLength(4);
    expect(res[2].position).toBe('3');
    expect(res[2].Driver.driverId).toBe('verstappen');
    expect(res[3].position).toBe('4');
    expect(res[3].Driver.driverId).toBe('sainz');
  });
});
