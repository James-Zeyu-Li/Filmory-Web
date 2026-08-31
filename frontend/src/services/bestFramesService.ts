import type { PhotoAsset } from '../db/schema';

const MIN_RATING = 4;
const DISPLAY_LIMIT = 8;

export interface BestFramesResult {
  photos: PhotoAsset[];
  totalCount: number;
}

/**
 * Rated photos are more meaningful to a photographer than a rating
 * *distribution* chart — this surfaces the actual keepers (4-5 stars)
 * instead of a bar chart of how many 1-5 star photos exist. Highest rating
 * first, most recently added as the tie-break; capped to a display limit,
 * but totalCount still reflects every qualifying photo so the summary line
 * ("N photos rated 4+") isn't silently truncated to match what's shown.
 */
export const resolveBestFrames = (photoAssets: readonly PhotoAsset[]): BestFramesResult => {
  const qualifying = photoAssets
    .filter(photo => (photo.rating ?? 0) >= MIN_RATING)
    .sort((a, b) => {
      const ratingDiff = (b.rating ?? 0) - (a.rating ?? 0);
      if (ratingDiff !== 0) return ratingDiff;
      return (b.addedAt ?? 0) - (a.addedAt ?? 0);
    });

  return { photos: qualifying.slice(0, DISPLAY_LIMIT), totalCount: qualifying.length };
};
