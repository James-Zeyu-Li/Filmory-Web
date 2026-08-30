import type { Roll } from '../db/schema';

const MIN_SAMPLE_SIZE = 2;

export interface AverageCostPerRoll {
  averageCost: number;
  eligibleCount: number;
}

/**
 * Average film + development cost among archived film rolls with complete
 * cost data. A roll only counts when both price fields are present — a
 * missing developPrice is unknown, not $0, so treating it as 0 would quietly
 * bias the average down. Below MIN_SAMPLE_SIZE this isn't an "average" yet,
 * just an observation, so callers should show a fallback instead of a number.
 */
export const resolveAverageCostPerRoll = (rolls: readonly Roll[]): AverageCostPerRoll | null => {
  const eligibleRolls = rolls.filter(roll =>
    roll.status === 'archived' &&
    roll.filmStockId !== 'digital-placeholder' &&
    typeof roll.filmPrice === 'number' &&
    typeof roll.developPrice === 'number'
  );

  if (eligibleRolls.length < MIN_SAMPLE_SIZE) return null;

  const total = eligibleRolls.reduce((sum, roll) => sum + roll.filmPrice! + roll.developPrice!, 0);
  return { averageCost: total / eligibleRolls.length, eligibleCount: eligibleRolls.length };
};
