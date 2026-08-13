import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AccountCenterModal } from '../components/AccountCenterModal';
import { db } from '../db/schema';
import { supabase } from '../services/supabaseClient';

const mockNotify = vi.fn();
const mockLogout = vi.fn();
const mockOnClose = vi.fn();

const mockAuthState = {
  user: { id: 'user-1', email: 'user@grainfolio.app', user_metadata: {} },
  session: null,
  isLoading: false,
  authMode: 'supabase' as 'supabase' | 'dev-bypass' | 'trial',
  accountRole: 'user' as 'user' | 'admin',
  isAdmin: false,
  isDevBypass: false,
  isTrial: false,
  startTrial: vi.fn(),
  signInMock: vi.fn(),
  logout: mockLogout,
};

const mockProfile = {
  id: 'user-1',
  userId: 'user-1',
  displayName: 'Analog James',
  tier: 'regular' as const,
  role: 'user' as const,
  highResQuotaUsed: 0,
};

const mockTierState = {
  tier: 'regular' as const,
  isLoading: false,
  capabilities: {
    activeRollLimit: 5,
    cloudSyncEnabled: false,
    photoStorageQuotaMb: null,
    highResUploadEnabled: false,
  },
};

vi.mock('../contexts/useAuth', () => ({
  useAuth: () => mockAuthState,
}));

vi.mock('../contexts/useFeedback', () => ({
  useFeedback: () => ({
    notify: mockNotify,
  }),
}));

vi.mock('../contexts/useConfirm', () => ({
  useConfirm: () => ({
    confirm: vi.fn().mockResolvedValue(true),
  }),
}));

vi.mock('../services/accountService', () => ({
  deleteCurrentAccount: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../hooks/useData', () => ({
  useUserProfile: () => mockProfile,
}));

vi.mock('../hooks/useUserTier', () => ({
  useUserTier: () => mockTierState,
}));

vi.mock('../services/syncService', () => ({
  SYNC_STATUS_EVENT: 'grainfolio-sync-status',
  SyncService: {
    isAutoSyncEnabled: () => false,
    getStatus: () => 'local',
  },
}));

vi.mock('../components/UpgradeModal', () => ({
  UpgradeModal: () => null,
}));

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}{location.search}</div>;
};

const renderAccountCenter = () => render(
  <MemoryRouter initialEntries={['/dashboard']}>
    <LocationProbe />
    <Routes>
      <Route
        path="/dashboard"
        element={<AccountCenterModal isOpen={true} onClose={mockOnClose} />}
      />
      <Route path="/login" element={<div>Login Page</div>} />
    </Routes>
  </MemoryRouter>
);

describe('AccountCenterModal', () => {
  const mockedAuth = supabase.auth as unknown as {
    updateUser: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    mockNotify.mockReset();
    mockLogout.mockReset();
    mockLogout.mockResolvedValue(undefined);
    mockOnClose.mockReset();
    mockAuthState.user = { id: 'user-1', email: 'user@grainfolio.app', user_metadata: {} };
    mockAuthState.authMode = 'supabase';
    mockAuthState.accountRole = 'user';
    mockAuthState.isAdmin = false;
    mockAuthState.isDevBypass = false;
    mockAuthState.isTrial = false;
    mockProfile.id = 'user-1';
    mockProfile.userId = 'user-1';
    mockProfile.displayName = 'Analog James';
    mockTierState.tier = 'regular';
    mockTierState.capabilities.activeRollLimit = 5;

    mockedAuth.updateUser.mockClear();
    mockedAuth.updateUser.mockResolvedValue({ data: {}, error: null });

    vi.spyOn(db.userProfiles, 'put').mockResolvedValue('user-1');
    vi.spyOn(db.userProfiles, 'get').mockResolvedValue(mockProfile as any);
  });

  it('keeps a signup path available after the trial banner is dismissed', () => {
    mockAuthState.user = { id: 'trial-user', email: '', user_metadata: {} };
    mockAuthState.authMode = 'trial';
    mockAuthState.isTrial = true;

    renderAccountCenter();

    expect(screen.getByRole('heading', { name: '我的账户' })).toBeInTheDocument();
    expect(screen.getByText('当前是本地试用')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '免费注册并开启云同步' }));

    expect(mockOnClose).toHaveBeenCalled();
    expect(screen.getByTestId('location')).toHaveTextContent('/login?mode=signup&trial=1');
  });

  it('shows account details and logs out a signed-in user', async () => {
    renderAccountCenter();

    expect(screen.getByText('Analog James')).toBeInTheDocument();
    expect(screen.getByText('user@grainfolio.app')).toBeInTheDocument();
    expect(screen.getByText('免费版')).toBeInTheDocument();
    expect(screen.getByText('本地模式')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '退出登录' }));

    await waitFor(() => expect(mockLogout).toHaveBeenCalled());
    expect(mockOnClose).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/login'));
  });

  it('does not render account deletion inside AccountCenterModal', () => {
    renderAccountCenter();

    expect(screen.queryByText('永久注销账号')).not.toBeInTheDocument();
    expect(screen.queryByText('注销我的账号')).not.toBeInTheDocument();
  });

  it('saves display name to local profile and Supabase metadata for a real account', async () => {
    renderAccountCenter();

    fireEvent.change(screen.getByPlaceholderText('输入你想显示的名字'), {
      target: { value: 'Analog James Studio' },
    });
    fireEvent.click(screen.getByRole('button', { name: '保存名字' }));

    await waitFor(() => {
      expect(db.userProfiles.put).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'user-1',
          userId: 'user-1',
          displayName: 'Analog James Studio',
        })
      );
    });

    expect(mockedAuth.updateUser).toHaveBeenCalledWith({
      data: {
        display_name: 'Analog James Studio',
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
    renderAccountCenter();

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
    mockAuthState.user = { id: 'trial-user', email: '', user_metadata: {} };
    mockAuthState.authMode = 'trial';
    mockAuthState.isTrial = true;
    mockProfile.id = 'trial-user';
    mockProfile.userId = 'trial-user';

    renderAccountCenter();

    fireEvent.change(screen.getByPlaceholderText('输入你想显示的名字'), {
      target: { value: 'Trial Notes' },
    });
    fireEvent.click(screen.getByRole('button', { name: '保存名字' }));

    await waitFor(() => {
      expect(db.userProfiles.put).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'trial-user',
          userId: 'trial-user',
          displayName: 'Trial Notes',
        })
      );
    });

    expect(mockedAuth.updateUser).not.toHaveBeenCalled();
  });

  it('marks the developer bypass account clearly', () => {
    mockAuthState.authMode = 'dev-bypass';
    mockAuthState.accountRole = 'admin';
    mockAuthState.isAdmin = true;
    mockAuthState.isDevBypass = true;
    mockTierState.tier = 'vip';
    mockTierState.capabilities.activeRollLimit = null;

    renderAccountCenter();

    expect(screen.getByText('Developer Mode')).toBeInTheDocument();
    expect(screen.queryByText('管理员')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '切换真实账号登录' })).toBeInTheDocument();
  });
});
