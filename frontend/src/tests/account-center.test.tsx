import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AccountCenterModal } from '../components/AccountCenterModal';

const mockNotify = vi.fn();
const mockLogout = vi.fn();
const mockOnClose = vi.fn();

const mockAuthState = {
  user: { id: 'user-1', email: 'user@filmory.app', user_metadata: {} },
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

vi.mock('../hooks/useData', () => ({
  useUserProfile: () => mockProfile,
}));

vi.mock('../hooks/useUserTier', () => ({
  useUserTier: () => mockTierState,
}));

vi.mock('../services/syncService', () => ({
  SyncService: {
    isAutoSyncEnabled: () => false,
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
  beforeEach(() => {
    mockNotify.mockReset();
    mockLogout.mockReset();
    mockLogout.mockResolvedValue(undefined);
    mockOnClose.mockReset();
    mockAuthState.user = { id: 'user-1', email: 'user@filmory.app', user_metadata: {} };
    mockAuthState.authMode = 'supabase';
    mockAuthState.accountRole = 'user';
    mockAuthState.isAdmin = false;
    mockAuthState.isDevBypass = false;
    mockAuthState.isTrial = false;
    mockProfile.displayName = 'Analog James';
    mockTierState.tier = 'regular';
    mockTierState.capabilities.activeRollLimit = 5;
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
    expect(screen.getByText('user@filmory.app')).toBeInTheDocument();
    expect(screen.getByText('免费版')).toBeInTheDocument();
    expect(screen.getByText('暂未开启')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '退出登录' }));

    await waitFor(() => expect(mockLogout).toHaveBeenCalled());
    expect(mockOnClose).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/login'));
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
    expect(screen.getByText('管理员')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '切换真实账号登录' })).toBeInTheDocument();
  });
});
