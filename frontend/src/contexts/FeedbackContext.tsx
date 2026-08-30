import React, { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { FeedbackContext, type FeedbackAction, type FeedbackOptions } from './feedbackContextCore';
import { useLanguage } from './useLanguage';

interface FeedbackProviderProps {
  children: ReactNode;
}

type ActiveFeedback = Required<Pick<FeedbackOptions, 'title' | 'type'>> &
  Pick<FeedbackOptions, 'message'> & {
    actions?: FeedbackAction[];
  };

export const FeedbackProvider: React.FC<FeedbackProviderProps> = ({ children }) => {
  const [activeFeedback, setActiveFeedback] = useState<ActiveFeedback | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const { t } = useLanguage();

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const dismiss = () => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setActiveFeedback(null);
  };

  const notify = ({ title, message, type = 'info', durationMs = 3600, actions }: FeedbackOptions) => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
    }
    setActiveFeedback({ title, message, type, actions });
    if (durationMs > 0) {
      timeoutRef.current = window.setTimeout(() => {
        setActiveFeedback(null);
        timeoutRef.current = null;
      }, durationMs);
    } else {
      timeoutRef.current = null;
    }
  };

  const handleAction = (action: FeedbackAction) => {
    action.onClick();
    if (!action.keepOpen) {
      dismiss();
    }
  };

  const icon = activeFeedback?.type === 'success'
    ? <CheckCircle2 size={18} />
    : activeFeedback?.type === 'error'
      ? <AlertCircle size={18} />
      : <Info size={18} />;

  return (
    <FeedbackContext.Provider value={{ notify, dismiss }}>
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
                ? 'var(--danger)'
                : activeFeedback.type === 'success'
                  ? 'var(--success)'
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
            {activeFeedback.actions && activeFeedback.actions.length > 0 && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
                {activeFeedback.actions.map(action => (
                  <button
                    key={action.label}
                    type="button"
                    onClick={() => handleAction(action)}
                    style={{
                      border: action.variant === 'primary' ? '1px solid var(--accent)' : '1px solid var(--border-color)',
                      background: action.variant === 'primary' ? 'var(--accent)' : 'var(--bg-tertiary)',
                      color: action.variant === 'primary' ? '#fff' : 'var(--text-primary)',
                      cursor: 'pointer',
                      borderRadius: '999px',
                      padding: '6px 10px',
                      fontSize: '12px',
                      fontWeight: 700
                    }}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            aria-label={t('feedback.dismiss')}
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
