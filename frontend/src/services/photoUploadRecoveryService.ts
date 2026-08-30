import { db, suppressSyncRecordsForCurrentTransaction, type PhotoAsset } from '../db/schema';
import { deletePhotoFromCloud, uploadPhotoToCloud } from './storageService';

export interface PhotoUploadRecoveryResult {
  found: number;
  uploaded: number;
  cleaned: number;
  failed: number;
}

interface PhotoCleanupResult {
  found: number;
  cleaned: number;
  failed: number;
}

const activeRepairs = new Map<string, Promise<PhotoUploadRecoveryResult>>();

const hasLocalUploadCandidate = (photo: PhotoAsset): boolean => (
  Boolean(photo.id && photo.blob && !photo.storageKey && !photo.cloudDeletePending)
);

const hasCloudDeleteCandidate = (photo: PhotoAsset): boolean => (
  Boolean(photo.id && photo.storageKey && photo.cloudDeletePending)
);

const getErrorMessage = (error: unknown, fallback: string) => (
  error instanceof Error ? error.message : fallback
);

/**
 * Keep a failed upload available on this device without queuing incomplete
 * metadata for Cloud Postgres. The previous Cloud cover remains available
 * until this replacement has uploaded successfully.
 */
export const saveDeferredPhotoUpload = async (photo: PhotoAsset): Promise<void> => {
  if (!photo.id) throw new Error('Deferred photo uploads require an id.');

  await db.transaction('rw', db.photoAssets, db.rolls, async () => {
    suppressSyncRecordsForCurrentTransaction();
    const roll = await db.rolls.get(photo.rollId);
    if (!roll || roll.userId !== photo.userId) {
      throw new Error('The related shooting record is no longer available.');
    }

    await db.photoAssets.add({
      ...photo,
      replacesPhotoId: roll.coverPhotoId && roll.coverPhotoId !== photo.id
        ? roll.coverPhotoId
        : undefined,
    });
    await db.rolls.update(photo.rollId, { coverPhotoId: photo.id });
  });
};

export const findPendingPhotoUploads = async (userId: string): Promise<PhotoAsset[]> => {
  const photos = await db.photoAssets.where('userId').equals(userId).toArray();
  return photos.filter(hasLocalUploadCandidate);
};

export const findPendingPhotoDeletes = async (userId: string): Promise<PhotoAsset[]> => {
  const photos = await db.photoAssets.where('userId').equals(userId).toArray();
  return photos.filter(hasCloudDeleteCandidate);
};

export const countPendingPhotoRepairs = (photos: PhotoAsset[]): number => (
  photos.filter(photo => hasLocalUploadCandidate(photo) || hasCloudDeleteCandidate(photo)).length
);

const stageUploadedRollCover = async (photo: PhotoAsset): Promise<string | undefined> => {
  if (!photo.id || !photo.storageKey) {
    throw new Error('Uploaded cover metadata requires an id and storage key.');
  }

  let previousCloudPhotoId: string | undefined;
  await db.transaction('rw', db.photoAssets, db.rolls, async () => {
    const roll = await db.rolls.get(photo.rollId);
    if (!roll || roll.userId !== photo.userId) {
      throw new Error('The related shooting record is no longer available.');
    }

    const previousPhotoId = photo.replacesPhotoId || roll.coverPhotoId;
    await db.photoAssets.put({
      ...photo,
      blob: undefined,
      cloudUploadPending: false,
      cloudUploadError: undefined,
      cloudDeletePending: false,
      cloudDeleteError: undefined,
      replacesPhotoId: undefined,
    });
    await db.rolls.update(photo.rollId, { coverPhotoId: photo.id });

    if (!previousPhotoId || previousPhotoId === photo.id) return;
    const previousPhoto = await db.photoAssets.get(previousPhotoId);
    if (!previousPhoto || previousPhoto.userId !== photo.userId) return;

    if (previousPhoto.storageKey) {
      previousCloudPhotoId = previousPhotoId;
      await db.photoAssets.update(previousPhotoId, {
        isPinned: 0,
        cloudDeletePending: true,
        cloudDeleteError: undefined,
      });
    } else {
      await db.photoAssets.delete(previousPhotoId);
    }
  });

  return previousCloudPhotoId;
};

export const cleanupPendingPhotoDeletes = async (
  userId: string,
  photoIds?: string[],
): Promise<PhotoCleanupResult> => {
  const pendingPhotos = await findPendingPhotoDeletes(userId);
  const targetIds = photoIds ? new Set(photoIds) : undefined;
  const targets = targetIds
    ? pendingPhotos.filter(photo => photo.id && targetIds.has(photo.id))
    : pendingPhotos;
  let cleaned = 0;
  let failed = 0;

  for (const photo of targets) {
    if (!photo.id || !photo.storageKey) continue;

    try {
      const owningRoll = await db.rolls.get(photo.rollId);
      if (owningRoll?.coverPhotoId === photo.id) {
        throw new Error('The photo is still the active shooting record cover.');
      }

      await deletePhotoFromCloud(photo.storageKey);
      await db.photoAssets.delete(photo.id);
      cleaned += 1;
    } catch (error) {
      failed += 1;
      await db.transaction('rw', db.photoAssets, async () => {
        suppressSyncRecordsForCurrentTransaction();
        await db.photoAssets.update(photo.id!, {
          cloudDeletePending: true,
          cloudDeleteError: getErrorMessage(error, 'Photo cleanup failed'),
        });
      });
    }
  }

  return { found: targets.length, cleaned, failed };
};

