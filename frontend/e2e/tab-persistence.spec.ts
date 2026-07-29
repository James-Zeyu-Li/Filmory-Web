import { test, expect } from '@playwright/test';
import { resetAndLogin } from './helpers';

test.describe('Workspace tab persistence', () => {
  test.beforeEach(async ({ page }) => {
    await resetAndLogin(page);
  });

  test('keeps the selected gear tab after refresh', async ({ page }) => {
    await page.goto('/gear', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /镜头库/ }).click();
    await expect(page.getByRole('heading', { name: '镜头' })).toBeVisible();

    await page.reload({ waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: '镜头' })).toBeVisible();
  });

  test('keeps the selected insights tab after refresh', async ({ page }) => {
    await page.goto('/insights', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /摄影账本/ }).click();
    await expect(page.getByRole('heading', { name: '收支记录' })).toBeVisible();

    await page.reload({ waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: '收支记录' })).toBeVisible();
  });
});
