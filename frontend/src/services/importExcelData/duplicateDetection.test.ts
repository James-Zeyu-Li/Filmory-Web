import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../db/schema';
import { detectDuplicateGroups } from './duplicateDetection';
import type { CameraDraft, FilmStockDraft, ImportRowResult, LensDraft } from './types';

const USER_ID = 'user-dup-1';

const cameraRow = (rowRef: string, name: string): ImportRowResult<CameraDraft> => ({
  sheet: '相机机身', rowNumber: 2, rowRef, status: 'valid', issues: [], matchName: name,
  draft: { name, type: 'film', format: '135' },
});

const filmRow = (rowRef: string, brand: string, name: string): ImportRowResult<FilmStockDraft> => ({
  sheet: '胶卷库存', rowNumber: 2, rowRef, status: 'valid', issues: [], matchName: `${brand} ${name}`,
  draft: { brand, name, iso: 200, colorType: 'color', format: '135', stockCount: 0 },
});

describe('detectDuplicateGroups', () => {
  beforeEach(async () => {
    await db.cameras.clear();
    await db.lenses.clear();
    await db.filmStocks.clear();
  });

  it('groups a valid camera row against an exact-name existing record for the same user, defaulting to skip', async () => {
    await db.cameras.add({ id: 'existing-cam', userId: USER_ID, name: 'Nikon F3', type: 'film', format: '135', addedAt: Date.now() });
    const rows = [cameraRow('相机机身:2', 'Nikon F3')];

    const groups = await detectDuplicateGroups(rows, [], [], USER_ID);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ entityKind: 'camera', existing: { id: 'existing-cam' }, choice: 'skip' });
    expect(rows[0].duplicateGroupId).toBe(groups[0].id);
  });

  it('produces zero duplicate groups for names that do not exactly match any existing record', async () => {
    await db.cameras.add({ id: 'existing-cam', userId: USER_ID, name: 'Nikon F3', type: 'film', format: '135', addedAt: Date.now() });
    const rows = [cameraRow('相机机身:2', 'Nikon F3 Prime')]; // partial/similar, not exact

    const groups = await detectDuplicateGroups(rows, [], [], USER_ID);

    expect(groups).toHaveLength(0);
    expect(rows[0].duplicateGroupId).toBeUndefined();
  });

  it('does not match a same-named record belonging to a different user', async () => {
    await db.cameras.add({ id: 'other-user-cam', userId: 'other-user', name: 'Nikon F3', type: 'film', format: '135', addedAt: Date.now() });
    const rows = [cameraRow('相机机身:2', 'Nikon F3')];

    const groups = await detectDuplicateGroups(rows, [], [], USER_ID);

    expect(groups).toHaveLength(0);
  });

  it('groups film stock duplicates by exact brand+name, not name alone', async () => {
    await db.filmStocks.add({
      id: 'existing-film', userId: USER_ID, brand: 'Kodak', name: 'Gold 200', iso: 200,
      colorType: 'color', format: '135', isSystem: 0, addedAt: Date.now(),
    });
    const matchingRow = filmRow('胶卷库存:2', 'Kodak', 'Gold 200');
    const differentBrandRow = filmRow('胶卷库存:3', 'Fujifilm', 'Gold 200');

    const groups = await detectDuplicateGroups([], [], [matchingRow, differentBrandRow], USER_ID);

    expect(groups).toHaveLength(1);
    expect(groups[0].entityKind).toBe('filmStock');
    expect(matchingRow.duplicateGroupId).toBe(groups[0].id);
    expect(differentBrandRow.duplicateGroupId).toBeUndefined();
  });

  it('groups multiple incoming rows that match the same existing record into one shared group', async () => {
    await db.cameras.add({ id: 'existing-cam', userId: USER_ID, name: 'Nikon F3', type: 'film', format: '135', addedAt: Date.now() });
    const rowA = cameraRow('相机机身:2', 'Nikon F3');
    const rowB = cameraRow('相机机身:3', 'Nikon F3');

    const groups = await detectDuplicateGroups([rowA, rowB], [], [], USER_ID);

    expect(groups).toHaveLength(1);
    expect(groups[0].incomingRowRefs).toEqual(['相机机身:2', '相机机身:3']);
  });

  it('ignores lens rows already rejected in validation', async () => {
    await db.cameras.add({ id: 'existing-lens', userId: USER_ID, name: '50mm', type: 'film', format: '135', addedAt: Date.now() });
    const rejectedLens: ImportRowResult<LensDraft> = {
      sheet: '镜头', rowNumber: 2, rowRef: '镜头:2', status: 'rejected', issues: [{ field: 'x', reasonKey: 'excel.reasonRequired', severity: 'error' }],
    };

    const groups = await detectDuplicateGroups([], [rejectedLens], [], USER_ID);

    expect(groups).toHaveLength(0);
  });
});
