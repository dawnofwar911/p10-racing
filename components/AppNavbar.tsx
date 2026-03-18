'use client';

import { Navbar, Nav } from 'react-bootstrap';
import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { User } from 'lucide-react';
import { NAV_ITEMS } from '@/lib/navigation';
import UserDrawer from './UserDrawer';
import { useAuth } from './AuthProvider';

export default function AppNavbar() {
  const { session, currentUser, isAdmin, isAuthLoading, logout } = useAuth();
  const [showDrawer, setShowDrawer] = useState(false);
  const pathname = usePathname();

  const handleLogout = async () => {
    Haptics.impact({ style: ImpactStyle.Medium });
    await logout();
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
            {!isAuthLoading ? (
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
            {isAdmin && (
              <Link 
                href="/admin" 
                onClick={triggerHaptic} 
                className={`nav-link text-uppercase fw-bold letter-spacing-1 ${isOnAdminPage ? 'text-warning border-bottom border-warning border-2' : 'text-warning opacity-75'}`} 
                style={{ fontSize: '0.75rem' }}
              >
                ADMIN
              </Link>
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
