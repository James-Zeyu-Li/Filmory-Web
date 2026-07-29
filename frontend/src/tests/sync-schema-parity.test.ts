import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db/schema';
import { SyncService } from '../services/syncService';

const supabaseMock = vi.hoisted(() => ({
  upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
  update: vi.fn().mockReturnThis(),
  eq: vi.fn().mockResolvedValue({ data: null, error: null }),
  from: vi.fn(),
  channel: vi.fn(),
  removeChannel: vi.fn(),
  on: vi.fn(),
  subscribe: vi.fn(),
}));

vi.mock('../services/supabaseClient', () => ({
  supabase: {
    from: supabaseMock.from,
    channel: supabaseMock.channel,
    removeChannel: supabaseMock.removeChannel,
  },
}));

describe('SyncService schema parity', () => {
  beforeEach(async () => {
    SyncService.stop();
    await db.syncQueue.clear();
    localStorage.clear();
    vi.mocked(localStorage.getItem).mockImplementation((key: string) => (
      key === 'filmory_user_id' ? 'user-1' : null
    ));
    supabaseMock.upsert.mockClear();
    supabaseMock.update.mockClear();
    supabaseMock.eq.mockClear();
    supabaseMock.from.mockClear();
    supabaseMock.channel.mockClear();
    supabaseMock.removeChannel.mockClear();
    supabaseMock.on.mockClear();
    supabaseMock.subscribe.mockClear();
    supabaseMock.from.mockReturnValue({
      upsert: supabaseMock.upsert,
      update: supabaseMock.update,
      eq: supabaseMock.eq,
    });
    supabaseMock.channel.mockReturnValue({
      on: supabaseMock.on.mockReturnThis(),
      subscribe: supabaseMock.subscribe,
    });
    vi.unstubAllEnvs();
  });

  it('pushes collections to the matching Supabase table', async () => {
    await db.syncQueue.add({
      userId: 'user-1',
      tableName: 'collections',
      action: 'upsert',
      recordId: 'collection-1',
      payload: {
        id: 'collection-1',
        userId: 'user-1',
        name: 'Hokkaido',
        date: 1782864000000,
        description: 'Winter trip',
        coverUrl: 'data:image/webp;base64,cover',
        addedAt: 1782864000000,
      },
      timestamp: 1782864000000,
    });

    await SyncService.push();

    expect(supabaseMock.from).toHaveBeenCalledWith('collections');
    expect(supabaseMock.upsert).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'collection-1',
        user_id: 'user-1',
        name: 'Hokkaido',
        cover_url: 'data:image/webp;base64,cover',
        added_at: 1782864000000,
      }),
    ]);
  });

  it('pushes roll cameraIds, lensIds, collectionId, and filmBackId using Supabase snake_case fields', async () => {
    await db.syncQueue.add({
      userId: 'user-1',
      tableName: 'rolls',
      action: 'upsert',
      recordId: 'roll-1',
      payload: {
        id: 'roll-1',
        userId: 'user-1',
        name: 'Roll 1',
        cameraIds: ['camera-1', 'camera-2'],
        lensIds: ['lens-1', 'lens-2'],
        filmBackId: 'back-1',
        filmStockId: 'film-1',
        collectionId: 'collection-1',
        status: 'active',
      },
      timestamp: 1782864000000,
    });

    await SyncService.push();

    expect(supabaseMock.from).toHaveBeenCalledWith('rolls');
    expect(supabaseMock.upsert).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'roll-1',
        user_id: 'user-1',
        camera_ids: ['camera-1', 'camera-2'],
        lens_ids: ['lens-1', 'lens-2'],
        film_back_id: 'back-1',
        film_stock_id: 'film-1',
        collection_id: 'collection-1',
      }),
    ]);
  });

  it('pushes camera systems and film backs to matching Supabase tables', async () => {
    await db.syncQueue.bulkAdd([
      {
        userId: 'user-1',
        tableName: 'cameraSystems',
        action: 'upsert',
        recordId: 'system-1',
        payload: {
          id: 'system-1',
          userId: 'user-1',
          name: 'Hasselblad V',
          mountKey: 'hasselblad-v',
          addedAt: 1782864000000,
        },
        timestamp: 1782864000000,
      },
      {
        userId: 'user-1',
        tableName: 'filmBacks',
        action: 'upsert',
        recordId: 'back-1',
        payload: {
          id: 'back-1',
          userId: 'user-1',
          cameraSystemId: 'system-1',
          name: 'A12 Back',
          format: '120',
          status: 'active',
          addedAt: 1782864000000,
        },
        timestamp: 1782864000001,
      },
    ]);

    await SyncService.push();

    expect(supabaseMock.from).toHaveBeenCalledWith('camera_systems');
    expect(supabaseMock.from).toHaveBeenCalledWith('film_backs');
    expect(supabaseMock.upsert).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'system-1',
        user_id: 'user-1',
        mount_key: 'hasselblad-v',
      }),
    ]);
    expect(supabaseMock.upsert).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'back-1',
        user_id: 'user-1',
        camera_system_id: 'system-1',
      }),
    ]);
  });

  it('pushes lens mountKey using the Supabase mount_key field', async () => {
    await db.syncQueue.add({
      userId: 'user-1',
      tableName: 'lenses',
      action: 'upsert',
      recordId: 'lens-1',
      payload: {
        id: 'lens-1',
        userId: 'user-1',
        name: 'Hasselblad Carl Zeiss Planar 80mm f/2.8 C',
        focalLength: 80,
        maxAperture: 'f/2.8',
        type: 'prime',
        mountKey: 'hasselblad-v',
        addedAt: 1782864000000,
      },
      timestamp: 1782864000000,
    });

    await SyncService.push();

    expect(supabaseMock.from).toHaveBeenCalledWith('lenses');
    expect(supabaseMock.upsert).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'lens-1',
        user_id: 'user-1',
        focal_length: 80,
        max_aperture: 'f/2.8',
        mount_key: 'hasselblad-v',
      }),
    ]);
  });

  it('pushes user profile membership request fields using Supabase snake_case columns', async () => {
    await db.syncQueue.add({
      userId: 'user-1',
      tableName: 'userProfiles',
      action: 'upsert',
      recordId: 'user-1',
      payload: {
        id: 'user-1',
        userId: 'user-1',
        tier: 'regular',
        role: 'user',
        highResQuotaUsed: 0,
        membershipRequestStatus: 'pending',
        membershipRequestedAt: 1782864000000,
        membershipContactEmail: 'member@filmory.app',
        membershipRequestNote: 'Please help me upgrade.',
        membershipRequestSource: 'roll-limit',
        updatedAt: 1782864000000,
      },
      timestamp: 1782864000000,
    });

    await SyncService.push();

    expect(supabaseMock.from).toHaveBeenCalledWith('user_profiles');
    expect(supabaseMock.upsert).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'user-1',
        user_id: 'user-1',
        membership_request_status: 'pending',
        membership_requested_at: 1782864000000,
        membership_contact_email: 'member@filmory.app',
        membership_request_note: 'Please help me upgrade.',
        membership_request_source: 'roll-limit',
      }),
    ]);
  });

  it('keeps App-level Supabase sync disabled unless explicitly enabled with a valid key pair', () => {
    vi.stubEnv('VITE_ENABLE_SUPABASE_SYNC', 'false');
    vi.stubEnv('VITE_SUPABASE_URL', 'http://127.0.0.1:54321');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'sb_publishable_cloud_key');

    expect(SyncService.isAutoSyncEnabled()).toBe(false);
    expect(SyncService.setupRealtimeSubscription()).toBeUndefined();
    expect(supabaseMock.channel).not.toHaveBeenCalled();
  });

  it('subscribes realtime by table with a user_id filter when Supabase sync is explicitly enabled', () => {
    vi.stubEnv('VITE_ENABLE_SUPABASE_SYNC', 'true');
    vi.stubEnv('VITE_SUPABASE_URL', 'http://127.0.0.1:54321');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'eyJ.local-dev-jwt');

    const unsubscribe = SyncService.setupRealtimeSubscription();

    expect(supabaseMock.channel).toHaveBeenCalledWith('filmory-user-user-1');
    expect(supabaseMock.on).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({
        schema: 'public',
        table: 'cameras',
        filter: 'user_id=eq.user-1',
      }),
      expect.any(Function)
    );
    expect(supabaseMock.subscribe).toHaveBeenCalled();

    unsubscribe?.();
    expect(supabaseMock.removeChannel).toHaveBeenCalled();
  });

  it('coalesces local sync requests into a single throttled sync when auto sync is enabled', () => {
    vi.useFakeTimers();
    vi.stubEnv('VITE_ENABLE_SUPABASE_SYNC', 'true');
    vi.stubEnv('VITE_SUPABASE_URL', 'http://127.0.0.1:54321');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'eyJ.local-dev-jwt');

    const syncSpy = vi.spyOn(SyncService, 'sync').mockResolvedValue(undefined);

    try {
      SyncService.start();
      vi.runOnlyPendingTimers();
      syncSpy.mockClear();

      window.dispatchEvent(new CustomEvent('filmory-sync-request'));
      window.dispatchEvent(new CustomEvent('filmory-sync-request'));

      vi.advanceTimersByTime(1499);
      expect(syncSpy).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(syncSpy).toHaveBeenCalledTimes(1);
    } finally {
      SyncService.stop();
      syncSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  it('stops lifecycle listeners and realtime cleanup when sync service stops', () => {
    vi.useFakeTimers();
    vi.stubEnv('VITE_ENABLE_SUPABASE_SYNC', 'true');
    vi.stubEnv('VITE_SUPABASE_URL', 'http://127.0.0.1:54321');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'eyJ.local-dev-jwt');

    const syncSpy = vi.spyOn(SyncService, 'sync').mockResolvedValue(undefined);
    const originalVisibilityState = Object.getOwnPropertyDescriptor(document, 'visibilityState');

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });

    try {
      SyncService.start();
      vi.runOnlyPendingTimers();
      syncSpy.mockClear();

      document.dispatchEvent(new Event('visibilitychange'));
      vi.advanceTimersByTime(400);
      expect(syncSpy).toHaveBeenCalledTimes(1);

      syncSpy.mockClear();
      SyncService.stop();

      window.dispatchEvent(new Event('online'));
      window.dispatchEvent(new CustomEvent('filmory-sync-request'));
      document.dispatchEvent(new Event('visibilitychange'));
      vi.runAllTimers();

      expect(syncSpy).not.toHaveBeenCalled();
      expect(supabaseMock.removeChannel).toHaveBeenCalled();
    } finally {
      SyncService.stop();
      syncSpy.mockRestore();
      if (originalVisibilityState) {
        Object.defineProperty(document, 'visibilityState', originalVisibilityState);
      } else {
        delete (document as { visibilityState?: DocumentVisibilityState }).visibilityState;
      }
      vi.useRealTimers();
    }
  });
});
