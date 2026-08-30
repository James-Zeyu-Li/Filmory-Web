import { describe, expect, it } from 'vitest';
import type { Camera, Collection, Lens, Roll } from '../db/schema';
import { buildCameraHistorySummaries, buildLensHistorySummaries } from './gearHistoryService';

const cameras: Camera[] = [
  { id: 'camera-a', userId: 'user-1', name: 'Leica M6', type: 'film', format: '135', addedAt: 1 },
  { id: 'camera-b', userId: 'user-1', name: 'Nikon F3', type: 'film', format: '135', addedAt: 2 },
];

const lenses: Lens[] = [
  { id: 'lens-a', userId: 'user-1', name: 'Summicron 50mm', focalLength: 50, maxAperture: 'f/2', type: 'prime', addedAt: 1 },
  { id: 'lens-b', userId: 'user-1', name: 'Nikkor 35mm', focalLength: 35, maxAperture: 'f/2.8', type: 'prime', addedAt: 2 },
];

const collections: Collection[] = [
  { id: 'collection-x', userId: 'user-1', name: 'Project X', date: 1, addedAt: 1 },
  { id: 'collection-y', userId: 'user-1', name: 'Project Y', date: 2, addedAt: 2 },
];

const rolls: Roll[] = [
  // camera-a only, in project X, active. lens-a, film-portra.
  { id: 'roll-active-x', userId: 'user-1', name: 'Roll 1', cameraIds: ['camera-a'], lensIds: ['lens-a'], filmStockId: 'film-portra', collectionId: 'collection-x', status: 'active', startDate: 100 },
  // camera transfer mid-roll: started on camera-a, transferred to camera-b. Must remain in BOTH histories. lens-a + lens-b, film-portra.
  {
    id: 'roll-transfer',
    userId: 'user-1',
    name: 'Roll 2',
    cameraIds: ['camera-a', 'camera-b'],
    lensIds: ['lens-a', 'lens-b'],
    filmStockId: 'film-portra',
    currentCameraId: 'camera-b',
    cameraTransfers: [{ fromCameraId: 'camera-a', toCameraId: 'camera-b', changedAt: 150 }],
    collectionId: 'collection-x',
    status: 'archived',
    endDate: 200,
  },
  // camera-a only, in project Y, archived. lens-b, digital placeholder (must be excluded from filmStockUsage).
  { id: 'roll-y', userId: 'user-1', name: 'Roll 3', cameraIds: ['camera-a'], lensIds: ['lens-b'], filmStockId: 'digital-placeholder', collectionId: 'collection-y', status: 'archived', endDate: 50 },
  // camera-b only, unassigned (no collectionId), active. lens-b, film-trix.
  { id: 'roll-unassigned-active', userId: 'user-1', name: 'Roll 4', cameraIds: ['camera-b'], lensIds: ['lens-b'], filmStockId: 'film-trix', status: 'active', startDate: 10 },
  // camera-a, dangling collectionId pointing at a collection absent from the passed collections (deleted/not visible). No lens recorded.
  { id: 'roll-dangling-collection', userId: 'user-1', name: 'Roll 5', cameraIds: ['camera-a'], filmStockId: 'film-portra', collectionId: 'collection-deleted', status: 'archived', endDate: 400 },
  // no camera at all - must not appear anywhere.
  { id: 'roll-no-camera', userId: 'user-1', name: 'Roll 6', cameraIds: [], status: 'archived', endDate: 999 },
];

