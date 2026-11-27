'use client';

import { useEffect, useState } from 'react';
import { Card, Dropdown, Form, Spinner } from 'react-bootstrap';
import type { SupabaseClient } from '@supabase/supabase-js';
import HapticButton from '@/components/HapticButton';
import { triggerLightHaptic, triggerSuccessHaptic } from '@/lib/utils/haptics';
import { withTimeout } from '@/lib/utils/sync-queue';
import { buildRaceId, saveOverride, sortPlayers, PlayerOption } from '@/lib/admin/prediction-override';

interface Props {
  supabase: SupabaseClient;
  season: number;
  round: string;
  raceName?: string;
  drivers: { id: string; name: string }[];
  onStatus: (s: { message: string; variant: string }) => void;
}

export default function AdminPredictionOverride({ supabase, season, round, raceName, drivers, onStatus }: Props) {
  const [players, setPlayers] = useState<PlayerOption[]>([]);
  const [userId, setUserId] = useState('');
  const [p10, setP10] = useState('');
  const [dnf, setDnf] = useState('');
  const [existing, setExisting] = useState<{ p10: string; dnf: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await withTimeout(supabase.from('profiles').select('id, username'));
      if (alive && data) setPlayers(sortPlayers(data as { id: string; username: string | null }[]));
    })().catch(e => console.error('Admin: load players failed', e));
    return () => { alive = false; };
  }, [supabase]);

  useEffect(() => {
    setShowConfirm(false);
    if (!userId || !round) { setExisting(null); return; }
    let alive = true;
    (async () => {
      const { data } = await withTimeout(supabase
        .from('predictions')
        .select('p10_driver_id, dnf_driver_id')
        .eq('user_id', userId)
        .eq('race_id', buildRaceId(season, round))
        .maybeSingle());
      if (!alive) return;
      if (data) {
        setExisting({ p10: data.p10_driver_id, dnf: data.dnf_driver_id });
        setP10(data.p10_driver_id);
        setDnf(data.dnf_driver_id);
      } else {
        setExisting(null);
        setP10('');
        setDnf('');
      }
    })().catch(e => console.error('Admin: load prediction failed', e));
    return () => { alive = false; };
  }, [supabase, userId, season, round]);

  const driverName = (id: string) => drivers.find(d => d.id === id)?.name || id;
  const playerName = players.find(p => p.id === userId)?.username;

  const handleSave = async () => {
    if (!showConfirm) { setShowConfirm(true); return; }
    setSaving(true);
    const { error } = await saveOverride(supabase, { userId, season, round, p10DriverId: p10, dnfDriverId: dnf });
    setSaving(false);
    setShowConfirm(false);
    if (error) {
      onStatus({ message: `Prediction not saved: ${error}`, variant: 'danger' });
      return;
    }
    triggerSuccessHaptic();
    setExisting({ p10, dnf });
    onStatus({ message: `Saved ${playerName}'s prediction for ${raceName || `R${round}`}`, variant: 'success' });
  };

  const picker = (label: string, value: string, set: (v: string) => void) => (
    <Form.Group className="mb-3">
      <Form.Label className="extra-small text-muted text-uppercase fw-bold letter-spacing-1">{label}</Form.Label>
      <Dropdown onSelect={(k) => { triggerLightHaptic(); set(k || ''); setShowConfirm(false); }} className="w-100">
        <Dropdown.Toggle variant="dark" className="w-100 text-start border-secondary d-flex justify-content-between align-items-center bg-black bg-opacity-50 text-white fw-bold py-2 rounded-3">
          {value ? driverName(value) : 'Select driver'}
        </Dropdown.Toggle>
        <Dropdown.Menu variant="dark" className="w-100 border-secondary shadow-lg f1-glass-card" style={{ maxHeight: '300px', overflowY: 'auto' }}>
          {drivers.map(d => (<Dropdown.Item key={d.id} eventKey={d.id} active={value === d.id}>{d.name}</Dropdown.Item>))}
        </Dropdown.Menu>
      </Dropdown>
    </Form.Group>
  );

  return (
    <Card className="f1-glass-card border-secondary border-opacity-50 mb-4">
      <div className="f1-card-header text-white">Prediction Override</div>
      <Card.Body className="p-4">
        <Form.Group className="mb-3">
          <Form.Label className="extra-small text-muted text-uppercase fw-bold letter-spacing-1">Player</Form.Label>
          <Dropdown onSelect={(k) => { triggerLightHaptic(); setUserId(k || ''); }} className="w-100">
            <Dropdown.Toggle variant="dark" className="w-100 text-start border-secondary d-flex justify-content-between align-items-center bg-black bg-opacity-50 text-white fw-bold py-2 rounded-3">
              {playerName || 'Select player'}
            </Dropdown.Toggle>
            <Dropdown.Menu variant="dark" className="w-100 border-secondary shadow-lg f1-glass-card" style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {players.map(p => (<Dropdown.Item key={p.id} eventKey={p.id} active={userId === p.id}>{p.username}</Dropdown.Item>))}
            </Dropdown.Menu>
          </Dropdown>
        </Form.Group>
        {userId && (
          <div className="mb-3 extra-small text-center fw-bold opacity-75 text-uppercase">
            {existing
              ? <span className="text-warning">Current: P10 {driverName(existing.p10)} · DNF {driverName(existing.dnf)}</span>
              : <span className="text-muted">No prediction saved for this race</span>}
          </div>
        )}
        {picker('P10 Finisher', p10, setP10)}
        {picker('First DNF', dnf, setDnf)}
        <div className="d-grid">
          <HapticButton
            haptic="medium"
            variant={showConfirm ? 'danger' : 'outline-warning'}
            onClick={handleSave}
            disabled={saving || !userId || !round || !p10 || !dnf}
            className="fw-bold rounded-pill py-2"
          >
            {saving ? <Spinner animation="border" size="sm" /> : showConfirm ? 'TAP AGAIN TO CONFIRM' : existing ? 'UPDATE PREDICTION' : 'ADD PREDICTION'}
          </HapticButton>
        </div>
        <div className="mt-3 extra-small text-muted text-center opacity-75">Bypasses the race lock. Scores update on next leaderboard load.</div>
      </Card.Body>
    </Card>
  );
}
