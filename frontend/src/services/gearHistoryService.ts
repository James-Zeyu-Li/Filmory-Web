import type { Camera, Collection, Lens, Roll } from '../db/schema';
import { groupRollsByCollection, type CollectionGroup } from './rollCollectionGrouping';

export interface RankedUsage {
  id: string;
  count: number;
}

export interface CameraHistorySummary {
  camera: Camera;
  linkedRolls: Roll[];
  activeRolls: Roll[];
  completedRolls: Roll[];
  collectionGroups: CollectionGroup[];
  unassignedRolls: Roll[];
  lastUsedAt?: number;
  lensUsage: RankedUsage[];
  filmStockUsage: RankedUsage[];
}

export interface LensHistorySummary {
  lens: Lens;
  linkedRolls: Roll[];
  activeRolls: Roll[];
  completedRolls: Roll[];
  collectionGroups: CollectionGroup[];
  unassignedRolls: Roll[];
  lastUsedAt?: number;
  cameraUsage: RankedUsage[];
}

const getRollDate = (roll: Roll): number => roll.endDate ?? roll.startDate ?? 0;

// Ranks ids by how often they occur, ties broken by first-appearance order
// (Array.prototype.sort is stable, so sorting a first-seen-ordered array by
// count alone already preserves that tie-break for free).
const rankByCount = (ids: readonly (string | undefined)[]): RankedUsage[] => {
  const counts = new Map<string, number>();
  const firstSeenOrder: string[] = [];
  for (const id of ids) {
    if (!id) continue;
    if (!counts.has(id)) firstSeenOrder.push(id);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return firstSeenOrder
    .map(id => ({ id, count: counts.get(id) as number }))
    .sort((a, b) => b.count - a.count);
};

// Camera participation follows the historical `cameraIds` list, not `currentCameraId`,
// so a body keeps its place in past rolls after a mid-roll camera transfer.
// Callers must pass already user-scoped, non-deleted `cameras`/`rolls`/`collections`
// (e.g. from Dexie `useLiveQuery` filtered by the current userId).
export const buildCameraHistorySummaries = (
  cameras: readonly Camera[],
  rolls: readonly Roll[],
  collections: readonly Collection[],
): CameraHistorySummary[] => cameras
  .filter(camera => Boolean(camera.id))
  .map(camera => {
    const linkedRolls = rolls.filter(roll => roll.cameraIds?.includes(camera.id as string));
    const activeRolls = linkedRolls
      .filter(roll => roll.status === 'active')
      .sort((left, right) => getRollDate(right) - getRollDate(left));
    const completedRolls = linkedRolls
      .filter(roll => roll.status === 'archived')
      .sort((left, right) => getRollDate(right) - getRollDate(left));
    const { collectionGroups, unassignedRolls } = groupRollsByCollection(linkedRolls, collections);
    const lastUsedAt = Math.max(...linkedRolls.map(getRollDate), 0) || undefined;
    const lensUsage = rankByCount(linkedRolls.flatMap(roll => roll.lensIds ?? []));
    const filmStockUsage = rankByCount(
      linkedRolls.map(roll => roll.filmStockId).filter(id => id && id !== 'digital-placeholder'),
    );

    return { camera, linkedRolls, activeRolls, completedRolls, collectionGroups, unassignedRolls, lastUsedAt, lensUsage, filmStockUsage };
  });

// Symmetric to buildCameraHistorySummaries: lens participation follows the
// exact `lensIds` array (no name-based matching), same user-scoping contract.
export const buildLensHistorySummaries = (
  lenses: readonly Lens[],
  rolls: readonly Roll[],
  collections: readonly Collection[],
): LensHistorySummary[] => lenses
  .filter(lens => Boolean(lens.id))
  .map(lens => {
    const linkedRolls = rolls.filter(roll => roll.lensIds?.includes(lens.id as string));
    const activeRolls = linkedRolls
      .filter(roll => roll.status === 'active')
      .sort((left, right) => getRollDate(right) - getRollDate(left));
    const completedRolls = linkedRolls
      .filter(roll => roll.status === 'archived')
      .sort((left, right) => getRollDate(right) - getRollDate(left));
    const { collectionGroups, unassignedRolls } = groupRollsByCollection(linkedRolls, collections);
    const lastUsedAt = Math.max(...linkedRolls.map(getRollDate), 0) || undefined;
    const cameraUsage = rankByCount(linkedRolls.flatMap(roll => roll.cameraIds ?? []));

    return { lens, linkedRolls, activeRolls, completedRolls, collectionGroups, unassignedRolls, lastUsedAt, cameraUsage };
  });
