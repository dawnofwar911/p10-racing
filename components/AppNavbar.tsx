'use client';

import { Navbar, Nav } from 'react-bootstrap';
import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { User, CloudOff } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Session } from '@supabase/supabase-js';
import { NAV_ITEMS } from '@/lib/navigation';
import UserDrawer from './UserDrawer';
import { App } from '@capacitor/app';
import { Capacitor, PluginListenerHandle } from '@capacitor/core';
import { syncPendingPredictions, hasPendingPrediction } from '@/lib/supabase/sync';
import { storage } from '@/lib/storage';

export default function AppNavbar() {
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const [isSyncPending, setIsSyncPending] = useState(false);
  const pathname = usePathname();
  const supabase = createClient();

  const resetToGuestState = useCallback(async () => {
    await storage.removeItem('p10_cache_username');
    await storage.removeItem('p10_cache_is_admin');
    await storage.removeItem('p10_current_user');
    setCurrentUser(null);
    setIsAdmin(false);
  }, []);

  const triggerSync = useCallback(async (currentSession: Session | null) => {
    if (!currentSession) return;
    const success = await syncPendingPredictions(currentSession);
    setIsSyncPending(hasPendingPrediction(currentSession.user.id));
    return success;
  }, []);

  const sessionRef = useRef<Session | null>(null);

  useEffect(() => {
    async function initializeAuth() {
      // 1. Initial UI from cache
      const cachedUser = storage.getItemSync('p10_cache_username');
      const cachedIsAdmin = storage.getItemSync('p10_cache_is_admin') === 'true';
      
      if (cachedUser) {
        setCurrentUser(cachedUser);
        setIsAdmin(cachedIsAdmin);
        setIsAuthReady(true);
      } else {
        const localUser = storage.getItemSync('p10_current_user');
        setCurrentUser(localUser);
      }

      // 2. Network check
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        setSession(currentSession);
        sessionRef.current = currentSession;
        
        if (!currentSession) {
          await resetToGuestState();
        }
      } catch (error) {
        console.error('Session fetch error:', error);
      } finally {
        setIsAuthReady(true);
      }
    }

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      setSession(newSession);
      sessionRef.current = newSession;

      if (event === 'SIGNED_OUT') {
        await resetToGuestState();
        window.location.href = '/';
        return;
      }
      
      if (newSession) {
        setIsSyncPending(hasPendingPrediction(newSession.user.id));
        triggerSync(newSession);

        const { data: profile } = await supabase
          .from('profiles')
          .select('username, is_admin')
          .eq('id', newSession.user.id)
          .single();
        
        if (profile) {
          setCurrentUser(profile.username);
          setIsAdmin(!!profile.is_admin);
          await storage.setItem('p10_cache_username', profile.username);
          await storage.setItem('p10_cache_is_admin', String(!!profile.is_admin));
        } else {
          const fallback = newSession.user.email?.split('@')[0] || 'User';
          setCurrentUser(fallback);
          await storage.setItem('p10_cache_username', fallback);
        }
      } else if (event !== 'INITIAL_SESSION') {
        await resetToGuestState();
      }
    });

    // Background listeners
    const handleOnline = () => {
      if (sessionRef.current) triggerSync(sessionRef.current);
    };
    window.addEventListener('online', handleOnline);

    let appStateListener: Promise<PluginListenerHandle> | undefined;
    if (Capacitor.isNativePlatform()) {
      appStateListener = App.addListener('appStateChange', ({ isActive }) => {
        if (isActive && sessionRef.current) triggerSync(sessionRef.current);
      });
    }

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('online', handleOnline);
      if (appStateListener) {
        appStateListener.then(l => l.remove());
      }
    };
  }, [supabase, resetToGuestState, triggerSync]);

  const handleLogout = async () => {
    Haptics.impact({ style: ImpactStyle.Medium });
    
    // 1. Fully clear all user identities (Cloud & Guest)
    await resetToGuestState();
    
    // 2. Perform the actual Supabase logout
    if (session) {
      await supabase.auth.signOut();
    } else {
      // If there's no session, we still want to refresh to clear any stale state
      window.location.href = '/';
    }
    
    // Note: If session exists, onAuthStateChange ('SIGNED_OUT') will trigger the refresh.
  };

  const triggerHaptic = () => {
    Haptics.impact({ style: ImpactStyle.Light });
  };

  const isOnAdminPage = pathname === '/admin';
  const isOnResetPage = pathname === '/auth/reset-password';

  return (
    <>
    <Navbar 
      variant="dark" 
      expand="lg" 
      className="px-3 border-bottom border-secondary border-opacity-25" 
      style={{ backgroundColor: '#15151e' }}
    >
      <Link href="/" passHref legacyBehavior>
        <Navbar.Brand className="fw-bold cursor-pointer d-flex align-items-center" onClick={triggerHaptic}>
          <Image 
            src="/logo.svg" 
            alt="Logo" 
            width={28} 
            height={28} 
            className="d-inline-block align-top me-2"
          />
          <span className="d-none d-sm-inline letter-spacing-1" style={{ fontSize: '1.1rem' }}>P10 <span style={{ color: '#e10600' }}>RACING</span></span>
          <span className="d-inline d-sm-none letter-spacing-1" style={{ fontSize: '1.1rem' }}>P10 <span style={{ color: '#e10600' }}>R</span></span>
          {isOnAdminPage && <span className="ms-2 badge bg-danger" style={{ fontSize: '0.6rem' }}>ADMIN</span>}
        </Navbar.Brand>
      </Link>
      
      {!isOnResetPage && (
        <>
          <div className="d-flex align-items-center ms-auto order-lg-last">
            {isAuthReady ? (
              <button 
                onClick={() => { triggerHaptic(); setShowDrawer(true); }}
                className="btn btn-link p-0 text-decoration-none d-flex align-items-center border-0"
              >
                <div className="d-flex flex-column align-items-end me-2 d-none d-sm-flex">
                  <span className="text-light small text-uppercase letter-spacing-1 opacity-75 d-flex align-items-center" style={{ fontSize: '0.6rem', lineHeight: 1 }}>
                    {(session || currentUser) ? 'Player' : 'Guest'}
                    {isSyncPending && <span title="Sync Pending"><CloudOff size={10} className="ms-1 text-warning" /></span>}
                  </span>
                  <span className="fw-bold text-white text-uppercase" style={{ fontSize: '0.8rem', lineHeight: 1 }}>
                    {currentUser || 'Profile'}
                  </span>
                </div>
                <div className={`bg-secondary bg-opacity-25 rounded-circle d-flex justify-content-center align-items-center text-white fw-bold border ${isSyncPending ? 'border-warning' : 'border-secondary border-opacity-50'}`} style={{ width: '32px', height: '32px', fontSize: '0.9rem' }}>
                  {(session || currentUser) ? (currentUser?.charAt(0).toUpperCase() || '?') : <User size={18} />}
                </div>
              </button>
            ) : (
              <div style={{ height: '31px', width: '80px' }}></div>
            )}
          </div>

          <Nav className="me-auto ms-xl-4 d-none d-xl-flex gap-2">
            {NAV_ITEMS.map((item) => (
              <Link 
                key={item.href}
                href={item.href} 
                onClick={triggerHaptic} 
                className={`nav-link text-uppercase fw-bold letter-spacing-1 ${pathname === item.href ? 'text-danger border-bottom border-danger border-2' : 'text-light opacity-75'}`} 
                style={{ fontSize: '0.75rem' }}
              >
                {item.label}
              </Link>
            ))}
          </Nav>
        </>
      )}
    </Navbar>

    <UserDrawer 
      show={showDrawer} 
      onHide={() => setShowDrawer(false)} 
      currentUser={currentUser} 
      session={session} 
      isAdmin={isAdmin} 
      onLogout={handleLogout} 
    />
    </>
  );
}
