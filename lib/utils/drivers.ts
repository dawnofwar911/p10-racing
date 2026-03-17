import { Driver } from '@/lib/types';

/**
 * Extracts a concise display name for a driver (usually the last name or code).
 */
export const getDriverDisplayName = (driverId: string, allDrivers: Driver[]): string => {
  const driver = allDrivers.find(d => d.id === driverId);
  if (driver?.name) {
    return driver.name.split(' ').pop() || '';
  }
  // Fallback to the ID part if name not found
  return driverId?.split('_').pop()?.toUpperCase() || '';
};
