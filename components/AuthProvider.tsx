'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Session } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { withTimeout } from '@/lib/utils/sync-queue';
import { STORAGE_KEYS, setStorageItem, removeStorageItem, STORAGE_UPDATE_EVENT } from '@/lib/utils/storage';
import { sessionTracker } from '@/lib/utils/session';

import { Profile } from '@/lib/types';

interface AuthContextType {
  session: Session | null;
  currentUser: string | null;
  displayName: string;
  isAdmin: boolean;
  hasSession: boolean;
  isAuthLoading: boolean;
  syncVersion: number;
  profile: Profile | null;
  setProfile: React.Dispatch<React.SetStateAction<Profile | null>>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  triggerRefresh: () => void;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  currentUser: null,
  displayName: 'Guest',
  isAdmin: false,
  hasSession: false,
  isAuthLoading: true,
  syncVersion: 0,
  profile: null,
  setProfile: () => {},
  logout: async () => {},
  refreshAuth: async () => {},
  triggerRefresh: () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient();

  // 1. Synchronous Cache Initialization (Client-side only)
  const [currentUser, setCurrentUser] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(STORAGE_KEYS.CACHE_USERNAME) || localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
  });

  const [displayName, setDisplayName] = useState<string>(() => {
    if (typeof window === 'undefined') return 'Guest';
    return localStorage.getItem(STORAGE_KEYS.CACHE_USERNAME) || localStorage.getItem(STORAGE_KEYS.CURRENT_USER) || 'Guest';
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
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [syncVersion, setSyncVersion] = useState(0);

  const triggerRefresh = useCallback(() => {
    sessionTracker.resetVisitedPages();
    setSyncVersion(v => v + 1);
  }, []);

  const getSession = useCallback(async () => {
    try {
      const { data: { session: currentSession } } = await withTimeout(supabase.auth.getSession());
      
      if (currentSession) {
        triggerRefresh();
        setSession(currentSession);
        setHasSession(true);
        setStorageItem(STORAGE_KEYS.HAS_SESSION, 'true');
        setStorageItem(STORAGE_KEYS.CACHE_USER_ID, currentSession.user.id);
        
        const { data: profileData } = await withTimeout(supabase
          .from('profiles')
          .select('*')
          .eq('id', currentSession.user.id)
          .single());
        
        if (profileData) {
          setProfile(profileData);
          setCurrentUser(profileData.username);
          setDisplayName(profileData.username);
          setIsAdmin(!!profileData.is_admin);
          setStorageItem(STORAGE_KEYS.CACHE_USERNAME, profileData.username);
          setStorageItem(STORAGE_KEYS.IS_ADMIN, String(!!profileData.is_admin));
        } else {
          const fallback = currentSession.user.email?.split('@')[0] || `User_${currentSession.user.id.substring(0, 5)}`;
          setCurrentUser(fallback);
          setDisplayName(fallback);
          setStorageItem(STORAGE_KEYS.CACHE_USERNAME, fallback);
        }
      } else {
        setSession(null);
        setProfile(null);
        setHasSession(false);
        setStorageItem(STORAGE_KEYS.HAS_SESSION, 'false');
        removeStorageItem(STORAGE_KEYS.CACHE_USERNAME);
        removeStorageItem(STORAGE_KEYS.IS_ADMIN);
        const localUser = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
        setCurrentUser(localUser);
        setDisplayName(localUser || 'Guest');
        setIsAdmin(false);
      }
    } catch (err) {
      console.error('AuthProvider: getSession error:', err);
    } finally {
      setIsAuthLoading(false);
    }
  }, [supabase, triggerRefresh]);

  useEffect(() => {
    getSession();

    // Listen for Auth Changes (Login/Logout/Token Refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      console.log('AuthProvider: Auth state change:', event);
      
      triggerRefresh();
      setSession(newSession);

      if (event === 'SIGNED_OUT' || (event === 'INITIAL_SESSION' && !newSession)) {
        setHasSession(false);
        setProfile(null);
        setStorageItem(STORAGE_KEYS.HAS_SESSION, 'false');
        removeStorageItem(STORAGE_KEYS.CACHE_USERNAME);
        removeStorageItem(STORAGE_KEYS.CACHE_USER_ID);
        removeStorageItem(STORAGE_KEYS.IS_ADMIN);
        const localUser = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
        setCurrentUser(localUser);
        setDisplayName(localUser || 'Guest');
        setIsAdmin(false);
        if (event === 'SIGNED_OUT') {
          window.location.href = '/';
        }
      } else if (newSession) {
        setHasSession(true);
        setStorageItem(STORAGE_KEYS.HAS_SESSION, 'true');
        setStorageItem(STORAGE_KEYS.CACHE_USER_ID, newSession.user.id);
        supabase
          .from('profiles')
          .select('*')
          .eq('id', newSession.user.id)
          .single()
          .then(({ data }) => {
            if (data) {
              setProfile(data);
              setCurrentUser(data.username);
              setDisplayName(data.username);
              setIsAdmin(!!data.is_admin);
              setStorageItem(STORAGE_KEYS.CACHE_USERNAME, data.username);
              setStorageItem(STORAGE_KEYS.IS_ADMIN, String(!!data.is_admin));
            } else {
              const fallback = newSession.user.email?.split('@')[0] || `User_${newSession.user.id.substring(0, 5)}`;
              setCurrentUser(fallback);
              setDisplayName(fallback);
              setStorageItem(STORAGE_KEYS.CACHE_USERNAME, fallback);
            }
          });
      }
    });

    // Real-time Profile Subscription
    const profileChannel = supabase
      .channel('profile-updates')
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'profiles',
        filter: session?.user.id ? `id=eq.${session.user.id}` : undefined
      }, (payload) => {
        const updated = payload.new as Profile;
        console.log('AuthProvider: Profile updated in real-time:', updated);
        setProfile(updated);
        if (updated.username) {
          setCurrentUser(updated.username);
          setDisplayName(updated.username);
          setStorageItem(STORAGE_KEYS.CACHE_USERNAME, updated.username);
        }
        if (updated.is_admin !== undefined) {
          setIsAdmin(!!updated.is_admin);
          setStorageItem(STORAGE_KEYS.IS_ADMIN, String(!!updated.is_admin));
        }
      })
      .subscribe();

    // Listen for manual Storage Updates (e.g. Guest name changes in Predict page)
    const handleStorageUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<{ key: string; value?: string }>;
      const { key } = customEvent.detail || {};
      if (key === STORAGE_KEYS.CURRENT_USER || key === STORAGE_KEYS.CACHE_USERNAME || key === STORAGE_KEYS.HAS_SESSION || key === STORAGE_KEYS.IS_ADMIN) {
        triggerRefresh();

        const newUser = localStorage.getItem(STORAGE_KEYS.CACHE_USERNAME) || localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
        const newSessionStatus = localStorage.getItem(STORAGE_KEYS.HAS_SESSION) === 'true';
        const newIsAdmin = localStorage.getItem(STORAGE_KEYS.IS_ADMIN) === 'true';
        
        setCurrentUser(newUser);
        setDisplayName(newUser || 'Guest');
        setHasSession(newSessionStatus);
        setIsAdmin(newIsAdmin);
      }
    };

    window.addEventListener(STORAGE_UPDATE_EVENT, handleStorageUpdate);

    return () => {
      subscription.unsubscribe();
      supabase.removeChannel(profileChannel);
      window.removeEventListener(STORAGE_UPDATE_EVENT, handleStorageUpdate);
    };
  }, [supabase, getSession, session?.user.id, triggerRefresh]);

  const logout = useCallback(async () => {
    triggerRefresh();
    setHasSession(false);
    setProfile(null);
    setStorageItem(STORAGE_KEYS.HAS_SESSION, 'false');
    removeStorageItem(STORAGE_KEYS.CACHE_USERNAME);
    removeStorageItem(STORAGE_KEYS.CACHE_USER_ID);
    removeStorageItem(STORAGE_KEYS.IS_ADMIN);
    removeStorageItem(STORAGE_KEYS.CURRENT_USER);
    setCurrentUser(null);
    setDisplayName('Guest');
    setIsAdmin(false);
    
    if (session) {
      await supabase.auth.signOut();
    }
    
    window.location.href = '/';
  }, [supabase, session, triggerRefresh]);

  const value = React.useMemo(() => ({
    session,
    currentUser,
    displayName,
    isAdmin,
    hasSession,
    isAuthLoading,
    syncVersion,
    profile,
    setProfile,
    logout,
    refreshAuth: getSession,
    triggerRefresh
  }), [session, currentUser, displayName, isAdmin, hasSession, isAuthLoading, syncVersion, profile, setProfile, logout, getSession, triggerRefresh]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
