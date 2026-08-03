import { beforeEach, describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { db } from '../db/schema';
import { importExcelDataFromFile } from '../services/importExcelData';

const createImportFile = (sheets: Record<string, Record<string, unknown>[]>) => {
  const workbook = XLSX.utils.book_new();
  Object.entries(sheets).forEach(([name, rows]) => {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), name);
  });
  return new File([XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })], 'import.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
};

describe('Excel import validation', () => {
  beforeEach(async () => {
    await Promise.all([db.cameras.clear(), db.lenses.clear(), db.filmStocks.clear(), db.rolls.clear(), db.ledgerTransactions.clear(), db.syncQueue.clear()]);
  });

  it('skips invalid rows while importing valid rows and reports row-level reasons', async () => {
    const summary = await importExcelDataFromFile(createImportFile({
      '相机机身': [
        { '相机名称 (必填)': 'Valid Camera', '类型 (film/digital)': 'film', '画幅 (135/120/digital)': '135' },
        { '相机名称 (必填)': 'Unknown Type', '类型 (film/digital)': 'instant', '画幅 (135/120/digital)': '135' },
        { '相机名称 (必填)': '' },
      ],
      '胶卷库存': [
        { '品牌 (必填)': 'Kodak', '型号名称 (必填)': 'Gold 200', 'ISO (必填)': 200, '初始库存数量': 2 },
        { '品牌 (必填)': 'Bad', '型号名称 (必填)': 'Stock', 'ISO (必填)': 200, '初始库存数量': -1 },
      ],
      '拍摄任务': [
        { '拍摄主题名称 (必填)': 'Valid roll', '相机名称 (必填)': 'Valid Camera', '胶卷品牌 (仅胶片)': 'Kodak', '胶卷型号 (仅胶片)': 'Gold 200' },
        { '拍摄主题名称 (必填)': 'Missing camera', '相机名称 (必填)': 'Not imported', '胶卷品牌 (仅胶片)': 'Kodak', '胶卷型号 (仅胶片)': 'Gold 200' },
      ],
    }), 'user-1');

    expect(summary).toMatchObject({ camerasAdded: 1, filmsAdded: 1, rollsAdded: 1 });
    expect(summary.errors).toEqual(expect.arrayContaining([
      expect.stringContaining('相机机身 第 3 行'),
      expect.stringContaining('相机机身 第 4 行'),
      expect.stringContaining('胶卷库存 第 3 行'),
      expect.stringContaining('拍摄任务 第 3 行'),
    ]));
    expect(await db.cameras.where('userId').equals('user-1').count()).toBe(1);
    expect(await db.filmStocks.where('userId').equals('user-1').count()).toBe(1);
    expect(await db.rolls.where('userId').equals('user-1').count()).toBe(1);
  });

  it('rejects a missing user identity before writing any rows', async () => {
    await expect(importExcelDataFromFile(createImportFile({
      '相机机身': [{ '相机名称 (必填)': 'Leica M6' }],
    }), '')).rejects.toThrow('valid user identity');
    expect(await db.cameras.count()).toBe(0);
  });
});
