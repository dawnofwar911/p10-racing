'use client';

import React, { useState } from 'react';
import { Table, Badge, Spinner } from 'react-bootstrap';
import { LeaderboardEntry } from '@/lib/data';
import { Driver } from '@/lib/types';
import { triggerSelectionHaptic } from '@/lib/utils/haptics';

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
  loading: boolean;
  currentUser?: string;
  isSeasonComplete?: boolean;
  emptyMessage?: string;
  drivers?: Driver[];
}

export default function LeaderboardTable({ 
  entries, 
  loading, 
  currentUser, 
  isSeasonComplete = false,
  emptyMessage = "No entries yet.",
  drivers = []
}: LeaderboardTableProps) {

  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);

  const toggleExpand = (player: string) => {
    triggerSelectionHaptic();
    setExpandedPlayer(expandedPlayer === player ? null : player);
  };

  if (loading) {
    return (
      <div className="f1-premium-table-container">
        <Table variant="dark" className="f1-premium-table mb-0">
          <tbody>
            <tr>
              <td className="text-center py-5">
                <Spinner animation="border" variant="danger" />
              </td>
            </tr>
          </tbody>
        </Table>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="f1-premium-table-container">
        <Table variant="dark" className="f1-premium-table mb-0">
          <tbody>
            <tr>
              <td className="text-center py-5 text-muted small opacity-50">
                {emptyMessage}
              </td>
            </tr>
          </tbody>
        </Table>
      </div>
    );
  }

  return (
    <div className="f1-premium-table-container">
      <Table variant="dark" hover className="f1-premium-table mb-0">
        <thead>
          <tr>
            <th className="ps-4 border-0">Pos</th>
            <th className="py-3 border-0">Player</th>
            <th className="text-end py-3 border-0">Last Race</th>
            <th className="text-end pe-4 py-3 border-0">Total</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <React.Fragment key={entry.player}>
              <tr 
                onClick={() => toggleExpand(entry.player)}
                style={{ cursor: 'pointer' }}
                className={`${expandedPlayer === entry.player ? 'bg-danger bg-opacity-10' : ''} border-secondary border-opacity-10`}
              >
                <td className="ps-4 fw-bold text-muted">
                  {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : entry.rank}
                </td>
                <td className="fw-bold fs-5 text-white">
                  {entry.player}
                  {entry.player === currentUser && (
                    <span className="badge bg-danger ms-2 rounded-pill" style={{ fontSize: '0.5rem' }}>YOU</span>
                  )}
                  {entry.rank === 1 && entries.length > 1 && isSeasonComplete && (
                    <span className="ms-2 badge bg-warning text-dark small p-1 rounded-pill" style={{ fontSize: '0.6rem' }}>CHAMPION</span>
                  )}
                </td>
                <td className="text-end">
                  <span className={`f1-last-race-points fw-bold ${entry.lastRacePoints > 0 ? 'text-success' : 'text-muted'}`}>
                    {entry.lastRacePoints > 0 ? `+${entry.lastRacePoints}` : entry.lastRacePoints === 0 ? '-' : entry.lastRacePoints}
                  </span>
                </td>
                <td className="text-end pe-4 f1-total-points fw-bold fs-5">{entry.points}</td>
              </tr>
              {expandedPlayer === entry.player && (
                <tr className="bg-black bg-opacity-20 border-0">
                  <td colSpan={4} className="p-0 border-0">
                    <div className="p-3 p-md-4 rounded-0 border-bottom border-secondary border-opacity-25 shadow-inner" style={{ backgroundColor: 'rgba(21, 21, 30, 0.6)' }}>
                      {entry.breakdown && (
                        <div className="row g-4 mb-4 border-bottom border-secondary border-opacity-10 pb-4">
                          <div className="col-12 col-md-6 border-md-end border-secondary border-opacity-10">
                            <small className="text-danger text-uppercase d-block mb-3 fw-bold letter-spacing-1" style={{ fontSize: '0.6rem' }}>Latest Race: P10 Result</small>
                            <div className="d-flex justify-content-between align-items-start">
                              <div className="d-flex align-items-center">
                                <div className="f1-driver-line me-2" style={{ height: '24px', backgroundColor: drivers.find(d => d.id === entry.breakdown?.p10Driver)?.color || '#B6BABD' }}></div>
                                <div>
                                  <span className="fw-bold fs-5 text-uppercase letter-spacing-1 d-block text-white">{entry.breakdown?.p10Driver.replace(/_/g, ' ')}</span>
                                  {entry.breakdown?.p10Points === 25 ? (
                                    <span className="text-success fw-bold extra-small">+25 PTS (EXACT)</span>
                                  ) : (
                                    <span className="text-danger fw-bold extra-small">+{entry.breakdown?.p10Points} PTS</span>
                                  )}
                                </div>
                              </div>
                              <Badge bg={entry.breakdown?.actualP10Pos === 10 ? "success" : "danger"} className="rounded-pill px-3 py-2 fw-bold" style={{ fontSize: '0.7rem' }}>
                                ACTUAL P{entry.breakdown?.actualP10Pos}
                              </Badge>
                            </div>
                          </div>
                          
                          <div className="col-12 col-md-6 ps-md-4">
                            <small className="text-danger text-uppercase d-block mb-3 fw-bold letter-spacing-1" style={{ fontSize: '0.6rem' }}>Latest Race: First DNF Bonus</small>
                            <div className="d-flex justify-content-between align-items-start">
                              <div className="d-flex align-items-center">
                                <div className="f1-driver-line me-2" style={{ height: '24px', backgroundColor: drivers.find(d => d.id === entry.breakdown?.dnfDriver)?.color || '#B6BABD' }}></div>
                                <div>
                                  <span className="fw-bold fs-5 text-uppercase letter-spacing-1 d-block text-white">{entry.breakdown?.dnfDriver.replace(/_/g, ' ')}</span>
                                  {entry.breakdown?.dnfPoints && entry.breakdown.dnfPoints > 0 ? (
                                    <span className="text-success fw-bold extra-small">+25 PTS (CORRECT)</span>
                                  ) : (
                                    <span className="text-white opacity-50 fw-bold extra-small">+0 PTS (INCORRECT)</span>
                                  )}
                                </div>
                              </div>
                              <div className="fs-3">
                                {entry.breakdown?.dnfPoints && entry.breakdown.dnfPoints > 0 ? '🏎️💨' : '🏁'}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="season-history">
                        <h4 className="h6 text-uppercase fw-bold text-danger letter-spacing-2 mb-3" style={{ fontSize: '0.7rem' }}>Season History</h4>
                        {entry.history && entry.history.length > 0 ? (
                          <div className="table-responsive" style={{ margin: '0 -0.5rem' }}>
                            <Table variant="dark" size="sm" className="mb-0 extra-small" style={{ minWidth: '300px' }}>
                              <thead>
                                <tr className="text-white opacity-50 border-bottom border-secondary border-opacity-25 text-uppercase" style={{ fontSize: '0.55rem' }}>
                                  <th className="py-2 px-2">Round</th>
                                  <th className="py-2 px-2">P10 Pick</th>
                                  <th className="py-2 px-2">DNF Pick</th>
                                  <th className="py-2 px-2 text-end">PTS</th>
                                </tr>
                              </thead>
                              <tbody>
                                {entry.history.map((h, idx) => (
                                  <tr key={idx} className="border-bottom border-secondary border-opacity-10">
                                    <td className="py-2 px-2 fw-bold text-nowrap text-white">R{h.round}</td>
                                    <td className="py-2 px-2 text-uppercase letter-spacing-1">
                                      <div className="d-flex align-items-center">
                                        <div className="f1-driver-line me-2" style={{ height: '12px', backgroundColor: drivers.find(d => d.id === h.p10Driver)?.color || '#B6BABD' }}></div>
                                        <div className="d-flex flex-column">
                                          <div className="d-flex align-items-center">
                                            <span className={`fw-bold ${h.p10Pos === 10 ? 'text-success' : 'text-white'}`}>
                                              {h.p10Driver.replace(/_/g, ' ')}
                                            </span>
                                            {h.p10Pos === 10 && <span className="ms-1 text-success small">✓</span>}
                                          </div>
                                          <small className="text-white opacity-50" style={{ fontSize: '0.5rem' }}>(P{h.p10Pos})</small>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="py-2 px-2 text-uppercase letter-spacing-1">
                                      <div className="d-flex align-items-center">
                                        <div className="f1-driver-line me-2" style={{ height: '12px', backgroundColor: drivers.find(d => d.id === h.dnfDriver)?.color || '#B6BABD' }}></div>
                                        <div className="d-flex align-items-center">
                                          <span className={h.dnfCorrect ? 'text-success fw-bold' : 'text-white opacity-50'}>{h.dnfDriver.replace(/_/g, ' ')}</span>
                                          {h.dnfCorrect && <span className="ms-1 text-success small">✓</span>}
                                        </div>
                                      </div>
                                    </td>
                                    <td className="py-2 px-2 text-end fw-bold text-white text-nowrap">+{h.points}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </Table>
                          </div>
                        ) : (
                          <p className="text-white opacity-50 small mb-0 text-center py-2">No history available for this season.</p>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
