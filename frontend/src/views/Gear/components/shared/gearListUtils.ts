import { useDeferredValue, useMemo } from 'react';

export type GearSort = 'date' | 'name';

type SearchableGear = {
  addedAt?: number;
  brand?: string;
  name?: string;
  type?: string;
};

/** Keeps expensive card filtering behind a deferred query rather than the input's urgent render. */
export const useFilteredGearItems = <T extends SearchableGear>(
  items: readonly T[],
  searchQuery: string,
  sortBy: GearSort,
) => {
  const deferredSearchQuery = useDeferredValue(searchQuery);

  return useMemo(() => {
    const normalizedQuery = deferredSearchQuery.trim().toLocaleLowerCase();
    const filtered = normalizedQuery.length === 0
      ? items
      : items.filter(item => (
          item.name?.toLocaleLowerCase().includes(normalizedQuery)
          || item.brand?.toLocaleLowerCase().includes(normalizedQuery)
          || item.type?.toLocaleLowerCase().includes(normalizedQuery)
        ));

    return filtered.toSorted((left, right) => {
      if (sortBy === 'date') {
        return (right.addedAt ?? 0) - (left.addedAt ?? 0);
      }
      return (left.name ?? left.brand ?? '').localeCompare(right.name ?? right.brand ?? '');
    });
  }, [deferredSearchQuery, items, sortBy]);
};
