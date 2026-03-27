import React from 'react';
import { Trophy } from 'lucide-react';

const AchievementsSkeleton: React.FC = () => {
  return (
    <div className="p-3 border-bottom border-secondary border-opacity-25 bg-black bg-opacity-10">
      <div className="d-flex justify-content-between align-items-center mb-2 px-1">
        <span className="text-muted extra-small text-uppercase fw-bold letter-spacing-1">Achievements</span>
        <div className="skeleton-text short" style={{ width: '50px' }} />
      </div>
      <div className="d-flex gap-2 px-1 overflow-hidden">
        {[...Array(5)].map((_, index) => (
          <div 
            key={index}
            className="rounded-circle d-flex align-items-center justify-content-center"
            style={{ 
              width: '32px', 
              height: '32px', 
              backgroundColor: '#333',
              fontSize: '1rem',
              flexShrink: 0,
              border: '1px dashed rgba(255,255,255,0.1)'
            }}
          >
            <Trophy size={14} className="text-white opacity-20" />
          </div>
        ))}
      </div>
    </div>
  );
};

export default AchievementsSkeleton;
