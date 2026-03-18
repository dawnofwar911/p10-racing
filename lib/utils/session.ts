/**
 * Lightweight singleton to track the current app execution session.
 * Used to distinguish between "Cold Start" (fresh process) and 
 * "Hot Navigation" (tab switching / resume).
 */

class SessionTracker {
  private static instance: SessionTracker;
  // Map of session fingerprint (e.g. user ID) to set of visited page IDs
  private visitedPagesMap: Map<string, Set<string>> = new Map();
  private initialLoadComplete: boolean = false;
  // Incrementing ID to force re-renders/re-syncs
  private syncId: number = 0;

  private constructor() {}

  public static getInstance(): SessionTracker {
    if (!SessionTracker.instance) {
      SessionTracker.instance = new SessionTracker();
    }
    return SessionTracker.instance;
  }

  /**
   * Returns true if this is the first time the specific page is being viewed
   * for the given fingerprint (usually the current user's ID or name).
   */
  public isFirstView(pageId: string, fingerprint: string = 'guest'): boolean {
    if (typeof window === 'undefined') return false;
    
    if (!this.visitedPagesMap.has(fingerprint)) {
      this.visitedPagesMap.set(fingerprint, new Set());
    }
    
    const visitedSet = this.visitedPagesMap.get(fingerprint)!;
    if (visitedSet.has(pageId)) {
      return false;
    }
    
    visitedSet.add(pageId);
    return true;
  }

  /**
   * Tracks if the global initial data load (e.g. auth check) has happened.
   */
  public markInitialLoadComplete() {
    this.initialLoadComplete = true;
  }

  /**
   * Resets the initial load flag to force a fresh data sync (e.g. after login or resume).
   */
  public resetInitialLoad() {
    this.initialLoadComplete = false;
    this.visitedPagesMap.clear();
    this.syncId++;
  }

  public isInitialLoadNeeded(): boolean {
    return !this.initialLoadComplete;
  }

  /**
   * Returns a unique ID for the current sync session.
   * Changes whenever resetInitialLoad is called.
   */
  public getSyncId(): number {
    return this.syncId;
  }
}

export const sessionTracker = SessionTracker.getInstance();
