import { expect, test } from '@playwright/test';
import { resetBrowserData } from './helpers';

test.describe('Auth public UI flows', () => {
  test('navigates to forgot-password and renders reset/check-email fallback states', async ({ page }) => {
    await resetBrowserData(page);

    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.getByRole('link', { name: '忘记密码？' }).click();
    await expect(page.getByRole('heading', { name: '找回密码' })).toBeVisible();

    await page.goto('/auth/reset-password', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('链接已失效或不可用')).toBeVisible();

    await page.goto('/auth/check-email?email=test%40filmory.app', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: '请检查邮箱' })).toBeVisible();
    await expect(page.getByText('目标邮箱：test@filmory.app')).toBeVisible();
  });

  test('renders callback error fallback when auth callback fails', async ({ page }) => {
    await resetBrowserData(page);

    await page.goto('/auth/callback?error_description=Link%20expired', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('认证链接已过期，请重新发起邮箱验证或密码重设流程。')).toBeVisible();
    await expect(page.getByRole('link', { name: '返回登录页' })).toBeVisible();
  });
});
