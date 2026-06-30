import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  style?: React.CSSProperties; // Pass style to modal-content
  overlayStyle?: React.CSSProperties; // Pass style to modal-overlay
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children, style, overlayStyle }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          className="modal-overlay" 
          style={overlayStyle}
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div 
            className="modal-content" 
            style={style}
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", duration: 0.3, bounce: 0.2 }}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
