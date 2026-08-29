import { expect, test } from '@playwright/test';
import { resetAndLogin } from './helpers';

test.describe('Sidebar layout', () => {
  test('keeps the expanded rail compact and aligns navigation and footer controls', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await resetAndLogin(page);

    const sidebar = page.locator('.sidebar');
    const dashboard = page.getByRole('link', { name: /控制中心|Dashboard/ });
    const account = page.getByRole('button', { name: /我的账户|My Account/ });
    const preferences = page.getByRole('button', { name: /偏好设置|Preferences/ });
    const collapse = page.getByRole('button', { name: /收起侧边栏|Collapse sidebar/ });

    await expect(sidebar).toHaveCSS('width', '240px');

    const iconBoxes = await Promise.all([
      dashboard.locator('svg').boundingBox(),
      account.locator('svg').boundingBox(),
      preferences.locator('svg').boundingBox(),
      collapse.locator('svg').boundingBox(),
    ]);
    expect(iconBoxes.every(Boolean)).toBe(true);
    const firstIconX = iconBoxes[0]!.x;
    iconBoxes.slice(1).forEach(box => expect(Math.abs(box!.x - firstIconX)).toBeLessThan(1));

    const labelBoxes = await Promise.all([
      dashboard.locator('span').boundingBox(),
      account.locator('span').boundingBox(),
      preferences.locator('span').boundingBox(),
      collapse.locator('span').boundingBox(),
    ]);
    expect(labelBoxes.every(Boolean)).toBe(true);
    const firstLabelX = labelBoxes[0]!.x;
    labelBoxes.slice(1).forEach(box => expect(Math.abs(box!.x - firstLabelX)).toBeLessThan(1));

    await collapse.click();
    await expect(sidebar).toHaveCSS('width', '72px');
    await expect(page.getByRole('button', { name: /展开侧边栏|Expand sidebar/ })).toBeVisible();

    // A compact rail still needs a 44px touch target, but its controls should
    // not stretch across the full 56px inner width of the 72px sidebar.
    for (const control of [
      dashboard,
      account,
      preferences,
      page.getByRole('button', { name: /展开侧边栏|Expand sidebar/ }),
    ]) {
      await expect(control).toHaveCSS('width', '44px');
      await expect(control).toHaveCSS('min-height', '44px');
    }
  });

  test('preserves the 280px mobile drawer contract', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await resetAndLogin(page);

    await page.getByRole('button', { name: /展开侧边栏|Expand sidebar/ }).click();
    await expect(page.locator('.sidebar')).toHaveCSS('width', '280px');
    await expect(page.locator('.sidebar .collapse-btn')).toBeHidden();
  });

  test('uses the expected desktop rail at responsive boundaries', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await resetAndLogin(page);

    const sidebar = page.locator('.sidebar');
    await expect(sidebar).toHaveCSS('width', '240px');

    for (const width of [1249, 1100, 1025]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(sidebar).toHaveCSS('width', '72px');
    }

    await page.setViewportSize({ width: 1250, height: 900 });
    await expect(sidebar).toHaveCSS('width', '240px');
  });
});
