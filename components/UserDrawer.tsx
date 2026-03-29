'use client';

import React from 'react';
import { Offcanvas } from 'react-bootstrap';
import HapticLink from './HapticLink';
import { Settings, LogOut, ShieldAlert, History, LogIn, User, Coffee, Trophy } from 'lucide-react';
import { Session } from '@supabase/supabase-js';
import HapticButton from './HapticButton';
import { useAchievements } from '@/lib/hooks/use-achievements';
import AchievementsSkeleton from './AchievementsSkeleton';

interface UserDrawerProps {
  show: boolean;
  onHide: () => void;
  currentUser: string | null;
  session: Session | null;
  isAdmin: boolean;
  onLogout: () => void;
}

export default function UserDrawer({ show, onHide, currentUser, session, isAdmin, onLogout }: UserDrawerProps) {
  const { unlocked, allAchievements, loading: achievementsLoading } = useAchievements();

  const handleLinkClick = () => {
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
      <Offcanvas.Header closeButton closeVariant="white" className="border-bottom border-secondary border-opacity-50 py-4">
        <Offcanvas.Title className="fw-bold text-uppercase letter-spacing-1 h6 mb-0">
          Player Profile
        </Offcanvas.Title>
      </Offcanvas.Header>
      
      <Offcanvas.Body className="d-flex flex-column p-0">
        {/* User Header */}
        <div className="p-4 bg-black bg-opacity-25 border-bottom border-secondary border-opacity-25">
          <p className="text-muted small text-uppercase letter-spacing-1 mb-1">Signed in as</p>
          <div className="d-flex align-items-center">
            <div className="rounded-circle d-flex justify-content-center align-items-center fw-bold me-3" style={{ 
              width: '45px', 
              height: '45px', 
              fontSize: '1.2rem', 
              backgroundColor: 'var(--team-accent, #e10600)',
              color: 'var(--team-accent-contrast, #ffffff)'
            }}>
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

        {/* Achievements Preview */}
        {achievementsLoading ? (
          <AchievementsSkeleton />
        ) : (
          <div className="p-3 border-bottom border-secondary border-opacity-25 bg-black bg-opacity-10">
            <div className="d-flex justify-content-between align-items-center mb-2 px-1">
              <span className="text-muted extra-small text-uppercase fw-bold letter-spacing-1">Achievements</span>
              <span className="badge" style={{ 
                fontSize: '0.6rem',
                backgroundColor: 'var(--team-accent-glow, rgba(225, 6, 0, 0.1))',
                color: 'var(--team-accent, #e10600)',
                border: '1px solid var(--team-accent-border, rgba(225, 6, 0, 0.2))'
              }}>
                {unlocked.length} / {allAchievements.length}
              </span>
            </div>
            <div className="d-flex gap-2 px-1 overflow-hidden">
              {allAchievements.slice(0, 5).map(achievement => {
                const isUnlocked = unlocked.some(u => u.achievementId === achievement.id);
                return (
                  <div 
                    key={achievement.id}
                    className={`rounded-circle d-flex align-items-center justify-content-center ${!isUnlocked ? 'opacity-20 grayscale' : 'shadow-sm'}`}
                    style={{ 
                      width: '32px', 
                      height: '32px', 
                      backgroundColor: isUnlocked ? achievement.color : '#333',
                      fontSize: '1rem',
                      flexShrink: 0,
                      border: isUnlocked ? '1px solid rgba(255,255,255,0.2)' : '1px dashed rgba(255,255,255,0.1)'
                    }}
                    title={achievement.name}
                  >
                    {isUnlocked ? achievement.icon : <Trophy size={14} className="text-white opacity-50" />}
                  </div>
                );
              })}
              {allAchievements.length > 5 && (
                <div className="extra-small text-muted d-flex align-items-center ms-1 fw-bold">+{allAchievements.length - 5}</div>
              )}
            </div>
          </div>
        )}

        {/* Navigation Actions */}
        <div className="p-3 flex-grow-1">
          <div className="d-flex flex-column gap-1">
            {isAdmin && (
              <HapticLink 
                href="/admin" 
                className="btn btn-outline-warning w-100 text-start d-flex align-items-center border-0 p-3 rounded-3 opacity-75 hover-opacity-100 text-decoration-none" 
                onClick={handleLinkClick}
              >
                <ShieldAlert size={18} className="me-3" />
                <span className="fw-bold letter-spacing-1 text-uppercase small">Admin Panel</span>
              </HapticLink>
            )}

            <HapticLink 
              href="/history" 
              className="btn btn-outline-light w-100 text-start d-flex align-items-center border-0 p-3 rounded-3 opacity-75 hover-opacity-100 text-decoration-none" 
              onClick={handleLinkClick}
            >
              <History size={18} className="me-3" />
              <span className="fw-bold letter-spacing-1 text-uppercase small">Season History</span>
            </HapticLink>

            <HapticLink 
              href="/settings" 
              className="btn btn-outline-light w-100 text-start d-flex align-items-center border-0 p-3 rounded-3 opacity-75 hover-opacity-100 text-decoration-none" 
              onClick={handleLinkClick}
            >
              <Settings size={18} className="me-3" />
              <span className="fw-bold letter-spacing-1 text-uppercase small">Settings & Info</span>
            </HapticLink>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-top border-secondary border-opacity-25 mt-auto">
          <HapticButton 
            href="https://buymeacoffee.com/p10racing"
            variant="outline-warning" 
            className="w-100 fw-bold py-3 d-flex align-items-center justify-content-center mb-3 rounded-pill border-opacity-50"
            onClick={onHide}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: '0.8rem', letterSpacing: '1px' }}
          >
            <Coffee size={18} className="me-2 opacity-75" />
            BUY ME A COFFEE
          </HapticButton>

          {session ? (
            <HapticButton 
              haptic="medium"
              variant="danger" 
              className="w-100 fw-bold py-3 d-flex align-items-center justify-content-center rounded-pill"
              onClick={() => {
                onLogout();
                onHide();
              }}
              style={{ fontSize: '0.8rem', letterSpacing: '1px' }}
            >
              <LogOut size={18} className="me-2 opacity-75" />
              SIGN OUT
            </HapticButton>
          ) : (
            <HapticLink 
              href="/auth" 
              className="btn btn-primary w-100 fw-bold py-3 d-flex align-items-center justify-content-center rounded-pill text-decoration-none" 
              onClick={handleLinkClick}
              style={{ fontSize: '0.8rem', letterSpacing: '1px' }}
            >
              <LogIn size={18} className="me-2 opacity-75" />
              SIGN IN
            </HapticLink>
          )}
        </div>
      </Offcanvas.Body>
    </Offcanvas>
  );
}
