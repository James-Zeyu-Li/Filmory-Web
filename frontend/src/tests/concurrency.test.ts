import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../db/schema';

describe('Concurrency & Race Condition Defenses', () => {
  beforeEach(async () => {
    await db.filmStocks.clear();
  });

  it('should accurately handle 50 concurrent inventory decrements without dirty reads', async () => {
    const filmId = 'film-concurrent-123';
    
    // 1. Seed a film stock with exactly 100 rolls in inventory
    await db.filmStocks.add({
      id: filmId,
      userId: 'test-tenant-id',
      brand: 'Kodak',
      name: 'Portra 400',
      iso: '400',
      format: '135',
      colorType: 'color',
      isSystem: 0,
      stockCount: 100,
      createdAt: Date.now()
    });

    // 2. Mock the transactional stock update function exactly as it runs in production
    const handleUpdateStock = async (id: string, delta: number) => {
      // IndexedDB transactions provide snapshot isolation. 
      // If 50 updates hit this at the exact same millisecond, the transaction queue
      // will serialize them, preventing the classic (read 100 -> write 99) dirty overlap.
      await db.transaction('rw', db.filmStocks, async () => {
        const film = await db.filmStocks.get(id);
        if (film) {
          await db.filmStocks.update(id, { stockCount: (film.stockCount || 0) + delta });
        }
      });
    };

    // 3. Fire 50 decrements simultaneously (Promise.all fires them all at once)
    const operations = Array.from({ length: 50 }).map(() => handleUpdateStock(filmId, -1));
    await Promise.all(operations);

    // 4. Assert that exactly 50 rolls remain.
    // If there were a race condition, it might read 100 multiple times and only deduct 1 or 2.
    const finalFilm = await db.filmStocks.get(filmId);
    expect(finalFilm?.stockCount).toBe(50);
  });
});
