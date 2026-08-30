import { test, expect } from '@playwright/test';
import * as XLSX from 'xlsx';
import { resetAndLogin } from './helpers';

const buildWorkbook = () => {
  const workbook = XLSX.utils.book_new();

  // The camera sheet's name header is deliberately NOT the exact template
  // header ("相机名称 (必填)"), forcing the wizard's mapping step. The camera
  // name ("Nikon F3") matches a pre-seeded existing camera, forcing the
  // duplicate-resolution step too.
  const cameraSheet = XLSX.utils.json_to_sheet([
    { '相机名称': 'Nikon F3', '类型 (film/digital)': 'digital' },
  ]);
  XLSX.utils.book_append_sheet(workbook, cameraSheet, '相机机身');

  const rollSheet = XLSX.utils.json_to_sheet([
    { '拍摄主题名称 (必填)': 'E2E Wizard Roll', '相机名称 (必填)': 'Nikon F3' },
  ]);
  XLSX.utils.book_append_sheet(workbook, rollSheet, '拍摄任务');

  return XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' }) as Buffer;
};

test.describe('Excel import wizard', () => {
  test('full journey: template -> mapping -> preview -> duplicate -> submit -> Instant Archive', async ({ page }) => {
    await resetAndLogin(page);

    // Seed an existing camera named "Nikon F3" so the workbook's camera row
    // triggers the duplicate-resolution step.
    await page.goto('/gear', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: '添加相机' }).first().click();
    const cameraModal = page.locator('.modal-content').filter({ hasText: '添加相机' });
    await cameraModal.getByRole('button', { name: '胶片相机' }).click();
    await cameraModal.getByRole('button', { name: '135' }).click();
    await cameraModal.getByRole('button', { name: 'Nikon' }).click();
    await cameraModal.getByRole('button', { name: 'F3' }).click();
    await cameraModal.getByRole('button', { name: '添加', exact: true }).click();
    await expect(cameraModal).toBeHidden();

    const preferencesButton = page.locator('button').filter({ hasText: /偏好设置|Preferences/ }).first();
    await preferencesButton.click();
    const settingsModal = page.locator('.modal-content').filter({ hasText: /设置与数据保护|Settings & Data Protection/ });
    await expect(settingsModal).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await settingsModal.getByRole('button', { name: '批量导入' }).click();
    const importModal = page.locator('.modal-content').filter({ hasText: '批量导入器材与拍摄记录' });
    await expect(importModal).toBeVisible();
    await importModal.getByRole('button', { name: '下载模板' }).click();
    await downloadPromise;

    await importModal.locator('input[type="file"]').setInputFiles({
      name: 'import.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: buildWorkbook(),
    });

    // Mapping step: resolve the renamed camera-name header.
    await expect(importModal.getByText('确认字段对应关系')).toBeVisible();
    await importModal.locator('select').selectOption('相机名称');
    await importModal.getByRole('button', { name: '确认映射并重新校验' }).click();

    // Preview step: one valid camera row, one valid roll row, no rejections.
    await expect(importModal.getByText('预览导入内容')).toBeVisible();
    await expect(importModal.getByText(/2 行有效/)).toBeVisible();
    await importModal.getByRole('button', { name: '继续' }).click();

    // Duplicate step: the camera name matches the pre-seeded "Nikon F3".
    await expect(importModal.getByText('处理重复项')).toBeVisible();
    await expect(importModal.getByText(/已存在：Nikon F3/)).toBeVisible();
    await importModal.getByRole('radio', { name: '作为新记录导入' }).click();
    await importModal.getByRole('button', { name: '确认并导入' }).click();

    // Instant Archive success step, then the primary CTA into the rolls list.
    await expect(importModal.getByText('导入完成')).toBeVisible();
    await expect(importModal.getByText(/已导入 1 条拍摄记录/)).toBeVisible();
    await importModal.getByRole('button', { name: '查看拍摄记录' }).click();
    await expect(page).toHaveURL(/\/rolls\?tab=all/);
    await expect(page.getByText('E2E Wizard Roll')).toBeVisible();
  });
});
