'use client';

import { Navbar, Container, Button, NavbarText, NavbarCollapse, NavbarToggle, Nav } from 'react-bootstrap';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export default function AppNavbar() {
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const user = localStorage.getItem('p10_current_user');
    setCurrentUser(user);
  }, [pathname]); // Refresh when navigating

  const handleLogout = () => {
    localStorage.removeItem('p10_current_user');
    setCurrentUser(null);
    router.push('/');
  };

  const isAdmin = pathname === '/admin';

  return (
    <Navbar variant="dark" expand="lg" className="px-3 sticky-top">
      <Link href="/" passHref legacyBehavior>
        <Navbar.Brand className="fw-bold cursor-pointer d-flex align-items-center">
          <img 
            src="/logo.svg" 
            alt="Logo" 
            width="30" 
            height="30" 
            className="d-inline-block align-top me-2"
          />
          <span className="d-none d-sm-inline">P10 <span style={{ color: '#e10600' }}>RACING</span></span>
          <span className="d-inline d-sm-none">P10 <span style={{ color: '#e10600' }}>R</span></span>
          {isAdmin && <span className="ms-1 small opacity-50">(ADMIN)</span>}
        </Navbar.Brand>
      </Link>
      
      <NavbarToggle aria-controls="basic-navbar-nav" className="border-0 shadow-none" />
      
      <NavbarCollapse id="basic-navbar-nav">
        <Nav className="me-auto mt-2 mt-lg-0">
          <Link href="/predict" className={`nav-link small ${pathname === '/predict' ? 'text-white fw-bold border-bottom border-danger' : 'text-light opacity-75'}`}>Predict</Link>
          <Link href="/standings" className={`nav-link small ${pathname === '/standings' ? 'text-white fw-bold border-bottom border-danger' : 'text-light opacity-75'}`}>Standings</Link>
          <Link href="/history" className={`nav-link small ${pathname === '/history' ? 'text-white fw-bold border-bottom border-danger' : 'text-light opacity-75'}`}>History</Link>
          <Link href="/leaderboard" className={`nav-link small ${pathname === '/leaderboard' ? 'text-white fw-bold border-bottom border-danger' : 'text-light opacity-75'}`}>Leaderboard</Link>
        </Nav>
        
        {currentUser && (
          <div className="d-flex align-items-center gap-3 mt-3 mt-lg-0 border-top border-secondary pt-3 pt-lg-0 border-lg-0">
            <NavbarText className="text-light small">
              Player: <span className="fw-bold text-white">{currentUser}</span>
            </NavbarText>
            <Button variant="outline-danger" size="sm" onClick={handleLogout} style={{ fontSize: '0.7rem', padding: '4px 12px' }}>
              Log Out
            </Button>
          </div>
        )}
      </NavbarCollapse>
    </Navbar>
  );
}
