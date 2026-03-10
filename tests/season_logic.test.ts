import { isPreseason, CURRENT_SEASON, getSystemSeason } from '../lib/data';

console.log('🧪 Running Season Logic Tests...');

const systemYear = getSystemSeason();

// We can't easily mock Date in a simple tsx script without a full test runner like Jest/Vitest,
// but we can test the logic based on the current date and the function's contract.

const now = new Date();
const month = now.getMonth();

if (month < 2) {
  // It is Jan/Feb
  if (!isPreseason()) {
    throw new Error('isPreseason() should be true in Jan/Feb');
  }
  if (CURRENT_SEASON !== systemYear - 1) {
    throw new Error(`CURRENT_SEASON should be ${systemYear - 1} during preseason of ${systemYear}`);
  }
} else {
  // It is March-Dec
  if (isPreseason()) {
    throw new Error('isPreseason() should be false from March onwards');
  }
  if (CURRENT_SEASON !== systemYear) {
    throw new Error(`CURRENT_SEASON should be ${systemYear} during the season`);
  }
}

console.log('  ✅ Season Logic Tests Passed');
