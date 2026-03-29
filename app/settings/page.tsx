'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Card, Modal, Spinner, Form, Badge, Container, Row, Col } from 'react-bootstrap';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { triggerLightHaptic, triggerWarningHaptic, triggerSuccessHaptic } from '@/lib/utils/haptics';
import { ShieldAlert, Trash2, KeyRound, Bug, FileText, ChevronRight, History, Vibrate, Coffee, Settings, Heart, Palette } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import packageInfo from '../../package.json';
import BugReportModal from '@/components/BugReportModal';
import { useNotification } from '@/components/Notification';
import { withTimeout } from '@/lib/utils/sync-queue';
import { useAuth } from '@/components/AuthProvider';
import HapticButton from '@/components/HapticButton';
import HapticLink from '@/components/HapticLink';
import { STORAGE_KEYS, setStorageItem } from '@/lib/utils/storage';
import StandardPageHeader from '@/components/StandardPageHeader';
import { useF1Data } from '@/lib/hooks/use-f1-data';
import { Profile, TEAM_COLORS } from '@/lib/types';

const PersonalizationSkeleton = () => (
  <div className="animate-pulse">
    <Row className="g-3">
      {[1, 2].map((i) => (
        <Col xs={12} key={i}>
          <div className="bg-secondary bg-opacity-10 rounded-pill mb-1" style={{ width: '80px', height: '12px' }} />
          <div className="bg-secondary bg-opacity-20 rounded-pill" style={{ width: '100%', height: '31px' }} />
        </Col>
      ))}
    </Row>
  </div>
);

