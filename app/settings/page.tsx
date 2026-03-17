'use client';

import { useState, useEffect } from 'react';
import { Container, Card, Button, Modal, Spinner } from 'react-bootstrap';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { ShieldAlert, Trash2, KeyRound, Bug, FileText, ChevronRight, History } from 'lucide-react';
import Link from 'next/link';
import packageInfo from '../../package.json';
import BugReportModal from '@/components/BugReportModal';
import { useNotification } from '@/components/Notification';
import { useAuth } from '@/components/AuthProvider';
import LoadingView from '@/components/LoadingView';

export default function SettingsPage() {
  const { session, isLoading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showBugReport, setShowBugReport] = useState(false);
  const { showNotification } = useNotification();
  
  const supabase = createClient();

  useEffect(() => {
    async function init() {
      if (session) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', session.user.id)
          .single();
        if (profile) setIsAdmin(!!profile.is_admin);
      }
    }
    init();
  }, [session, supabase]);

  const triggerHaptic = () => {
    Haptics.impact({ style: ImpactStyle.Light });
  };

  const handleDeleteAccount = async () => {
    if (!session) return;
    setIsDeleting(true);
    Haptics.notification({ type: NotificationType.Warning });
    
    try {
      const { error } = await supabase.rpc('delete_user_data');
      if (error) throw error;

      await supabase.auth.signOut();
      localStorage.clear();
      window.location.href = '/';
    } catch (err) {
      console.error('Error deleting account:', err);
      showNotification('Failed to delete account. Please try again.', 'error');
      setIsDeleting(false);
    }
  };

  if (authLoading) {
    return <LoadingView />;
  }

  return (
    <>
      <Container className="mt-4 mb-5 max-w-md mx-auto" style={{ maxWidth: '600px' }}>
        <h1 className="h4 fw-bold text-uppercase letter-spacing-1 mb-4 text-white ps-1">Settings & Info</h1>

        {isAdmin && (
          <Card className="border-secondary border-opacity-25 shadow-sm bg-dark mb-4">
            <Link href="/admin" passHref legacyBehavior>
              <a className="text-decoration-none" onClick={triggerHaptic}>
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

        <h2 className="small fw-bold text-uppercase text-muted letter-spacing-1 mb-2 ps-1">Account</h2>
        <Card className="border-secondary shadow-sm mb-4">
          <div className="list-group list-group-flush bg-dark rounded">
            {session ? (
              <>
                <Link href="/auth/reset-password" passHref legacyBehavior>
                  <a className="list-group-item list-group-item-action bg-dark text-white border-secondary p-3 d-flex align-items-center justify-content-between" onClick={triggerHaptic}>
                    <div className="d-flex align-items-center">
                      <KeyRound size={18} className="me-3 opacity-75" />
                      <span className="fw-bold">Change Password</span>
                    </div>
                    <ChevronRight size={18} className="opacity-50" />
                  </a>
                </Link>
                <button 
                  className="list-group-item list-group-item-action bg-dark text-danger border-secondary p-3 d-flex align-items-center justify-content-between border-0"
                  onClick={() => { triggerHaptic(); setShowDeleteModal(true); }}
                >
                  <div className="d-flex align-items-center">
                    <Trash2 size={18} className="me-3 opacity-75" />
                    <span className="fw-bold">Delete Account Data</span>
                  </div>
                </button>
              </>
            ) : (
              <div className="p-3 text-center text-muted small">
                Settings are limited while playing as a Guest. <Link href="/auth" className="text-danger fw-bold text-decoration-none">Sign in</Link> to unlock all features.
              </div>
            )}
          </div>
        </Card>

        <h2 className="small fw-bold text-uppercase text-muted letter-spacing-1 mb-2 ps-1">Season</h2>
        <Card className="border-secondary shadow-sm mb-4">
          <div className="list-group list-group-flush bg-dark rounded">
            <Link href="/history" passHref legacyBehavior>
              <a className="list-group-item list-group-item-action bg-dark text-white border-secondary p-3 d-flex align-items-center justify-content-between border-0" onClick={triggerHaptic}>
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
            <button 
              className="list-group-item list-group-item-action bg-dark text-white border-secondary p-3 d-flex align-items-center justify-content-between"
              onClick={() => { triggerHaptic(); setShowBugReport(true); }}
            >
              <div className="d-flex align-items-center">
                <Bug size={18} className="me-3 opacity-75" />
                <span className="fw-bold">Report an Issue</span>
              </div>
              <ChevronRight size={18} className="opacity-50" />
            </button>
            <Link href="/privacy" passHref legacyBehavior>
              <a className="list-group-item list-group-item-action bg-dark text-white border-secondary p-3 d-flex align-items-center justify-content-between border-0" onClick={triggerHaptic}>
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
            Data provided by <a href="https://api.jolpi.ca" target="_blank" rel="noopener noreferrer" className="text-white text-decoration-underline">Jolpica F1 API</a>
          </p>
        </div>
      </Container>

      {/* Reused Modals */}
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
          <Button variant="outline-light" onClick={() => setShowDeleteModal(false)} disabled={isDeleting} className="rounded-pill px-4">
            CANCEL
          </Button>
          <Button variant="danger" onClick={handleDeleteAccount} disabled={isDeleting} className="rounded-pill px-4 fw-bold">
            {isDeleting ? <Spinner animation="border" size="sm" className="me-2" /> : 'DELETE PERMANENTLY'}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
