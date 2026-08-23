import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePhotoUrlMap } from '../hooks/usePhotoUrlMap';
import { getSignedPhotoUrl } from '../services/storageService';

vi.mock('../services/storageService', () => ({
  getSignedPhotoUrl: vi.fn(),
}));

const basePhoto = {
  id: 'cover-1',
  userId: 'user-1',
  rollId: 'roll-1',
  originalFileName: 'cover.webp',
  fileSize: 100,
  addedAt: 1,
  isPinned: 1,
};

describe('usePhotoUrlMap full-quality resolution', () => {
  beforeEach(() => {
    vi.mocked(getSignedPhotoUrl).mockResolvedValue('https://signed.example/cover.webp');
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:local-cover');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  });

  afterEach(() => vi.restoreAllMocks());

  it('prefers the local full-size blob and revokes it on cleanup', async () => {
    const { result, unmount } = renderHook(() => usePhotoUrlMap([{
      ...basePhoto,
      blob: new Blob(['cover']),
      storageKey: 'user-1/roll-1/cover.webp',
      thumbnailUrl: 'data:image/webp;base64,thumb',
    }], { preferFull: true }));

    await waitFor(() => expect(result.current['cover-1']).toBe('blob:local-cover'));
    expect(getSignedPhotoUrl).not.toHaveBeenCalled();

    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:local-cover');
  });

  it('only resolves signed URLs for the assets supplied by the visible cover set', async () => {
    const visiblePhotos = [{
      ...basePhoto,
      storageKey: 'user-1/roll-1/cover.webp',
      thumbnailUrl: 'data:image/webp;base64,thumb',
    }];
    const { result } = renderHook(() => usePhotoUrlMap(visiblePhotos, { preferFull: true }));

    await waitFor(() => expect(result.current['cover-1']).toBe('https://signed.example/cover.webp'));
    expect(getSignedPhotoUrl).toHaveBeenCalledTimes(1);
    expect(getSignedPhotoUrl).toHaveBeenCalledWith('user-1/roll-1/cover.webp');
  });
});
