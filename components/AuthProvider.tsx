'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Session, User } from '@supabase/supabase-js';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  isLoading: true,
});

const supabase = createClient();

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  
  // Try to synchronously read standard local storage if possible to prevent initial flash
  const [isLoading, setIsLoading] = useState(() => {
    if (typeof window !== 'undefined') {
       // Only start as loading if we're fairly sure they have a session to prevent flash.
       // If they're a guest (no p10_has_session), we show the guest UI immediately.
       return localStorage.getItem('p10_has_session') === 'true';
    }
    return true;
  });

  useEffect(() => {
    let mounted = true;
    
    // Always fetch latest session to be sure, regardless of optimistic state.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) {
        setSession(session);
        setUser(session?.user ?? null);
        setIsLoading(false);
        
        if (session) {
          localStorage.setItem('p10_has_session', 'true');
        } else {
          localStorage.removeItem('p10_has_session');
        }
      }
    });

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (mounted) {
          setSession(session);
          setUser(session?.user ?? null);
          setIsLoading(false);
          
          if (session) {
            localStorage.setItem('p10_has_session', 'true');
          } else {
            localStorage.removeItem('p10_has_session');
          }
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ session, user, isLoading }}>
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
