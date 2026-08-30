import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db/schema';
import {
  cleanupPendingPhotoDeletes,
  commitUploadedContactSheetPhoto,
  commitUploadedRollCover,
  countPendingPhotoRepairs,
  findPendingPhotoUploads,
  repairPendingPhotoUploads,
  saveDeferredContactSheetPhoto,
  saveDeferredPhotoUpload,
} from '../services/photoUploadRecoveryService';
import { deletePhotoFromCloud, uploadPhotoToCloud } from '../services/storageService';

vi.mock('../services/storageService', () => ({
  uploadPhotoToCloud: vi.fn(),
  deletePhotoFromCloud: vi.fn(),
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

const addRoll = async (coverPhotoId?: string) => {
  await db.rolls.add({
    id: ROLL_ID,
    userId: USER_ID,
    name: 'Recovered cover',
    cameraIds: [],
    status: 'active',
    coverPhotoId,
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

const createCloudPhoto = (id: string, storageKey = `${USER_ID}/${ROLL_ID}/${id}.webp`) => ({
  id,
  userId: USER_ID,
  rollId: ROLL_ID,
  originalFileName: `${id}.webp`,
  fileSize: 8,
  storageKey,
  thumbnailUrl: `data:image/webp;base64,${id}`,
  addedAt: 1,
  isPinned: 1,
});

describe('photo upload recovery service', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(deletePhotoFromCloud).mockResolvedValue(undefined);
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

    await expect(repairPendingPhotoUploads(USER_ID)).resolves.toEqual({ found: 1, uploaded: 1, cleaned: 0, failed: 0 });

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

    await expect(repairPendingPhotoUploads(USER_ID)).resolves.toEqual({ found: 0, uploaded: 0, cleaned: 0, failed: 0 });
    expect(uploadPhotoToCloud).toHaveBeenCalledTimes(1);
  });

  it('shares an in-flight repair and cannot upload the same image twice', async () => {
    await addRoll();
    await saveDeferredPhotoUpload(createDeferredPhoto());

    vi.mocked(uploadPhotoToCloud).mockImplementation(() => new Promise(resolve => {
      queueMicrotask(() => resolve({
        storageKey: `${USER_ID}/${ROLL_ID}/cover.webp`,
        previewUrl: 'https://signed.example/preview',
        thumbnailUrl: 'data:image/webp;base64,thumb',
      }));
    }));

    const firstRepair = repairPendingPhotoUploads(USER_ID);
    const secondRepair = repairPendingPhotoUploads(USER_ID);

    await expect(Promise.all([firstRepair, secondRepair])).resolves.toEqual([
      { found: 1, uploaded: 1, cleaned: 0, failed: 0 },
      { found: 1, uploaded: 1, cleaned: 0, failed: 0 },
    ]);
    expect(uploadPhotoToCloud).toHaveBeenCalledTimes(1);
  });

  it('keeps a failed retry local and marks the photo for another attempt', async () => {
    await addRoll();
    await saveDeferredPhotoUpload(createDeferredPhoto());
    await db.syncQueue.clear();
    vi.mocked(uploadPhotoToCloud).mockRejectedValue(new Error('Storage unavailable'));

    await expect(repairPendingPhotoUploads(USER_ID)).resolves.toEqual({ found: 1, uploaded: 0, cleaned: 0, failed: 1 });

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

    await expect(repairPendingPhotoUploads(USER_ID)).resolves.toEqual({ found: 1, uploaded: 0, cleaned: 0, failed: 1 });
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

  it('atomically replaces only the active cover and cleans its Cloud object', async () => {
    await db.photoAssets.bulkAdd([
      createCloudPhoto('old-cover'),
      createCloudPhoto('unrelated-photo'),
    ]);
    await addRoll('old-cover');

    await expect(commitUploadedRollCover(createCloudPhoto('new-cover'))).resolves.toEqual({
      found: 1,
      cleaned: 1,
      failed: 0,
    });

    await expect(db.rolls.get(ROLL_ID)).resolves.toMatchObject({ coverPhotoId: 'new-cover' });
    await expect(db.photoAssets.get('new-cover')).resolves.toMatchObject({ storageKey: `${USER_ID}/${ROLL_ID}/new-cover.webp` });
    await expect(db.photoAssets.get('old-cover')).resolves.toBeUndefined();
    await expect(db.photoAssets.get('unrelated-photo')).resolves.toBeDefined();
    expect(deletePhotoFromCloud).toHaveBeenCalledWith(`${USER_ID}/${ROLL_ID}/old-cover.webp`);
  });

  it('keeps a failed previous-cover deletion durable and retries without replacing the new cover', async () => {
    await db.photoAssets.add(createCloudPhoto('old-cover'));
    await addRoll('old-cover');
    vi.mocked(deletePhotoFromCloud).mockRejectedValueOnce(new Error('Storage unavailable'));

    await expect(commitUploadedRollCover(createCloudPhoto('new-cover'))).resolves.toEqual({
      found: 1,
      cleaned: 0,
      failed: 1,
    });
    await expect(db.rolls.get(ROLL_ID)).resolves.toMatchObject({ coverPhotoId: 'new-cover' });
    await expect(db.photoAssets.get('old-cover')).resolves.toMatchObject({
      cloudDeletePending: true,
      cloudDeleteError: 'Storage unavailable',
    });

    vi.mocked(deletePhotoFromCloud).mockResolvedValue(undefined);
    await expect(cleanupPendingPhotoDeletes(USER_ID)).resolves.toEqual({ found: 1, cleaned: 1, failed: 0 });
    await expect(db.photoAssets.get('old-cover')).resolves.toBeUndefined();
    await expect(db.rolls.get(ROLL_ID)).resolves.toMatchObject({ coverPhotoId: 'new-cover' });
  });

  it('keeps the previous Cloud cover until a deferred replacement is uploaded', async () => {
    await db.photoAssets.add(createCloudPhoto('old-cover'));
    await addRoll('old-cover');
    await saveDeferredPhotoUpload(createDeferredPhoto());
    await db.syncQueue.clear();

    await expect(db.photoAssets.get('old-cover')).resolves.toBeDefined();
    await expect(db.photoAssets.get('deferred-photo')).resolves.toMatchObject({ replacesPhotoId: 'old-cover' });
    vi.mocked(uploadPhotoToCloud).mockResolvedValue({
      storageKey: `${USER_ID}/${ROLL_ID}/deferred-photo_cover.webp`,
      previewUrl: 'https://signed.example/preview',
      thumbnailUrl: 'data:image/webp;base64,thumb',
    });

    await expect(repairPendingPhotoUploads(USER_ID)).resolves.toEqual({
      found: 1,
      uploaded: 1,
      cleaned: 1,
      failed: 0,
    });
    expect(uploadPhotoToCloud).toHaveBeenCalledWith(
      expect.any(File),
      USER_ID,
      ROLL_ID,
      undefined,
      'deferred-photo',
    );
    await expect(db.photoAssets.get('old-cover')).resolves.toBeUndefined();
    await expect(db.rolls.get(ROLL_ID)).resolves.toMatchObject({ coverPhotoId: 'deferred-photo' });
  });

  it('counts pending uploads and pending Cloud cleanup without including complete photos', () => {
    expect(countPendingPhotoRepairs([
      createDeferredPhoto('local-upload'),
      { ...createCloudPhoto('cleanup'), cloudDeletePending: true },
      createCloudPhoto('complete'),
    ])).toBe(2);
  });

  describe('contact-sheet photos (additive, isPinned: 0)', () => {
    const createDeferredContactSheetPhoto = (id = 'sheet-photo') => ({
      ...createDeferredPhoto(id),
      isPinned: 0,
    });

    it('saves a deferred contact-sheet photo locally without touching Roll.coverPhotoId', async () => {
      await addRoll('existing-cover');

      await saveDeferredContactSheetPhoto(createDeferredContactSheetPhoto());

      const photo = await db.photoAssets.get('sheet-photo');
      expect(photo).toMatchObject({ cloudUploadPending: true, isPinned: 0 });
      expect(photo?.blob).toBeDefined();
      await expect(db.rolls.get(ROLL_ID)).resolves.toMatchObject({ coverPhotoId: 'existing-cover' });
    });

    it('commits an uploaded contact-sheet photo without touching Roll.coverPhotoId or any other photo', async () => {
      await db.photoAssets.add(createCloudPhoto('existing-cover'));
      await addRoll('existing-cover');

      await commitUploadedContactSheetPhoto({
        ...createCloudPhoto('sheet-photo'),
        isPinned: 0,
      });

      await expect(db.rolls.get(ROLL_ID)).resolves.toMatchObject({ coverPhotoId: 'existing-cover' });
      await expect(db.photoAssets.get('existing-cover')).resolves.toBeDefined();
      await expect(db.photoAssets.get('sheet-photo')).resolves.toMatchObject({
        storageKey: `${USER_ID}/${ROLL_ID}/sheet-photo.webp`,
        cloudUploadPending: false,
      });
    });

    it('repairs a pending cover and a pending contact-sheet photo in the same sweep via their own paths', async () => {
      await addRoll();
      await saveDeferredPhotoUpload(createDeferredPhoto('cover-photo'));
      await saveDeferredContactSheetPhoto(createDeferredContactSheetPhoto('sheet-photo'));
      await db.syncQueue.clear();

      vi.mocked(uploadPhotoToCloud).mockImplementation(async (_file, userId, rollId, _onProgress, objectId) => ({
        storageKey: `${userId}/${rollId}/${objectId}.webp`,
        previewUrl: `https://signed.example/${objectId}`,
        thumbnailUrl: `data:image/webp;base64,${objectId}`,
      }));

      await expect(repairPendingPhotoUploads(USER_ID)).resolves.toEqual({ found: 2, uploaded: 2, cleaned: 0, failed: 0 });

      await expect(db.rolls.get(ROLL_ID)).resolves.toMatchObject({ coverPhotoId: 'cover-photo' });
      await expect(db.photoAssets.get('cover-photo')).resolves.toMatchObject({
        storageKey: `${USER_ID}/${ROLL_ID}/cover-photo.webp`,
        cloudUploadPending: false,
      });
      await expect(db.photoAssets.get('sheet-photo')).resolves.toMatchObject({
        storageKey: `${USER_ID}/${ROLL_ID}/sheet-photo.webp`,
        cloudUploadPending: false,
        isPinned: 0,
      });
    });
  });
});
