import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/schema';

describe('tagConfigs multi-tenant uniqueness', () => {
  beforeEach(async () => {
    await db.tagConfigs.clear();
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
});
