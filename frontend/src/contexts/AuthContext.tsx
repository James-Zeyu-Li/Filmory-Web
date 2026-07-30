import React, { useCallback, useEffect, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseClient';
import { AuthContext } from './authContextCore';
import { db } from '../db/schema';
import {
  createTrialUser,
  createDevBypassUser,
  DEV_BYPASS_USER_ID,
  getConfiguredEmailRole,
  getMetadataRole,
  isDevBypassEnabled,
  type AccountRole,
  type AuthMode,
} from '../services/authMode';
import { TRIAL_USER_ID } from '../services/trialPolicy';
import { SyncService } from '../services/syncService';
import { clearWorkspaceTabPreferences } from '../services/workspacePreferences';
import {
  buildLocalUserProfile,
  resolveUserProfileDisplayName,
} from '../services/userProfile';

const DEV_AUTH_STORAGE_KEY = 'filmory_dev_auth_bypass';
const TRIAL_AUTH_STORAGE_KEY = 'filmory_trial_auth';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>('supabase');
  const [accountRole, setAccountRole] = useState<AccountRole>('user');
  const [isLoading, setIsLoading] = useState(true);

  const persistLocalUserProfile = useCallback(async (
    nextUser: User,
    nextRole: AccountRole,
    nextMode: AuthMode
  ) => {
    const existingProfile = await db.userProfiles.get(nextUser.id);
    const displayName = resolveUserProfileDisplayName({
      user: nextUser,
      existingProfile,
      nextDisplayName: nextMode === 'dev-bypass' && !existingProfile?.displayName
        ? 'Developer'
        : nextMode === 'trial' && !existingProfile?.displayName
          ? 'Trial User'
          : undefined,
    });
    const profileForBuild = nextMode !== 'dev-bypass'
      ? existingProfile
      : existingProfile
        ? { ...existingProfile, tier: existingProfile.tier ?? 'vip' }
        : {
            id: nextUser.id,
            userId: nextUser.id,
            tier: 'vip' as const,
            role: nextRole,
            highResQuotaUsed: 0,
            updatedAt: new Date().getTime(),
          };

    await db.userProfiles.put(buildLocalUserProfile({
      userId: nextUser.id,
      role: nextRole,
      existingProfile: profileForBuild,
      displayName,
    }));
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
    const nextUser = nextMode === 'dev-bypass'
      ? createDevBypassUser()
      : nextMode === 'trial'
        ? createTrialUser()
        : nextSession?.user || null;
    const nextRole = nextMode === 'dev-bypass' ? 'admin' : await resolveAccountRole(nextUser);

    setSession(nextMode === 'dev-bypass' || nextMode === 'trial' ? null : nextSession);
    setUser(nextUser);
    setAuthMode(nextMode);
    setAccountRole(nextRole);

    if (nextUser) {
      await persistLocalUserProfile(nextUser, nextRole, nextMode);
    }

    if (nextUser) {
      localStorage.setItem('filmory_user_id', nextUser.id);
      if (nextMode === 'supabase') {
        localStorage.removeItem(DEV_AUTH_STORAGE_KEY);
        localStorage.removeItem(TRIAL_AUTH_STORAGE_KEY);
      }
    } else {
      localStorage.removeItem('filmory_user_id');
      localStorage.removeItem(DEV_AUTH_STORAGE_KEY);
      localStorage.removeItem(TRIAL_AUTH_STORAGE_KEY);
    }
    setIsLoading(false);
  }, [persistLocalUserProfile, resolveAccountRole]);

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
        const wantsTrial = localStorage.getItem(TRIAL_AUTH_STORAGE_KEY) === 'true';
        if (wantsTrial && localUid === TRIAL_USER_ID) {
          applyAuthState(null, 'trial');
          return;
        }

        const wantsDevBypass = localStorage.getItem(DEV_AUTH_STORAGE_KEY) === 'true';
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
          const wantsTrial = localStorage.getItem(TRIAL_AUTH_STORAGE_KEY) === 'true';
          if (wantsTrial && localUid === TRIAL_USER_ID) return;

          const wantsDevBypass = localStorage.getItem(DEV_AUTH_STORAGE_KEY) === 'true';
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
    localStorage.setItem(DEV_AUTH_STORAGE_KEY, 'true');
    localStorage.removeItem(TRIAL_AUTH_STORAGE_KEY);
    localStorage.setItem('filmory_user_id', mockUser.id);
    setSession(null);
    setUser(mockUser);
    setAuthMode('dev-bypass');
    setAccountRole('admin');
    setIsLoading(false);
    persistLocalUserProfile(mockUser, 'admin', 'dev-bypass').catch(error => {
      console.warn('Failed to persist local dev bypass profile', error);
    });
  };

  const startTrial = () => {
    const trialUser = createTrialUser();
    localStorage.setItem(TRIAL_AUTH_STORAGE_KEY, 'true');
    localStorage.removeItem(DEV_AUTH_STORAGE_KEY);
    localStorage.setItem('filmory_user_id', trialUser.id);
    setSession(null);
    setUser(trialUser);
    setAuthMode('trial');
    setAccountRole('user');
    setIsLoading(false);
    persistLocalUserProfile(trialUser, 'user', 'trial').catch(error => {
      console.warn('Failed to persist local trial profile', error);
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
      localStorage.removeItem(DEV_AUTH_STORAGE_KEY);
      localStorage.removeItem(TRIAL_AUTH_STORAGE_KEY);
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
    isTrial: authMode === 'trial',
    startTrial,
    signInMock,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {!isLoading && children}
    </AuthContext.Provider>
  );
};
