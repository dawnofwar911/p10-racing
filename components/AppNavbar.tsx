'use client';

import { Navbar, Container, Button, NavbarText, NavbarCollapse } from 'react-bootstrap';
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
    <Navbar variant="dark" className="px-3">
      <Link href="/" passHref legacyBehavior>
        <Navbar.Brand className="fw-bold cursor-pointer">
          P10 <span style={{ color: '#e10600' }}>RACING</span> {isAdmin && <span className="ms-1 small opacity-50">(ADMIN)</span>}
        </Navbar.Brand>
      </Link>
      <div className="ms-3 d-flex align-items-center">
        <Link href="/predict" className={`text-light text-decoration-none small me-3 ${pathname === '/predict' ? 'fw-bold border-bottom border-danger' : 'opacity-75'}`}>Predict</Link>
        <Link href="/history" className={`text-light text-decoration-none small me-3 ${pathname === '/history' ? 'fw-bold border-bottom border-danger' : 'opacity-75'}`}>History</Link>
        <Link href="/leaderboard" className={`text-light text-decoration-none small ${pathname === '/leaderboard' ? 'fw-bold border-bottom border-danger' : 'opacity-75'}`}>Leaderboard</Link>
      </div>
      {currentUser && (
        <NavbarCollapse className="justify-content-end">
          <NavbarText className="text-light small me-3 d-none d-sm-inline">
            Playing as: <span className="fw-bold text-white">{currentUser}</span>
          </NavbarText>
          <Button variant="outline-danger" size="sm" onClick={handleLogout} style={{ fontSize: '0.7rem', padding: '2px 8px' }}>
            Log Out
          </Button>
        </NavbarCollapse>
      )}
    </Navbar>
  );
}
