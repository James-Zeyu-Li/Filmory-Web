import { useContext } from 'react';
import { TrialGateContext } from './trialGateContextCore';

export const useTrialGate = () => {
  const context = useContext(TrialGateContext);
  if (!context) {
    throw new Error('useTrialGate must be used within a TrialGateProvider');
  }
  return context;
};
