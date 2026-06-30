import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  width?: string | number;
}

export const Drawer: React.FC<DrawerProps> = ({ isOpen, onClose, children, width = 500 }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          className="drawer-overlay" 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 1000,
            display: 'flex',
            justifyContent: 'flex-end',
            backdropFilter: 'blur(4px)'
          }}
        >
          <motion.div 
            className="drawer-panel" 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            onClick={e => e.stopPropagation()}
            style={{
              width: width,
              maxWidth: '100%',
              backgroundColor: 'var(--bg-primary)',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.1)',
              overflowY: 'auto'
            }}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
