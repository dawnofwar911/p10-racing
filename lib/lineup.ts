import { Driver, TEAM_COLORS } from '@/lib/types';
import { ApiResult, displayTeamName, shortenDriverName } from '@/lib/api';

/** Below this many entries the source is treated as incomplete and we fall back to all drivers. */
const MIN_ENTRIES = 10;

/**
 * Drivers offered on the Predict screen.
 *
 * `entries` should be this weekend's grid when known, otherwise the latest race's results.
 * Only drivers in `entries` are offered, with the car number and team from that entry, so
 * mid-season swaps (e.g. a reserve replacing a race driver) show the right people and numbers
 * straight away. Drivers already picked (`keepIds`) stay listed so an existing pick never vanishes.
 * If `entries` is missing or incomplete, every known driver is returned (previous behaviour).
 */
export function getPredictionDrivers(
  allDrivers: Driver[],
  entries: ApiResult[] | null | undefined,
  keepIds: (string | null | undefined)[] = []
): Driver[] {
  if (!entries || entries.length < MIN_ENTRIES) return allDrivers;

  const byId = new Map(allDrivers.map(d => [d.id, d]));
  const seen = new Set<string>();
  const result: Driver[] = [];

  for (const entry of entries) {
    const id = entry?.Driver?.driverId;
    if (!id || seen.has(id)) continue;
    seen.add(id);

    const base = byId.get(id);
    const teamId = entry.Constructor?.constructorId || base?.teamId || '';
    const carNumber = parseInt(entry.number, 10);

    result.push({
      id,
      name: base?.name ?? shortenDriverName(entry.Driver.givenName, entry.Driver.familyName),
      team: entry.Constructor?.name ? displayTeamName(entry.Constructor.name) : (base?.team ?? ''),
      teamId,
      code: entry.Driver.code ?? base?.code ?? '',
      number: Number.isFinite(carNumber) && carNumber > 0 ? carNumber : (base?.number ?? 0),
      color: TEAM_COLORS[teamId] || base?.color || '#B6BABD',
      points: base?.points ?? 0,
    });
  }

  for (const id of keepIds) {
    if (id && !seen.has(id)) {
      const base = byId.get(id);
      if (base) {
        result.push(base);
        seen.add(id);
      }
    }
  }

  return result;
}
