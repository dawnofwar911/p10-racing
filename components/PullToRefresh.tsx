'use client';

import React, { useState, useCallback } from 'react';
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
  
  const PULL_THRESHOLD = 80;
  const PULL_MAX = 120;

  const handlePan = useCallback((_: unknown, info: PanInfo) => {
    const mainElement = document.querySelector('main');
    const scrollTop = mainElement ? mainElement.scrollTop : 0;
    
    if (isRefreshing || scrollTop > 0) return;
    
    // Only handle downward pulls starting from the top
    if (info.offset.y > 0) {
      const progress = Math.min(info.offset.y / PULL_THRESHOLD, 1.5);
      const actualY = Math.min(info.offset.y * 0.4, PULL_MAX); // Dampen the pull
      setPullProgress(progress);
      controls.set({ y: actualY });
      
      // Haptic feedback when threshold reached
      if (progress >= 1 && pullProgress < 1) {
        Haptics.impact({ style: ImpactStyle.Light });
      }
    }
  }, [isRefreshing, pullProgress, controls]);

  const handlePanEnd = useCallback(async (_: unknown, info: PanInfo) => {
    const mainElement = document.querySelector('main');
    const scrollTop = mainElement ? mainElement.scrollTop : 0;
    
    if (isRefreshing || scrollTop > 0) return;

    if (info.offset.y > PULL_THRESHOLD) {
      setIsRefreshing(true);
      setPullProgress(1);
      
      // Hold at refresh position
      await controls.start({ 
        y: 60,
        transition: { type: 'spring', stiffness: 300, damping: 30 } 
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
          transition: { type: 'spring', stiffness: 300, damping: 30 } 
        });
      }
    } else {
      setPullProgress(0);
      controls.start({ 
        y: 0, 
        transition: { type: 'spring', stiffness: 300, damping: 30 } 
      });
    }
  }, [isRefreshing, onRefresh, controls]);

  return (
    <div className="position-relative overflow-hidden" style={{ minHeight: '100%' }}>
      {/* Refresh Indicator */}
      <motion.div
        style={{
          position: 'absolute',
          top: -40,
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

      {/* Content Container */}
      <motion.div
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.6}
        onPan={handlePan}
        onPanEnd={handlePanEnd}
        animate={controls}
        className="w-100 h-100"
      >
        {children}
      </motion.div>
    </div>
  );
}
