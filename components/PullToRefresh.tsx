'use client';

import React, { useState, useCallback, useRef } from 'react';
import { motion, useAnimation, PanInfo } from 'framer-motion';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { RefreshCw } from 'lucide-react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
}

export default function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [pullProgress, setPullProgress] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const controls = useAnimation();
  const isDragging = useRef(false);
  const hasTriggeredHaptic = useRef(false);
  
  const PULL_THRESHOLD = 70;
  const PULL_MAX = 110;

  const handlePan = useCallback((_: unknown, info: PanInfo) => {
    if (isRefreshing) return;

    // 1. Get the scrollable container (main)
    const mainElement = document.querySelector('main');
    const scrollTop = mainElement ? mainElement.scrollTop : 0;
    
    // 2. DIRECTIONAL LOCK: If the swipe is more horizontal than vertical, ignore it.
    // This prevents interference with horizontal table scrolling.
    if (!isDragging.current && Math.abs(info.offset.x) > Math.abs(info.offset.y)) {
      return;
    }

    // 3. ONLY allow pulling if we are at the very top and pulling DOWN
    if (scrollTop <= 0 && info.offset.y > 0) {
      // Small dead-zone to ensure it's a deliberate pull
      if (info.offset.y < 10 && !isDragging.current) return;

      isDragging.current = true;
      const progress = Math.min(info.offset.y / PULL_THRESHOLD, 1.5);
      const actualY = Math.min(info.offset.y * 0.5, PULL_MAX);
      
      setPullProgress(progress);
      controls.set({ y: actualY });
      
      // Haptic feedback precisely once when threshold reached
      if (progress >= 1 && !hasTriggeredHaptic.current) {
        Haptics.impact({ style: ImpactStyle.Light });
        hasTriggeredHaptic.current = true;
      } else if (progress < 1) {
        hasTriggeredHaptic.current = false;
      }
    } else if (isDragging.current) {
      // If we were dragging but now scrolling up, reset immediately
      isDragging.current = false;
      setPullProgress(0);
      hasTriggeredHaptic.current = false;
      controls.start({ y: 0 });
    }
  }, [isRefreshing, controls]);

  const handlePanEnd = useCallback(async (_: unknown, info: PanInfo) => {
    const wasDragging = isDragging.current;
    isDragging.current = false;
    hasTriggeredHaptic.current = false;

    if (!wasDragging || isRefreshing) return;

    if (info.offset.y > PULL_THRESHOLD) {
      setIsRefreshing(true);
      setPullProgress(1);
      
      // Animate to refresh position
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
        controls.start({ 
          y: 0,
          transition: { type: 'spring', stiffness: 400, damping: 30 } 
        });
      }
    } else {
      setPullProgress(0);
      controls.start({ 
        y: 0, 
        transition: { type: 'spring', stiffness: 400, damping: 30 } 
      });
    }
  }, [isRefreshing, onRefresh, controls]);

  return (
    <div className="position-relative w-100 flex-grow-1 d-flex flex-column">
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
          zIndex: 1020,
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

      {/* Content Container - Native Scroll Optimized */}
      <motion.div
        onPan={handlePan}
        onPanEnd={handlePanEnd}
        animate={controls}
        className="w-100 flex-grow-1 d-flex flex-column"
        style={{ 
          touchAction: 'pan-x pan-y', // Allow native scrolling in both directions
          minHeight: '100%' 
        }}
      >
        {children}
      </motion.div>
    </div>
  );
}
