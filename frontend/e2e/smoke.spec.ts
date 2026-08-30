import { test, expect } from '@playwright/test';
import { resetAndLogin } from './helpers';

test.describe('Grainfolio UI smoke flows', () => {
  test.beforeEach(async ({ page }) => {
    await resetAndLogin(page);
  });

  test('logs in with dev bypass and opens core navigation targets', async ({ page }) => {
    await page.getByRole('link', { name: /器材库/ }).click();
    await expect(page.getByRole('heading', { name: /相机/ })).toBeVisible();

    await page.getByRole('link', { name: /拍摄记录/ }).click();
    await expect(page.getByRole('heading', { name: /项目集|全部拍摄记录|独立记录/ })).toBeVisible();
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

    await page.getByRole('tab', { name: /全部拍摄记录/ }).click();
    await page.getByRole('button', { name: /新建拍摄记录/ }).click();
    const rollModal = page.locator('.modal-content').filter({ hasText: '新建拍摄记录' });

    await page.getByPlaceholder('例如: 2026春日踏青').fill('E2E Smoke Roll');
    await rollModal.getByRole('button', { name: 'Minolta X-700', exact: true }).click();
    await page.getByPlaceholder(/搜索胶卷库/).fill('Kodak Gold 200');
    await page.getByRole('button', { name: '开始记录' }).click();

    await expect(page.getByText('E2E Smoke Roll')).toBeVisible();
  });

  test('quick-add film opens above the roll modal and fills the selected film', async ({ page }) => {
    await page.goto('/rolls', { waitUntil: 'domcontentloaded' });

    await page.getByRole('tab', { name: /全部拍摄记录/ }).click();
    await page.getByRole('button', { name: /新建拍摄记录/ }).click();
    const rollModal = page.locator('.modal-content').filter({ hasText: '新建拍摄记录' });

    await rollModal.getByPlaceholder('例如: 2026春日踏青').fill('E2E Quick Film Roll');
    await rollModal.getByRole('button', { name: 'Minolta X-700', exact: true }).click();
    await rollModal.locator('.form-group').filter({ hasText: '使用胶卷' }).getByRole('button', { name: /快捷添加/ }).click();

    const quickFilmModal = page.locator('.modal-content').filter({ hasText: '快捷添加胶卷' });
    await expect(quickFilmModal).toBeVisible();
    await expect(quickFilmModal).toContainText('画幅会按已选相机预设');
    await expect(quickFilmModal.getByRole('button', { name: '135', exact: true })).toHaveClass(/active/);

    const quickOverlayZIndex = await quickFilmModal.evaluate((element) => {
      return getComputedStyle(element.closest('.modal-overlay') as Element).zIndex;
    });
    expect(Number(quickOverlayZIndex)).toBeGreaterThan(9999);

    await quickFilmModal.getByPlaceholder('例如: Kodak').fill('E2E Quick');
    await quickFilmModal.getByPlaceholder('例如: Gold 200').fill('Chrome 100');
    await quickFilmModal.getByRole('button', { name: '添加并选中' }).click();

    await expect(rollModal.getByPlaceholder(/搜索胶卷库/)).toHaveValue('E2E Quick Chrome 100');
    await rollModal.getByRole('button', { name: '开始记录' }).click();
    await expect(page.getByText('E2E Quick Film Roll')).toBeVisible();
  });

  // The previous Excel-import smoke test asserted UI that no longer exists
  // (a `/批量导入/` entry point on Dashboard, and a native `dialog` — the app
  // uses the toast/Feedback system instead). ExcelImportModal has no
  // production entry point yet (UI-23 Stage A is service-layer only); a real
  // wizard E2E covering template -> mapping -> preview -> duplicate ->
  // submit -> Instant Archive lands in UI-23 Stage B once an entry point
  // (Settings) exists.
});
