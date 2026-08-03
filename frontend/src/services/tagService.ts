import { db, type TagConfig } from '../db/schema';

/** Deletes a user's tag configuration and removes that exact tag from their photos. */
export const deleteTagAndClearPhotoTags = async (tag: TagConfig, userId: string) => {
  await db.transaction('rw', db.tagConfigs, db.photoAssets, async () => {
    if (tag.id) {
      await db.tagConfigs.delete(tag.id);
    }

    const photos = await db.photoAssets.where('userId').equals(userId).toArray();
    for (const photo of photos) {
      if (!photo.id || !photo.tags) continue;

      const remainingTags = photo.tags
        .split(',')
        .filter(currentTag => currentTag !== tag.name);

      await db.photoAssets.update(photo.id, {
        tags: remainingTags.length > 0 ? remainingTags.join(',') : undefined,
      });
    }
  });
};
