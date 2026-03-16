'use client';

import { Navbar, Nav } from 'react-bootstrap';
import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { User } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Session } from '@supabase/supabase-js';
import { NAV_ITEMS } from '@/lib/navigation';
import UserDrawer from './UserDrawer';

export default function AppNavbar() {
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const pathname = usePathname();
  const supabase = createClient();

  const resetToGuestState = useCallback(() => {
    localStorage.removeItem('p10_cache_username');
    localStorage.removeItem('p10_cache_is_admin');
    const localUser = localStorage.getItem('p10_current_user');
    setCurrentUser(localUser);
    setIsAdmin(false);
  }, []);

  useEffect(() => {
    async function getSession() {
      // 1. Load from cache immediately for instant UI if data exists
      const cachedUser = localStorage.getItem('p10_cache_username');
      const cachedIsAdmin = localStorage.getItem('p10_cache_is_admin') === 'true';
      
      if (cachedUser) {
        setCurrentUser(cachedUser);
        setIsAdmin(cachedIsAdmin);
        setIsAuthReady(true); // Only ready immediately if we have cache to show
      } else {
        const localUser = localStorage.getItem('p10_current_user');
        setCurrentUser(localUser);
        // Do NOT set isAuthReady yet to avoid "Guest" flash for slow connections
      }

      try {
        const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) throw sessionError;
        
        setSession(currentSession);

        if (currentSession) {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('username, is_admin')
            .eq('id', currentSession.user.id)
            .single();
          
          if (profile) {
            setCurrentUser(profile.username);
            setIsAdmin(!!profile.is_admin);
            localStorage.setItem('p10_cache_username', profile.username);
            localStorage.setItem('p10_cache_is_admin', String(!!profile.is_admin));
          } else if (!profileError) {
            // Profile explicitly doesn't exist (not a network error)
            const fallback = currentSession.user.email?.split('@')[0] || 'User';
            setCurrentUser(fallback);
            localStorage.setItem('p10_cache_username', fallback);
          }
          // If profileError exists (likely network), we keep the cached values we already loaded
        } else {
          // Explicitly no session, clear cache
          resetToGuestState();
        }
      } catch (error: any) {
        console.error('Session fetch error:', error);
        // Only reset if it's NOT a network error. 
        // If we are offline, we want to keep the cached identity.
        const isNetworkError = error?.message?.includes('fetch') || error?.code === 'PGRST301' || !window.navigator.onLine;
        if (!isNetworkError) {
          resetToGuestState();
        }
      } finally {
        setIsAuthReady(true); // Always ready after network check
      }
    }

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      if (event === 'SIGNED_OUT') {
        resetToGuestState();
        window.location.href = '/';
        return;
      }
      
      if (!newSession && event !== 'INITIAL_SESSION') {
        // Only reset if explicitly null after an event that isn't just the initial load
        resetToGuestState();
      } else if (newSession) {
        supabase
          .from('profiles')
          .select('username, is_admin')
          .eq('id', newSession.user.id)
          .single()
          .then(({ data, error }) => {
            if (data) {
              setCurrentUser(data.username);
              setIsAdmin(!!data.is_admin);
              localStorage.setItem('p10_cache_username', data.username);
              localStorage.setItem('p10_cache_is_admin', String(!!data.is_admin));
            } else if (newSession && !error) {
              const fallback = newSession.user.email?.split('@')[0] || 'User';
              setCurrentUser(fallback);
              localStorage.setItem('p10_cache_username', fallback);
            }
          });
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, resetToGuestState]);

  const handleLogout = async () => {
    Haptics.impact({ style: ImpactStyle.Medium });
    
    // Clear additional guest-only data
    localStorage.removeItem('p10_current_user');
    resetToGuestState();
    
    if (session) {
      await supabase.auth.signOut();
    }
    
    // Force a full page refresh to clear all React state globally
    window.location.href = '/';
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
                  <span className="text-light small text-uppercase letter-spacing-1 opacity-75" style={{ fontSize: '0.6rem', lineHeight: 1 }}>
                    {(session || currentUser) ? 'Player' : 'Guest'}
                  </span>
                  <span className="fw-bold text-white text-uppercase" style={{ fontSize: '0.8rem', lineHeight: 1 }}>
                    {currentUser || 'Profile'}
                  </span>
                </div>
                <div className="bg-secondary bg-opacity-25 rounded-circle d-flex justify-content-center align-items-center text-white fw-bold border border-secondary border-opacity-50" style={{ width: '32px', height: '32px', fontSize: '0.9rem' }}>
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
