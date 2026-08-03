import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db/schema';
import { deleteTagAndClearPhotoTags } from '../services/tagService';

describe('tagConfigs multi-tenant uniqueness', () => {
  beforeEach(async () => {
    await db.tagConfigs.clear();
    await db.photoAssets.clear();
    await db.syncQueue.clear();
  });

  it('allows different users to create tags with the same name', async () => {
    await db.tagConfigs.add({
      id: 'tag-user-a',
      userId: 'user-a',
      name: 'Portrait',
      color: '#ec4899',
    });

    await db.tagConfigs.add({
      id: 'tag-user-b',
      userId: 'user-b',
      name: 'Portrait',
      color: '#3b82f6',
    });

    await expect(db.tagConfigs.where('userId').equals('user-a').toArray()).resolves.toHaveLength(1);
    await expect(db.tagConfigs.where('userId').equals('user-b').toArray()).resolves.toHaveLength(1);
  });

  it('still rejects duplicate tag names for the same user', async () => {
    await db.tagConfigs.add({
      id: 'tag-1',
      userId: 'user-a',
      name: 'Street',
      color: '#eab308',
    });

    await expect(db.tagConfigs.add({
      id: 'tag-2',
      userId: 'user-a',
      name: 'Street',
      color: '#22c55e',
    })).rejects.toThrow();
  });

  it('deletes a tag and clears only that user\'s exact photo tag', async () => {
    const portraitTag = {
      id: 'portrait-user-a',
      userId: 'user-a',
      name: 'Portrait',
      color: '#ec4899',
    };

    await db.tagConfigs.add(portraitTag);
    await db.photoAssets.bulkAdd([
      {
        id: 'photo-user-a-match',
        userId: 'user-a',
        rollId: 'roll-a',
        originalFileName: 'a.jpg',
        fileSize: 1,
        thumbnailUrl: 'data:image/webp;base64,a',
        isPinned: 0,
        tags: 'Portrait,Travel',
        addedAt: 1,
      },
      {
        id: 'photo-user-a-different',
        userId: 'user-a',
        rollId: 'roll-a',
        originalFileName: 'b.jpg',
        fileSize: 1,
        thumbnailUrl: 'data:image/webp;base64,b',
        isPinned: 0,
        tags: 'Portraiture',
        addedAt: 2,
      },
      {
        id: 'photo-user-b',
        userId: 'user-b',
        rollId: 'roll-b',
        originalFileName: 'c.jpg',
        fileSize: 1,
        thumbnailUrl: 'data:image/webp;base64,c',
        isPinned: 0,
        tags: 'Portrait,Family',
        addedAt: 3,
      },
    ]);
    await db.syncQueue.clear();

    const transactionSpy = vi.spyOn(db, 'transaction');
    await deleteTagAndClearPhotoTags(portraitTag, 'user-a');

    expect(transactionSpy).toHaveBeenCalledWith(
      'rw',
      db.tagConfigs,
      db.photoAssets,
      expect.any(Function),
    );
    transactionSpy.mockRestore();

    await expect(db.tagConfigs.get('portrait-user-a')).resolves.toBeUndefined();
    await expect(db.photoAssets.get('photo-user-a-match')).resolves.toMatchObject({ tags: 'Travel' });
    await expect(db.photoAssets.get('photo-user-a-different')).resolves.toMatchObject({ tags: 'Portraiture' });
    await expect(db.photoAssets.get('photo-user-b')).resolves.toMatchObject({ tags: 'Portrait,Family' });
  });
});
