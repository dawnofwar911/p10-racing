import React from 'react';
import HapticButton from './HapticButton';

interface HowToPlayButtonProps {
  onClick: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export const HowToPlayButton: React.FC<HowToPlayButtonProps> = ({ onClick, className, style }) => (
  <HapticButton 
    variant="outline-danger" 
    size="sm" 
    className={`rounded-pill px-3 py-1 d-inline-flex align-items-center justify-content-center border-opacity-25 opacity-75 hover-opacity-100 ${className || ''}`}
    style={{ fontSize: '0.65rem', fontWeight: 'bold', letterSpacing: '1px', ...style }}
    onClick={onClick}
  >
    <span className="me-1 opacity-75">?</span> HOW TO PLAY
  </HapticButton>
);

export default HowToPlayButton;
