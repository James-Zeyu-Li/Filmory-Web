import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DataTab } from '../views/Settings/DataTab';
import { repairPendingPhotoUploads } from '../services/photoUploadRecoveryService';
import { requestImmediateSync } from '../services/syncEvents';

const mockOnDeleted = vi.fn();
const mockSetIsProcessing = vi.fn();
const mockSetProcessMessage = vi.fn();
let photoAssets: Array<{ id?: string; blob?: Blob; storageKey?: string; cloudDeletePending?: boolean }> = [];
let currentLanguage: 'zh-CN' | 'en-US' = 'zh-CN';

const mockAuthState = {
  user: { id: 'user-1', email: 'user@grainfolio.app' },
  isDevBypass: false,
  completeSignedOutTransition: vi.fn(),
};

vi.mock('../contexts/useAuth', () => ({
  useAuth: () => mockAuthState,
}));

vi.mock('../contexts/useLanguage', async () => {
  const mod = await import('../i18n/translations');
  return {
    useLanguage: () => ({
      language: currentLanguage,
      t: (key: string, values?: Record<string, unknown>) => (
        (mod.translations[currentLanguage][key as keyof typeof mod.translations[typeof currentLanguage]] || key)
          .replace(/\{\{(\w+)\}\}/g, (_, name) => String(values?.[name] ?? ''))
      ),
    }),
  };
});

vi.mock('../contexts/useFeedback', () => ({
  useFeedback: () => ({
    notify: vi.fn(),
  }),
}));

vi.mock('../hooks/useSyncStatus', () => ({
  useSyncStatus: () => 'local',
}));

vi.mock('../hooks/useData', () => ({
  usePhotoAssets: () => photoAssets,
}));

vi.mock('../services/accountService', () => ({
  deleteCurrentAccount: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../services/photoUploadRecoveryService', () => ({
  countPendingPhotoRepairs: (photos: typeof photoAssets) => photos.filter(photo => (
    Boolean((photo.blob && !photo.storageKey) || (photo.storageKey && photo.cloudDeletePending))
  )).length,
  repairPendingPhotoUploads: vi.fn(),
}));

vi.mock('../services/syncEvents', () => ({
  requestImmediateSync: vi.fn(),
}));

vi.mock('../services/syncService', () => ({
  SyncService: {
    isAutoSyncEnabled: () => true,
  },
}));

const renderDataTab = () => render(
  <DataTab
    isProcessing={false}
    setIsProcessing={mockSetIsProcessing}
    setProcessMessage={mockSetProcessMessage}
    onDeleted={mockOnDeleted}
  />
);

describe('DataTab', () => {
  beforeEach(() => {
    currentLanguage = 'zh-CN';
    photoAssets = [];
    mockOnDeleted.mockReset();
    mockSetIsProcessing.mockReset();
    mockSetProcessMessage.mockReset();
    mockAuthState.isDevBypass = false;
    mockAuthState.completeSignedOutTransition.mockReset();
    vi.mocked(repairPendingPhotoUploads).mockReset();
    vi.mocked(repairPendingPhotoUploads).mockResolvedValue({ found: 0, uploaded: 0, cleaned: 0, failed: 0 });
    vi.mocked(requestImmediateSync).mockReset();
  });

  it('includes account deletion behind a two-step confirmation', () => {
    renderDataTab();

    expect(screen.getByText('账号与安全')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '注销我的账号' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '注销我的账号' }));
    expect(screen.getByRole('heading', { name: '确认永久注销' })).toBeInTheDocument();
    expect(screen.getByLabelText('输入 DELETE 确认注销')).toBeInTheDocument();
  });

  it('renders data ownership and account security copy in English', () => {
    currentLanguage = 'en-US';

    renderDataTab();

    expect(screen.getByText('Account & Security')).toBeInTheDocument();
    expect(screen.getByText('Delete account permanently')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete my account' })).toBeInTheDocument();
    expect(screen.getByText('Export metadata as Excel')).toBeInTheDocument();
    expect(screen.getByText('Export cameras, lenses, film stock, roll records, and ledger entries. Original images are not bundled.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export records now' })).toBeInTheDocument();
  });

  it('offers to repair only local photos and immediately syncs confirmed uploads', async () => {
    currentLanguage = 'en-US';
    photoAssets = [
      { id: 'local-photo', blob: new Blob(['photo']), storageKey: undefined },
      { id: 'cloud-photo', storageKey: 'user-1/roll/photo.webp' },
    ];
    vi.mocked(repairPendingPhotoUploads).mockResolvedValue({ found: 1, uploaded: 1, cleaned: 0, failed: 0 });

    renderDataTab();

    const repairButton = screen.getByRole('button', { name: 'Process 1 items' });
    fireEvent.click(repairButton);

    await waitFor(() => expect(repairPendingPhotoUploads).toHaveBeenCalledWith('user-1'));
    expect(requestImmediateSync).toHaveBeenCalledWith('photo-upload-recovery');
  });

  it('offers the same repair entry for a previous cover awaiting Cloud cleanup', () => {
    currentLanguage = 'en-US';
    photoAssets = [
      { id: 'old-cover', storageKey: 'user-1/roll/old.webp', cloudDeletePending: true },
    ];

    renderDataTab();

    expect(screen.getByText('Finish cloud photo sync')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Process 1 items' })).toBeInTheDocument();
  });
});
