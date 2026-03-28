import { SimplifiedResults, DbPrediction } from './types';

export interface UserPredictions {
  [round: string]: { p10: string, dnf: string };
}

/**
 * Pre-processes a flat list of DB predictions into a Map keyed by user_id
 * for O(1) lookup.
 */
export function mapPredictionsByUser(predictions: DbPrediction[] | null): Record<string, UserPredictions> {
  if (!predictions) return {};
  return predictions.reduce((acc, pred) => {
    if (!acc[pred.user_id]) acc[pred.user_id] = {};
    const round = pred.race_id.split('_')[1];
    acc[pred.user_id][round] = { p10: pred.p10_driver_id, dnf: pred.dnf_driver_id };
    return acc;
  }, {} as Record<string, UserPredictions>);
}

export function calculateP10Points(actualPosition: number): number {
  const distance = Math.abs(actualPosition - 10);
  const pointsTable: { [key: number]: number } = {
    0: 25, // P10
    1: 18, // P9, P11
    2: 15, // P8, P12
    3: 12, // P7, P13
    4: 10, // P6, P14
    5: 8,  // P5, P15
    6: 6,  // P4, P16
    7: 4,  // P3, P17
    8: 2,  // P2, P18
    9: 1,  // P1, P19
  };

  // Consolation for any other distance (e.g. DNF or P20+)
  return pointsTable[distance] ?? 1;
}

export function calculateDnfPoints(predictedDnfId: string, actualDnfId: string): number {
  if (!predictedDnfId || !actualDnfId) return 0;
  return predictedDnfId === actualDnfId ? 25 : 0;
}

export function calculateTotalPoints(
  predictedP10Id: string,
  actualP10Position: number, 
  predictedDnfId: string,
  actualDnfId: string
): number {
  const p10Points = calculateP10Points(actualP10Position);
  const dnfPoints = calculateDnfPoints(predictedDnfId, actualDnfId);
  return p10Points + dnfPoints;
}

/**
 * Calculates total points for a player over all races that have verified results.
 */
export function calculateSeasonPoints(
  playerPredictions: { [round: string]: { p10: string, dnf: string } | null },
  raceResultsMap: { [round: string]: SimplifiedResults & { date?: Date } },
  minDate?: Date
) {
  let totalPoints = 0;
  let lastRacePoints = 0;
  let latestBreakdown: { 
    p10Points: number; 
    dnfPoints: number; 
    p10Driver: string; 
    dnfDriver: string; 
    actualP10Pos: number; 
  } | undefined = undefined;

  const sortedRounds = Object.keys(raceResultsMap).sort((a, b) => parseInt(a) - parseInt(b));
  const history: { round: string, points: number, totalSoFar: number, p10Driver: string, dnfDriver: string, p10Pos: number, dnfCorrect: boolean }[] = [];

  sortedRounds.forEach((round, index) => {
    const results = raceResultsMap[round];
    const prediction = playerPredictions[round];

    if (results && prediction) {
      if (minDate && results.date) {
        // We allow some buffer (24 hours) if the race time is exactly 00:00:00Z to avoid timezone issues
        const isRaceTimeDefault = results.date.toISOString().includes('T00:00:00.000Z');
        const comparisonDate = isRaceTimeDefault ? new Date(results.date.getTime() + 24 * 60 * 60 * 1000) : results.date;
        if (comparisonDate < minDate) return;
      }

      const actualPosOfPredictedP10 = results.positions[prediction.p10] ?? 20;
      const p10Score = calculateP10Points(actualPosOfPredictedP10);
      const dnfCorrect = prediction.dnf === (results.firstDnf || '');
      const dnfScore = dnfCorrect ? 25 : 0;
      const roundPoints = p10Score + dnfScore;

      totalPoints += roundPoints;
      
      history.push({
        round,
        points: roundPoints,
        totalSoFar: totalPoints,
        p10Driver: prediction.p10,
        dnfDriver: prediction.dnf,
        p10Pos: actualPosOfPredictedP10,
        dnfCorrect
      });

      if (index === sortedRounds.length - 1) {
        lastRacePoints = roundPoints;
        latestBreakdown = {
          p10Points: p10Score,
          dnfPoints: dnfScore,
          p10Driver: prediction.p10,
          dnfDriver: prediction.dnf,
          actualP10Pos: actualPosOfPredictedP10
        };
      }
    }
  });

  return { totalPoints, lastRacePoints, latestBreakdown, history };
}
