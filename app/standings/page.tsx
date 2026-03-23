'use client';

import { useState, useEffect } from 'react';
import { Table, Spinner } from 'react-bootstrap';
import { CURRENT_SEASON } from '@/lib/data';
import { Driver, ConstructorStanding } from '@/lib/types';
import { fetchDrivers, fetchConstructors } from '@/lib/api';
import { STORAGE_KEYS } from '@/lib/utils/storage';
import { sessionTracker } from '@/lib/utils/session';
import { Flag, Trophy, Users } from 'lucide-react';
import SwipeablePageLayout from '@/components/SwipeablePageLayout';

const DriversTable = ({ data }: { data: Driver[] }) => (
  <div className="f1-premium-table-container">
    <Table variant="dark" hover className="f1-premium-table mb-0">
      <thead>
        <tr>
          <th className="ps-3 border-0" style={{ width: '50px' }}>Pos</th>
          <th className="border-0">Driver / Team</th>
          <th className="text-end pe-4 border-0" style={{ width: '80px' }}>PTS</th>
        </tr>
      </thead>
      <tbody>
        {data.map((d, i) => (
          <tr key={d.id} className="border-secondary border-opacity-10">
            <td className="ps-3 fw-bold text-muted">{i + 1}</td>
            <td className="fw-bold text-white fs-6 text-nowrap">
              <div className="d-flex align-items-center">
                <div className="me-2 flex-shrink-0" style={{ width: '3px', height: '24px', backgroundColor: d.color }}></div>
                <div className="d-flex flex-column">
                  <span className="fw-bold fs-6">{d.name}</span>
                  <span className="text-muted extra-small text-uppercase mt-1" style={{ fontSize: '0.55rem', letterSpacing: '0.5px' }}>{d.team}</span>
                </div>
              </div>
            </td>
            <td className="text-end pe-4 f1-total-points fs-5">{d.points}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  </div>
);
const ConstructorsTable = ({ data, drivers }: { data: ConstructorStanding[], drivers: Driver[] }) => (
  <div className="f1-premium-table-container">
    <Table variant="dark" hover className="f1-premium-table mb-0">
      <thead>
        <tr>
          <th className="ps-3 border-0" style={{ width: '50px' }}>Pos</th>
          <th className="border-0">Team</th>
          <th className="text-end pe-4 border-0" style={{ width: '80px' }}>PTS</th>
        </tr>
      </thead>
      <tbody>
        {data.map((c, i) => {
          const teamDrivers = drivers.filter(d => d.teamId === c.id);
          return (
            <tr key={c.id} className="border-secondary border-opacity-10">
              <td className="ps-3 fw-bold text-muted">{i + 1}</td>
              <td className="fw-bold text-white fs-5 text-nowrap">
                <div className="d-flex align-items-center">
                  <div className="me-2 flex-shrink-0" style={{ width: '3px', height: '24px', backgroundColor: c.color }}></div>
                  <div className="d-flex flex-column">
                    <span>{c.name}</span>
                    {teamDrivers.length > 0 && (
                      <span className="text-muted extra-small text-uppercase mt-1" style={{ fontSize: '0.55rem', letterSpacing: '0.5px' }}>
                        {teamDrivers.map(d => d.name.split(' ').pop()).join(' • ')}
                      </span>
                    )}
                  </div>
                </div>
              </td>
              <td className="text-end f1-total-points pe-4 fs-5">{c.points}</td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  </div>
);

export default function StandingsPage() {
  const [standings, setStandings] = useState<Driver[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const cached = localStorage.getItem(STORAGE_KEYS.CACHE_STANDINGS);
      return cached ? JSON.parse(cached) : [];
    } catch (e) {
      console.warn('Standings: Failed to parse drivers cache', e);
      return [];
    }
  });
  
  const [constructorStandings, setConstructorStandings] = useState<ConstructorStanding[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const cached = localStorage.getItem(STORAGE_KEYS.CACHE_CONSTRUCTORS);
      return cached ? JSON.parse(cached) : [];
    } catch (e) {
      console.warn('Standings: Failed to parse constructors cache', e);
      return [];
    }
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
          <ConstructorsTable data={constructorStandings} drivers={standings} />
        )
      )}
    >
      {/* Fallback for safety, though renderTabContent handles it */}
      {loading ? <div className="text-center py-5"><Spinner animation="border" variant="danger" /></div> : null}
    </SwipeablePageLayout>
  );
}
