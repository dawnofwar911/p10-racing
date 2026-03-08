'use client';

import { Navbar, Button, NavbarText, NavbarCollapse, NavbarToggle, Nav } from 'react-bootstrap';
import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

export default function AppNavbar() {
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const user = localStorage.getItem('p10_current_user');
    setCurrentUser(user);
  }, [pathname]);

  const handleLogout = () => {
    Haptics.impact({ style: ImpactStyle.Medium });
    localStorage.removeItem('p10_current_user');
    setCurrentUser(null);
    router.push('/');
  };

  const triggerHaptic = () => {
    Haptics.impact({ style: ImpactStyle.Light });
  };

  const isAdmin = pathname === '/admin';

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
          {isAdmin && <span className="ms-2 badge bg-danger" style={{ fontSize: '0.6rem' }}>ADMIN</span>}
        </Navbar.Brand>
      </Link>
      
      <NavbarToggle aria-controls="basic-navbar-nav" className="border-0 shadow-none p-0" onClick={triggerHaptic} />
      
      <NavbarCollapse id="basic-navbar-nav">
        <Nav className="me-auto mt-3 mt-lg-0 gap-lg-2">
          <Link href="/predict" onClick={triggerHaptic} className={`nav-link text-uppercase fw-bold letter-spacing-1 ${pathname === '/predict' ? 'text-danger border-bottom border-danger border-2' : 'text-light opacity-75'}`} style={{ fontSize: '0.75rem' }}>Predict</Link>
          <Link href="/leaderboard" onClick={triggerHaptic} className={`nav-link text-uppercase fw-bold letter-spacing-1 ${pathname === '/leaderboard' ? 'text-danger border-bottom border-danger border-2' : 'text-light opacity-75'}`} style={{ fontSize: '0.75rem' }}>Leaderboard</Link>
          <Link href="/standings" onClick={triggerHaptic} className={`nav-link text-uppercase fw-bold letter-spacing-1 ${pathname === '/standings' ? 'text-danger border-bottom border-danger border-2' : 'text-light opacity-75'}`} style={{ fontSize: '0.75rem' }}>Standings</Link>
          <Link href="/history" onClick={triggerHaptic} className={`nav-link text-uppercase fw-bold letter-spacing-1 ${pathname === '/history' ? 'text-danger border-bottom border-danger border-2' : 'text-light opacity-75'}`} style={{ fontSize: '0.75rem' }}>History</Link>
        </Nav>
        
        {currentUser && (
          <div className="d-flex align-items-center gap-3 mt-4 mt-lg-0 pt-3 pt-lg-0 border-top border-secondary border-opacity-25 border-lg-0">
            <NavbarText className="text-light small text-uppercase letter-spacing-1 opacity-75">
              Player: <span className="fw-bold text-white opacity-100">{currentUser}</span>
            </NavbarText>
            <Button variant="outline-light" size="sm" onClick={handleLogout} className="rounded-pill px-3 border-opacity-50" style={{ fontSize: '0.65rem', fontWeight: 'bold' }}>
              SIGN OUT
            </Button>
          </div>
        )}
      </NavbarCollapse>
    </Navbar>
  );
}