describe('buildCameraHistorySummaries', () => {
  it('keeps a roll in the earlier camera history after a mid-roll camera transfer', () => {
    const summaries = buildCameraHistorySummaries(cameras, rolls, collections);
    const cameraA = summaries.find(summary => summary.camera.id === 'camera-a');

    expect(cameraA?.linkedRolls.map(roll => roll.id)).toEqual(
      expect.arrayContaining(['roll-active-x', 'roll-transfer', 'roll-y', 'roll-dangling-collection']),
    );
  });

  it('keeps the transferred-to camera history too, so the roll is visible from both bodies', () => {
    const summaries = buildCameraHistorySummaries(cameras, rolls, collections);
    const cameraB = summaries.find(summary => summary.camera.id === 'camera-b');

    expect(cameraB?.linkedRolls.map(roll => roll.id)).toEqual(
      expect.arrayContaining(['roll-transfer', 'roll-unassigned-active']),
    );
  });

  it('groups the same camera across multiple projects with only the rolls that actually hit that camera', () => {
    const summaries = buildCameraHistorySummaries(cameras, rolls, collections);
    const cameraA = summaries.find(summary => summary.camera.id === 'camera-a');

    expect(cameraA?.collectionGroups).toHaveLength(2);
    expect(cameraA?.collectionGroups.find(group => group.collection.id === 'collection-x')?.rolls.map(roll => roll.id)).toEqual([
      'roll-active-x',
      'roll-transfer',
    ]);
    expect(cameraA?.collectionGroups.find(group => group.collection.id === 'collection-y')?.rolls.map(roll => roll.id)).toEqual(['roll-y']);
  });

  it('does not leak camera-a rolls into camera-b collection groups', () => {
    const summaries = buildCameraHistorySummaries(cameras, rolls, collections);
    const cameraB = summaries.find(summary => summary.camera.id === 'camera-b');

    expect(cameraB?.collectionGroups).toHaveLength(1);
    expect(cameraB?.collectionGroups[0].collection.id).toBe('collection-x');
    expect(cameraB?.collectionGroups[0].rolls.map(roll => roll.id)).toEqual(['roll-transfer']);
  });

  it('puts rolls with no collectionId, or a collectionId absent from the passed collections, into unassignedRolls without dropping or fabricating a group', () => {
    const summaries = buildCameraHistorySummaries(cameras, rolls, collections);
    const cameraA = summaries.find(summary => summary.camera.id === 'camera-a');
    const cameraB = summaries.find(summary => summary.camera.id === 'camera-b');

    expect(cameraA?.unassignedRolls.map(roll => roll.id)).toEqual(['roll-dangling-collection']);
    expect(cameraB?.unassignedRolls.map(roll => roll.id)).toEqual(['roll-unassigned-active']);
  });

  it('splits active vs completed and sorts each independently by endDate ?? startDate descending', () => {
    const summaries = buildCameraHistorySummaries(cameras, rolls, collections);
    const cameraA = summaries.find(summary => summary.camera.id === 'camera-a');

    expect(cameraA?.activeRolls.map(roll => roll.id)).toEqual(['roll-active-x']);
    // archived rolls for camera-a: roll-transfer(200), roll-y(50), roll-dangling-collection(400) -> desc by date.
    expect(cameraA?.completedRolls.map(roll => roll.id)).toEqual(['roll-dangling-collection', 'roll-transfer', 'roll-y']);
    expect(cameraA?.lastUsedAt).toBe(400);
  });

  it('never produces a summary for a camera without an id', () => {
    const cameraWithoutId: Camera = { name: 'Broken fixture', type: 'film', format: '135', addedAt: 9 };
    const summaries = buildCameraHistorySummaries([...cameras, cameraWithoutId], rolls, collections);

    expect(summaries).toHaveLength(2);
    expect(summaries.every(summary => Boolean(summary.camera.id))).toBe(true);
  });

  it('gracefully skips rolls that reference a camera id no longer present (soft-deleted camera), never throwing', () => {
    const rollsWithDanglingCamera: Roll[] = [
      ...rolls,
      { id: 'roll-dangling-camera', userId: 'user-1', name: 'Roll 7', cameraIds: ['camera-removed'], status: 'archived', endDate: 1 },
    ];

    expect(() => buildCameraHistorySummaries(cameras, rollsWithDanglingCamera, collections)).not.toThrow();
    const summaries = buildCameraHistorySummaries(cameras, rollsWithDanglingCamera, collections);
    const allLinkedIds = summaries.flatMap(summary => summary.linkedRolls.map(roll => roll.id));
    expect(allLinkedIds).not.toContain('roll-dangling-camera');
  });

  it('documents that cross-user isolation is the caller contract, not something these pure functions enforce', () => {
    // In production, `useCameras`/`useRolls`/`useCollections` (frontend/src/hooks/useData.ts) already scope every
    // array to `db.<table>.where('userId').equals(user.id)` before it ever reaches this service. These functions
    // intentionally do not re-check `userId`: they only ever look at what is passed in. This test documents that
    // contract explicitly, rather than silently relying on it - if a caller ever passed unscoped data, a foreign
    // user's roll would show up here purely because of array membership.
    const foreignUserRoll: Roll = { id: 'roll-foreign', userId: 'user-2', name: 'Foreign', cameraIds: ['camera-a'], status: 'active', startDate: 1 };

    const summaries = buildCameraHistorySummaries(cameras, [...rolls, foreignUserRoll], collections);
    const cameraA = summaries.find(summary => summary.camera.id === 'camera-a');

    expect(cameraA?.linkedRolls.map(roll => roll.id)).toContain('roll-foreign');
  });

  it('ranks lens usage by count with a stable first-appearance tie-break, ignoring rolls with no lens recorded', () => {
    const summaries = buildCameraHistorySummaries(cameras, rolls, collections);
    const cameraA = summaries.find(summary => summary.camera.id === 'camera-a');
    const cameraB = summaries.find(summary => summary.camera.id === 'camera-b');

    // camera-a rolls: roll-active-x(lens-a), roll-transfer(lens-a,lens-b), roll-y(lens-b), roll-dangling-collection(none) -> 2/2 tie, lens-a seen first.
    expect(cameraA?.lensUsage).toEqual([{ id: 'lens-a', count: 2 }, { id: 'lens-b', count: 2 }]);
    // camera-b rolls: roll-transfer(lens-a,lens-b), roll-unassigned-active(lens-b) -> lens-b clearly ahead.
    expect(cameraB?.lensUsage).toEqual([{ id: 'lens-b', count: 2 }, { id: 'lens-a', count: 1 }]);
  });

  it('ranks film stock usage by count, excluding the digital placeholder and rolls with no film stock', () => {
    const summaries = buildCameraHistorySummaries(cameras, rolls, collections);
    const cameraA = summaries.find(summary => summary.camera.id === 'camera-a');

    // camera-a rolls: roll-active-x(portra), roll-transfer(portra), roll-y(digital-placeholder, excluded), roll-dangling-collection(portra).
    expect(cameraA?.filmStockUsage).toEqual([{ id: 'film-portra', count: 3 }]);
  });

  it('never throws and returns an empty ranking for a camera with no lens or film stock history', () => {
    const noHistoryCamera: Camera = { id: 'camera-unused', userId: 'user-1', name: 'Unused body', type: 'film', format: '135', addedAt: 5 };
    const summaries = buildCameraHistorySummaries([...cameras, noHistoryCamera], rolls, collections);
    const unused = summaries.find(summary => summary.camera.id === 'camera-unused');

    expect(unused?.lensUsage).toEqual([]);
    expect(unused?.filmStockUsage).toEqual([]);
  });
});

