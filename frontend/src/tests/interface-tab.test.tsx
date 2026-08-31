import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InterfaceTab } from '../views/Settings/InterfaceTab';

const mockSetTheme = vi.fn();
const mockSetCurrency = vi.fn();
const mockSetLanguage = vi.fn();
const mockSetEnableFilmMode = vi.fn();
const mockSetIsProcessing = vi.fn();
const mockSetProcessMessage = vi.fn();
let currentLanguage: 'zh-CN' | 'en-US' = 'zh-CN';

vi.mock('../contexts/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1', email: 'user@grainfolio.app' } }),
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
    confirm: vi.fn(),
  }),
}));

vi.mock('../contexts/useFeedback', () => ({
  useFeedback: () => ({
    notify: vi.fn(),
  }),
}));

const renderInterfaceTab = () => render(
  <InterfaceTab
    enableFilmMode={true}
    setEnableFilmMode={mockSetEnableFilmMode}
    isProcessing={false}
    setIsProcessing={mockSetIsProcessing}
    setProcessMessage={mockSetProcessMessage}
  />
);

describe('InterfaceTab', () => {
  beforeEach(() => {
    currentLanguage = 'zh-CN';
    mockSetTheme.mockReset();
    mockSetCurrency.mockReset();
    mockSetLanguage.mockReset();
    mockSetEnableFilmMode.mockReset();
  });

  it('exposes the active theme as a pressed segmented button', () => {
    renderInterfaceTab();

    expect(screen.getByRole('group', { name: '外观' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '跟随系统' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '浅色' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('keeps roll tab layout collapsed by default until expanded', () => {
    renderInterfaceTab();

    expect(screen.getByText('当前顺序')).toBeInTheDocument();
    expect(screen.queryByText('显示项目集与独立记录视图')).not.toBeInTheDocument();

    const disclosure = screen.getByRole('button', { name: '展开' });
    expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('当前顺序').closest('.settings-item-text')).toContainElement(
      screen.getByText('拍摄记录布局')
    );

    fireEvent.click(disclosure);

    expect(disclosure).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('显示项目集与独立记录视图')).toBeInTheDocument();
  });

  it('uses compact and stacked layout contracts for mobile settings rows', () => {
    renderInterfaceTab();

    expect(screen.getByRole('checkbox', { name: '胶片工作流' }).closest('.settings-list-item'))
      .toHaveClass('settings-film-mode-item');
    expect(screen.getByRole('combobox', { name: '界面语言' }).closest('.settings-list-item'))
      .toHaveClass('settings-language-item');
    expect(screen.getByRole('combobox', { name: '记账货币' }).closest('.settings-list-item'))
      .toHaveClass('settings-stack-on-mobile');
  });

  it('renders interface preferences copy in English', () => {
    currentLanguage = 'en-US';

    renderInterfaceTab();

    expect(screen.getByText('Appearance')).toBeInTheDocument();
    expect(screen.getByText('Film workflow')).toBeInTheDocument();
    expect(screen.getByText('Shooting record layout')).toBeInTheDocument();
    expect(screen.getByText('Changing currency updates labels only. Use Batch convert to update existing amounts.')).toBeInTheDocument();
    expect(screen.queryByText('Switch Grainfolio interface text. Your gear names, film stocks, and notes are not translated.')).not.toBeInTheDocument();
    expect(screen.queryByText('Choose a workspace appearance or follow the system setting.')).not.toBeInTheDocument();
  });
});
