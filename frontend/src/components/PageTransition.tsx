import React from 'react';
import { motion } from 'framer-motion';

interface PageTransitionProps {
  children: React.ReactNode;
  disableMotion?: boolean;
  /**
   * Both route groups render as a direct child of `#root`, which is itself
   * `display: flex` (row) — so this wrapper always needs `width: 100%; flex: 1 1
   * auto` to stretch across it; skipping that entirely leaves it shrink-to-fit
   * its content, squeezing the page into the left edge instead of spanning the
   * viewport. Authenticated views additionally live inside `.app-main-content`'s
   * column layout and need this wrapper to also establish its own flex column
   * (`display: flex; flex-direction: column`) to fill that. Public pages
   * (Landing, Auth) manage their own internal layout on their own root element
   * and don't need the wrapper to add a second flex-column context — only the
   * `display`/`flexDirection` part is skipped for them. Default true preserves
   * existing callers' behavior.
   */
  fill?: boolean;
}

export const PageTransition: React.FC<PageTransitionProps> = ({ children, disableMotion = false, fill = true }) => {
  // The vertical slide (translateY) promotes this element to its own compositor
  // layer for the duration it's animated. That's harmless for authenticated views,
  // but public pages (Landing, Auth) have an absolutely-positioned back link nested
  // deep inside that measurably (if by a fraction of a pixel) shifts under that
  // layer promotion. A plain opacity fade avoids the transform entirely, so
  // `fill={false}` callers get a clean fade instead of a fade + slide.
  const motionProps = fill
    ? {
        initial: disableMotion ? false : { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        exit: disableMotion ? undefined : { opacity: 0, y: -10 },
      }
    : {
        initial: disableMotion ? false : { opacity: 0 },
        animate: { opacity: 1 },
        exit: disableMotion ? undefined : { opacity: 0 },
      };

  return (
    <motion.div
      data-testid="page-transition"
      {...motionProps}
      transition={disableMotion ? { duration: 0 } : { duration: 0.25, ease: 'easeOut' }}
      style={fill
        ? { width: '100%', flex: 1, display: 'flex', flexDirection: 'column' }
        : { width: '100%', flex: '1 1 auto' }
      }
    >
      {children}
    </motion.div>
  );
};
