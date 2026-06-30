import { test, expect } from '@playwright/test';

test.describe.skip('VIP Limits UI Tests', () => {
  // Clear indexedDB before each test and login
  test.beforeEach(async ({ page }) => {
    // Navigate first to let the app initialize IndexedDB via Dexie
    await page.goto('/');
    await expect(page.locator('text=Filmory')).toBeVisible();
    
    // Give Dexie a moment to create stores
    await page.waitForTimeout(1000);

    // Evaluate script to wipe and populate IndexedDB with fake data
    await page.evaluate(async () => {
      const dbName = 'FilmoryDatabase';
      
      const openDb = () => new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open(dbName);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      const db = await openDb();
      
      const writeData = (storeName: string, data: any[]) => new Promise<void>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        store.clear();
        data.forEach(item => store.add(item));
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });

      // Insert 5 rolls for mock_uid_123
      const rolls = Array.from({ length: 5 }).map((_, i) => ({
        id: `roll-${i}`,
        userId: 'mock_uid_123',
        name: `Roll ${i}`,
        cameraId: 'cam-1',
        filmStockId: 'digital',
        status: 'active',
        startDate: Date.now()
      }));

      const cameras = [{
        id: 'cam-1',
        userId: 'mock_uid_123',
        name: 'Test Camera',
        type: 'film',
        format: '135',
        addedAt: Date.now()
      }];

      await writeData('rolls', rolls);
      await writeData('cameras', cameras);
      // userProfile will be injected inside the test dynamically
      
      localStorage.setItem('filmory_enable_film_mode', 'false');
    });
  });

  test('Regular user is blocked from creating 6th roll', async ({ page }) => {
    await page.evaluate(async () => {
      const dbName = 'FilmoryDatabase';
      const req = indexedDB.open(dbName);
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('userProfiles', 'readwrite');
        tx.objectStore('userProfiles').clear();
        tx.objectStore('userProfiles').add({
          id: 'mock_uid_123',
          email: 'test@filmory.com',
          tier: 'regular',
          highResQuotaUsed: 0,
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
      };
    });

    await page.reload();

    // Login if on login page
    try {
      await page.waitForSelector('text=绕过验证 (Mock Admin 模式)', { timeout: 3000 });
      await page.click('text=绕过验证 (Mock Admin 模式)');
    } catch (e) {
      // Already logged in
    }

    // Go to Rolls page
    await page.click('nav >> text=拍摄卷 (Rolls)');

    // Wait for data load (rolls)
    await expect(page.locator('text=进行中 (5)')).toBeVisible({ timeout: 10000 });
    
    // Give Dexie a moment to resolve useUserProfile live query
    await page.waitForTimeout(1000);

    // Open Modal
    await page.click('button:has-text("开始拍摄 (New Roll)")');

    await page.fill('input[placeholder*="春日踏青"]', '6th Roll');
    
    // Select camera
    await page.selectOption('select', { index: 1 }); // first valid option

    // Intercept Alert Dialog
    let dialogAppeared = false;
    page.once('dialog', async dialog => {
      expect(dialog.message()).toContain('【VIP 专享限制】');
      await dialog.accept();
      dialogAppeared = true;
    });

    // Submit (this will trigger the alert, which blocks until the handler accepts it)
    await page.click('button:has-text("开始记录")');

    expect(dialogAppeared).toBe(true);

    // Verify modal didn't close (because it was blocked)
    await expect(page.locator('h3:has-text("新建拍摄卷")')).toBeVisible();
  });

  test('VIP user successfully creates 6th roll', async ({ page }) => {
    await page.evaluate(async () => {
      const dbName = 'FilmoryDatabase';
      const req = indexedDB.open(dbName);
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('userProfiles', 'readwrite');
        tx.objectStore('userProfiles').clear();
        tx.objectStore('userProfiles').add({
          id: 'mock_uid_123',
          email: 'vip@filmory.com',
          tier: 'vip',
          highResQuotaUsed: 0,
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
      };
    });

    await page.reload();

    // Login if on login page
    try {
      await page.waitForSelector('text=绕过验证 (Mock Admin 模式)', { timeout: 3000 });
      await page.click('text=绕过验证 (Mock Admin 模式)');
    } catch (e) {
      // Already logged in
    }

    // Go to Rolls page
    await page.click('nav >> text=拍摄卷 (Rolls)');

    // Wait for data load
    await expect(page.locator('text=进行中 (5)')).toBeVisible({ timeout: 10000 });

    // Give Dexie a moment to resolve useUserProfile live query
    await page.waitForTimeout(1000);

    // Open Modal
    await page.click('button:has-text("开始拍摄 (New Roll)")');

    await page.fill('input[placeholder*="春日踏青"]', '6th Roll VIP');
    
    // Select camera
    await page.selectOption('select', { index: 1 });

    // Ensure NO dialog appears
    page.on('dialog', dialog => {
      throw new Error(`Unexpected dialog appeared: ${dialog.message()}`);
    });

    // Submit
    await page.click('button:has-text("开始记录")');

    // Wait for modal to disappear and list to update
    await expect(page.locator('h3:has-text("新建拍摄卷")')).not.toBeVisible();
    await expect(page.locator('text=进行中 (6)')).toBeVisible();
  });
});
