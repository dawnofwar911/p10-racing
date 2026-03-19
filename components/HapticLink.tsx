'use client';

import React from 'react';
import Link, { LinkProps } from 'next/link';
import { triggerLightHaptic } from '@/lib/utils/haptics';

interface HapticLinkProps extends LinkProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}

/**
 * A wrapper for next/link that triggers a light haptic feedback on click.
 */
export default function HapticLink({ 
  children, 
  onClick, 
  ...props 
}: HapticLinkProps) {

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    triggerLightHaptic();
    if (onClick) onClick(e);
  };

  return (
    <Link {...props} onClick={handleClick}>
      {children}
    </Link>
  );
}
