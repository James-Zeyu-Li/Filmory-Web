import type { Camera, Roll } from '../db/schema';

const DAY_MS = 24 * 60 * 60 * 1000;
// How long since the last shoot still counts as "recent" rather than a long
// silence. Film shooting is bursty (trips, then weeks of nothing), so this is
// a soft UX tuning knob, not a modeled product contract — adjust freely.
const RECENT_SHOOT_THRESHOLD_DAYS = 60;

export type ArchiveHighlight =
  | { kind: 'comparison'; camera: Camera; currentCount: number; previousCount: number }
  | { kind: 'currentMonthFact'; camera: Camera; currentCount: number }
  | { kind: 'currentMonthGeneric'; currentCount: number }
  | { kind: 'recentShoot'; camera: Camera; daysSince: number }
  | { kind: 'recentShootGeneric'; daysSince: number }
  | { kind: 'allTime'; camera: Camera; totalCount: number }
  | { kind: 'allTimeGeneric'; totalCount: number }
  | { kind: 'empty' };

type TopPick = { id: string; count: number };

/**
 * Picks the single highest-count camera id, skipping ids that no longer
 * resolve to a real camera. A genuine tie is reported as 'tie' — callers must
 * not break it by name/alphabetical order or any other implicit rule, same
 * anti-fabrication rule already established in instantArchiveSummary.ts.
 */
const pickTopCamera = (counts: Map<string, number>, isResolvable: (id: string) => boolean): TopPick | 'tie' | undefined => {
  const distinctCounts = [...new Set(counts.values())].sort((a, b) => b - a);
  for (const count of distinctCounts) {
    const idsAtCount = [...counts.entries()]
      .filter(([, c]) => c === count)
      .map(([id]) => id)
      .filter(isResolvable);
    if (idsAtCount.length === 0) continue;
    if (idsAtCount.length > 1) return 'tie';
    return { id: idsAtCount[0], count };
  }
  return undefined;
};

// Mirrors the camera badge already shown per active roll on this Dashboard —
// the roll's current body, falling back to the first body it was ever loaded
// into. Not the cross-transfer attribution StatsView uses, since this is a
// lightweight highlight rather than a rigorous usage report.
const getRollCameraId = (roll: Roll): string | undefined => roll.currentCameraId || roll.cameraIds?.[0];

const monthKey = (timestamp: number): string => {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${date.getMonth()}`;
};

const previousMonthKey = (timestamp: number): string => {
  const date = new Date(timestamp);
  date.setMonth(date.getMonth() - 1);
  return `${date.getFullYear()}-${date.getMonth()}`;
};

const countByCamera = (rolls: Roll[]): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const roll of rolls) {
    const cameraId = getRollCameraId(roll);
    if (!cameraId) continue;
    counts.set(cameraId, (counts.get(cameraId) ?? 0) + 1);
  }
  return counts;
};

/**
 * Resolves the single most meaningful, non-judgmental fact about the user's
 * shooting activity, in priority order:
 *   1. A unique top camera this month with a higher count than last month.
 *   2. A unique top camera this month (flat or lower than last month — the
 *      decline itself is Insights' job to show, not this card's).
 *   3. Any activity this month without a unique top camera (tie).
 *   4. No activity this month, but a shoot recent enough to still feel current.
 *   5. No recent activity — fall back to the all-time most-used camera.
 *   6. No rolls at all.
 *
 * Deliberately scoped to the camera dimension only (see CONTROL_CENTER_TODO.md)
 * and driven entirely by `roll.startDate` — this answers "what did the user do
 * this month", not "what did they finish", so an in-progress roll still counts.
 */
export const resolveArchiveHighlight = (
  rolls: readonly Roll[],
  cameras: readonly Camera[],
  now: number = Date.now(),
): ArchiveHighlight => {
  if (rolls.length === 0) return { kind: 'empty' };

  const findCamera = (id: string) => cameras.find(camera => camera.id === id);
  const datedRolls = rolls.filter((roll): roll is Roll & { startDate: number } => typeof roll.startDate === 'number');

  const currentMonth = monthKey(now);
  const previousMonth = previousMonthKey(now);
  const currentMonthRolls = datedRolls.filter(roll => monthKey(roll.startDate) === currentMonth);

  if (currentMonthRolls.length > 0) {
    const currentCounts = countByCamera(currentMonthRolls);
    const winner = pickTopCamera(currentCounts, id => Boolean(findCamera(id)));

    if (winner && winner !== 'tie') {
      const camera = findCamera(winner.id)!;
      const previousCount = datedRolls.filter(
        roll => monthKey(roll.startDate) === previousMonth && getRollCameraId(roll) === winner.id,
      ).length;

      // A comparison only makes sense when last month also had activity to
      // compare against — "1 roll this month vs. 0 last month" is a new-user
      // fact, not a meaningful trend, so it degrades to the neutral fact too.
      return previousCount > 0 && previousCount < winner.count
        ? { kind: 'comparison', camera, currentCount: winner.count, previousCount }
        : { kind: 'currentMonthFact', camera, currentCount: winner.count };
    }

    return { kind: 'currentMonthGeneric', currentCount: currentMonthRolls.length };
  }

  const mostRecentRoll = [...datedRolls].sort((a, b) => b.startDate - a.startDate)[0];
  if (mostRecentRoll) {
    const daysSince = Math.floor((now - mostRecentRoll.startDate) / DAY_MS);
    if (daysSince <= RECENT_SHOOT_THRESHOLD_DAYS) {
      const cameraId = getRollCameraId(mostRecentRoll);
      const camera = cameraId ? findCamera(cameraId) : undefined;
      return camera ? { kind: 'recentShoot', camera, daysSince } : { kind: 'recentShootGeneric', daysSince };
    }
  }

  const allTimeCounts = countByCamera(rolls as Roll[]);
  const allTimeWinner = pickTopCamera(allTimeCounts, id => Boolean(findCamera(id)));
  if (allTimeWinner && allTimeWinner !== 'tie') {
    const camera = findCamera(allTimeWinner.id)!;
    return { kind: 'allTime', camera, totalCount: allTimeWinner.count };
  }

  return { kind: 'allTimeGeneric', totalCount: rolls.length };
};
