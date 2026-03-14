'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex-grow-1 d-grid" style={{ gridTemplateColumns: '1fr', gridTemplateRows: '1fr' }}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={pathname}
          initial={{ opacity: 0, scale: 0.995 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.005 }}
          transition={{ 
            type: "tween", 
            duration: 0.12, // Faster for snappier feel
            ease: [0.4, 0, 0.2, 1] // Standard deceleration curve
          }}
          className="page-transition-container"
          style={{
            gridArea: '1 / 1 / 2 / 1',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            flexGrow: 1,
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'translate3d(0,0,0)'
          }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
