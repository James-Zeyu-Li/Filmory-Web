import { describe, expect, it } from 'vitest';
import type { FilmStock, Roll } from '../db/schema';
import { buildFilmInsightsOverview, buildFilmUsageSummaries, sortFilmUsageSummaries } from './filmInsightsService';

const filmStocks: FilmStock[] = [
  { id: 'color-film', userId: 'user-1', brand: 'Kodak', name: 'Gold 200', iso: 200, colorType: 'color', format: '135', isSystem: 0, stockCount: 4, addedAt: 1 },
  { id: 'bw-film', userId: 'user-1', brand: 'Ilford', name: 'HP5 Plus', iso: 400, colorType: 'bw', format: '120', isSystem: 0, stockCount: 1, addedAt: 2 },
  { id: 'digital', userId: 'user-1', brand: 'System', name: 'Digital', iso: 0, colorType: 'color', format: 'digital', isSystem: 1, stockCount: 0, addedAt: 3 },
];

const rolls: Roll[] = [
  { id: 'active-color', userId: 'user-1', name: 'Summer', cameraIds: [], filmStockId: 'color-film', status: 'active', startDate: 300 },
  { id: 'done-color', userId: 'user-1', name: 'Spring', cameraIds: [], filmStockId: 'color-film', status: 'archived', endDate: 200 },
  { id: 'done-bw', userId: 'user-1', name: 'Winter', cameraIds: [], filmStockId: 'bw-film', status: 'archived', endDate: 100 },
  { id: 'unlinked', userId: 'user-1', name: 'Unknown', cameraIds: [], status: 'archived', endDate: 500 },
];

describe('filmInsightsService', () => {
  it('summarizes only registered, non-system film and preserves active and completed rolls', () => {
    const summaries = buildFilmUsageSummaries(filmStocks, rolls);

    expect(summaries).toHaveLength(2);
    expect(summaries.find(summary => summary.film.id === 'color-film')).toMatchObject({
      activeRolls: [{ id: 'active-color' }],
      completedRolls: [{ id: 'done-color' }],
      lastUsedAt: 300,
    });
  });

  it('counts completed color and black-and-white rolls without guessing unlinked history', () => {
    const overview = buildFilmInsightsOverview(buildFilmUsageSummaries(filmStocks, rolls));

    expect(overview).toEqual({
      inventoryCount: 5,
      activeCount: 1,
      completedCount: 2,
      colorCompletedCount: 1,
      bwCompletedCount: 1,
    });
  });

  it('sorts by completed usage, stock, or latest use with a stable label fallback', () => {
    const summaries = buildFilmUsageSummaries(filmStocks, rolls);

    expect(sortFilmUsageSummaries(summaries, 'recent').map(summary => summary.film.id)).toEqual(['color-film', 'bw-film']);
    expect(sortFilmUsageSummaries(summaries, 'usage').map(summary => summary.film.id)).toEqual(['color-film', 'bw-film']);
    expect(sortFilmUsageSummaries(summaries, 'stock').map(summary => summary.film.id)).toEqual(['color-film', 'bw-film']);
  });
});
