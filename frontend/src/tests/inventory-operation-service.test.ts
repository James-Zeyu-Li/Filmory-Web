import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db/schema';
import { adjustFilmStock, createRollWithInventory } from '../services/inventoryOperationService';

const syncEventsMock = vi.hoisted(() => ({
  requestImmediateSync: vi.fn(),
  requestSyncIntent: vi.fn(),
}));

vi.mock('../services/syncEvents', () => syncEventsMock);

describe('inventory operation outbox', () => {
  beforeEach(async () => {
    await Promise.all([db.rolls.clear(), db.filmStocks.clear(), db.ledgerTransactions.clear(), db.syncQueue.clear()]);
    syncEventsMock.requestImmediateSync.mockReset();
  });

  it('stores roll creation and inventory consumption as one operation', async () => {
    await db.filmStocks.add({
      id: 'film-1',
      userId: 'user-1',
      brand: 'Kodak',
      name: 'Portra 400',
      iso: 400,
      colorType: 'color',
      format: '135',
      isSystem: 0,
      stockCount: 2,
      addedAt: 1782864000000,
    });
    await db.syncQueue.clear();

    await createRollWithInventory({
      roll: {
        id: 'roll-1',
        userId: 'user-1',
        name: 'Weekend walk',
        cameraIds: ['camera-1'],
        filmStockId: 'film-1',
        status: 'active',
        startDate: 1782864000000,
      },
      ledger: {
        id: 'ledger-1',
        userId: 'user-1',
        amount: -20,
        date: 1782864000000,
        type: 'expense',
        category: 'film',
        relatedEntityId: 'roll-1',
        notes: 'Consumed Kodak Portra 400',
        addedAt: 1782864000000,
      },
    });

    expect((await db.filmStocks.get('film-1'))?.stockCount).toBe(1);
    expect(await db.rolls.get('roll-1')).toEqual(expect.objectContaining({ id: 'roll-1' }));
    expect(await db.ledgerTransactions.get('ledger-1')).toEqual(expect.objectContaining({ id: 'ledger-1' }));
    expect(await db.syncQueue.toArray()).toEqual([
      expect.objectContaining({
        kind: 'operation',
        operationType: 'create_roll_with_inventory',
        operationPayload: expect.objectContaining({ consumeInventory: true }),
      }),
    ]);
    expect(syncEventsMock.requestImmediateSync).toHaveBeenCalledWith('inventory-roll-create');
  });

  it('clamps a local decrement and queues only the applied delta', async () => {
    await db.filmStocks.add({
      id: 'film-1',
      userId: 'user-1',
      brand: 'Ilford',
      name: 'HP5 Plus',
      iso: 400,
      colorType: 'bw',
      format: '135',
      isSystem: 0,
      stockCount: 1,
      addedAt: 1782864000000,
    });
    await db.syncQueue.clear();

    await adjustFilmStock({ id: 'film-1', userId: 'user-1', stockCount: 1 }, -3);

    expect((await db.filmStocks.get('film-1'))?.stockCount).toBe(0);
    expect(await db.syncQueue.toArray()).toEqual([
      expect.objectContaining({
        kind: 'operation',
        operationType: 'adjust_film_stock',
        operationPayload: { filmStockId: 'film-1', delta: -1 },
      }),
    ]);
  });

  it('keeps digital rolls on the normal record queue', async () => {
    await createRollWithInventory({
      roll: {
        id: 'digital-roll-1',
        userId: 'user-1',
        name: 'Digital test',
        cameraIds: ['camera-1'],
        filmStockId: 'digital-placeholder',
        status: 'active',
        startDate: 1782864000000,
      },
    });

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const queued = await db.syncQueue.where('recordId').equals('digital-roll-1').first();
      if (queued) {
        expect(queued).toEqual(expect.objectContaining({ tableName: 'rolls', action: 'upsert' }));
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    throw new Error('Timed out waiting for digital roll record queue item.');
  });
});