/**
 * Atomically commits a ready Cloud cover and its Roll relationship locally,
 * then removes only the previous cover object. Cleanup failure is durable and
 * can be retried from Settings without invalidating the new cover.
 */
export const commitUploadedRollCover = async (
  photo: PhotoAsset,
): Promise<PhotoCleanupResult> => {
  const previousCloudPhotoId = await stageUploadedRollCover(photo);
  if (!previousCloudPhotoId) return { found: 0, cleaned: 0, failed: 0 };
  return cleanupPendingPhotoDeletes(photo.userId || '', [previousCloudPhotoId]);
};

/**
 * Contact-sheet photos (Roll Contact Sheet, isPinned: 0) are additive, not a
 * single-slot replacement like the cover — save/commit never touch
 * Roll.coverPhotoId and never queue any other photo for deletion.
 */
export const saveDeferredContactSheetPhoto = async (photo: PhotoAsset): Promise<void> => {
  if (!photo.id) throw new Error('Deferred photo uploads require an id.');

  await db.transaction('rw', db.photoAssets, db.rolls, async () => {
    suppressSyncRecordsForCurrentTransaction();
    const roll = await db.rolls.get(photo.rollId);
    if (!roll || roll.userId !== photo.userId) {
      throw new Error('The related shooting record is no longer available.');
    }

    await db.photoAssets.add({ ...photo, replacesPhotoId: undefined });
  });
};

const stageUploadedContactSheetPhoto = async (photo: PhotoAsset): Promise<void> => {
  if (!photo.id || !photo.storageKey) {
    throw new Error('Uploaded photo metadata requires an id and storage key.');
  }

  await db.transaction('rw', db.photoAssets, db.rolls, async () => {
    const roll = await db.rolls.get(photo.rollId);
    if (!roll || roll.userId !== photo.userId) {
      throw new Error('The related shooting record is no longer available.');
    }

    await db.photoAssets.put({
      ...photo,
      blob: undefined,
      cloudUploadPending: false,
      cloudUploadError: undefined,
      cloudDeletePending: false,
      cloudDeleteError: undefined,
      replacesPhotoId: undefined,
    });
  });
};

export const commitUploadedContactSheetPhoto = async (photo: PhotoAsset): Promise<void> => {
  await stageUploadedContactSheetPhoto(photo);
};

/**
 * Upload local-only photo assets after a previous cloud upload failed and
 * retry any Storage deletions left from cover replacement.
 */
export const repairPendingPhotoUploads = async (
  userId: string,
  onProgress?: (completed: number, total: number) => void,
): Promise<PhotoUploadRecoveryResult> => {
  const activeRepair = activeRepairs.get(userId);
  if (activeRepair) return activeRepair;

  const repair = repairPendingPhotosForUser(userId, onProgress);
  activeRepairs.set(userId, repair);

  try {
    return await repair;
  } finally {
    activeRepairs.delete(userId);
  }
};

const repairPendingPhotosForUser = async (
  userId: string,
  onProgress?: (completed: number, total: number) => void,
): Promise<PhotoUploadRecoveryResult> => {
  const pendingUploads = await findPendingPhotoUploads(userId);
  const initialPendingDeletes = await findPendingPhotoDeletes(userId);
  const total = pendingUploads.length + initialPendingDeletes.length;
  let uploaded = 0;
  let failed = 0;

  for (const photo of pendingUploads) {
    if (!photo.id || !photo.blob) continue;
    let uploadedStorageKey: string | undefined;

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
      const result = await uploadPhotoToCloud(file, userId, photo.rollId, undefined, photo.id);
      uploadedStorageKey = result.storageKey;
      const stagedPhoto = {
        ...photo,
        storageKey: result.storageKey,
        previewUrl: result.previewUrl,
        thumbnailUrl: result.thumbnailUrl,
      };
      // Contact-sheet photos (isPinned: 0) are additive and never touch
      // Roll.coverPhotoId, unlike the cover slot (isPinned: 1) below.
      if (photo.isPinned === 1) {
        await stageUploadedRollCover(stagedPhoto);
      } else {
        await stageUploadedContactSheetPhoto(stagedPhoto);
      }
      uploaded += 1;
    } catch (error) {
      failed += 1;
      if (uploadedStorageKey) {
        try {
          await deletePhotoFromCloud(uploadedStorageKey);
        } catch (cleanupError) {
          console.error('Failed to roll back an uncommitted photo upload:', cleanupError);
        }
      }

      await db.transaction('rw', db.photoAssets, async () => {
        suppressSyncRecordsForCurrentTransaction();
        await db.photoAssets.update(photo.id!, {
          cloudUploadPending: true,
          cloudUploadError: getErrorMessage(error, 'Photo upload failed'),
        });
      });
    }

    onProgress?.(uploaded + failed, total);
  }

  const cleanup = await cleanupPendingPhotoDeletes(userId);
  failed += cleanup.failed;
  onProgress?.(pendingUploads.length + cleanup.cleaned + cleanup.failed, total);

  return {
    found: total,
    uploaded,
    cleaned: cleanup.cleaned,
    failed,
  };
};
