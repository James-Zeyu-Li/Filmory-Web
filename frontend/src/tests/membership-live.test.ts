import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

const runLiveTests = process.env.RUN_MEMBERSHIP_LIVE_TESTS === '1';

const localSupabaseUrl = process.env.MEMBERSHIP_SUPABASE_URL || 'http://127.0.0.1:54321';
const localAnonKey = process.env.MEMBERSHIP_SUPABASE_ANON_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const localServiceRoleKey = process.env.MEMBERSHIP_SUPABASE_SERVICE_ROLE_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const describeLive = runLiveTests ? describe : describe.skip;

const createSignedInUser = async (admin: ReturnType<typeof createClient>, email: string, password: string) => {
  const client = createClient(localSupabaseUrl, localAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  expect(created.error).toBeNull();

  const signedIn = await client.auth.signInWithPassword({ email, password });
  expect(signedIn.error).toBeNull();
  expect(signedIn.data.user?.id).toBeTruthy();

  return { client, userId: signedIn.data.user!.id };
};

const insertProfile = async (
  client: ReturnType<typeof createClient>,
  userId: string,
  tier: 'regular' | 'vip'
) => {
  const result = await client.from('user_profiles').upsert({
    id: userId,
    user_id: userId,
    tier,
    high_res_quota_used: 0,
  });
  expect(result.error).toBeNull();
};

const insertRoll = async (
  client: ReturnType<typeof createClient>,
  userId: string,
  name: string,
  status: 'active' | 'archived'
) => client.from('rolls').insert({
  id: crypto.randomUUID(),
  user_id: userId,
  name,
  status,
  start_date: Date.now(),
});

describeLive('Membership live Supabase active roll enforcement', () => {
  it('blocks regular users from writing a 6th active roll but allows archived rolls', async () => {
    const admin = createClient(localSupabaseUrl, localServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const stamp = Date.now();
    const password = 'Password123!';
    const { client, userId } = await createSignedInUser(
      admin,
      `membership-regular-${stamp}@filmory.test`,
      password
    );

    try {
      await insertProfile(client, userId, 'regular');

      for (let i = 0; i < 5; i += 1) {
        const inserted = await insertRoll(client, userId, `Regular Active ${i}`, 'active');
        expect(inserted.error).toBeNull();
      }

      const sixthActive = await insertRoll(client, userId, 'Regular Active 6', 'active');
      expect(sixthActive.error).not.toBeNull();
      expect(sixthActive.error?.message).toContain('FREE_ACTIVE_ROLL_LIMIT_REACHED');

      const archived = await insertRoll(client, userId, 'Regular Archived Allowed', 'archived');
      expect(archived.error).toBeNull();
    } finally {
      await admin.auth.admin.deleteUser(userId);
    }
  }, 20000);

  it('allows VIP users to write more than 5 active rolls', async () => {
    const admin = createClient(localSupabaseUrl, localServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const stamp = Date.now();
    const password = 'Password123!';
    const { client, userId } = await createSignedInUser(
      admin,
      `membership-vip-${stamp}@filmory.test`,
      password
    );

    try {
      await insertProfile(client, userId, 'vip');

      for (let i = 0; i < 6; i += 1) {
        const inserted = await insertRoll(client, userId, `VIP Active ${i}`, 'active');
        expect(inserted.error).toBeNull();
      }
    } finally {
      await admin.auth.admin.deleteUser(userId);
    }
  }, 20000);
});
