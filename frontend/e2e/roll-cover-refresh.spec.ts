import { expect, test, type Page } from '@playwright/test';
import { resetAndLogin } from './helpers';

const MOCK_COVER_SVG = [
  '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200" viewBox="0 0 320 200">',
  '<rect width="320" height="200" fill="#f59e0b"/>',
  '<circle cx="160" cy="100" r="54" fill="#18181b" opacity="0.84"/>',
  '<text x="160" y="108" text-anchor="middle" font-size="22" fill="#fff" font-family="serif">Grainfolio</text>',
  '</svg>',
].join('');
const MOCK_COVER_DATA_URL = `data:image/svg+xml;base64,${Buffer.from(MOCK_COVER_SVG).toString('base64')}`;

async function createRoll(page: Page, rollName: string) {
  await page.goto('/rolls', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /全部胶卷记录|所有拍摄卷/ }).click();
  await page.getByRole('button', { name: /新建单卷记录|新建独立拍摄卷/ }).click();

  const rollModal = page.locator('.modal-content').filter({ hasText: '新建胶卷记录' });
  await rollModal.getByPlaceholder('例如: 2026春日踏青').fill(rollName);
  await rollModal.locator('div').filter({ hasText: /^Minolta X-700$/ }).first().click();
  await rollModal.getByPlaceholder(/搜索胶卷库/).fill('Kodak Gold 200');
  await rollModal.getByRole('button', { name: '开始记录' }).click();

  const rollCard = page.locator('.roll-card, .roll-card-row').filter({ hasText: rollName });
  await expect(rollCard).toBeVisible();
  return rollCard;
}

async function expectCoverBackground(locator: ReturnType<Page['locator']>) {
  await expect.poll(async () => {
    return locator.evaluate((element) => getComputedStyle(element).backgroundImage);
  }).toContain('url(');
}

async function attachLocalCoverToRoll(page: Page, rollName: string) {
  await page.evaluate(async ({ targetRollName, coverDataUrl }) => {
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
    const roll = await runRequest<any>(rollsStore.index('name').get(targetRollName));

    if (!roll?.id) {
      throw new Error(`Roll not found: ${targetRollName}`);
    }

    const photoId = crypto.randomUUID();
    await runRequest(photoAssetsStore.put({
      id: photoId,
      userId: roll.userId,
      rollId: roll.id,
      originalFileName: 'e2e-roll-cover.svg',
      fileSize: coverDataUrl.length,
      thumbnailUrl: coverDataUrl,
      previewUrl: coverDataUrl,
      addedAt: Date.now(),
      isPinned: 1,
      orderIndex: 0,
    }));
    await runRequest(rollsStore.put({ ...roll, coverPhotoId: photoId }));
    await transactionDone;
  }, { targetRollName: rollName, coverDataUrl: MOCK_COVER_DATA_URL });
}

test.describe('Roll cover persistence', () => {
  test.beforeEach(async ({ page }) => {
    await resetAndLogin(page);
  });

  test('keeps the roll cover visible after refreshing the page', async ({ page }) => {
    const rollName = 'E2E Cover Refresh Roll';

    await createRoll(page, rollName);
    await attachLocalCoverToRoll(page, rollName);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /项目集|全部胶卷记录|散卷/ })).toBeVisible();
    await page.getByRole('button', { name: /全部胶卷记录|所有拍摄卷/ }).click();

    const refreshedRollCard = page.locator('.roll-card, .roll-card-row').filter({ hasText: rollName });
    await expect(refreshedRollCard).toBeVisible();
    await expectCoverBackground(refreshedRollCard.locator('.roll-card-cover, .roll-card-row-thumb').first());

    await refreshedRollCard.click();
    const refreshedDrawerCover = page.locator('.drawer-content .cover-preview');
    await expect(refreshedDrawerCover).toBeVisible();
    await expectCoverBackground(refreshedDrawerCover);
  });
});
