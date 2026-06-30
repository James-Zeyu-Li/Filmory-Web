import { useEffect, useState } from 'react';
import type { PhotoAsset } from '../db/schema';
import { getSignedPhotoUrl } from '../services/storageService';

interface UsePhotoUrlMapOptions {
  preferFull?: boolean;
}

const createLocalObjectUrl = (photo: PhotoAsset): string | undefined => {
  return photo.blob ? URL.createObjectURL(photo.blob) : undefined;
};

const resolvePhotoUrl = async (photo: PhotoAsset, preferFull: boolean): Promise<string | undefined> => {
  if (preferFull && photo.storageKey) {
    return getSignedPhotoUrl(photo.storageKey);
  }

  if (!preferFull && photo.thumbnailUrl) {
    return photo.thumbnailUrl;
  }

  const localObjectUrl = createLocalObjectUrl(photo);
  if (localObjectUrl) {
    return localObjectUrl;
  }

  if (photo.storageKey) {
    return getSignedPhotoUrl(photo.storageKey);
  }

  return photo.previewUrl || photo.thumbnailUrl;
};

export const usePhotoUrlMap = (
  photos: PhotoAsset[],
  { preferFull = false }: UsePhotoUrlMapOptions = {}
) => {
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let isActive = true;
    const localObjectUrls: string[] = [];

    const loadUrls = async () => {
      const entries = await Promise.all(
        photos.map(async (photo) => {
          if (!photo.id) return null;
          try {
            const url = await resolvePhotoUrl(photo, preferFull);
            if (!url) return null;
            if (url.startsWith('blob:')) {
              localObjectUrls.push(url);
            }
            return [photo.id, url] as const;
          } catch {
            const fallbackUrl = photo.thumbnailUrl || createLocalObjectUrl(photo);
            if (!fallbackUrl) return null;
            if (fallbackUrl.startsWith('blob:')) {
              localObjectUrls.push(fallbackUrl);
            }
            return [photo.id, fallbackUrl] as const;
          }
        })
      );

      if (isActive) {
        setPhotoUrls(Object.fromEntries(entries.filter(Boolean) as Array<readonly [string, string]>));
      }
    };

    void loadUrls();

    return () => {
      isActive = false;
      localObjectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [photos, preferFull]);

  return photoUrls;
};
