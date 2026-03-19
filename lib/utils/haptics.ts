import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { STORAGE_KEYS } from './storage';

/**
 * Checks if haptics are enabled in user settings.
 * Defaults to true if no setting is found.
 */
const areHapticsEnabled = () => {
  if (typeof window === 'undefined') return false;
  const setting = localStorage.getItem(STORAGE_KEYS.HAPTICS_ENABLED);
  return setting !== 'false';
};

/**
 * Trigger a light impact haptic feedback.
 * Used for standard taps, navigation, and minor interactions.
 */
export const triggerLightHaptic = async () => {
  if (!areHapticsEnabled()) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch (e) {
    console.debug('Haptic Light not supported:', e);
  }
};

/**
 * Trigger a medium impact haptic feedback.
 * Used for significant actions like sharing, switching views, or major transitions.
 */
export const triggerMediumHaptic = async () => {
  if (!areHapticsEnabled()) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Medium });
  } catch (e) {
    console.debug('Haptic Medium not supported:', e);
  }
};

/**
 * Trigger a heavy impact haptic feedback.
 * Used for critical actions like locking in predictions or deleting data.
 */
export const triggerHeavyHaptic = async () => {
  if (!areHapticsEnabled()) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Heavy });
  } catch (e) {
    console.debug('Haptic Heavy not supported:', e);
  }
};

/**
 * Trigger a selection changed haptic feedback.
 * Used for scrolling through lists or changing selections in a picker.
 */
export const triggerSelectionHaptic = async () => {
  if (!areHapticsEnabled()) return;
  try {
    await Haptics.selectionChanged();
  } catch (e) {
    console.debug('Haptic Selection not supported:', e);
  }
};

/**
 * Trigger a success notification haptic feedback.
 * Used when an action completes successfully (e.g., successful submission).
 */
export const triggerSuccessHaptic = async () => {
  if (!areHapticsEnabled()) return;
  try {
    await Haptics.notification({ type: NotificationType.Success });
  } catch (e) {
    console.debug('Haptic Success not supported:', e);
  }
};

/**
 * Trigger a warning notification haptic feedback.
 * Used for cautionary actions or warnings (e.g., before deleting data).
 */
export const triggerWarningHaptic = async () => {
  if (!areHapticsEnabled()) return;
  try {
    await Haptics.notification({ type: NotificationType.Warning });
  } catch (e) {
    console.debug('Haptic Warning not supported:', e);
  }
};

/**
 * Trigger an error notification haptic feedback.
 * Used when an action fails or an error occurs.
 */
export const triggerErrorHaptic = async () => {
  if (!areHapticsEnabled()) return;
  try {
    await Haptics.notification({ type: NotificationType.Error });
  } catch (e) {
    console.debug('Haptic Error not supported:', e);
  }
};
