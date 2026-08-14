import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsView } from '../views/Settings/SettingsView';
import { deleteCurrentAccount } from '../services/accountService';
import { repairPendingPhotoUploads } from '../services/photoUploadRecoveryService';
import { requestImmediateSync } from '../services/syncEvents';

const mockSetTheme = vi.fn();
const mockSetCurrency = vi.fn();
const mockSetLanguage = vi.fn();
const mockConfirm = vi.fn();
const mockSetEnableFilmMode = vi.fn();
let photoAssets: Array<{ id?: string; blob?: Blob; storageKey?: string }> = [];
let currentLanguage: 'zh-CN' | 'en-US' = 'zh-CN';

const mockAuthState = {
  user: { id: 'user-1', email: 'user@grainfolio.app' },
  logout: vi.fn(),
  clearLocalAuthState: vi.fn(),
  completeSignedOutTransition: vi.fn(),
  accountRole: 'user' as const,
  isDevBypass: false,
  isAdmin: false,
};

vi.mock('../contexts/useAuth', () => ({
  useAuth: () => mockAuthState,
}));

vi.mock('../contexts/useTheme', () => ({
  useTheme: () => ({
    theme: 'system',
    setTheme: mockSetTheme,
  }),
}));

vi.mock('../contexts/useCurrency', () => ({
  useCurrency: () => ({
    currency: 'CNY',
    setCurrency: mockSetCurrency,
    currencySymbol: '¥',
  }),
}));

vi.mock('../contexts/useLanguage', async () => {
  const mod = await import('../i18n/translations');
  return {
    useLanguage: () => ({
      language: currentLanguage,
      setLanguage: mockSetLanguage,
      t: (key: string, values?: Record<string, unknown>) => (
        (mod.translations[currentLanguage][key as keyof typeof mod.translations[typeof currentLanguage]] || key)
          .replace(/\{\{(\w+)\}\}/g, (_, name) => String(values?.[name] ?? ''))
      ),
    }),
  };
});

vi.mock('../contexts/useConfirm', () => ({
  useConfirm: () => ({
    confirm: mockConfirm,
  }),
}));

vi.mock('../contexts/useFeedback', () => ({
  useFeedback: () => ({
    notify: vi.fn(),
  }),
}));

vi.mock('../hooks/useData', () => ({
  usePhotoAssets: () => photoAssets,
}));

vi.mock('../services/accountService', () => ({
  deleteCurrentAccount: vi.fn(),
}));

vi.mock('../services/photoUploadRecoveryService', () => ({
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

describe('SettingsView account boundary', () => {
  beforeEach(() => {
    currentLanguage = 'zh-CN';
    mockSetTheme.mockReset();
    mockSetCurrency.mockReset();
    mockSetLanguage.mockReset();
    mockConfirm.mockReset();
    mockSetEnableFilmMode.mockReset();
    photoAssets = [];
    mockAuthState.logout.mockReset();
    mockAuthState.clearLocalAuthState.mockReset();
    mockAuthState.completeSignedOutTransition.mockReset();
    vi.mocked(deleteCurrentAccount).mockReset();
    vi.mocked(deleteCurrentAccount).mockResolvedValue(undefined);
    vi.mocked(repairPendingPhotoUploads).mockResolvedValue({ found: 0, uploaded: 0, failed: 0 });
    vi.mocked(requestImmediateSync).mockReset();
  });

  it('keeps personal profile editor out of settings but includes account deletion', () => {
    render(
      <SettingsView
        enableFilmMode={true}
        setEnableFilmMode={mockSetEnableFilmMode}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('账号与安全')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '注销我的账号' })).toBeInTheDocument();
    expect(screen.queryByText('会员状态')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('输入你想显示的名字')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '保存名字' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '注销我的账号' }));
    expect(screen.getByRole('heading', { name: '确认永久注销' })).toBeInTheDocument();
    expect(screen.getByLabelText('输入 DELETE 确认注销')).toBeInTheDocument();
  });

  it('exposes the active theme as a pressed segmented button', () => {
    render(
      <SettingsView
        enableFilmMode={true}
        setEnableFilmMode={mockSetEnableFilmMode}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByRole('group', { name: '色彩主题' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '跟随系统' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '浅色' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('keeps roll tab layout collapsed by default until expanded', () => {
    render(
      <SettingsView
        enableFilmMode={true}
        setEnableFilmMode={mockSetEnableFilmMode}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('当前顺序')).toBeInTheDocument();
    expect(screen.queryByText('显示项目集与独立记录视图')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '展开' }));

    expect(screen.getByText('显示项目集与独立记录视图')).toBeInTheDocument();
  });

  it('renders preferences, data ownership, and account security copy in English', () => {
    currentLanguage = 'en-US';

    render(
      <SettingsView
        enableFilmMode={true}
        setEnableFilmMode={mockSetEnableFilmMode}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('Account & Security')).toBeInTheDocument();
    expect(screen.getByText('Delete account permanently')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete my account' })).toBeInTheDocument();
    expect(screen.getByText('Data Ownership')).toBeInTheDocument();
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
    vi.mocked(repairPendingPhotoUploads).mockResolvedValue({ found: 1, uploaded: 1, failed: 0 });

    render(
      <SettingsView
        enableFilmMode={true}
        setEnableFilmMode={mockSetEnableFilmMode}
        onClose={vi.fn()}
      />
    );

    const repairButton = screen.getByRole('button', { name: 'Upload 1 images' });
    fireEvent.click(repairButton);

    await waitFor(() => expect(repairPendingPhotoUploads).toHaveBeenCalledWith('user-1'));
    expect(requestImmediateSync).toHaveBeenCalledWith('photo-upload-recovery');
  });
});
