import { createContext } from 'react';
import type { TrialResourceKey } from '../services/trialPolicy';

export interface TrialGateOptions {
  resource: TrialResourceKey;
  currentCount: number;
}

export interface TrialGateContextType {
  guardTrialResource: (options: TrialGateOptions) => boolean;
  requireRegistration: (resource: TrialResourceKey) => void;
}

export const TrialGateContext = createContext<TrialGateContextType | undefined>(undefined);
