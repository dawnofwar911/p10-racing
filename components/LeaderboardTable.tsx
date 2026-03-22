'use client';

import React, { useState } from 'react';
import { Table, Badge, Spinner } from 'react-bootstrap';
import { LeaderboardEntry } from '@/lib/data';
import { triggerSelectionHaptic } from '@/lib/utils/haptics';

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
  loading: boolean;
  currentUser?: string;
  isSeasonComplete?: boolean;
  emptyMessage?: string;
}

export default function LeaderboardTable({ 
  entries, 
  loading, 
  currentUser, 
  isSeasonComplete = false,
  emptyMessage = "No entries found."
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
                    <div className="p-3 p-md-4 bg-dark bg-opacity-50 rounded-0 border-bottom border-secondary border-opacity-25 shadow-inner">
                      {entry.breakdown && (
                        <div className="row g-3 text-white mb-4 border-bottom border-secondary border-opacity-10 pb-4">
                          <div className="col-12 col-md-6 border-md-end border-secondary border-opacity-10 mb-3 mb-md-0">
                            <small className="text-muted text-uppercase d-block mb-2 fw-bold letter-spacing-1" style={{ fontSize: '0.6rem' }}>Latest Race: P10 Result</small>
                            <div className="d-flex justify-content-between align-items-center">
                              <span className="fw-bold fs-6 text-uppercase letter-spacing-1">{entry.breakdown.p10Driver.replace(/_/g, ' ')}</span>
                              <Badge bg="danger" className="rounded-pill" style={{ fontSize: '0.65rem' }}>P{entry.breakdown.actualP10Pos}</Badge>
                            </div>
                            <div className="mt-2 text-danger fw-bold extra-small">+{entry.breakdown.p10Points} PTS</div>
                          </div>
                          <div className="col-12 col-md-6 ps-md-4">
                            <small className="text-muted text-uppercase d-block mb-2 fw-bold letter-spacing-1" style={{ fontSize: '0.6rem' }}>Latest Race: First DNF Bonus</small>
                            <div className="mt-1">
                              {entry.breakdown.dnfPoints > 0 ? (
                                <div className="text-success fw-bold d-flex align-items-center extra-small">
                                  <span className="fs-6 me-2">🏎️💨</span> Correct (+25 PTS)
                                </div>
                              ) : (
                                <div className="text-muted d-flex align-items-center opacity-50 extra-small">
                                  <span className="fs-6 me-2">🏁</span> Incorrect (+0 PTS)
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="season-history">
                        <h4 className="h6 text-uppercase fw-bold text-danger letter-spacing-2 mb-3" style={{ fontSize: '0.7rem' }}>Season History</h4>
                        {entry.history && entry.history.length > 0 ? (
                          <div className="table-responsive" style={{ margin: '0 -0.5rem' }}>
                            <Table variant="dark" size="sm" className="mb-0 extra-small opacity-75" style={{ minWidth: '300px' }}>
                              <thead>
                                <tr className="text-muted border-bottom border-secondary border-opacity-25 text-uppercase" style={{ fontSize: '0.55rem' }}>
                                  <th className="py-2 px-2">Round</th>
                                  <th className="py-2 px-2">P10 Pick</th>
                                  <th className="py-2 px-2">DNF Pick</th>
                                  <th className="py-2 px-2 text-end">PTS</th>
                                </tr>
                              </thead>
                              <tbody>
                                {entry.history.map((h, idx) => (
                                  <tr key={idx} className="border-bottom border-secondary border-opacity-10">
                                    <td className="py-2 px-2 fw-bold text-nowrap">R{h.round}</td>
                                    <td className="py-2 px-2 text-uppercase letter-spacing-1">
                                      <div className="d-flex flex-column">
                                        <span className="text-white">{h.p10Driver.replace(/_/g, ' ')}</span>
                                        <small className="text-muted">(P{h.p10Pos})</small>
                                      </div>
                                    </td>
                                    <td className="py-2 px-2 text-uppercase letter-spacing-1">
                                      <div className="d-flex align-items-center">
                                        <span className={h.dnfCorrect ? 'text-success' : 'text-white opacity-50'}>{h.dnfDriver.replace(/_/g, ' ')}</span>
                                        {h.dnfCorrect && <span className="ms-1 text-success small">✓</span>}
                                      </div>
                                    </td>
                                    <td className="py-2 px-2 text-end fw-bold text-white text-nowrap">+{h.points}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </Table>
                          </div>
                        ) : (
                          <p className="text-muted small mb-0 opacity-50">No history available for this season.</p>
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
