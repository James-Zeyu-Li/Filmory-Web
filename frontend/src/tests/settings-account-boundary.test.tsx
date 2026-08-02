import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsView } from '../views/Settings/SettingsView';
import { supabase } from '../services/supabaseClient';

const mockSetTheme = vi.fn();
const mockSetCurrency = vi.fn();
const mockSetLanguage = vi.fn();
const mockConfirm = vi.fn();
const mockSetEnableFilmMode = vi.fn();
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
      t: (key: string) => mod.translations[currentLanguage][key as keyof typeof mod.translations[typeof currentLanguage]] || key,
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

describe('SettingsView account boundary', () => {
  const mockedSupabase = supabase as unknown as {
    rpc: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    currentLanguage = 'zh-CN';
    mockSetTheme.mockReset();
    mockSetCurrency.mockReset();
    mockSetLanguage.mockReset();
    mockConfirm.mockReset();
    mockSetEnableFilmMode.mockReset();
    mockAuthState.logout.mockReset();
    mockAuthState.clearLocalAuthState.mockReset();
    mockAuthState.completeSignedOutTransition.mockReset();
    mockedSupabase.rpc.mockClear();
    mockedSupabase.rpc.mockResolvedValue({ data: null, error: null });
  });

  it('keeps personal profile and membership controls out of settings', () => {
    render(
      <SettingsView
        enableFilmMode={true}
        setEnableFilmMode={mockSetEnableFilmMode}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('账号与安全')).toBeInTheDocument();
    expect(screen.queryByText('会员状态')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('输入你想显示的名字')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '保存名字' })).not.toBeInTheDocument();
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

  it('runs the signed-out transition after account deletion without calling logout again', async () => {
    mockConfirm.mockResolvedValue(true);

    render(
      <SettingsView
        enableFilmMode={true}
        setEnableFilmMode={mockSetEnableFilmMode}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '注销我的账号' }));
    fireEvent.change(screen.getByLabelText('输入 DELETE 确认注销'), {
      target: { value: 'DELETE' },
    });
    fireEvent.click(screen.getByRole('button', { name: '确认永久销毁' }));

    await waitFor(() => {
      expect(mockedSupabase.rpc).toHaveBeenCalledWith('delete_user');
      expect(mockAuthState.completeSignedOutTransition).toHaveBeenCalledWith('deletingAccount');
    });

    expect(mockAuthState.logout).not.toHaveBeenCalled();
  });

  it('renders logout and delete account copy in English', () => {
    currentLanguage = 'en-US';

    render(
      <SettingsView
        enableFilmMode={true}
        setEnableFilmMode={mockSetEnableFilmMode}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('Account & Security')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Log out' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument();
    expect(screen.getByText('Sign out on this device without deleting local offline data.')).toBeInTheDocument();
    expect(screen.getByText('Data Ownership')).toBeInTheDocument();
    expect(screen.getByText('Export metadata as Excel')).toBeInTheDocument();
    expect(screen.getByText('Export cameras, lenses, film stock, roll records, and ledger entries. Original images are not bundled.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export records now' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Delete account permanently' })).toBeInTheDocument();
    expect(screen.getByText('Permanently destroy your Grainfolio account and cloud data. This cannot be undone.')).toBeInTheDocument();
  });
});
