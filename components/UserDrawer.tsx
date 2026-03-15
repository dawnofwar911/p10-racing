'use client';

import React from 'react';
import { Offcanvas, Button } from 'react-bootstrap';
import Link from 'next/link';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Settings, LogOut, ShieldAlert, History, LogIn, User } from 'lucide-react';
import { Session } from '@supabase/supabase-js';

interface UserDrawerProps {
  show: boolean;
  onHide: () => void;
  currentUser: string | null;
  session: Session | null;
  isAdmin: boolean;
  onLogout: () => void;
}

export default function UserDrawer({ show, onHide, currentUser, session, isAdmin, onLogout }: UserDrawerProps) {
  const triggerHaptic = () => {
    Haptics.impact({ style: ImpactStyle.Light });
  };

  const handleLinkClick = () => {
    triggerHaptic();
    onHide();
  };

  return (
    <Offcanvas 
      show={show} 
      onHide={onHide} 
      placement="end" 
      className="bg-dark border-start border-secondary text-white user-drawer-offcanvas"
      style={{ width: '300px' }}
    >
      <Offcanvas.Header closeButton closeVariant="white" className="border-bottom border-secondary border-opacity-50 pb-3">
        <Offcanvas.Title className="fw-bold text-uppercase letter-spacing-1 h6 mb-0">
          Player Profile
        </Offcanvas.Title>
      </Offcanvas.Header>
      
      <Offcanvas.Body className="d-flex flex-column p-0">
        {/* User Header */}
        <div className="p-4 bg-black bg-opacity-25 border-bottom border-secondary border-opacity-25">
          <p className="text-muted small text-uppercase letter-spacing-1 mb-1">Signed in as</p>
          <div className="d-flex align-items-center">
            <div className="bg-danger text-white rounded-circle d-flex justify-content-center align-items-center fw-bold me-3" style={{ width: '45px', height: '45px', fontSize: '1.2rem' }}>
              {currentUser ? (
                currentUser.charAt(0).toUpperCase()
              ) : (
                <User size={24} />
              )}
            </div>
            <div>
              <h4 className="mb-0 fw-bold">{currentUser || 'Guest'}</h4>
              {isAdmin && <span className="badge bg-warning text-dark mt-1" style={{ fontSize: '0.6rem' }}>SYSTEM ADMIN</span>}
            </div>
          </div>
        </div>

        {/* Navigation Actions */}
        <div className="p-3 flex-grow-1">
          <div className="d-flex flex-column gap-2">
            {isAdmin && (
              <Link href="/admin" passHref legacyBehavior>
                <Button 
                  variant="outline-warning" 
                  className="w-100 text-start d-flex align-items-center border-0 p-3 rounded"
                  onClick={handleLinkClick}
                >
                  <ShieldAlert size={20} className="me-3" />
                  <span className="fw-bold letter-spacing-1 text-uppercase small">Admin Panel</span>
                </Button>
              </Link>
            )}

            <Link href="/history" passHref legacyBehavior>
              <Button 
                variant="outline-light" 
                className="w-100 text-start d-flex align-items-center border-0 p-3 rounded opacity-75 hover-opacity-100"
                onClick={handleLinkClick}
              >
                <History size={20} className="me-3" />
                <span className="fw-bold letter-spacing-1 text-uppercase small">Season History</span>
              </Button>
            </Link>

            <Link href="/settings" passHref legacyBehavior>
              <Button 
                variant="outline-light" 
                className="w-100 text-start d-flex align-items-center border-0 p-3 rounded opacity-75 hover-opacity-100"
                onClick={handleLinkClick}
              >
                <Settings size={20} className="me-3" />
                <span className="fw-bold letter-spacing-1 text-uppercase small">Settings & Info</span>
              </Button>
            </Link>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-top border-secondary border-opacity-25 mt-auto">
          {session ? (
            <Button 
              variant="danger" 
              className="w-100 fw-bold py-3 d-flex align-items-center justify-content-center"
              onClick={() => {
                onLogout();
                onHide();
              }}
            >
              <LogOut size={18} className="me-2" />
              SIGN OUT
            </Button>
          ) : (
            <Link href="/auth" passHref legacyBehavior>
              <Button 
                variant="primary" 
                className="w-100 fw-bold py-3 d-flex align-items-center justify-content-center rounded-pill"
                onClick={handleLinkClick}
              >
                <LogIn size={18} className="me-2" />
                SIGN IN
              </Button>
            </Link>
          )}
        </div>
      </Offcanvas.Body>
    </Offcanvas>
  );
}
