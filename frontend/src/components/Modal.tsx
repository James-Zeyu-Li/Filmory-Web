import React, { useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  style?: React.CSSProperties; // Pass style to modal-content
  overlayStyle?: React.CSSProperties; // Pass style to modal-overlay
  portal?: boolean;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children, style, overlayStyle, portal = false }) => {
  const pointerStartedInsideRef = useRef(false);
  const suppressBackdropClickRef = useRef(false);

  const handleOverlayPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    pointerStartedInsideRef.current = event.target !== event.currentTarget;
    suppressBackdropClickRef.current = false;
  };

  const handleOverlayPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (pointerStartedInsideRef.current && event.target === event.currentTarget) {
      suppressBackdropClickRef.current = true;
    }
    pointerStartedInsideRef.current = false;
  };

  const handleOverlayPointerCancel = () => {
    pointerStartedInsideRef.current = false;
    suppressBackdropClickRef.current = false;
  };

  const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const shouldClose = event.target === event.currentTarget && !suppressBackdropClickRef.current;
    suppressBackdropClickRef.current = false;

    if (shouldClose) onClose();
  };

  const modal = (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          className="modal-overlay" 
          style={overlayStyle}
          onPointerDown={handleOverlayPointerDown}
          onPointerUp={handleOverlayPointerUp}
          onPointerCancel={handleOverlayPointerCancel}
          onClick={handleOverlayClick}
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

  return portal && typeof document !== 'undefined' ? createPortal(modal, document.body) : modal;
};
