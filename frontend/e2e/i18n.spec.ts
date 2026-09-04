import { expect, test } from '@playwright/test';
import { resetAndLogin } from './helpers';

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const metrics = await page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    return {
      viewportWidth: window.innerWidth,
      documentClientWidth: root.clientWidth,
      documentScrollWidth: root.scrollWidth,
      bodyClientWidth: body.clientWidth,
      bodyScrollWidth: body.scrollWidth,
    };
  });

  expect(metrics.documentScrollWidth).toBeLessThanOrEqual(metrics.documentClientWidth + 1);
  expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.bodyClientWidth + 1);
}

test.describe('Language preferences', () => {
  test('switches the core shell to English and persists after refresh', async ({ page }) => {
    await resetAndLogin(page);
    await expect(page.getByRole('heading', { name: '控制中心' })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.getByRole('button', { name: /^设置$/ }).click();
    const settingsModal = page.locator('.modal-content').last();
    await settingsModal.getByRole('tab', { name: '界面' }).click();
    await settingsModal.locator('select[aria-label="界面语言"]').selectOption('en-US');

    await expect(settingsModal.getByRole('heading', { name: 'Settings & Data Protection' })).toBeVisible();
    await expect(settingsModal.getByText('Interface language')).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.locator('.modal-content button.icon-btn').click();

    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Shoot Log' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-US');
    await expectNoHorizontalOverflow(page);

    // The part of this test's own name this checks: the language choice
    // survives a full reload, not just the in-memory state right after
    // switching it. Deliberately does not also re-walk every other page's
    // copy here — a single shared smoke test that chains through the whole
    // app goes fully dark past its first stale assertion, so each page's own
    // spec (settings.spec.ts, danger-cancel.spec.ts, etc.) is responsible for
    // asserting its own English strings where it already exercises that page.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Shoot Log' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-US');
    await expectNoHorizontalOverflow(page);
  });

  test('shows the trial banner and signup prompt in English without layout overflow', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.setItem('grainfolio_language', 'en-US'));
    await page.reload({ waitUntil: 'domcontentloaded' });

    await page.getByRole('button', { name: 'Try it Now' }).click();
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByText('local trial mode')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign up free and enable cloud sync' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('renders auth helper pages in English', async ({ page }) => {
    await page.goto('/logo.png', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.setItem('grainfolio_language', 'en-US'));

    await page.goto('/auth/forgot-password', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Recover password' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send password reset email' })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto('/auth/reset-password', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Link expired or unavailable')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Request password reset email again' })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto('/auth/check-email?email=test%40grainfolio.app', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
    await expect(page.getByText('Target email: test@grainfolio.app.')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto('/auth/callback?error_description=Link%20expired', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('The authentication link has expired. Start email verification or password reset again.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to login page' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    test(`keeps translated landing and workspace layouts inside the viewport at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => localStorage.setItem('grainfolio_language', 'en-US'));
      await page.reload({ waitUntil: 'domcontentloaded' });

      await expect(page.getByRole('button', { name: 'Try it Now' })).toBeVisible();
      await expectNoHorizontalOverflow(page);

      await resetAndLogin(page);
      await page.evaluate(() => localStorage.setItem('grainfolio_language', 'en-US'));
      await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
      await expectNoHorizontalOverflow(page);

      // Unlike Gear's ?tab= param, Rolls' initial view state only reads a
      // specific ?collectionId= or localStorage — a bare ?tab=collections is
      // ignored on first load, so the Collections tab must be clicked.
      await page.goto('/rolls', { waitUntil: 'domcontentloaded' });
      await page.getByRole('tab', { name: 'Collections' }).click();
      await expect(page.getByRole('heading', { name: 'Collections', exact: true })).toBeVisible();
      await expectNoHorizontalOverflow(page);

      await page.goto('/gear?tab=cameras', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'Cameras', exact: true })).toBeVisible();
      await expectNoHorizontalOverflow(page);

      await page.goto('/insights', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'Insights', exact: true })).toBeVisible();
      await expectNoHorizontalOverflow(page);

      await page.getByRole('tab', { name: 'Spending' }).click();
      await expect(page.getByRole('heading', { name: 'Ledger' })).toBeVisible();
      await expectNoHorizontalOverflow(page);

      await page.goto('/compare', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'Photo compare' })).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });
  }
});
