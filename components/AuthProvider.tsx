'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Session, User } from '@supabase/supabase-js';
import { APP_RESUME_EVENT, APP_READY_EVENT } from '@/lib/utils/sync-queue';

export interface Profile {
  id: string;
  username: string;
  is_admin: boolean;
  avatar_url?: string;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  isLoading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const mountedRef = useRef(true);
  
  // 1. Synchronously initialize profile from cache if available
  const [profile, setProfile] = useState<Profile | null>(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('p10_cached_profile');
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch (e) {
          console.error('Error parsing cached profile:', e);
        }
      }
    }
    return null;
  });
  
  const [isLoading, setIsLoading] = useState(() => {
    if (typeof window !== 'undefined') {
       return localStorage.getItem('p10_has_session') === 'true';
    }
    return true;
  });

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, is_admin, avatar_url')
        .eq('id', userId)
        .maybeSingle();
      
      if (error) throw error;

      if (data) {
        const profileData = data as Profile;
        setProfile(profileData);
        localStorage.setItem('p10_is_admin', profileData.is_admin ? 'true' : 'false');
        localStorage.setItem('p10_cached_profile', JSON.stringify(profileData));
      } else {
        setProfile(null);
        localStorage.removeItem('p10_is_admin');
        localStorage.removeItem('p10_cached_profile');
      }
    } catch (err) {
      console.error('AuthProvider: fetchProfile error:', err);
    }
  }, [supabase]);

  useEffect(() => {
    mountedRef.current = true;
    
    async function initAuth() {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        if (mountedRef.current) {
          setSession(initialSession);
          setUser(initialSession?.user ?? null);
          
          if (initialSession) {
            localStorage.setItem('p10_has_session', 'true');
            await fetchProfile(initialSession.user.id);
          } else {
            localStorage.removeItem('p10_has_session');
          }
          setIsLoading(false);
          console.log('AuthProvider: Initial load complete, broadcasting APP_READY');
          window.dispatchEvent(new CustomEvent(APP_READY_EVENT));
        }
      } catch (err) {
        console.error('AuthProvider: initAuth error:', err);
        setIsLoading(false);
        window.dispatchEvent(new CustomEvent(APP_READY_EVENT));
      }
    }

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        if (mountedRef.current) {
          setSession(newSession);
          setUser(newSession?.user ?? null);
          
          if (newSession) {
            localStorage.setItem('p10_has_session', 'true');
            await fetchProfile(newSession.user.id);
          } else {
            localStorage.removeItem('p10_has_session');
            localStorage.removeItem('p10_is_admin');
            localStorage.removeItem('p10_cached_profile');
            setProfile(null);
          }
          setIsLoading(false);
        }
      }
    );

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile, supabase]);

  useEffect(() => {
    const handleResume = async () => {
      console.log('AuthProvider: APP_RESUME detected, refreshing session...');
      
      try {
        // Force a session refresh to get new JWT
        const { data: { session: refreshedSession }, error } = await supabase.auth.refreshSession();
        
        if (error) {
          console.error('AuthProvider: Session refresh error:', error);
        }

        if (mountedRef.current) {
          if (refreshedSession) {
            setSession(refreshedSession);
            setUser(refreshedSession.user);
            await fetchProfile(refreshedSession.user.id);
          } else {
            // If no session after refresh, check if we still have one
            const { data: { session: currentSession } } = await supabase.auth.getSession();
            setSession(currentSession);
            setUser(currentSession?.user ?? null);
          }
        }
      } catch (err) {
        console.error('AuthProvider: handleResume critical error:', err);
      } finally {
        console.log('AuthProvider: Refresh complete, broadcasting APP_READY');
        window.dispatchEvent(new CustomEvent(APP_READY_EVENT));
      }
    };

    window.addEventListener(APP_RESUME_EVENT, handleResume);
    return () => window.removeEventListener(APP_RESUME_EVENT, handleResume);
  }, [fetchProfile, supabase]);

  return (
    <AuthContext.Provider value={{ session, user, profile, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
