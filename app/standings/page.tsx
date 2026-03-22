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

const DriversTable = ({ data }: { data: Driver[] }) => (
  <div className="table-responsive rounded-4 border border-secondary border-opacity-50 shadow-lg bg-dark bg-opacity-75 overflow-hidden" style={{ backdropFilter: 'blur(10px)' }}>
    <Table variant="dark" hover className="mb-0">
      <thead>
        <tr className="bg-black bg-opacity-40 text-uppercase letter-spacing-1 small" style={{ fontSize: '0.6rem' }}>
          <th className="ps-4 py-3 border-0" style={{ width: '60px' }}>Pos</th>
          <th className="py-3 border-0">Driver</th>
          <th className="py-3 border-0">Team</th>
          <th className="text-end py-3 border-0" style={{ width: '80px' }}>PTS</th>
          <th className="text-end pe-4 py-3 border-0" style={{ width: '80px' }}>No.</th>
        </tr>
      </thead>
      <tbody>
        {data.map((d, i) => (
          <tr key={d.id} style={{ height: '70px', verticalAlign: 'middle' }} className="border-secondary border-opacity-10">
            <td className="ps-4 fw-bold text-muted">{i + 1}</td>
            <td className="fw-bold text-white fs-5 text-nowrap">
              <div className="d-flex align-items-center">
                <div className="me-3 flex-shrink-0" style={{ width: '4px', height: '24px', backgroundColor: d.color }}></div>
                {d.name}
              </div>
            </td>
            <td className="text-nowrap">
              <span className="team-pill fw-bold text-uppercase" style={{ 
                backgroundColor: d.color, 
                color: getContrastColor(d.color),
                fontSize: '0.55rem',
                letterSpacing: '0.5px'
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

const ConstructorsTable = ({ data }: { data: ConstructorStanding[] }) => (
  <div className="table-responsive rounded-4 border border-secondary border-opacity-50 shadow-lg bg-dark bg-opacity-75 overflow-hidden" style={{ backdropFilter: 'blur(10px)' }}>
    <Table variant="dark" hover className="mb-0">
      <thead>
        <tr className="bg-black bg-opacity-40 text-uppercase letter-spacing-1 small" style={{ fontSize: '0.6rem' }}>
          <th className="ps-4 py-3 border-0" style={{ width: '60px' }}>Pos</th>
          <th className="py-3 border-0">Team</th>
          <th className="text-end pe-4 py-3 border-0" style={{ width: '80px' }}>PTS</th>
        </tr>
      </thead>
      <tbody>
        {data.map((c, i) => (
          <tr key={c.id} style={{ height: '70px', verticalAlign: 'middle' }} className="border-secondary border-opacity-10">
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
      renderTabContent={(tabId) => (
        loading ? (
          <div className="text-center py-5"><Spinner animation="border" variant="danger" /></div>
        ) : tabId === 'drivers' ? (
          <DriversTable data={standings} />
        ) : (
          <ConstructorsTable data={constructorStandings} />
        )
      )}
    >
      {/* Fallback for safety, though renderTabContent handles it */}
      {loading ? <div className="text-center py-5"><Spinner animation="border" variant="danger" /></div> : null}
    </SwipeablePageLayout>
  );
}
