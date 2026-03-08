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

  // Extension: Any pick that is 9 or more positions away (including the back of the grid) 
  // gets a 1-point consolation, matching the points for P1.
  if (distance >= 9) return 1;
  
  return pointsTable[distance] || 0;
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
