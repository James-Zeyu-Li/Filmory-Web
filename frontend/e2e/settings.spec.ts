import { test, expect } from '@playwright/test';
import { resetAndLogin, resetBrowserData } from './helpers';

test.describe('Settings flows', () => {
  for (const width of [320, 375, 390, 430, 540, 568, 600, 620, 768, 1024]) {
    test(`keeps settings rows usable without overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await resetAndLogin(page);

      const expandSidebar = page.getByRole('button', { name: /展开侧边栏|Expand sidebar/ });
      if (await expandSidebar.isVisible().catch(() => false)) {
        await expandSidebar.click();
      }

      const preferencesButton = page.locator('button').filter({ hasText: /偏好设置|Preferences/ }).first();
      await expect(preferencesButton).toBeVisible();
      await preferencesButton.click();
      const settingsModal = page.locator('.modal-content').filter({ hasText: /设置与数据保护|Settings & Data Protection/ });
      const languageRow = settingsModal.locator('.settings-language-item');
      const filmModeRow = settingsModal.locator('.settings-film-mode-item');
      const settingsGroup = settingsModal.locator('.settings-list-group').first();
      const currencyRow = settingsModal.locator('.settings-currency-item');
      const recordLayout = settingsModal.locator('.settings-sub-card');

      await expect(settingsModal).toBeVisible();
      const groupWidth = await settingsGroup.evaluate(element => element.getBoundingClientRect().width);
      await expect(languageRow).toHaveCSS('flex-direction', groupWidth <= 360 ? 'column' : 'row');
      await expect(filmModeRow).toHaveCSS('flex-direction', 'row');
      await expect(filmModeRow.locator('.compact-toggle')).toHaveCSS('width', '40px');

      const filmModeBox = await filmModeRow.boundingBox();
      const filmToggleBox = await filmModeRow.locator('.compact-toggle').boundingBox();
      expect(filmModeBox).not.toBeNull();
      expect(filmToggleBox).not.toBeNull();
      expect(filmToggleBox!.x + filmToggleBox!.width).toBeLessThanOrEqual(filmModeBox!.x + filmModeBox!.width);

      const layoutIcon = await recordLayout.locator('.settings-item-icon').boundingBox();
      const layoutCopy = await recordLayout.locator('.settings-sub-card-copy').boundingBox();
      const layoutText = recordLayout.locator('.settings-item-text');
      const disclosure = recordLayout.getByRole('button', { name: /展开|Expand/ });
      const disclosureBox = await disclosure.boundingBox();
      expect(layoutIcon).not.toBeNull();
      expect(layoutCopy).not.toBeNull();
      expect(disclosureBox).not.toBeNull();
      await expect(recordLayout.locator('.settings-sub-card-copy')).toHaveCSS('flex-direction', 'row');
      await expect(layoutText).toContainText(/拍摄记录布局|Shooting record layout/);
      await expect(layoutText).toContainText(/当前顺序|Current order/);
      expect(Math.abs((layoutIcon!.y + layoutIcon!.height / 2) - (layoutCopy!.y + layoutCopy!.height / 2)))
        .toBeLessThanOrEqual(2);
      await expect(disclosure).toHaveCSS('min-height', '44px');

      if (groupWidth <= 540) {
        expect(disclosureBox!.y).toBeGreaterThanOrEqual(layoutCopy!.y + layoutCopy!.height);
        const stackedWidths = await recordLayout.locator('.settings-sub-card-header').evaluate(header => ({
          copy: (header.querySelector('.settings-sub-card-copy') as HTMLElement).offsetWidth,
          disclosure: (header.querySelector('.settings-disclosure-button') as HTMLElement).offsetWidth,
        }));
        expect(stackedWidths.disclosure).toBe(stackedWidths.copy);
      } else {
        expect(disclosureBox!.y).toBeLessThan(layoutCopy!.y + layoutCopy!.height);
      }

      if (groupWidth <= 540) {
        const copyBox = await currencyRow.locator('.settings-item-content').boundingBox();
        const actionBox = await currencyRow.locator('.settings-item-action').boundingBox();
        expect(copyBox).not.toBeNull();
        expect(actionBox).not.toBeNull();
        expect(actionBox!.y).toBeGreaterThanOrEqual(copyBox!.y + copyBox!.height);
      }

      const metrics = await page.evaluate(() => ({
        documentWidth: document.documentElement.clientWidth,
        documentScrollWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.clientWidth,
        bodyScrollWidth: document.body.scrollWidth,
      }));

      expect(metrics.documentScrollWidth).toBeLessThanOrEqual(metrics.documentWidth + 1);
      expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.bodyWidth + 1);
    });
  }

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
    await expect(settingsModal.getByText('外观')).toBeVisible();
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
