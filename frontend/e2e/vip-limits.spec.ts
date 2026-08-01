import { test, expect, type Page } from '@playwright/test';
import { resetBrowserData } from './helpers';

const DEV_USER_ID = 'mock_uid_123';

async function loginIntoDigitalWorkspace(page: Page) {
  await resetBrowserData(page);
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.setItem('grainfolio_enable_film_mode', 'false');
  });
  await page.getByRole('button', { name: /本机测试登录/ }).click();
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /控制中心/ })).toBeVisible();
}

async function seedRollLimitScenario(page: Page, tier: 'regular' | 'vip') {
  await page.evaluate(async ({ tier, devUserId }) => {
    const dbName = 'GrainfolioDatabase';

    const openDb = () => new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(dbName);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    const writeData = (db: IDBDatabase, storeName: string, data: any[]) => new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.clear();
      data.forEach(item => store.add(item));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    const db = await openDb();
    const now = Date.now();

    const cameras = [{
      id: 'cam-1',
      userId: devUserId,
      name: 'Test Camera',
      type: 'film',
      format: '135',
      addedAt: now
    }];

    const rolls = Array.from({ length: 5 }).map((_, i) => ({
      id: `roll-${i}`,
      userId: devUserId,
      name: `Roll ${i}`,
      cameraIds: ['cam-1'],
      filmStockId: 'digital-placeholder',
      status: 'active',
      startDate: now - i * 1000
    }));

    const profiles = [{
      id: devUserId,
      userId: devUserId,
      tier,
      role: 'admin',
      highResQuotaUsed: 0,
      updatedAt: now
    }];

    await writeData(db, 'cameras', cameras);
    await writeData(db, 'rolls', rolls);
    await writeData(db, 'userProfiles', profiles);
  }, { tier, devUserId: DEV_USER_ID });
}

async function getRollCount(page: Page) {
  return page.evaluate(async () => {
    const dbName = 'GrainfolioDatabase';
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(dbName);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    return await new Promise<number>((resolve, reject) => {
      const tx = db.transaction('rolls', 'readonly');
      const store = tx.objectStore('rolls');
      const req = store.count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  });
}

test.describe('VIP Limits UI Tests', () => {
  test.beforeEach(async ({ page }) => {
    await loginIntoDigitalWorkspace(page);
  });

  test('Regular user is blocked from creating 6th roll', async ({ page }) => {
    await page.goto('/rolls', { waitUntil: 'domcontentloaded' });
    await seedRollLimitScenario(page, 'regular');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect.poll(() => getRollCount(page)).toBe(5);

    await page.getByRole('button', { name: '新建单卷记录' }).click();
    const rollModal = page.locator('.modal-content').filter({ hasText: '新建胶卷记录' });

    await rollModal.getByPlaceholder('例如: 2026春日踏青').fill('6th Roll Regular');
    await expect(rollModal.getByText('Test Camera')).toBeVisible();
    await rollModal.getByText('Test Camera').click();
    await expect(rollModal.getByRole('button', { name: '开始记录' })).toBeEnabled();
    await rollModal.getByRole('button', { name: '开始记录' }).click();

    const upgradeModal = page.locator('.upgrade-modal');
    await expect(upgradeModal.getByRole('heading', { name: '已达到免费版上限' })).toBeVisible();
    await expect(upgradeModal.getByText(/5 个进行中的胶卷记录/)).toBeVisible();
    expect(await getRollCount(page)).toBe(5);
  });

  test('VIP user successfully creates 6th roll', async ({ page }) => {
    await page.goto('/rolls', { waitUntil: 'domcontentloaded' });
    await seedRollLimitScenario(page, 'vip');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect.poll(() => getRollCount(page)).toBe(5);

    await page.getByRole('button', { name: '新建单卷记录' }).click();
    const rollModal = page.locator('.modal-content').filter({ hasText: '新建胶卷记录' });

    await rollModal.getByPlaceholder('例如: 2026春日踏青').fill('6th Roll VIP');
    await expect(rollModal.getByText('Test Camera')).toBeVisible();
    await rollModal.getByText('Test Camera').click();
    await expect(rollModal.getByRole('button', { name: '开始记录' })).toBeEnabled();
    await rollModal.getByRole('button', { name: '开始记录' }).click();

    await expect(page.locator('.modal-content').filter({ hasText: '新建胶卷记录' })).not.toBeVisible();
    await expect.poll(() => getRollCount(page)).toBe(6);
    await page.getByRole('button', { name: '全部胶卷记录' }).click();
    await expect(page.getByText('6th Roll VIP')).toBeVisible();
  });
});
