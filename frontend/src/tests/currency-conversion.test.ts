import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/schema';
import { convertCurrentUserMoney } from '../services/currencyConversionService';

describe('Currency conversion service', () => {
  beforeEach(async () => {
    await db.cameras.clear();
    await db.lenses.clear();
    await db.filmStocks.clear();
    await db.rolls.clear();
    await db.otherEquipments.clear();
    await db.ledgerTransactions.clear();
    await db.photoAssets.clear();
    await db.collections.clear();
    await db.albums.clear();
    await db.albumPhotos.clear();
    await db.userProfiles.clear();
    await db.syncQueue.clear();
  });

  it('converts every current-user monetary field and leaves non-money numeric data untouched', async () => {
    await db.cameras.bulkAdd([
      { id: 'camera-a', userId: 'user-a', name: 'Leica M6', type: 'film', format: '135', purchasePrice: 100, addedAt: 111 },
      { id: 'camera-b', userId: 'user-b', name: 'Nikon F3', type: 'film', format: '135', purchasePrice: 200, addedAt: 222 },
    ]);
    await db.lenses.add({
      id: 'lens-a',
      userId: 'user-a',
      name: 'Summicron',
      focalLength: 50,
      maxAperture: 'f/2',
      type: 'prime',
      purchasePrice: 50,
      addedAt: 333,
    });
    await db.filmStocks.add({
      id: 'film-a',
      userId: 'user-a',
      brand: 'Kodak',
      name: 'Gold 200',
      iso: 200,
      colorType: 'color',
      format: '135',
      isSystem: 0,
      stockCount: 3,
      pricePerRoll: 12.345,
      addedAt: 444,
    });
    await db.rolls.bulkAdd([
      {
        id: 'roll-a',
        userId: 'user-a',
        name: 'Tokyo',
        cameraIds: ['camera-a'],
        filmStockId: 'film-a',
        status: 'archived',
        startDate: 1000,
        endDate: 2000,
        rating: 5,
        filmPrice: 10,
        developPrice: 8.5,
      },
      {
        id: 'roll-a-no-price',
        userId: 'user-a',
        name: 'No price',
        cameraIds: ['camera-a'],
        filmStockId: 'film-a',
        status: 'active',
      },
    ]);
    await db.otherEquipments.add({
      id: 'other-a',
      userId: 'user-a',
      name: 'Tripod',
      type: 'tripod',
      purchaseDate: 3000,
      expiryDate: 4000,
      purchasePrice: 25,
      addedAt: 555,
    });
    await db.ledgerTransactions.add({
      id: 'ledger-a',
      userId: 'user-a',
      amount: -20,
      date: 666,
      type: 'expense',
      category: 'film',
      addedAt: 777,
    });
    await db.photoAssets.add({
      id: 'photo-a',
      userId: 'user-a',
      rollId: 'roll-a',
      originalFileName: 'scan.jpg',
      fileSize: 123456,
      addedAt: 888,
      focalLength: 35,
      exposureCompensation: -0.7,
      isPinned: 1,
      rating: 4,
      orderIndex: 9,
    });
    await db.collections.add({
      id: 'collection-a',
      userId: 'user-a',
      name: 'Tokyo',
      date: 999,
      addedAt: 1001,
    });
    await db.albums.add({
      id: 'album-a',
      userId: 'user-a',
      name: 'Selects',
      addedAt: 1002,
    });
    await db.albumPhotos.add({
      id: 'album-photo-a',
      albumId: 'album-a',
      photoId: 'photo-a',
      addedAt: 1003,
    });
    await db.userProfiles.add({
      id: 'profile-a',
      userId: 'user-a',
      tier: 'regular',
      highResQuotaUsed: 6,
      updatedAt: 1004,
    });

    const summary = await convertCurrentUserMoney('user-a', 7.2);

    expect(summary).toEqual({
      cameras: 1,
      lenses: 1,
      filmStocks: 1,
      rolls: 1,
      otherEquipments: 1,
      ledgerTransactions: 1,
    });
    await expect(db.cameras.get('camera-a')).resolves.toMatchObject({ purchasePrice: 720 });
    await expect(db.cameras.get('camera-b')).resolves.toMatchObject({ purchasePrice: 200, addedAt: 222 });
    await expect(db.lenses.get('lens-a')).resolves.toMatchObject({ purchasePrice: 360, focalLength: 50, addedAt: 333 });
    await expect(db.filmStocks.get('film-a')).resolves.toMatchObject({
      iso: 200,
      stockCount: 3,
      pricePerRoll: 88.88,
      addedAt: 444,
    });
    const convertedRoll = await db.rolls.get('roll-a');
    const unchangedRoll = await db.rolls.get('roll-a-no-price');
    expect(convertedRoll).toMatchObject({
      startDate: 1000,
      endDate: 2000,
      rating: 5,
      filmPrice: 72,
      developPrice: 61.2,
    });
    expect(unchangedRoll).not.toHaveProperty('filmPrice');
    expect(unchangedRoll).not.toHaveProperty('developPrice');
    await expect(db.otherEquipments.get('other-a')).resolves.toMatchObject({
      purchaseDate: 3000,
      expiryDate: 4000,
      purchasePrice: 180,
      addedAt: 555,
    });
    await expect(db.ledgerTransactions.get('ledger-a')).resolves.toMatchObject({
      amount: -144,
      date: 666,
      addedAt: 777,
    });
    await expect(db.photoAssets.get('photo-a')).resolves.toMatchObject({
      fileSize: 123456,
      focalLength: 35,
      exposureCompensation: -0.7,
      isPinned: 1,
      rating: 4,
      orderIndex: 9,
      addedAt: 888,
    });
    await expect(db.collections.get('collection-a')).resolves.toMatchObject({ date: 999, addedAt: 1001 });
    await expect(db.albums.get('album-a')).resolves.toMatchObject({ addedAt: 1002 });
    await expect(db.albumPhotos.get('album-photo-a')).resolves.toMatchObject({ addedAt: 1003 });
    await expect(db.userProfiles.get('profile-a')).resolves.toMatchObject({ highResQuotaUsed: 6, updatedAt: 1004 });
  });

  it('rejects invalid manual rates before mutating data', async () => {
    await db.cameras.add({
      id: 'camera-a',
      userId: 'user-a',
      name: 'Leica M6',
      type: 'film',
      format: '135',
      purchasePrice: 100,
      addedAt: 1,
    });

    await expect(convertCurrentUserMoney('user-a', 0)).rejects.toThrow('Invalid conversion rate');
    await expect(db.cameras.get('camera-a')).resolves.toMatchObject({ purchasePrice: 100 });
  });
});
