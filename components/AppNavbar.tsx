'use client';

import { Navbar, Nav, Button } from 'react-bootstrap';
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
        </Navbar.Brand>
      </Link>

      <Nav className="ms-auto d-none d-lg-flex flex-row align-items-center gap-3">
        {NAV_ITEMS.map((item) => (
          <Link key={item.href} href={item.href} passHref legacyBehavior>
            <Nav.Link 
              active={pathname === item.href} 
              className={`text-uppercase small fw-bold letter-spacing-1 ${pathname === item.href ? 'text-danger' : 'text-white opacity-75'}`}
              onClick={triggerHaptic}
            >
              {item.label}
            </Nav.Link>
          </Link>
        ))}
        {isAdmin && (
          <Link href="/admin" passHref legacyBehavior>
            <Nav.Link active={isOnAdminPage} className={`text-uppercase small fw-bold letter-spacing-1 ${isOnAdminPage ? 'text-warning' : 'text-warning opacity-75'}`} onClick={triggerHaptic}>ADMIN</Nav.Link>
          </Link>
        )}
      </Nav>

      <div className="ms-auto ms-lg-3 d-flex align-items-center gap-2">
        <Button 
          variant="link" 
          className="p-0 text-white opacity-75 hover-opacity-100 transition-all d-flex align-items-center justify-content-center"
          style={{ width: '36px', height: '36px' }}
          onClick={() => { triggerHaptic(); setShowDrawer(true); }}
        >
          <div className="bg-danger text-white rounded-circle d-flex justify-content-center align-items-center fw-bold shadow-sm" style={{ width: '32px', height: '32px', fontSize: '0.8rem' }}>
            {currentUser ? currentUser.charAt(0).toUpperCase() : <User size={16} />}
          </div>
        </Button>
      </div>
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
