import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import type { AuthTransitionMode } from './authContextCore';
import {
  buildLocalUserProfile,
  hasUserProfileSemanticChanges,
  resolveUserProfileDisplayName,
} from '../services/userProfile';
import { ensureTrialDefaultTheme } from '../services/themePreference';
import { migrateTrialDataToUser } from '../services/trialDataMigration';
import { clearPasswordRecoveryIntent } from '../services/authFlow';

const DEV_AUTH_STORAGE_KEY = 'grainfolio_dev_auth_bypass';
const TRIAL_AUTH_STORAGE_KEY = 'grainfolio_trial_auth';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>('supabase');
  const [accountRole, setAccountRole] = useState<AccountRole>('user');
  const [isLoading, setIsLoading] = useState(true);
  const [authTransitionMode, setAuthTransitionMode] = useState<AuthTransitionMode | null>(null);
  const authTransitionTimerRef = useRef<number | null>(null);

  const clearLocalAuthState = useCallback(() => {
    SyncService.stop();
    clearPasswordRecoveryIntent();
    setUser(null);
    setSession(null);
    setAuthMode('supabase');
    setAccountRole('user');
    clearWorkspaceTabPreferences();
    localStorage.removeItem('grainfolio_user_id');
    localStorage.removeItem(DEV_AUTH_STORAGE_KEY);
    localStorage.removeItem(TRIAL_AUTH_STORAGE_KEY);
  }, []);

  const clearAuthTransitionTimer = useCallback(() => {
    if (authTransitionTimerRef.current !== null) {
      window.clearTimeout(authTransitionTimerRef.current);
      authTransitionTimerRef.current = null;
    }
  }, []);

  const clearAuthTransitionState = useCallback(() => {
    clearAuthTransitionTimer();
    setAuthTransitionMode(null);
  }, [clearAuthTransitionTimer]);

  const completeSignedOutTransition = useCallback((mode: AuthTransitionMode) => {
    clearAuthTransitionTimer();
    setAuthTransitionMode(mode);
    clearLocalAuthState();
    authTransitionTimerRef.current = window.setTimeout(() => {
      setAuthTransitionMode(null);
      authTransitionTimerRef.current = null;
    }, mode === 'deletingAccount' ? 1400 : 240);
  }, [clearAuthTransitionTimer, clearLocalAuthState]);

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

    const nextProfile = buildLocalUserProfile({
      userId: nextUser.id,
      role: nextRole,
      existingProfile: profileForBuild,
      displayName,
    });

    if (hasUserProfileSemanticChanges(existingProfile, nextProfile)) {
      await db.userProfiles.put(nextProfile);
    }
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
    const shouldCarryTrialData = (
      nextMode === 'supabase' &&
      Boolean(nextUser?.id) &&
      localStorage.getItem(TRIAL_AUTH_STORAGE_KEY) === 'true' &&
      localStorage.getItem('grainfolio_user_id') === TRIAL_USER_ID
    );

    if (shouldCarryTrialData && nextUser?.id) {
      const migrationResult = await migrateTrialDataToUser(nextUser.id);
      if (migrationResult === 'target-has-data') {
        console.info('Skipped trial data carry-over because the target account already has local data.');
      }
    }

    // App starts cloud sync from the authenticated React state. Persist this first so
    // SyncService.start() never observes an authenticated user without a local user id.
    const currentLocalUserId = localStorage.getItem('grainfolio_user_id');
    if (currentLocalUserId && currentLocalUserId !== nextUser?.id) {
      SyncService.stop();
    }

    if (nextUser) {
      localStorage.setItem('grainfolio_user_id', nextUser.id);
      if (nextMode === 'supabase') {
        localStorage.removeItem(DEV_AUTH_STORAGE_KEY);
        localStorage.removeItem(TRIAL_AUTH_STORAGE_KEY);
      }
    } else {
      localStorage.removeItem('grainfolio_user_id');
      localStorage.removeItem(DEV_AUTH_STORAGE_KEY);
      localStorage.removeItem(TRIAL_AUTH_STORAGE_KEY);
    }

    setSession(nextMode === 'dev-bypass' || nextMode === 'trial' ? null : nextSession);
    setUser(nextUser);
    setAuthMode(nextMode);
    setAccountRole(nextRole);

    if (nextUser) {
      clearAuthTransitionState();
    }

    if (nextUser) {
      await persistLocalUserProfile(nextUser, nextRole, nextMode);
    }
    setIsLoading(false);
  }, [clearAuthTransitionState, persistLocalUserProfile, resolveAccountRole]);

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
        const localUid = localStorage.getItem('grainfolio_user_id');
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
          const localUid = localStorage.getItem('grainfolio_user_id');
          const wantsTrial = localStorage.getItem(TRIAL_AUTH_STORAGE_KEY) === 'true';
          if (wantsTrial && localUid === TRIAL_USER_ID) return;

          const wantsDevBypass = localStorage.getItem(DEV_AUTH_STORAGE_KEY) === 'true';
          if (isDevBypassEnabled() && wantsDevBypass && localUid === DEV_BYPASS_USER_ID) return;
        }

        applyAuthState(session, 'supabase');
      }
    );

    return () => {
      clearAuthTransitionTimer();
      subscription.unsubscribe();
    };
  }, [applyAuthState, clearAuthTransitionTimer]);

  // Temporary mock signin for development if Supabase keys aren't set yet
  const signInMock = () => {
    if (!isDevBypassEnabled()) return;
    const mockUser = createDevBypassUser();
    clearAuthTransitionState();
    localStorage.setItem(DEV_AUTH_STORAGE_KEY, 'true');
    localStorage.removeItem(TRIAL_AUTH_STORAGE_KEY);
    localStorage.setItem('grainfolio_user_id', mockUser.id);
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
    ensureTrialDefaultTheme();
    clearAuthTransitionState();
    localStorage.setItem(TRIAL_AUTH_STORAGE_KEY, 'true');
    localStorage.removeItem(DEV_AUTH_STORAGE_KEY);
    localStorage.setItem('grainfolio_user_id', trialUser.id);
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
    clearAuthTransitionTimer();
    setAuthTransitionMode('loggingOut');
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.warn("Real signout failed, clearing local auth state", error);
    } finally {
      completeSignedOutTransition('loggingOut');
    }
  };

  const value = {
    user,
    session,
    isLoading,
    isAuthTransitioning: authTransitionMode !== null,
    authTransitionMode,
    authMode,
    accountRole,
    isAdmin: accountRole === 'admin',
    isDevBypass: authMode === 'dev-bypass',
    isTrial: authMode === 'trial',
    startTrial,
    signInMock,
    logout,
    clearLocalAuthState,
    completeSignedOutTransition,
  };

  return (
    <AuthContext.Provider value={value}>
      {!isLoading && children}
    </AuthContext.Provider>
  );
};
