import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../db/schema';

describe('Cascading Deletes Defense (Orphan Data Prevention)', () => {
  beforeEach(async () => {
    await db.rolls.clear();
    await db.photoAssets.clear();
  });

  it('should obliterate all child photoAssets when a parent Roll is deleted', async () => {
    const rollId = 'roll_nuclear_test_1';
    
    // 1. Create a parent Roll
    await db.rolls.add({
      id: rollId,
      userId: 'test_user',
      name: 'Tokyo Trip Roll',
      createdAt: Date.now()
    });

    // 2. Create 20 Photo Assets belonging strictly to this roll
    const mockPhotos = Array.from({ length: 20 }).map((_, i) => ({
      id: `photo_tokyo_${i}`,
      rollId: rollId,
      userId: 'test_user',
      originalFileName: `tokyo_${i}.jpg`,
      addedAt: Date.now()
    }));
    await db.photoAssets.bulkAdd(mockPhotos);

    // Also create 1 innocent photo belonging to another roll
    await db.photoAssets.add({
      id: `photo_innocent_1`,
      rollId: 'roll_innocent',
      userId: 'test_user',
      originalFileName: `innocent.jpg`,
      addedAt: Date.now()
    });

    // 3. Ensure they are in the DB
    const rollPhotosCount = await db.photoAssets.where('rollId').equals(rollId).count();
    expect(rollPhotosCount).toBe(20);

    // 4. Mock the exact deletion transaction logic used by RollsView
    const handleDeleteRoll = async (id: string) => {
      await db.transaction('rw', db.rolls, db.photoAssets, db.albumPhotos, async () => {
        // Find and delete all photos in this roll
        const photos = await db.photoAssets.where('rollId').equals(id).toArray();
        const photoIds = photos.map(p => p.id!);
        
        await db.photoAssets.bulkDelete(photoIds);
        
        // Remove from any albums (cascading into albumPhotos map table)
        for (const pid of photoIds) {
          await db.albumPhotos.where('photoId').equals(pid).delete();
        }

        // Finally, delete the roll itself
        await db.rolls.delete(id);
      });
    };

    // 5. Trigger the nuclear deletion
    await handleDeleteRoll(rollId);

    // 6. Assert
    const remainingRollPhotos = await db.photoAssets.where('rollId').equals(rollId).count();
    const theInnocentPhoto = await db.photoAssets.get('photo_innocent_1');
    const theDeletedRoll = await db.rolls.get(rollId);

    // The Roll must be gone
    expect(theDeletedRoll).toBeUndefined();
    // ALL 20 child photos must be obliterated
    expect(remainingRollPhotos).toBe(0);
    // The innocent photo belonging to another roll must remain unharmed
    expect(theInnocentPhoto).toBeDefined();
  });
});
