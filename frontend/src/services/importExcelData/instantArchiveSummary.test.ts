import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../db/schema';
import { buildInstantArchiveSummary } from './instantArchiveSummary';

const USER_ID = 'archive-user';

const addCamera = (id: string, name: string, userId = USER_ID) => db.cameras.add({
  id, userId, name, type: 'film', format: '135', addedAt: Date.now(),
});

const addFilmStock = (id: string, brand: string, name: string, userId = USER_ID) => db.filmStocks.add({
  id, userId, brand, name, iso: 200, colorType: 'color', format: '135', isSystem: 0, addedAt: Date.now(),
});

const addRoll = (id: string, overrides: Partial<Parameters<typeof db.rolls.add>[0]> = {}) => db.rolls.add({
  id, userId: USER_ID, name: `roll-${id}`, cameraIds: [], status: 'active', startDate: Date.now(), ...overrides,
});

describe('buildInstantArchiveSummary', () => {
  beforeEach(async () => {
    await db.cameras.clear();
    await db.filmStocks.clear();
    await db.rolls.clear();
  });

  it('reports a clear top camera, top film stock, and date range for a data-rich import', async () => {
    await addCamera('cam-1', 'Nikon F3');
    await addFilmStock('film-1', 'Kodak', 'Gold 200');
    await addRoll('roll-1', { currentCameraId: 'cam-1', filmStockId: 'film-1', startDate: 1000 });
    await addRoll('roll-2', { currentCameraId: 'cam-1', filmStockId: 'film-1', startDate: 5000 });
    await addRoll('roll-3', { currentCameraId: 'cam-1', filmStockId: 'film-1', startDate: 2000 });

    const summary = await buildInstantArchiveSummary(['roll-1', 'roll-2', 'roll-3'], USER_ID);

    expect(summary.importedRollCount).toBe(3);
    expect(summary.dateRange).toEqual({ earliest: 1000, latest: 5000 });
    expect(summary.topCamera).toMatchObject({ cameraId: 'cam-1', name: 'Nikon F3', count: 3 });
    expect(summary.topFilmStock).toMatchObject({ filmStockId: 'film-1', count: 3 });
    expect(summary.isFallbackSummary).toBe(false);
  });

  it('degrades to a fallback summary when the sample size is insufficient (0-1 rolls)', async () => {
    await addCamera('cam-1', 'Nikon F3');
    await addRoll('roll-1', { currentCameraId: 'cam-1', startDate: 1000 });

    const summary = await buildInstantArchiveSummary(['roll-1'], USER_ID);

    expect(summary.importedRollCount).toBe(1);
    expect(summary.topCamera).toBeUndefined();
    expect(summary.isFallbackSummary).toBe(true);
  });

  it('omits topCamera and marks fallback when two cameras are exactly tied', async () => {
    await addCamera('cam-1', 'Nikon F3');
    await addCamera('cam-2', 'Canon AE-1');
    await addRoll('roll-1', { currentCameraId: 'cam-1', startDate: 1000 });
    await addRoll('roll-2', { currentCameraId: 'cam-2', startDate: 2000 });

    const summary = await buildInstantArchiveSummary(['roll-1', 'roll-2'], USER_ID);

    expect(summary.topCamera).toBeUndefined();
    expect(summary.isFallbackSummary).toBe(true);
  });

  it('omits dateRange when no imported roll has a start date', async () => {
    await addCamera('cam-1', 'Nikon F3');
    await addRoll('roll-1', { currentCameraId: 'cam-1', startDate: undefined });
    await addRoll('roll-2', { currentCameraId: 'cam-1', startDate: undefined });

    const summary = await buildInstantArchiveSummary(['roll-1', 'roll-2'], USER_ID);

    expect(summary.dateRange).toBeUndefined();
  });

  it('falls through to the next-ranked camera when the top-ranked one no longer resolves for this user', async () => {
    // cam-1 is referenced by the most rolls but has since been removed
    // (analogous to a soft-deleted / no-longer-available record).
    await addCamera('cam-2', 'Canon AE-1');
    await addRoll('roll-1', { currentCameraId: 'cam-1', startDate: 1000 });
    await addRoll('roll-2', { currentCameraId: 'cam-1', startDate: 2000 });
    await addRoll('roll-3', { currentCameraId: 'cam-2', startDate: 3000 });

    const summary = await buildInstantArchiveSummary(['roll-1', 'roll-2', 'roll-3'], USER_ID);

    expect(summary.topCamera).toMatchObject({ cameraId: 'cam-2', count: 1 });
  });

  it('excludes rolls and cameras belonging to another user from every count', async () => {
    await addCamera('cam-other', 'Other User Camera', 'other-user');
    await db.rolls.add({
      id: 'roll-other', userId: 'other-user', name: 'other roll', cameraIds: [],
      currentCameraId: 'cam-other', status: 'active', startDate: 9999,
    });
    await addCamera('cam-1', 'Nikon F3');
    await addRoll('roll-1', { currentCameraId: 'cam-1', startDate: 1000 });
    await addRoll('roll-2', { currentCameraId: 'cam-1', startDate: 2000 });

    // Even if a caller mistakenly passes another user's roll id alongside
    // this user's own, it must never leak into the summary.
    const summary = await buildInstantArchiveSummary(['roll-1', 'roll-2', 'roll-other'], USER_ID);

    expect(summary.importedRollCount).toBe(2);
    expect(summary.dateRange).toEqual({ earliest: 1000, latest: 2000 });
  });

  it('returns an empty fallback summary for zero created rolls', async () => {
    const summary = await buildInstantArchiveSummary([], USER_ID);
    expect(summary).toEqual({ importedRollCount: 0, isFallbackSummary: true });
  });
});
