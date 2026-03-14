'use client';

import { motion } from 'framer-motion';
import { usePathname } from 'next/navigation';

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    /* 
       ENTRANCE-ONLY TRANSITION
       Removing AnimatePresence and exit animations ensures 
       absolute layout stability and prevents 'double refreshes'.
       This provides a clean, native 'soft-load' feel.
    */
    <motion.div
      key={pathname}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ 
        duration: 0.15, 
        ease: "easeOut" 
      }}
      className="page-transition-wrapper"
    >
      {children}
    </motion.div>
  );
}
