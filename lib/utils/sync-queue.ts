/**
 * Constants for app lifecycle and sync orchestration.
 */
export const SYNC_COMPLETE_EVENT = 'p10:sync_complete';
export const APP_RESUME_EVENT = 'p10:app_resume';
export const APP_READY_EVENT = 'p10:app_ready';

/**
 * Wraps a promise or thenable with a timeout.
 */
export async function withTimeout<T>(promise: Promise<T> | PromiseLike<T>, timeoutMs = 10000): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      console.warn(`Request timed out after ${timeoutMs}ms`);
      reject(new Error('Request timed out'));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    if (timeoutId) clearTimeout(timeoutId);
    return result;
  } catch (error) {
    if (timeoutId) clearTimeout(timeoutId);
    throw error;
  }
}
