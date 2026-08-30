import { expect, test } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { resetBrowserData } from './helpers';

const runSyncSmoke = process.env.RUN_SYNC_E2E_SMOKE === '1';
const describeSyncSmoke = runSyncSmoke ? test.describe : test.describe.skip;

const supabaseUrl = process.env.SYNC_SUPABASE_URL || 'http://127.0.0.1:54321';
const serviceRoleKey = process.env.SYNC_SUPABASE_SERVICE_ROLE_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const password = 'Strongpass1';

describeSyncSmoke('Supabase sync smoke with real Auth UI', () => {
  let userId = '';
  let email = '';

  test.beforeEach(async ({ page }) => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    email = `sync-e2e-${stamp}@grainfolio.test`;
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    expect(created.error).toBeNull();
    userId = created.data.user?.id || '';
    expect(userId).toBeTruthy();

    await resetBrowserData(page);
  });

  test.afterEach(async () => {
    if (!userId) return;

    for (const table of [
      'photo_assets',
      'album_photos',
      'albums',
      'rolls',
      'film_backs',
      'camera_systems',
      'film_stocks',
      'lenses',
      'cameras',
      'collections',
      'other_equipments',
      'tag_configs',
      'ledger_transactions',
      'user_profiles',
    ]) {
      await admin.from(table).delete().eq('user_id', userId);
    }

    await admin.auth.admin.deleteUser(userId);
  });

  test('syncs camera, film stock, and roll records created from the real app', async ({ page }) => {
    const cameraName = `Sync Smoke Camera ${Date.now()}`;
    const filmBrand = 'Sync Smoke';
    const filmName = `Color ${Date.now()}`;
    const rollName = `Sync Smoke Roll ${Date.now()}`;

    page.on('console', message => {
      if (message.type() === 'error') {
        console.log(`[browser:${message.type()}] ${message.text()}`);
      }
    });

    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.getByLabel('邮箱').fill(email);
    await page.getByRole('textbox', { name: '密码' }).fill(password);
    await page.getByRole('button', { name: '登录', exact: true }).click();
    await expect(page.getByRole('heading', { name: /控制中心/ })).toBeVisible();

    await page.goto('/gear', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: '添加相机' }).first().click();
    const cameraModal = page.locator('.modal-content').filter({ hasText: '添加相机' });
    await cameraModal.getByPlaceholder('例如: Minolta X-700').fill(cameraName);
    await cameraModal.getByRole('button', { name: '添加', exact: true }).click();
    await expect(page.locator('.gear-card').filter({ hasText: cameraName })).toBeVisible();

    await expect.poll(async () => page.evaluate(async () => {
      const { SyncService } = await import('/src/services/syncService.ts');
      return SyncService.isAutoSyncEnabled();
    }), { timeout: 5000 }).toBe(true);

    await expect.poll(async () => {
      const { data, error } = await admin
        .from('cameras')
        .select('id, user_id, name')
        .eq('user_id', userId)
        .eq('name', cameraName);
      if (error) throw error;
      return data.length;
    }, { timeout: 10000 }).toBe(1);

    await page.getByRole('button', { name: /胶卷库/ }).click();
    await page.getByRole('button', { name: '添加胶卷' }).first().click();
    const filmModal = page.locator('.modal-content').filter({ hasText: '入库胶卷' });
    await filmModal.getByRole('button', { name: '+ 找不到型号？展开手动填写' }).click();
    await filmModal.locator('.form-group').filter({ hasText: '品牌/厂商' }).locator('input').fill(filmBrand);
    await filmModal.locator('.form-group').filter({ hasText: '型号名称' }).locator('input').fill(filmName);
    await filmModal.locator('.form-group').filter({ hasText: 'ISO 速度' }).locator('input').fill('200');
    await filmModal.locator('.form-group').filter({ hasText: '初始库存数量' }).locator('input').fill('2');
    await filmModal.getByRole('button', { name: '添加', exact: true }).click();
    await expect(page.locator('.gear-card').filter({ hasText: filmName })).toBeVisible();

    await expect.poll(async () => {
      const { data, error } = await admin
        .from('film_stocks')
        .select('id, user_id, brand, name')
        .eq('user_id', userId)
        .eq('brand', filmBrand)
        .eq('name', filmName);
      if (error) throw error;
      return data[0]?.id || '';
    }, { timeout: 10000 }).not.toBe('');

    await page.goto('/rolls', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /全部拍摄记录|所有拍摄卷/ }).click();
    await page.getByRole('button', { name: /新建拍摄记录|新建独立拍摄卷/ }).click();
    const rollModal = page.locator('.modal-content').filter({ hasText: '新建拍摄记录' });
    await rollModal.getByPlaceholder('例如: 2026春日踏青').fill(rollName);
    await rollModal.locator('div').filter({ hasText: new RegExp(`^${cameraName}$`) }).first().click();
    await rollModal.getByPlaceholder(/搜索胶卷库/).fill(`${filmBrand} ${filmName}`);
    await rollModal.getByRole('button', { name: '开始记录' }).click();
    await expect(page.locator('.roll-card, .record-row-card').filter({ hasText: rollName })).toBeVisible();

    await expect.poll(async () => {
      const { data, error } = await admin
        .from('rolls')
        .select('id, user_id, name, film_stock_id, camera_ids')
        .eq('user_id', userId)
        .eq('name', rollName);
      if (error) throw error;
      return data.length;
    }, { timeout: 10000 }).toBe(1);
  });
});
