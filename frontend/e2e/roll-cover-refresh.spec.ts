import { expect, test, type Page } from '@playwright/test';
import { resetAndLogin } from './helpers';

const MOCK_COVER_SVG = [
  '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1800" viewBox="0 0 1200 1800">',
  '<rect width="1200" height="1800" fill="#f59e0b"/>',
  '<circle cx="600" cy="900" r="260" fill="#18181b" opacity="0.84"/>',
  '<text x="600" y="920" text-anchor="middle" font-size="96" fill="#fff" font-family="serif">Grainfolio</text>',
  '</svg>',
].join('');
const MOCK_COVER_DATA_URL = `data:image/svg+xml;base64,${Buffer.from(MOCK_COVER_SVG).toString('base64')}`;

async function attachLocalCoverToRoll(page: Page, rollName: string) {
  await page.evaluate(async ({ targetRollName, coverDataUrl, coverSvg }) => {
    const openDatabase = () => new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('GrainfolioDatabase');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });

    const runRequest = <T>(request: IDBRequest<T>) => new Promise<T>((resolve, reject) => {
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });

    const database = await openDatabase();
    const transaction = database.transaction(['rolls', 'photoAssets'], 'readwrite');
    const transactionDone = new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => {
        database.close();
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    });
    const rollsStore = transaction.objectStore('rolls');
    const photoAssetsStore = transaction.objectStore('photoAssets');
    const userId = localStorage.getItem('grainfolio_user_id');
    if (!userId) throw new Error('Missing local test user');
    const rollId = crypto.randomUUID();
    const photoId = crypto.randomUUID();
    await runRequest(photoAssetsStore.put({
      id: photoId,
      userId,
      rollId,
      originalFileName: 'e2e-roll-cover.svg',
      fileSize: coverDataUrl.length,
      blob: new Blob([coverSvg], { type: 'image/svg+xml' }),
      thumbnailUrl: coverDataUrl,
      addedAt: Date.now(),
      isPinned: 1,
      orderIndex: 0,
    }));
    await runRequest(rollsStore.put({
      id: rollId,
      userId,
      name: targetRollName,
      cameraIds: [],
      status: 'active',
      startDate: Date.now(),
      coverPhotoId: photoId,
    }));
    await transactionDone;
  }, { targetRollName: rollName, coverDataUrl: MOCK_COVER_DATA_URL, coverSvg: MOCK_COVER_SVG });
}

test.describe('Roll cover persistence', () => {
  test.beforeEach(async ({ page }) => {
    await resetAndLogin(page);
  });

  test('keeps the roll cover visible after refreshing the page', async ({ page }) => {
    const rollName = 'E2E Cover Refresh Roll';

    await attachLocalCoverToRoll(page, rollName);
    await page.goto('/rolls', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /全部拍摄记录|All shooting records/ })).toBeVisible();

    const refreshedRollCard = page.locator('.roll-card, .roll-card-row').filter({ hasText: rollName });
    await expect(refreshedRollCard).toBeVisible();
    const cardCover = refreshedRollCard.locator('.roll-card-cover img, .roll-card-row-thumb img').first();
    await expect(cardCover).toBeVisible();
    await expect(cardCover).toHaveAttribute('src', /^blob:/);
    await expect(cardCover).toHaveAttribute('loading', 'lazy');
    await expect(cardCover).toHaveAttribute('decoding', 'async');
    await expect(cardCover).toHaveCSS('object-fit', 'cover');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(refreshedRollCard).toBeVisible();
    await expect(refreshedRollCard.locator('.roll-card-cover img, .roll-card-row-thumb img').first()).toHaveAttribute('src', /^blob:/);

    await refreshedRollCard.getByRole('button', { name: new RegExp(`打开拍摄记录：${rollName}|Open shooting record: ${rollName}`) }).press('Enter');
    const refreshedDrawerCover = page.locator('.drawer-content .cover-preview img');
    await expect(refreshedDrawerCover).toBeVisible();
    await expect(refreshedDrawerCover).toHaveAttribute('src', /^blob:/);

    await page.getByRole('button', { name: /查看封面|View cover/ }).last().click();
    const fullPreview = page.locator('.roll-cover-preview-modal img');
    await expect(fullPreview).toBeVisible();
    await expect(fullPreview).toHaveAttribute('src', /^blob:/);
    await expect(fullPreview).toHaveCSS('object-fit', 'contain');
  });
});
