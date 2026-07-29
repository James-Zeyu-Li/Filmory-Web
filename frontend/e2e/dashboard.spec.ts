import { test, expect } from '@playwright/test';
import { resetAndLogin } from './helpers';

test.describe('Dashboard film workspace', () => {
  test.beforeEach(async ({ page }) => {
    await resetAndLogin(page);
  });

  test('shows film-first operational metrics instead of photo counters', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /控制中心/ })).toBeVisible();
    await expect(page.locator('.metric-card').filter({ hasText: '进行中' })).toBeVisible();
    await expect(page.locator('.metric-card').filter({ hasText: '库存胶卷' })).toBeVisible();
    await expect(page.getByLabel('库存胶卷分组')).toContainText('135 11');
    await expect(page.getByLabel('库存胶卷分组')).toContainText('120 0');
    await expect(page.getByLabel('库存胶卷分组')).toContainText('彩色 8');
    await expect(page.getByLabel('库存胶卷分组')).toContainText('黑白 3');
    await expect(page.locator('.metric-card').filter({ hasText: '使用中机器' })).toBeVisible();
    await expect(page.locator('.active-roll-dash-card').filter({ hasText: '春日公园' })).toContainText('装片组合：Minolta X-700');
    await expect(page.getByText('30 天完成')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: '库存预警' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: '最近完成' })).toHaveCount(0);
    await expect(page.getByText('总片数')).toHaveCount(0);
    await expect(page.getByText('总花费')).toHaveCount(0);
  });

  test('opens the intended target for dashboard quick actions', async ({ page }) => {
    await page.getByRole('button', { name: /新建胶卷记录/ }).click();
    await expect(page).toHaveURL(/\/rolls$/);
    await expect(page.locator('.modal-content').filter({ hasText: '新建胶卷记录' })).toBeVisible();
    await expect(page.getByTestId('page-transition')).toHaveCSS('transform', 'none');
    await page.keyboard.press('Escape');

    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /添加胶卷库存/ }).click();
    await expect(page).toHaveURL(/\/gear$/);
    await expect(page.getByRole('heading', { name: '胶卷库存' })).toBeVisible();
    await expect(page.locator('.modal-content').filter({ hasText: '入库胶卷' })).toBeVisible();
    await expect(page.getByTestId('page-transition')).toHaveCSS('transform', 'none');
    await page.keyboard.press('Escape');

    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /添加相机/ }).click();
    await expect(page).toHaveURL(/\/gear$/);
    await expect(page.getByRole('heading', { name: '相机设备' })).toBeVisible();
    await expect(page.locator('.modal-content').filter({ hasText: '添加相机' })).toBeVisible();
  });

  test('opens the selected active roll from the dashboard', async ({ page }) => {
    await page.getByRole('button', { name: /继续记录/ }).first().click();

    await expect(page).toHaveURL(/\/rolls$/);
    await expect(page.locator('.drawer-panel').filter({ hasText: '春日公园' })).toBeVisible();
    await expect(page.locator('.drawer-content').filter({ hasText: '拍摄信息' })).toBeVisible();
  });

  test('keeps rolls tab and list layout after refresh', async ({ page }) => {
    await page.goto('/rolls', { waitUntil: 'domcontentloaded' });
    await page.locator('.view-header-actions').getByRole('button', { name: '新建项目' }).click();
    const collectionModal = page.locator('.modal-content').filter({ hasText: '新建项目' });
    await collectionModal.getByPlaceholder('例如：2026 东京旅拍').fill('测试项目集');
    await collectionModal.getByRole('button', { name: '保存' }).click();

    await page.getByRole('button', { name: /列表视图/ }).click();
    await expect(page.getByRole('heading', { name: '项目集' })).toBeVisible();
    await expect(page.locator('.rolls-list')).toBeVisible();

    const collectionColumnCount = await page.locator('.rolls-list').first().evaluate((element) => {
      return getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length;
    });
    expect(collectionColumnCount).toBe(2);

    await page.getByRole('button', { name: '全部胶卷记录' }).click();

    await expect(page.getByRole('heading', { name: '全部胶卷记录' })).toBeVisible();
    await expect(page.locator('.rolls-list')).toBeVisible();

    const columnCount = await page.locator('.rolls-list').first().evaluate((element) => {
      return getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length;
    });
    expect(columnCount).toBe(2);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: '全部胶卷记录' })).toBeVisible();
    await expect(page.locator('.rolls-list')).toBeVisible();
  });
});
