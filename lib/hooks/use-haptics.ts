'use client';

import { useCallback } from 'react';
import { 
  triggerLightHaptic, 
  triggerMediumHaptic, 
  triggerHeavyHaptic,
  triggerSuccessHaptic,
  triggerWarningHaptic,
  triggerErrorHaptic
} from '@/lib/utils/haptics';

export type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

export function useHaptics() {
  const triggerHaptic = useCallback((hapticType: HapticType) => {
    switch (hapticType) {
      case 'light':
        triggerLightHaptic();
        break;
      case 'medium':
        triggerMediumHaptic();
        break;
      case 'heavy':
        triggerHeavyHaptic();
        break;
      case 'success':
        triggerSuccessHaptic();
        break;
      case 'warning':
        triggerWarningHaptic();
        break;
      case 'error':
        triggerErrorHaptic();
        break;
      default:
        triggerLightHaptic();
        break;
    }
  }, []);

  return { triggerHaptic };
}
