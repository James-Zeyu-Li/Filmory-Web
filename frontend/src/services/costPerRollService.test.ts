import { describe, expect, it } from 'vitest';
import type { Roll } from '../db/schema';
import { resolveAverageCostPerRoll } from './costPerRollService';

const roll = (id: string, overrides: Partial<Roll> = {}): Roll => ({
  id, name: `roll-${id}`, cameraIds: [], status: 'archived', filmStockId: 'film-1', ...overrides,
});

describe('resolveAverageCostPerRoll', () => {
  it('returns null when there are no rolls at all', () => {
    expect(resolveAverageCostPerRoll([])).toBeNull();
  });

  it('returns null when only one roll has complete cost data (not an average yet)', () => {
    const rolls = [roll('r1', { filmPrice: 10, developPrice: 8 })];
    expect(resolveAverageCostPerRoll(rolls)).toBeNull();
  });

  it('computes the average across archived rolls with both prices present', () => {
    const rolls = [
      roll('r1', { filmPrice: 10, developPrice: 8 }),
      roll('r2', { filmPrice: 20, developPrice: 12 }),
    ];
    expect(resolveAverageCostPerRoll(rolls)).toEqual({ averageCost: 25, eligibleCount: 2 });
  });

  it('excludes a roll missing developPrice, and does not treat the missing value as $0', () => {
    const rolls = [
      roll('r1', { filmPrice: 10, developPrice: 8 }),
      roll('r2', { filmPrice: 20, developPrice: 12 }),
      roll('r3', { filmPrice: 5 }), // developPrice missing entirely
    ];
    expect(resolveAverageCostPerRoll(rolls)).toEqual({ averageCost: 25, eligibleCount: 2 });
  });

  it('excludes active (not yet archived) rolls even when both prices are already filled in', () => {
    const rolls = [
      roll('r1', { filmPrice: 10, developPrice: 8 }),
      roll('r2', { filmPrice: 20, developPrice: 12 }),
      roll('r3', { status: 'active', filmPrice: 30, developPrice: 30 }),
    ];
    expect(resolveAverageCostPerRoll(rolls)).toEqual({ averageCost: 25, eligibleCount: 2 });
  });

  it('excludes digital-placeholder rolls', () => {
    const rolls = [
      roll('r1', { filmPrice: 10, developPrice: 8 }),
      roll('r2', { filmPrice: 20, developPrice: 12 }),
      roll('r3', { filmStockId: 'digital-placeholder', filmPrice: 0, developPrice: 0 }),
    ];
    expect(resolveAverageCostPerRoll(rolls)).toEqual({ averageCost: 25, eligibleCount: 2 });
  });

  it('treats a roll with developPrice: 0 (a real free/waived cost) as eligible, unlike a missing value', () => {
    const rolls = [
      roll('r1', { filmPrice: 10, developPrice: 0 }),
      roll('r2', { filmPrice: 20, developPrice: 12 }),
    ];
    expect(resolveAverageCostPerRoll(rolls)).toEqual({ averageCost: 21, eligibleCount: 2 });
  });
});
