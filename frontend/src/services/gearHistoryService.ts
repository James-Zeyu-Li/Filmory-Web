import type { Camera, Collection, Roll } from '../db/schema';
import { groupRollsByCollection, type CollectionGroup } from './rollCollectionGrouping';

export interface CameraHistorySummary {
  camera: Camera;
  linkedRolls: Roll[];
  activeRolls: Roll[];
  completedRolls: Roll[];
  collectionGroups: CollectionGroup[];
  unassignedRolls: Roll[];
  lastUsedAt?: number;
}

const getRollDate = (roll: Roll): number => roll.endDate ?? roll.startDate ?? 0;

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

    return { camera, linkedRolls, activeRolls, completedRolls, collectionGroups, unassignedRolls, lastUsedAt };
  });
