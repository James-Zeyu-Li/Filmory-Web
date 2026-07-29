import React, { useCallback, useEffect, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseClient';
import { AuthContext } from './authContextCore';
import { db } from '../db/schema';
import {
  createDevBypassUser,
  DEV_BYPASS_USER_ID,
  getConfiguredEmailRole,
  getMetadataRole,
  isDevBypassEnabled,
  type AccountRole,
  type AuthMode,
} from '../services/authMode';
import { SyncService } from '../services/syncService';
import { clearWorkspaceTabPreferences } from '../services/workspacePreferences';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>('supabase');
  const [accountRole, setAccountRole] = useState<AccountRole>('user');
  const [isLoading, setIsLoading] = useState(true);

  const persistDevBypassProfile = useCallback(async () => {
    const existingProfile = await db.userProfiles.get(DEV_BYPASS_USER_ID);
    await db.userProfiles.put({
      id: DEV_BYPASS_USER_ID,
      userId: DEV_BYPASS_USER_ID,
      tier: existingProfile?.tier ?? 'vip',
      role: 'admin',
      highResQuotaUsed: existingProfile?.highResQuotaUsed ?? 0,
      membershipRequestStatus: existingProfile?.membershipRequestStatus,
      membershipRequestedAt: existingProfile?.membershipRequestedAt,
      membershipContactEmail: existingProfile?.membershipContactEmail,
      membershipRequestNote: existingProfile?.membershipRequestNote,
      membershipRequestSource: existingProfile?.membershipRequestSource,
      updatedAt: Date.now(),
    });
  }, []);

  const resolveAccountRole = useCallback(async (nextUser: User | null): Promise<AccountRole> => {
    if (!nextUser) return 'user';
    const localProfile = await db.userProfiles.get(nextUser.id);
    if (localProfile?.role === 'admin') return 'admin';

    const metadataRole = getMetadataRole(nextUser);
    if (metadataRole === 'admin') return 'admin';

    return getConfiguredEmailRole(nextUser.email);
  }, []);

  const applyAuthState = useCallback(async (nextSession: Session | null, nextMode: AuthMode) => {
    const nextUser = nextMode === 'dev-bypass' ? createDevBypassUser() : nextSession?.user || null;
    const nextRole = nextMode === 'dev-bypass' ? 'admin' : await resolveAccountRole(nextUser);

    setSession(nextMode === 'dev-bypass' ? null : nextSession);
    setUser(nextUser);
    setAuthMode(nextMode);
    setAccountRole(nextRole);

    if (nextUser) {
      localStorage.setItem('filmory_user_id', nextUser.id);
    } else {
      localStorage.removeItem('filmory_user_id');
      localStorage.removeItem('filmory_dev_auth_bypass');
    }

    if (nextMode === 'dev-bypass') {
      persistDevBypassProfile().catch(error => {
        console.warn('Failed to persist dev bypass profile', error);
      });
    }

    setIsLoading(false);
  }, [persistDevBypassProfile, resolveAccountRole]);

  useEffect(() => {
    // Check active session on mount.
    // Wrap in a 5-second timeout so the app never hangs as a white screen
    // when Supabase is unreachable (e.g. no local Docker, no network).
    const SESSION_TIMEOUT_MS = 5000;
    const sessionTimeout = new Promise<{ data: { session: null } }>(resolve =>
      setTimeout(() => resolve({ data: { session: null } }), SESSION_TIMEOUT_MS)
    );

    Promise.race([supabase.auth.getSession(), sessionTimeout]).then(({ data: { session } }) => {
      if (!session) {
        // Handle local dev bypass persistence. This is never enabled for production builds.
        const localUid = localStorage.getItem('filmory_user_id');
        const wantsDevBypass = localStorage.getItem('filmory_dev_auth_bypass') === 'true';
        if (isDevBypassEnabled() && wantsDevBypass && localUid === DEV_BYPASS_USER_ID) {
          applyAuthState(null, 'dev-bypass');
          return;
        }
      }

      applyAuthState(session, 'supabase');
    });

    // Listen for changes on auth state (sign in, sign out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!session) {
          const localUid = localStorage.getItem('filmory_user_id');
          const wantsDevBypass = localStorage.getItem('filmory_dev_auth_bypass') === 'true';
          if (isDevBypassEnabled() && wantsDevBypass && localUid === DEV_BYPASS_USER_ID) return;
        }

        applyAuthState(session, 'supabase');
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [applyAuthState]);

  // Temporary mock signin for development if Supabase keys aren't set yet
  const signInMock = () => {
    if (!isDevBypassEnabled()) return;
    const mockUser = createDevBypassUser();
    localStorage.setItem('filmory_dev_auth_bypass', 'true');
    localStorage.setItem('filmory_user_id', mockUser.id);
    setSession(null);
    setUser(mockUser);
    setAuthMode('dev-bypass');
    setAccountRole('admin');
    setIsLoading(false);
    persistDevBypassProfile().catch(error => {
      console.warn('Failed to persist dev bypass profile', error);
    });
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.warn("Real signout failed, clearing local auth state", error);
    } finally {
      SyncService.stop();
      setUser(null);
      setSession(null);
      setAuthMode('supabase');
      setAccountRole('user');
      clearWorkspaceTabPreferences();
      localStorage.removeItem('filmory_user_id');
      localStorage.removeItem('filmory_dev_auth_bypass');
    }
  };

  const value = {
    user,
    session,
    isLoading,
    authMode,
    accountRole,
    isAdmin: accountRole === 'admin',
    isDevBypass: authMode === 'dev-bypass',
    signInMock,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {!isLoading && children}
    </AuthContext.Provider>
  );
};
