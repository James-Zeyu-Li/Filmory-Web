import { createContext } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import type { AccountRole, AuthMode } from '../services/authMode';

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  authMode: AuthMode;
  accountRole: AccountRole;
  isAdmin: boolean;
  isDevBypass: boolean;
  isTrial: boolean;
  startTrial: () => void;
  signInMock: () => void;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
