import { describe, expect, it } from 'vitest';
import type { Collection, FilmStock, Roll } from '../db/schema';
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

describe('filmInsightsService collectionGroups / unassignedRolls', () => {
  const collections: Collection[] = [
    { id: 'collection-x', userId: 'user-1', name: 'Project X', date: 1, addedAt: 1 },
    { id: 'collection-y', userId: 'user-1', name: 'Project Y', date: 2, addedAt: 2 },
  ];

  // Two distinct FilmStock entities that intentionally share brand + name to prove grouping is keyed off `film.id`.
  const duplicateNameFilms: FilmStock[] = [
    { id: 'gold-batch-1', userId: 'user-1', brand: 'Kodak', name: 'Gold 200', iso: 200, colorType: 'color', format: '135', isSystem: 0, stockCount: 2, addedAt: 1 },
    { id: 'gold-batch-2', userId: 'user-1', brand: 'Kodak', name: 'Gold 200', iso: 200, colorType: 'color', format: '135', isSystem: 0, stockCount: 3, addedAt: 2 },
  ];

  const rollsForGrouping: Roll[] = [
    { id: 'roll-x-1', userId: 'user-1', name: 'X1', cameraIds: [], filmStockId: 'gold-batch-1', collectionId: 'collection-x', status: 'active', startDate: 100 },
    { id: 'roll-x-2', userId: 'user-1', name: 'X2', cameraIds: [], filmStockId: 'gold-batch-1', collectionId: 'collection-x', status: 'archived', endDate: 150 },
    { id: 'roll-y-1', userId: 'user-1', name: 'Y1', cameraIds: [], filmStockId: 'gold-batch-1', collectionId: 'collection-y', status: 'archived', endDate: 50 },
    { id: 'roll-unassigned', userId: 'user-1', name: 'Unassigned', cameraIds: [], filmStockId: 'gold-batch-1', status: 'active', startDate: 5 },
    { id: 'roll-dangling', userId: 'user-1', name: 'Dangling', cameraIds: [], filmStockId: 'gold-batch-1', collectionId: 'collection-deleted', status: 'archived', endDate: 999 },
    { id: 'roll-other-batch', userId: 'user-1', name: 'OtherBatch', cameraIds: [], filmStockId: 'gold-batch-2', collectionId: 'collection-x', status: 'archived', endDate: 10 },
  ];

  it('groups the same film stock across multiple projects with only the rolls that hit that exact stock', () => {
    const summaries = buildFilmUsageSummaries(duplicateNameFilms, rollsForGrouping, collections);
    const batch1 = summaries.find(summary => summary.film.id === 'gold-batch-1');

    expect(batch1?.collectionGroups).toHaveLength(2);
    expect(batch1?.collectionGroups.find(group => group.collection.id === 'collection-x')?.rolls.map(roll => roll.id)).toEqual([
      'roll-x-1',
      'roll-x-2',
    ]);
    expect(batch1?.collectionGroups.find(group => group.collection.id === 'collection-y')?.rolls.map(roll => roll.id)).toEqual(['roll-y-1']);
  });

  it('puts rolls with no collectionId or a dangling collectionId into unassignedRolls, never dropped nor fabricated', () => {
    const summaries = buildFilmUsageSummaries(duplicateNameFilms, rollsForGrouping, collections);
    const batch1 = summaries.find(summary => summary.film.id === 'gold-batch-1');

    expect(batch1?.unassignedRolls.map(roll => roll.id)).toEqual(expect.arrayContaining(['roll-unassigned', 'roll-dangling']));
    expect(batch1?.unassignedRolls).toHaveLength(2);
  });

  it('never merges two FilmStock entities that share brand/name, keeping their roll histories fully separate', () => {
    const summaries = buildFilmUsageSummaries(duplicateNameFilms, rollsForGrouping, collections);
    const batch1 = summaries.find(summary => summary.film.id === 'gold-batch-1');
    const batch2 = summaries.find(summary => summary.film.id === 'gold-batch-2');

    expect(summaries).toHaveLength(2);
    expect(batch1?.collectionGroups.flatMap(group => group.rolls.map(roll => roll.id))).not.toContain('roll-other-batch');
    expect(batch2?.collectionGroups.find(group => group.collection.id === 'collection-x')?.rolls.map(roll => roll.id)).toEqual([
      'roll-other-batch',
    ]);
  });

  it('defaults to an empty collectionGroups/unassignedRolls when no collections are passed', () => {
    const summaries = buildFilmUsageSummaries(duplicateNameFilms, rollsForGrouping);
    const batch1 = summaries.find(summary => summary.film.id === 'gold-batch-1');

    expect(batch1?.collectionGroups).toEqual([]);
    expect(batch1?.unassignedRolls).toHaveLength(5);
  });
});
