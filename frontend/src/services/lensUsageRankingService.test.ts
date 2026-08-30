import { describe, expect, it } from 'vitest';
import type { Lens, Roll } from '../db/schema';
import { resolveLensUsageRanking } from './lensUsageRankingService';

const lens = (id: string, name: string): Lens => ({
  id, name, focalLength: 50, maxAperture: 'f/1.4', type: 'prime', addedAt: 1,
});

const roll = (id: string, lensIds: string[]): Roll => ({
  id, name: `roll-${id}`, cameraIds: [], lensIds, status: 'archived', startDate: 1,
});

describe('resolveLensUsageRanking', () => {
  it('returns an empty list when no roll references any lens', () => {
    const lenses = [lens('lens-1', 'Rokkor-X 50mm f/1.4')];
    const rolls = [roll('r1', [])];
    expect(resolveLensUsageRanking(rolls, lenses)).toEqual([]);
  });

  it('ranks lenses by how many rolls used them, most-used first', () => {
    const lenses = [lens('lens-1', 'Rokkor-X 50mm f/1.4'), lens('lens-2', 'Rokkor PF 200mm f/4.5')];
    const rolls = [
      roll('r1', ['lens-1']),
      roll('r2', ['lens-1', 'lens-2']),
      roll('r3', ['lens-1']),
    ];
    expect(resolveLensUsageRanking(rolls, lenses)).toEqual([
      { name: 'Rokkor-X 50mm f/1.4', count: 3 },
      { name: 'Rokkor PF 200mm f/4.5', count: 1 },
    ]);
  });

  it('counts a lens only once per roll even if it appears twice in lensIds', () => {
    const lenses = [lens('lens-1', 'Rokkor-X 50mm f/1.4')];
    const rolls = [roll('r1', ['lens-1', 'lens-1'])];
    expect(resolveLensUsageRanking(rolls, lenses)).toEqual([{ name: 'Rokkor-X 50mm f/1.4', count: 1 }]);
  });

  it('ignores lens ids that no longer resolve to a lens (deleted/unknown)', () => {
    const lenses = [lens('lens-1', 'Rokkor-X 50mm f/1.4')];
    const rolls = [roll('r1', ['lens-1', 'deleted-lens'])];
    expect(resolveLensUsageRanking(rolls, lenses)).toEqual([{ name: 'Rokkor-X 50mm f/1.4', count: 1 }]);
  });

  it('caps the ranking at 5 entries', () => {
    const lenses = Array.from({ length: 7 }, (_, i) => lens(`lens-${i}`, `Lens ${i}`));
    const rolls = lenses.map((l, i) => roll(`r${i}`, [l.id as string]));
    expect(resolveLensUsageRanking(rolls, lenses)).toHaveLength(5);
  });
});
