import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db, type Roll } from '../db/schema';
import * as syncEvents from './syncEvents';
import { adjustFilmStock, createRollWithInventory, writeFilmStockAdjustment, writeRollWithInventory } from './inventoryOperationService';

const USER_ID = 'inventory-user-1';

describe('inventoryOperationService', () => {
  beforeEach(async () => {
    await db.cameras.clear();
    await db.filmStocks.clear();
    await db.rolls.clear();
    await db.ledgerTransactions.clear();
    await db.syncQueue.clear();
    vi.restoreAllMocks();
  });

  describe('public wrappers (unchanged behavior/signature for existing callers)', () => {
    it('createRollWithInventory still decrements stock, queues one operation, and syncs once for a film roll', async () => {
      await db.filmStocks.add({ id: 'film-1', userId: USER_ID, brand: 'Kodak', name: 'Gold 200', iso: 200, colorType: 'color', format: '135', isSystem: 0, stockCount: 5, addedAt: Date.now() });
      await db.syncQueue.clear(); // drop the seed write's own sync record; only count what the call under test produces
      const syncSpy = vi.spyOn(syncEvents, 'requestImmediateSync');
      const roll: Roll = { id: 'roll-1', userId: USER_ID, name: 'Test', currentCameraId: 'cam-1', cameraIds: ['cam-1'], filmStockId: 'film-1', status: 'active', startDate: Date.now() };

      await createRollWithInventory({ roll });

      expect((await db.filmStocks.get('film-1'))?.stockCount).toBe(4);
      expect(await db.rolls.get('roll-1')).toBeDefined();
      expect(await db.syncQueue.where('userId').equals(USER_ID).count()).toBe(1);
      expect(syncSpy).toHaveBeenCalledWith('inventory-roll-create');
      expect(syncSpy).toHaveBeenCalledTimes(1);
    });

    it('createRollWithInventory does not touch film stock for a digital roll', async () => {
      const syncSpy = vi.spyOn(syncEvents, 'requestImmediateSync');
      const roll: Roll = { id: 'roll-digital', userId: USER_ID, name: 'Digital', currentCameraId: 'cam-1', cameraIds: ['cam-1'], filmStockId: 'digital-placeholder', status: 'active', startDate: Date.now() };

      await createRollWithInventory({ roll });

      expect(await db.rolls.get('roll-digital')).toBeDefined();
      expect(syncSpy).toHaveBeenCalledWith('digital-roll-create');
    });

    it('adjustFilmStock updates stock, queues one operation, and syncs once', async () => {
      await db.filmStocks.add({ id: 'film-2', userId: USER_ID, brand: 'Kodak', name: 'Gold 200', iso: 200, colorType: 'color', format: '135', isSystem: 0, stockCount: 2, addedAt: Date.now() });
      await db.syncQueue.clear();
      const syncSpy = vi.spyOn(syncEvents, 'requestImmediateSync');

      const nextStock = await adjustFilmStock({ id: 'film-2', userId: USER_ID }, 3);

      expect(nextStock).toBe(5);
      expect(await db.syncQueue.where('userId').equals(USER_ID).count()).toBe(1);
      expect(syncSpy).toHaveBeenCalledWith('inventory-stock-adjust');
    });

    it('adjustFilmStock does not sync when the clamped delta is a no-op', async () => {
      await db.filmStocks.add({ id: 'film-3', userId: USER_ID, brand: 'Kodak', name: 'Gold 200', iso: 200, colorType: 'color', format: '135', isSystem: 0, stockCount: 0, addedAt: Date.now() });
      await db.syncQueue.clear();
      const syncSpy = vi.spyOn(syncEvents, 'requestImmediateSync');

      const nextStock = await adjustFilmStock({ id: 'film-3', userId: USER_ID }, -5); // clamped to 0, no real change

      expect(nextStock).toBe(0);
      expect(syncSpy).not.toHaveBeenCalled();
      expect(await db.syncQueue.where('userId').equals(USER_ID).count()).toBe(0);
    });
  });

  describe('transaction-scoped write helpers (used by importExcelData/commitImport.ts)', () => {
    it('writeRollWithInventory performs the write but never triggers a sync request itself', async () => {
      await db.filmStocks.add({ id: 'film-4', userId: USER_ID, brand: 'Kodak', name: 'Gold 200', iso: 200, colorType: 'color', format: '135', isSystem: 0, stockCount: 5, addedAt: Date.now() });
      const syncSpy = vi.spyOn(syncEvents, 'requestImmediateSync');
      const roll: Roll = { id: 'roll-helper', userId: USER_ID, name: 'Helper', currentCameraId: 'cam-1', cameraIds: ['cam-1'], filmStockId: 'film-4', status: 'active', startDate: Date.now() };

      await db.transaction('rw', db.rolls, db.filmStocks, db.ledgerTransactions, db.syncQueue, async () => {
        await writeRollWithInventory({ roll });
      });

      expect((await db.filmStocks.get('film-4'))?.stockCount).toBe(4);
      expect(await db.rolls.get('roll-helper')).toBeDefined();
      expect(syncSpy).not.toHaveBeenCalled();
    });

    it('writeFilmStockAdjustment performs the write but never triggers a sync request itself', async () => {
      await db.filmStocks.add({ id: 'film-5', userId: USER_ID, brand: 'Kodak', name: 'Gold 200', iso: 200, colorType: 'color', format: '135', isSystem: 0, stockCount: 2, addedAt: Date.now() });
      const syncSpy = vi.spyOn(syncEvents, 'requestImmediateSync');

      let outcome: { nextStock: number; didQueueOperation: boolean } | undefined;
      await db.transaction('rw', db.filmStocks, db.syncQueue, async () => {
        outcome = await writeFilmStockAdjustment({ id: 'film-5', userId: USER_ID }, 3);
      });

      expect(outcome).toEqual({ nextStock: 5, didQueueOperation: true });
      expect(syncSpy).not.toHaveBeenCalled();
    });
  });
});
