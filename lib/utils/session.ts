/**
 * Lightweight singleton to track the current app execution session.
 * Used to distinguish between "Cold Start" (fresh process) and 
 * "Hot Navigation" (tab switching / resume).
 */

class SessionTracker {
  private static instance: SessionTracker;
  private visitedPages: Set<string> = new Set();
  private initialLoadComplete: boolean = false;

  private constructor() {}

  public static getInstance(): SessionTracker {
    if (!SessionTracker.instance) {
      SessionTracker.instance = new SessionTracker();
    }
    return SessionTracker.instance;
  }

  /**
   * Returns true if this is the first time the specific page is being viewed
   * in the current app session.
   */
  public isFirstView(pageId: string): boolean {
    if (typeof window === 'undefined') return false;
    if (this.visitedPages.has(pageId)) {
      return false;
    }
    this.visitedPages.add(pageId);
    return true;
  }

  /**
   * Tracks if the global initial data load (e.g. auth check) has happened.
   */
  public markInitialLoadComplete() {
    this.initialLoadComplete = true;
  }

  public isInitialLoadNeeded(): boolean {
    return !this.initialLoadComplete;
  }
}

export const sessionTracker = SessionTracker.getInstance();
