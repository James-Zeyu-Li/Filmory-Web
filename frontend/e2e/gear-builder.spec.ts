import { test, expect } from '@playwright/test';
import { resetAndLogin } from './helpers';

test.describe('Gear add builders', () => {
  test.beforeEach(async ({ page }) => {
    await resetAndLogin(page);
  });

  test('collapses camera and lens model choices after selection', async ({ page }) => {
    await page.goto('/gear', { waitUntil: 'domcontentloaded' });

    await page.getByRole('button', { name: '添加相机' }).first().click();
    const cameraModal = page.locator('.modal-content').filter({ hasText: '添加相机' });
    await cameraModal.getByRole('button', { name: '胶片相机' }).click();
    await cameraModal.getByRole('button', { name: '135' }).click();
    await cameraModal.getByRole('button', { name: 'Nikon' }).click();
    await cameraModal.getByRole('button', { name: 'F3' }).click();

    await expect(cameraModal.getByRole('button', { name: '重新选择相机' })).toBeVisible();
    await expect(cameraModal.getByRole('button', { name: 'FM2' })).toHaveCount(0);
    await cameraModal.getByRole('button', { name: '取消' }).click();

    await page.getByRole('button', { name: /镜头库/ }).click();
    await page.getByRole('button', { name: '添加镜头' }).first().click();
    const lensModal = page.locator('.modal-content').filter({ hasText: '添加镜头' });
    await lensModal.getByRole('button', { name: 'micro-four-thirds' }).click();
    await expect(lensModal.getByRole('button', { name: '更换卡口' })).toBeVisible();
    await expect(lensModal.getByRole('button', { name: 'canon-fd' })).toHaveCount(0);

    await lensModal.getByRole('button', { name: 'Olympus', exact: true }).click();
    await lensModal.getByRole('button', { name: /M\.Zuiko Digital 17mm/ }).click();
    await expect(lensModal.getByRole('button', { name: '重新选择镜头' })).toBeVisible();
    await expect(lensModal.getByRole('button', { name: /M\.Zuiko Digital 25mm/ })).toHaveCount(0);
    await expect(lensModal.getByRole('button', { name: '更换卡口' })).toHaveCount(0);
    await expect(lensModal.getByLabel('镜头类型')).toHaveCount(0);
  });

  test('collapses film preset selection after choosing a stock and leaves details editable', async ({ page }) => {
    await page.goto('/gear', { waitUntil: 'domcontentloaded' });

    await page.getByRole('button', { name: /胶卷/ }).click();
    await page.getByRole('button', { name: '添加胶卷' }).first().click();

    const filmModal = page.locator('.modal-content').filter({ hasText: '入库胶卷' });
    await filmModal.getByRole('button', { name: '120' }).click();
    await filmModal.getByRole('button', { name: 'Kodak' }).click();
    await filmModal.getByRole('button', { name: /Portra 400/ }).click();

    await expect(filmModal.locator('.selected-gear-summary')).toContainText('Kodak Portra 400');
    await expect(filmModal.getByRole('button', { name: '重新选择胶卷' })).toBeVisible();
    await expect(filmModal.getByRole('button', { name: 'Ilford' })).toHaveCount(0);
    await expect(filmModal.getByRole('button', { name: '135', exact: true })).toHaveCount(0);
    await expect(filmModal.getByRole('button', { name: '120', exact: true })).toHaveCount(0);

    await expect(filmModal.getByPlaceholder('例如: Kodak')).toHaveValue('Kodak');
    await expect(filmModal.getByPlaceholder('例如: Gold 200')).toHaveValue('Portra 400');
    await filmModal.getByPlaceholder('例如: Gold 200').fill('Portra 400 E2E');
    await filmModal.getByPlaceholder('可留空，默认为 0').fill('3');
    await filmModal.getByRole('button', { name: '添加', exact: true }).click();

    await expect(page.locator('.gear-card').filter({ hasText: 'Portra 400 E2E' })).toContainText('库存数量：3 卷');
  });
});
