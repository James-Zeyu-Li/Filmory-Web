import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as XLSX from 'xlsx';
import { db } from '../../db/schema';
import * as syncEvents from '../syncEvents';
import { commitExcelImport, parseAndValidateExcelImport } from './commitImport';

const USER_ID = 'commit-user-1';

const createImportFile = (sheets: Record<string, Record<string, unknown>[]>) => {
  const workbook = XLSX.utils.book_new();
  Object.entries(sheets).forEach(([name, rows]) => {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), name);
  });
  return new File([XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })], 'import.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
};

const countsFor = async () => ({
  cameras: await db.cameras.where('userId').equals(USER_ID).count(),
  filmStocks: await db.filmStocks.where('userId').equals(USER_ID).count(),
  rolls: await db.rolls.where('userId').equals(USER_ID).count(),
  ledger: await db.ledgerTransactions.where('userId').equals(USER_ID).count(),
  syncQueue: await db.syncQueue.where('userId').equals(USER_ID).count(),
});

describe('commitExcelImport', () => {
  beforeEach(async () => {
    await db.cameras.clear();
    await db.lenses.clear();
    await db.filmStocks.clear();
    await db.rolls.clear();
    await db.ledgerTransactions.clear();
    await db.syncQueue.clear();
    vi.restoreAllMocks();
  });

  it('commits a full valid import, creating every entity and enqueueing sync entries before returning', async () => {
    const file = createImportFile({
      '相机机身': [{ '相机名称 (必填)': 'Nikon F3', '类型 (film/digital)': 'film', '画幅 (135/120/digital)': '135' }],
      '胶卷库存': [{ '品牌 (必填)': 'Kodak', '型号名称 (必填)': 'Gold 200', 'ISO (必填)': 200, '初始库存数量': 3, '单卷均价 (选填)': 60 }],
      '拍摄任务': [{ '拍摄主题名称 (必填)': 'Spring Walk', '相机名称 (必填)': 'Nikon F3', '胶卷品牌 (仅胶片)': 'Kodak', '胶卷型号 (仅胶片)': 'Gold 200', '冲洗花费 (选填)': 30 }],
    });

    const preview = await parseAndValidateExcelImport(file, USER_ID);
    const result = await commitExcelImport(preview, {}, USER_ID);

    expect(result.createdCounts).toMatchObject({ camera: 1, filmStock: 1, roll: 1 });
    const counts = await countsFor();
    expect(counts).toMatchObject({ cameras: 1, filmStocks: 1, rolls: 1, ledger: 2 });
    // Proves the syncQueue write isn't deferred to the transaction's async
    // 'complete' hook: these entries must already be visible synchronously
    // right after commitExcelImport's returned promise resolves.
    expect(counts.syncQueue).toBeGreaterThan(0);
  });

  it('rolls back every table (including syncQueue) when a write fails partway through the transaction', async () => {
    const file = createImportFile({
      '相机机身': [{ '相机名称 (必填)': 'Nikon F3', '类型 (film/digital)': 'film', '画幅 (135/120/digital)': '135' }],
      '胶卷库存': [{ '品牌 (必填)': 'Kodak', '型号名称 (必填)': 'Gold 200', 'ISO (必填)': 200, '初始库存数量': 3 }],
      '拍摄任务': [{ '拍摄主题名称 (必填)': 'Spring Walk', '相机名称 (必填)': 'Nikon F3', '胶卷品牌 (仅胶片)': 'Kodak', '胶卷型号 (仅胶片)': 'Gold 200' }],
    });
    const preview = await parseAndValidateExcelImport(file, USER_ID);

    vi.spyOn(db.rolls, 'add').mockImplementationOnce(() => {
      throw new Error('simulated mid-import failure');
    });

    await expect(commitExcelImport(preview, {}, USER_ID)).rejects.toThrow('simulated mid-import failure');

    expect(await countsFor()).toEqual({ cameras: 0, filmStocks: 0, rolls: 0, ledger: 0, syncQueue: 0 });
  });

  it('rejects an "update" duplicate choice outright, writing nothing', async () => {
    await db.cameras.add({ id: 'existing-cam', userId: USER_ID, name: 'Nikon F3', type: 'film', format: '135', addedAt: Date.now() });
    const file = createImportFile({
      '相机机身': [{ '相机名称 (必填)': 'Nikon F3', '类型 (film/digital)': 'film', '画幅 (135/120/digital)': '135' }],
    });
    const preview = await parseAndValidateExcelImport(file, USER_ID);
    expect(preview.duplicateGroups).toHaveLength(1);
    const groupId = preview.duplicateGroups[0].id;
    await db.syncQueue.clear(); // drop the seed write's own sync record

    await expect(
      commitExcelImport(preview, { [groupId]: 'update' }, USER_ID),
    ).rejects.toThrow(/not supported/);

    // Zero *new* writes — only the pre-seeded existing camera remains.
    expect(await db.cameras.where('userId').equals(USER_ID).count()).toBe(1);
    expect(await db.syncQueue.where('userId').equals(USER_ID).count()).toBe(0);
  });

  it('does not call requestImmediateSync or write any syncQueue entry when every row resolves to skip', async () => {
    await db.cameras.add({ id: 'existing-cam', userId: USER_ID, name: 'Nikon F3', type: 'film', format: '135', addedAt: Date.now() });
    const file = createImportFile({
      '相机机身': [{ '相机名称 (必填)': 'Nikon F3', '类型 (film/digital)': 'film', '画幅 (135/120/digital)': '135' }],
    });
    const preview = await parseAndValidateExcelImport(file, USER_ID);
    await db.syncQueue.clear(); // drop the seed write's own sync record
    const syncSpy = vi.spyOn(syncEvents, 'requestImmediateSync');

    const result = await commitExcelImport(preview, {}, USER_ID);

    expect(result.createdCounts.camera).toBe(0);
    expect(result.skippedCounts.camera).toBe(1);
    expect(syncSpy).not.toHaveBeenCalled();
    expect(await db.syncQueue.where('userId').equals(USER_ID).count()).toBe(0);
  });

  it('re-validates duplicates live at commit time instead of trusting a stale preview snapshot', async () => {
    const file = createImportFile({
      '相机机身': [{ '相机名称 (必填)': 'Nikon F3', '类型 (film/digital)': 'film', '画幅 (135/120/digital)': '135' }],
    });
    // No existing camera yet — preview finds no duplicate for this row.
    const preview = await parseAndValidateExcelImport(file, USER_ID);
    expect(preview.duplicateGroups).toHaveLength(0);

    // Simulates a concurrent tab creating the same-named camera between
    // preview and commit.
    await db.cameras.add({ id: 'concurrently-created', userId: USER_ID, name: 'Nikon F3', type: 'film', format: '135', addedAt: Date.now() });

    const result = await commitExcelImport(preview, {}, USER_ID);

    expect(result.createdCounts.camera).toBe(0);
    expect(result.skippedCounts.camera).toBe(1);
    expect(await db.cameras.where('userId').equals(USER_ID).count()).toBe(1);
  });

  it('links a Roll to the specific "import as new" draft camera, not the pre-existing same-named one', async () => {
    // Digital, so the Roll row needs no film brand/model to resolve — this
    // test is about camera rowRef resolution, not film requirements.
    await db.cameras.add({ id: 'existing-cam', userId: USER_ID, name: 'Nikon F3', type: 'digital', format: 'digital', addedAt: Date.now() });
    const file = createImportFile({
      '相机机身': [{ '相机名称 (必填)': 'Nikon F3', '类型 (film/digital)': 'digital' }],
      '拍摄任务': [{ '拍摄主题名称 (必填)': 'Spring Walk', '相机名称 (必填)': 'Nikon F3' }],
    });
    const preview = await parseAndValidateExcelImport(file, USER_ID);
    const groupId = preview.duplicateGroups[0].id;

    const result = await commitExcelImport(preview, { [groupId]: 'import-as-new' }, USER_ID);

    expect(result.createdCounts.camera).toBe(1);
    expect(await db.cameras.where('userId').equals(USER_ID).count()).toBe(2);
    const [createdRoll] = await db.rolls.where('userId').equals(USER_ID).toArray();
    expect(createdRoll.currentCameraId).not.toBe('existing-cam');
  });

  it('rejects a Roll row whose camera name matches two same-name drafts in the same workbook', async () => {
    const file = createImportFile({
      '相机机身': [
        { '相机名称 (必填)': 'Nikon F3', '类型 (film/digital)': 'film', '画幅 (135/120/digital)': '135' },
        { '相机名称 (必填)': 'Nikon F3', '类型 (film/digital)': 'film', '画幅 (135/120/digital)': '135' },
      ],
      '拍摄任务': [{ '拍摄主题名称 (必填)': 'Spring Walk', '相机名称 (必填)': 'Nikon F3' }],
    });

    const preview = await parseAndValidateExcelImport(file, USER_ID);

    const rollRow = preview.rows.rolls[0];
    expect(rollRow.status).toBe('rejected');
    expect(rollRow.issues.some(issue => issue.reasonKey === 'excel.reasonAmbiguousDraftReference')).toBe(true);
  });

  it('rejects a Roll row referencing a camera draft that itself failed validation, without falling back to an existing record', async () => {
    await db.cameras.add({ id: 'existing-cam', userId: USER_ID, name: 'Nikon F3', type: 'film', format: '135', addedAt: Date.now() });
    const file = createImportFile({
      '相机机身': [{ '相机名称 (必填)': 'Nikon F3', '类型 (film/digital)': 'not-a-real-type' }],
      '拍摄任务': [{ '拍摄主题名称 (必填)': 'Spring Walk', '相机名称 (必填)': 'Nikon F3' }],
    });

    const preview = await parseAndValidateExcelImport(file, USER_ID);

    expect(preview.rows.cameras[0].status).toBe('rejected');
    const rollRow = preview.rows.rolls[0];
    expect(rollRow.status).toBe('rejected');
    expect(rollRow.issues.some(issue => issue.reasonKey === 'excel.reasonDraftReferenceRejected')).toBe(true);
  });
});
