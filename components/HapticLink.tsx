'use client';

import React from 'react';
import Link, { LinkProps } from 'next/link';
import { triggerLightHaptic, triggerMediumHaptic, triggerHeavyHaptic } from '@/lib/utils/haptics';

interface HapticLinkProps extends LinkProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  hapticStyle?: 'light' | 'medium' | 'heavy';
  suppressHydrationWarning?: boolean;
}

/**
 * A wrapper for next/link that triggers haptic feedback on click.
 */
export default function HapticLink({ 
  children, 
  onClick, 
  hapticStyle = 'light',
  suppressHydrationWarning,
  className,
  ...props 
}: HapticLinkProps) {

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (hapticStyle === 'light') triggerLightHaptic();
    else if (hapticStyle === 'medium') triggerMediumHaptic();
    else if (hapticStyle === 'heavy') triggerHeavyHaptic();
    
    if (onClick) onClick(e);
  };

  return (
    <Link 
      {...props} 
      onClick={handleClick} 
      suppressHydrationWarning={suppressHydrationWarning}
      className={className}
    >
      {children}
    </Link>
  );
}
