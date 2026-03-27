'use client';

import React from 'react';
import { Button, ButtonProps } from 'react-bootstrap';
import { useHaptics, HapticType } from '@/lib/hooks/use-haptics';

interface HapticButtonProps extends ButtonProps {
  haptic?: HapticType;
  children: React.ReactNode;
}

export default function HapticButton({ 
  haptic = 'light', 
  onClick, 
  children, 
  ...props 
}: HapticButtonProps) {
  const { triggerHaptic } = useHaptics();
  
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    triggerHaptic(haptic);
    if (onClick) onClick(e);
  };

  return (
    <Button {...props} onClick={handleClick}>
      {children}
    </Button>
  );
}
