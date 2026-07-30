import type { User } from '@supabase/supabase-js';
import { TRIAL_USER_EMAIL, TRIAL_USER_ID } from './trialPolicy';

export type AuthMode = 'supabase' | 'dev-bypass' | 'trial';
export type AccountRole = 'user' | 'admin';

export const DEV_BYPASS_USER_ID = 'mock_uid_123';
export const DEV_BYPASS_EMAIL = 'developer@filmory.app';

export const isDevBypassEnabled = () => (
  import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEV_AUTH !== 'false'
);

export const createDevBypassUser = () => ({
  id: DEV_BYPASS_USER_ID,
  email: DEV_BYPASS_EMAIL,
  aud: 'authenticated',
  created_at: new Date(0).toISOString(),
  app_metadata: {
    provider: 'dev-bypass',
    role: 'admin',
  },
  user_metadata: {
    authMode: 'dev-bypass',
    display_name: 'Developer',
  },
} as User);

export const createTrialUser = () => ({
  id: TRIAL_USER_ID,
  email: TRIAL_USER_EMAIL,
  aud: 'authenticated',
  created_at: new Date(0).toISOString(),
  app_metadata: {
    provider: 'trial',
    role: 'user',
  },
  user_metadata: {
    authMode: 'trial',
    display_name: 'Trial User',
  },
} as User);

export const getMetadataRole = (user: User | null): AccountRole => {
  return user?.app_metadata?.role === 'admin' ? 'admin' : 'user';
};

export const getConfiguredEmailRole = (email?: string): AccountRole => {
  if (!email) return 'user';
  const adminEmails = String(import.meta.env.VITE_ADMIN_EMAILS || '')
    .split(',')
    .map(item => item.trim().toLowerCase())
    .filter(Boolean);

  return adminEmails.includes(email.toLowerCase()) ? 'admin' : 'user';
};