export default function SettingsPage() {
  const supabase = createClient();
  const { showNotification } = useNotification();
  const mountedRef = useRef(true);
  const { session, isAdmin, profile, setProfile } = useAuth();
  const { drivers } = useF1Data();

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showBugReport, setShowBugReport] = useState(false);
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const [shakeToReportEnabled, setShakeToReportEnabled] = useState(true);
  const [useTeamTheme, setUseTeamTheme] = useState(true);

  // Profile State
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  // Derived Data
  const teams = useMemo(() => {
    const uniqueTeams = new Map();
    drivers.forEach(d => {
      if (!uniqueTeams.has(d.teamId)) {
        uniqueTeams.set(d.teamId, { id: d.teamId, name: d.team, color: d.color });
      }
    });
    return Array.from(uniqueTeams.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [drivers]);

  const sortedDrivers = useMemo(() => {
    return [...drivers].sort((a, b) => a.name.localeCompare(b.name));
  }, [drivers]);

  const loadProfile = useCallback(async (userId: string) => {
    setLoadingProfile(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) throw error;
      if (mountedRef.current) setProfile(data);
    } catch (err) {
      console.error('Error loading profile:', err);
    } finally {
      if (mountedRef.current) setLoadingProfile(false);
    }
  }, [supabase]);

  // Lifecycle
  useEffect(() => {
    mountedRef.current = true;
    
    // Load preferences
    setHapticsEnabled(localStorage.getItem(STORAGE_KEYS.HAPTICS_ENABLED) !== 'false');
    setShakeToReportEnabled(localStorage.getItem(STORAGE_KEYS.SHAKE_TO_REPORT_ENABLED) !== 'false');
    setUseTeamTheme(localStorage.getItem(STORAGE_KEYS.USE_TEAM_THEME) !== 'false');

    // Load Profile
    if (session?.user?.id) {
      loadProfile(session.user.id);
    }

    return () => { mountedRef.current = false; };
  }, [session, loadProfile]);

  const handleUpdateProfile = async (updates: Partial<Profile>) => {
    if (!profile || !session?.user?.id) return;
    
    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', session.user.id);

      if (error) throw error;
      
      setProfile(prev => prev ? { ...prev, ...updates } : null);
      triggerSuccessHaptic();
      showNotification('Profile updated successfully!', 'success');
    } catch (err) {
      console.error('Error updating profile:', err);
      showNotification('Failed to update profile.', 'error');
      triggerWarningHaptic();
    } finally {
      if (mountedRef.current) setSavingProfile(false);
    }
  };

  const togglePreference = (key: keyof typeof STORAGE_KEYS, setter: (val: boolean) => void, enabled: boolean) => {
    setter(enabled);
    setStorageItem(STORAGE_KEYS[key], enabled.toString());
    triggerLightHaptic();
  };

  const handleDeleteAccount = async () => {
    if (!session) return;
    setIsDeleting(true);
    triggerWarningHaptic();
    
    try {
      const { error } = await withTimeout(supabase.rpc('delete_user_data'));
      if (error) throw error;

      await supabase.auth.signOut();
      localStorage.clear();
      window.location.href = '/';
    } catch (err) {
      console.error('Error deleting account:', err);
      showNotification('Failed to delete account. Please try again.', 'error');
      if (mountedRef.current) setIsDeleting(false);
    }
  };

  return (
    <>
      <Container className="mt-4 mb-4 max-w-md mx-auto" style={{ maxWidth: '600px' }}>
        <StandardPageHeader
          title="Settings"
          subtitle="Preferences & Info"
          icon={<Settings size={24} />}
        />

        <div className="mt-3">
          {session && (
            <>
              <h2 className="small fw-bold text-uppercase text-muted letter-spacing-2 mb-2 ps-1" style={{ fontSize: '0.6rem' }}>Personalization</h2>
              <Card className="f1-glass-card mb-4 border-secondary border-opacity-50 overflow-hidden">
                <Card.Body className="p-3" style={{ minHeight: '120px' }}>
                  <AnimatePresence mode="wait">
                    {loadingProfile ? (
                      <motion.div
                        key="skeleton"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        <PersonalizationSkeleton />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="content"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3 }}
                      >
                        <Form>
                          <Row className="g-3">
                            <Col xs={12}>
                              <Form.Group controlId="favorite-team-select">
                                <Form.Label className="extra-small text-muted text-uppercase fw-bold letter-spacing-1 mb-1">
                                  Favorite Team
                                </Form.Label>
                                <div className="d-flex gap-2 align-items-center">
                                  <div 
                                    className="rounded-circle" 
                                    style={{ 
                                      width: '12px', 
                                      height: '12px', 
                                      backgroundColor: profile?.favorite_team ? (TEAM_COLORS[profile.favorite_team] || '#333') : '#333',
                                      flexShrink: 0
                                    }} 
                                  />
                                  <Form.Select 
                                    size="sm"
                                    className="bg-dark text-white border-secondary border-opacity-50 rounded-pill px-3"
                                    value={profile?.favorite_team || ''}
                                    onChange={(e) => handleUpdateProfile({ favorite_team: e.target.value })}
                                    disabled={savingProfile}
                                  >
                                    <option value="">Select a team...</option>
                                    {teams.map(t => (
                                      <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                  </Form.Select>
                                </div>
                              </Form.Group>
                            </Col>
                            <Col xs={12}>
                              <Form.Group controlId="favorite-driver-select">
                                <Form.Label className="extra-small text-muted text-uppercase fw-bold letter-spacing-1 mb-1">
                                  Favorite Driver
                                </Form.Label>
                                <div className="d-flex gap-2 align-items-center">
                                  <Heart size={12} className={profile?.favorite_driver ? "text-danger" : "text-muted"} />
                                  <Form.Select 
                                    size="sm"
                                    className="bg-dark text-white border-secondary border-opacity-50 rounded-pill px-3"
                                    value={profile?.favorite_driver || ''}
                                    onChange={(e) => handleUpdateProfile({ favorite_driver: e.target.value })}
                                    disabled={savingProfile}
                                  >
                                    <option value="">Select a driver...</option>
                                    {sortedDrivers.map(d => (
                                      <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                                    ))}
                                  </Form.Select>
                                </div>
                              </Form.Group>
                            </Col>
                          </Row>
                          
                          {savingProfile && (
                            <div className="position-absolute top-0 start-0 w-100 h-100 bg-black bg-opacity-25 d-flex align-items-center justify-content-center" style={{ zIndex: 10 }}>
                              <Spinner animation="border" size="sm" variant="danger" />
                            </div>
                          )}
                        </Form>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card.Body>
                <div className="bg-black bg-opacity-25 p-2 text-center border-top border-secondary border-opacity-25">
                   <p className="extra-small text-muted mb-0">These selections will be used for profile theming in future updates.</p>
                </div>
              </Card>
            </>
          )}

          {isAdmin && (
            <Card className="f1-accent-card mb-4 border-warning border-opacity-50 overflow-hidden">
              <HapticLink href="/admin" className="text-decoration-none">
                <Card.Body className="p-3 d-flex align-items-center justify-content-between cursor-pointer">
                  <div className="d-flex align-items-center">
                    <div className="bg-warning bg-opacity-10 p-2 rounded-circle me-3">
                      <ShieldAlert size={20} className="text-warning" />
                    </div>
                    <div>
                      <h3 className="h6 mb-0 fw-bold text-white text-uppercase letter-spacing-1">System Admin</h3>
                      <p className="extra-small text-muted mb-0">Race Results & Verification</p>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-white opacity-25" />
                </Card.Body>
              </HapticLink>
            </Card>
          )}

          <h2 className="small fw-bold text-uppercase text-muted letter-spacing-2 mb-2 ps-1" style={{ fontSize: '0.6rem' }}>Preferences</h2>
          <Card className="f1-glass-card mb-4 border-secondary border-opacity-50">
            <div className="list-group list-group-flush bg-transparent">
              <div className="list-group-item bg-transparent text-white border-secondary border-opacity-25 p-3 d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center">
                  <Palette size={18} className="me-3 opacity-75" />
                  <div>
                    <span className="fw-bold d-block small">Team Theme</span>
                    <small className="text-muted extra-small">Use team colors for UI accents</small>
                  </div>
                </div>
                <Form.Check 
                  type="switch"
                  id="theme-switch"
                  label={<span className="visually-hidden">Team Theme</span>}
                  checked={useTeamTheme}
                  onChange={(e) => togglePreference('USE_TEAM_THEME', setUseTeamTheme, e.target.checked)}
                  className="custom-switch-lg"
                />
              </div>

              <div className="list-group-item bg-transparent text-white border-secondary border-opacity-25 p-3 d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center">
                  <Vibrate size={18} className="me-3 opacity-75" />
                  <div>
                    <span className="fw-bold d-block small">Haptic Feedback</span>
                    <small className="text-muted extra-small">Tactile response on taps & actions</small>
                  </div>
                </div>
                <Form.Check 
                  type="switch"
                  id="haptics-switch"
                  label={<span className="visually-hidden">Haptic Feedback</span>}
                  checked={hapticsEnabled}
                  onChange={(e) => togglePreference('HAPTICS_ENABLED', setHapticsEnabled, e.target.checked)}
                  className="custom-switch-lg"
                />
              </div>

              <div className="list-group-item bg-transparent text-white border-0 p-3 d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center">
                  <Bug size={18} className="me-3 opacity-75" />
                  <div>
                    <span className="fw-bold d-block small">Shake to Report</span>
                    <small className="text-muted extra-small">Shake device to trigger bug report</small>
                  </div>
                </div>
                <Form.Check 
                  type="switch"
                  id="shake-switch"
                  label={<span className="visually-hidden">Shake to Report</span>}
                  checked={shakeToReportEnabled}
                  onChange={(e) => togglePreference('SHAKE_TO_REPORT_ENABLED', setShakeToReportEnabled, e.target.checked)}
                  className="custom-switch-lg"
                />
              </div>
            </div>
          </Card>

          {session && (
            <>
              <h2 className="small fw-bold text-uppercase text-muted letter-spacing-2 mb-2 ps-1" style={{ fontSize: '0.6rem' }}>Account</h2>
              <Card className="f1-glass-card mb-4 border-secondary border-opacity-50">
                <div className="list-group list-group-flush bg-transparent">
                  <HapticLink href="/auth/reset-password" className="list-group-item list-group-item-action bg-transparent text-white border-secondary border-opacity-25 p-3 d-flex align-items-center justify-content-between">
                    <div className="d-flex align-items-center">
                      <KeyRound size={18} className="me-3 opacity-75" />
                      <span className="fw-bold small">Change Password</span>
                    </div>
                    <ChevronRight size={18} className="opacity-50" />
                  </HapticLink>
                  <HapticButton 
                    variant="link"
                    className="list-group-item list-group-item-action bg-transparent text-danger border-0 p-3 d-flex align-items-center justify-content-between"
                    onClick={() => setShowDeleteModal(true)}
                  >
                    <div className="d-flex align-items-center">
                      <Trash2 size={18} className="me-3 opacity-75" />
                      <span className="fw-bold small">Delete Account Data</span>
                    </div>
                  </HapticButton>
                </div>
              </Card>
            </>
          )}

          <h2 className="small fw-bold text-uppercase text-muted letter-spacing-2 mb-2 ps-1" style={{ fontSize: '0.6rem' }}>Season</h2>
          <Card className="f1-glass-card mb-4 border-secondary border-opacity-50">
            <div className="list-group list-group-flush bg-transparent">
              <HapticLink href="/history" className="list-group-item list-group-item-action bg-transparent text-white border-0 p-3 d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center">
                  <History size={18} className="me-3 opacity-75" />
                  <span className="fw-bold small">Season History</span>
                </div>
                <ChevronRight size={18} className="opacity-50" />
              </HapticLink>
            </div>
          </Card>

          <h2 className="small fw-bold text-uppercase text-muted letter-spacing-2 mb-2 ps-1" style={{ fontSize: '0.6rem' }}>Support & Legal</h2>
          <Card className="f1-glass-card mb-4 border-secondary border-opacity-50">
            <div className="list-group list-group-flush bg-transparent">
              <HapticButton 
                variant="link"
                href="https://buymeacoffee.com/p10racing" 
                className="list-group-item list-group-item-action bg-transparent text-white border-secondary border-opacity-25 p-3 d-flex align-items-center justify-content-between text-decoration-none" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <div className="d-flex align-items-center">
                  <Coffee size={18} className="me-3 text-warning opacity-75" />
                  <span className="fw-bold small">Buy me a coffee</span>
                </div>
                <Badge bg="danger" className="rounded-pill px-2 py-1" style={{ fontSize: '0.6rem' }}>TIP</Badge>
              </HapticButton>
              <HapticButton 
                variant="link"
                className="list-group-item list-group-item-action bg-transparent text-white border-secondary border-opacity-25 p-3 d-flex align-items-center justify-content-between text-decoration-none"
                onClick={() => setShowBugReport(true)}
              >
                <div className="d-flex align-items-center">
                  <Bug size={18} className="me-3 opacity-75" />
                  <span className="fw-bold small">Report an Issue</span>
                </div>
                <ChevronRight size={18} className="opacity-50" />
              </HapticButton>
              <HapticLink href="/privacy" className="list-group-item list-group-item-action bg-transparent text-white border-0 p-3 d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center">
                  <FileText size={18} className="me-3 opacity-75" />
                  <span className="fw-bold small">Privacy Policy</span>
                </div>
                <ChevronRight size={18} className="opacity-50" />
              </HapticLink>
            </div>
          </Card>


          <div className="text-center mt-4 mb-2">
            <Image src="/logo.svg" alt="P10 Logo" width={40} height={40} className="mb-2 opacity-50" />
            <p className="text-white opacity-25 small fw-bold letter-spacing-1 mb-1">
              P10 RACING
            </p>
            <p className="text-white opacity-25 extra-small mb-1">
              Version {packageInfo.version}
            </p>
            <p className="text-white opacity-10 extra-small">
              Data provided by <a href="https://jolpica.github.io/jolpica-f1/" target="_blank" rel="noopener noreferrer" className="text-white text-decoration-underline" onClick={triggerLightHaptic}>Jolpica F1 API</a>
            </p>
          </div>
        </div>
      </Container>

      <BugReportModal show={showBugReport} onHide={() => setShowBugReport(false)} />
      
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} centered contentClassName="bg-dark border-secondary">
        <Modal.Header closeButton closeVariant="white" className="border-secondary">
          <Modal.Title className="text-white text-uppercase letter-spacing-1 fs-5 fw-bold">Delete Account?</Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-white opacity-75 py-4">
          Are you sure you want to delete your account?
          <div className="mt-3 p-3 bg-danger bg-opacity-10 border border-danger border-opacity-25 rounded small text-danger">
            <strong>This action is permanent:</strong> All your predictions, league memberships, and scores will be removed forever.
          </div>
        </Modal.Body>
        <Modal.Footer className="border-secondary">
          <HapticButton variant="outline-light" onClick={() => { setShowDeleteModal(false); }} disabled={isDeleting} className="rounded-pill px-4">
            CANCEL
          </HapticButton>
          <HapticButton variant="danger" onClick={handleDeleteAccount} disabled={isDeleting} className="rounded-pill px-4 fw-bold">
            {isDeleting ? <Spinner animation="border" size="sm" className="me-2" /> : 'DELETE PERMANENTLY'}
          </HapticButton>
        </Modal.Footer>
      </Modal>
    </>
  );
}
