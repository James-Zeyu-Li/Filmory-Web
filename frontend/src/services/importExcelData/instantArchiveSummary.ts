import { db, type Roll } from '../../db/schema';
import type { InstantArchiveSummary } from './types';

const MIN_SAMPLE_SIZE = 2;

interface TopPickResult {
  id: string;
  count: number;
}

/**
 * Picks the single highest-count id, skipping ids whose record can no
 * longer be resolved for this user (e.g. removed since the import ran) by
 * falling through to the next-highest count tier. A genuine tie among
 * records that still resolve is reported as 'tie' — the caller must not
 * pick a winner by alphabetical order or any other implicit rule, per
 * UI-23's anti-fabrication requirement.
 */
const pickTop = async (
  counts: Map<string, number>,
  resolves: (id: string) => Promise<boolean>,
): Promise<TopPickResult | 'tie' | undefined> => {
  const distinctCounts = [...new Set(counts.values())].sort((a, b) => b - a);
  for (const count of distinctCounts) {
    const idsAtCount = [...counts.entries()].filter(([, c]) => c === count).map(([id]) => id);
    const surviving = (await Promise.all(idsAtCount.map(async id => ((await resolves(id)) ? id : null))))
      .filter((id): id is string => id !== null);
    if (surviving.length === 0) continue;
    if (surviving.length > 1) return 'tie';
    return { id: surviving[0], count };
  }
  return undefined;
};

export const buildInstantArchiveSummary = async (
  createdRollIds: string[],
  userId: string,
): Promise<InstantArchiveSummary> => {
  const rolls = (await db.rolls.bulkGet(createdRollIds))
    .filter((roll): roll is Roll => roll !== undefined && roll.userId === userId);

  if (rolls.length === 0) {
    return { importedRollCount: 0, isFallbackSummary: true };
  }

  const dates = rolls.map(roll => roll.startDate).filter((date): date is number => typeof date === 'number');
  const dateRange = dates.length > 0 ? { earliest: Math.min(...dates), latest: Math.max(...dates) } : undefined;

  const hasEnoughSamples = rolls.length >= MIN_SAMPLE_SIZE;
  let isFallbackSummary = !hasEnoughSamples;

  let topCamera: InstantArchiveSummary['topCamera'];
  if (hasEnoughSamples) {
    const cameraCounts = new Map<string, number>();
    for (const roll of rolls) {
      if (!roll.currentCameraId) continue;
      cameraCounts.set(roll.currentCameraId, (cameraCounts.get(roll.currentCameraId) ?? 0) + 1);
    }
    const pick = await pickTop(cameraCounts, async id => {
      const camera = await db.cameras.get(id);
      return Boolean(camera && camera.userId === userId);
    });
    if (pick === 'tie') {
      isFallbackSummary = true;
    } else if (pick) {
      const camera = await db.cameras.get(pick.id);
      if (camera) topCamera = { cameraId: pick.id, name: camera.name, count: pick.count };
    }
  }

  let topFilmStock: InstantArchiveSummary['topFilmStock'];
  if (hasEnoughSamples) {
    const filmCounts = new Map<string, number>();
    for (const roll of rolls) {
      if (!roll.filmStockId || roll.filmStockId === 'digital-placeholder') continue;
      filmCounts.set(roll.filmStockId, (filmCounts.get(roll.filmStockId) ?? 0) + 1);
    }
    const pick = await pickTop(filmCounts, async id => {
      const film = await db.filmStocks.get(id);
      return Boolean(film && film.userId === userId);
    });
    if (pick === 'tie') {
      isFallbackSummary = true;
    } else if (pick) {
      const film = await db.filmStocks.get(pick.id);
      if (film) topFilmStock = { filmStockId: pick.id, label: `${film.brand} ${film.name}`, count: pick.count };
    }
  }

  return {
    importedRollCount: rolls.length,
    dateRange,
    topCamera,
    topFilmStock,
    isFallbackSummary,
  };
};
