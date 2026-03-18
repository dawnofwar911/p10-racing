'use client';

import { useState, useEffect } from 'react';
import { Container, Table, Spinner } from 'react-bootstrap';
import { CURRENT_SEASON } from '@/lib/data';
import { Driver } from '@/lib/types';
import { fetchDrivers } from '@/lib/api';
import { getContrastColor } from '@/lib/utils/colors';
import PullToRefresh from '@/components/PullToRefresh';
import { STORAGE_KEYS } from '@/lib/utils/storage';
import { sessionTracker } from '@/lib/utils/session';

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
      <Container className="mt-4 mb-2">
        <h1 className="h2 mb-4 fw-bold text-uppercase letter-spacing-1">World Championship Standings</h1>
        
        {loading ? (
          <div className="text-center py-5">
            <Spinner animation="border" variant="danger" />
          </div>
        ) : (
          <div className="table-responsive rounded border border-secondary shadow-sm">
            <Table variant="dark" hover className="mb-0">
              <thead>
                <tr className="bg-dark bg-opacity-50">
                  <th className="ps-4 py-3 text-uppercase small letter-spacing-1">Pos</th>
                  <th className="py-3 text-uppercase small letter-spacing-1">Driver</th>
                  <th className="py-3 text-uppercase small letter-spacing-1">Team</th>
                  <th className="text-end py-3 text-uppercase small letter-spacing-1">PTS</th>
                  <th className="text-end pe-4 py-3 text-uppercase small letter-spacing-1">No.</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((d, i) => (
                  <tr key={d.id} style={{ height: '60px', verticalAlign: 'middle' }}>
                    <td className="ps-4 fw-bold text-muted small">{i + 1}</td>
                    <td className="fw-bold text-white h6 mb-0">{d.name}</td>
                    <td>
                      <span className="team-pill" style={{ 
                        backgroundColor: d.color, 
                        color: getContrastColor(d.color),
                        fontSize: '0.6rem' 
                      }}>
                        {d.team}
                      </span>
                    </td>
                    <td className="text-end fw-bold h6 mb-0 text-white">
                      {d.points}
                    </td>
                    <td className="text-end pe-4 driver-number h5 mb-0" style={{ color: d.color, opacity: 0.8 }}>
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
