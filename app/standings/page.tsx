'use client';

import { useState, useEffect } from 'react';
import { Container, Table, Spinner, Row, Col } from 'react-bootstrap';
import { CURRENT_SEASON } from '@/lib/data';
import { Driver } from '@/lib/types';
import { fetchDrivers } from '@/lib/api';
import { getContrastColor } from '@/lib/utils/colors';
import PullToRefresh from '@/components/PullToRefresh';
import { STORAGE_KEYS } from '@/lib/utils/storage';
import { sessionTracker } from '@/lib/utils/session';
import { Flag } from 'lucide-react';

export default function StandingsPage() {
  const [standings, setStandings] = useState<Driver[]>(() => {
    if (typeof window === 'undefined') return [];
    const cached = localStorage.getItem(STORAGE_KEYS.CACHE_STANDINGS);
    return cached ? JSON.parse(cached) : [];
  });
  const [loading, setLoading] = useState(!standings.length);

  async function load(quiet = false) {
    if (!quiet) setLoading(true);
    // 2. Fetch fresh data
    const data = await fetchDrivers(CURRENT_SEASON);
    if (data.length > 0) {
      setStandings(data);
      localStorage.setItem(STORAGE_KEYS.CACHE_STANDINGS, JSON.stringify(data));
    }
    setLoading(false);
  }

  useEffect(() => {
    const isFirstView = sessionTracker.isFirstView('standings');
    if (standings.length === 0 || isFirstView) {
      load(standings.length > 0);
    }
  }, [standings.length]);

  return (
    <PullToRefresh onRefresh={() => load(false)}>
      <Container className="mt-4 mb-4">
        <Row className="mb-4 align-items-center">
          <Col>
            <div className="d-flex align-items-center">
              <div className="bg-danger rounded-circle p-2 me-3 d-flex align-items-center justify-content-center shadow-sm" style={{ width: '45px', height: '45px' }}>
                <Flag size={24} className="text-white" />
              </div>
              <div>
                <h1 className="h2 mb-0 f1-page-title">World Standings</h1>
                <small className="text-muted text-uppercase fw-bold letter-spacing-1" style={{ fontSize: '0.65rem' }}>{CURRENT_SEASON} Driver Championship</small>
              </div>
            </div>
          </Col>
        </Row>
        
        {loading ? (
          <div className="text-center py-5">
            <Spinner animation="border" variant="danger" />
          </div>
        ) : (
          <div className="table-responsive rounded border border-secondary shadow-sm">
            <Table variant="dark" hover className="mb-0">
              <thead>
                <tr className="f1-table-header">
                  <th className="ps-4 py-3">Pos</th>
                  <th className="py-3">Driver</th>
                  <th className="py-3">Team</th>
                  <th className="text-end py-3">PTS</th>
                  <th className="text-end pe-4 py-3">No.</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((d, i) => (
                  <tr key={d.id} style={{ height: '70px', verticalAlign: 'middle' }}>
                    <td className="ps-4 fw-bold text-muted">{i + 1}</td>
                    <td className="fw-bold text-white fs-5">{d.name}</td>
                    <td>
                      <span className="team-pill" style={{ 
                        backgroundColor: d.color, 
                        color: getContrastColor(d.color),
                        fontSize: '0.6rem' 
                      }}>
                        {d.team}
                      </span>
                    </td>
                    <td className="text-end f1-total-points">
                      {d.points}
                    </td>
                    <td className="text-end pe-4 driver-number fs-4" style={{ color: d.color, opacity: 0.8 }}>
                      {d.number}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </Container>
    </PullToRefresh>
  );
}
