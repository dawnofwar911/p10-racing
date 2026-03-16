import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

/**
 * Universal storage utility that handles localStorage (Web) 
 * and mirrors to Preferences (Native) for persistence and background use.
 */

// Helper to check if we are on a native platform
const isNative = Capacitor.isNativePlatform();

// Defensive check for localStorage
const getLocalStorage = () => {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return null;
};

export const storage = {
  /**
   * Sets a value in both localStorage and Preferences (if native)
   */
  async setItem(key: string, value: string): Promise<void> {
    const local = getLocalStorage();
    if (local) {
      try {
        local.setItem(key, value);
      } catch (e) {
        console.warn('localStorage.setItem failed:', e);
      }
    }
    
    if (isNative) {
      try {
        await Preferences.set({ key, value });
      } catch (e) {
        console.error('Preferences.set failed:', e);
      }
    }
  },

  /**
   * Gets a value. Tries localStorage first (fast), then Preferences if native.
   */
  async getItem(key: string): Promise<string | null> {
    const local = getLocalStorage();
    const localValue = local ? local.getItem(key) : null;
    
    if (localValue !== null) return localValue;

    if (isNative) {
      try {
        const { value } = await Preferences.get({ key });
        if (value !== null) {
          // Heal localStorage if Preferences has it but local doesn't
          if (local) {
            try {
              local.setItem(key, value);
            } catch (e) {
              console.warn('localStorage healing failed:', e);
            }
          }
          return value;
        }
      } catch (e) {
        console.error('Preferences.get failed:', e);
      }
    }
    return null;
  },

  /**
   * Synchronous get from localStorage ONLY.
   * Use this for initial render to avoid flashes, then use getItem for background healing.
   */
  getItemSync(key: string): string | null {
    const local = getLocalStorage();
    return local ? local.getItem(key) : null;
  },

  /**
   * Removes item from both.
   */
  async removeItem(key: string): Promise<void> {
    const local = getLocalStorage();
    if (local) {
      try {
        local.removeItem(key);
      } catch (e) {
        console.warn('localStorage.removeItem failed:', e);
      }
    }

    if (isNative) {
      try {
        await Preferences.remove({ key });
      } catch (e) {
        console.error('Preferences.remove failed:', e);
      }
    }
  },

  /**
   * Clears all.
   */
  async clear(): Promise<void> {
    const local = getLocalStorage();
    if (local) {
      try {
        local.clear();
      } catch (e) {
        console.warn('localStorage.clear failed:', e);
      }
    }

    if (isNative) {
      try {
        await Preferences.clear();
      } catch (e) {
        console.error('Preferences.clear failed:', e);
      }
    }
  },

  /**
   * Retrieves all known keys.
   */
  async keys(): Promise<string[]> {
    if (isNative) {
      try {
        const { keys } = await Preferences.keys();
        return keys;
      } catch (e) {
        console.error('Preferences.keys failed:', e);
      }
    }
    
    // Fallback for web or if native fails
    const local = getLocalStorage();
    return local ? Object.keys(local) : [];
  }
};
