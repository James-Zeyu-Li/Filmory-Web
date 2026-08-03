import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db/schema';
import { SyncService } from '../services/syncService';
import { LOCAL_CHANGE_EVENT } from '../services/syncEvents';

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

const waitForQueuedRecord = async (recordId: string) => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const queued = await db.syncQueue.where('recordId').equals(recordId).first();
    if (queued) return queued;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error(`Timed out waiting for sync queue record ${recordId}`);
};

describe('SyncService schema parity', () => {
  beforeEach(async () => {
    SyncService.stop();
    await db.syncQueue.clear();
    localStorage.clear();
    vi.mocked(localStorage.getItem).mockImplementation((key: string) => (
      key === 'grainfolio_user_id' ? 'user-1' : null
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

  it('queues records written inside business transactions that do not include syncQueue', async () => {
    const cameraId = 'transaction-camera-1';

    await db.transaction('rw', db.cameras, db.ledgerTransactions, async () => {
      await db.cameras.add({
        id: cameraId,
        userId: 'user-1',
        name: 'Transaction Camera',
        type: 'film',
        format: '135',
        addedAt: 1782864000000,
      });
    });

    const queued = await waitForQueuedRecord(cameraId);
    expect(queued).toEqual(expect.objectContaining({
      userId: 'user-1',
      tableName: 'cameras',
      action: 'upsert',
      recordId: cameraId,
      payload: expect.objectContaining({
        name: 'Transaction Camera',
      }),
    }));
  });

  it('omits undefined optional fields so Supabase defaults remain intact', async () => {
    await db.syncQueue.add({
      userId: 'user-1',
      tableName: 'cameras',
      action: 'upsert',
      recordId: 'camera-with-default-back-type',
      payload: {
        id: 'camera-with-default-back-type',
        userId: 'user-1',
        name: 'Default Back Type Camera',
        type: 'film',
        format: '135',
        cameraSystemId: undefined,
        backType: undefined,
        addedAt: 1782864000000,
      },
      timestamp: 1782864000000,
    });

    await SyncService.push();

    expect(supabaseMock.from).toHaveBeenCalledWith('cameras');
    expect(supabaseMock.upsert).toHaveBeenCalledWith([
      expect.not.objectContaining({
        camera_system_id: expect.anything(),
        back_type: expect.anything(),
      }),
    ]);
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
        membershipContactEmail: 'member@grainfolio.app',
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
        membership_contact_email: 'member@grainfolio.app',
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

    expect(supabaseMock.channel).toHaveBeenCalledWith('grainfolio-user-user-1');
    expect(supabaseMock.on).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({
        schema: 'public',
        table: 'cameras',
        filter: 'user_id=eq.user-1',
      }),
      expect.any(Function)
    );
    expect(supabaseMock.subscribe).toHaveBeenCalledWith(expect.any(Function));

    unsubscribe?.();
    expect(supabaseMock.removeChannel).toHaveBeenCalled();
  });

  it('uses a visible-page fallback only while realtime is unavailable', () => {
    vi.useFakeTimers();
    vi.stubEnv('VITE_ENABLE_SUPABASE_SYNC', 'true');
    vi.stubEnv('VITE_SUPABASE_URL', 'http://127.0.0.1:54321');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'eyJ.local-dev-jwt');

    const originalVisibilityState = Object.getOwnPropertyDescriptor(document, 'visibilityState');
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });

    let requestSyncSpy: ReturnType<typeof vi.spyOn> | undefined;

    try {
      SyncService.start();
      vi.advanceTimersByTime(0);
      requestSyncSpy = vi.spyOn(SyncService, 'requestSync').mockImplementation(() => undefined);

      const statusCallback = supabaseMock.subscribe.mock.calls[0]?.[0];
      expect(statusCallback).toEqual(expect.any(Function));

      vi.advanceTimersByTime(60_000);
      expect(requestSyncSpy).not.toHaveBeenCalled();

      for (const status of ['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED']) {
        statusCallback(status, new Error(status));
        expect(requestSyncSpy).toHaveBeenCalledWith('realtime-unavailable', 0);
        requestSyncSpy.mockClear();

        vi.advanceTimersByTime(60_000);
        expect(requestSyncSpy).toHaveBeenCalledWith('visible-fallback-poll', 0);
        requestSyncSpy.mockClear();
      }

      statusCallback('SUBSCRIBED');
      expect(requestSyncSpy).toHaveBeenCalledWith('realtime-subscribed', 0);
      requestSyncSpy.mockClear();

      vi.advanceTimersByTime(60_000);
      expect(requestSyncSpy).not.toHaveBeenCalled();
    } finally {
      SyncService.stop();
      requestSyncSpy?.mockRestore();
      if (originalVisibilityState) {
        Object.defineProperty(document, 'visibilityState', originalVisibilityState);
      } else {
        delete (document as { visibilityState?: DocumentVisibilityState }).visibilityState;
      }
      vi.useRealTimers();
    }
  });

  it('debounces ordinary local edits into one sync after 500ms', () => {
    vi.useFakeTimers();
    vi.stubEnv('VITE_ENABLE_SUPABASE_SYNC', 'true');
    vi.stubEnv('VITE_SUPABASE_URL', 'http://127.0.0.1:54321');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'eyJ.local-dev-jwt');

    const syncSpy = vi.spyOn(SyncService, 'sync').mockResolvedValue(undefined);

    try {
      SyncService.start();
      vi.runOnlyPendingTimers();
      syncSpy.mockClear();

      window.dispatchEvent(new CustomEvent(LOCAL_CHANGE_EVENT));
      window.dispatchEvent(new CustomEvent(LOCAL_CHANGE_EVENT));

      vi.advanceTimersByTime(499);
      expect(syncSpy).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(syncSpy).toHaveBeenCalledTimes(1);
    } finally {
      SyncService.stop();
      syncSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  it('wakes sync immediately after an explicit submission without waiting for the edit debounce', () => {
    vi.useFakeTimers();
    vi.stubEnv('VITE_ENABLE_SUPABASE_SYNC', 'true');
    vi.stubEnv('VITE_SUPABASE_URL', 'http://127.0.0.1:54321');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'eyJ.local-dev-jwt');

    const syncSpy = vi.spyOn(SyncService, 'sync').mockResolvedValue(undefined);

    try {
      SyncService.start();
      vi.advanceTimersByTime(0);
      syncSpy.mockClear();

      window.dispatchEvent(new CustomEvent(LOCAL_CHANGE_EVENT, {
        detail: { intent: 'immediate', source: 'roll-create' },
      }));

      expect(syncSpy).not.toHaveBeenCalled();
      vi.advanceTimersByTime(0);
      expect(syncSpy).toHaveBeenCalledTimes(1);
    } finally {
      SyncService.stop();
      syncSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  it('coalesces several immediate submissions into one sync cycle', () => {
    vi.useFakeTimers();
    vi.stubEnv('VITE_ENABLE_SUPABASE_SYNC', 'true');
    vi.stubEnv('VITE_SUPABASE_URL', 'http://127.0.0.1:54321');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'eyJ.local-dev-jwt');

    const syncSpy = vi.spyOn(SyncService, 'sync').mockResolvedValue(undefined);

    try {
      SyncService.start();
      vi.advanceTimersByTime(0);
      syncSpy.mockClear();

      for (const source of ['camera-save', 'film-stock-save', 'roll-create']) {
        window.dispatchEvent(new CustomEvent(LOCAL_CHANGE_EVENT, {
          detail: { intent: 'immediate', source },
        }));
      }

      vi.advanceTimersByTime(0);
      expect(syncSpy).toHaveBeenCalledTimes(1);
    } finally {
      SyncService.stop();
      syncSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  it('starts fallback polling only after realtime reports an unavailable state', () => {
    vi.useFakeTimers();
    vi.stubEnv('VITE_ENABLE_SUPABASE_SYNC', 'true');
    vi.stubEnv('VITE_SUPABASE_URL', 'http://127.0.0.1:54321');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'eyJ.local-dev-jwt');

    const originalVisibilityState = Object.getOwnPropertyDescriptor(document, 'visibilityState');
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });

    let requestSyncSpy: ReturnType<typeof vi.spyOn> | undefined;

    try {
      SyncService.start();
      vi.advanceTimersByTime(0);
      requestSyncSpy = vi.spyOn(SyncService, 'requestSync').mockImplementation(() => undefined);

      vi.advanceTimersByTime(60_000);
      expect(requestSyncSpy).not.toHaveBeenCalled();

      const statusCallback = supabaseMock.subscribe.mock.calls[0]?.[0];
      statusCallback('TIMED_OUT', new Error('timeout'));
      expect(requestSyncSpy).toHaveBeenCalledWith('realtime-unavailable', 0);
      requestSyncSpy.mockClear();

      vi.advanceTimersByTime(60_000);
      expect(requestSyncSpy).toHaveBeenCalledWith('visible-fallback-poll', 0);

      requestSyncSpy.mockClear();
      SyncService.stop();
      vi.advanceTimersByTime(60_000);
      expect(requestSyncSpy).not.toHaveBeenCalled();
    } finally {
      SyncService.stop();
      requestSyncSpy?.mockRestore();
      if (originalVisibilityState) {
        Object.defineProperty(document, 'visibilityState', originalVisibilityState);
      } else {
        delete (document as { visibilityState?: DocumentVisibilityState }).visibilityState;
      }
      vi.useRealTimers();
    }
  });

  it('pulls before pushing when a user has no sync watermark', async () => {
    vi.stubEnv('VITE_ENABLE_SUPABASE_SYNC', 'true');
    vi.stubEnv('VITE_SUPABASE_URL', 'http://127.0.0.1:54321');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'eyJ.local-dev-jwt');

    const pullSpy = vi.spyOn(SyncService, 'pull').mockResolvedValue({ remoteUserProfileFound: true });
    const pushSpy = vi.spyOn(SyncService, 'push').mockResolvedValue(undefined);

    try {
      await SyncService.sync();

      expect(pullSpy).toHaveBeenCalledWith({ preferRemoteUserProfile: true });
      expect(pushSpy).toHaveBeenCalledTimes(1);
      expect(pullSpy.mock.invocationCallOrder[0]).toBeLessThan(pushSpy.mock.invocationCallOrder[0]);
    } finally {
      pullSpy.mockRestore();
      pushSpy.mockRestore();
    }
  });

  it('pushes before pulling after a user watermark exists', async () => {
    vi.stubEnv('VITE_ENABLE_SUPABASE_SYNC', 'true');
    vi.stubEnv('VITE_SUPABASE_URL', 'http://127.0.0.1:54321');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'eyJ.local-dev-jwt');
    vi.mocked(localStorage.getItem).mockImplementation((key: string) => (
      key === 'grainfolio_user_id' ? 'user-1' : key === 'grainfolio_last_sync_user-1' ? new Date(0).toISOString() : null
    ));

    const pullSpy = vi.spyOn(SyncService, 'pull').mockResolvedValue({ remoteUserProfileFound: false });
    const pushSpy = vi.spyOn(SyncService, 'push').mockResolvedValue(undefined);

    try {
      await SyncService.sync();

      expect(pushSpy).toHaveBeenCalledTimes(1);
      expect(pullSpy).toHaveBeenCalledWith();
      expect(pushSpy.mock.invocationCallOrder[0]).toBeLessThan(pullSpy.mock.invocationCallOrder[0]);
    } finally {
      pullSpy.mockRestore();
      pushSpy.mockRestore();
    }
  });

  it('syncs immediately on page or network recovery and ignores stale realtime channels', () => {
    vi.useFakeTimers();
    vi.stubEnv('VITE_ENABLE_SUPABASE_SYNC', 'true');
    vi.stubEnv('VITE_SUPABASE_URL', 'http://127.0.0.1:54321');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'eyJ.local-dev-jwt');

    const syncSpy = vi.spyOn(SyncService, 'sync').mockResolvedValue(undefined);
    const originalVisibilityState = Object.getOwnPropertyDescriptor(document, 'visibilityState');
    let visibilityState: DocumentVisibilityState = 'visible';

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibilityState,
    });

    try {
      SyncService.start();
      vi.advanceTimersByTime(0);
      syncSpy.mockClear();

      const firstStatusCallback = supabaseMock.subscribe.mock.calls[0]?.[0];
      firstStatusCallback('TIMED_OUT', new Error('timeout'));
      vi.advanceTimersByTime(0);
      syncSpy.mockClear();

      document.dispatchEvent(new Event('visibilitychange'));
      vi.advanceTimersByTime(0);
      expect(syncSpy).toHaveBeenCalledTimes(1);

      syncSpy.mockClear();
      window.dispatchEvent(new Event('online'));
      vi.advanceTimersByTime(0);
      expect(syncSpy).toHaveBeenCalledTimes(1);

      syncSpy.mockClear();
      visibilityState = 'hidden';
      document.dispatchEvent(new Event('visibilitychange'));
      vi.advanceTimersByTime(60_000);
      expect(syncSpy).not.toHaveBeenCalled();

      visibilityState = 'visible';
      document.dispatchEvent(new Event('visibilitychange'));
      vi.advanceTimersByTime(0);
      expect(syncSpy).toHaveBeenCalledTimes(1);

      syncSpy.mockClear();
      vi.mocked(localStorage.getItem).mockImplementation((key: string) => (
        key === 'grainfolio_user_id' ? 'user-2' : null
      ));
      SyncService.start();
      vi.advanceTimersByTime(0);
      syncSpy.mockClear();

      firstStatusCallback('TIMED_OUT', new Error('stale channel'));
      vi.advanceTimersByTime(60_000);
      expect(syncSpy).not.toHaveBeenCalled();

      SyncService.stop();
      window.dispatchEvent(new Event('online'));
      window.dispatchEvent(new CustomEvent('grainfolio-sync-request'));
      document.dispatchEvent(new Event('visibilitychange'));
      vi.advanceTimersByTime(60_000);

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
