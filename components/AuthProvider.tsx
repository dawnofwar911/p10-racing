'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Session } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { withTimeout } from '@/lib/utils/sync-queue';
import { STORAGE_KEYS, setStorageItem, removeStorageItem, STORAGE_UPDATE_EVENT } from '@/lib/utils/storage';
import { sessionTracker } from '@/lib/utils/session';

interface AuthContextType {
  session: Session | null;
  currentUser: string | null;
  isAdmin: boolean;
  hasSession: boolean;
  isAuthLoading: boolean;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  currentUser: null,
  isAdmin: false,
  hasSession: false,
  isAuthLoading: true,
  logout: async () => {},
  refreshAuth: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient();

  // 1. Synchronous Cache Initialization (Client-side only)
  const [currentUser, setCurrentUser] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(STORAGE_KEYS.CACHE_USERNAME) || localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
  });

  const [isAdmin, setIsAdmin] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEYS.IS_ADMIN) === 'true';
  });

  const [hasSession, setHasSession] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEYS.HAS_SESSION) === 'true';
  });

  const [session, setSession] = useState<Session | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  const getSession = useCallback(async () => {
    try {
      const { data: { session: currentSession } } = await withTimeout(supabase.auth.getSession());
      setSession(currentSession);

      if (currentSession) {
        setHasSession(true);
        setStorageItem(STORAGE_KEYS.HAS_SESSION, 'true');
        const { data: profile } = await withTimeout(supabase
          .from('profiles')
          .select('username, is_admin')
          .eq('id', currentSession.user.id)
          .single());
        
        if (profile) {
          setCurrentUser(profile.username);
          setIsAdmin(!!profile.is_admin);
          setStorageItem(STORAGE_KEYS.CACHE_USERNAME, profile.username);
          setStorageItem(STORAGE_KEYS.IS_ADMIN, String(!!profile.is_admin));
        } else {
          const fallback = currentSession.user.email?.split('@')[0] || `User_${currentSession.user.id.substring(0, 5)}`;
          setCurrentUser(fallback);
          setStorageItem(STORAGE_KEYS.CACHE_USERNAME, fallback);
        }
      } else {
        setHasSession(false);
        setStorageItem(STORAGE_KEYS.HAS_SESSION, 'false');
        removeStorageItem(STORAGE_KEYS.CACHE_USERNAME);
        removeStorageItem(STORAGE_KEYS.IS_ADMIN);
        const localUser = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
        setCurrentUser(localUser);
        setIsAdmin(false);
      }
    } catch (err) {
      console.error('AuthProvider: getSession error:', err);
    } finally {
      setIsAuthLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    getSession();

    // Listen for Auth Changes (Login/Logout/Token Refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      console.log('AuthProvider: Auth state change:', event);
      setSession(newSession);
      
      // Force all pages to re-sync on auth change
      sessionTracker.resetInitialLoad();

      if (event === 'SIGNED_OUT' || (event === 'INITIAL_SESSION' && !newSession)) {
        setHasSession(false);
        setStorageItem(STORAGE_KEYS.HAS_SESSION, 'false');
        removeStorageItem(STORAGE_KEYS.CACHE_USERNAME);
        removeStorageItem(STORAGE_KEYS.IS_ADMIN);
        const localUser = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
        setCurrentUser(localUser);
        setIsAdmin(false);
        if (event === 'SIGNED_OUT') {
          window.location.href = '/';
        }
      } else if (newSession) {
        setHasSession(true);
        setStorageItem(STORAGE_KEYS.HAS_SESSION, 'true');
        supabase
          .from('profiles')
          .select('username, is_admin')
          .eq('id', newSession.user.id)
          .single()
          .then(({ data }) => {
            if (data) {
              setCurrentUser(data.username);
              setIsAdmin(!!data.is_admin);
              setStorageItem(STORAGE_KEYS.CACHE_USERNAME, data.username);
              setStorageItem(STORAGE_KEYS.IS_ADMIN, String(!!data.is_admin));
            } else {
              const fallback = newSession.user.email?.split('@')[0] || `User_${newSession.user.id.substring(0, 5)}`;
              setCurrentUser(fallback);
              setStorageItem(STORAGE_KEYS.CACHE_USERNAME, fallback);
            }
          });
      }
    });

    // Listen for manual Storage Updates (e.g. Guest name changes in Predict page)
    const handleStorageUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<{ key: string; value?: string }>;
      const { key } = customEvent.detail || {};
      if (key === STORAGE_KEYS.CURRENT_USER || key === STORAGE_KEYS.CACHE_USERNAME || key === STORAGE_KEYS.HAS_SESSION || key === STORAGE_KEYS.IS_ADMIN) {
        const newUser = localStorage.getItem(STORAGE_KEYS.CACHE_USERNAME) || localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
        const newSessionStatus = localStorage.getItem(STORAGE_KEYS.HAS_SESSION) === 'true';
        const newIsAdmin = localStorage.getItem(STORAGE_KEYS.IS_ADMIN) === 'true';
        
        setCurrentUser(newUser);
        setHasSession(newSessionStatus);
        setIsAdmin(newIsAdmin);
        
        // Reset tracker so pages react to guest switches too
        sessionTracker.resetInitialLoad();
      }
    };

    window.addEventListener(STORAGE_UPDATE_EVENT, handleStorageUpdate);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener(STORAGE_UPDATE_EVENT, handleStorageUpdate);
    };
  }, [supabase, getSession]);

  const logout = useCallback(async () => {
    setHasSession(false);
    setStorageItem(STORAGE_KEYS.HAS_SESSION, 'false');
    removeStorageItem(STORAGE_KEYS.CACHE_USERNAME);
    removeStorageItem(STORAGE_KEYS.IS_ADMIN);
    removeStorageItem(STORAGE_KEYS.CURRENT_USER);
    setCurrentUser(null);
    setIsAdmin(false);
    
    if (session) {
      await supabase.auth.signOut();
    }
    
    window.location.href = '/';
  }, [supabase, session]);

  const value = React.useMemo(() => ({
    session,
    currentUser,
    isAdmin,
    hasSession,
    isAuthLoading,
    logout,
    refreshAuth: getSession
  }), [session, currentUser, isAdmin, hasSession, isAuthLoading, logout, getSession]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
