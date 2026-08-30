import { expect, test } from '@playwright/test';

const viewports = [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 768, height: 900 },
  { width: 640, height: 844 },
  { width: 540, height: 844 },
  { width: 480, height: 844 },
  { width: 430, height: 844 },
  { width: 390, height: 844 },
  { width: 320, height: 700 },
  { width: 1280, height: 900 },
];

test.describe('Landing layout', () => {
  for (const viewport of viewports) {
    test(`does not create horizontal overflow at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto('/', { waitUntil: 'domcontentloaded' });

      await expect(page.locator('.landing-container')).toBeVisible();

      const metrics = await page.evaluate(() => {
        const root = document.documentElement;
        const body = document.body;
        const landing = document.querySelector('.landing-container')?.getBoundingClientRect();
        return {
          documentClientWidth: root.clientWidth,
          documentScrollWidth: root.scrollWidth,
          bodyClientWidth: body.clientWidth,
          bodyScrollWidth: body.scrollWidth,
          landingLeft: landing?.left ?? 0,
          landingRight: landing?.right ?? 0,
          viewportWidth: window.innerWidth,
        };
      });

      expect(metrics.documentScrollWidth).toBeLessThanOrEqual(metrics.documentClientWidth);
      expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.bodyClientWidth);
      expect(metrics.landingLeft).toBeGreaterThanOrEqual(0);
      expect(metrics.landingRight).toBeLessThanOrEqual(metrics.viewportWidth);

      const brand = await page.locator('.landing-brand').boundingBox();
      const actions = await page.locator('.landing-nav-actions').boundingBox();
      expect(brand).not.toBeNull();
      expect(actions).not.toBeNull();
      expect(brand!.x + brand!.width).toBeLessThanOrEqual(actions!.x);

      if (viewport.width <= 768) {
        await expect(page.locator('.landing-nav-actions .btn-ghost-trial')).toBeHidden();
        await expect(page.locator('.landing-nav-actions .landing-nav-login')).toBeHidden();
      } else {
        await expect(page.locator('.landing-nav-actions .landing-nav-login')).toBeVisible();
      }
    });
  }
});
