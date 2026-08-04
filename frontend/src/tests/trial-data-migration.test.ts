import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db/schema';
import { migrateTrialDataToUser } from '../services/trialDataMigration';
import { TRIAL_USER_ID } from '../services/trialPolicy';

const clearAppData = async () => {
  await Promise.all([
    db.cameras.clear(),
    db.cameraSystems.clear(),
    db.filmBacks.clear(),
    db.lenses.clear(),
    db.filmStocks.clear(),
    db.rolls.clear(),
    db.photoAssets.clear(),
    db.otherEquipments.clear(),
    db.collections.clear(),
    db.albums.clear(),
    db.albumPhotos.clear(),
    db.tagConfigs.clear(),
    db.ledgerTransactions.clear(),
    db.syncQueue.clear(),
  ]);
};

describe('trial data migration', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await clearAppData();
    localStorage.clear();
  });

  it('moves trial workspace data to an empty real account', async () => {
    await db.cameras.add({
      id: 'camera-trial',
      userId: TRIAL_USER_ID,
      name: 'Trial Leica',
      type: 'film',
      format: '135',
      addedAt: 1,
    });
    await db.filmStocks.add({
      id: 'film-trial',
      userId: TRIAL_USER_ID,
      brand: 'Kodak',
      name: 'Gold 200',
      iso: 200,
      colorType: 'color',
      format: '135',
      isSystem: 0,
      stockCount: 1,
      addedAt: 2,
    });
    await db.rolls.add({
      id: 'roll-trial',
      userId: TRIAL_USER_ID,
      name: 'Trial Roll',
      cameraIds: ['camera-trial'],
      filmStockId: 'film-trial',
      status: 'active',
      startDate: 3,
    });
    await db.syncQueue.add({
      userId: TRIAL_USER_ID,
      tableName: 'cameras',
      action: 'upsert',
      recordId: 'camera-trial',
      payload: {},
      timestamp: 4,
    });

    const result = await migrateTrialDataToUser('real-user');

    expect(result).toBe('migrated');
    await expect(db.cameras.where('userId').equals(TRIAL_USER_ID).count()).resolves.toBe(0);
    await expect(db.cameras.where('userId').equals('real-user').count()).resolves.toBe(1);
    await expect(db.rolls.where('userId').equals('real-user').count()).resolves.toBe(1);
    await expect(db.syncQueue.where('userId').equals(TRIAL_USER_ID).count()).resolves.toBe(0);
  });

  it('does not merge trial data into an account that already has local data', async () => {
    await db.cameras.add({
      id: 'camera-trial',
      userId: TRIAL_USER_ID,
      name: 'Trial Leica',
      type: 'film',
      format: '135',
      addedAt: 1,
    });
    await db.cameras.add({
      id: 'camera-real',
      userId: 'real-user',
      name: 'Existing Nikon',
      type: 'film',
      format: '135',
      addedAt: 2,
    });

    const result = await migrateTrialDataToUser('real-user');

    expect(result).toBe('target-has-data');
    await expect(db.cameras.where('userId').equals(TRIAL_USER_ID).count()).resolves.toBe(1);
    await expect(db.cameras.where('userId').equals('real-user').count()).resolves.toBe(1);
  });

  it('leaves a fresh real account empty when there is no trial data', async () => {
    const result = await migrateTrialDataToUser('real-user');

    expect(result).toBe('no-trial-data');
    await expect(db.cameras.where('userId').equals('real-user').count()).resolves.toBe(0);
  });
});
