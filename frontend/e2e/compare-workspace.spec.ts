import { expect, test } from '@playwright/test';
import { resetBrowserData } from './helpers';

const photo = {
  name: 'compare.png',
  mimeType: 'image/png',
  buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'),
};

async function openCompare(page: import('@playwright/test').Page) {
  await resetBrowserData(page);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Try it Now' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await page.evaluate(() => localStorage.setItem('grainfolio_language', 'en-US'));
  await page.goto('/compare', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Photo compare' })).toBeVisible();
}

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const widths = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);
}

test.describe('Compare workspace', () => {
  test('keeps the empty workspace inside supported responsive widths', async ({ page }) => {
    await openCompare(page);

    for (const width of [320, 375, 430, 768, 1024]) {
      await page.setViewportSize({ width, height: 844 });
      await expect(page.getByLabel('Choose photo A')).toBeAttached();
      await expect(page.getByLabel('Choose photo B')).toBeAttached();
      await expect(page.getByText('Waiting for photos')).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }
  });

  test('supports local upload, both comparison modes, and invalid-file feedback', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openCompare(page);

    await page.getByLabel('Choose photo A').setInputFiles(photo);
    await page.getByLabel('Choose photo B').setInputFiles(photo);
    await expect(page.getByRole('slider', { name: 'Photo comparison position' })).toBeVisible();

    const clearButton = page.getByRole('button', { name: 'Remove photo A' });
    const clearBox = await clearButton.boundingBox();
    expect(clearBox?.width).toBeGreaterThanOrEqual(44);
    expect(clearBox?.height).toBeGreaterThanOrEqual(44);

    await page.getByRole('button', { name: 'Side by side' }).click();
    await expect(page.locator('.compare-side-by-side')).toBeVisible();

    await clearButton.click();
    await page.getByLabel('Choose photo A').setInputFiles({
      name: 'notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('not an image'),
    });
    await expect(page.getByRole('alert')).toContainText('Choose an image file for position A');
  });

  test('uses theme tokens and honors reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openCompare(page);
    await page.evaluate(() => localStorage.setItem('grainfolio-theme', 'dark'));
    await page.reload({ waitUntil: 'domcontentloaded' });

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const transitionDuration = await page.locator('.local-dropzone').first().evaluate(element => parseFloat(getComputedStyle(element).transitionDuration));
    expect(transitionDuration).toBeLessThanOrEqual(0.001);
    await expect(page.locator('.empty-icon-wrapper')).toHaveCSS('animation-name', 'none');
  });
});
