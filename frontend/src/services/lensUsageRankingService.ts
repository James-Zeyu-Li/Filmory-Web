import type { Lens, Roll } from '../db/schema';

export interface LensUsageRankingEntry {
  name: string;
  count: number;
}

/**
 * Rolls used per lens, ranked descending, top 5 — the lens-side equivalent of
 * StatsView's inline camera usage ranking. Lenses have no transfer history
 * like cameras do, so a roll's own `lensIds` is already the full
 * participation list; only dedupe within one roll before counting.
 */
export const resolveLensUsageRanking = (
  rolls: readonly Roll[],
  lenses: readonly Lens[],
): LensUsageRankingEntry[] => {
  const counts = new Map<string, number>();
  rolls.forEach(roll => {
    new Set(roll.lensIds ?? []).forEach(lensId => {
      const lens = lenses.find(l => l.id === lensId);
      if (lens) counts.set(lens.name, (counts.get(lens.name) ?? 0) + 1);
    });
  });

  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
};
