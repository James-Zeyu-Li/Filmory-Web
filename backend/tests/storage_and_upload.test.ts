import request from 'supertest';
import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import app from '../src/index';
import { prisma } from '../src/db';

let token = '';
let dummyImageBuffer: Buffer;

beforeAll(async () => {
  // Set testing environment
  process.env.NODE_ENV = 'test';

  // 1. Clear database
  await prisma.photoAsset.deleteMany();
  await prisma.roll.deleteMany();
  await prisma.camera.deleteMany();
  await prisma.filmStock.deleteMany();

  // 2. Create testing camera
  await prisma.camera.create({
    data: {
      id: 1,
      name: 'Leica M6 Test',
      type: 'film',
      format: '135'
    }
  });

  // 3. Log in to get JWT token
  const response = await request(app)
    .post('/api/auth/login')
    .send({ username: 'admin', password: 'password' });
  
  token = response.body.token;

  // 4. Generate dummy image buffer using sharp
  dummyImageBuffer = await sharp({
    create: {
      width: 50,
      height: 50,
      channels: 3,
      background: { r: 255, g: 0, b: 0 }
    }
  })
  .png()
  .toBuffer();
});

afterAll(async () => {
  await prisma.$disconnect();

  // Clean up any files created in the uploads folder during tests to keep directory clean
  const uploadsDir = path.join(process.cwd(), 'uploads');
  try {
    await fs.rm(uploadsDir, { recursive: true, force: true });
  } catch (err) {
    console.error('Failed to clean up uploads test directory:', err);
  }
});

describe('Storage Infrastructure & Image Processing Pipeline Tests', () => {

  test('POST /api/cameras/:id/avatar - should upload and crop camera avatar', async () => {
    const response = await request(app)
      .post('/api/cameras/1/avatar')
      .set('Authorization', `Bearer ${token}`)
      .attach('avatar', dummyImageBuffer, 'test_avatar.png');

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(1);
    expect(response.body.avatarUrl).toContain('/uploads/avatars/camera_1_');

    // Verify file exists on local disk
    const relativePath = response.body.avatarUrl.replace('/uploads/', '');
    const fullPath = path.join(process.cwd(), 'uploads', relativePath);
    const fileExists = await fs.access(fullPath).then(() => true).catch(() => false);
    expect(fileExists).toBe(true);

    // Verify sharp cropped size
    const metadata = await sharp(fullPath).metadata();
    expect(metadata.width).toBe(200);
    expect(metadata.height).toBe(200);
    expect(metadata.format).toBe('jpeg');
  });

  test('POST /api/cameras/:id/avatar - should delete old avatar file on second upload', async () => {
    // 1. Get first avatar URL
    const cameraBefore = await prisma.camera.findUnique({ where: { id: 1 } });
    const firstAvatarPath = path.join(process.cwd(), 'uploads', cameraBefore!.avatarUrl!.replace('/uploads/', ''));

    // 2. Upload again
    const response = await request(app)
      .post('/api/cameras/1/avatar')
      .set('Authorization', `Bearer ${token}`)
      .attach('avatar', dummyImageBuffer, 'test_avatar_new.png');

    expect(response.status).toBe(200);
    
    // 3. Verify first file is deleted
    const firstFileExists = await fs.access(firstAvatarPath).then(() => true).catch(() => false);
    expect(firstFileExists).toBe(false);

    // 4. Verify new file exists
    const secondAvatarPath = path.join(process.cwd(), 'uploads', response.body.avatarUrl.replace('/uploads/', ''));
    const secondFileExists = await fs.access(secondAvatarPath).then(() => true).catch(() => false);
    expect(secondFileExists).toBe(true);
  });

  test('POST /api/photos/upload - should process photo into three sizes (thumbnail, preview, original)', async () => {
    const response = await request(app)
      .post('/api/photos/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('photo', dummyImageBuffer, 'test_photo.png');

    expect(response.status).toBe(201);
    expect(response.body.photo.originalFileName).toBe('test_photo.png');
    expect(response.body.photo.thumbnailUrl).toContain('/uploads/photos/thumbnails/');
    expect(response.body.photo.previewUrl).toContain('/uploads/photos/previews/');
    expect(response.body.photo.originalUrl).toContain('/uploads/photos/originals/');
    expect(response.body.photo.storageKey).toBeDefined();

    // Verify all three files exist on local disk
    const thumbnailPath = path.join(process.cwd(), 'uploads', response.body.photo.thumbnailUrl.replace('/uploads/', ''));
    const previewPath = path.join(process.cwd(), 'uploads', response.body.photo.previewUrl.replace('/uploads/', ''));
    const originalPath = path.join(process.cwd(), 'uploads', response.body.photo.originalUrl.replace('/uploads/', ''));

    expect(await fs.access(thumbnailPath).then(() => true).catch(() => false)).toBe(true);
    expect(await fs.access(previewPath).then(() => true).catch(() => false)).toBe(true);
    expect(await fs.access(originalPath).then(() => true).catch(() => false)).toBe(true);

    // Verify image specs
    const thumbMeta = await sharp(thumbnailPath).metadata();
    const previewMeta = await sharp(previewPath).metadata();
    
    // Test that thumb is resized (max height/width 300)
    expect(thumbMeta.width).toBeLessThanOrEqual(300);
    expect(thumbMeta.height).toBeLessThanOrEqual(300);
    expect(thumbMeta.format).toBe('jpeg');

    // Test that preview is resized (max height/width 1600)
    expect(previewMeta.width).toBeLessThanOrEqual(1600);
    expect(previewMeta.height).toBeLessThanOrEqual(1600);
  });
});
