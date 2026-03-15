/**
 * Utility functions for user profiles.
 */

/**
 * Checks if a username indicates a test or reviewer account.
 * Uses word boundaries to avoid false positives (e.g., "protester").
 */
export const isTestAccount = (username: string | null | undefined): boolean => {
  if (!username) return false;
  return /\b(tester|reviewer)\b/i.test(username);
};
