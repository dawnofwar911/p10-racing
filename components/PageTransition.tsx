'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0, x: 8 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -8 }}
        transition={{ 
          duration: 0.15, 
          ease: [0.33, 1, 0.68, 1] // Native-style easeOut (not spring)
        }}
        className="page-transition-container"
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          flexGrow: 1,
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
          transform: 'translate3d(0,0,0)' // Force GPU acceleration
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
