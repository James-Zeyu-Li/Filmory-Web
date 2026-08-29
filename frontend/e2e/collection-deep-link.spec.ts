import { test, expect } from '@playwright/test';
import { resetAndLogin } from './helpers';

test.describe('Project (Collection) detail URL', () => {
  test.beforeEach(async ({ page }) => {
    await resetAndLogin(page);
    await page.goto('/rolls', { waitUntil: 'domcontentloaded' });
  });

  test('opens from the list, keeps Tabs visible, survives refresh, and Back returns to the list', async ({ page }) => {
    await page.getByRole('tab', { name: /项目集|Collections/ }).click();
    await page.locator('.view-header-actions').getByRole('button', { name: /新建项目集|New collection/ }).click();
    const collectionModal = page.locator('.modal-content').filter({ hasText: /新建项目集|New collection/ });
    await collectionModal.getByRole('textbox').first().fill('深链接测试项目');
    await collectionModal.getByRole('button', { name: /保存|Save/ }).click();
    await expect(collectionModal).toBeHidden();

    await page.getByRole('button', { name: /深链接测试项目/ }).click();
    await expect(page).toHaveURL(/\/rolls\?tab=collections&collectionId=/);
    await expect(page.getByRole('heading', { name: '深链接测试项目', level: 2 })).toBeVisible();
    // Regression guard: entering detail must not unmount the shared tab strip.
    await expect(page.getByRole('tab', { name: /项目集|Collections/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /全部拍摄记录|All shooting records/ })).toBeVisible();

    const detailUrl = page.url();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(detailUrl);
    await expect(page.getByRole('heading', { name: '深链接测试项目', level: 2 })).toBeVisible();

    await page.goBack({ waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/rolls$/);
    await expect(page.getByRole('heading', { name: '深链接测试项目', level: 2 })).toHaveCount(0);
  });

  test('cleans up an invalid collectionId deep link back to the Collections list', async ({ page }) => {
    await page.goto('/rolls?tab=collections&collectionId=not-a-real-collection', { waitUntil: 'domcontentloaded' });

    await expect(page).toHaveURL(/\/rolls\?tab=collections$/);
    await expect(page.getByRole('heading', { name: /项目集|Collections/, level: 1 })).toBeVisible();
  });
});
