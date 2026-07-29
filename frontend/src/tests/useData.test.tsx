import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db/schema';
import { useCollections } from '../hooks/useData';

let mockUser: { id: string } | null = null;

vi.mock('../contexts/useAuth', () => ({
  useAuth: () => ({ user: mockUser }),
}));

describe('useData hooks', () => {
  beforeEach(async () => {
    mockUser = null;
    await db.collections.clear();
  });

  it('does not query the implicit offline user when unauthenticated', async () => {
    await db.collections.add({
      id: 'offline-collection',
      userId: 'offline',
      name: 'Offline leaked collection',
      date: Date.now(),
      addedAt: Date.now(),
    });

    const { result } = renderHook(() => useCollections());

    await waitFor(() => {
      expect(result.current).toEqual([]);
    });
  });

  it('returns only collections owned by the authenticated user', async () => {
    mockUser = { id: 'user-a' };

    await db.collections.bulkAdd([
      {
        id: 'collection-a',
        userId: 'user-a',
        name: 'User A collection',
        date: 100,
        addedAt: 100,
      },
      {
        id: 'collection-b',
        userId: 'user-b',
        name: 'User B collection',
        date: 200,
        addedAt: 200,
      },
    ]);

    const { result } = renderHook(() => useCollections());

    await waitFor(() => {
      expect(result.current).toHaveLength(1);
      expect(result.current[0]).toMatchObject({ id: 'collection-a', userId: 'user-a' });
    });
  });
});
