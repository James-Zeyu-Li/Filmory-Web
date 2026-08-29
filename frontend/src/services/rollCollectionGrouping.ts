import type { Collection, Roll } from '../db/schema';

export interface CollectionGroup {
  collection: Collection;
  rolls: Roll[];
}

export interface RollCollectionGrouping {
  collectionGroups: CollectionGroup[];
  unassignedRolls: Roll[];
}

// Groups rolls by their collectionId against an already user-scoped, live `collections` list.
// A roll whose collectionId does not resolve (missing, deleted, or not visible to the caller)
// falls into unassignedRolls rather than being silently dropped or fabricated into a group.
export const groupRollsByCollection = (
  rolls: readonly Roll[],
  collections: readonly Collection[],
): RollCollectionGrouping => {
  const collectionsById = new Map(
    collections.filter(collection => Boolean(collection.id)).map(collection => [collection.id as string, collection]),
  );
  const rollsByCollectionId = new Map<string, Roll[]>();
  const unassignedRolls: Roll[] = [];

  for (const roll of rolls) {
    const collection = roll.collectionId ? collectionsById.get(roll.collectionId) : undefined;
    if (!collection) {
      unassignedRolls.push(roll);
      continue;
    }
    const existing = rollsByCollectionId.get(collection.id as string);
    if (existing) {
      existing.push(roll);
    } else {
      rollsByCollectionId.set(collection.id as string, [roll]);
    }
  }

  const collectionGroups: CollectionGroup[] = Array.from(rollsByCollectionId.entries()).map(
    ([collectionId, groupedRolls]) => ({
      collection: collectionsById.get(collectionId) as Collection,
      rolls: groupedRolls,
    }),
  );

  return { collectionGroups, unassignedRolls };
};
