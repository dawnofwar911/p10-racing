'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    /* 
       GRID STACKING WRAPPER
       Using CSS Grid ensures that both the exiting and entering pages
       occupy the same space, preventing layout collapse or 'bounce'.
    */
    <div className="flex-grow-1 d-grid" style={{ gridTemplateColumns: '1fr', gridTemplateRows: '1fr' }}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={pathname}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ 
            type: "tween", 
            duration: 0.15, 
            ease: "linear" 
          }}
          className="page-transition-container"
          style={{
            gridArea: '1 / 1 / 2 / 1', // Stack elements in the same grid cell
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            flexGrow: 1,
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'translate3d(0,0,0)',
            overflow: 'visible'
          }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
