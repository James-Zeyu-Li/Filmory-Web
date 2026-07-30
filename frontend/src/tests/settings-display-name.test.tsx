import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsView } from '../views/Settings/SettingsView';
import { db } from '../db/schema';
import { supabase } from '../services/supabaseClient';

const mockNotify = vi.fn();
const mockSetTheme = vi.fn();
const mockSetCurrency = vi.fn();
const mockSetLanguage = vi.fn();
const mockConfirm = vi.fn();
const mockSetEnableFilmMode = vi.fn();

const mockAuthState = {
  user: { id: 'user-1', email: 'user@filmory.app' },
  logout: vi.fn(),
  accountRole: 'user' as const,
  isDevBypass: false,
  isAdmin: false,
  isTrial: false,
};

const mockProfile = {
  id: 'user-1',
  userId: 'user-1',
  tier: 'regular' as const,
  role: 'user' as const,
  displayName: 'Old Name',
  highResQuotaUsed: 0,
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
      language: 'zh-CN',
      setLanguage: mockSetLanguage,
      t: (key: string) => mod.translations['zh-CN'][key as keyof typeof mod.translations['zh-CN']] || key,
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
    notify: mockNotify,
  }),
}));

vi.mock('../hooks/useUserTier', () => ({
  useUserTier: () => ({
    tier: 'regular',
    isLoading: false,
    capabilities: {
      cloudSyncEnabled: false,
      highResUploadEnabled: false,
    },
  }),
}));

vi.mock('../hooks/useData', () => ({
  useUserProfile: () => mockProfile,
}));

vi.mock('../components/UpgradeModal', () => ({
  UpgradeModal: () => null,
}));

describe('Settings display name flow', () => {
  const mockedAuth = supabase.auth as unknown as {
    updateUser: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    mockNotify.mockReset();
    mockSetTheme.mockReset();
    mockSetCurrency.mockReset();
    mockSetLanguage.mockReset();
    mockConfirm.mockReset();
    mockSetEnableFilmMode.mockReset();
    mockAuthState.isDevBypass = false;
    mockAuthState.isTrial = false;
    mockProfile.displayName = 'Old Name';

    mockedAuth.updateUser.mockClear();
    mockedAuth.updateUser.mockResolvedValue({ data: {}, error: null });

    vi.spyOn(db.userProfiles, 'put').mockResolvedValue('user-1');
    vi.spyOn(db.userProfiles, 'get').mockResolvedValue(mockProfile as any);
  });

  it('saves display name to local profile and Supabase metadata for a real account', async () => {
    render(
      <SettingsView
        enableFilmMode={true}
        setEnableFilmMode={mockSetEnableFilmMode}
        onClose={vi.fn()}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('输入你想显示的名字'), {
      target: { value: 'Analog James' },
    });
    fireEvent.click(screen.getByRole('button', { name: '保存名字' }));

    await waitFor(() => {
      expect(db.userProfiles.put).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'user-1',
          userId: 'user-1',
          displayName: 'Analog James',
        })
      );
    });

    expect(mockedAuth.updateUser).toHaveBeenCalledWith({
      data: {
        display_name: 'Analog James',
      },
    });

    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'success',
        title: '显示名称已保存',
      })
    );
  });

  it('blocks invalid display name before saving', async () => {
    render(
      <SettingsView
        enableFilmMode={true}
        setEnableFilmMode={mockSetEnableFilmMode}
        onClose={vi.fn()}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('输入你想显示的名字'), {
      target: { value: '   ' },
    });
    fireEvent.click(screen.getByRole('button', { name: '保存名字' }));

    await waitFor(() => {
      expect(mockNotify).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          title: '显示名称无效',
        })
      );
    });

    expect(db.userProfiles.put).not.toHaveBeenCalled();
    expect(mockedAuth.updateUser).not.toHaveBeenCalled();
  });

  it('keeps display name local-only for trial users', async () => {
    mockAuthState.isTrial = true;

    render(
      <SettingsView
        enableFilmMode={true}
        setEnableFilmMode={mockSetEnableFilmMode}
        onClose={vi.fn()}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('输入你想显示的名字'), {
      target: { value: 'Trial Notes' },
    });
    fireEvent.click(screen.getByRole('button', { name: '保存名字' }));

    await waitFor(() => {
      expect(db.userProfiles.put).toHaveBeenCalledWith(
        expect.objectContaining({
          displayName: 'Trial Notes',
        })
      );
    });

    expect(mockedAuth.updateUser).not.toHaveBeenCalled();
  });
});
