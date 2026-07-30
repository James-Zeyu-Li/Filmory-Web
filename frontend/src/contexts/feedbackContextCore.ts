import { createContext } from 'react';

export type FeedbackType = 'success' | 'error' | 'info';

export interface FeedbackAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
  keepOpen?: boolean;
}

export interface FeedbackOptions {
  title: string;
  message?: string;
  type?: FeedbackType;
  durationMs?: number;
  actions?: FeedbackAction[];
}

export interface FeedbackContextType {
  notify: (options: FeedbackOptions) => void;
  dismiss: () => void;
}

export const FeedbackContext = createContext<FeedbackContextType | undefined>(undefined);
