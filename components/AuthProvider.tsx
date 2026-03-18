'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { STORAGE_KEYS, setStorageItem, removeStorageItem } from '@/lib/utils/storage';

interface AuthContextType {
  session: Session | null;
  currentUser: string | null;
  isAdmin: boolean;
  hasSession: boolean;
  isAuthLoading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  currentUser: null,
  isAdmin: false,
  hasSession: false,
  isAuthLoading: true,
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    // 1. Initial Synchronous Load (Hydration safe inside useEffect)
    const cachedUser = localStorage.getItem(STORAGE_KEYS.CACHE_USERNAME);
    const cachedIsAdmin = localStorage.getItem(STORAGE_KEYS.IS_ADMIN) === 'true';
    const cachedHasSession = localStorage.getItem(STORAGE_KEYS.HAS_SESSION) === 'true';
    
    if (cachedUser) {
      setCurrentUser(cachedUser);
      setIsAdmin(cachedIsAdmin);
    } else {
      const localUser = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      setCurrentUser(localUser);
    }
    setHasSession(cachedHasSession);

    // 2. Fetch True Auth State
    async function getSession() {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        setSession(currentSession);

        if (currentSession) {
          setHasSession(true);
          setStorageItem(STORAGE_KEYS.HAS_SESSION, 'true');
          const { data: profile } = await supabase
            .from('profiles')
            .select('username, is_admin')
            .eq('id', currentSession.user.id)
            .single();
          
          if (profile) {
            setCurrentUser(profile.username);
            setIsAdmin(!!profile.is_admin);
            setStorageItem(STORAGE_KEYS.CACHE_USERNAME, profile.username);
            setStorageItem(STORAGE_KEYS.IS_ADMIN, String(!!profile.is_admin));
          } else {
            const fallback = currentSession.user.email?.split('@')[0] || 'User';
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
    }

    getSession();

    // 3. Listen for Auth Changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      if (event === 'SIGNED_OUT' || !newSession) {
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
              const fallback = newSession.user.email?.split('@')[0] || 'User';
              setCurrentUser(fallback);
              setStorageItem(STORAGE_KEYS.CACHE_USERNAME, fallback);
            }
          });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  const logout = async () => {
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
  };

  return (
    <AuthContext.Provider value={{ session, currentUser, isAdmin, hasSession, isAuthLoading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
