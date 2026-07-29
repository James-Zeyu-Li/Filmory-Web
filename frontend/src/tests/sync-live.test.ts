import { createClient } from '@supabase/supabase-js';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { db as dbType } from '../db/schema';
import type { supabase as supabaseType } from '../services/supabaseClient';
import type { SyncService as syncServiceType } from '../services/syncService';

const runLiveTests = process.env.RUN_SYNC_LIVE_TESTS === '1';

const localSupabaseUrl = process.env.SYNC_SUPABASE_URL || 'http://127.0.0.1:54321';
const localServiceRoleKey = process.env.SYNC_SUPABASE_SERVICE_ROLE_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const describeLive = runLiveTests ? describe : describe.skip;

vi.unmock('../services/supabaseClient');

describeLive('Live Supabase sync integration', () => {
  let db: typeof dbType;
  let supabase: typeof supabaseType;
  let SyncService: typeof syncServiceType;
  const admin = createClient(localSupabaseUrl, localServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let userId = '';
  let email = '';
  const password = 'Strongpass1';

  beforeAll(async () => {
    vi.resetModules();
    db = (await import('../db/schema')).db;
    supabase = (await import('../services/supabaseClient')).supabase;
    SyncService = (await import('../services/syncService')).SyncService;
  });

  beforeEach(async () => {
    SyncService.stop();
    await db.delete();
    await db.open();
    const localStore = new Map<string, string>();
    vi.mocked(localStorage.getItem).mockImplementation((key: string) => localStore.get(key) ?? null);
    vi.mocked(localStorage.setItem).mockImplementation((key: string, value: string) => {
      localStore.set(key, value);
    });
    vi.mocked(localStorage.removeItem).mockImplementation((key: string) => {
      localStore.delete(key);
    });
    vi.mocked(localStorage.clear).mockImplementation(() => {
      localStore.clear();
    });
    localStorage.clear();

    const stamp = Date.now();
    email = `sync-live-${stamp}@filmory.test`;
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    expect(created.error).toBeNull();
    userId = created.data.user?.id || '';
    expect(userId).toBeTruthy();

    const signedIn = await supabase.auth.signInWithPassword({ email, password });
    expect(signedIn.error).toBeNull();

    localStorage.setItem('filmory_user_id', userId);
  });

  afterEach(async () => {
    SyncService.stop();
    await supabase.auth.signOut();
    if (userId) {
      await admin.from('cameras').delete().eq('user_id', userId);
      await admin.auth.admin.deleteUser(userId);
    }
    await db.delete();
    localStorage.clear();
  });

  it('pushes a local queued camera to Supabase and pulls remote changes back to Dexie', async () => {
    const cameraId = crypto.randomUUID();
    const initialCamera = {
      id: cameraId,
      userId,
      name: 'Live Sync Camera',
      type: 'film' as const,
      format: '135',
      addedAt: Date.now(),
    };

    await db.cameras.put(initialCamera);
    await db.syncQueue.add({
      userId,
      tableName: 'cameras',
      action: 'upsert',
      recordId: cameraId,
      payload: initialCamera,
      timestamp: Date.now(),
    });

    await SyncService.push();

    const pushed = await admin
      .from('cameras')
      .select('id, user_id, name, type, format')
      .eq('id', cameraId)
      .eq('user_id', userId)
      .single();

    expect(pushed.error).toBeNull();
    expect(pushed.data?.name).toBe('Live Sync Camera');
    await expect(db.syncQueue.count()).resolves.toBe(0);

    const remoteUpdate = await admin
      .from('cameras')
      .update({
        name: 'Live Sync Camera Remote Edit',
        updated_at: new Date(Date.now() + 1000).toISOString(),
      })
      .eq('id', cameraId)
      .eq('user_id', userId);

    expect(remoteUpdate.error).toBeNull();
    localStorage.setItem(`filmory_last_sync_${userId}`, new Date(0).toISOString());

    await SyncService.pull();

    const localCamera = await db.cameras.get(cameraId);
    expect(localCamera?.name).toBe('Live Sync Camera Remote Edit');
  }, 20000);
});
