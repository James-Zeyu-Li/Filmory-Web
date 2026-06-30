import { expect, type Page } from '@playwright/test';

export async function resetBrowserData(page: Page) {
  await page.goto('/logo.png', { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    localStorage.clear();
    sessionStorage.clear();

    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase('FilmoryDatabase');
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
      request.onblocked = () => resolve();
    });
  });
}

export async function loginWithDevBypass(page: Page) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /Dev Login/i }).click();
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /控制中心/ })).toBeVisible();
}

export async function resetAndLogin(page: Page) {
  await resetBrowserData(page);
  await loginWithDevBypass(page);
}
