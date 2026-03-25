'use client';

import React from 'react';
import { Card, Spinner, Badge } from 'react-bootstrap';
import { motion, AnimatePresence } from 'framer-motion';
import { useF1LiveTiming } from '@/lib/hooks/use-f1-live-timing';
import { Driver } from '@/lib/types';

interface LiveRaceCenterProps {
  p10Prediction: string;
  dnfPrediction: string;
  drivers: Driver[];
  isRaceInProgress: boolean;
}

const LiveRaceCenter: React.FC<LiveRaceCenterProps> = ({ 
  p10Prediction, 
  dnfPrediction, 
  drivers,
  isRaceInProgress 
}) => {
  const { data, loading, error } = useF1LiveTiming(isRaceInProgress);

  if (!isRaceInProgress) return null;

  const results = data?.results || [];
  const userP10Result = results.find(r => r.driverId === p10Prediction);
  const userDnfResult = results.find(r => r.driverId === dnfPrediction);

  // P10 Tracking: Positions 8, 9, 10, 11, 12
  const focusResults = results.filter(r => r.position >= 8 && r.position <= 12);

  // DNF Tracking
  const retiredDrivers = results.filter(r => r.isRetired);

  return (
    <Card className="f1-glass-card border-danger border-opacity-25 mb-4 overflow-hidden">
      <div className="f1-card-header d-flex justify-content-between align-items-center bg-danger bg-opacity-10 py-2 px-3">
        <div className="d-flex align-items-center gap-2">
          <div className="live-indicator pulsing"></div>
          <h3 className="extra-small mb-0 text-uppercase fw-bold text-danger letter-spacing-2">Live Race Center</h3>
        </div>
        {loading ? (
          <Spinner animation="border" size="sm" variant="danger" />
        ) : (
          <span className="extra-small text-white opacity-50 fw-bold">{data?.status || 'TRACK LIVE'}</span>
        )}
      </div>
      
      <Card.Body className="p-3">
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
                    <div className="extra-small text-uppercase fw-bold text-muted mb-1" style={{ fontSize: '0.55rem' }}>Your P10 Pick</div>
                    <div className="d-flex align-items-center gap-2">
                      <div className="f1-driver-line" style={{ height: '12px', backgroundColor: drivers.find(d => d.id === p10Prediction)?.color || '#333' }}></div>
                      <span className="fw-bold text-white small text-truncate">
                        {drivers.find(d => d.id === p10Prediction)?.code || '---'}
                      </span>
                      <Badge bg={userP10Result?.position === 10 ? 'success' : 'danger'} className="ms-auto" style={{ fontSize: '0.6rem' }}>
                        P{userP10Result?.position || '??'}
                      </Badge>
                    </div>
                  </div>
                  <div className="col-6 ps-3">
                    <div className="extra-small text-uppercase fw-bold text-muted mb-1" style={{ fontSize: '0.55rem' }}>Your DNF Pick</div>
                    <div className="d-flex align-items-center gap-2">
                      <div className="f1-driver-line" style={{ height: '12px', backgroundColor: drivers.find(d => d.id === dnfPrediction)?.color || '#333' }}></div>
                      <span className="fw-bold text-white small text-truncate">
                        {drivers.find(d => d.id === dnfPrediction)?.code || '---'}
                      </span>
                      <Badge bg={userDnfResult?.isRetired ? 'success' : 'secondary'} className="ms-auto" style={{ fontSize: '0.6rem' }}>
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
                    const driver = drivers.find(d => d.id === res.driverId);
                    
                    return (
                      <motion.div 
                        key={res.driverId}
                        layout
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        className={`d-flex align-items-center p-2 rounded-2 ${isP10 ? 'bg-danger bg-opacity-20 border border-danger border-opacity-50 shadow-sm' : 'bg-dark bg-opacity-30 border border-secondary border-opacity-10'}`}
                      >
                        <div className={`fw-bold me-2 ${isP10 ? 'text-danger' : 'text-muted'}`} style={{ width: '20px', fontSize: '0.75rem' }}>{res.position}</div>
                        <div className="f1-driver-line me-2" style={{ backgroundColor: driver?.color || '#333' }}></div>
                        <div className="flex-grow-1">
                          <span className={`fw-bold small ${isP10 ? 'text-white' : 'text-white opacity-75'}`}>
                            {driver?.name || res.acronym}
                          </span>
                        </div>
                        {isUserPick && (
                          <div className="ms-auto extra-small fw-bold text-danger text-uppercase px-2" style={{ fontSize: '0.6rem' }}>YOUR PICK</div>
                        )}
                        <div className="extra-small text-muted font-monospace ms-2" style={{ fontSize: '0.65rem', minWidth: '45px', textAlign: 'right' }}>
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
                    <div className="d-flex gap-1">
                      {retiredDrivers.map(rd => (
                        <span key={rd.driverId} className="text-danger fw-bold">{rd.acronym}</span>
                      ))}
                    </div>
                  ) : (
                    <span>None yet</span>
                  )}
                </div>
                <div className="opacity-50 font-monospace" style={{ fontSize: '0.6rem' }}>
                  UPDATED: {new Date(data.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
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
