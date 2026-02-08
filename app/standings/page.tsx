'use client';

import { useState, useEffect } from 'react';
import { Container, Row, Col, Table, Spinner } from 'react-bootstrap';
import { CURRENT_SEASON } from '@/lib/data';
import { fetchDrivers } from '@/lib/api';
import AppNavbar from '@/components/AppNavbar';

export default function StandingsPage() {
  const [standings, setStandings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      // The fetchDrivers function already uses the driverStandings endpoint!
      const data = await fetchDrivers(CURRENT_SEASON);
      setStandings(data);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <main>
      <AppNavbar />
      <Container className="mt-4">
        <h1 className="h2 mb-4">World Championship Standings</h1>
        
        <div className="table-responsive rounded border border-secondary">
          {loading ? (
            <div className="text-center py-5">
              <Spinner animation="border" variant="danger" />
            </div>
          ) : (
            <Table variant="dark" hover className="mb-0">
              <thead>
                <tr>
                  <th className="ps-4">Pos</th>
                  <th>Driver</th>
                  <th>Team</th>
                  <th className="text-end pe-4">No.</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((d, i) => (
                  <tr key={d.id} style={{ height: '50px', verticalAlign: 'middle' }}>
                    <td className="ps-4 fw-bold text-muted">{i + 1}</td>
                    <td className="fw-bold text-white">{d.name}</td>
                    <td>
                      <span className="team-pill" style={{ backgroundColor: d.color, fontSize: '0.7rem' }}>
                        {d.team}
                      </span>
                    </td>
                    <td className="text-end pe-4 driver-number opacity-50" style={{ fontSize: '1rem' }}>{d.number}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </Container>
    </main>
  );
}
