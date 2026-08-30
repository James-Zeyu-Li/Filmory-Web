import { expect, test, type Page } from '@playwright/test';
import { resetAndLogin } from './helpers';

async function createManualCamera(page: Page, name: string) {
  await page.goto('/gear', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: '添加相机' }).first().click();

  const cameraModal = page.locator('.modal-content').filter({ hasText: '添加相机' });
  await cameraModal.getByPlaceholder('例如: Minolta X-700').fill(name);
  await cameraModal.getByRole('button', { name: '添加', exact: true }).click();

  const cameraCard = page.locator('.gear-card').filter({ hasText: name });
  await expect(cameraCard).toBeVisible();
  return cameraCard;
}

async function createRoll(page: Page, name: string) {
  await page.goto('/rolls', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /全部拍摄记录|所有拍摄卷/ }).click();
  await page.getByRole('button', { name: /新建拍摄记录|新建独立拍摄卷/ }).click();

  const rollModal = page.locator('.modal-content').filter({ hasText: '新建拍摄记录' });
  await rollModal.getByPlaceholder('例如: 2026春日踏青').fill(name);
  await rollModal.locator('div').filter({ hasText: /^Minolta X-700$/ }).first().click();
  await rollModal.getByPlaceholder(/搜索胶卷库/).fill('Kodak Gold 200');
  await rollModal.getByRole('button', { name: '开始记录' }).click();

  const rollCard = page.locator('.roll-card, .record-row-card').filter({ hasText: name });
  await expect(rollCard).toBeVisible();
  return rollCard;
}

test.describe('Dangerous action cancel paths', () => {
  test.beforeEach(async ({ page }) => {
    await resetAndLogin(page);
  });

  test('keeps a camera when delete confirmation is cancelled', async ({ page }) => {
    const cameraName = 'E2E Cancel Delete Camera';
    const cameraCard = await createManualCamera(page, cameraName);

    await cameraCard.getByTitle('彻底删除').click();

    const confirmModal = page.locator('.modal-content').filter({ hasText: '删除相机' });
    await expect(confirmModal.getByRole('heading', { name: '删除相机' })).toBeVisible();
    await confirmModal.getByRole('button', { name: '取消' }).click();

    await expect(page.locator('.gear-card').filter({ hasText: cameraName })).toBeVisible();
  });

  test('keeps a roll when delete confirmation is cancelled', async ({ page }) => {
    const rollName = 'E2E Cancel Delete Roll';
    const rollCard = await createRoll(page, rollName);

    await rollCard.getByTitle('删除胶卷记录').click();

    const confirmModal = page.locator('.modal-content').filter({ hasText: '删除胶卷记录' });
    await expect(confirmModal.getByRole('heading', { name: '删除胶卷记录' })).toBeVisible();
    await confirmModal.getByRole('button', { name: '取消' }).click();

    await expect(page.locator('.roll-card, .record-row-card').filter({ hasText: rollName })).toBeVisible();
  });

  test('does not delete or logout when account deletion final confirmation is cancelled', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /偏好设置/ }).click();

    const settingsModal = page.locator('.modal-content').filter({ hasText: '设置与数据保护' });
    await settingsModal.getByRole('button', { name: '注销我的账号' }).click();
    await settingsModal.getByPlaceholder('DELETE').fill('DELETE');
    await settingsModal.getByRole('button', { name: '确认永久销毁' }).click();

    const confirmModal = page.locator('.modal-content').filter({ hasText: '最终确认注销账号' });
    await expect(confirmModal.getByRole('heading', { name: '最终确认注销账号' })).toBeVisible();
    await confirmModal.getByRole('button', { name: '取消' }).click();

    await expect(settingsModal.getByText('测试管理员')).toBeVisible();
    await expect(settingsModal.getByRole('button', { name: '注销我的账号' })).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});
