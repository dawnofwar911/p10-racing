'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { triggerLightHaptic } from '@/lib/utils/haptics';
import { RefreshCw } from 'lucide-react';
import { MAIN_SCROLL_CONTAINER_ID } from '@/lib/navigation';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
}

export default function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [pullProgress, setPullProgress] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const controls = useAnimation();
  
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const currentY = useRef(0);
  const isPulling = useRef(false);
  const hasTriggeredHaptic = useRef(false);

  const PULL_THRESHOLD = 70;
  const PULL_MAX = 100;

  useEffect(() => {
    const el = document.getElementById(MAIN_SCROLL_CONTAINER_ID);
    if (!el) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (isRefreshing || el.scrollTop > 5) return;
      startY.current = e.touches[0].pageY;
      isPulling.current = false;
      hasTriggeredHaptic.current = false;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (isRefreshing || el.scrollTop > 5) return;
      
      currentY.current = e.touches[0].pageY;
      const diff = currentY.current - startY.current;

      if (diff > 0) {
        // If we are at the top and pulling down, take control
        isPulling.current = true;
        
        // Prevent browser default pull-to-refresh if possible
        if (e.cancelable) e.preventDefault();

        // Apply resistance (logarithmic-ish feel)
        const y = Math.min(diff * 0.5, PULL_MAX);
        const progress = Math.min(y / PULL_THRESHOLD, 1.2);
        
        setPullProgress(progress);
        controls.set({ y });

        if (progress >= 1 && !hasTriggeredHaptic.current) {
          triggerLightHaptic();
          hasTriggeredHaptic.current = true;
        } else if (progress < 1) {
          hasTriggeredHaptic.current = false;
        }
      }
    };

    const handleTouchEnd = async () => {
      if (!isPulling.current || isRefreshing) return;
      
      const diff = currentY.current - startY.current;
      isPulling.current = false;

      if (diff * 0.5 > PULL_THRESHOLD) {
        setIsRefreshing(true);
        setPullProgress(1);
        
        await controls.start({ 
          y: 60,
          transition: { type: 'spring', stiffness: 400, damping: 30 } 
        });

        try {
          await onRefresh();
        } catch (err) {
          console.error('Refresh failed:', err);
        } finally {
          setIsRefreshing(false);
          setPullProgress(0);
          controls.start({ y: 0, transition: { type: 'spring', stiffness: 400, damping: 30 } });
        }
      } else {
        setPullProgress(0);
        controls.start({ y: 0, transition: { type: 'spring', stiffness: 400, damping: 30 } });
      }
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: false });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd);

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isRefreshing, onRefresh, controls]);

  return (
    <div ref={containerRef} className="ptr-container">
      {/* Refresh Indicator */}
      <motion.div
        style={{
          position: 'absolute',
          top: -45,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1100,
          pointerEvents: 'none',
        }}
        animate={controls}
      >
        <div 
          className="bg-dark border border-secondary border-opacity-50 rounded-circle d-flex align-items-center justify-content-center shadow-lg"
          style={{ 
            width: '40px', 
            height: '40px',
            opacity: pullProgress > 0.1 ? 1 : 0,
            transform: `scale(${Math.min(pullProgress, 1)})`,
            boxShadow: '0 4px 15px rgba(0,0,0,0.5)'
          }}
        >
          <motion.div
            animate={isRefreshing ? { rotate: 360 } : { rotate: pullProgress * 180 }}
            transition={isRefreshing ? { repeat: Infinity, duration: 1, ease: "linear" } : { type: 'spring', stiffness: 200 }}
          >
            <RefreshCw 
              size={20} 
              className={pullProgress >= 1 ? 'text-danger' : 'text-white opacity-50'} 
            />
          </motion.div>
        </div>
      </motion.div>

      {/* Content Container */}
      <motion.div
        animate={controls}
        className="ptr-content"
      >
        {children}
      </motion.div>
    </div>
  );
}
