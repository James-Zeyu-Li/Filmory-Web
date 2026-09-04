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
  await page.getByRole('tab', { name: /全部拍摄记录|所有拍摄卷/ }).click();
  await page.getByRole('button', { name: /新建拍摄记录|新建独立拍摄卷/ }).click();

  const rollModal = page.locator('.modal-content').filter({ hasText: '新建拍摄记录' });
  await rollModal.getByPlaceholder('例如: 2026春日踏青').fill(name);
  await rollModal.getByRole('button', { name: 'Minolta X-700', exact: true }).click();
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

  test('keeps the account when deletion confirmation is cancelled', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /^设置$/ }).click();

    const settingsModal = page.locator('.modal-content').filter({ hasText: '设置与数据保护' });
    await expect(settingsModal.getByRole('heading', { name: 'Developer', exact: true })).toBeVisible();
    await settingsModal.getByRole('tab', { name: '数据' }).click();
    // resetAndLogin always signs in via dev bypass, so DataTab renders the
    // dev-specific "clear local session" copy/button here, not the real
    // "delete my account" one (see DataTab.tsx's isDevBypass branches).
    await settingsModal.getByRole('button', { name: '清除开发会话' }).click();

    // Type-to-confirm (typing the literal word "DELETE") is this flow's one
    // confirmation step, wrapped in the shared <Modal> — there is no separate
    // third-level dialog after it (single-step confirm is the project's
    // established pattern for destructive actions; see SETTINGS_TODO.md).
    const confirmDialog = page.locator('.account-delete-dialog');
    await expect(confirmDialog.getByRole('heading', { name: '清除本地开发会话' })).toBeVisible();
    await confirmDialog.getByRole('button', { name: '取消' }).click();

    await expect(settingsModal.getByRole('button', { name: '清除开发会话' })).toBeVisible();
    // Cancelling the nested delete-confirmation dialog only closes that dialog —
    // Settings itself stays open on its URL-driven tab (?settings=data).
    await expect(page).toHaveURL(/\/dashboard\?settings=data$/);
  });
});
