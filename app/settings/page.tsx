'use client';

import { useState, useEffect, useRef } from 'react';
import { Container, Card, Modal, Spinner, Form, Badge } from 'react-bootstrap';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { triggerLightHaptic, triggerWarningHaptic } from '@/lib/utils/haptics';
import { ShieldAlert, Trash2, KeyRound, Bug, FileText, ChevronRight, History, Vibrate, Coffee } from 'lucide-react';
import Link from 'next/link';
import packageInfo from '../../package.json';
import BugReportModal from '@/components/BugReportModal';
import { useNotification } from '@/components/Notification';
import { withTimeout } from '@/lib/utils/sync-queue';
import { useAuth } from '@/components/AuthProvider';
import HapticButton from '@/components/HapticButton';
import { STORAGE_KEYS, setStorageItem } from '@/lib/utils/storage';

export default function SettingsPage() {
  const supabase = createClient();
  const { showNotification } = useNotification();
  const mountedRef = useRef(true);
  const { session, isAdmin } = useAuth();

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showBugReport, setShowBugReport] = useState(false);
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const [shakeToReportEnabled, setShakeToReportEnabled] = useState(true);

  // Lifecycle
  useEffect(() => {
    mountedRef.current = true;
    
    // Load preferences
    setHapticsEnabled(localStorage.getItem(STORAGE_KEYS.HAPTICS_ENABLED) !== 'false');
    setShakeToReportEnabled(localStorage.getItem(STORAGE_KEYS.SHAKE_TO_REPORT_ENABLED) !== 'false');

    return () => { mountedRef.current = false; };
  }, []);

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
      <Container className="mt-4 mb-5 max-w-md mx-auto" style={{ maxWidth: '600px' }}>
        <h1 className="h4 fw-bold text-uppercase letter-spacing-1 mb-4 text-white ps-1">Settings & Info</h1>

        {isAdmin && (
          <Card className="border-secondary border-opacity-25 shadow-sm bg-dark mb-4">
            <Link href="/admin" passHref legacyBehavior>
              <a className="text-decoration-none" onClick={triggerLightHaptic}>
                <Card.Body className="p-3 d-flex align-items-center justify-content-between cursor-pointer">
                  <div className="d-flex align-items-center">
                    <ShieldAlert size={20} className="text-warning opacity-75 me-3" />
                    <div>
                      <h3 className="h6 mb-0 fw-bold text-white text-uppercase letter-spacing-1">System Admin</h3>
                      <p className="extra-small text-muted mb-0">Race Results & Verification</p>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-white opacity-25" />
                </Card.Body>
              </a>
            </Link>
          </Card>
        )}

        <h2 className="small fw-bold text-uppercase text-muted letter-spacing-1 mb-2 ps-1">Preferences</h2>
        <Card className="border-secondary shadow-sm mb-4">
          <div className="list-group list-group-flush bg-dark rounded">
            <div className="list-group-item bg-dark text-white border-secondary p-3 d-flex align-items-center justify-content-between">
              <div className="d-flex align-items-center">
                <Vibrate size={18} className="me-3 opacity-75" />
                <div>
                  <span className="fw-bold d-block">Haptic Feedback</span>
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

            <div className="list-group-item bg-dark text-white border-secondary p-3 d-flex align-items-center justify-content-between">
              <div className="d-flex align-items-center">
                <Bug size={18} className="me-3 opacity-75" />
                <div>
                  <span className="fw-bold d-block">Shake to Report</span>
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
            <h2 className="small fw-bold text-uppercase text-muted letter-spacing-1 mb-2 ps-1">Account</h2>
            <Card className="border-secondary shadow-sm mb-4">
              <div className="list-group list-group-flush bg-dark rounded">
                <Link href="/auth/reset-password" passHref legacyBehavior>
                  <a className="list-group-item list-group-item-action bg-dark text-white border-secondary p-3 d-flex align-items-center justify-content-between" onClick={triggerLightHaptic}>
                    <div className="d-flex align-items-center">
                      <KeyRound size={18} className="me-3 opacity-75" />
                      <span className="fw-bold">Change Password</span>
                    </div>
                    <ChevronRight size={18} className="opacity-50" />
                  </a>
                </Link>
                <button 
                  className="list-group-item list-group-item-action bg-dark text-danger border-secondary p-3 d-flex align-items-center justify-content-between border-0"
                  onClick={() => { triggerLightHaptic(); setShowDeleteModal(true); }}
                >
                  <div className="d-flex align-items-center">
                    <Trash2 size={18} className="me-3 opacity-75" />
                    <span className="fw-bold">Delete Account Data</span>
                  </div>
                </button>
              </div>
            </Card>
          </>
        )}

        <h2 className="small fw-bold text-uppercase text-muted letter-spacing-1 mb-2 ps-1">Season</h2>
        <Card className="border-secondary shadow-sm mb-4">
          <div className="list-group list-group-flush bg-dark rounded">
            <Link href="/history" passHref legacyBehavior>
              <a className="list-group-item list-group-item-action bg-dark text-white border-secondary p-3 d-flex align-items-center justify-content-between border-0" onClick={triggerLightHaptic}>
                <div className="d-flex align-items-center">
                  <History size={18} className="me-3 opacity-75" />
                  <span className="fw-bold">Season History</span>
                </div>
                <ChevronRight size={18} className="opacity-50" />
              </a>
            </Link>
          </div>
        </Card>

        <h2 className="small fw-bold text-uppercase text-muted letter-spacing-1 mb-2 ps-1">Support & Legal</h2>
        <Card className="border-secondary shadow-sm mb-4">
          <div className="list-group list-group-flush bg-dark rounded">
            <a href="https://buymeacoffee.com/f1alex" className="list-group-item list-group-item-action bg-dark text-white border-secondary p-3 d-flex align-items-center justify-content-between" target="_blank" rel="noopener noreferrer" onClick={triggerLightHaptic}>
              <div className="d-flex align-items-center">
                <Coffee size={18} className="me-3 text-warning" />
                <span className="fw-bold">Buy me a coffee</span>
              </div>
              <Badge bg="danger" className="rounded-pill px-2 py-1" style={{ fontSize: '0.6rem' }}>TIP</Badge>
            </a>
            <button 
              className="list-group-item list-group-item-action bg-dark text-white border-secondary p-3 d-flex align-items-center justify-content-between"
              onClick={() => { triggerLightHaptic(); setShowBugReport(true); }}
            >
              <div className="d-flex align-items-center">
                <Bug size={18} className="me-3 opacity-75" />
                <span className="fw-bold">Report an Issue</span>
              </div>
              <ChevronRight size={18} className="opacity-50" />
            </button>
            <Link href="/privacy" passHref legacyBehavior>
              <a className="list-group-item list-group-item-action bg-dark text-white border-secondary p-3 d-flex align-items-center justify-content-between border-0" onClick={triggerLightHaptic}>
                <div className="d-flex align-items-center">
                  <FileText size={18} className="me-3 opacity-75" />
                  <span className="fw-bold">Privacy Policy</span>
                </div>
                <ChevronRight size={18} className="opacity-50" />
              </a>
            </Link>
          </div>
        </Card>

        <div className="text-center mt-5 mb-4">
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
