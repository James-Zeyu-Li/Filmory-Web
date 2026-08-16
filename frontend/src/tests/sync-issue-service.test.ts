import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db, type FilmStock } from '../db/schema';
import {
  canKeepRollWithoutInventory,
  keepRollWithoutInventory,
  retrySyncIssue,
  undoSyncIssue,
} from '../services/syncIssueService';

const syncEventsMock = vi.hoisted(() => ({ requestImmediateSync: vi.fn(), requestSyncIntent: vi.fn() }));

vi.mock('../services/syncEvents', () => syncEventsMock);

const userId = 'user-1';

const film: FilmStock = {
  id: 'film-1',
  userId,
  brand: 'Kodak',
  name: 'Gold 200',
  iso: 200,
  colorType: 'color',
  format: '135',
  isSystem: 0,
  stockCount: 4,
  addedAt: 1782864000000,
};

const addFailedAdjustment = async () => db.syncQueue.add({
  kind: 'operation',
  userId,
  operationId: 'adjustment-operation-1',
  operationType: 'adjust_film_stock',
  operationPayload: { filmStockId: film.id, delta: 2 },
  timestamp: 1782864000000,
  attemptCount: 1,
  failureKind: 'needs_attention',
  lastErrorCode: '23503',
  lastErrorMessage: 'FILM_STOCK_NOT_FOUND',
  lastAttemptAt: 1782864001000,
});

