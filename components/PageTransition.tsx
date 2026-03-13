'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial={{ opacity: 0, x: 8 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -8 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        className="page-transition-container"
      >
        <div className="d-flex flex-column flex-grow-1" style={{ minHeight: '100%' }}>
          {children}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
