'use client';

import React, { useState, useRef } from 'react';
import { Modal, Form, Alert, Spinner } from 'react-bootstrap';
import { createClient } from '@/lib/supabase/client';
import { triggerMediumHaptic, triggerSuccessHaptic, triggerErrorHaptic } from '@/lib/utils/haptics';
import { Capacitor } from '@capacitor/core';
import packageInfo from '../package.json';
import HapticButton from './HapticButton';

interface BugReportModalProps {
  show: boolean;
  onHide: () => void;
}

export default function BugReportModal({ show, onHide }: BugReportModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    triggerMediumHaptic();

    try {
      const { data: { session } } = await supabase.auth.getSession();
      let imageUrl = '';

      // 1. Upload image if exists
      if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `bugs/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('bug-screenshots')
          .upload(filePath, file);

        if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

        const { data: { publicUrl } } = supabase.storage
          .from('bug-screenshots')
          .getPublicUrl(filePath);
        
        imageUrl = publicUrl;
      }

      // 2. Gather device info
      const deviceInfo = {
        userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'unknown',
        platform: Capacitor.getPlatform(),
        version: packageInfo.version,
        url: typeof window !== 'undefined' ? window.location.href : 'unknown',
        screen: typeof window !== 'undefined' ? `${window.screen.width}x${window.screen.height}` : 'unknown'
      };

      // 3. Insert bug report
      const { error: insertError } = await supabase
        .from('bug_reports')
        .insert([{
          user_id: session?.user?.id || null,
          title,
          description,
          device_info: deviceInfo,
          image_url: imageUrl
        }]);

      if (insertError) throw insertError;

      setSuccess(true);
      triggerSuccessHaptic();
      
      // Reset form after 2 seconds and close
      setTimeout(() => {
        setTitle('');
        setDescription('');
        setFile(null);
        setSuccess(false);
        onHide();
      }, 2000);

    } catch (err: unknown) {
      console.error('Bug report error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to submit bug report';
      setError(errorMessage);
      triggerErrorHaptic();
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered className="bug-report-modal">
      <Modal.Header closeButton className="bg-dark border-secondary text-white">
        <Modal.Title className="h5 fw-bold text-uppercase letter-spacing-1">Report a Bug 🏎️</Modal.Title>
      </Modal.Header>
      <Modal.Body className="bg-dark text-white p-4">
        {success ? (
          <Alert variant="success" className="text-center py-4 border-success bg-success bg-opacity-10">
            <div className="fs-1 mb-2">🏁</div>
            <h4 className="fw-bold">Report Received!</h4>
            <p className="mb-0">Thanks for helping us polish the game.</p>
          </Alert>
        ) : (
          <Form onSubmit={handleSubmit}>
            {error && <Alert variant="danger" className="py-2 small">{error}</Alert>}
            
            <Form.Group className="mb-3">
              <Form.Label className="small text-muted text-uppercase fw-bold">What happened?</Form.Label>
              <Form.Control 
                type="text" 
                placeholder="Short summary (e.g. Points not updating)" 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="bg-dark text-white border-secondary"
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label className="small text-muted text-uppercase fw-bold">Details</Form.Label>
              <Form.Control 
                as="textarea" 
                rows={3} 
                placeholder="What were you doing? What went wrong?" 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                className="bg-dark text-white border-secondary"
              />
            </Form.Group>

            <Form.Group className="mb-4">
              <Form.Label className="small text-muted text-uppercase fw-bold">Screenshot (Optional)</Form.Label>
              <Form.Control 
                type="file" 
                accept="image/*"
                onChange={handleFileChange}
                className="bg-dark text-white border-secondary"
                ref={fileInputRef}
              />
              <Form.Text className="text-muted extra-small">
                Max 5MB. Visuals help us fix things faster!
              </Form.Text>
            </Form.Group>

            <div className="d-grid">
              <HapticButton variant="danger" type="submit" disabled={loading} className="fw-bold py-2">
                {loading ? <Spinner animation="border" size="sm" /> : 'SUBMIT REPORT'}
              </HapticButton>
            </div>
          </Form>
        )}
      </Modal.Body>
    </Modal>
  );
}
