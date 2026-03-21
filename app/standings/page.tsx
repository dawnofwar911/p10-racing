'use client';

import { useState, useEffect } from 'react';
import { Table, Spinner } from 'react-bootstrap';
import { CURRENT_SEASON } from '@/lib/data';
import { Driver, ConstructorStanding } from '@/lib/types';
import { fetchDrivers, fetchConstructors } from '@/lib/api';
import { getContrastColor } from '@/lib/utils/colors';
import { STORAGE_KEYS } from '@/lib/utils/storage';
import { sessionTracker } from '@/lib/utils/session';
import { Flag, Trophy, Users } from 'lucide-react';
import SwipeablePageLayout from '@/components/SwipeablePageLayout';

export default function StandingsPage() {
  const [standings, setStandings] = useState<Driver[]>(() => {
    if (typeof window === 'undefined') return [];
    const cached = localStorage.getItem(STORAGE_KEYS.CACHE_STANDINGS);
    return cached ? JSON.parse(cached) : [];
  });
  
  const [constructorStandings, setConstructorStandings] = useState<ConstructorStanding[]>(() => {
    if (typeof window === 'undefined') return [];
    const cached = localStorage.getItem(STORAGE_KEYS.CACHE_CONSTRUCTORS);
    return cached ? JSON.parse(cached) : [];
  });

  const [loading, setLoading] = useState(!standings.length && !constructorStandings.length);
  const [view, setView] = useState<'drivers' | 'constructors'>('drivers');

  async function load(quiet = false) {
    if (!quiet) setLoading(true);
    
    try {
      const [driverData, constructorData] = await Promise.all([
        fetchDrivers(CURRENT_SEASON),
        fetchConstructors(CURRENT_SEASON)
      ]);

      if (driverData.length > 0) {
        setStandings(driverData);
        localStorage.setItem(STORAGE_KEYS.CACHE_STANDINGS, JSON.stringify(driverData));
      }

      if (constructorData.length > 0) {
        setConstructorStandings(constructorData);
        localStorage.setItem(STORAGE_KEYS.CACHE_CONSTRUCTORS, JSON.stringify(constructorData));
      }
    } catch (error) {
      console.error('Error loading standings:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const isFirstView = sessionTracker.isFirstView('standings');
    if (standings.length === 0 || constructorStandings.length === 0 || isFirstView) {
      load(standings.length > 0 || constructorStandings.length > 0);
    }
  }, [standings.length, constructorStandings.length]);

  const DriversTable = () => (
    <div className="table-responsive rounded border border-secondary shadow-sm">
      <Table variant="dark" hover className="mb-0">
        <thead>
          <tr className="f1-table-header">
            <th className="ps-4 py-3" style={{ width: '60px' }}>Pos</th>
            <th className="py-3">Driver</th>
            <th className="py-3">Team</th>
            <th className="text-end py-3" style={{ width: '80px' }}>PTS</th>
            <th className="text-end pe-4 py-3" style={{ width: '80px' }}>No.</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((d, i) => (
            <tr key={d.id} style={{ height: '70px', verticalAlign: 'middle' }}>
              <td className="ps-4 fw-bold text-muted">{i + 1}</td>
              <td className="fw-bold text-white fs-5 text-nowrap">
                <div className="d-flex align-items-center">
                  <div className="me-3 flex-shrink-0" style={{ width: '4px', height: '24px', backgroundColor: d.color }}></div>
                  {d.name}
                </div>
              </td>
              <td className="text-nowrap">
                <span className="team-pill" style={{ 
                  backgroundColor: d.color, 
                  color: getContrastColor(d.color),
                  fontSize: '0.6rem' 
                }}>
                  {d.team}
                </span>
              </td>
              <td className="text-end f1-total-points">{d.points}</td>
              <td className="text-end pe-4 driver-number fs-4" style={{ color: d.color, opacity: 0.8 }}>{d.number}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );

  const ConstructorsTable = () => (
    <div className="table-responsive rounded border border-secondary shadow-sm">
      <Table variant="dark" hover className="mb-0">
        <thead>
          <tr className="f1-table-header">
            <th className="ps-4 py-3" style={{ width: '60px' }}>Pos</th>
            <th className="py-3">Team</th>
            <th className="text-end pe-4 py-3" style={{ width: '80px' }}>PTS</th>
          </tr>
        </thead>
        <tbody>
          {constructorStandings.map((c, i) => (
            <tr key={c.id} style={{ height: '70px', verticalAlign: 'middle' }}>
              <td className="ps-4 fw-bold text-muted">{i + 1}</td>
              <td className="fw-bold text-white fs-5 text-nowrap">
                <div className="d-flex align-items-center">
                  <div className="me-3 flex-shrink-0" style={{ width: '4px', height: '24px', backgroundColor: c.color }}></div>
                  {c.name}
                </div>
              </td>
              <td className="text-end f1-total-points pe-4">{c.points}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );

  return (
    <SwipeablePageLayout
      title="World Championship"
      subtitle={view === 'drivers' ? 'Driver Standings' : 'Constructor Standings'}
      icon={<Flag size={24} className="text-white" />}
      activeTab={view}
      onTabChange={setView}
      onRefresh={() => load(true)}
      splitOnWide={true}
      tabs={[
        { id: 'drivers', label: 'Drivers', icon: <Users size={16} /> },
        { id: 'constructors', label: 'Constructors', icon: <Trophy size={16} /> }
      ]}
    >
      {loading ? (
        <div className="text-center py-5">
          <Spinner animation="border" variant="danger" />
        </div>
      ) : (
        view === 'drivers' ? <DriversTable /> : <ConstructorsTable />
      )}
    </SwipeablePageLayout>
  );
}
