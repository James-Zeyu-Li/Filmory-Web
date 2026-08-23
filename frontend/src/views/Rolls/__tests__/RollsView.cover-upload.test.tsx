import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { RollsView } from '../RollsView';
import { db } from '../../../db/schema';
import { ConfirmProvider } from '../../../contexts/ConfirmContext';
import { FeedbackProvider } from '../../../contexts/FeedbackContext';
import { CurrencyProvider } from '../../../contexts/CurrencyContext';
import { compressImageToWebP } from '../../../utils/imageService';
import { deletePhotoFromCloud, uploadPhotoToCloud } from '../../../services/storageService';
import { commitUploadedRollCover } from '../../../services/photoUploadRecoveryService';

const USER_ID = 'cover-user';

vi.mock('../../../contexts/useAuth', () => ({
  useAuth: () => ({
    user: { id: USER_ID },
    authMode: 'authenticated',
    session: null,
    isLoading: false,
  }),
}));

vi.mock('../../../utils/imageService', async importOriginal => {
  const actual = await importOriginal<typeof import('../../../utils/imageService')>();
  return { ...actual, compressImageToWebP: vi.fn() };
});

vi.mock('../../../services/storageService', () => ({
  uploadPhotoToCloud: vi.fn(),
  deletePhotoFromCloud: vi.fn(),
  getSignedPhotoUrl: vi.fn(),
}));

vi.mock('../../../services/photoUploadRecoveryService', () => ({
  commitUploadedRollCover: vi.fn(),
  saveDeferredPhotoUpload: vi.fn(),
}));

const renderOpenRoll = () => render(
  <MemoryRouter initialEntries={['/rolls?tab=all&openRoll=roll-1']}>
    <ConfirmProvider>
      <FeedbackProvider>
        <CurrencyProvider>
          <RollsView enableFilmMode={false} />
        </CurrencyProvider>
      </FeedbackProvider>
    </ConfirmProvider>
  </MemoryRouter>
);

const selectCoverFile = async (container: HTMLElement) => {
  await screen.findByRole('heading', { level: 2, name: 'Cover test' });
  const inputs = container.querySelectorAll<HTMLInputElement>('input[type="file"]');
  const coverInput = inputs.item(inputs.length - 1);
  fireEvent.change(coverInput, {
    target: { files: [new File(['cover'], 'cover.jpg', { type: 'image/jpeg' })] },
  });
};

describe('RollsView cover upload failures', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.setItem('grainfolio_user_id', USER_ID);
    await Promise.all([
      db.rolls.clear(),
      db.photoAssets.clear(),
      db.syncQueue.clear(),
    ]);
    await db.rolls.add({
      id: 'roll-1',
      userId: USER_ID,
      name: 'Cover test',
      cameraIds: [],
      status: 'active',
    });
  });

  it('shows unified feedback when image compression fails', async () => {
    vi.mocked(compressImageToWebP).mockRejectedValue(new Error('Invalid image'));
    const { container } = renderOpenRoll();

    await selectCoverFile(container);

    expect(await screen.findByText('封面处理失败')).toBeInTheDocument();
    expect(screen.getByText('封面没有完成保存，请重试。')).toBeInTheDocument();
    expect(uploadPhotoToCloud).not.toHaveBeenCalled();
    await expect(db.photoAssets.count()).resolves.toBe(0);
  });

  it('rolls back the uploaded object and reports a local commit failure', async () => {
    const compressed = new File(['webp'], 'cover.webp', { type: 'image/webp' });
    vi.mocked(compressImageToWebP).mockResolvedValue(compressed);
    vi.mocked(uploadPhotoToCloud).mockResolvedValue({
      storageKey: `${USER_ID}/roll-1/photo-id_cover.webp`,
      previewUrl: 'https://signed.example/preview',
      thumbnailUrl: 'data:image/webp;base64,thumb',
    });
    vi.mocked(commitUploadedRollCover).mockRejectedValue(new Error('Dexie commit failed'));
    vi.mocked(deletePhotoFromCloud).mockResolvedValue(undefined);
    const { container } = renderOpenRoll();

    await selectCoverFile(container);

    expect(await screen.findByText('封面处理失败')).toBeInTheDocument();
    await waitFor(() => expect(deletePhotoFromCloud).toHaveBeenCalledWith(
      `${USER_ID}/roll-1/photo-id_cover.webp`,
    ));
  });
});
