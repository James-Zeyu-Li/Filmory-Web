import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserRouter, MemoryRouter, Route, Routes } from 'react-router-dom';
import { LoginView } from '../views/Auth/LoginView';
import { ForgotPasswordView } from '../views/Auth/ForgotPasswordView';
import { ResetPasswordView } from '../views/Auth/ResetPasswordView';
import { AuthCallbackView } from '../views/Auth/AuthCallbackView';
import { AuthStatusView } from '../views/Auth/AuthStatusView';
import { supabase } from '../services/supabaseClient';
import {
  AUTH_ROUTES,
  buildPasswordRecoveryRedirectUrl,
  buildSignupEmailRedirectUrl,
} from '../services/authFlow';

const mockUseAuthState = {
  user: null,
  session: null,
  isLoading: false,
  authMode: 'supabase' as const,
  accountRole: 'user' as const,
  isAdmin: false,
  isDevBypass: false,
  signInMock: vi.fn(),
  logout: vi.fn().mockResolvedValue(undefined),
};

vi.mock('../contexts/useAuth', () => ({
  useAuth: () => mockUseAuthState,
}));

const mockedAuth = supabase.auth as unknown as {
  signUp: ReturnType<typeof vi.fn>;
  signInWithPassword: ReturnType<typeof vi.fn>;
  signInWithOAuth: ReturnType<typeof vi.fn>;
  resetPasswordForEmail: ReturnType<typeof vi.fn>;
  updateUser: ReturnType<typeof vi.fn>;
  resend: ReturnType<typeof vi.fn>;
  setSession: ReturnType<typeof vi.fn>;
  exchangeCodeForSession: ReturnType<typeof vi.fn>;
};

