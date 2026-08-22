import { test, expect } from '@playwright/test';
import { resetAndLogin, resetBrowserData } from './helpers';

test.describe('Settings flows', () => {
  test('redirects unauthenticated private routes to login', async ({ page }) => {
    await resetBrowserData(page);
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/auth\/login$/);
  });

  test('keeps settings focused and removes unsafe local reset from normal UI', async ({ page }) => {
    await resetAndLogin(page);

    await page.getByRole('button', { name: /偏好设置/ }).click();
    const settingsModal = page.locator('.modal-content').filter({ hasText: '设置与数据保护' });

    await expect(settingsModal.getByRole('heading', { name: '设置与数据保护' })).toBeVisible();
    await expect(settingsModal.getByText('测试管理员')).toBeVisible();
    await expect(settingsModal.getByText('色彩主题')).toBeVisible();
    await expect(settingsModal.getByText('记账货币')).toBeVisible();
    await expect(settingsModal.getByRole('button', { name: '立即导出记录' })).toBeVisible();
    await expect(settingsModal.getByRole('button', { name: '重置数据库' })).toHaveCount(0);
  });

  test('logs out and blocks returning to private pages', async ({ page }) => {
    await resetAndLogin(page);

    await page.getByRole('button', { name: /偏好设置/ }).click();
    await page.locator('.modal-content').filter({ hasText: '设置与数据保护' }).getByRole('button', { name: '退出登录' }).click();

    await expect(page).toHaveURL(/\/auth\/login$/);
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/auth\/login$/);
  });

  test('resets rolls tab selection after logout and login', async ({ page }) => {
    await resetAndLogin(page);

    await page.goto('/rolls', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: '独立记录' }).click();
    await expect(page.getByRole('heading', { name: '独立记录' })).toBeVisible();

    await page.getByRole('button', { name: /偏好设置/ }).click();
    await page.locator('.modal-content').filter({ hasText: '设置与数据保护' }).getByRole('button', { name: '退出登录' }).click();
    await expect(page).toHaveURL(/\/auth\/login$/);

    await page.getByRole('button', { name: /本机测试登录/ }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.getByRole('link', { name: '拍摄记录' }).click();
    await expect(page.getByRole('heading', { name: '项目集' })).toBeVisible();
  });

  test('applies rolls tab order and hidden collections preference from settings', async ({ page }) => {
    await resetAndLogin(page);

    await page.getByRole('button', { name: /偏好设置/ }).click();
    await page.getByRole('button', { name: '独立记录 上移' }).click();
    await page.getByRole('button', { name: '独立记录 上移' }).click();
    await page.locator('label[for="rollsCollectionsToggle"]').click();
    await page.locator('.modal-content button.icon-btn').click();

    await page.getByRole('link', { name: '拍摄记录' }).click();
    await expect(page.getByRole('heading', { name: '独立记录' })).toBeVisible();
    await expect(page.getByRole('button', { name: '项目集' })).toHaveCount(0);
  });

  test('forces collections tab on when film mode is disabled', async ({ page }) => {
    await resetAndLogin(page);

    await page.getByRole('button', { name: /偏好设置/ }).click();
    await page.locator('label[for="rollsCollectionsToggle"]').click();
    await expect(page.getByText('当前已隐藏，重新开启后按此顺序显示')).toBeVisible();
    await page.locator('label[for="filmModeToggle"]').click();

    await expect(page.locator('#rollsCollectionsToggle')).toBeChecked();
    await expect(page.locator('#rollsCollectionsToggle')).toBeDisabled();

    await page.locator('.modal-content button.icon-btn').click();
    await page.getByRole('link', { name: '拍摄记录' }).click();
    await expect(page.getByRole('button', { name: '项目集' })).toBeVisible();

    await page.getByRole('button', { name: /偏好设置/ }).click();
    await page.locator('label[for="filmModeToggle"]').click();
    await expect(page.locator('#rollsCollectionsToggle')).not.toBeChecked();
    await expect(page.getByText('当前已隐藏，重新开启后按此顺序显示')).toBeVisible();
    await page.locator('.modal-content button.icon-btn').click();

    await expect(page.getByRole('button', { name: '项目集' })).toHaveCount(0);
  });
});
