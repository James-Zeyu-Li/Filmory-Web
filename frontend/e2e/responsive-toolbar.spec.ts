import { expect, test, type Locator, type Page } from '@playwright/test';
import { resetBrowserData } from './helpers';

async function expectInViewport(page: Page, locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual((await page.evaluate(() => window.innerWidth)) + 1);
}

async function expectNoHorizontalOverflow(page: Page) {
  const { clientWidth, scrollWidth } = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));

  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
}

async function expectAllInViewport(page: Page, locator: Locator) {
  for (const item of await locator.all()) {
    await expectInViewport(page, item);
  }
}

async function loginForResponsiveTest(page: Page) {
  await resetBrowserData(page);
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /本机测试登录|Local test login/ }).click();
}

test.describe('Responsive page toolbars', () => {
  for (const language of ['zh-CN', 'en-US'] as const) {
    for (const width of [320, 375, 390, 430, 768, 1024, 1280]) {
      test(`keeps Gear and Shoot Log controls usable at ${width}px in ${language}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await loginForResponsiveTest(page);
        await page.evaluate((value) => localStorage.setItem('grainfolio_language', value), language);

        await page.goto('/gear?tab=cameras', { waitUntil: 'domcontentloaded' });
        const gearToolbar = page.locator('.gear-library-content .rolls-toolbar');
        await expect(gearToolbar).toBeVisible();
        await expectInViewport(page, gearToolbar);
        await expectAllInViewport(page, gearToolbar.getByRole('tab'));
        await expectInViewport(page, page.getByRole('textbox', { name: language === 'en-US' ? 'Search gear' : '搜索器材' }));
        await expectInViewport(page, gearToolbar.getByRole('button', { name: /Sort by date|按时间排序/ }));
        await expectNoHorizontalOverflow(page);

        await page.goto('/rolls?tab=all', { waitUntil: 'domcontentloaded' });
        const rollsToolbar = page.locator('.rolls-library-content .rolls-toolbar');
        await expect(rollsToolbar).toBeVisible();
        await expectInViewport(page, rollsToolbar);
        await expectAllInViewport(page, rollsToolbar.getByRole('tab'));
        await expectInViewport(page, page.getByRole('textbox', { name: language === 'en-US' ? 'Search shooting records' : '搜索拍摄记录' }));
        await expectInViewport(page, rollsToolbar.getByRole('button', { name: /By date|按日期/ }));
        await expectNoHorizontalOverflow(page);
      });
    }
  }
});
