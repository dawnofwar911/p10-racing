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
      <div className="table-responsive rounded border border-secondary shadow-sm">
        <Table variant="dark" className="mb-0">
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
      <div className="table-responsive rounded border border-secondary shadow-sm">
        <Table variant="dark" className="mb-0">
          <tbody>
            <tr>
              <td className="text-center py-5 text-muted small">
                {emptyMessage}
              </td>
            </tr>
          </tbody>
        </Table>
      </div>
    );
  }

  return (
    <div className="table-responsive rounded border border-secondary shadow-sm">
      <Table variant="dark" hover className="mb-0">
        <thead>
          <tr className="f1-table-header">
            <th className="ps-4 py-3">Pos</th>
            <th className="py-3">Player</th>
            <th className="text-end py-3">Last Race</th>
            <th className="text-end pe-4 py-3">Total</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <React.Fragment key={entry.player}>
              <tr 
                onClick={() => toggleExpand(entry.player)}
                style={{ height: '70px', verticalAlign: 'middle', cursor: 'pointer' }}
                className={expandedPlayer === entry.player ? 'bg-danger bg-opacity-10' : ''}
              >
                <td className="ps-4 fw-bold text-muted">
                  {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : entry.rank}
                </td>
                <td className="fw-bold fs-5 text-white">
                  {entry.player}
                  {entry.player === currentUser && (
                    <span className="badge bg-danger ms-2" style={{ fontSize: '0.5rem' }}>YOU</span>
                  )}
                  {entry.rank === 1 && entries.length > 1 && isSeasonComplete && (
                    <span className="ms-2 badge bg-warning text-dark small p-1" style={{ fontSize: '0.6rem' }}>CHAMPION</span>
                  )}
                </td>
                <td className="text-end">
                  <span className={`f1-last-race-points ${entry.lastRacePoints > 0 ? 'text-success' : 'text-muted'}`}>
                    {entry.lastRacePoints > 0 ? `+${entry.lastRacePoints}` : entry.lastRacePoints === 0 ? '-' : entry.lastRacePoints}
                  </span>
                </td>
                <td className="text-end pe-4 f1-total-points">{entry.points}</td>
              </tr>
              {expandedPlayer === entry.player && (
                <tr className="bg-dark bg-opacity-75">
                  <td colSpan={4} className="p-0 border-0">
                    <div className="p-3 p-md-4 m-2 m-md-3 bg-dark rounded border border-secondary shadow-sm">
                      {entry.breakdown && (
                        <div className="row g-3 text-white mb-4 border-bottom border-secondary pb-4">
                          <div className="col-md-6 border-md-end border-secondary">
                            <small className="text-muted text-uppercase d-block mb-2 fw-bold" style={{ fontSize: '0.65rem' }}>Latest Race: P10 Result</small>
                            <div className="d-flex justify-content-between align-items-center">
                              <span className="fw-bold fs-5 text-uppercase">{entry.breakdown.p10Driver.replace(/_/g, ' ')}</span>
                              <Badge bg="secondary">P{entry.breakdown.actualP10Pos}</Badge>
                            </div>
                            <div className="mt-2 text-danger fw-bold small">+{entry.breakdown.p10Points} PTS</div>
                          </div>
                          <div className="col-md-6 ps-md-4">
                            <small className="text-muted text-uppercase d-block mb-2 fw-bold" style={{ fontSize: '0.65rem' }}>Latest Race: First DNF Bonus</small>
                            <div className="mt-1">
                              {entry.breakdown.dnfPoints > 0 ? (
                                <div className="text-success fw-bold d-flex align-items-center small">
                                  <span className="fs-5 me-2">🏎️💨</span> Correct (+25 PTS)
                                </div>
                              ) : (
                                <div className="text-muted d-flex align-items-center opacity-50 small">
                                  <span className="fs-5 me-2">🏁</span> Incorrect (+0 PTS)
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="season-history">
                        <h4 className="h6 text-uppercase fw-bold text-danger letter-spacing-2 mb-3">Season History</h4>
                        {entry.history && entry.history.length > 0 ? (
                          <div className="table-responsive">
                            <Table variant="dark" size="sm" className="mb-0 extra-small opacity-75">
                              <thead>
                                <tr className="text-muted border-bottom border-secondary">
                                  <th>Race</th>
                                  <th>P10 Pick</th>
                                  <th>DNF Pick</th>
                                  <th className="text-end">PTS</th>
                                  <th className="text-end">Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {entry.history.map((h, idx) => (
                                  <tr key={idx} className="border-bottom border-secondary border-opacity-25">
                                    <td className="py-2">Round {h.round}</td>
                                    <td className="py-2 text-uppercase">
                                      {h.p10Driver.replace(/_/g, ' ')} 
                                      <span className="ms-1 text-muted">(P{h.p10Pos})</span>
                                    </td>
                                    <td className="py-2 text-uppercase">
                                      {h.dnfDriver.replace(/_/g, ' ')}
                                      {h.dnfCorrect ? <span className="ms-1 text-success">✓</span> : <span className="ms-1 text-muted">✗</span>}
                                    </td>
                                    <td className="py-2 text-end fw-bold text-white">+{h.points}</td>
                                    <td className="py-2 text-end text-muted">{h.totalSoFar}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </Table>
                          </div>
                        ) : (
                          <p className="text-muted small mb-0">No history available for this season.</p>
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
