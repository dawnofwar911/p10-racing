'use client';

import { useState, useEffect } from 'react';
import { Container, Table, Spinner, Row, Col, Nav } from 'react-bootstrap';
import { CURRENT_SEASON } from '@/lib/data';
import { Driver, ConstructorStanding } from '@/lib/types';
import { fetchDrivers, fetchConstructors } from '@/lib/api';
import { getContrastColor } from '@/lib/utils/colors';
import PullToRefresh from '@/components/PullToRefresh';
import { STORAGE_KEYS } from '@/lib/utils/storage';
import { sessionTracker } from '@/lib/utils/session';
import { Flag, Trophy, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { triggerSelectionHaptic } from '@/lib/utils/haptics';

const SWIPE_THRESHOLD = 30;
const VELOCITY_THRESHOLD = 200;

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
  const [activeView, setActiveView] = useState<'drivers' | 'constructors'>('drivers');

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

  const handleTabChange = (view: 'drivers' | 'constructors') => {
    if (view !== activeView) {
      triggerSelectionHaptic();
      setActiveView(view);
    }
  };

  const swipeHandlers = {
    onDragEnd: (event: MouseEvent | TouchEvent | PointerEvent, info: { offset: { x: number; y: number }; velocity: { x: number; y: number } }) => {
      const { offset, velocity } = info;
      
      // Trigger if either distance or velocity crosses threshold
      const isRightSwipe = offset.x > SWIPE_THRESHOLD || velocity.x > VELOCITY_THRESHOLD;
      const isLeftSwipe = offset.x < -SWIPE_THRESHOLD || velocity.x < -VELOCITY_THRESHOLD;

      if (isRightSwipe && activeView === 'constructors') {
        handleTabChange('drivers');
      } else if (isLeftSwipe && activeView === 'drivers') {
        handleTabChange('constructors');
      }
    }
  };

  return (
    <PullToRefresh onRefresh={() => load(true)}>
      <Container className="mt-4 mb-4 overflow-hidden">
        <Row className="mb-4 align-items-center">
          <Col>
            <div className="d-flex align-items-center">
              <div className="bg-danger rounded-circle p-2 me-3 d-flex align-items-center justify-content-center shadow-sm" style={{ width: '45px', height: '45px' }}>
                <Flag size={24} className="text-white" />
              </div>
              <div>
                <h1 className="h2 mb-0 f1-page-title">World Championship</h1>
                <small className="text-muted text-uppercase fw-bold letter-spacing-1" style={{ fontSize: '0.65rem' }}>
                  {activeView === 'drivers' ? 'Driver Standings' : 'Constructor Standings'}
                </small>
              </div>
            </div>
          </Col>
        </Row>

        <div className="mb-4">
          <Nav variant="pills" className="f1-tab-container p-1 bg-dark rounded-pill border border-secondary" style={{ width: 'fit-content' }}>
            <Nav.Item>
              <Nav.Link 
                active={activeView === 'drivers'} 
                onClick={() => handleTabChange('drivers')}
                className="rounded-pill px-4 py-2 d-flex align-items-center"
              >
                <Users size={16} className="me-2" />
                Drivers
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link 
                active={activeView === 'constructors'} 
                onClick={() => handleTabChange('constructors')}
                className="rounded-pill px-4 py-2 d-flex align-items-center"
              >
                <Trophy size={16} className="me-2" />
                Constructors
              </Nav.Link>
            </Nav.Item>
          </Nav>
        </div>
        
        {loading ? (
          <div className="text-center py-5">
            <Spinner animation="border" variant="danger" />
          </div>
        ) : (
          <div className="position-relative" style={{ minHeight: '400px' }}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={activeView}
                initial={{ opacity: 0, x: activeView === 'drivers' ? -20 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: activeView === 'drivers' ? -20 : 20 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.15}
                onDragEnd={swipeHandlers.onDragEnd}
                className="w-100"
              >
                <div className="table-responsive rounded border border-secondary shadow-sm">
                  <Table variant="dark" hover className="mb-0">
                    <thead>
                      <tr className="f1-table-header">
                        <th className="ps-4 py-3">Pos</th>
                        <th className="py-3">{activeView === 'drivers' ? 'Driver' : 'Team'}</th>
                        {activeView === 'drivers' && <th className="py-3">Team</th>}
                        <th className={`text-end py-3 ${activeView === 'constructors' ? 'pe-4' : ''}`}>PTS</th>
                        {activeView === 'drivers' && <th className="text-end pe-4 py-3">No.</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {activeView === 'drivers' ? (
                        standings.map((d, i) => (
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
                        ))
                      ) : (
                        constructorStandings.map((c, i) => (
                          <tr key={c.id} style={{ height: '70px', verticalAlign: 'middle' }}>
                            <td className="ps-4 fw-bold text-muted">{i + 1}</td>
                            <td className="fw-bold text-white fs-5">
                              <div className="d-flex align-items-center">
                                <div className="me-3" style={{ width: '4px', height: '24px', backgroundColor: c.color }}></div>
                                {c.name}
                              </div>
                            </td>
                            <td className="text-end f1-total-points pe-4">
                              {c.points}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </Table>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        )}
      </Container>
    </PullToRefresh>
  );
}
