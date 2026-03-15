'use client';

import { useState, useEffect } from 'react';
import { Container, Table, Spinner } from 'react-bootstrap';
import { CURRENT_SEASON } from '@/lib/data';
import { Driver } from '@/lib/types';
import { fetchDrivers } from '@/lib/api';
import { getContrastColor } from '@/lib/utils/colors';
import PullToRefresh from '@/components/PullToRefresh';

export default function StandingsPage() {
  const [standings, setStandings] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    // 2. Fetch fresh data
    const data = await fetchDrivers(CURRENT_SEASON);
    if (data.length > 0) {
      setStandings(data);
      localStorage.setItem('p10_cache_standings', JSON.stringify(data));
    }
    setLoading(false);
  }

  useEffect(() => {
    // 1. Load from cache first
    const cached = localStorage.getItem('p10_cache_standings');
    if (cached) {
      setStandings(JSON.parse(cached));
      setLoading(false);
    }
    load();
  }, []);

  return (
    <PullToRefresh onRefresh={load}>
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
                    <td className="ps-4 fw-bold text-muted">{i + 1}</td>
                    <td className="fw-bold text-white fs-5">{d.name}</td>
                    <td>
                      <span className="team-pill" style={{ 
                        backgroundColor: d.color, 
                        color: getContrastColor(d.color),
                        fontSize: '0.7rem' 
                      }}>
                        {d.team}
                      </span>
                    </td>
                    <td className="text-end fw-bold fs-5 text-white">
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
