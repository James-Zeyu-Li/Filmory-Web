import { expect, test, type Page } from '@playwright/test';
import { startTrialFromLanding } from './helpers';

async function createManualCamera(page: Page, name: string) {
  await page.goto('/gear', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: '添加相机' }).first().click();
  const cameraModal = page.locator('.modal-content').filter({ hasText: '添加相机' });
  await cameraModal.getByPlaceholder('例如: Minolta X-700').fill(name);
  await cameraModal.getByRole('button', { name: '添加', exact: true }).click();
}

test.describe('Trial mode conversion flow', () => {
  test('starts from landing, allows one camera, then prompts registration on the second camera', async ({ page }) => {
    await startTrialFromLanding(page);

    await createManualCamera(page, 'Trial Camera 1');
    await expect(page.locator('.gear-card').filter({ hasText: 'Trial Camera 1' })).toBeVisible();

    await createManualCamera(page, 'Trial Camera 2');
    const registerPrompt = page.locator('.trial-registration-modal');
    await expect(registerPrompt.getByRole('heading', { name: '注册后继续完整记录' })).toBeVisible();
    await expect(registerPrompt.getByText(/相机 最多可以创建 1 个/)).toBeVisible();

    await registerPrompt.getByRole('button', { name: '注册并保留试用数据' }).click();
    await expect(page).toHaveURL(/\/login\?mode=signup&trial=1/);
    await expect(page.getByRole('heading', { name: '创建账号' })).toBeVisible();
    await expect(page.getByText('创建账号后，可以继续把这台设备上的试用记录保存到你的账号。')).toBeVisible();
  });
});
