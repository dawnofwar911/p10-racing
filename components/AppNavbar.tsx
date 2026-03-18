'use client';

import { Navbar, Nav } from 'react-bootstrap';
import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { User } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Session } from '@supabase/supabase-js';
import { NAV_ITEMS } from '@/lib/navigation';
import UserDrawer from './UserDrawer';
import { STORAGE_KEYS, setStorageItem, removeStorageItem } from '@/lib/utils/storage';

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
      const cachedUser = localStorage.getItem(STORAGE_KEYS.CACHE_USERNAME);
      const cachedIsAdmin = localStorage.getItem(STORAGE_KEYS.IS_ADMIN) === 'true';
      if (cachedUser) {
        setCurrentUser(cachedUser);
        setIsAdmin(cachedIsAdmin);
      } else {
        const localUser = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
        setCurrentUser(localUser);
      }

      const { data: { session: currentSession } } = await supabase.auth.getSession();
      setSession(currentSession);

      if (currentSession) {
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
        setStorageItem(STORAGE_KEYS.HAS_SESSION, 'false');
        removeStorageItem(STORAGE_KEYS.CACHE_USERNAME);
        removeStorageItem(STORAGE_KEYS.IS_ADMIN);
        const localUser = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
        setCurrentUser(localUser);
      }
      setIsAuthReady(true);
    }

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      if (event === 'SIGNED_OUT') {
        setStorageItem(STORAGE_KEYS.HAS_SESSION, 'false');
        removeStorageItem(STORAGE_KEYS.CACHE_USERNAME);
        removeStorageItem(STORAGE_KEYS.IS_ADMIN);
        const localUser = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
        setCurrentUser(localUser);
        setIsAdmin(false);
        window.location.href = '/';
        return;
      }
      
      if (!newSession) {
        setStorageItem(STORAGE_KEYS.HAS_SESSION, 'false');
        removeStorageItem(STORAGE_KEYS.CACHE_USERNAME);
        removeStorageItem(STORAGE_KEYS.IS_ADMIN);
        const localUser = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
        setCurrentUser(localUser);
        setIsAdmin(false);
      } else {
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

    return () => subscription.unsubscribe();
  }, [supabase]);

  const handleLogout = async () => {
    Haptics.impact({ style: ImpactStyle.Medium });
    // Clear all session-related cache immediately
    setStorageItem(STORAGE_KEYS.HAS_SESSION, 'false');
    removeStorageItem(STORAGE_KEYS.CACHE_USERNAME);
    removeStorageItem(STORAGE_KEYS.IS_ADMIN);
    removeStorageItem(STORAGE_KEYS.CURRENT_USER);
    
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
