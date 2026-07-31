import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsView } from '../views/Settings/SettingsView';

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
    notify: vi.fn(),
  }),
}));

describe('SettingsView account boundary', () => {
  beforeEach(() => {
    mockSetTheme.mockReset();
    mockSetCurrency.mockReset();
    mockSetLanguage.mockReset();
    mockConfirm.mockReset();
    mockSetEnableFilmMode.mockReset();
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
});
