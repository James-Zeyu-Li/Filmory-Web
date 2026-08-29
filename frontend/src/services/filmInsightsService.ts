import type { Collection, FilmStock, Roll } from '../db/schema';
import { groupRollsByCollection, type CollectionGroup } from './rollCollectionGrouping';

export type FilmInsightSort = 'recent' | 'usage' | 'stock';

export interface FilmUsageSummary {
  film: FilmStock;
  activeRolls: Roll[];
  completedRolls: Roll[];
  collectionGroups: CollectionGroup[];
  unassignedRolls: Roll[];
  lastUsedAt?: number;
}

export interface FilmInsightsOverview {
  inventoryCount: number;
  activeCount: number;
  completedCount: number;
  colorCompletedCount: number;
  bwCompletedCount: number;
}

const getRollDate = (roll: Roll): number => roll.endDate ?? roll.startDate ?? 0;

export const buildFilmUsageSummaries = (
  filmStocks: FilmStock[],
  rolls: Roll[],
  collections: readonly Collection[] = [],
): FilmUsageSummary[] => {
  const eligibleFilms = filmStocks.filter(film => film.isSystem === 0 && Boolean(film.id));

  return eligibleFilms.map(film => {
    const linkedRolls = rolls.filter(roll => roll.filmStockId === film.id);
    const activeRolls = linkedRolls
      .filter(roll => roll.status === 'active')
      .sort((left, right) => getRollDate(right) - getRollDate(left));
    const completedRolls = linkedRolls
      .filter(roll => roll.status === 'archived')
      .sort((left, right) => getRollDate(right) - getRollDate(left));
    const { collectionGroups, unassignedRolls } = groupRollsByCollection(linkedRolls, collections);
    const lastUsedAt = Math.max(...linkedRolls.map(getRollDate), 0) || undefined;

    return { film, activeRolls, completedRolls, collectionGroups, unassignedRolls, lastUsedAt };
  });
};

export const buildFilmInsightsOverview = (
  summaries: FilmUsageSummary[],
): FilmInsightsOverview => summaries.reduce<FilmInsightsOverview>((overview, summary) => {
  overview.inventoryCount += summary.film.stockCount ?? 0;
  overview.activeCount += summary.activeRolls.length;
  overview.completedCount += summary.completedRolls.length;

  if (summary.film.colorType === 'color') {
    overview.colorCompletedCount += summary.completedRolls.length;
  } else {
    overview.bwCompletedCount += summary.completedRolls.length;
  }

  return overview;
}, {
  inventoryCount: 0,
  activeCount: 0,
  completedCount: 0,
  colorCompletedCount: 0,
  bwCompletedCount: 0,
});

export const sortFilmUsageSummaries = (
  summaries: FilmUsageSummary[],
  sort: FilmInsightSort,
): FilmUsageSummary[] => [...summaries].sort((left, right) => {
  if (sort === 'usage') {
    const usageDifference = right.completedRolls.length - left.completedRolls.length;
    if (usageDifference !== 0) return usageDifference;
  }

  if (sort === 'stock') {
    const stockDifference = (right.film.stockCount ?? 0) - (left.film.stockCount ?? 0);
    if (stockDifference !== 0) return stockDifference;
  }

  const dateDifference = (right.lastUsedAt ?? 0) - (left.lastUsedAt ?? 0);
  if (dateDifference !== 0) return dateDifference;

  return `${left.film.brand} ${left.film.name}`.localeCompare(`${right.film.brand} ${right.film.name}`);
});
