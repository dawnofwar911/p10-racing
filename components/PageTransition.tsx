'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -10 }}
        transition={{ 
          duration: 0.15, 
          ease: "easeOut"
        }}
        className="page-transition-container"
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          flexGrow: 1
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