describe('sync issue recovery service', () => {
  beforeEach(async () => {
    await Promise.all([
      db.filmStocks.clear(),
      db.rolls.clear(),
      db.ledgerTransactions.clear(),
      db.syncQueue.clear(),
    ]);
    syncEventsMock.requestImmediateSync.mockReset();
  });

  it('retries the same inventory operation id and clears only its failure state', async () => {
    const queueItemId = await addFailedAdjustment();

    await retrySyncIssue(queueItemId, userId);

    const operation = await db.syncQueue.get(queueItemId);
    expect(operation).toEqual(expect.objectContaining({
      id: queueItemId,
      operationId: 'adjustment-operation-1',
      operationType: 'adjust_film_stock',
      operationPayload: { filmStockId: film.id, delta: 2 },
    }));
    expect(operation).not.toHaveProperty('failureKind');
    expect(operation).not.toHaveProperty('lastErrorCode');
    expect(await db.syncQueue.count()).toBe(1);
    expect(syncEventsMock.requestImmediateSync).toHaveBeenCalledWith('sync-issue-retry');
  });

  it('retries every failed queue entry for the same ordinary record', async () => {
    const firstId = await db.syncQueue.add({
      userId,
      tableName: 'rolls',
      action: 'upsert',
      recordId: 'roll-1',
      payload: { id: 'roll-1', userId, name: 'Earlier name' },
      timestamp: 1,
      failureKind: 'needs_attention',
      lastErrorCode: 'PGRST204',
    });
    const latestId = await db.syncQueue.add({
      userId,
      tableName: 'rolls',
      action: 'upsert',
      recordId: 'roll-1',
      payload: { id: 'roll-1', userId, name: 'Latest name' },
      timestamp: 2,
      failureKind: 'needs_attention',
      lastErrorCode: 'PGRST204',
    });
    await db.syncQueue.add({
      userId,
      tableName: 'rolls',
      action: 'upsert',
      recordId: 'roll-2',
      payload: { id: 'roll-2', userId, name: 'Other record' },
      timestamp: 3,
      failureKind: 'needs_attention',
      lastErrorCode: 'PGRST204',
    });

    await retrySyncIssue(latestId, userId);

    expect(await db.syncQueue.get(firstId)).not.toHaveProperty('failureKind');
    expect(await db.syncQueue.get(latestId)).not.toHaveProperty('failureKind');
    expect((await db.syncQueue.where('recordId').equals('roll-2').first())?.failureKind).toBe('needs_attention');
    expect(syncEventsMock.requestImmediateSync).toHaveBeenCalledTimes(1);
  });

  it('removes stale local inventory when Cloud reports the film stock is missing', async () => {
    await db.filmStocks.add({ ...film, stockCount: 6 });
    await db.syncQueue.clear();
    const queueItemId = await addFailedAdjustment();

    await undoSyncIssue(queueItemId, userId);

    expect(await db.filmStocks.get(film.id!)).toBeUndefined();
    expect(await db.syncQueue.get(queueItemId)).toBeUndefined();
  });

  it('compensates the local delta when the Cloud rejection does not mean the film is gone', async () => {
    await db.filmStocks.add({ ...film, stockCount: 6 });
    const queueItemId = await db.syncQueue.add({
      kind: 'operation',
      userId,
      operationId: 'permission-rejected-adjustment',
      operationType: 'adjust_film_stock',
      operationPayload: { filmStockId: film.id!, delta: 2 },
      timestamp: 1782864000000,
      failureKind: 'needs_attention',
      lastErrorCode: '42501',
    });

    await undoSyncIssue(queueItemId, userId);

    expect((await db.filmStocks.get(film.id!))?.stockCount).toBe(4);
    expect(await db.syncQueue.get(queueItemId)).toBeUndefined();
  });

  it('undoes a rejected roll creation by restoring stock and deleting local roll and ledger drafts', async () => {
    await db.filmStocks.add({ ...film, stockCount: 3 });
    await db.rolls.add({
      id: 'roll-1',
      userId,
      name: 'Weekend walk',
      cameraIds: [],
      filmStockId: film.id!,
      status: 'active',
      addedAt: 1782864000000,
    });
    await db.ledgerTransactions.add({
      id: 'ledger-1',
      userId,
      amount: -18,
      date: 1782864000000,
      type: 'expense',
      category: 'film',
      relatedEntityId: 'roll-1',
      addedAt: 1782864000000,
    });
    await db.syncQueue.clear();
    const queueItemId = await db.syncQueue.add({
      kind: 'operation',
      userId,
      operationId: 'roll-operation-1',
      operationType: 'create_roll_with_inventory',
      operationPayload: {
        roll: {
          id: 'roll-1',
          userId,
          name: 'Weekend walk',
          cameraIds: [],
          filmStockId: film.id,
          status: 'active',
          addedAt: 1782864000000,
        },
        ledger: {
          id: 'ledger-1',
          userId,
          amount: -18,
          date: 1782864000000,
          type: 'expense',
          category: 'film',
          relatedEntityId: 'roll-1',
          addedAt: 1782864000000,
        },
        consumeInventory: true,
      },
      timestamp: 1782864000000,
      failureKind: 'needs_attention',
      lastErrorCode: '23503',
    });

    await undoSyncIssue(queueItemId, userId);

    expect((await db.filmStocks.get(film.id!))?.stockCount).toBe(4);
    expect(await db.rolls.get('roll-1')).toBeUndefined();
    expect(await db.ledgerTransactions.get('ledger-1')).toBeUndefined();
    expect(await db.syncQueue.count()).toBe(0);
  });

  it('keeps a rejected shooting record without its stale inventory link and reuses the operation id', async () => {
    await db.filmStocks.add({ ...film, stockCount: 3 });
    await db.rolls.add({
      id: 'roll-1', userId, name: 'Weekend walk', cameraIds: [], filmStockId: film.id, status: 'active', addedAt: 1782864000000,
    });
    const queueItemId = await db.syncQueue.add({
      kind: 'operation',
      userId,
      operationId: 'roll-operation-1',
      operationType: 'create_roll_with_inventory',
      operationPayload: {
        roll: {
          id: 'roll-1', userId, name: 'Weekend walk', cameraIds: [], filmStockId: film.id, status: 'active', addedAt: 1782864000000,
        },
        consumeInventory: true,
      },
      timestamp: 1782864000000,
      failureKind: 'needs_attention',
      lastErrorCode: '23503',
    });
    const operation = await db.syncQueue.get(queueItemId);
    expect(operation && 'operationType' in operation && operation.operationType === 'create_roll_with_inventory'
      ? await canKeepRollWithoutInventory(operation, userId)
      : false).toBe(true);

    await keepRollWithoutInventory(queueItemId, userId);

    expect(await db.filmStocks.get(film.id!)).toBeUndefined();
    expect((await db.rolls.get('roll-1'))?.filmStockId).toBeUndefined();
    expect(await db.syncQueue.get(queueItemId)).toEqual(expect.objectContaining({
      id: queueItemId,
      operationId: 'roll-operation-1',
      operationPayload: expect.objectContaining({
        consumeInventory: false,
        roll: expect.not.objectContaining({ filmStockId: expect.anything() }),
      }),
    }));
    expect(syncEventsMock.requestImmediateSync).toHaveBeenCalledWith('sync-issue-keep-roll-without-inventory');
  });

  it('does not offer the unregistered-inventory path after the referenced film stock is gone', async () => {
    const queueItemId = await db.syncQueue.add({
      kind: 'operation',
      userId,
      operationId: 'roll-operation-missing-film',
      operationType: 'create_roll_with_inventory',
      operationPayload: {
        roll: {
          id: 'roll-1', userId, name: 'Weekend walk', cameraIds: [], filmStockId: 'deleted-film', status: 'active', addedAt: 1782864000000,
        },
        consumeInventory: true,
      },
      timestamp: 1782864000000,
      failureKind: 'needs_attention',
    });
    const operation = await db.syncQueue.get(queueItemId);

    expect(operation && 'operationType' in operation && operation.operationType === 'create_roll_with_inventory'
      ? await canKeepRollWithoutInventory(operation, userId)
      : false).toBe(false);
  });
});
