'use client';

import React from 'react';
import Link, { LinkProps } from 'next/link';
import { useHaptics, HapticType } from '@/lib/hooks/use-haptics';

interface HapticLinkProps extends LinkProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  haptic?: HapticType;
  suppressHydrationWarning?: boolean;
}

export default function HapticLink({ 
  children, 
  onClick, 
  haptic = 'light',
  suppressHydrationWarning,
  className,
  ...props 
}: HapticLinkProps) {
  const { triggerHaptic } = useHaptics();

  return (
    <Link 
      {...props} 
      onClick={(e) => {
        triggerHaptic(haptic);
        if (onClick) onClick(e);
      }} 
      suppressHydrationWarning={suppressHydrationWarning}
      className={`text-decoration-none ${className || ''}`}
    >
      {children}
    </Link>
  );
}
