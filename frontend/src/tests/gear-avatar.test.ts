import { beforeEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
import { db } from '../db/schema';
import { removeGearAvatar, type GearAvatarTableName } from '../services/gearAvatarService';
import { SyncService } from '../services/syncService';

const supabaseMock = vi.hoisted(() => ({
  upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
  update: vi.fn().mockReturnThis(),
  eq: vi.fn().mockResolvedValue({ data: null, error: null }),
  from: vi.fn(),
}));

vi.mock('../services/supabaseClient', () => ({
  supabase: {
    from: supabaseMock.from,
  },
}));

describe('Gear avatar removal', () => {
  beforeEach(async () => {
    await db.cameras.clear();
    await db.lenses.clear();
    await db.filmStocks.clear();
    await db.otherEquipments.clear();
    await db.syncQueue.clear();
    window.__filmory_is_pulling = false;
    localStorage.clear();
    vi.mocked(localStorage.getItem).mockImplementation((key: string) => (
      key === 'filmory_user_id' ? 'user-a' : null
    ));
    supabaseMock.upsert.mockClear();
    supabaseMock.update.mockClear();
    supabaseMock.eq.mockClear();
    supabaseMock.from.mockClear();
    supabaseMock.from.mockReturnValue({
      upsert: supabaseMock.upsert,
      update: supabaseMock.update,
      eq: supabaseMock.eq,
    });
  });

  it.each([
    ['cameras', 'camera-a', () => db.cameras.get('camera-a')],
    ['lenses', 'lens-a', () => db.lenses.get('lens-a')],
    ['filmStocks', 'film-a', () => db.filmStocks.get('film-a')],
    ['otherEquipments', 'equipment-a', () => db.otherEquipments.get('equipment-a')],
  ] as Array<[GearAvatarTableName, string, () => Promise<any>]>)(
    'clears %s avatar without changing other fields',
    async (tableName, id, readRecord) => {
      await db.cameras.add({
        id: 'camera-a',
        userId: 'user-a',
        name: 'Leica M6',
        type: 'film',
        format: '135',
        avatarUrl: 'data:image/webp;base64,camera',
        purchasePrice: 100,
        addedAt: 1,
      });
      await db.lenses.add({
        id: 'lens-a',
        userId: 'user-a',
        name: 'Summicron',
        focalLength: 50,
        maxAperture: 'f/2',
        type: 'prime',
        avatarUrl: 'data:image/webp;base64,lens',
        purchasePrice: 200,
        addedAt: 2,
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
        pricePerRoll: 12,
        avatarUrl: 'data:image/webp;base64,film',
        addedAt: 3,
      });
      await db.otherEquipments.add({
        id: 'equipment-a',
        userId: 'user-a',
        name: 'Tripod',
        type: 'tripod',
        notes: 'carbon',
        purchasePrice: 300,
        purchaseDate: 4,
        avatarUrl: 'data:image/webp;base64,equipment',
        addedAt: 5,
      });
      await db.syncQueue.clear();

      const before = await readRecord();
      await removeGearAvatar(tableName, id);

      const after = await readRecord();
      expect(after).toEqual({ ...before, avatarUrl: null });
    }
  );

  it('pushes avatar_url null so cloud records are cleared too', async () => {
    await db.cameras.add({
      id: 'camera-a',
      userId: 'user-a',
      name: 'Leica M6',
      type: 'film',
      format: '135',
      avatarUrl: 'data:image/webp;base64,camera',
      addedAt: 1,
    });
    await db.syncQueue.clear();

    await removeGearAvatar('cameras', 'camera-a');
    await waitFor(async () => {
      await expect(db.syncQueue.count()).resolves.toBe(1);
    });
    await SyncService.push();

    expect(supabaseMock.from).toHaveBeenCalledWith('cameras');
    expect(supabaseMock.upsert).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'camera-a',
        user_id: 'user-a',
        avatar_url: null,
      }),
    ]);
  });
});
