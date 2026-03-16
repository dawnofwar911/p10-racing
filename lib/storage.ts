import { Capacitor } from '@capacitor/core';

/**
 * Universal storage utility that handles localStorage (Web) 
 * and mirrors to Preferences (Native) for persistence and background use.
 */

// Helper to get Preferences plugin only when on native
const getPreferences = async () => {
  if (Capacitor.isNativePlatform()) {
    const { Preferences } = await import('@capacitor/preferences');
    return Preferences;
  }
  return null;
};

export const storage = {
  /**
   * Sets a value in both localStorage and Preferences (if native)
   */
  async setItem(key: string, value: string): Promise<void> {
    localStorage.setItem(key, value);
    
    const Preferences = await getPreferences();
    if (Preferences) {
      await Preferences.set({ key, value });
    }
  },

  /**
   * Gets a value. Tries localStorage first (fast), then Preferences if native.
   */
  async getItem(key: string): Promise<string | null> {
    const local = localStorage.getItem(key);
    if (local !== null) return local;

    const Preferences = await getPreferences();
    if (Preferences) {
      const { value } = await Preferences.get({ key });
      if (value !== null) {
        // Heal localStorage if Preferences has it but local doesn't
        localStorage.setItem(key, value);
        return value;
      }
    }
    return null;
  },

  /**
   * Synchronous get from localStorage ONLY.
   * Use this for initial render to avoid flashes, then use getItem for background healing.
   */
  getItemSync(key: string): string | null {
    return localStorage.getItem(key);
  },

  /**
   * Removes item from both.
   */
  async removeItem(key: string): Promise<void> {
    localStorage.removeItem(key);
    const Preferences = await getPreferences();
    if (Preferences) {
      await Preferences.remove({ key });
    }
  },

  /**
   * Clears all.
   */
  async clear(): Promise<void> {
    localStorage.clear();
    const Preferences = await getPreferences();
    if (Preferences) {
      await Preferences.clear();
    }
  },

  /**
   * Retrieves all known keys.
   */
  async keys(): Promise<string[]> {
    const Preferences = await getPreferences();
    if (Preferences) {
      const { keys } = await Preferences.keys();
      return keys;
    }
    // Fallback for web
    return Object.keys(localStorage);
  }
};
