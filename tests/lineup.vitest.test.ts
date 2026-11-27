import { describe, it, expect } from 'vitest';
import { getPredictionDrivers } from '@/lib/lineup';
import { Driver } from '@/lib/types';
import { ApiResult } from '@/lib/api';

const drv = (id: string, teamId: string, number: number): Driver => ({
  id, name: id, team: teamId, teamId, code: id.slice(0, 3).toUpperCase(), number, color: '#fff', points: 0,
});

const entry = (id: string, teamId: string, number: string, given = 'First', family = id): ApiResult => ({
  number, position: '1', grid: '1', points: '0', status: 'Finished', laps: '50',
  Driver: { driverId: id, code: id.slice(0, 3).toUpperCase(), givenName: given, familyName: family } as ApiResult['Driver'],
  Constructor: { constructorId: teamId, name: teamId === 'haas' ? 'Haas F1 Team' : teamId },
});

const filler = Array.from({ length: 10 }, (_, i) => entry(`d${i}`, `t${i}`, String(i + 1)));
const fillerDrivers = Array.from({ length: 10 }, (_, i) => drv(`d${i}`, `t${i}`, i + 1));

describe('getPredictionDrivers', () => {
  it('falls back to all drivers when the line-up is missing or incomplete', () => {
    const all = [...fillerDrivers, drv('ocon', 'haas', 31)];
    expect(getPredictionDrivers(all, [])).toBe(all);
    expect(getPredictionDrivers(all, filler.slice(0, 5))).toBe(all);
  });

  it('drops drivers not entered and uses the entry car number', () => {
    const all = [...fillerDrivers, drv('ocon', 'haas', 31), drv('rafael_camara', 'haas', 0)];
    const out = getPredictionDrivers(all, [...filler, entry('rafael_camara', 'haas', '51')]);
    expect(out.find(d => d.id === 'ocon')).toBeUndefined();
    const camara = out.find(d => d.id === 'rafael_camara');
    expect(camara?.number).toBe(51);
    expect(camara?.team).toBe('Haas');
  });

  it('adds a debutant who is not in the standings yet', () => {
    const out = getPredictionDrivers(fillerDrivers, [...filler, entry('new_kid', 'haas', '99', 'New', 'Kid')]);
    const kid = out.find(d => d.id === 'new_kid');
    expect(kid?.name).toBe('New Kid');
    expect(kid?.number).toBe(99);
  });

  it('keeps an existing pick even if that driver is no longer entered', () => {
    const all = [...fillerDrivers, drv('ocon', 'haas', 31)];
    const out = getPredictionDrivers(all, filler, ['ocon', '']);
    expect(out.find(d => d.id === 'ocon')).toBeDefined();
    expect(out).toHaveLength(11);
  });
});
