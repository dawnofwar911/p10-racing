'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    /* 
       STABLE OUTER WRAPPER 
       This div never leaves the DOM, ensuring the 'flex-grow: 1' 
       remains active and the layout never collapses.
    */
    <div className="flex-grow-1 d-flex flex-column position-relative w-100" style={{ minHeight: '100%' }}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={pathname}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          className="page-transition-container"
          style={{
            display: 'flex',
            flexDirection: 'column',
            flexGrow: 1,
            width: '100%'
          }}
        >
          <div className="d-flex flex-column flex-grow-1 w-100" style={{ minHeight: '100%' }}>
            {children}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
