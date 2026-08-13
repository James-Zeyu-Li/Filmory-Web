import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '../db/schema';
import { BackupService } from '../services/backupService';
import { importExcelDataFromFile } from '../services/importExcelData';
import * as FileSaver from 'file-saver';
import * as XLSX from 'xlsx';

// Helper to intercept file-saver so we can inspect the generated Excel blob.
vi.mock('file-saver', () => ({
  saveAs: vi.fn(),
}));

describe('Tenant Isolation Breach Defenses (Multi-Tenant)', () => {
  beforeEach(async () => {
    await db.cameras.clear();
    await db.lenses.clear();
    await db.filmStocks.clear();
    await db.rolls.clear();
    await db.ledgerTransactions.clear();
    await db.syncQueue.clear();
    vi.clearAllMocks();
  });

  it('should absolutely NEVER export User B data when User A requests a backup', async () => {
    // 1. Seed cross-tenant data
    await db.cameras.bulkAdd([
      { id: 'cam_user_A', userId: 'user_A', name: 'Leica M6', type: 'film', format: '135', createdAt: Date.now() },
      { id: 'cam_user_B', userId: 'user_B', name: 'Hasselblad 500CM', type: 'film', format: '120', createdAt: Date.now() }
    ]);

    // 2. Mock Blob text() to read the payload
    const saveAsSpy = vi.mocked(FileSaver.saveAs);

    // 3. User A triggers backup
    await BackupService.exportDatabaseToExcel('user_A');

    // 4. Extract the Excel workbook payload injected into Blob
    expect(saveAsSpy).toHaveBeenCalled();
    const blobArg = saveAsSpy.mock.calls[0][0] as Blob;
    expect(blobArg).toBeInstanceOf(Blob);

    const workbook = XLSX.read(await blobArg.arrayBuffer(), { type: 'array' });
    const camerasSheet = workbook.Sheets['相机机身'];
    expect(camerasSheet).toBeDefined();

    // 5. Assert: User B's camera must NOT be in the export payload
    const exportedCameras = XLSX.utils.sheet_to_json<any>(camerasSheet);
    expect(exportedCameras.length).toBe(1);
    expect(exportedCameras[0]['名称']).toBe('Leica M6');
    
    // Assert strictly that User B's Hasselblad is nowhere to be found
    const hasUserB = exportedCameras.some((c: any) => c['名称'] === 'Hasselblad 500CM');
    expect(hasUserB).toBe(false);
  });

  it('exports every camera involved in a roll under the participating cameras column', async () => {
    await db.cameras.bulkAdd([
      { id: 'cam-a', userId: 'user_A', name: 'Leica M6', type: 'film', format: '135', addedAt: Date.now() },
      { id: 'cam-b', userId: 'user_A', name: 'Nikon F3', type: 'film', format: '135', addedAt: Date.now() },
    ]);
    await db.rolls.add({
      id: 'roll-a',
      userId: 'user_A',
      name: 'City walk',
      currentCameraId: 'cam-b',
      cameraIds: ['cam-a', 'cam-b'],
      status: 'active',
      startDate: Date.now(),
    });

    await BackupService.exportDatabaseToExcel('user_A');

    const blob = vi.mocked(FileSaver.saveAs).mock.calls[0][0] as Blob;
    const workbook = XLSX.read(await blob.arrayBuffer(), { type: 'array' });
    const rollsSheet = workbook.Sheets['拍摄任务'];
    const exportedRolls = XLSX.utils.sheet_to_json<Record<string, string>>(rollsSheet);

    expect(exportedRolls[0]).toMatchObject({
      '参与机身': 'Leica M6, Nikon F3',
    });
    expect(exportedRolls[0]).not.toHaveProperty('使用相机');
  });

  it('should import Excel rows into the current user without reusing another user same-name gear', async () => {
    await db.cameras.add({
      id: 'cam_user_B',
      userId: 'user_B',
      name: 'Leica M6',
      type: 'film',
      format: '135',
      addedAt: Date.now()
    });
    await db.filmStocks.add({
      id: 'film_user_B',
      userId: 'user_B',
      brand: 'Kodak',
      name: 'Gold 200',
      iso: 200,
      colorType: 'color',
      format: '135',
      isSystem: 0,
      stockCount: 8,
      addedAt: Date.now()
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
      { '相机名称 (必填)': 'Leica M6', '类型 (film/digital)': 'film', '画幅 (135/120/digital)': '135' }
    ]), '相机机身');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
      { '品牌 (必填)': 'Kodak', '型号名称 (必填)': 'Gold 200', 'ISO (必填)': 200, '类型 (color/bw)': 'color', '画幅 (135/120)': '135', '初始库存数量': 3 }
    ]), '胶卷库存');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
      { '拍摄主题名称 (必填)': 'Spring Walk', '相机名称 (必填)': 'Leica M6', '胶卷品牌 (仅胶片)': 'Kodak', '胶卷型号 (仅胶片)': 'Gold 200' }
    ]), '拍摄任务');

    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const file = new File([buffer], 'tenant-import.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    const summary: any = await importExcelDataFromFile(file, 'user_A');

    expect(summary.camerasAdded).toBe(1);
    expect(summary.filmsAdded).toBe(1);
    expect(summary.rollsAdded).toBe(1);

    const userACamera = (await db.cameras.where('userId').equals('user_A').toArray())[0];
    const userAFilm = (await db.filmStocks.where('userId').equals('user_A').toArray())[0];
    const userARoll = (await db.rolls.where('userId').equals('user_A').toArray())[0];
    const userBFilm = await db.filmStocks.get('film_user_B');

    expect(userACamera?.name).toBe('Leica M6');
    expect(userACamera?.id).not.toBe('cam_user_B');
    expect(userAFilm?.id).not.toBe('film_user_B');
    expect(userARoll?.userId).toBe('user_A');
    expect(userARoll?.currentCameraId).toBe(userACamera.id);
    expect(userARoll?.cameraIds).toEqual([userACamera.id]);
    expect(userARoll?.filmStockId).toBe(userAFilm.id);
    expect(userBFilm?.stockCount).toBe(8);
  });
});
