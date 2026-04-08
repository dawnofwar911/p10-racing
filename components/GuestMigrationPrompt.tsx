'use client';

import React, { useState, useEffect } from 'react';
import { Modal, Alert, Spinner } from 'react-bootstrap';
import { useAuth } from './AuthProvider';
import { useGuestMigration } from '@/lib/hooks/use-guest-migration';
import HapticButton from './HapticButton';
import { RefreshCw, UserCheck } from 'lucide-react';
import { STORAGE_KEYS } from '@/lib/utils/storage';

export default function GuestMigrationPrompt() {
  const { session } = useAuth();
  const { localGuests, isImporting, error, success, importGuestData } = useGuestMigration();
  const [show, setShow] = useState(false);
  const [internalDismissed, setInternalDismissed] = useState(false);

  useEffect(() => {
    // Show modal if logged in, has local guests, not yet dismissed in this session
    const isSessionDismissed = sessionStorage.getItem(STORAGE_KEYS.CACHE_MIGRATION_PROMPT_DISMISSED) === 'true';
    if (session && localGuests.length > 0 && !isSessionDismissed && !internalDismissed) {
      setShow(true);
    }
  }, [session, localGuests, internalDismissed]);

  const handleClose = () => {
    setShow(false);
    setInternalDismissed(true);
    sessionStorage.setItem(STORAGE_KEYS.CACHE_MIGRATION_PROMPT_DISMISSED, 'true');
  };

  if (!show && !isImporting) return null;

  return (
    <Modal 
      show={show || isImporting} 
      onHide={handleClose} 
      centered 
      backdrop={isImporting ? 'static' : true}
      contentClassName="f1-glass-card border-warning border-opacity-50"
    >
      <Modal.Header closeButton={!isImporting} closeVariant="white" className="border-secondary border-opacity-25 py-3">
        <Modal.Title className="text-warning text-uppercase letter-spacing-1 h6 mb-0 d-flex align-items-center">
          <RefreshCw size={18} className="me-2" />
          Sync Local Data
        </Modal.Title>
      </Modal.Header>
      <Modal.Body className="p-4">
        {success ? (
          <div className="text-center py-3">
            <div className="bg-success bg-opacity-10 p-3 rounded-circle d-inline-flex mb-3">
              <UserCheck size={32} className="text-success" />
            </div>
            <h4 className="h5 fw-bold text-white mb-2">Import Successful!</h4>
            <p className="text-muted small mb-4">{success}</p>
            <HapticButton variant="success" className="w-100 rounded-pill fw-bold" onClick={handleClose}>
              AWESOME
            </HapticButton>
          </div>
        ) : (
          <>
            <p className="text-white opacity-75 small mb-4">
              We found local predictions from guest sessions on this device. Would you like to import them to your account?
            </p>

            {error && <Alert variant="danger" className="py-2 small mb-3">{error}</Alert>}

            <div className="d-flex flex-column gap-2 mb-4">
              {localGuests.map(guest => (
                <div key={guest} className="d-flex align-items-center justify-content-between bg-black bg-opacity-25 p-2 px-3 rounded-3 border border-secondary border-opacity-25">
                  <span className="fw-bold text-white small">{guest}</span>
                  <HapticButton 
                    haptic="medium" 
                    variant="warning" 
                    size="sm" 
                    className="fw-bold py-1 px-3 rounded-pill text-uppercase"
                    style={{ fontSize: '0.7rem' }}
                    onClick={() => importGuestData(guest)} 
                    disabled={isImporting}
                  >
                    {isImporting ? <Spinner animation="border" size="sm" /> : 'Import'}
                  </HapticButton>
                </div>
              ))}
            </div>

            <HapticButton 
              variant="outline-light" 
              className="w-100 rounded-pill small opacity-50 fw-bold border-0" 
              onClick={handleClose}
              disabled={isImporting}
            >
              NOT NOW
            </HapticButton>
          </>
        )}
      </Modal.Body>
    </Modal>
  );
}
