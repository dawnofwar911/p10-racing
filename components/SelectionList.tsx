'use client';

import React, { useMemo } from 'react';
import { Driver } from '@/lib/types';
import { isDnfStatus } from '@/lib/api';
import styles from './SelectionList.module.css';

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
  const sortedByTeam = useMemo(() => {
    return [...drivers].sort((a, b) => {
      if (a.teamId < b.teamId) return -1;
      if (a.teamId > b.teamId) return 1;
      return b.points - a.points;
    });
  }, [drivers]);

  return (
    <div className={`mx-auto w-100 h-100 p-3 rounded transition-all ${isHighlighted ? 'f1-focus-glow' : ''} ${styles.selectionContainer} ${isHighlighted ? styles.selectionHighlighted : ''}`}>
      <h3 className={`h6 mb-3 border-start border-4 border-${type === 'p10' ? 'danger' : 'warning'} ps-2 fw-bold text-uppercase letter-spacing-1`}>
        {type === 'p10' ? 'P10 Finisher' : 'First DNF'}
      </h3>
      <div className={`driver-list-scroll px-1 ${styles.scrollContainer}`}>
        {sortedByTeam.map((driver) => {
          const form = driverForm[driver.id] || [];
          return (
            <div 
              key={`${type}-${driver.id}`} 
              data-testid={`driver-card-${type}-${driver.id}`}
              className={`d-flex align-items-center p-2 mb-2 rounded-pill border transition-all cursor-pointer ${currentPick === driver.id ? 'border-danger bg-danger bg-opacity-20 shadow-sm' : 'border-secondary border-opacity-25 bg-dark bg-opacity-50'}`} 
              onClick={() => onSelect(driver.id)}
            >
              <div className={`driver-number ms-3 me-3 text-white fw-bold d-flex align-items-center ${styles.driverNumber}`}>
                <span className={styles.driverNumberText}>{driver.number}</span>
              </div>
              <div className="flex-grow-1 d-flex align-items-center">
                <div className="f1-driver-line me-3" style={{ '--team-color': driver.color } as React.CSSProperties}></div>
                <div className="text-truncate">
                  <div className="fw-bold text-white small text-truncate">{driver.name}</div>
                  <div className="d-flex align-items-center gap-2">
                    <div className={`extra-small text-uppercase fw-bold text-muted opacity-75 text-truncate ${styles.teamName}`}>{driver.team}</div>
                    {form.length > 0 && (
                      <div className="d-flex gap-1 ms-1 flex-shrink-0">
                        {form.map((f, i) => {
                          const status = f.status.toLowerCase();
                          // Use shared isDnfStatus for consistency
                          const isDNF = isDnfStatus(f.status);
                          const isDNS = status.includes('start') || status.includes('withdraw') || status.includes('qualif') || status === 'dns';
                          const isP10 = f.pos === 10;
                          
                          // Label logic: 10, R (Retired), - (DNS/No start), or Pos
                          let label = f.pos.toString();
                          let dotClass = styles.dotDefault;

                          if (isP10) {
                            dotClass = styles.dotP10;
                          } else if (isDNF) {
                            label = 'R';
                            dotClass = styles.dotDNF;
                          } else if (isDNS) {
                            label = '-';
                            dotClass = styles.dotDNS;
                          }

                          return (
                            <div 
                              key={i} 
                              className={`rounded-circle d-flex align-items-center justify-content-center text-white fw-bold ${styles.formDot} ${dotClass}`}
                              title={f.status}
                            >
                              {label}
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
