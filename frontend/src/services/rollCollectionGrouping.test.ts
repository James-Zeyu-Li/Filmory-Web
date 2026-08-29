import { describe, expect, it } from 'vitest';
import type { Collection, Roll } from '../db/schema';
import { groupRollsByCollection } from './rollCollectionGrouping';

const collections: Collection[] = [
  { id: 'collection-x', userId: 'user-1', name: 'Project X', date: 1, addedAt: 1 },
  { id: 'collection-y', userId: 'user-1', name: 'Project Y', date: 2, addedAt: 2 },
];

const rollIn = (id: string, collectionId: string | undefined): Roll => ({
  id,
  userId: 'user-1',
  name: id,
  cameraIds: [],
  status: 'archived',
  endDate: 1,
  collectionId,
});

describe('groupRollsByCollection', () => {
  it('groups rolls under the collection they reference', () => {
    const rolls = [rollIn('roll-1', 'collection-x'), rollIn('roll-2', 'collection-x'), rollIn('roll-3', 'collection-y')];

    const { collectionGroups, unassignedRolls } = groupRollsByCollection(rolls, collections);

    expect(unassignedRolls).toHaveLength(0);
    expect(collectionGroups).toHaveLength(2);
    expect(collectionGroups.find(group => group.collection.id === 'collection-x')?.rolls.map(roll => roll.id)).toEqual(['roll-1', 'roll-2']);
    expect(collectionGroups.find(group => group.collection.id === 'collection-y')?.rolls.map(roll => roll.id)).toEqual(['roll-3']);
  });

  it('falls back rolls with no collectionId to unassignedRolls', () => {
    const rolls = [rollIn('roll-1', undefined)];

    const { collectionGroups, unassignedRolls } = groupRollsByCollection(rolls, collections);

    expect(collectionGroups).toHaveLength(0);
    expect(unassignedRolls.map(roll => roll.id)).toEqual(['roll-1']);
  });

  it('falls back rolls pointing at a collection absent from the passed collections (deleted or not visible) to unassignedRolls, without fabricating a group', () => {
    const rolls = [rollIn('roll-1', 'collection-deleted')];

    const { collectionGroups, unassignedRolls } = groupRollsByCollection(rolls, collections);

    expect(collectionGroups).toHaveLength(0);
    expect(unassignedRolls.map(roll => roll.id)).toEqual(['roll-1']);
  });

  it('never produces an empty collectionGroup: a collection with zero matching rolls does not appear at all', () => {
    const rolls = [rollIn('roll-1', 'collection-x')];

    const { collectionGroups } = groupRollsByCollection(rolls, collections);

    expect(collectionGroups).toHaveLength(1);
    expect(collectionGroups[0].collection.id).toBe('collection-x');
  });

  it('handles empty rolls and empty collections without throwing', () => {
    expect(groupRollsByCollection([], [])).toEqual({ collectionGroups: [], unassignedRolls: [] });
    expect(groupRollsByCollection([rollIn('roll-1', 'collection-x')], [])).toEqual({
      collectionGroups: [],
      unassignedRolls: [expect.objectContaining({ id: 'roll-1' })],
    });
  });
});
