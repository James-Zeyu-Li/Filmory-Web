import { expect, test } from '@playwright/test';
import { resetAndLogin, startTrialFromLanding } from './helpers';

test('trial users can still find signup after dismissing the trial banner', async ({ page }) => {
  await startTrialFromLanding(page);

  await page.getByRole('button', { name: '关闭提示' }).click();
  await expect(page.getByText('当前处于')).not.toBeVisible();

  await page.getByRole('button', { name: '我的账户' }).click();
  await expect(page.getByRole('heading', { name: '我的账户' })).toBeVisible();
  await expect(page.getByText('当前是本地试用')).toBeVisible();

  await page.getByRole('button', { name: '免费注册并开启云同步' }).click();

  await expect(page).toHaveURL(/\/auth\/signup\?trial=1/);
});

test('developer bypass account is labeled separately from a real account', async ({ page }) => {
  await resetAndLogin(page);

  await page.getByRole('button', { name: '我的账户' }).click();

  await expect(page.getByRole('heading', { name: '我的账户' })).toBeVisible();
  await expect(page.getByText('Developer Mode')).toBeVisible();
  await expect(page.getByText('管理员')).toBeVisible();
  await expect(page.getByRole('button', { name: '切换真实账号登录' })).toBeVisible();
});
