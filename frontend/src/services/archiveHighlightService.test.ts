import { describe, expect, it } from 'vitest';
import type { Camera, Roll } from '../db/schema';
import { resolveArchiveHighlight } from './archiveHighlightService';

// Fixed "today" so month/day-since math is deterministic across test runs.
const NOW = new Date('2026-08-30T12:00:00Z').getTime();
const AUG = (day: number) => new Date(`2026-08-${String(day).padStart(2, '0')}T09:00:00Z`).getTime();
const JUL = (day: number) => new Date(`2026-07-${String(day).padStart(2, '0')}T09:00:00Z`).getTime();
const DAYS_AGO = (days: number) => NOW - days * 24 * 60 * 60 * 1000;

const camera = (id: string, name: string): Camera => ({
  id, name, type: 'film', format: '135', addedAt: 0,
});

const roll = (id: string, overrides: Partial<Roll> = {}): Roll => ({
  id, name: `roll-${id}`, cameraIds: [], status: 'active', ...overrides,
});

describe('resolveArchiveHighlight', () => {
  it('reports no data when the user has no rolls at all', () => {
    expect(resolveArchiveHighlight([], [], NOW)).toEqual({ kind: 'empty' });
  });

  it('shows a positive comparison when this month beats the same camera last month', () => {
    const cameras = [camera('cam-1', 'Canon QL19')];
    const rolls = [
      roll('r1', { currentCameraId: 'cam-1', startDate: AUG(2) }),
      roll('r2', { currentCameraId: 'cam-1', startDate: AUG(10) }),
      roll('r3', { currentCameraId: 'cam-1', startDate: JUL(5) }),
    ];

    expect(resolveArchiveHighlight(rolls, cameras, NOW)).toEqual({
      kind: 'comparison', camera: cameras[0], currentCount: 2, previousCount: 1,
    });
  });

  it('never compares against an empty previous month, even though the count is technically higher', () => {
    const cameras = [camera('cam-1', 'Canon QL19')];
    const rolls = [roll('r1', { currentCameraId: 'cam-1', startDate: AUG(2) })];

    expect(resolveArchiveHighlight(rolls, cameras, NOW)).toEqual({
      kind: 'currentMonthFact', camera: cameras[0], currentCount: 1,
    });
  });

  it('degrades to a neutral current-month fact when this month is flat vs. last month', () => {
    const cameras = [camera('cam-1', 'Canon QL19')];
    const rolls = [
      roll('r1', { currentCameraId: 'cam-1', startDate: AUG(2) }),
      roll('r2', { currentCameraId: 'cam-1', startDate: JUL(5) }),
    ];

    expect(resolveArchiveHighlight(rolls, cameras, NOW)).toEqual({
      kind: 'currentMonthFact', camera: cameras[0], currentCount: 1,
    });
  });

  it('degrades to a neutral current-month fact when this month is lower than last month (never shows a decline)', () => {
    const cameras = [camera('cam-1', 'Canon QL19')];
    const rolls = [
      roll('r1', { currentCameraId: 'cam-1', startDate: AUG(2) }),
      roll('r2', { currentCameraId: 'cam-1', startDate: JUL(1) }),
      roll('r3', { currentCameraId: 'cam-1', startDate: JUL(15) }),
    ];

    const result = resolveArchiveHighlight(rolls, cameras, NOW);
    expect(result.kind).toBe('currentMonthFact');
    expect(result).not.toHaveProperty('previousCount');
  });

  it('falls back to a generic current-month count when two cameras tie this month', () => {
    const cameras = [camera('cam-1', 'Canon QL19'), camera('cam-2', 'Minolta SRT202')];
    const rolls = [
      roll('r1', { currentCameraId: 'cam-1', startDate: AUG(2) }),
      roll('r2', { currentCameraId: 'cam-2', startDate: AUG(3) }),
    ];

    expect(resolveArchiveHighlight(rolls, cameras, NOW)).toEqual({
      kind: 'currentMonthGeneric', currentCount: 2,
    });
  });

  it('shows a recent-shoot highlight when there is no activity this month but a recent one', () => {
    const cameras = [camera('cam-1', 'Canon QL19')];
    const rolls = [roll('r1', { currentCameraId: 'cam-1', startDate: DAYS_AGO(45) })];

    expect(resolveArchiveHighlight(rolls, cameras, NOW)).toEqual({
      kind: 'recentShoot', camera: cameras[0], daysSince: 45,
    });
  });

  it('drops the camera name from the recent-shoot highlight when it no longer resolves', () => {
    const rolls = [roll('r1', { currentCameraId: 'deleted-cam', startDate: DAYS_AGO(50) })];

    expect(resolveArchiveHighlight(rolls, [], NOW)).toEqual({
      kind: 'recentShootGeneric', daysSince: 50,
    });
  });

  it('falls back to the all-time top camera once the last shoot is no longer recent', () => {
    const cameras = [camera('cam-1', 'Canon QL19'), camera('cam-2', 'Minolta SRT202')];
    const rolls = [
      roll('r1', { currentCameraId: 'cam-1', startDate: DAYS_AGO(400) }),
      roll('r2', { currentCameraId: 'cam-1', startDate: DAYS_AGO(300) }),
      roll('r3', { currentCameraId: 'cam-2', startDate: DAYS_AGO(200) }),
      roll('r4', { currentCameraId: 'cam-1', startDate: DAYS_AGO(100) }),
    ];

    expect(resolveArchiveHighlight(rolls, cameras, NOW)).toEqual({
      kind: 'allTime', camera: cameras[0], totalCount: 3,
    });
  });

  it('falls back to a generic all-time count when the last shoot is old and cameras tie all-time', () => {
    const cameras = [camera('cam-1', 'Canon QL19'), camera('cam-2', 'Minolta SRT202')];
    const rolls = [
      roll('r1', { currentCameraId: 'cam-1', startDate: DAYS_AGO(400) }),
      roll('r2', { currentCameraId: 'cam-2', startDate: DAYS_AGO(300) }),
    ];

    expect(resolveArchiveHighlight(rolls, cameras, NOW)).toEqual({
      kind: 'allTimeGeneric', totalCount: 2,
    });
  });

  it('never fabricates a decline: a lower-but-nonzero current month still reads as a plain fact, not a comparison', () => {
    const cameras = [camera('cam-1', 'Canon QL19')];
    const rolls = [
      roll('r1', { currentCameraId: 'cam-1', startDate: AUG(1) }),
      roll('r2', { currentCameraId: 'cam-1', startDate: JUL(1) }),
      roll('r3', { currentCameraId: 'cam-1', startDate: JUL(10) }),
      roll('r4', { currentCameraId: 'cam-1', startDate: JUL(20) }),
    ];

    const result = resolveArchiveHighlight(rolls, cameras, NOW);
    expect(result.kind).toBe('currentMonthFact');
  });

  it('counts a roll toward this month based on startDate, even if it has not finished (in-progress roll)', () => {
    const cameras = [camera('cam-1', 'Canon QL19')];
    const rolls = [roll('r1', { currentCameraId: 'cam-1', status: 'active', startDate: AUG(28) })];

    const result = resolveArchiveHighlight(rolls, cameras, NOW);
    expect(result.kind).toBe('currentMonthFact');
  });
});
