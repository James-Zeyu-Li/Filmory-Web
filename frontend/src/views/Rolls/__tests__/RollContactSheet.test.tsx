import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { RollContactSheet } from '../components/RollContactSheet';
import { db, type Roll } from '../../../db/schema';
import { compressImageToWebP } from '../../../utils/imageService';
import { uploadPhotoToCloud } from '../../../services/storageService';
import {
  commitUploadedContactSheetPhoto,
  saveDeferredContactSheetPhoto,
} from '../../../services/photoUploadRecoveryService';

const USER_ID = 'mock-user-id';
const ROLL_ID = 'roll-1';

const mockUsePhotoAssets = vi.fn();
const mockUseFilmStocks = vi.fn();

vi.mock('../../../hooks/useData', () => ({
  usePhotoAssets: () => mockUsePhotoAssets(),
  useFilmStocks: () => mockUseFilmStocks(),
}));

vi.mock('../../../contexts/useFeedback', () => ({
  useFeedback: () => ({ notify: vi.fn() }),
}));

vi.mock('../../../utils/imageService', async importOriginal => {
  const actual = await importOriginal<typeof import('../../../utils/imageService')>();
  return { ...actual, compressImageToWebP: vi.fn() };
});

vi.mock('../../../services/storageService', () => ({
  uploadPhotoToCloud: vi.fn(),
  deletePhotoFromCloud: vi.fn(),
}));

vi.mock('../../../services/photoUploadRecoveryService', () => ({
  saveDeferredContactSheetPhoto: vi.fn(),
  commitUploadedContactSheetPhoto: vi.fn(),
}));

const roll: Roll = { id: ROLL_ID, name: 'Test roll', cameraIds: [], status: 'archived', filmStockId: undefined };

describe('RollContactSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseFilmStocks.mockReturnValue([]);
  });

  it('shows an empty state when the roll has no contact-sheet photos', () => {
    mockUsePhotoAssets.mockReturnValue([]);
    render(<RollContactSheet roll={roll} />);

    expect(screen.getByText('还没有这一卷的成品扫描图')).toBeInTheDocument();
  });

  it('never shows the roll cover photo (isPinned: 1) in the contact-sheet grid', () => {
    mockUsePhotoAssets.mockReturnValue([
      { id: 'cover', rollId: ROLL_ID, isPinned: 1, addedAt: 1, originalFileName: 'c.webp', fileSize: 1, userId: USER_ID },
    ]);
    render(<RollContactSheet roll={roll} />);

    expect(screen.getByText('还没有这一卷的成品扫描图')).toBeInTheDocument();
  });

  it('uploads a selected photo and commits it without touching the cover slot', async () => {
    mockUsePhotoAssets.mockReturnValue([]);
    vi.mocked(compressImageToWebP).mockResolvedValue(new File(['x'], 'photo.webp', { type: 'image/webp' }));
    vi.mocked(uploadPhotoToCloud).mockResolvedValue({
      storageKey: `${USER_ID}/${ROLL_ID}/photo.webp`,
      previewUrl: 'https://signed.example/preview',
      thumbnailUrl: 'data:image/webp;base64,thumb',
    });

    const { container } = render(<RollContactSheet roll={roll} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['x'], 'photo.jpg', { type: 'image/jpeg' })] } });

    await waitFor(() => expect(commitUploadedContactSheetPhoto).toHaveBeenCalledTimes(1));
    expect(saveDeferredContactSheetPhoto).not.toHaveBeenCalled();
    const committed = vi.mocked(commitUploadedContactSheetPhoto).mock.calls[0][0];
    expect(committed).toMatchObject({ rollId: ROLL_ID, isPinned: 0, orderIndex: 0 });
  });

  it('rating a photo via the star control updates photoAssets.rating in Dexie', async () => {
    await db.photoAssets.clear();
    await db.photoAssets.add({
      id: 'sheet-1', rollId: ROLL_ID, userId: USER_ID, isPinned: 0, orderIndex: 0,
      originalFileName: 'a.webp', fileSize: 1, addedAt: 1, thumbnailUrl: 'data:image/webp;base64,x',
    });
    mockUsePhotoAssets.mockReturnValue([
      { id: 'sheet-1', rollId: ROLL_ID, userId: USER_ID, isPinned: 0, orderIndex: 0, originalFileName: 'a.webp', fileSize: 1, addedAt: 1, thumbnailUrl: 'data:image/webp;base64,x' },
    ]);

    render(<RollContactSheet roll={roll} />);
    fireEvent.click(screen.getByRole('button', { name: '打 4 星' }));

    await waitFor(async () => {
      const photo = await db.photoAssets.get('sheet-1');
      expect(photo?.rating).toBe(4);
    });
  });
});
