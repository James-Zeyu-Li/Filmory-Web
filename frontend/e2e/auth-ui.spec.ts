import { expect, test } from '@playwright/test';
import { resetBrowserData } from './helpers';

test.describe('Auth public UI flows', () => {
  test('uses a dark first-visit auth surface with one restrained brand mark', async ({ page }) => {
    await resetBrowserData(page);
    await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('.auth-brand-lockup img')).toHaveCount(1);
    await expect(page.getByAltText(/Grainfolio 标志|Grainfolio logo/)).toBeVisible();
    await expect(page.locator('.auth-brand-mark')).toHaveCount(0);
  });

  test('navigates to forgot-password and renders reset/check-email fallback states', async ({ page }) => {
    await resetBrowserData(page);

    await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
    await page.getByRole('link', { name: /忘记密码|Forgot password/ }).click();
    await expect(page.getByRole('heading', { name: /找回密码|Recover password/ })).toBeVisible();

    await page.goto('/auth/reset-password', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/链接已失效或不可用|Link expired or unavailable/)).toBeVisible();

    await page.goto('/auth/check-email?email=test%40grainfolio.app', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /请检查邮箱|Check your email/ })).toBeVisible();
    await expect(page.getByText(/目标邮箱：test@grainfolio\.app|Target email: test@grainfolio\.app/)).toBeVisible();
  });

  test('renders callback error fallback when auth callback fails', async ({ page }) => {
    await resetBrowserData(page);

    await page.goto('/auth/callback?error_description=Link%20expired', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/认证链接已过期|The authentication link has expired/)).toBeVisible();
    await expect(page.getByRole('link', { name: /返回登录页|Back to login page/ })).toBeVisible();
  });

  test('keeps canonical auth routes and legacy login links compatible', async ({ page }) => {
    await resetBrowserData(page);
    await page.setViewportSize({ width: 375, height: 812 });

    await page.goto('/login?mode=signup&trial=1', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/auth\/signup\?trial=1$/);
    await expect(page.getByRole('heading', { name: /创建账号|Create account/ })).toBeVisible();

    await page.getByRole('button', { name: /返回登录|Back to login/ }).click();
    await expect(page).toHaveURL(/\/auth\/login$/);
    await expect(page.getByRole('heading', { name: /欢迎回来|Welcome back/ })).toBeVisible();

    const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(hasHorizontalOverflow).toBe(false);
  });

  test('focuses and describes the first invalid signup field', async ({ page }) => {
    await resetBrowserData(page);
    await page.goto('/auth/signup', { waitUntil: 'domcontentloaded' });

    const displayName = page.getByRole('textbox', { name: /显示名称|Display name/ });
    await displayName.fill('   ');
    await page.getByRole('textbox', { name: /邮箱|Email/ }).fill('focus@grainfolio.app');
    await page.getByLabel(/^(密码|Password)$/).fill('Strongpass1');
    await page.getByLabel(/^(确认密码|Confirm password)$/).fill('Strongpass1');
    await page.getByRole('button', { name: /创建账号|Create account/ }).click();

    await expect(displayName).toBeFocused();
    await expect(displayName).toHaveAttribute('aria-invalid', 'true');
    await expect(displayName).toHaveAttribute('aria-describedby', 'login-display-name-error');
    await expect(page.getByRole('alert')).toBeVisible();
  });

  test('keeps password controls inline and touch-safe across themes and widths', async ({ page }) => {
    await resetBrowserData(page);

    for (const theme of ['light', 'dark']) {
      for (const viewport of [
        { width: 320, height: 812 },
        { width: 430, height: 812 },
        { width: 667, height: 375 },
        { width: 768, height: 720 },
      ]) {
        await page.setViewportSize(viewport);
        await page.goto('/logo.png', { waitUntil: 'domcontentloaded' });
        await page.evaluate(selectedTheme => {
          localStorage.setItem('grainfolio-theme', selectedTheme);
        }, theme);
        await page.goto('/auth/signup', { waitUntil: 'domcontentloaded' });

        const passwordInput = page.getByLabel(/^(密码|Password)$/);
        const passwordToggle = page.getByRole('button', { name: /显示密码|Show Password/ });
        const homeLink = page.getByRole('link', { name: /主页|Home/ });
        const inputBox = await passwordInput.boundingBox();
        const toggleBox = await passwordToggle.boundingBox();
        const homeLinkBox = await homeLink.boundingBox();

        expect(inputBox).not.toBeNull();
        expect(toggleBox).not.toBeNull();
        expect(homeLinkBox).not.toBeNull();
        expect(toggleBox!.height).toBeGreaterThanOrEqual(44);
        expect(homeLinkBox!.height).toBeGreaterThanOrEqual(44);
        expect(Math.abs(inputBox!.y - toggleBox!.y)).toBeLessThan(2);
        await expect(passwordToggle).toHaveAttribute('aria-pressed', 'false');
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);

        if (viewport.width <= 640) {
          await expect(passwordInput).toHaveCSS('font-size', '16px');
        }
      }
    }
  });

  test('keeps the login keyboard order aligned with the visual form order', async ({ page }) => {
    await resetBrowserData(page);
    await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });

    const orderedControls = [
      page.getByRole('link', { name: /主页|Home/ }),
      page.getByRole('textbox', { name: /邮箱|Email/ }),
      page.getByLabel(/^(密码|Password)$/),
      page.getByRole('button', { name: /显示密码|Show Password/ }),
      page.getByRole('button', { name: /^(登录|Log in)$/ }),
      page.getByRole('button', { name: /立即注册|Sign up now/ }),
      page.getByRole('link', { name: /忘记密码|Forgot password/ }),
    ];

    await orderedControls[0].focus();
    await expect(orderedControls[0]).toBeFocused();

    for (const control of orderedControls.slice(1)) {
      await page.keyboard.press('Tab');
      await expect(control).toBeFocused();
    }
  });
});
