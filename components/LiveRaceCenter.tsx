'use client';

import React, { useMemo, useEffect } from 'react';
import { Card, Spinner, Badge } from 'react-bootstrap';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './LiveRaceCenter.module.css';
import { useF1LiveTiming } from '@/lib/hooks/use-f1-live-timing';
import { Driver } from '@/lib/types';
import { Flag } from 'lucide-react';

interface LiveRaceCenterProps {
  p10Prediction: string;
  dnfPrediction: string;
  drivers: Driver[];
  isRaceInProgress: boolean;
  onRaceFinish?: () => void;
}

const getTrackStatusColor = (status: string) => {
  switch (status) {
    case '1': return 'success'; // Green
    case '2': return 'warning'; // Yellow
    case '4': return 'warning'; // SC
    case '5': return 'warning'; // VSC
    case '6': return 'info';    // VSC Ending
    case '3': return 'danger';  // Red
    case '7': return 'danger';  // Black
    default: return 'secondary';
  }
};

const getTyreColor = (compound: string) => {
  const c = compound.toUpperCase();
  if (c.includes('SOFT')) return '#E10600';
  if (c.includes('MEDIUM')) return '#FFD700';
  if (c.includes('HARD')) return '#FFFFFF';
  if (c.includes('INTER')) return '#43B02A';
  if (c.includes('WET')) return '#0042BB';
  return '#B6BABD';
};

