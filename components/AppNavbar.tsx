'use client';

import { Navbar, Nav } from 'react-bootstrap';
import HapticLink from './HapticLink';
import HapticButton from './HapticButton';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { User } from 'lucide-react';
import { NAV_ITEMS } from '@/lib/navigation';
import UserDrawer from './UserDrawer';
import { useAuth } from './AuthProvider';

export default function AppNavbar() {
  const { session, currentUser, isAdmin, isAuthLoading, logout } = useAuth();
  const [showDrawer, setShowDrawer] = useState(false);
  const pathname = usePathname();

  const handleLogout = async () => {
    await logout();
  };

  const isOnAdminPage = pathname === '/admin';
  const isOnResetPage = pathname === '/auth/reset-password';

  // Support hardware back button closing the drawer
  useEffect(() => {
    if (!showDrawer) return;

    const handleBack = (e: CustomEvent) => {
      setShowDrawer(false);
      e.preventDefault(); // Stop default navigation behavior
    };
    window.addEventListener('backbutton', handleBack as EventListener);
    return () => window.removeEventListener('backbutton', handleBack as EventListener);
  }, [showDrawer]);

  return (
    <>
    <Navbar 
      variant="dark" 
      expand="lg" 
      className="px-3 border-bottom border-secondary border-opacity-25" 
      style={{ backgroundColor: '#15151e' }}
    >
      <HapticLink href="/">
        <Navbar.Brand className="fw-bold cursor-pointer d-flex align-items-center">
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
      </HapticLink>
      
      {!isOnResetPage && (
        <>
          <div className="d-flex align-items-center ms-auto order-lg-last">
            {!isAuthLoading ? (
              <HapticButton 
                variant="link"
                onClick={() => setShowDrawer(true)}
                className="p-0 text-decoration-none d-flex align-items-center border-0"
              >
                <div className="d-flex flex-column align-items-end me-2 d-none d-sm-flex">
                  <span className="text-light small text-uppercase letter-spacing-1 opacity-75" style={{ fontSize: '0.6rem', lineHeight: 1 }}>
                    {(session || currentUser) ? 'Player' : 'Guest'}
                  </span>
                  <span className="fw-bold text-white text-uppercase" style={{ fontSize: '0.8rem', lineHeight: 1 }}>
                    {currentUser || 'Profile'}
                  </span>
                </div>
                <div className="bg-secondary bg-opacity-25 rounded-3 d-flex justify-content-center align-items-center text-white fw-bold border border-secondary border-opacity-50" style={{ width: '32px', height: '32px', fontSize: '0.9rem' }}>
                  {(session || currentUser) ? (currentUser?.charAt(0).toUpperCase() || '?') : <User size={18} />}
                </div>
              </HapticButton>
            ) : (
              <div style={{ height: '31px', width: '80px' }}></div>
            )}
          </div>

          <Nav className="me-auto ms-xl-4 d-none d-xl-flex gap-2">
            {NAV_ITEMS.map((item) => (
              <HapticLink 
                key={item.href}
                href={item.href} 
                className={`nav-link text-uppercase fw-bold letter-spacing-1 ${pathname === item.href ? 'text-danger border-bottom border-danger border-2' : 'text-light opacity-75'}`} 
                style={{ fontSize: '0.75rem' }}
              >
                {item.label}
              </HapticLink>
            ))}
            {isAdmin && (
              <HapticLink 
                href="/admin" 
                className={`nav-link text-uppercase fw-bold letter-spacing-1 ${isOnAdminPage ? 'text-warning border-bottom border-warning border-2' : 'text-warning opacity-75'}`} 
                style={{ fontSize: '0.75rem' }}
              >
                ADMIN
              </HapticLink>
            )}
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
