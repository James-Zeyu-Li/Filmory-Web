import React, { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { FeedbackContext, type FeedbackOptions } from './feedbackContextCore';

interface FeedbackProviderProps {
  children: ReactNode;
}

type ActiveFeedback = Required<Pick<FeedbackOptions, 'title' | 'type'>> &
  Pick<FeedbackOptions, 'message'>;

export const FeedbackProvider: React.FC<FeedbackProviderProps> = ({ children }) => {
  const [activeFeedback, setActiveFeedback] = useState<ActiveFeedback | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const notify = ({ title, message, type = 'info', durationMs = 3600 }: FeedbackOptions) => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
    }
    setActiveFeedback({ title, message, type });
    timeoutRef.current = window.setTimeout(() => {
      setActiveFeedback(null);
      timeoutRef.current = null;
    }, durationMs);
  };

  const dismiss = () => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setActiveFeedback(null);
  };

  const icon = activeFeedback?.type === 'success'
    ? <CheckCircle2 size={18} />
    : activeFeedback?.type === 'error'
      ? <AlertCircle size={18} />
      : <Info size={18} />;

  return (
    <FeedbackContext.Provider value={{ notify }}>
      {children}
      {activeFeedback && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            right: '20px',
            bottom: '20px',
            zIndex: 12000,
            maxWidth: '360px',
            padding: '14px 16px',
            borderRadius: '14px',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px'
          }}
        >
          <div
            style={{
              color: activeFeedback.type === 'error'
                ? 'var(--danger-color, #ef4444)'
                : activeFeedback.type === 'success'
                  ? 'var(--success-color, #22c55e)'
                  : 'var(--accent)'
            }}
          >
            {icon}
          </div>
          <div style={{ flex: 1 }}>
            <strong style={{ display: 'block', fontSize: '14px' }}>{activeFeedback.title}</strong>
            {activeFeedback.message && (
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>
                {activeFeedback.message}
              </p>
            )}
          </div>
          <button
            type="button"
            aria-label="关闭提示"
            onClick={dismiss}
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: 0
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </FeedbackContext.Provider>
  );
};
