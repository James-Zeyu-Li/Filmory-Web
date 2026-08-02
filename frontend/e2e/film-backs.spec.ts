import { test, expect } from '@playwright/test';
import { resetAndLogin } from './helpers';

test.describe('120 interchangeable film backs', () => {
  test.beforeEach(async ({ page }) => {
    await resetAndLogin(page);
  });

  test('uses the stepped camera builder to recommend medium-format models and backs', async ({ page }) => {
    await page.goto('/gear', { waitUntil: 'domcontentloaded' });

    await page.getByRole('button', { name: '添加相机' }).first().click();
    const cameraModal = page.locator('.modal-content').filter({ hasText: '添加相机' });

    await cameraModal.getByRole('button', { name: '胶片相机' }).click();
    await cameraModal.getByRole('button', { name: '120' }).click();
    await cameraModal.getByRole('button', { name: 'Hasselblad' }).click();
    await cameraModal.getByRole('button', { name: /500CM/ }).click();

    await expect(cameraModal.getByPlaceholder('例如: Minolta X-700')).toHaveValue('Hasselblad 500CM');
    await expect(cameraModal.getByPlaceholder('例如: Hasselblad V / Mamiya RB67')).toHaveValue('Hasselblad V');
    await expect(cameraModal.locator('.film-back-row').filter({ hasText: 'A12 Back' })).toBeVisible();
  });

  test('creates a 120 camera with a back and loads an active roll into that back', async ({ page }) => {
    await page.goto('/gear', { waitUntil: 'domcontentloaded' });

    await page.getByRole('button', { name: '添加相机' }).first().click();
    const cameraModal = page.locator('.modal-content').filter({ hasText: '添加相机' });

    await cameraModal.getByRole('button', { name: '胶片相机' }).click();
    await cameraModal.getByRole('button', { name: '120' }).click();
    await cameraModal.getByRole('button', { name: 'Hasselblad' }).click();
    await cameraModal.getByRole('button', { name: /500CM/ }).click();
    await expect(cameraModal.getByPlaceholder('例如: Minolta X-700')).toHaveValue('Hasselblad 500CM');
    await expect(cameraModal.getByPlaceholder('例如: Hasselblad V / Mamiya RB67')).toHaveValue('Hasselblad V');
    await cameraModal.getByRole('button', { name: '添加', exact: true }).click();

    await expect(page.locator('.gear-card').filter({ hasText: 'Hasselblad 500CM' })).toContainText(/\d+ 个 · Hasselblad V/);

    await page.getByRole('button', { name: '添加相机' }).first().click();
    const secondCameraModal = page.locator('.modal-content').filter({ hasText: '添加相机' });
    await secondCameraModal.getByRole('button', { name: '胶片相机' }).click();
    await secondCameraModal.getByRole('button', { name: '120' }).click();
    await secondCameraModal.getByPlaceholder('例如: Minolta X-700').fill('E2E Hasselblad 501CM');
    await secondCameraModal.locator('select').first().selectOption('interchangeable');
    await secondCameraModal.getByRole('button', { name: '从已拥有系统中选择' }).click();
    await secondCameraModal.locator('select').last().selectOption({ label: 'Hasselblad V' });
    await secondCameraModal.getByRole('button', { name: '添加', exact: true }).click();
    await expect(page.locator('.gear-card').filter({ hasText: 'E2E Hasselblad 501CM' })).toContainText(/\d+ 个 · Hasselblad V/);

    await page.getByRole('button', { name: /镜头库/ }).click();
    await page.getByRole('button', { name: '添加镜头' }).first().click();
    const lensModal = page.locator('.modal-content').filter({ hasText: '添加镜头' });
    await lensModal.getByRole('button', { name: 'hasselblad-v' }).click();
    await lensModal.getByRole('button', { name: 'Hasselblad', exact: true }).click();
    await lensModal.getByRole('button', { name: 'Carl Zeiss Planar 80mm f/2.8 C · 80mm' }).click();
    await expect(lensModal.getByPlaceholder('例如: MD 50mm f/1.7')).toHaveValue('Hasselblad Carl Zeiss Planar 80mm f/2.8 C');
    await expect(lensModal.locator('input[type="number"]').first()).toHaveValue('80');
    await lensModal.getByRole('button', { name: '添加', exact: true }).click();
    await expect(page.locator('.gear-card').filter({ hasText: 'Hasselblad Carl Zeiss Planar 80mm f/2.8 C' })).toBeVisible();

    await page.goto('/rolls', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /全部拍摄记录|所有拍摄卷/ }).click();
    await page.getByRole('button', { name: /新建拍摄记录|新建独立拍摄卷/ }).click();
    const rollModal = page.locator('.modal-content').filter({ hasText: '新建拍摄记录' });

    await rollModal.getByPlaceholder('例如: 2026春日踏青').fill('E2E 120 Back Roll');
    await rollModal.locator('div').filter({ hasText: /^E2E Hasselblad 501CM$/ }).first().click();
    await rollModal.locator('div').filter({ hasText: /^Hasselblad Carl Zeiss Planar 80mm f\/2\.8 C$/ }).first().click();
    await expect(rollModal.getByText('选择后背/片盒')).toBeVisible();
    await rollModal.getByRole('button', { name: /A12 Back/ }).click();
    await rollModal.locator('.form-group').filter({ hasText: '使用胶卷' }).getByRole('button', { name: /快捷添加/ }).click();
    const quickFilmModal = page.locator('.modal-content').filter({ hasText: '快捷添加胶卷' });
    await expect(quickFilmModal.getByRole('button', { name: '120', exact: true })).toHaveClass(/active/);
    await quickFilmModal.getByPlaceholder('例如: Kodak').fill('E2E 120');
    await quickFilmModal.getByPlaceholder('例如: Gold 200').fill('Portra Test');
    await quickFilmModal.getByRole('button', { name: '添加并选中' }).click();
    await expect(rollModal.getByPlaceholder(/搜索胶卷库/)).toHaveValue('E2E 120 Portra Test');
    await rollModal.getByRole('button', { name: '开始记录' }).click();

    await expect(page.locator('.roll-card, .roll-card-row').filter({ hasText: 'E2E 120 Back Roll' })).toContainText('A12 Back');
    await expect(page.locator('.roll-card, .roll-card-row').filter({ hasText: 'E2E 120 Back Roll' })).toContainText('Hasselblad Carl Zeiss Planar 80mm f/2.8 C');

    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.metric-card').filter({ hasText: '使用中镜头' })).toContainText('1 支');
    await expect(page.locator('.metric-card').filter({ hasText: '装片后背' })).toContainText('1 个');
    await expect(page.locator('.active-roll-dash-card').filter({ hasText: 'E2E 120 Back Roll' })).toContainText('A12 Back');
    await expect(page.locator('.active-roll-dash-card').filter({ hasText: 'E2E 120 Back Roll' })).toContainText('装片组合：E2E Hasselblad 501CM + A12 Back + E2E 120 Portra Test');
    await expect(page.locator('.active-roll-dash-card').filter({ hasText: 'E2E 120 Back Roll' })).toContainText('Hasselblad Carl Zeiss Planar 80mm f/2.8 C');
  });
});
