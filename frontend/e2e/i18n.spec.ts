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

    await page.getByRole('button', { name: /偏好设置/ }).click();
    const settingsModal = page.locator('.modal-content').last();
    await settingsModal.locator('select[aria-label="界面语言"]').selectOption('en-US');

    await expect(settingsModal.getByRole('heading', { name: 'Settings & Data Protection' })).toBeVisible();
    await expect(settingsModal.getByText('Interface language')).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.locator('.modal-content button.icon-btn').click();

    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Rolls' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-US');
    await expectNoHorizontalOverflow(page);

    await page.getByRole('button', { name: 'Batch import' }).click();
    const excelModal = page.locator('.modal-content').last();
    await expect(excelModal.getByRole('heading', { name: 'Batch import gear and roll records' })).toBeVisible();
    await expect(excelModal.getByText('Step 1: Download import template')).toBeVisible();
    await expect(excelModal.getByRole('button', { name: 'Choose spreadsheet and import' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await excelModal.locator('button.icon-btn').click();

    await page.getByRole('link', { name: 'Rolls' }).click();
    await expect(page.getByRole('heading', { name: 'Collections', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'New roll record' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'All roll records' })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.getByRole('button', { name: 'All roll records' }).click();
    const firstRollCard = page.locator('.roll-card, .roll-card-row').first();
    await expect(firstRollCard).toBeVisible();
    await firstRollCard.click();
    const rollDrawer = page.locator('.drawer-panel');
    await expect(rollDrawer.getByRole('heading', { name: 'Cover photo' })).toBeVisible();
    await expect(rollDrawer.getByRole('heading', { name: 'Gear & film' })).toBeVisible();
    await expect(rollDrawer.getByRole('heading', { name: 'Shooting info' })).toBeVisible();
    await expect(rollDrawer.getByRole('heading', { name: 'Lab record' })).toBeVisible();
    await expect(rollDrawer.getByRole('button', { name: 'Save all changes' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await rollDrawer.locator('.drawer-header button.icon-btn').last().click();

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'All roll records', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Gear Library' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-US');
    await expectNoHorizontalOverflow(page);

    await page.getByRole('link', { name: 'Gear Library' }).click();
    await expect(page.getByRole('heading', { name: 'Cameras', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /Lenses/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Film Stock/ })).toBeVisible();
    await page.getByRole('button', { name: 'Add camera' }).first().click();
    await expect(page.getByRole('heading', { name: 'Add camera' })).toBeVisible();
    await expect(page.getByText('Quick add camera')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Film camera' })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto('/insights', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Stats & Cost' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Shooting stats' })).toBeVisible();
    await expect(page.getByText('Total rolls')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.getByRole('button', { name: 'Photo ledger' }).click();
    await expect(page.getByRole('heading', { name: 'Gear spend' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Ledger' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add entry' })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto('/compare', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Photo compare' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Side by side' })).toBeVisible();
    await expect(page.getByText('Drop photo here')).toHaveCount(2);
    await expect(page.getByText('Waiting for photos')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto('/photos', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('shows trial conversion prompts in English without layout overflow', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.setItem('grainfolio_language', 'en-US'));
    await page.reload({ waitUntil: 'domcontentloaded' });

    await page.getByRole('button', { name: 'Try it Now' }).click();
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByText('local trial mode')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign up free and enable cloud sync' })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.getByRole('button', { name: 'Batch import' }).click();
    const registerPrompt = page.locator('.trial-registration-modal');
    await expect(registerPrompt.getByRole('heading', { name: 'Sign up to keep logging' })).toBeVisible();
    await expect(registerPrompt.getByText(/roll records/)).toBeVisible();
    await expect(registerPrompt.getByRole('button', { name: 'Sign up and keep trial data' })).toBeVisible();
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

      await page.goto('/rolls', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'Collections', exact: true })).toBeVisible();
      await expectNoHorizontalOverflow(page);

      await page.goto('/gear?tab=cameras', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'Cameras', exact: true })).toBeVisible();
      await expectNoHorizontalOverflow(page);

      await page.goto('/insights', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'Stats & Cost' })).toBeVisible();
      await expectNoHorizontalOverflow(page);

      await page.getByRole('button', { name: 'Photo ledger' }).click();
      await expect(page.getByRole('heading', { name: 'Ledger' })).toBeVisible();
      await expectNoHorizontalOverflow(page);

      await page.goto('/compare', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'Photo compare' })).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });
  }
});
