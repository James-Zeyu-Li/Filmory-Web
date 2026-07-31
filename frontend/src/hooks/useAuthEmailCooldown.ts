import { useCallback, useEffect, useState } from 'react';
import {
  getAuthEmailCooldownSeconds,
  startAuthEmailCooldown,
  type AuthEmailCooldownScope,
} from '../services/authEmailCooldown';

export const useAuthEmailCooldown = (scope: AuthEmailCooldownScope, email: string) => {
  const normalizedEmail = email.trim().toLowerCase();
  const [remainingSeconds, setRemainingSeconds] = useState(() => (
    getAuthEmailCooldownSeconds(scope, normalizedEmail)
  ));

  useEffect(() => {
    const updateRemaining = () => {
      setRemainingSeconds(getAuthEmailCooldownSeconds(scope, normalizedEmail));
    };

    updateRemaining();
    if (!normalizedEmail) return undefined;

    const timer = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(timer);
  }, [normalizedEmail, scope]);

  const startCooldown = useCallback((durationMs?: number) => {
    startAuthEmailCooldown(scope, normalizedEmail, durationMs);
    setRemainingSeconds(getAuthEmailCooldownSeconds(scope, normalizedEmail));
  }, [normalizedEmail, scope]);

  return {
    remainingSeconds,
    isCoolingDown: remainingSeconds > 0,
    startCooldown,
  };
};
