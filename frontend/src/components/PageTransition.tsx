import React from 'react';
import { motion } from 'framer-motion';

interface PageTransitionProps {
  children: React.ReactNode;
  disableMotion?: boolean;
}

export const PageTransition: React.FC<PageTransitionProps> = ({ children, disableMotion = false }) => {
  return (
    <motion.div
      data-testid="page-transition"
      initial={disableMotion ? false : { opacity: 0, y: 10 }}
      animate={disableMotion ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
      exit={disableMotion ? undefined : { opacity: 0, y: -10 }}
      transition={disableMotion ? { duration: 0 } : { duration: 0.25, ease: 'easeOut' }}
      style={{ width: '100%', flex: 1, display: 'flex', flexDirection: 'column' }}
    >
      {children}
    </motion.div>
  );
};
