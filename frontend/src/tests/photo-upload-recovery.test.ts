import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db/schema';
import {
  findPendingPhotoUploads,
  repairPendingPhotoUploads,
  saveDeferredPhotoUpload,
} from '../services/photoUploadRecoveryService';
import { uploadPhotoToCloud } from '../services/storageService';

vi.mock('../services/storageService', () => ({
  uploadPhotoToCloud: vi.fn(),
}));

const USER_ID = 'photo-user';
const ROLL_ID = 'photo-roll';

const clearPhotoData = async () => {
  await Promise.all([
    db.rolls.clear(),
    db.photoAssets.clear(),
    db.syncQueue.clear(),
  ]);
};

const addRoll = async () => {
  await db.rolls.add({
    id: ROLL_ID,
    userId: USER_ID,
    name: 'Recovered cover',
    cameraIds: [],
    status: 'active',
  });
};

const createDeferredPhoto = (id = 'deferred-photo') => ({
  id,
  userId: USER_ID,
  rollId: ROLL_ID,
  originalFileName: 'cover.webp',
  fileSize: 8,
  blob: new Blob(['cover'], { type: 'image/webp' }),
  cloudUploadPending: true,
  cloudUploadError: 'Previous upload failed',
  addedAt: 1,
  isPinned: 1,
});

describe('photo upload recovery service', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.setItem('grainfolio_user_id', USER_ID);
    await clearPhotoData();
  });

  it('keeps a failed upload local and out of the Cloud sync queue', async () => {
    await addRoll();
    await db.syncQueue.clear();

    await saveDeferredPhotoUpload(createDeferredPhoto());

    const deferredPhoto = await db.photoAssets.get('deferred-photo');
    expect(deferredPhoto).toMatchObject({
      cloudUploadPending: true,
    });
    expect(deferredPhoto?.blob).toBeDefined();
    expect(deferredPhoto?.storageKey).toBeUndefined();
    await expect(db.rolls.get(ROLL_ID)).resolves.toMatchObject({ coverPhotoId: 'deferred-photo' });
    await expect(db.syncQueue.count()).resolves.toBe(0);
  });

  it('uploads a deferred image once, then queues only the complete Cloud metadata', async () => {
    await addRoll();
    await saveDeferredPhotoUpload(createDeferredPhoto());
    await db.syncQueue.clear();
    vi.mocked(uploadPhotoToCloud).mockResolvedValue({
      storageKey: `${USER_ID}/${ROLL_ID}/cover.webp`,
      previewUrl: 'https://signed.example/preview',
      thumbnailUrl: 'data:image/webp;base64,thumb',
    });

    await expect(repairPendingPhotoUploads(USER_ID)).resolves.toEqual({ found: 1, uploaded: 1, failed: 0 });

    const uploadedPhoto = await db.photoAssets.get('deferred-photo');
    expect(uploadedPhoto).toMatchObject({
      storageKey: `${USER_ID}/${ROLL_ID}/cover.webp`,
      previewUrl: 'https://signed.example/preview',
      thumbnailUrl: 'data:image/webp;base64,thumb',
      cloudUploadPending: false,
    });
    expect(uploadedPhoto?.cloudUploadError).toBeUndefined();
    expect(uploadedPhoto?.blob).toBeUndefined();
    expect(uploadPhotoToCloud).toHaveBeenCalledTimes(1);

    await new Promise(resolve => setTimeout(resolve, 0));
    const queuedPhoto = (await db.syncQueue.toArray()).find(item => item.tableName === 'photoAssets');
    expect(queuedPhoto?.payload).toMatchObject({ storageKey: `${USER_ID}/${ROLL_ID}/cover.webp` });
    expect(queuedPhoto?.payload?.blob).toBeUndefined();

    await expect(repairPendingPhotoUploads(USER_ID)).resolves.toEqual({ found: 0, uploaded: 0, failed: 0 });
    expect(uploadPhotoToCloud).toHaveBeenCalledTimes(1);
  });

  it('shares an in-flight repair and cannot upload the same image twice', async () => {
    await addRoll();
    await saveDeferredPhotoUpload(createDeferredPhoto());

    let finishUpload: ((value: { storageKey: string; previewUrl: string; thumbnailUrl: string }) => void) | undefined;
    vi.mocked(uploadPhotoToCloud).mockImplementation(() => new Promise(resolve => {
      finishUpload = resolve;
    }));

    const firstRepair = repairPendingPhotoUploads(USER_ID);
    const secondRepair = repairPendingPhotoUploads(USER_ID);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(uploadPhotoToCloud).toHaveBeenCalledTimes(1);

    finishUpload?.({
      storageKey: `${USER_ID}/${ROLL_ID}/cover.webp`,
      previewUrl: 'https://signed.example/preview',
      thumbnailUrl: 'data:image/webp;base64,thumb',
    });

    await expect(Promise.all([firstRepair, secondRepair])).resolves.toEqual([
      { found: 1, uploaded: 1, failed: 0 },
      { found: 1, uploaded: 1, failed: 0 },
    ]);
    expect(uploadPhotoToCloud).toHaveBeenCalledTimes(1);
  });

  it('keeps a failed retry local and marks the photo for another attempt', async () => {
    await addRoll();
    await saveDeferredPhotoUpload(createDeferredPhoto());
    await db.syncQueue.clear();
    vi.mocked(uploadPhotoToCloud).mockRejectedValue(new Error('Storage unavailable'));

    await expect(repairPendingPhotoUploads(USER_ID)).resolves.toEqual({ found: 1, uploaded: 0, failed: 1 });

    const failedPhoto = await db.photoAssets.get('deferred-photo');
    expect(failedPhoto).toMatchObject({
      cloudUploadPending: true,
      cloudUploadError: 'Storage unavailable',
    });
    expect(failedPhoto?.blob).toBeDefined();
    expect(failedPhoto?.storageKey).toBeUndefined();
    await expect(db.syncQueue.count()).resolves.toBe(0);
  });

  it('does not upload a photo whose shooting record no longer exists', async () => {
    await db.photoAssets.add(createDeferredPhoto());
    await db.syncQueue.clear();

    await expect(repairPendingPhotoUploads(USER_ID)).resolves.toEqual({ found: 1, uploaded: 0, failed: 1 });
    expect(uploadPhotoToCloud).not.toHaveBeenCalled();
    await expect(db.photoAssets.get('deferred-photo')).resolves.toMatchObject({
      cloudUploadPending: true,
      cloudUploadError: 'The related shooting record is no longer available.',
    });
  });

  it('only discovers local blobs belonging to the active user', async () => {
    await db.photoAssets.bulkAdd([
      createDeferredPhoto('current-user-photo'),
      { ...createDeferredPhoto('other-user-photo'), userId: 'other-user' },
      { ...createDeferredPhoto('already-uploaded-photo'), storageKey: 'remote/photo.webp' },
    ]);

    await expect(findPendingPhotoUploads(USER_ID)).resolves.toMatchObject([
      { id: 'current-user-photo' },
    ]);
  });
});
