import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

/**
 * Utility to check if the app is running on a native platform.
 */
const isNative = () => Capacitor.isNativePlatform();

/**
 * Trigger a light impact haptic feedback.
 * Used for standard taps, navigation, and minor interactions.
 */
export const triggerLightHaptic = async () => {
  if (!isNative()) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch (e) {
    console.warn('Haptic Light failed:', e);
  }
};

/**
 * Trigger a medium impact haptic feedback.
 * Used for significant actions like sharing, switching views, or major transitions.
 */
export const triggerMediumHaptic = async () => {
  if (!isNative()) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Medium });
  } catch (e) {
    console.warn('Haptic Medium failed:', e);
  }
};

/**
 * Trigger a heavy impact haptic feedback.
 * Used for critical actions like locking in predictions or deleting data.
 */
export const triggerHeavyHaptic = async () => {
  if (!isNative()) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Heavy });
  } catch (e) {
    console.warn('Haptic Heavy failed:', e);
  }
};

/**
 * Trigger a selection changed haptic feedback.
 * Used for scrolling through lists or changing selections in a picker.
 */
export const triggerSelectionHaptic = async () => {
  if (!isNative()) return;
  try {
    await Haptics.selectionChanged();
  } catch (e) {
    console.warn('Haptic Selection failed:', e);
  }
};

/**
 * Trigger a success notification haptic feedback.
 * Used when an action completes successfully (e.g., successful submission).
 */
export const triggerSuccessHaptic = async () => {
  if (!isNative()) return;
  try {
    await Haptics.notification({ type: NotificationType.Success });
  } catch (e) {
    console.warn('Haptic Success failed:', e);
  }
};

/**
 * Trigger a warning notification haptic feedback.
 * Used for cautionary actions or warnings (e.g., before deleting data).
 */
export const triggerWarningHaptic = async () => {
  if (!isNative()) return;
  try {
    await Haptics.notification({ type: NotificationType.Warning });
  } catch (e) {
    console.warn('Haptic Warning failed:', e);
  }
};

/**
 * Trigger an error notification haptic feedback.
 * Used when an action fails or an error occurs.
 */
export const triggerErrorHaptic = async () => {
  if (!isNative()) return;
  try {
    await Haptics.notification({ type: NotificationType.Error });
  } catch (e) {
    console.warn('Haptic Error failed:', e);
  }
};
