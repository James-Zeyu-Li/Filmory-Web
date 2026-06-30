import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as XLSX from 'xlsx';
import { resetAndLogin } from './helpers';

function createMockExcel(filePath: string) {
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
    { '相机名称 (必填)': 'E2E Excel Camera', '类型 (film/digital)': 'film', '画幅 (135/120/digital)': '135' }
  ]), '相机机身');

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
    { '镜头名称 (必填)': 'E2E Excel Lens', '焦段mm': 35, '最大光圈 (例如 f/2)': 'f/2', '类型 (prime/zoom)': 'prime' }
  ]), '镜头');

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
    { '品牌 (必填)': 'E2E Film', '型号名称 (必填)': 'Color 200', 'ISO (必填)': 200, '类型 (color/bw)': 'color', '画幅 (135/120)': '135', '初始库存数量': 2 }
  ]), '胶卷库存');

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
    { '拍摄主题名称 (必填)': 'E2E Excel Roll', '相机名称 (必填)': 'E2E Excel Camera', '胶卷品牌 (仅胶片)': 'E2E Film', '胶卷型号 (仅胶片)': 'Color 200' }
  ]), '拍摄任务');

  XLSX.writeFile(wb, filePath);
}

test.describe('Filmory UI smoke flows', () => {
  test.beforeEach(async ({ page }) => {
    await resetAndLogin(page);
  });

  test('logs in with dev bypass and opens core navigation targets', async ({ page }) => {
    await page.getByRole('button', { name: /器材库/ }).click();
    await expect(page.getByRole('heading', { name: /相机/ })).toBeVisible();

    await page.getByRole('link', { name: /拍摄卷/ }).click();
    await expect(page.getByRole('heading', { name: /项目集|所有拍摄卷|未整理散卷/ })).toBeVisible();
  });

  test('creates a camera and shows the unified duplicate confirmation', async ({ page }) => {
    await page.goto('/gear', { waitUntil: 'domcontentloaded' });

    await page.getByRole('button', { name: '添加相机' }).first().click();
    await page.getByPlaceholder('例如: Minolta X-700').fill('E2E Camera Duplicate');
    await page.getByRole('button', { name: '添加', exact: true }).click();
    await expect(page.getByText('E2E Camera Duplicate')).toBeVisible();

    await page.getByRole('button', { name: '添加相机' }).first().click();
    await page.getByPlaceholder('例如: Minolta X-700').fill('E2E Camera Duplicate');
    await page.getByRole('button', { name: '添加', exact: true }).click();

    const duplicateDialog = page.locator('.modal-content').filter({ hasText: '相机已存在' });
    await expect(duplicateDialog.getByRole('heading', { name: '相机已存在' })).toBeVisible();
    await duplicateDialog.getByRole('button', { name: '取消' }).click();
  });

  test('creates a roll through the current roll modal', async ({ page }) => {
    await page.goto('/rolls', { waitUntil: 'domcontentloaded' });

    await page.getByRole('button', { name: /所有拍摄卷/ }).click();
    await page.getByRole('button', { name: /新建独立拍摄卷/ }).click();
    const rollModal = page.locator('.modal-content').filter({ hasText: '新建拍摄卷' });

    await page.getByPlaceholder('例如: 2026春日踏青').fill('E2E Smoke Roll');
    await rollModal.locator('div').filter({ hasText: /^Minolta X-700$/ }).first().click();
    await page.getByPlaceholder(/搜索胶卷库/).fill('Kodak Gold 200');
    await page.getByRole('button', { name: '开始记录' }).click();

    await expect(page.getByText('E2E Smoke Roll')).toBeVisible();
  });

  test('downloads Excel template and imports an Excel workbook', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /批量导入/ }).click();
    await expect(page.getByRole('heading', { name: '批量导入资产与记录' })).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '获取模版文件' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('Filmory_Import_Template.xlsx');
    await expect(page.getByText('下载已完成，请注意')).toBeVisible();

    const tempFilePath = 'mock_import.xlsx';
    createMockExcel(tempFilePath);

    page.once('dialog', async dialog => {
      expect(dialog.message()).toContain('成功导入');
      expect(dialog.message()).toContain('任务: 1');
      await dialog.accept();
    });

    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: '选择并上传表格' }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(tempFilePath);

    await expect(page.getByRole('heading', { name: '批量导入资产与记录' })).not.toBeVisible();

    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
  });
});
