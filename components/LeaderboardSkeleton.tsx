import React from 'react';
import { Card, Table } from 'react-bootstrap';

const LeaderboardSkeleton: React.FC = () => {
  return (
    <Card className="f1-glass-card border-secondary border-opacity-25 mb-4">
      <Card.Body className="p-0">
        <Table responsive className="leaderboard-table mb-0">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Player</th>
              <th>Points</th>
              <th>Last Race</th>
            </tr>
          </thead>
          <tbody>
            {[...Array(10)].map((_, index) => (
              <tr key={index} className="leaderboard-entry skeleton-row">
                <td>
                  <div className="skeleton-text short" />
                </td>
                <td>
                  <div className="d-flex align-items-center">
                    <div className="skeleton-avatar" />
                    <div className="skeleton-text long ms-2" />
                  </div>
                </td>
                <td>
                  <div className="skeleton-text medium" />
                </td>
                <td>
                  <div className="skeleton-text short" />
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
        <div className="d-flex justify-content-center p-3">
          <div className="skeleton-button" data-testid="skeleton-button" />
        </div>
      </Card.Body>
    </Card>
  );
};

export default LeaderboardSkeleton;
