'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Session, User } from '@supabase/supabase-js';

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

const supabase = createClient();

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  
  // Try to synchronously read standard local storage if possible to prevent initial flash
  const [isLoading, setIsLoading] = useState(() => {
    if (typeof window !== 'undefined') {
       // Only start as loading if we're fairly sure they have a session to prevent flash.
       // If they're a guest (no p10_has_session), we show the guest UI immediately.
       return localStorage.getItem('p10_has_session') === 'true';
    }
    return true;
  });

  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('id, username, is_admin, avatar_url')
      .eq('id', userId)
      .maybeSingle();
    
    if (data) {
      setProfile(data as Profile);
      localStorage.setItem('p10_is_admin', data.is_admin ? 'true' : 'false');
    } else {
      setProfile(null);
      localStorage.removeItem('p10_is_admin');
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    
    // Always fetch latest session to be sure, regardless of optimistic state.
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (mounted) {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session) {
          localStorage.setItem('p10_has_session', 'true');
          await fetchProfile(session.user.id);
        } else {
          localStorage.removeItem('p10_has_session');
          localStorage.removeItem('p10_is_admin');
          setProfile(null);
        }
        setIsLoading(false);
      }
    });

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (mounted) {
          setSession(session);
          setUser(session?.user ?? null);
          
          if (session) {
            localStorage.setItem('p10_has_session', 'true');
            await fetchProfile(session.user.id);
          } else {
            localStorage.removeItem('p10_has_session');
            localStorage.removeItem('p10_is_admin');
            setProfile(null);
          }
          setIsLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

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
