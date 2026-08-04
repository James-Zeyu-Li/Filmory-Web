import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db/schema';
import { clearSyncDiagnosticEntries, getSyncDiagnosticEntries } from '../services/syncDiagnostics';
import { adjustFilmStock } from '../services/inventoryOperationService';
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
  rpc: vi.fn(),
}));

vi.mock('../services/supabaseClient', () => ({
  supabase: {
    from: supabaseMock.from,
    channel: supabaseMock.channel,
    removeChannel: supabaseMock.removeChannel,
    rpc: supabaseMock.rpc,
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
    clearSyncDiagnosticEntries();
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
    supabaseMock.rpc.mockClear();
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

  it('pushes film-stock metadata without allowing an LWW stock snapshot', async () => {
    await db.syncQueue.add({
      userId: 'user-1',
      tableName: 'filmStocks',
      action: 'upsert',
      recordId: 'film-metadata-1',
      payload: {
        id: 'film-metadata-1',
        userId: 'user-1',
        brand: 'Kodak',
        name: 'Portra 400',
        iso: 400,
        colorType: 'color',
        format: '135',
        isSystem: 0,
        stockCount: 8,
        pricePerRoll: 22.5,
        avatarUrl: 'data:image/webp;base64,cover',
        addedAt: 1782864000000,
      },
      timestamp: 1782864000000,
    });

    await SyncService.push();

    expect(supabaseMock.from).toHaveBeenCalledWith('film_stocks');
    expect(supabaseMock.upsert).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'film-metadata-1',
        price_per_roll: 22.5,
        avatar_url: 'data:image/webp;base64,cover',
      }),
    ]);
    expect(supabaseMock.upsert).toHaveBeenCalledWith([
      expect.not.objectContaining({ stock_count: expect.anything() }),
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

  it('sends inventory operations through RPC and applies the server stock result locally', async () => {
    vi.stubEnv('VITE_ENABLE_SYNC_DEBUG_LOGGING', 'true');
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    try {
      await db.filmStocks.add({
        id: 'film-operation-1',
        userId: 'user-1',
        brand: 'Kodak',
        name: 'Gold 200',
        iso: 200,
        colorType: 'color',
        format: '135',
        isSystem: 0,
        stockCount: 1,
        addedAt: 1782864000000,
      });
      await db.syncQueue.clear();
      await db.syncQueue.add({
        kind: 'operation',
        userId: 'user-1',
        operationId: 'operation-1',
        operationType: 'adjust_film_stock',
        operationPayload: { filmStockId: 'film-operation-1', delta: -1 },
        timestamp: 1782864000000,
      });
      supabaseMock.rpc.mockResolvedValue({
        data: { operationId: 'operation-1', filmStockId: 'film-operation-1', stockCount: 0 },
        error: null,
      });

      await SyncService.push();

      expect(supabaseMock.rpc).toHaveBeenCalledWith('adjust_film_stock', {
        p_operation_id: 'operation-1',
        p_film_stock_id: 'film-operation-1',
        p_delta: -1,
      });
      expect((await db.filmStocks.get('film-operation-1'))?.stockCount).toBe(0);
      expect(await db.syncQueue.count()).toBe(0);
      expect(getSyncDiagnosticEntries()).toContainEqual(expect.objectContaining({
        event: 'inventory_operation_completed',
        operationType: 'adjust_film_stock',
      }));
    } finally {
      debugSpy.mockRestore();
    }
  });

  it('replays a response-lost inventory operation with the same id without applying its delta twice', async () => {
    await db.filmStocks.add({
      id: 'film-idempotent-replay',
      userId: 'user-1',
      brand: 'Kodak',
      name: 'Ultramax 400',
      iso: 400,
      colorType: 'color',
      format: '135',
      isSystem: 0,
      // The local optimistic update has already applied +1.
      stockCount: 11,
      addedAt: 1782864000000,
    });
    // The entity write above is not part of this RPC replay scenario.
    await db.syncQueue.clear();
    const queueItemId = await db.syncQueue.add({
      kind: 'operation',
      userId: 'user-1',
      operationId: 'response-lost-operation',
      operationType: 'adjust_film_stock',
      operationPayload: { filmStockId: 'film-idempotent-replay', delta: 1 },
      timestamp: 1782864000000,
    });
    const serverResults = new Map<string, { operationId: string; filmStockId: string; stockCount: number }>();
    let appliedServerDeltas = 0;
    supabaseMock.rpc.mockImplementation(async (_name: string, args: { p_operation_id: string }) => {
      const existingResult = serverResults.get(args.p_operation_id);
      if (existingResult) return { data: existingResult, error: null };

      appliedServerDeltas += 1;
      const result = {
        operationId: args.p_operation_id,
        filmStockId: 'film-idempotent-replay',
        stockCount: 11,
      };
      serverResults.set(args.p_operation_id, result);
      // Simulate a committed RPC whose network response never reaches the browser.
      throw new Error('Network response lost after Cloud committed the operation.');
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      await expect(SyncService.push()).rejects.toThrow('One or more sync push batches failed.');
      expect(appliedServerDeltas).toBe(1);
      expect(await db.syncQueue.get(queueItemId)).toEqual(expect.objectContaining({
        operationId: 'response-lost-operation',
        failureKind: 'retryable',
      }));

      // Skip the backoff delay only inside this deterministic test.
      await db.syncQueue.update(queueItemId, { nextRetryAt: 0 });
      await SyncService.push();

      expect(supabaseMock.rpc).toHaveBeenCalledTimes(2);
      expect(appliedServerDeltas).toBe(1);
      expect((await db.filmStocks.get('film-idempotent-replay'))?.stockCount).toBe(11);
      expect(await db.syncQueue.get(queueItemId)).toBeUndefined();
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('confirms an unregistered shooting record when Cloud returns null inventory fields', async () => {
    await db.rolls.add({
      id: 'roll-without-stock',
      userId: 'user-1',
      name: 'Found roll',
      cameraIds: [],
      status: 'active',
      addedAt: 1782864000000,
    });
    await db.syncQueue.add({
      kind: 'operation',
      userId: 'user-1',
      operationId: 'unregistered-roll-operation',
      operationType: 'create_roll_with_inventory',
      operationPayload: {
        roll: {
          id: 'roll-without-stock',
          userId: 'user-1',
          name: 'Found roll',
          cameraIds: [],
          status: 'active',
          addedAt: 1782864000000,
        },
        consumeInventory: false,
      },
      timestamp: 1782864000000,
    });
    supabaseMock.rpc.mockResolvedValue({
      data: {
        operationId: 'unregistered-roll-operation',
        rollId: 'roll-without-stock',
        filmStockId: null,
        stockCount: null,
      },
      error: null,
    });

    await SyncService.push();

    expect(supabaseMock.rpc).toHaveBeenCalledWith('create_roll_with_inventory', {
      p_operation_id: 'unregistered-roll-operation',
      p_roll: expect.not.objectContaining({ filmStockId: expect.anything() }),
      p_consume_inventory: false,
      p_ledger: null,
    });
    expect(await db.syncQueue.count()).toBe(0);
    expect(await db.rolls.get('roll-without-stock')).toEqual(expect.not.objectContaining({
      filmStockId: expect.anything(),
    }));
  });

  it('keeps consecutive inventory adjustments as distinct idempotent RPC operations', async () => {
    await db.filmStocks.add({
      id: 'film-operation-2',
      userId: 'user-1',
      brand: 'Kodak',
      name: 'Portra 400',
      iso: 400,
      colorType: 'color',
      format: '135',
      isSystem: 0,
      stockCount: 3,
      addedAt: 1782864000000,
    });
    await db.syncQueue.clear();
    await db.syncQueue.bulkAdd([1, 2, 3].map(offset => ({
      kind: 'operation' as const,
      userId: 'user-1',
      operationId: `operation-${offset}`,
      operationType: 'adjust_film_stock' as const,
      operationPayload: { filmStockId: 'film-operation-2', delta: 1 },
      timestamp: 1782864000000 + offset,
    })));
    supabaseMock.rpc.mockImplementation(async (_name: string, args: { p_operation_id: string }) => ({
      data: {
        operationId: args.p_operation_id,
        filmStockId: 'film-operation-2',
        stockCount: 3 + Number(args.p_operation_id.replace('operation-', '')),
      },
      error: null,
    }));

    await SyncService.push();

    expect(supabaseMock.rpc).toHaveBeenCalledTimes(3);
    expect(supabaseMock.rpc).toHaveBeenNthCalledWith(1, 'adjust_film_stock', expect.objectContaining({ p_operation_id: 'operation-1' }));
    expect(supabaseMock.rpc).toHaveBeenNthCalledWith(2, 'adjust_film_stock', expect.objectContaining({ p_operation_id: 'operation-2' }));
    expect(supabaseMock.rpc).toHaveBeenNthCalledWith(3, 'adjust_film_stock', expect.objectContaining({ p_operation_id: 'operation-3' }));
    expect((await db.filmStocks.get('film-operation-2'))?.stockCount).toBe(6);
    expect(await db.syncQueue.count()).toBe(0);
  });

  it('keeps the optimistic inventory count stable while individual operations are confirmed', async () => {
    await db.filmStocks.add({
      id: 'film-operation-rebase',
      userId: 'user-1',
      brand: 'Kodak',
      name: 'Ultramax 400',
      iso: 400,
      colorType: 'color',
      format: '135',
      isSystem: 0,
      stockCount: 13,
      addedAt: 1782864000000,
    });
    await db.syncQueue.clear();
    await db.syncQueue.bulkAdd([
      {
        kind: 'operation',
        userId: 'user-1',
        operationId: 'inventory-rebase-1',
        operationType: 'adjust_film_stock',
        operationPayload: { filmStockId: 'film-operation-rebase', delta: 1 },
        timestamp: 1782864000001,
      },
      {
        kind: 'operation',
        userId: 'user-1',
        operationId: 'inventory-rebase-2',
        operationType: 'adjust_film_stock',
        operationPayload: { filmStockId: 'film-operation-rebase', delta: 1 },
        timestamp: 1782864000002,
      },
    ]);
    const updateSpy = vi.spyOn(db.filmStocks, 'update');
    supabaseMock.rpc
      .mockResolvedValueOnce({
        data: { operationId: 'inventory-rebase-1', filmStockId: 'film-operation-rebase', stockCount: 12 },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { operationId: 'inventory-rebase-2', filmStockId: 'film-operation-rebase', stockCount: 13 },
        error: null,
      });

    try {
      await SyncService.push();

      const stockWrites = updateSpy.mock.calls
        .filter(([id]) => id === 'film-operation-rebase')
        .map(([, changes]) => (changes as { stockCount?: number }).stockCount);
      expect(stockWrites).toEqual([13, 13]);
      expect((await db.filmStocks.get('film-operation-rebase'))?.stockCount).toBe(13);
      expect(await db.syncQueue.count()).toBe(0);
    } finally {
      updateSpy.mockRestore();
    }
  });

  it('rebases a Cloud film-stock update with local inventory operations that are still pending', async () => {
    const remoteUpdatedAt = new Date(1782864001000).toISOString();
    await db.filmStocks.add({
      id: 'film-pull-rebase',
      userId: 'user-1',
      brand: 'Kodak',
      name: 'Tri-X 400',
      iso: 400,
      colorType: 'bw',
      format: '135',
      isSystem: 0,
      stockCount: 13,
      addedAt: 1782864000000,
    });
    await db.syncQueue.clear();
    await db.syncQueue.add({
      kind: 'operation',
      userId: 'user-1',
      operationId: 'pending-pull-rebase',
      operationType: 'adjust_film_stock',
      operationPayload: { filmStockId: 'film-pull-rebase', delta: 1 },
      timestamp: 1782864000001,
    });
    vi.mocked(localStorage.getItem).mockImplementation((key: string) => (
      key === 'grainfolio_user_id'
        ? 'user-1'
        : key === 'grainfolio_last_sync_user-1'
          ? new Date(0).toISOString()
          : null
    ));
    supabaseMock.from.mockImplementation((tableName: string) => ({
      select: () => ({
        eq: () => ({
          gt: async () => ({
            data: tableName === 'film_stocks'
              ? [{
                id: 'film-pull-rebase',
                user_id: 'user-1',
                brand: 'Kodak',
                name: 'Tri-X 400',
                iso: 400,
                color_type: 'bw',
                format: '135',
                is_system: 0,
                stock_count: 12,
                added_at: 1782864000000,
                updated_at: remoteUpdatedAt,
              }]
              : [],
            error: null,
          }),
        }),
      }),
    }));

    await SyncService.pull();

    expect((await db.filmStocks.get('film-pull-rebase'))?.stockCount).toBe(13);
  });

  it('normalizes a legacy Cloud film stock without added_at', async () => {
    const remoteUpdatedAt = new Date(1782864001000).toISOString();
    vi.mocked(localStorage.getItem).mockImplementation((key: string) => (
      key === 'grainfolio_user_id'
        ? 'user-1'
        : key === 'grainfolio_last_sync_user-1'
          ? new Date(0).toISOString()
          : null
    ));
    supabaseMock.from.mockImplementation((tableName: string) => ({
      select: () => ({
        eq: () => ({
          gt: async () => ({
            data: tableName === 'film_stocks'
              ? [{
                id: 'legacy-film-stock',
                user_id: 'user-1',
                brand: 'Kodak',
                name: 'Gold 200',
                iso: 200,
                color_type: 'color',
                format: '135',
                is_system: 0,
                stock_count: 2,
                added_at: null,
                updated_at: remoteUpdatedAt,
              }]
              : [],
            error: null,
          }),
        }),
      }),
    }));

    await expect(SyncService.pull()).resolves.toEqual({ remoteUserProfileFound: false });
    expect(await db.filmStocks.get('legacy-film-stock')).toEqual(expect.objectContaining({
      addedAt: new Date(remoteUpdatedAt).getTime(),
      stockCount: 2,
    }));
  });

  it('preserves an inventory adjustment queued while Pull is in flight', async () => {
    const remoteUpdatedAt = new Date(1782864001000).toISOString();
    await db.filmStocks.add({
      id: 'film-pull-in-flight',
      userId: 'user-1',
      brand: 'Kodak',
      name: 'Gold 200',
      iso: 200,
      colorType: 'color',
      format: '135',
      isSystem: 0,
      stockCount: 12,
      addedAt: 1782864000000,
    });
    await db.syncQueue.clear();
    vi.mocked(localStorage.getItem).mockImplementation((key: string) => (
      key === 'grainfolio_user_id'
        ? 'user-1'
        : key === 'grainfolio_last_sync_user-1'
          ? new Date(0).toISOString()
          : null
    ));

    let resolveFilmPull: ((value: { data: Record<string, unknown>[]; error: null }) => void) | undefined;
    const filmPullResponse = new Promise<{ data: Record<string, unknown>[]; error: null }>(resolve => {
      resolveFilmPull = resolve;
    });
    supabaseMock.from.mockImplementation((tableName: string) => ({
      select: () => ({
        eq: () => ({
          gt: () => tableName === 'film_stocks'
            ? filmPullResponse
            : Promise.resolve({ data: [], error: null }),
        }),
      }),
    }));

    const pullPromise = SyncService.pull();
    await vi.waitFor(() => expect(resolveFilmPull).toBeTypeOf('function'));
    await adjustFilmStock({ id: 'film-pull-in-flight', userId: 'user-1' }, 1);
    resolveFilmPull?.({
      data: [{
        id: 'film-pull-in-flight',
        user_id: 'user-1',
        brand: 'Kodak',
        name: 'Gold 200',
        iso: 200,
        color_type: 'color',
        format: '135',
        is_system: 0,
        stock_count: 12,
        added_at: 1782864000000,
        updated_at: remoteUpdatedAt,
      }],
      error: null,
    });

    await pullPromise;

    expect((await db.filmStocks.get('film-pull-in-flight'))?.stockCount).toBe(13);
    expect(await db.syncQueue.toArray()).toContainEqual(expect.objectContaining({
      kind: 'operation',
      operationPayload: { filmStockId: 'film-pull-in-flight', delta: 1 },
    }));
  });

  it('marks RLS failures as needing attention and excludes them from automatic retries', async () => {
    await db.syncQueue.add({
      userId: 'user-1',
      tableName: 'cameras',
      action: 'upsert',
      recordId: 'blocked-camera',
      payload: {
        id: 'blocked-camera',
        userId: 'user-1',
        name: 'Blocked camera',
        type: 'film',
        format: '135',
        addedAt: 1782864000000,
      },
      timestamp: 1782864000000,
    });
    supabaseMock.upsert.mockResolvedValueOnce({
      data: null,
      error: { status: 403, code: '42501', message: 'permission denied' },
    });

    await expect(SyncService.push()).rejects.toThrow('One or more sync push batches failed.');

    const queued = await db.syncQueue.where('recordId').equals('blocked-camera').first();
    expect(queued).toEqual(expect.objectContaining({
      attemptCount: 1,
      failureKind: 'needs_attention',
      lastErrorCode: '42501',
      lastErrorMessage: 'permission denied',
    }));
    expect(queued?.nextRetryAt).toBeUndefined();

    supabaseMock.upsert.mockClear();
    await SyncService.push();
    expect(supabaseMock.upsert).not.toHaveBeenCalled();
    await expect(SyncService.getQueueSummary()).resolves.toEqual({
      pendingCount: 0,
      needsAttentionCount: 1,
    });
  });

  it('marks rejected inventory operations as needing attention and preserves the operation', async () => {
    await db.syncQueue.add({
      kind: 'operation',
      userId: 'user-1',
      operationId: 'rejected-stock-adjustment',
      operationType: 'adjust_film_stock',
      operationPayload: { filmStockId: 'film-1', delta: -1 },
      timestamp: 1782864000000,
    });
    supabaseMock.rpc.mockResolvedValueOnce({
      data: null,
      error: { status: 409, code: '23503', message: 'FILM_STOCK_NOT_FOUND' },
    });

    await expect(SyncService.push()).rejects.toThrow('One or more sync push batches failed.');

    const queued = await db.syncQueue.where('operationId').equals('rejected-stock-adjustment').first();
    expect(queued).toEqual(expect.objectContaining({
      kind: 'operation',
      operationType: 'adjust_film_stock',
      operationPayload: { filmStockId: 'film-1', delta: -1 },
      attemptCount: 1,
      failureKind: 'needs_attention',
      lastErrorCode: '23503',
      lastErrorMessage: 'FILM_STOCK_NOT_FOUND',
    }));
    expect(queued?.nextRetryAt).toBeUndefined();

    supabaseMock.rpc.mockClear();
    await SyncService.push();
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it('reopens only legacy missing-RPC inventory operations for a safe retry', async () => {
    await db.syncQueue.bulkAdd([
      {
        kind: 'operation' as const,
        userId: 'user-1',
        operationId: 'legacy-adjustment',
        operationType: 'adjust_film_stock' as const,
        operationPayload: { filmStockId: 'film-operation-1', delta: 1 },
        timestamp: 1782864000000,
        attemptCount: 1,
        failureKind: 'needs_attention' as const,
        lastErrorCode: 'PGRST202',
        lastErrorMessage: 'Could not find the function public.adjust_film_stock(p_delta, p_film_stock_id, p_operation_id) in the schema cache',
        lastAttemptAt: 1782864005000,
      },
      {
        kind: 'operation' as const,
        userId: 'user-1',
        operationId: 'permission-denied-adjustment',
        operationType: 'adjust_film_stock' as const,
        operationPayload: { filmStockId: 'film-operation-1', delta: 1 },
        timestamp: 1782864000001,
        attemptCount: 1,
        failureKind: 'needs_attention' as const,
        lastErrorCode: '42501',
        lastErrorMessage: 'permission denied',
        lastAttemptAt: 1782864005000,
      },
    ]);

    const service = SyncService as unknown as {
      recoverLegacyInventoryRpcFailures: (userId: string) => Promise<number>;
    };

    await expect(service.recoverLegacyInventoryRpcFailures('user-1')).resolves.toBe(1);

    const [reopened, blocked] = await db.syncQueue.orderBy('timestamp').toArray();
    expect(reopened).toEqual(expect.objectContaining({ operationId: 'legacy-adjustment' }));
    expect(reopened?.failureKind).toBeUndefined();
    expect(reopened?.lastErrorCode).toBeUndefined();
    expect(reopened?.lastErrorMessage).toBeUndefined();
    expect(reopened?.attemptCount).toBeUndefined();
    expect(reopened?.recoveryAttemptedAt).toEqual(expect.any(Number));
    expect(blocked).toEqual(expect.objectContaining({
      operationId: 'permission-denied-adjustment',
      failureKind: 'needs_attention',
      lastErrorCode: '42501',
    }));
  });

  it('reopens only known film-stock metadata schema failures once', async () => {
    await db.syncQueue.bulkAdd([
      {
        kind: 'record' as const,
        userId: 'user-1',
        tableName: 'filmStocks',
        action: 'upsert' as const,
        recordId: 'film-metadata-1',
        payload: { id: 'film-metadata-1', userId: 'user-1' },
        timestamp: 1782864000000,
        attemptCount: 1,
        failureKind: 'needs_attention' as const,
        lastErrorCode: 'PGRST204',
        lastErrorMessage: "Could not find the 'price_per_roll' column of 'film_stocks' in the schema cache",
      },
      {
        kind: 'record' as const,
        userId: 'user-1',
        tableName: 'filmStocks',
        action: 'upsert' as const,
        recordId: 'film-unknown-schema-1',
        payload: { id: 'film-unknown-schema-1', userId: 'user-1' },
        timestamp: 1782864000001,
        attemptCount: 1,
        failureKind: 'needs_attention' as const,
        lastErrorCode: 'PGRST204',
        lastErrorMessage: "Could not find the 'unknown_column' column of 'film_stocks' in the schema cache",
      },
    ]);

    const service = SyncService as unknown as {
      recoverFilmStockMetadataSchemaFailures: (userId: string) => Promise<number>;
    };

    await expect(service.recoverFilmStockMetadataSchemaFailures('user-1')).resolves.toBe(1);

    const [reopened, blocked] = await db.syncQueue.orderBy('timestamp').toArray();
    expect(reopened).toEqual(expect.objectContaining({
      recordId: 'film-metadata-1',
      recoveryAttemptedAt: expect.any(Number),
    }));
    expect(reopened?.failureKind).toBeUndefined();
    expect(blocked).toEqual(expect.objectContaining({
      recordId: 'film-unknown-schema-1',
      failureKind: 'needs_attention',
    }));
  });

  it('keeps transient failures queued with exponential retry metadata', async () => {
    const now = 1782864000000;
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(now);
    await db.syncQueue.add({
      userId: 'user-1',
      tableName: 'cameras',
      action: 'upsert',
      recordId: 'retry-camera',
      payload: {
        id: 'retry-camera',
        userId: 'user-1',
        name: 'Retry camera',
        type: 'film',
        format: '135',
        addedAt: now,
      },
      timestamp: now,
    });
    supabaseMock.upsert.mockResolvedValueOnce({
      data: null,
      error: { status: 503, code: 'service_unavailable', message: 'temporary outage' },
    });

    try {
      await expect(SyncService.push()).rejects.toThrow('One or more sync push batches failed.');
      const queued = await db.syncQueue.where('recordId').equals('retry-camera').first();
      expect(queued).toEqual(expect.objectContaining({
        attemptCount: 1,
        failureKind: 'retryable',
        lastErrorCode: 'service_unavailable',
        nextRetryAt: now + 5000,
      }));
      await expect(SyncService.getQueueSummary()).resolves.toEqual({
        pendingCount: 1,
        needsAttentionCount: 0,
      });
    } finally {
      nowSpy.mockRestore();
    }
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

  it('runs the startup sync once when realtime subscribes normally', () => {
    vi.useFakeTimers();
    vi.stubEnv('VITE_ENABLE_SUPABASE_SYNC', 'true');
    vi.stubEnv('VITE_SUPABASE_URL', 'http://127.0.0.1:54321');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'eyJ.local-dev-jwt');

    const syncSpy = vi.spyOn(SyncService, 'sync').mockResolvedValue(undefined);

    try {
      SyncService.start();
      const statusCallback = supabaseMock.subscribe.mock.calls[0]?.[0];
      expect(statusCallback).toEqual(expect.any(Function));

      statusCallback('SUBSCRIBED');
      vi.advanceTimersByTime(0);
      expect(syncSpy).toHaveBeenCalledTimes(1);

      statusCallback('SUBSCRIBED');
      vi.advanceTimersByTime(3_000);
      expect(syncSpy).toHaveBeenCalledTimes(1);
    } finally {
      SyncService.stop();
      syncSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  it('falls back to one startup sync when realtime never reports a status', () => {
    vi.useFakeTimers();
    vi.stubEnv('VITE_ENABLE_SUPABASE_SYNC', 'true');
    vi.stubEnv('VITE_SUPABASE_URL', 'http://127.0.0.1:54321');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'eyJ.local-dev-jwt');

    const syncSpy = vi.spyOn(SyncService, 'sync').mockResolvedValue(undefined);

    try {
      SyncService.start();

      vi.advanceTimersByTime(2_999);
      expect(syncSpy).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      vi.advanceTimersToNextTimer();
      expect(syncSpy).toHaveBeenCalledTimes(1);

      SyncService.stop();
      vi.advanceTimersByTime(3_000);
      expect(syncSpy).toHaveBeenCalledTimes(1);
    } finally {
      SyncService.stop();
      syncSpy.mockRestore();
      vi.useRealTimers();
    }
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
      const statusCallback = supabaseMock.subscribe.mock.calls[0]?.[0];
      expect(statusCallback).toEqual(expect.any(Function));
      statusCallback('SUBSCRIBED');
      vi.advanceTimersByTime(0);
      requestSyncSpy = vi.spyOn(SyncService, 'requestSync').mockImplementation(() => undefined);

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

  it('records immediate requests as one scheduled sync batch without merging inventory operations', () => {
    vi.useFakeTimers();
    vi.stubEnv('VITE_ENABLE_SUPABASE_SYNC', 'true');
    vi.stubEnv('VITE_ENABLE_SYNC_DEBUG_LOGGING', 'true');
    vi.stubEnv('VITE_SUPABASE_URL', 'http://127.0.0.1:54321');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'eyJ.local-dev-jwt');

    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    const syncSpy = vi.spyOn(SyncService, 'sync').mockResolvedValue(undefined);

    try {
      SyncService.start();
      vi.advanceTimersByTime(0);
      syncSpy.mockClear();
      clearSyncDiagnosticEntries();

      for (let index = 0; index < 3; index += 1) {
        window.dispatchEvent(new CustomEvent(LOCAL_CHANGE_EVENT, {
          detail: { intent: 'immediate', source: 'film-stock-adjust' },
        }));
      }
      vi.advanceTimersByTime(0);

      const entries = getSyncDiagnosticEntries();
      expect(entries.filter(entry => entry.event === 'intent_requested' && entry.intent === 'immediate')).toHaveLength(3);
      expect(entries.filter(entry => entry.event === 'timer_replaced')).toHaveLength(2);
      expect(entries).toContainEqual(expect.objectContaining({
        event: 'scheduled',
        intent: 'immediate',
        triggerCount: 3,
      }));
      expect(syncSpy).toHaveBeenCalledTimes(1);
    } finally {
      SyncService.stop();
      syncSpy.mockRestore();
      debugSpy.mockRestore();
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
      const statusCallback = supabaseMock.subscribe.mock.calls[0]?.[0];
      expect(statusCallback).toEqual(expect.any(Function));
      statusCallback('SUBSCRIBED');
      vi.advanceTimersByTime(0);
      requestSyncSpy = vi.spyOn(SyncService, 'requestSync').mockImplementation(() => undefined);

      vi.advanceTimersByTime(60_000);
      expect(requestSyncSpy).not.toHaveBeenCalled();

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
      const secondStatusCallback = supabaseMock.subscribe.mock.calls[1]?.[0];
      expect(secondStatusCallback).toEqual(expect.any(Function));
      secondStatusCallback('SUBSCRIBED');
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
