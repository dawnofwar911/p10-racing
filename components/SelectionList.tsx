'use client';

import React from 'react';
import { Driver } from '@/lib/types';

interface SelectionListProps {
  type: 'p10' | 'dnf';
  currentPick: string;
  onSelect: (id: string) => void;
  drivers: Driver[];
  driverForm?: Record<string, { pos: number, status: string }[]>;
  isHighlighted?: boolean;
}

const SelectionList: React.FC<SelectionListProps> = ({ 
  type, 
  currentPick, 
  onSelect, 
  drivers, 
  driverForm = {}, 
  isHighlighted = false 
}) => {
  const sortedByTeam = [...drivers].sort((a, b) => {
    if (a.teamId < b.teamId) return -1;
    if (a.teamId > b.teamId) return 1;
    return b.points - a.points;
  });

  return (
    <div className={`mx-auto w-100 h-100 p-3 rounded transition-all ${isHighlighted ? 'f1-focus-glow' : ''}`} style={{ maxWidth: '500px', border: isHighlighted ? 'none' : '1px solid transparent' }}>
      <h3 className={`h6 mb-3 border-start border-4 border-${type === 'p10' ? 'danger' : 'warning'} ps-2 fw-bold text-uppercase letter-spacing-1`}>
        {type === 'p10' ? 'P10 Finisher' : 'First DNF'}
      </h3>
      <div className="driver-list-scroll px-1" style={{ maxHeight: '60vh', overflowY: 'auto', overscrollBehavior: 'contain', paddingBottom: '80px' }}>
        {sortedByTeam.map((driver) => {
          const form = driverForm[driver.id] || [];
          return (
            <div key={`${type}-${driver.id}`} className={`d-flex align-items-center p-2 mb-2 rounded-pill border transition-all cursor-pointer ${currentPick === driver.id ? 'border-danger bg-danger bg-opacity-20 shadow-sm' : 'border-secondary border-opacity-25 bg-dark bg-opacity-50'}`} onClick={() => onSelect(driver.id)}>
              <div className="driver-number ms-3 me-3 text-white fw-bold d-flex align-items-center" style={{ width: '35px' }}>
                <span style={{ fontSize: '1.1rem', opacity: 0.8 }}>{driver.number}</span>
              </div>
              <div className="flex-grow-1 d-flex align-items-center">
                <div className="f1-driver-line me-3" style={{ backgroundColor: driver.color }}></div>
                <div className="text-truncate">
                  <div className="fw-bold text-white small text-truncate">{driver.name}</div>
                  <div className="d-flex align-items-center gap-2">
                    <div className="extra-small text-uppercase fw-bold text-muted opacity-75" style={{ fontSize: '0.55rem' }}>{driver.team}</div>
                    {form.length > 0 && (
                      <div className="d-flex gap-1 ms-1">
                        {form.map((f, i) => {
                          const isDNF = f.status.toLowerCase() !== 'finished' && !f.status.toLowerCase().includes('lap');
                          const isPoints = !isDNF && f.pos <= 10;
                          return (
                            <div 
                              key={i} 
                              className={`rounded-circle d-flex align-items-center justify-content-center text-white fw-bold`}
                              style={{ 
                                width: '12px', 
                                height: '12px', 
                                fontSize: '0.45rem',
                                backgroundColor: isDNF ? '#dc3545' : (isPoints ? '#198754' : '#6c757d')
                              }}
                              title={isDNF ? f.status : `P${f.pos}`}
                            >
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {currentPick === driver.id && <div className="text-danger me-3 fw-bold">✓</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SelectionList;
