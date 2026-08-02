import { createContext } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import type { AccountRole, AuthMode } from '../services/authMode';

export type AuthTransitionMode = 'loggingOut' | 'deletingAccount';

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthTransitioning: boolean;
  authTransitionMode: AuthTransitionMode | null;
  authMode: AuthMode;
  accountRole: AccountRole;
  isAdmin: boolean;
  isDevBypass: boolean;
  isTrial: boolean;
  startTrial: () => void;
  signInMock: () => void;
  logout: () => Promise<void>;
  clearLocalAuthState: () => void;
  completeSignedOutTransition: (mode: AuthTransitionMode) => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
