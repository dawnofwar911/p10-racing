'use client';

import React from 'react';
import { Button, ButtonProps } from 'react-bootstrap';
import { triggerLightHaptic, triggerMediumHaptic, triggerHeavyHaptic } from '@/lib/utils/haptics';

interface HapticButtonProps extends ButtonProps {
  hapticStyle?: 'light' | 'medium' | 'heavy';
  children: React.ReactNode;
}

/**
 * A wrapper for react-bootstrap/Button that triggers a haptic impact on click.
 * Defaults to 'light' haptic.
 */
export default function HapticButton({ 
  hapticStyle = 'light', 
  onClick, 
  children, 
  ...props 
}: HapticButtonProps) {
  
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (hapticStyle === 'light') triggerLightHaptic();
    else if (hapticStyle === 'medium') triggerMediumHaptic();
    else if (hapticStyle === 'heavy') triggerHeavyHaptic();
    
    if (onClick) onClick(e);
  };

  return (
    <Button {...props} onClick={handleClick}>
      {children}
    </Button>
  );
}
