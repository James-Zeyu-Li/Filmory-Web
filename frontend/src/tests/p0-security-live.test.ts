import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

const runLiveTests = process.env.RUN_P0_LIVE_TESTS === '1';

const localSupabaseUrl = process.env.P0_SUPABASE_URL || 'http://127.0.0.1:54321';
const localAnonKey = process.env.P0_SUPABASE_ANON_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const localServiceRoleKey = process.env.P0_SUPABASE_SERVICE_ROLE_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const describeLive = runLiveTests ? describe : describe.skip;
const storageObjectUrl = (objectPath: string) =>
  `${localSupabaseUrl}/storage/v1/object/grainfolio-assets/${objectPath}`;

describeLive('P0 live Supabase security integration', () => {
  it('enforces private storage, signed URL access, and cross-user read denial', async () => {
    const admin = createClient(localSupabaseUrl, localServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const userA = createClient(localSupabaseUrl, localAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const userB = createClient(localSupabaseUrl, localAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const stamp = Date.now();
    const emailA = `p0-storage-a-${stamp}@grainfolio.test`;
    const emailB = `p0-storage-b-${stamp}@grainfolio.test`;
    const password = 'Password123!';

    const createdA = await admin.auth.admin.createUser({ email: emailA, password, email_confirm: true });
    const createdB = await admin.auth.admin.createUser({ email: emailB, password, email_confirm: true });
    expect(createdA.error).toBeNull();
    expect(createdB.error).toBeNull();

    let objectPath: string | null = null;

    try {
      const signInA = await userA.auth.signInWithPassword({ email: emailA, password });
      const signInB = await userB.auth.signInWithPassword({ email: emailB, password });
      expect(signInA.error).toBeNull();
      expect(signInB.error).toBeNull();

      const userAId = signInA.data.user?.id;
      expect(userAId).toBeTruthy();

      objectPath = `${userAId}/live-test/${stamp}.txt`;
      const userAToken = signInA.data.session?.access_token;
      const userBToken = signInB.data.session?.access_token;
      expect(userAToken).toBeTruthy();
      expect(userBToken).toBeTruthy();

      const upload = await fetch(storageObjectUrl(objectPath), {
        method: 'POST',
        headers: {
          authorization: `Bearer ${userAToken}`,
          apikey: localAnonKey,
          'content-type': 'text/plain',
          'x-upsert': 'true'
        },
        body: 'private-storage-check'
      });
      expect(upload.ok).toBe(true);

      const signed = await userA.storage.from('grainfolio-assets').createSignedUrl(objectPath, 60);
      expect(signed.error).toBeNull();
      expect(signed.data?.signedUrl).toContain('/storage/v1/object/sign/grainfolio-assets/');

      const crossUserSigned = await userB.storage.from('grainfolio-assets').createSignedUrl(objectPath, 60);
      expect(crossUserSigned.error).not.toBeNull();

      const anonDownload = await fetch(storageObjectUrl(objectPath), {
        headers: { apikey: localAnonKey }
      });
      expect(anonDownload.ok).toBe(false);

      const crossUserDownload = await fetch(storageObjectUrl(objectPath), {
        headers: {
          authorization: `Bearer ${userBToken}`,
          apikey: localAnonKey
        }
      });
      expect(crossUserDownload.ok).toBe(false);

    } finally {
      if (objectPath) await admin.storage.from('grainfolio-assets').remove([objectPath]);
      if (createdA.data.user?.id) await admin.auth.admin.deleteUser(createdA.data.user.id);
      if (createdB.data.user?.id) await admin.auth.admin.deleteUser(createdB.data.user.id);
    }
  }, 15000);

  it('allows authenticated delete_user RPC, rejects anon, and cascades user-owned rows', async () => {
    const admin = createClient(localSupabaseUrl, localServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const userClient = createClient(localSupabaseUrl, localAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const anonClient = createClient(localSupabaseUrl, localAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const stamp = Date.now();
    const email = `p0-delete-${stamp}@grainfolio.test`;
    const password = 'Password123!';
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    expect(created.error).toBeNull();

    const userId = created.data.user?.id;
    expect(userId).toBeTruthy();

    try {
      const signedIn = await userClient.auth.signInWithPassword({ email, password });
      expect(signedIn.error).toBeNull();

      const inserted = await userClient.from('cameras').insert({
        id: crypto.randomUUID(),
        user_id: userId,
        name: 'Cascade Check Camera',
        type: 'film',
        format: '135'
      });
      expect(inserted.error).toBeNull();

      const anonDelete = await anonClient.rpc('delete_user');
      expect(anonDelete.error).not.toBeNull();

      const deleteResult = await userClient.rpc('delete_user');
      expect(deleteResult.error).toBeNull();

      const remainingUser = await admin.auth.admin.getUserById(userId!);
      expect(remainingUser.error).not.toBeNull();

      const remainingCameras = await admin
        .from('cameras')
        .select('id')
        .eq('user_id', userId!);
      expect(remainingCameras.error).toBeNull();
      expect(remainingCameras.data).toEqual([]);
    } finally {
      if (userId) await admin.auth.admin.deleteUser(userId);
    }
  }, 15000);
});