describe('Auth frontend closure', () => {
  beforeEach(() => {
    mockUseAuthState.user = null;
    mockUseAuthState.session = null;
    mockUseAuthState.logout.mockClear();
    mockedAuth.signUp.mockClear();
    mockedAuth.signInWithPassword.mockClear();
    mockedAuth.signInWithOAuth.mockClear();
    mockedAuth.resetPasswordForEmail.mockClear();
    mockedAuth.updateUser.mockClear();
    mockedAuth.resend.mockClear();
    mockedAuth.setSession.mockClear();
    mockedAuth.exchangeCodeForSession.mockClear();

    mockedAuth.signUp.mockResolvedValue({ data: {}, error: null });
    mockedAuth.signInWithPassword.mockResolvedValue({ data: {}, error: null });
    mockedAuth.signInWithOAuth.mockResolvedValue({ data: {}, error: null });
    mockedAuth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
    mockedAuth.updateUser.mockResolvedValue({ data: {}, error: null });
    mockedAuth.resend.mockResolvedValue({ data: {}, error: null });
    mockedAuth.setSession.mockResolvedValue({ data: { session: null }, error: null });
    mockedAuth.exchangeCodeForSession.mockResolvedValue({ data: { session: null }, error: null });
  });

  it('register flow sends signup email redirect and navigates to check-email notice', async () => {
    render(
      <MemoryRouter initialEntries={[AUTH_ROUTES.login]}>
        <Routes>
          <Route path={AUTH_ROUTES.login} element={<LoginView />} />
          <Route path={AUTH_ROUTES.checkEmail} element={<AuthStatusView mode="check-email" />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: '立即注册' }));
    fireEvent.change(screen.getByLabelText('显示名称'), { target: { value: 'Analog James' } });
    fireEvent.change(screen.getByLabelText('邮箱'), { target: { value: 'new@filmory.app' } });
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'Strongpass1' } });
    fireEvent.change(screen.getByLabelText('确认密码'), { target: { value: 'Strongpass1' } });
    fireEvent.click(screen.getByRole('button', { name: '创建账号' }));

    await waitFor(() => {
      expect(mockedAuth.signUp).toHaveBeenCalledWith({
        email: 'new@filmory.app',
        password: 'Strongpass1',
        options: {
          data: {
            display_name: 'Analog James',
          },
          emailRedirectTo: buildSignupEmailRedirectUrl(),
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByText('请检查邮箱')).toBeInTheDocument();
      expect(screen.getByText(/目标邮箱：new@filmory\.app/)).toBeInTheDocument();
    });
  });

  it('blocks weak password during register before calling Supabase signup', async () => {
    render(
      <MemoryRouter initialEntries={[AUTH_ROUTES.login]}>
        <Routes>
          <Route path={AUTH_ROUTES.login} element={<LoginView />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: '立即注册' }));
    fireEvent.change(screen.getByLabelText('显示名称'), { target: { value: 'Weak Case' } });
    fireEvent.change(screen.getByLabelText('邮箱'), { target: { value: 'weak@filmory.app' } });
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'weakpass' } });
    fireEvent.change(screen.getByLabelText('确认密码'), { target: { value: 'weakpass' } });
    fireEvent.click(screen.getByRole('button', { name: '创建账号' }));

    await waitFor(() => {
      expect(screen.getByText('密码至少 8 位，且必须包含大写字母、小写字母和数字。')).toBeInTheDocument();
    });

    expect(mockedAuth.signUp).not.toHaveBeenCalled();
  });

  it('blocks empty display name during register before calling Supabase signup', async () => {
    render(
      <MemoryRouter initialEntries={[AUTH_ROUTES.login]}>
        <Routes>
          <Route path={AUTH_ROUTES.login} element={<LoginView />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: '立即注册' }));
    fireEvent.change(screen.getByLabelText('显示名称'), { target: { value: '   ' } });
    fireEvent.change(screen.getByLabelText('邮箱'), { target: { value: 'empty-name@filmory.app' } });
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'Strongpass1' } });
    fireEvent.change(screen.getByLabelText('确认密码'), { target: { value: 'Strongpass1' } });
    fireEvent.click(screen.getByRole('button', { name: '创建账号' }));

    await waitFor(() => {
      expect(screen.getByText('请填写一个显示名称，用来标记这是谁的 Filmory 工作区。')).toBeInTheDocument();
    });

    expect(mockedAuth.signUp).not.toHaveBeenCalled();
  });

  it('shows resend verification flow when login fails with unverified email', async () => {
    mockedAuth.signInWithPassword.mockResolvedValueOnce({
      data: {},
      error: new Error('Email not confirmed'),
    });

    render(
      <MemoryRouter initialEntries={[AUTH_ROUTES.login]}>
        <Routes>
          <Route path={AUTH_ROUTES.login} element={<LoginView />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText('邮箱'), { target: { value: 'pending@filmory.app' } });
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: '12345678' } });
    fireEvent.click(screen.getByRole('button', { name: '登录' }));

    await waitFor(() => {
      expect(screen.getByText('该邮箱尚未完成验证。请先打开验证邮件完成确认后，再回来登录。')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '重新发送验证邮件' }));

    await waitFor(() => {
      expect(mockedAuth.resend).toHaveBeenCalledWith({
        type: 'signup',
        email: 'pending@filmory.app',
        options: {
          emailRedirectTo: buildSignupEmailRedirectUrl(),
        },
      });
    });
  });

  it('shows photographer-facing login failure copy for invalid credentials', async () => {
    mockedAuth.signInWithPassword.mockResolvedValueOnce({
      data: {},
      error: new Error('Invalid login credentials'),
    });

    render(
      <MemoryRouter initialEntries={[AUTH_ROUTES.login]}>
        <Routes>
          <Route path={AUTH_ROUTES.login} element={<LoginView />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText('邮箱'), { target: { value: 'user@filmory.app' } });
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'Wrongpass1' } });
    fireEvent.click(screen.getByRole('button', { name: '登录' }));

    await waitFor(() => {
      expect(screen.getByText('邮箱或密码不正确，请重新检查后再试。')).toBeInTheDocument();
    });
  });

  it('forgot password sends reset email with recovery redirect', async () => {
    render(
      <MemoryRouter initialEntries={[AUTH_ROUTES.forgotPassword]}>
        <Routes>
          <Route path={AUTH_ROUTES.forgotPassword} element={<ForgotPasswordView />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText('邮箱'), { target: { value: 'reset@filmory.app' } });
    fireEvent.click(screen.getByRole('button', { name: '发送重设密码邮件' }));

    await waitFor(() => {
      expect(mockedAuth.resetPasswordForEmail).toHaveBeenCalledWith('reset@filmory.app', {
        redirectTo: buildPasswordRecoveryRedirectUrl(),
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/重设密码邮件已发送到 reset@filmory\.app/)).toBeInTheDocument();
    });
  });

  it('reset password page shows invalid-state notice when no recovery session exists', () => {
    render(
      <MemoryRouter initialEntries={[AUTH_ROUTES.resetPassword]}>
        <Routes>
          <Route path={AUTH_ROUTES.resetPassword} element={<ResetPasswordView />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('链接已失效或不可用')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '重新获取重设密码邮件' })).toBeInTheDocument();
  });

  it('reset password updates password and logs out when a recovery session is present', async () => {
    mockUseAuthState.user = { id: 'user-1', email: 'recover@filmory.app' } as never;
    mockUseAuthState.session = { user: { id: 'user-1', email: 'recover@filmory.app' } } as never;

    render(
      <MemoryRouter initialEntries={[AUTH_ROUTES.resetPassword]}>
        <Routes>
          <Route path={AUTH_ROUTES.resetPassword} element={<ResetPasswordView />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText('新密码'), { target: { value: 'Newpassword1' } });
    fireEvent.change(screen.getByLabelText('确认新密码'), { target: { value: 'Newpassword1' } });
    fireEvent.click(screen.getByRole('button', { name: '确认更新密码' }));

    await waitFor(() => {
      expect(mockedAuth.updateUser).toHaveBeenCalledWith({ password: 'Newpassword1' });
      expect(mockUseAuthState.logout).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByText('密码已更新。请使用新密码重新登录。')).toBeInTheDocument();
    });
  });

  it('reset password rejects weak password before updateUser', async () => {
    mockUseAuthState.user = { id: 'user-1', email: 'recover@filmory.app' } as never;
    mockUseAuthState.session = { user: { id: 'user-1', email: 'recover@filmory.app' } } as never;

    render(
      <MemoryRouter initialEntries={[AUTH_ROUTES.resetPassword]}>
        <Routes>
          <Route path={AUTH_ROUTES.resetPassword} element={<ResetPasswordView />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText('新密码'), { target: { value: 'weakpass' } });
    fireEvent.change(screen.getByLabelText('确认新密码'), { target: { value: 'weakpass' } });
    fireEvent.click(screen.getByRole('button', { name: '确认更新密码' }));

    await waitFor(() => {
      expect(screen.getByText('密码至少 8 位，且必须包含大写字母、小写字母和数字。')).toBeInTheDocument();
    });

    expect(mockedAuth.updateUser).not.toHaveBeenCalled();
  });

  it('auth callback exchanges code and redirects to the next path', async () => {
    window.history.pushState({}, '', `${AUTH_ROUTES.callback}?code=test-code&next=${encodeURIComponent(AUTH_ROUTES.resetPassword)}&auth_intent=recovery`);

    render(
      <BrowserRouter>
        <Routes>
          <Route path={AUTH_ROUTES.callback} element={<AuthCallbackView />} />
          <Route path={AUTH_ROUTES.resetPassword} element={<div>Reset Route Reached</div>} />
        </Routes>
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(mockedAuth.exchangeCodeForSession).toHaveBeenCalledWith('test-code');
    });

    await waitFor(() => {
      expect(screen.getByText('Reset Route Reached')).toBeInTheDocument();
    });
  });

  it('auth callback stores implicit recovery session and routes to reset password', async () => {
    window.history.pushState({}, '', `${AUTH_ROUTES.callback}#access_token=access-token&refresh_token=refresh-token&type=recovery`);

    render(
      <BrowserRouter>
        <Routes>
          <Route path={AUTH_ROUTES.callback} element={<AuthCallbackView />} />
          <Route path={AUTH_ROUTES.resetPassword} element={<div>Reset Route Reached</div>} />
        </Routes>
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(mockedAuth.setSession).toHaveBeenCalledWith({
        access_token: 'access-token',
        refresh_token: 'refresh-token',
      });
    });

    expect(mockedAuth.exchangeCodeForSession).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(screen.getByText('Reset Route Reached')).toBeInTheDocument();
    });
  });

  it('auth callback stores implicit signup session and routes to verified status', async () => {
    window.history.pushState({}, '', `${AUTH_ROUTES.callback}#access_token=access-token&refresh_token=refresh-token&type=signup`);

    render(
      <BrowserRouter>
        <Routes>
          <Route path={AUTH_ROUTES.callback} element={<AuthCallbackView />} />
          <Route path={AUTH_ROUTES.verified} element={<div>Verified Route Reached</div>} />
        </Routes>
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(mockedAuth.setSession).toHaveBeenCalledWith({
        access_token: 'access-token',
        refresh_token: 'refresh-token',
      });
    });

    expect(mockedAuth.exchangeCodeForSession).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(screen.getByText('Verified Route Reached')).toBeInTheDocument();
    });
  });

  it('auth callback falls back to login when next path is unsafe', async () => {
    window.history.pushState({}, '', `${AUTH_ROUTES.callback}?code=test-code&next=${encodeURIComponent('https://evil.example')}&auth_intent=oauth`);

    render(
      <BrowserRouter>
        <Routes>
          <Route path={AUTH_ROUTES.callback} element={<AuthCallbackView />} />
          <Route path={AUTH_ROUTES.login} element={<div>Login Route Reached</div>} />
        </Routes>
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(mockedAuth.exchangeCodeForSession).toHaveBeenCalledWith('test-code');
    });

    await waitFor(() => {
      expect(screen.getByText('Login Route Reached')).toBeInTheDocument();
    });
  });
});
