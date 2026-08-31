import { describe, expect, it } from 'vitest';
import type { PhotoAsset } from '../db/schema';
import { resolveBestFrames } from './bestFramesService';

const photo = (id: string, overrides: Partial<PhotoAsset> = {}): PhotoAsset => ({
  id, rollId: 'roll-1', originalFileName: `${id}.webp`, fileSize: 1, addedAt: 1, isPinned: 0, ...overrides,
});

describe('resolveBestFrames', () => {
  it('returns an empty result when no photo has a rating at all', () => {
    const result = resolveBestFrames([photo('p1'), photo('p2', { rating: 2 })]);
    expect(result).toEqual({ photos: [], totalCount: 0 });
  });

  it('excludes photos rated below 4 stars', () => {
    const result = resolveBestFrames([photo('p1', { rating: 3 }), photo('p2', { rating: 4 })]);
    expect(result.totalCount).toBe(1);
    expect(result.photos.map(p => p.id)).toEqual(['p2']);
  });

  it('sorts highest rating first', () => {
    const result = resolveBestFrames([
      photo('p1', { rating: 4, addedAt: 1 }),
      photo('p2', { rating: 5, addedAt: 1 }),
    ]);
    expect(result.photos.map(p => p.id)).toEqual(['p2', 'p1']);
  });

  it('breaks a rating tie by most recently added first', () => {
    const result = resolveBestFrames([
      photo('older', { rating: 5, addedAt: 100 }),
      photo('newer', { rating: 5, addedAt: 200 }),
    ]);
    expect(result.photos.map(p => p.id)).toEqual(['newer', 'older']);
  });

  it('caps the displayed photos at 8 but keeps the full count in totalCount', () => {
    const photos = Array.from({ length: 12 }, (_, i) => photo(`p${i}`, { rating: 4, addedAt: i }));
    const result = resolveBestFrames(photos);
    expect(result.photos).toHaveLength(8);
    expect(result.totalCount).toBe(12);
  });
});
