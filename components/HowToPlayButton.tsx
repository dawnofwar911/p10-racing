import React from 'react';
import { Button } from 'react-bootstrap';

interface HowToPlayButtonProps {
  onClick: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export const HowToPlayButton: React.FC<HowToPlayButtonProps> = ({ onClick, className, style }) => (
  <Button 
    variant="outline-danger" 
    size="sm" 
    className={`rounded-pill px-3 py-1 d-inline-flex align-items-center justify-content-center border-opacity-50 ${className || ''}`}
    style={{ fontSize: '0.65rem', fontWeight: 'bold', letterSpacing: '1px', ...style }}
    onClick={onClick}
  >
    <span className="me-1">?</span> HOW TO PLAY
  </Button>
);

export default HowToPlayButton;
