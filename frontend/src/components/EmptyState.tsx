import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import './EmptyState.css';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  /** Tighter padding/icon size for empty states embedded inside an already-dense
   * page (e.g. a Dashboard sub-section) instead of a full page/tab body. */
  compact?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon: Icon, title, description, action, compact }) => {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={compact ? 'premium-empty-state premium-empty-state--compact' : 'premium-empty-state'}
      initial={reduceMotion || compact ? false : { opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.4, ease: 'easeOut' }}
    >
      <div className="empty-icon-wrapper">
        <Icon size={compact ? 24 : 48} strokeWidth={1.5} />
      </div>
      <h3 className="empty-title">{title}</h3>
      <p className="empty-description">{description}</p>
      {action && <div className="empty-action">{action}</div>}
    </motion.div>
  );
};
