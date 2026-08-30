import { test, expect } from '@playwright/test';
import { resetAndLogin } from './helpers';

test.describe('Gear edit modal URL contract', () => {
  test.beforeEach(async ({ page }) => {
    await resetAndLogin(page);
    await page.goto('/gear', { waitUntil: 'domcontentloaded' });
  });

  test('camera edit opens from the list, updates the URL, survives refresh, and Back closes it', async ({ page }) => {
    await page.getByRole('button', { name: '添加相机' }).first().click();
    const cameraModal = page.locator('.modal-content').filter({ hasText: '添加相机' });
    await cameraModal.getByRole('button', { name: '胶片相机' }).click();
    await cameraModal.getByRole('button', { name: '135' }).click();
    await cameraModal.getByRole('button', { name: 'Nikon' }).click();
    await cameraModal.getByRole('button', { name: 'F3' }).click();
    await cameraModal.getByRole('button', { name: '添加', exact: true }).click();
    await expect(cameraModal).toBeHidden();

    await page.locator('.gear-card').filter({ hasText: 'Nikon F3' }).getByTitle('编辑相机').click();
    await expect(page).toHaveURL(/\/gear\?tab=cameras&edit=/);
    const editModal = page.locator('.modal-content').filter({ hasText: '编辑相机' });
    await expect(editModal).toBeVisible();

    const detailUrl = page.url();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(detailUrl);
    await expect(page.locator('.modal-content').filter({ hasText: '编辑相机' })).toBeVisible();

    // The initial `/gear` goto (no query) gets canonicalized to `tab=cameras`
    // before the edit push, so Back returns to that canonical list URL.
    await page.goBack({ waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/gear\?tab=cameras$/);
    await expect(page.locator('.modal-content').filter({ hasText: '编辑相机' })).toHaveCount(0);
  });

  test('cleans up an invalid camera edit id back to the Cameras tab', async ({ page }) => {
    await page.goto('/gear?tab=cameras&edit=not-a-real-camera', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('.modal-content').filter({ hasText: '编辑相机' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: '相机设备', level: 1 })).toBeVisible();
  });

  test('lens and other-equipment edits each open their own modal from the list, and Cancel returns to that tab\'s canonical URL', async ({ page }) => {
    await page.getByRole('tab', { name: /镜头库/ }).click();
    await expect(page).toHaveURL(/\/gear\?tab=lenses$/);
    await page.getByRole('button', { name: '添加镜头' }).first().click();
    const lensModal = page.locator('.modal-content').filter({ hasText: '添加镜头' });
    await lensModal.getByRole('button', { name: 'micro-four-thirds' }).click();
    await lensModal.getByRole('button', { name: 'Olympus', exact: true }).click();
    await lensModal.getByRole('button', { name: /M\.Zuiko Digital 17mm/ }).click();
    await lensModal.getByRole('button', { name: '添加', exact: true }).click();
    await expect(lensModal).toBeHidden();

    await page.locator('.lens-card-horizontal').filter({ hasText: 'M.Zuiko Digital 17mm' }).click();
    await expect(page).toHaveURL(/\/gear\?tab=lenses&edit=/);
    await expect(page.locator('.modal-content').filter({ hasText: '编辑镜头' })).toBeVisible();
    // Opened via a list push with a matching origin marker, so Cancel goes
    // back to the tab's own canonical URL (deterministic here because the
    // preceding tab switch already replaced the URL to `tab=lenses` before
    // this push happened).
    await page.getByRole('button', { name: '取消' }).click();
    await expect(page.locator('.modal-content').filter({ hasText: '编辑镜头' })).toHaveCount(0);
    await expect(page).toHaveURL(/\/gear\?tab=lenses$/);

    await page.getByRole('tab', { name: /附件耗材/ }).click();
    await expect(page).toHaveURL(/\/gear\?tab=otherEquipments$/);
    await page.getByRole('button', { name: '登记附件' }).click();
    const equipmentModal = page.locator('.modal-content').filter({ hasText: '添加新器材' });
    await equipmentModal.getByPlaceholder('例如: D-76 显影粉 / 捷信三脚架').fill('E2E Tripod');
    await equipmentModal.getByRole('combobox').selectOption('tripod');
    await equipmentModal.getByRole('button', { name: '添加', exact: true }).click();
    await expect(equipmentModal).toBeHidden();

    await page.locator('.equipment-card').filter({ hasText: 'E2E Tripod' }).click();
    await expect(page).toHaveURL(/\/gear\?tab=otherEquipments&edit=/);
    await expect(page.locator('.modal-content').filter({ hasText: '编辑器材' })).toBeVisible();
    await page.getByRole('button', { name: '取消' }).click();
    await expect(page.locator('.modal-content').filter({ hasText: '编辑器材' })).toHaveCount(0);
    await expect(page).toHaveURL(/\/gear\?tab=otherEquipments$/);
  });

  test('film stock edit opens from the list, updates the URL, and Cancel returns to that tab\'s canonical URL', async ({ page }) => {
    await page.getByRole('tab', { name: /胶卷库/ }).click();
    await expect(page).toHaveURL(/\/gear\?tab=filmStocks$/);
    await page.getByRole('button', { name: '添加胶卷' }).first().click();
    const filmModal = page.locator('.modal-content').filter({ hasText: '入库胶卷' });
    await filmModal.getByRole('button', { name: '120' }).click();
    await filmModal.getByRole('button', { name: 'Kodak' }).click();
    await filmModal.getByRole('button', { name: /Portra 400/ }).click();
    await filmModal.getByRole('button', { name: '展开自定义' }).click();
    await filmModal.getByPlaceholder('例如: Gold 200').fill('Portra 400 E2E');
    await filmModal.getByRole('button', { name: '添加', exact: true }).click();
    await expect(filmModal).toBeHidden();

    await page.locator('.gear-card').filter({ hasText: 'Portra 400 E2E' }).getByTitle('编辑胶卷库存').click();
    await expect(page).toHaveURL(/\/gear\?tab=filmStocks&edit=/);
    await expect(page.locator('.modal-content').filter({ hasText: '编辑胶卷库存' })).toBeVisible();
    await page.getByRole('button', { name: '取消' }).click();
    await expect(page.locator('.modal-content').filter({ hasText: '编辑胶卷库存' })).toHaveCount(0);
    await expect(page).toHaveURL(/\/gear\?tab=filmStocks$/);
  });
});
