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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  
  // Try to synchronously read standard local storage if possible to prevent initial flash
  const [isLoading, setIsLoading] = useState(() => {
    if (typeof window !== 'undefined') {
       // If we firmly know they have a session, we start as 'loading' to prevent flash of unauth
       // If they don't, we can maybe still start as loading just to be safe, 
       // but typically we want to be fast. Let's start as true by default.
       return true; 
    }
    return true;
  });

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;
    
    // Initial fetch
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