describe('buildLensHistorySummaries', () => {
  it('links a lens to every roll whose lensIds array includes it, regardless of which camera was used', () => {
    const summaries = buildLensHistorySummaries(lenses, rolls, collections);
    const lensA = summaries.find(summary => summary.lens.id === 'lens-a');
    const lensB = summaries.find(summary => summary.lens.id === 'lens-b');

    expect(lensA?.linkedRolls.map(roll => roll.id)).toEqual(
      expect.arrayContaining(['roll-active-x', 'roll-transfer']),
    );
    expect(lensB?.linkedRolls.map(roll => roll.id)).toEqual(
      expect.arrayContaining(['roll-transfer', 'roll-y', 'roll-unassigned-active']),
    );
  });

  it('ranks camera usage by count with a stable first-appearance tie-break', () => {
    const summaries = buildLensHistorySummaries(lenses, rolls, collections);
    const lensA = summaries.find(summary => summary.lens.id === 'lens-a');
    const lensB = summaries.find(summary => summary.lens.id === 'lens-b');

    // lens-a rolls: roll-active-x(camera-a), roll-transfer(camera-a,camera-b) -> camera-a ahead.
    expect(lensA?.cameraUsage).toEqual([{ id: 'camera-a', count: 2 }, { id: 'camera-b', count: 1 }]);
    // lens-b rolls: roll-transfer(camera-a,camera-b), roll-y(camera-a), roll-unassigned-active(camera-b) -> 2/2 tie, camera-a seen first.
    expect(lensB?.cameraUsage).toEqual([{ id: 'camera-a', count: 2 }, { id: 'camera-b', count: 2 }]);
  });

  it('groups a lens across multiple projects and keeps rolls with no/deleted collectionId in unassignedRolls', () => {
    const summaries = buildLensHistorySummaries(lenses, rolls, collections);
    const lensB = summaries.find(summary => summary.lens.id === 'lens-b');

    expect(lensB?.collectionGroups).toHaveLength(2);
    expect(lensB?.unassignedRolls.map(roll => roll.id)).toEqual(['roll-unassigned-active']);
  });

  it('never produces a summary for a lens without an id, and never throws on a dangling lens id in a roll', () => {
    const lensWithoutId: Lens = { name: 'Broken fixture', focalLength: 24, maxAperture: 'f/2.8', type: 'prime', addedAt: 9 };
    const rollsWithDanglingLens: Roll[] = [
      ...rolls,
      { id: 'roll-dangling-lens', userId: 'user-1', name: 'Roll 8', cameraIds: ['camera-a'], lensIds: ['lens-removed'], status: 'archived', endDate: 1 },
    ];

    expect(() => buildLensHistorySummaries([...lenses, lensWithoutId], rollsWithDanglingLens, collections)).not.toThrow();
    const summaries = buildLensHistorySummaries([...lenses, lensWithoutId], rollsWithDanglingLens, collections);

    expect(summaries).toHaveLength(2);
    expect(summaries.every(summary => Boolean(summary.lens.id))).toBe(true);
    const allLinkedIds = summaries.flatMap(summary => summary.linkedRolls.map(roll => roll.id));
    expect(allLinkedIds).not.toContain('roll-dangling-lens');
  });
});
