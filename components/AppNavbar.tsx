'use client';

import { Navbar, Button, NavbarText, NavbarCollapse, NavbarToggle, Nav } from 'react-bootstrap';
import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { createClient } from '@/lib/supabase/client';
import { Session } from '@supabase/supabase-js';

export default function AppNavbar() {
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const router = useRouter();
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
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
    localStorage.removeItem('p10_cache_username');
    localStorage.removeItem('p10_cache_is_admin');
    if (session) {
      await supabase.auth.signOut();
    }
    localStorage.removeItem('p10_current_user');
    setCurrentUser(null);
    setIsAdmin(false);
    router.push('/');
  };

  const triggerHaptic = () => {
    Haptics.impact({ style: ImpactStyle.Light });
  };

  const isOnAdminPage = pathname === '/admin';

  return (
    <Navbar variant="dark" expand="lg" className="px-3 sticky-top border-bottom border-secondary border-opacity-25" style={{ backgroundColor: 'rgba(21, 21, 30, 0.85)', backdropFilter: 'blur(10px)' }}>
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
      
      <NavbarToggle aria-controls="basic-navbar-nav" className="border-0 shadow-none p-0" onClick={triggerHaptic} />
      
      <NavbarCollapse id="basic-navbar-nav">
        <Nav className="me-auto mt-3 mt-lg-0 gap-lg-2">
          <Link href="/predict" onClick={triggerHaptic} className={`nav-link text-uppercase fw-bold letter-spacing-1 ${pathname === '/predict' ? 'text-danger border-bottom border-danger border-2' : 'text-light opacity-75'}`} style={{ fontSize: '0.75rem' }}>Predict</Link>
          <Link href="/leagues" onClick={triggerHaptic} className={`nav-link text-uppercase fw-bold letter-spacing-1 ${pathname === '/leagues' ? 'text-danger border-bottom border-danger border-2' : 'text-light opacity-75'}`} style={{ fontSize: '0.75rem' }}>Leagues</Link>
          <Link href="/leaderboard" onClick={triggerHaptic} className={`nav-link text-uppercase fw-bold letter-spacing-1 ${pathname === '/leaderboard' ? 'text-danger border-bottom border-danger border-2' : 'text-light opacity-75'}`} style={{ fontSize: '0.75rem' }}>Leaderboard</Link>
          <Link href="/standings" onClick={triggerHaptic} className={`nav-link text-uppercase fw-bold letter-spacing-1 ${pathname === '/standings' ? 'text-danger border-bottom border-danger border-2' : 'text-light opacity-75'}`} style={{ fontSize: '0.75rem' }}>Standings</Link>
          <Link href="/history" onClick={triggerHaptic} className={`nav-link text-uppercase fw-bold letter-spacing-1 ${pathname === '/history' ? 'text-danger border-bottom border-danger border-2' : 'text-light opacity-75'}`} style={{ fontSize: '0.75rem' }}>History</Link>
          {isAdmin && (
            <Link href="/admin" onClick={triggerHaptic} className={`nav-link text-uppercase fw-bold letter-spacing-1 ${pathname === '/admin' ? 'text-danger border-bottom border-danger border-2' : 'text-warning opacity-75'}`} style={{ fontSize: '0.75rem' }}>Admin</Link>
          )}
        </Nav>
        
        <div className="d-flex align-items-center gap-3 mt-4 mt-lg-0 pt-3 pt-lg-0 border-top border-secondary border-opacity-25 border-lg-0">
          {isAuthReady && (session || currentUser) ? (
            <>
              <NavbarText className="text-light small text-uppercase letter-spacing-1 opacity-75">
                Player: <span className="fw-bold text-white opacity-100">{currentUser}</span>
              </NavbarText>
              <Button variant="outline-light" size="sm" onClick={handleLogout} className="rounded-pill px-3 border-opacity-50" style={{ fontSize: '0.65rem', fontWeight: 'bold' }}>
                SIGN OUT
              </Button>
            </>
          ) : isAuthReady ? (
            <Link href="/auth" passHref legacyBehavior>
              <Button variant="outline-danger" size="sm" onClick={triggerHaptic} className="rounded-pill px-4 fw-bold" style={{ fontSize: '0.7rem' }}>
                SIGN IN
              </Button>
            </Link>
          ) : null}
        </div>
      </NavbarCollapse>
    </Navbar>
  );
}
