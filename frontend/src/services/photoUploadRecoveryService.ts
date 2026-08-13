import { db, suppressSyncRecordsForCurrentTransaction, type PhotoAsset } from '../db/schema';
import { uploadPhotoToCloud } from './storageService';

export interface PhotoUploadRecoveryResult {
  found: number;
  uploaded: number;
  failed: number;
}

const activeRepairs = new Map<string, Promise<PhotoUploadRecoveryResult>>();

const hasLocalUploadCandidate = (photo: PhotoAsset): boolean => (
  Boolean(photo.id && photo.blob && !photo.storageKey)
);

/**
 * Keep a failed upload available on this device without queuing incomplete
 * metadata for Cloud Postgres.
 */
export const saveDeferredPhotoUpload = async (photo: PhotoAsset): Promise<void> => {
  if (!photo.id) throw new Error('Deferred photo uploads require an id.');

  await db.transaction('rw', db.photoAssets, db.rolls, async () => {
    suppressSyncRecordsForCurrentTransaction();
    await db.photoAssets.add(photo);
    await db.rolls.update(photo.rollId, { coverPhotoId: photo.id });
  });
};

export const findPendingPhotoUploads = async (userId: string): Promise<PhotoAsset[]> => {
  const photos = await db.photoAssets.where('userId').equals(userId).toArray();
  return photos.filter(hasLocalUploadCandidate);
};

/**
 * Upload local-only photo assets after a previous cloud upload failed.
 * The photo metadata is only released to the sync queue after Storage confirms
 * the object exists, so this cannot create an empty cloud photo row.
 */
export const repairPendingPhotoUploads = async (
  userId: string,
  onProgress?: (completed: number, total: number) => void,
): Promise<PhotoUploadRecoveryResult> => {
  const activeRepair = activeRepairs.get(userId);
  if (activeRepair) return activeRepair;

  const repair = repairPendingPhotoUploadsForUser(userId, onProgress);
  activeRepairs.set(userId, repair);

  try {
    return await repair;
  } finally {
    activeRepairs.delete(userId);
  }
};

const repairPendingPhotoUploadsForUser = async (
  userId: string,
  onProgress?: (completed: number, total: number) => void,
): Promise<PhotoUploadRecoveryResult> => {
  const pendingPhotos = await findPendingPhotoUploads(userId);
  let uploaded = 0;
  let failed = 0;

  for (const photo of pendingPhotos) {
    if (!photo.id || !photo.blob) continue;

    try {
      const roll = await db.rolls.get(photo.rollId);
      if (!roll || roll.userId !== userId) {
        throw new Error('The related shooting record is no longer available.');
      }

      const file = new File(
        [photo.blob],
        photo.originalFileName || `${photo.id}.webp`,
        { type: photo.blob.type || 'image/webp' },
      );
      const result = await uploadPhotoToCloud(file, userId, photo.rollId);

      await db.transaction('rw', db.photoAssets, db.rolls, async () => {
        await db.photoAssets.update(photo.id!, {
          blob: undefined,
          storageKey: result.storageKey,
          previewUrl: result.previewUrl,
          thumbnailUrl: result.thumbnailUrl,
          cloudUploadPending: false,
          cloudUploadError: undefined,
        });
        await db.rolls.update(photo.rollId, { coverPhotoId: photo.id });
      });
      uploaded += 1;
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : 'Photo upload failed';
      await db.transaction('rw', db.photoAssets, async () => {
        suppressSyncRecordsForCurrentTransaction();
        await db.photoAssets.update(photo.id!, {
          cloudUploadPending: true,
          cloudUploadError: message,
        });
      });
    }

    onProgress?.(uploaded + failed, pendingPhotos.length);
  }

  return { found: pendingPhotos.length, uploaded, failed };
};