const LiveRaceCenter: React.FC<LiveRaceCenterProps> = ({ 
  p10Prediction, 
  dnfPrediction, 
  drivers,
  isRaceInProgress,
  onRaceFinish
}) => {
  const { data, loading, error, isStale } = useF1LiveTiming(isRaceInProgress);

  useEffect(() => {
    if (data?.status && ['Finished', 'Final', 'Completed'].includes(data.status)) {
      onRaceFinish?.();
    }
  }, [data?.status, onRaceFinish]);

  const driversMap = useMemo(() => {
    return drivers.reduce((acc, d) => {
      acc[d.id] = d;
      return acc;
    }, {} as Record<string, Driver>);
  }, [drivers]);

  if (!isRaceInProgress) return null;

  const results = data?.results || [];
  const userP10Result = results.find(r => r.driverId === p10Prediction);
  const userDnfResult = results.find(r => r.driverId === dnfPrediction);

  // Track Status Banner logic
  const showTrackStatus = data?.trackStatus && data.trackStatus !== '1';

  // P10 Tracking: Positions 8, 9, 10, 11, 12
  const focusResults = results.filter(r => r.position >= 8 && r.position <= 12);

  // DNF Tracking
  const retiredDrivers = results.filter(r => r.isRetired);

  return (
    <Card className="f1-glass-card border-danger border-opacity-25 mb-4 overflow-hidden">
      <div className="f1-card-header d-flex justify-content-between align-items-center bg-danger bg-opacity-10 py-2 px-3">
        <div className="d-flex align-items-center gap-2">
          <div className={`live-indicator ${isStale ? 'bg-secondary' : 'pulsing'}`}></div>
          <h3 className="extra-small mb-0 text-uppercase fw-bold text-danger letter-spacing-2">
            {isStale ? 'Connection Weak' : 'Live Race Center'}
          </h3>
        </div>
        {loading ? (
          <Spinner animation="border" size="sm" variant="danger" />
        ) : (
          <div className="d-flex align-items-center gap-2">
            {data?.status === 'Completed' && (
              <Badge bg="success" className="extra-small px-2" style={{ fontSize: '0.6rem' }}>RESULTS PENDING</Badge>
            )}
            <span className={`extra-small fw-bold ${isStale ? 'text-warning' : 'text-white opacity-50'}`}>
              {isStale ? 'STALE DATA' : (data?.status || 'TRACK LIVE')}
            </span>
          </div>
        )}
      </div>
      
      <Card.Body className="p-3">
        {/* Track Status Banner */}
        <AnimatePresence>
          {showTrackStatus && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className={`alert alert-${getTrackStatusColor(data.trackStatus)} py-2 px-3 extra-small mb-3 d-flex align-items-center gap-2 border-0 bg-opacity-10 text-${getTrackStatusColor(data.trackStatus)} ${styles.statusMessage}`}
            >
              <Flag size={14} className="flex-shrink-0" />
              <span>{data.trackMessage || 'Track Status Change'}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {isStale && !showTrackStatus && (
          <div className={`alert alert-warning py-1 px-2 extra-small mb-3 d-flex align-items-center gap-2 border-0 bg-warning bg-opacity-10 text-warning ${styles.warningBox}`}>
            <Spinner animation="grow" size="sm" variant="warning" className={styles.spinnerSmall} />
            <span>Outdated data. Reconnecting...</span>
          </div>
        )}

        {error ? (
          <div className="text-center py-3">
            <p className="extra-small text-muted mb-0">Waiting for live timing data...</p>
          </div>
        ) : !data ? (
          <div className="text-center py-4">
            <Spinner animation="grow" size="sm" variant="danger" className="me-2" />
            <span className="extra-small text-white opacity-50 text-uppercase fw-bold letter-spacing-1">Connecting to Track...</span>
          </div>
        ) : (
          <div className="row g-3">
            {/* 1. Prediction Status */}
            <div className="col-12">
              <div className="bg-dark bg-opacity-50 rounded-3 p-2 border border-secondary border-opacity-25">
                <div className="row g-2">
                  <div className="col-6 border-end border-secondary border-opacity-25">
                    <div className={`extra-small text-uppercase fw-bold text-muted mb-1 ${styles.labelSmall}`}>Your P10 Pick</div>
                    <div className="d-flex align-items-center gap-2">
                      <div className={`f1-driver-line ${styles.driverLine}`} style={{ '--team-color': driversMap[p10Prediction]?.color || '#333' } as React.CSSProperties}></div>
                      <span className="fw-bold text-white small text-truncate">
                        {driversMap[p10Prediction]?.code || '---'}
                      </span>
                      <Badge bg={userP10Result?.position === 10 ? 'success' : 'danger'} className={`ms-auto ${styles.badgeSmall}`}>
                        P{userP10Result?.position || '??'}
                      </Badge>
                    </div>
                  </div>
                  <div className="col-6 ps-3">
                    <div className={`extra-small text-uppercase fw-bold text-muted mb-1 ${styles.labelSmall}`}>Your DNF Pick</div>
                    <div className="d-flex align-items-center gap-2">
                      <div className={`f1-driver-line ${styles.driverLine}`} style={{ '--team-color': driversMap[dnfPrediction]?.color || '#333' } as React.CSSProperties}></div>
                      <span className="fw-bold text-white small text-truncate">
                        {driversMap[dnfPrediction]?.code || '---'}
                      </span>
                      <Badge bg={userDnfResult?.isRetired ? 'success' : 'secondary'} className={`ms-auto ${styles.badgeSmall}`}>
                        {userDnfResult?.isRetired ? 'DNF' : 'LIVE'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. P10 Tracker */}
            <div className="col-12">
              <h4 className="extra-small text-uppercase fw-bold text-danger letter-spacing-1 mb-2">The P10 Battle</h4>
              <div className="d-flex flex-column gap-1">
                <AnimatePresence mode="popLayout">
                  {focusResults.length > 0 ? focusResults.map((res) => {
                    const isUserPick = res.driverId === p10Prediction;
                    const isP10 = res.position === 10;
                    const driver = driversMap[res.driverId];
                    const tyreColor = getTyreColor(res.tyres?.compound || '');
                    
                    return (
                      <motion.div 
                        key={res.driverId}
                        layout
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        className={`d-flex align-items-center p-2 rounded-2 ${isP10 ? 'bg-danger bg-opacity-20 border border-danger border-opacity-50 shadow-sm' : 'bg-dark bg-opacity-30 border border-secondary border-opacity-10'}`}
                      >
                        <div className={`fw-bold me-2 ${isP10 ? 'text-danger' : 'text-muted'} ${styles.positionText}`}>{res.position}</div>
                        <div className={`f1-driver-line me-2 ${styles.driverLine}`} style={{ '--team-color': driver?.color || '#333' } as React.CSSProperties}></div>
                        <div className="flex-grow-1 overflow-hidden">
                          <div className="d-flex align-items-center gap-2">
                            <span className={`fw-bold small text-truncate ${isP10 ? 'text-white' : 'text-white opacity-75'}`}>
                              {driver?.name || res.acronym}
                            </span>
                            {res.tyres && (
                              <div className={`d-flex align-items-center gap-1 opacity-75 ${styles.tyreText}`}>
                                <div className={`rounded-circle border border-secondary border-opacity-50 ${styles.tyreDot}`} style={{ '--tyre-color': tyreColor } as React.CSSProperties}></div>
                                <span className="text-muted">{res.tyres.laps}L</span>
                              </div>
                            )}
                          </div>
                        </div>
                        {isUserPick && (
                          <div className={`ms-auto fw-bold text-danger text-uppercase px-1 ${styles.yourPickText}`}>YOUR PICK</div>
                        )}
                        <div className={`text-muted font-monospace ms-2 ${styles.gapText}`}>
                          {res.position === 1 ? 'LEADER' : res.gap || res.interval}
                        </div>
                      </motion.div>
                    );
                  }) : (
                    <div className="text-center py-2 opacity-50 extra-small">Formation lap in progress...</div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* 3. Session Status */}
            <div className="col-12 mt-1">
              <div className="d-flex justify-content-between align-items-center extra-small text-muted">
                <div className="d-flex align-items-center gap-1">
                  <span className="fw-bold">RETIRED:</span>
                  {retiredDrivers.length > 0 ? (
                    <div className="d-flex gap-1 overflow-hidden">
                      {retiredDrivers.map(rd => (
                        <span key={rd.driverId} className="text-danger fw-bold">{rd.acronym}</span>
                      ))}
                    </div>
                  ) : (
                    <span>None yet</span>
                  )}
                </div>
                <div className={`opacity-50 font-monospace ${styles.trackLiveText}`} suppressHydrationWarning>
                  TRACK LIVE · {new Date(data.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          </div>
        )}
      </Card.Body>
    </Card>
  );
};

export default LiveRaceCenter;
