'use client';

import React, { useState, useRef } from 'react';
import { Modal, Form, Alert, Spinner, Row, Col } from 'react-bootstrap';
import { createClient } from '@/lib/supabase/client';
import { triggerMediumHaptic, triggerSuccessHaptic, triggerErrorHaptic } from '@/lib/utils/haptics';
import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';
import { Network } from '@capacitor/network';
import { STORAGE_KEYS } from '@/lib/utils/storage';
import packageInfo from '../package.json';
import HapticButton from './HapticButton';

interface BugReportModalProps {
  show: boolean;
  onHide: () => void;
}

type Severity = 'Minor' | 'Major' | 'Blocker';

export default function BugReportModal({ show, onHide }: BugReportModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState('');
  const [severity, setSeverity] = useState<Severity>('Minor');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supabase = createClient();

  const getStorageSummary = () => {
    if (typeof window === 'undefined') return {};
    try {
      const keys = Object.keys(localStorage);
      const summary: Record<string, string | number | boolean | string[]> = {
        total_keys: keys.length,
        all_keys: keys,
        has_session: !!localStorage.getItem(STORAGE_KEYS.HAS_SESSION),
        has_predictions: keys.some(k => k.startsWith('final_pred_')),
        has_drivers: !!localStorage.getItem(STORAGE_KEYS.CACHE_DRIVERS),
        has_grid: keys.some(k => k.startsWith('p10_cache_grid_')),
      };
      return summary;
    } catch {
      return { error: -1 };
    }
  };

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

      // 2. Gather rich diagnostic data
      const info = await Device.getInfo();
      const battery = await Device.getBatteryInfo();
      const network = await Network.getStatus();

      const deviceInfo = {
        app_version: packageInfo.version,
        platform: Capacitor.getPlatform(),
        os_version: info.osVersion,
        manufacturer: info.manufacturer,
        model: info.model,
        is_virtual: info.isVirtual,
        mem_used: info.memUsed,
        battery_level: battery.batteryLevel,
        is_charging: battery.isCharging,
        network_status: network.connected ? 'online' : 'offline',
        connection_type: network.connectionType,
        url: typeof window !== 'undefined' ? window.location.href : 'unknown',
        source_url: typeof window !== 'undefined' ? window.__P10_LAST_URL__ || window.location.href : 'unknown',
        screen: typeof window !== 'undefined' ? `${window.screen.width}x${window.screen.height}` : 'unknown',
        user_agent: typeof window !== 'undefined' ? window.navigator.userAgent : 'unknown',
        storage_summary: getStorageSummary(),
        recent_errors: typeof window !== 'undefined' ? window.__P10_ERROR_LOGS__ || [] : []
      };

      // 3. Insert bug report
      const { error: insertError } = await supabase
        .from('bug_reports')
        .insert([{
          user_id: session?.user?.id || null,
          title,
          description: `### Summary\n${description}\n\n### Steps to Reproduce\n${steps}`,
          severity,
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
        setSteps('');
        setSeverity('Minor');
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
    <Modal show={show} onHide={onHide} centered className="bug-report-modal" size="lg">
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
            
            <Row>
              <Col md={8}>
                <Form.Group className="mb-3">
                  <Form.Label className="small text-muted text-uppercase fw-bold">Summary</Form.Label>
                  <Form.Control 
                    type="text" 
                    placeholder="e.g. Points not updating on leaderboard" 
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    className="bg-dark text-white border-secondary"
                  />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label className="small text-muted text-uppercase fw-bold">Severity</Form.Label>
                  <Form.Select 
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as Severity)}
                    className="bg-dark text-white border-secondary"
                  >
                    <option value="Minor">Minor (Polish)</option>
                    <option value="Major">Major (Broken Feature)</option>
                    <option value="Blocker">Blocker (Crashes/Unusable)</option>
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label className="small text-muted text-uppercase fw-bold">What&apos;s wrong?</Form.Label>
              <Form.Control 
                as="textarea" 
                rows={2} 
                placeholder="Describe the issue in detail..." 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                className="bg-dark text-white border-secondary"
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label className="small text-muted text-uppercase fw-bold">Steps to Reproduce</Form.Label>
              <Form.Control 
                as="textarea" 
                rows={2} 
                placeholder="1. Open leaderboard\n2. Refresh...\n3. Observer error..." 
                value={steps}
                onChange={(e) => setSteps(e.target.value)}
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
                {loading ? <Spinner animation="border" size="sm" /> : 'SUBMIT BUG REPORT'}
              </HapticButton>
            </div>
            <p className="text-center text-muted extra-small mt-3 mb-0">
              System diagnostics will be automatically attached to this report.
            </p>
          </Form>
        )}
      </Modal.Body>
    </Modal>
  );
}
