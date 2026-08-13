import { act, render, screen, waitFor } from '@testing-library/react';
import type { Session, User } from '@supabase/supabase-js';
import { useContext, useEffect } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../contexts/AuthContext';
import { AuthContext } from '../contexts/authContextCore';
import { db } from '../db/schema';
import { supabase } from '../services/supabaseClient';
import { SyncService } from '../services/syncService';

type AuthStateListener = (event: string, session: Session | null) => void;

const signedInUser = {
  id: 'cloud-user-1',
  email: 'photographer@grainfolio.com',
  aud: 'authenticated',
  created_at: new Date(0).toISOString(),
  app_metadata: {},
  user_metadata: {},
} as User;

const SyncLifecycleProbe = () => {
  const auth = useContext(AuthContext);

  useEffect(() => {
    if (!auth?.user || auth.authMode !== 'supabase') return;
    SyncService.start();
    return () => SyncService.stop();
  }, [auth?.authMode, auth?.user]);

  return (
    <div>
      <span>{auth?.user?.id ?? 'signed-out'}</span>
      <button type="button" onClick={auth?.signInMock}>Use dev bypass</button>
    </div>
  );
};

describe('Auth sync startup', () => {
  let authStateListener: AuthStateListener | undefined;
  let storage: Map<string, string>;
  const mockedAuth = supabase.auth as unknown as {
    getSession: ReturnType<typeof vi.fn>;
    onAuthStateChange: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    storage = new Map();
    authStateListener = undefined;

    vi.mocked(localStorage.getItem).mockImplementation(key => storage.get(key) ?? null);
    vi.mocked(localStorage.setItem).mockImplementation((key, value) => {
      storage.set(key, value);
    });
    vi.mocked(localStorage.removeItem).mockImplementation(key => {
      storage.delete(key);
    });

    mockedAuth.getSession.mockResolvedValue({ data: { session: null } });
    mockedAuth.onAuthStateChange.mockImplementation((listener: AuthStateListener) => {
      authStateListener = listener;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });

    vi.spyOn(db.userProfiles, 'get').mockResolvedValue(undefined);
    vi.spyOn(db.userProfiles, 'put').mockResolvedValue(signedInUser.id);
  });

  it('starts cloud sync after a sign-in without requiring a page refresh', async () => {
    const startedWithUserIds: Array<string | null> = [];
    const startSpy = vi.spyOn(SyncService, 'start').mockImplementation(() => {
      startedWithUserIds.push(localStorage.getItem('grainfolio_user_id'));
    });
    vi.spyOn(SyncService, 'stop').mockImplementation(() => undefined);

    render(
      <AuthProvider>
        <SyncLifecycleProbe />
      </AuthProvider>
    );

    await screen.findByText('signed-out');
    expect(authStateListener).toBeDefined();

    act(() => {
      authStateListener?.('SIGNED_IN', { user: signedInUser } as Session);
    });

    await waitFor(() => {
      expect(screen.getByText(signedInUser.id)).toBeInTheDocument();
      expect(startSpy).toHaveBeenCalledTimes(1);
    });
    expect(startedWithUserIds).toEqual([signedInUser.id]);
  });

  it('does not start cloud sync for the local developer bypass account', async () => {
    const startSpy = vi.spyOn(SyncService, 'start').mockImplementation(() => undefined);
    vi.spyOn(SyncService, 'stop').mockImplementation(() => undefined);

    render(
      <AuthProvider>
        <SyncLifecycleProbe />
      </AuthProvider>
    );

    await screen.findByText('signed-out');
    await act(async () => {
      screen.getByRole('button', { name: 'Use dev bypass' }).click();
    });

    await screen.findByText('mock_uid_123');
    expect(startSpy).not.toHaveBeenCalled();
  });
});
