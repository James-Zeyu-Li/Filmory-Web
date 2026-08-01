import { db, type Camera, type Lens, type FilmStock } from '../db/schema';

let seedDatabasePromise: Promise<void> | null = null;

// Helper to generate sample JPEG images locally using Canvas
function createSampleImageBlob(color: string, label: string): Promise<Blob> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1600;
    canvas.height = 1000;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Draw solid color background
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Add a subtle border
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 20;
      ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

      // Add text label
      ctx.font = 'bold 72px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, canvas.width / 2, canvas.height / 2);
    }
    canvas.toBlob((blob) => {
      resolve(blob || new Blob());
    }, 'image/jpeg', 0.9);
  });
}

export async function seedDatabaseIfNeeded(): Promise<void> {
  if (seedDatabasePromise) {
    return seedDatabasePromise;
  }

  seedDatabasePromise = seedDatabase();
  try {
    await seedDatabasePromise;
  } finally {
    seedDatabasePromise = null;
  }
}

async function seedDatabase(): Promise<void> {
  const currentUserId = localStorage.getItem('grainfolio_user_id');
  if (!currentUserId) return;

  const existingCameras = await db.cameras.toArray();
  const cameraCount = existingCameras.filter(camera => camera.userId === currentUserId || !camera.userId).length;
  if (cameraCount > 0) {
    // Database already seeded
    return;
  }

  console.info('Seeding initial Grainfolio database...');

  // 1. Seed Cameras
  const defaultCameras: Camera[] = [
    { id: crypto.randomUUID(), userId: currentUserId, name: 'Minolta X-700', type: 'film', format: '135', addedAt: Date.now() },
    { id: crypto.randomUUID(), userId: currentUserId, name: 'Rollei 35', type: 'film', format: '135', notes: 'Sonnar 40mm f/2.8 (fixed)', addedAt: Date.now() },
    { id: crypto.randomUUID(), userId: currentUserId, name: 'Fujifilm X-T5', type: 'digital', format: 'digital', addedAt: Date.now() }
  ];
  const cameraIds: string[] = [];
  for (const cam of defaultCameras) {
    const id = await db.cameras.add(cam);
    cameraIds.push(id);
  }

  // 2. Seed Lenses
  const defaultLenses: Lens[] = [
    { id: crypto.randomUUID(), userId: currentUserId, name: 'Minolta MD 50mm f/1.7', focalLength: 50, maxAperture: 'f/1.7', type: 'prime', addedAt: Date.now() },
    { id: crypto.randomUUID(), userId: currentUserId, name: 'Minolta MD 35mm f/2.8', focalLength: 35, maxAperture: 'f/2.8', type: 'prime', addedAt: Date.now() },
    { id: crypto.randomUUID(), userId: currentUserId, name: 'Canon FD 50mm f/1.8', focalLength: 50, maxAperture: 'f/1.8', type: 'prime', addedAt: Date.now() }
  ];
  for (const lens of defaultLenses) {
    await db.lenses.add(lens);
  }

  // 3. Seed Film Stocks
  const defaultFilmStocks: FilmStock[] = [
    { id: crypto.randomUUID(), userId: currentUserId, brand: 'Digital', name: 'Sensor', iso: 0, colorType: 'color', format: 'digital', isSystem: 1, systemKey: 'digital', stockCount: 999, addedAt: Date.now() },
    { id: crypto.randomUUID(), userId: currentUserId, brand: 'Kodak', name: 'Gold 200', iso: 200, colorType: 'color', format: '135', isSystem: 0, stockCount: 5, addedAt: Date.now() },
    { id: crypto.randomUUID(), userId: currentUserId, brand: 'Kodak', name: 'Portra 400', iso: 400, colorType: 'color', format: '135', isSystem: 0, stockCount: 2, addedAt: Date.now() },
    { id: crypto.randomUUID(), userId: currentUserId, brand: 'Fujifilm', name: 'C200', iso: 200, colorType: 'color', format: '135', isSystem: 0, stockCount: 1, addedAt: Date.now() },
    { id: crypto.randomUUID(), userId: currentUserId, brand: 'Ilford', name: 'HP5 Plus', iso: 400, colorType: 'bw', format: '135', isSystem: 0, stockCount: 3, addedAt: Date.now() }
  ];
  const filmStockIds: string[] = [];
  for (const film of defaultFilmStocks) {
    const id = await db.filmStocks.add(film);
    filmStockIds.push(id);
  }

  // 4. Seed Sample Rolls & Photos
  const minoltaId = cameraIds[0];
  const kodakGoldId = filmStockIds[1];
  const ilfordHp5Id = filmStockIds[4];

  // Roll A: 夏日午后 (Gold 200)
  const rollAId = crypto.randomUUID();
  await db.rolls.add({
    id: rollAId,
    userId: currentUserId,
    name: '夏日午后',
    cameraIds: [minoltaId],
    filmStockId: kodakGoldId,
    status: 'archived',
    startDate: Date.now() - 20 * 24 * 60 * 60 * 1000 - 7 * 24 * 60 * 60 * 1000,
    endDate: Date.now() - 20 * 24 * 60 * 60 * 1000,
    rating: 4,
    location: '公园游乐场',
    notes: '一卷温暖偏黄调的焦糖夏日。'
  });

  const rollAPhotos = [
    { color: '#eab308', label: 'Sunny 01', aperture: 'f/2.8', shutter: '1/250', focal: 50 },
    { color: '#f97316', label: 'Sunny 02', aperture: 'f/4.0', shutter: '1/250', focal: 50 },
    { color: '#14b8a6', label: 'Pool 03', aperture: 'f/2.0', shutter: '1/500', focal: 50 }
  ];

  let coverAId: string | undefined;
  for (let i = 0; i < rollAPhotos.length; i++) {
    const p = rollAPhotos[i];
    const blob = await createSampleImageBlob(p.color, p.label);
    const photoId = crypto.randomUUID();
    await db.photoAssets.add({
      id: photoId,
      userId: currentUserId,
      rollId: rollAId,
      originalFileName: `${p.label.toLowerCase().replace(' ', '_')}.jpg`,
      fileSize: blob.size,
      blob,
      addedAt: Date.now() - 20 * 24 * 60 * 60 * 1000 + i * 60 * 1000,
      aperture: p.aperture,
      shutterSpeed: p.shutter,
      focalLength: p.focal,
      isPinned: i === 0 ? 1 : 0,
      rating: 4
    });
    if (i === 0) coverAId = photoId;
  }
  if (coverAId) {
    await db.rolls.update(rollAId, { coverPhotoId: coverAId });
  }

  // Roll B: 城市漫步 (HP5 Plus 400)
  const rollBId = crypto.randomUUID();
  await db.rolls.add({
    id: rollBId,
    userId: currentUserId,
    name: '城市漫步',
    cameraIds: [minoltaId],
    filmStockId: ilfordHp5Id,
    status: 'archived',
    startDate: Date.now() - 10 * 24 * 60 * 60 * 1000 - 5 * 24 * 60 * 60 * 1000,
    endDate: Date.now() - 10 * 24 * 60 * 60 * 1000,
    rating: 5,
    location: '闹市区',
    notes: '高对比度黑白街拍练习。'
  });

  const rollBPhotos = [
    { color: '#4b5563', label: 'Street 01', aperture: 'f/5.6', shutter: '1/125', focal: 35 },
    { color: '#1f2937', label: 'Shadow 02', aperture: 'f/8.0', shutter: '1/60', focal: 35 },
    { color: '#374151', label: 'Building 03', aperture: 'f/4.0', shutter: '1/250', focal: 35 }
  ];

  let coverBId: string | undefined;
  for (let i = 0; i < rollBPhotos.length; i++) {
    const p = rollBPhotos[i];
    const blob = await createSampleImageBlob(p.color, p.label);
    const photoId = crypto.randomUUID();
    await db.photoAssets.add({
      id: photoId,
      userId: currentUserId,
      rollId: rollBId,
      originalFileName: `${p.label.toLowerCase().replace(' ', '_')}.jpg`,
      fileSize: blob.size,
      blob,
      addedAt: Date.now() - 10 * 24 * 60 * 60 * 1000 + i * 60 * 1000,
      aperture: p.aperture,
      shutterSpeed: p.shutter,
      focalLength: p.focal,
      isPinned: i === 0 ? 1 : 0,
      rating: 5
    });
    if (i === 0) coverBId = photoId;
  }
  if (coverBId) {
    await db.rolls.update(rollBId, { coverPhotoId: coverBId });
  }

  // Roll C: 春日公园 (Lomo 400) - Active
  await db.rolls.add({
    id: crypto.randomUUID(),
    userId: currentUserId,
    name: '春日公园',
    cameraIds: [minoltaId],
    filmStockId: filmStockIds[0],
    status: 'active',
    startDate: Date.now() - 2 * 24 * 60 * 60 * 1000,
    location: '朝阳公园',
    notes: '进行中的春日拍摄，已经拍了约一半。'
  });

  // 5. Seed Default TagConfigs
  const defaultTags = [
    { id: crypto.randomUUID(), userId: currentUserId, name: '人像 (Portrait)', color: '#ec4899' },
    { id: crypto.randomUUID(), userId: currentUserId, name: '扫街 (Street)', color: '#eab308' },
    { id: crypto.randomUUID(), userId: currentUserId, name: '风景 (Landscape)', color: '#22c55e' },
    { id: crypto.randomUUID(), userId: currentUserId, name: '废片 (Failed)', color: '#ef4444' }
  ];
  for (const tag of defaultTags) {
    const existingTag = await db.tagConfigs.where('[userId+name]').equals([currentUserId, tag.name]).first();
    if (!existingTag) {
      await db.tagConfigs.add(tag);
    }
  }

  console.info('Seeding completed successfully!');
}
