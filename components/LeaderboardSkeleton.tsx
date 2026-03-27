import React from 'react';
import { Table } from 'react-bootstrap';

interface SkeletonColumn {
  header: string;
  className?: string;
  width?: string;
  skeletonWidth?: string;
}

interface LeaderboardSkeletonProps {
  columns?: SkeletonColumn[];
  rows?: number;
}

const DEFAULT_COLUMNS: SkeletonColumn[] = [
  { header: 'Pos', className: 'ps-4', width: '60px', skeletonWidth: '20px' },
  { header: 'Player', className: '', skeletonWidth: '60%' },
  { header: 'Last Race', className: 'text-end', skeletonWidth: '40px' },
  { header: 'Total', className: 'text-end pe-4', skeletonWidth: '40px' },
];

const LeaderboardSkeleton: React.FC<LeaderboardSkeletonProps> = ({ 
  columns = DEFAULT_COLUMNS,
  rows = 10 
}) => {
  return (
    <div className="f1-premium-table-container">
      <Table variant="dark" className="f1-premium-table mb-0">
        <thead>
          <tr>
            {columns.map((col, idx) => (
              <th 
                key={idx} 
                className={`${col.className || ''} py-3 border-0`} 
                style={col.width ? { width: col.width } : {}}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...Array(rows)].map((_, rowIndex) => (
            <tr key={rowIndex} className="skeleton-row border-secondary border-opacity-10">
              {columns.map((col, colIndex) => (
                <td key={colIndex} className={col.className || ''}>
                  <div 
                    className={`skeleton-text ${col.className?.includes('text-end') ? 'ms-auto' : ''}`} 
                    style={{ width: col.skeletonWidth || '100%' }} 
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
};

export default LeaderboardSkeleton;
