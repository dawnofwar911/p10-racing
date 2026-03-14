'use client';

import { Navbar, Button, Nav } from 'react-bootstrap';
import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { createClient } from '@/lib/supabase/client';
import { Session } from '@supabase/supabase-js';
import UserDrawer from './UserDrawer';

export default function AppNavbar() {
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const pathname = usePathname();
  const supabase = createClient();

  useEffect(() => {
    async function getSession() {
      // 1. Load from cache immediately for instant UI
      const cachedUser = localStorage.getItem('p10_cache_username');
      const cachedIsAdmin = localStorage.getItem('p10_cache_is_admin') === 'true';
      if (cachedUser) {
        setCurrentUser(cachedUser);
        setIsAdmin(cachedIsAdmin);
      } else {
        const localUser = localStorage.getItem('p10_current_user');
        setCurrentUser(localUser);
      }

      const { data: { session: currentSession } } = await supabase.auth.getSession();
      setSession(currentSession);

      if (currentSession) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('username, is_admin')
          .eq('id', currentSession.user.id)
          .single();
        
        if (profile) {
          setCurrentUser(profile.username);
          setIsAdmin(!!profile.is_admin);
          localStorage.setItem('p10_cache_username', profile.username);
          localStorage.setItem('p10_cache_is_admin', String(!!profile.is_admin));
        } else {
          const fallback = currentSession.user.email?.split('@')[0] || 'User';
          setCurrentUser(fallback);
          localStorage.setItem('p10_cache_username', fallback);
        }
      } else {
        localStorage.removeItem('p10_cache_username');
        localStorage.removeItem('p10_cache_is_admin');
        const localUser = localStorage.getItem('p10_current_user');
        setCurrentUser(localUser);
      }
      setIsAuthReady(true);
    }

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      if (event === 'SIGNED_OUT') {
        localStorage.removeItem('p10_cache_username');
        localStorage.removeItem('p10_cache_is_admin');
        const localUser = localStorage.getItem('p10_current_user');
        setCurrentUser(localUser);
        setIsAdmin(false);
        window.location.href = '/';
        return;
      }
      
      if (!newSession) {
        localStorage.removeItem('p10_cache_username');
        localStorage.removeItem('p10_cache_is_admin');
        const localUser = localStorage.getItem('p10_current_user');
        setCurrentUser(localUser);
        setIsAdmin(false);
      } else {
        supabase
          .from('profiles')
          .select('username, is_admin')
          .eq('id', newSession.user.id)
          .single()
          .then(({ data }) => {
            if (data) {
              setCurrentUser(data.username);
              setIsAdmin(!!data.is_admin);
              localStorage.setItem('p10_cache_username', data.username);
              localStorage.setItem('p10_cache_is_admin', String(!!data.is_admin));
            } else {
              const fallback = newSession.user.email?.split('@')[0] || 'User';
              setCurrentUser(fallback);
              localStorage.setItem('p10_cache_username', fallback);
            }
          });
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const handleLogout = async () => {
    Haptics.impact({ style: ImpactStyle.Medium });
    // Clear all session-related cache immediately
    localStorage.removeItem('p10_cache_username');
    localStorage.removeItem('p10_cache_is_admin');
    localStorage.removeItem('p10_current_user');
    
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
            {(session || currentUser) ? (
              <button 
                onClick={() => { triggerHaptic(); setShowDrawer(true); }}
                className="btn btn-link p-0 text-decoration-none d-flex align-items-center border-0"
              >
                <div className="d-flex flex-column align-items-end me-2 d-none d-sm-flex">
                  <span className="text-light small text-uppercase letter-spacing-1 opacity-75" style={{ fontSize: '0.6rem', lineHeight: 1 }}>Player</span>
                  <span className="fw-bold text-white text-uppercase" style={{ fontSize: '0.8rem', lineHeight: 1 }}>{currentUser}</span>
                </div>
                <div className="bg-secondary bg-opacity-25 rounded-circle d-flex justify-content-center align-items-center text-white fw-bold border border-secondary border-opacity-50" style={{ width: '32px', height: '32px', fontSize: '0.9rem' }}>
                  {currentUser?.charAt(0).toUpperCase() || '?'}
                </div>
              </button>
            ) : isAuthReady ? (
              <Link href="/auth" passHref legacyBehavior>
                <Button variant="outline-danger" size="sm" onClick={triggerHaptic} className="rounded-pill px-4 fw-bold" style={{ fontSize: '0.7rem' }}>
                  SIGN IN
                </Button>
              </Link>
            ) : (
              <div style={{ height: '31px', width: '80px' }}></div>
            )}
          </div>

          <Nav className="me-auto ms-xl-4 d-none d-xl-flex gap-2">
            <Link href="/" onClick={triggerHaptic} className={`nav-link text-uppercase fw-bold letter-spacing-1 ${pathname === '/' ? 'text-danger border-bottom border-danger border-2' : 'text-light opacity-75'}`} style={{ fontSize: '0.75rem' }}>Home</Link>
            <Link href="/predict" onClick={triggerHaptic} className={`nav-link text-uppercase fw-bold letter-spacing-1 ${pathname === '/predict' ? 'text-danger border-bottom border-danger border-2' : 'text-light opacity-75'}`} style={{ fontSize: '0.75rem' }}>Predict</Link>
            <Link href="/leagues" onClick={triggerHaptic} className={`nav-link text-uppercase fw-bold letter-spacing-1 ${pathname === '/leagues' ? 'text-danger border-bottom border-danger border-2' : 'text-light opacity-75'}`} style={{ fontSize: '0.75rem' }}>Leagues</Link>
            <Link href="/leaderboard" onClick={triggerHaptic} className={`nav-link text-uppercase fw-bold letter-spacing-1 ${pathname === '/leaderboard' ? 'text-danger border-bottom border-danger border-2' : 'text-light opacity-75'}`} style={{ fontSize: '0.75rem' }}>Leaderboard</Link>
            <Link href="/standings" onClick={triggerHaptic} className={`nav-link text-uppercase fw-bold letter-spacing-1 ${pathname === '/standings' ? 'text-danger border-bottom border-danger border-2' : 'text-light opacity-75'}`} style={{ fontSize: '0.75rem' }}>Standings</Link>
            <Link href="/history" onClick={triggerHaptic} className={`nav-link text-uppercase fw-bold letter-spacing-1 ${pathname === '/history' ? 'text-danger border-bottom border-danger border-2' : 'text-light opacity-75'}`} style={{ fontSize: '0.75rem' }}>History</Link>
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
