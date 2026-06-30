import { createContext } from 'react';

export type FeedbackType = 'success' | 'error' | 'info';

export interface FeedbackOptions {
  title: string;
  message?: string;
  type?: FeedbackType;
  durationMs?: number;
}

export interface FeedbackContextType {
  notify: (options: FeedbackOptions) => void;
}

export const FeedbackContext = createContext<FeedbackContextType | undefined>(undefined);
