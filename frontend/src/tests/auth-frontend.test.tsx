import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  hasPasswordRecoveryIntent,
  markPasswordRecoveryIntent,
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
  getSession: ReturnType<typeof vi.fn>;
};

describe('Auth frontend closure', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_ENABLE_GOOGLE_OAUTH', 'true');
    vi.stubEnv('VITE_ENABLE_GITHUB_OAUTH', 'true');
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
    mockedAuth.getSession.mockClear();
    window.sessionStorage.clear();

    mockedAuth.signUp.mockResolvedValue({ data: {}, error: null });
    mockedAuth.signInWithPassword.mockResolvedValue({ data: {}, error: null });
    mockedAuth.signInWithOAuth.mockResolvedValue({ data: {}, error: null });
    mockedAuth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
    mockedAuth.updateUser.mockResolvedValue({ data: {}, error: null });
    mockedAuth.resend.mockResolvedValue({ data: {}, error: null });
    mockedAuth.setSession.mockResolvedValue({ data: { session: null }, error: null });
    mockedAuth.exchangeCodeForSession.mockResolvedValue({ data: { session: null }, error: null });
    mockedAuth.getSession.mockResolvedValue({ data: { session: null }, error: null });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('keeps the canonical auth routes on one shared accessible shell', () => {
    render(
      <MemoryRouter initialEntries={[AUTH_ROUTES.login]}>
        <Routes>
          <Route path={AUTH_ROUTES.login} element={<LoginView />} />
          <Route path={AUTH_ROUTES.signup} element={<LoginView />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole('main')).toHaveClass('login-container');
    expect(screen.getByAltText('Grainfolio 标志')).toBeInTheDocument();
    expect(screen.getAllByRole('img')).toHaveLength(1);
    expect(screen.getByRole('heading', { name: '欢迎回来' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Google' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'GitHub' })).toBeInTheDocument();

    const passwordToggle = screen.getByRole('button', { name: '显示密码' });
    expect(passwordToggle).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(passwordToggle);
    expect(passwordToggle).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: '立即注册' }));

    expect(screen.getByRole('heading', { name: '创建账号' })).toBeInTheDocument();
    expect(screen.getByLabelText('显示名称')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '返回登录' })).toBeInTheDocument();

    const signupPassword = screen.getByLabelText('密码');
    fireEvent.focus(signupPassword);
    fireEvent.change(signupPassword, { target: { value: 'Strongpass1' } });
    expect(screen.getByLabelText('至少 8 位: 已满足')).toBeInTheDocument();
    expect(screen.getByLabelText('大写字母: 已满足')).toBeInTheDocument();
  });

  it('only renders OAuth providers enabled by the public build configuration', () => {
    vi.stubEnv('VITE_ENABLE_GOOGLE_OAUTH', 'false');
    vi.stubEnv('VITE_ENABLE_GITHUB_OAUTH', 'false');

    render(
      <MemoryRouter initialEntries={[AUTH_ROUTES.login]}>
        <Routes>
          <Route path={AUTH_ROUTES.login} element={<LoginView />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.queryByRole('button', { name: 'Google' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'GitHub' })).not.toBeInTheDocument();
    expect(screen.queryByText('或继续使用以下方式')).not.toBeInTheDocument();
  });

  it('announces login failures to assistive technology', async () => {
    mockedAuth.signInWithPassword.mockResolvedValue({ data: {}, error: new Error('Invalid login credentials') });

    render(
      <MemoryRouter initialEntries={[AUTH_ROUTES.login]}>
        <Routes>
          <Route path={AUTH_ROUTES.login} element={<LoginView />} />
          <Route path={AUTH_ROUTES.signup} element={<LoginView />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText('邮箱'), { target: { value: 'wrong@grainfolio.app' } });
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'wrong-password' } });
    fireEvent.click(screen.getByRole('button', { name: '登录' }));

    expect(await screen.findByRole('alert')).toHaveAttribute('aria-live', 'assertive');
  });

  it('register flow sends signup email redirect and navigates to check-email notice', async () => {
    render(
      <MemoryRouter initialEntries={[AUTH_ROUTES.login]}>
        <Routes>
          <Route path={AUTH_ROUTES.login} element={<LoginView />} />
          <Route path={AUTH_ROUTES.signup} element={<LoginView />} />
          <Route path={AUTH_ROUTES.checkEmail} element={<AuthStatusView mode="check-email" />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: '立即注册' }));
    fireEvent.change(screen.getByLabelText('显示名称'), { target: { value: 'Analog James' } });
    fireEvent.change(screen.getByLabelText('邮箱'), { target: { value: 'new@grainfolio.app' } });
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'Strongpass1' } });
    fireEvent.change(screen.getByLabelText('确认密码'), { target: { value: 'Strongpass1' } });
    fireEvent.click(screen.getByRole('button', { name: '创建账号' }));

    await waitFor(() => {
      expect(mockedAuth.signUp).toHaveBeenCalledWith({
        email: 'new@grainfolio.app',
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
      expect(screen.getByText(/目标邮箱：new@grainfolio\.app/)).toBeInTheDocument();
    });
  });

  it('blocks weak password during register before calling Supabase signup', async () => {
    render(
      <MemoryRouter initialEntries={[AUTH_ROUTES.login]}>
        <Routes>
          <Route path={AUTH_ROUTES.login} element={<LoginView />} />
          <Route path={AUTH_ROUTES.signup} element={<LoginView />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: '立即注册' }));
    fireEvent.change(screen.getByLabelText('显示名称'), { target: { value: 'Weak Case' } });
    fireEvent.change(screen.getByLabelText('邮箱'), { target: { value: 'weak@grainfolio.app' } });
    const passwordInput = screen.getByLabelText('密码');
    fireEvent.change(passwordInput, { target: { value: 'weakpass' } });
    fireEvent.change(screen.getByLabelText('确认密码'), { target: { value: 'weakpass' } });
    fireEvent.click(screen.getByRole('button', { name: '创建账号' }));

    await waitFor(() => {
      expect(screen.getByText('密码至少 8 位，且必须包含大写字母、小写字母和数字。')).toBeInTheDocument();
      expect(passwordInput).toHaveFocus();
      expect(passwordInput).toHaveAttribute('aria-invalid', 'true');
      expect(passwordInput).toHaveAttribute('aria-describedby', 'login-password-error');
    });

    expect(mockedAuth.signUp).not.toHaveBeenCalled();
  });

  it('blocks empty display name during register before calling Supabase signup', async () => {
    render(
      <MemoryRouter initialEntries={[AUTH_ROUTES.login]}>
        <Routes>
          <Route path={AUTH_ROUTES.login} element={<LoginView />} />
          <Route path={AUTH_ROUTES.signup} element={<LoginView />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: '立即注册' }));
    const displayNameInput = screen.getByLabelText('显示名称');
    fireEvent.change(displayNameInput, { target: { value: '   ' } });
    fireEvent.change(screen.getByLabelText('邮箱'), { target: { value: 'empty-name@grainfolio.app' } });
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'Strongpass1' } });
    fireEvent.change(screen.getByLabelText('确认密码'), { target: { value: 'Strongpass1' } });
    fireEvent.click(screen.getByRole('button', { name: '创建账号' }));

    await waitFor(() => {
      expect(screen.getByText('请填写一个显示名称，用来标记这是谁的 Grainfolio 工作区。')).toBeInTheDocument();
      expect(displayNameInput).toHaveFocus();
      expect(displayNameInput).toHaveAttribute('aria-invalid', 'true');
      expect(displayNameInput).toHaveAttribute('aria-describedby', 'login-display-name-error');
    });

    expect(mockedAuth.signUp).not.toHaveBeenCalled();
  });

  it('focuses and describes the confirmation field when signup passwords differ', async () => {
    render(
      <MemoryRouter initialEntries={[AUTH_ROUTES.signup]}>
        <Routes>
          <Route path={AUTH_ROUTES.signup} element={<LoginView />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText('显示名称'), { target: { value: 'Mismatch Case' } });
    fireEvent.change(screen.getByLabelText('邮箱'), { target: { value: 'mismatch@grainfolio.app' } });
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'Strongpass1' } });
    const confirmInput = screen.getByLabelText('确认密码');
    fireEvent.change(confirmInput, { target: { value: 'Strongpass2' } });
    fireEvent.click(screen.getByRole('button', { name: '创建账号' }));

    await waitFor(() => {
      expect(confirmInput).toHaveFocus();
      expect(confirmInput).toHaveAttribute('aria-invalid', 'true');
      expect(confirmInput).toHaveAccessibleDescription('两次输入的密码不一致，请重新确认。');
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
          <Route path={AUTH_ROUTES.signup} element={<LoginView />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText('邮箱'), { target: { value: 'pending@grainfolio.app' } });
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: '12345678' } });
    fireEvent.click(screen.getByRole('button', { name: '登录' }));

    await waitFor(() => {
      expect(screen.getByText('该邮箱尚未完成验证。请先打开验证邮件完成确认后，再回来登录。')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '重新发送验证邮件' }));

    await waitFor(() => {
      expect(mockedAuth.resend).toHaveBeenCalledWith({
        type: 'signup',
        email: 'pending@grainfolio.app',
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
          <Route path={AUTH_ROUTES.signup} element={<LoginView />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText('邮箱'), { target: { value: 'user@grainfolio.app' } });
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

    fireEvent.change(screen.getByLabelText('邮箱'), { target: { value: 'reset@grainfolio.app' } });
    fireEvent.click(screen.getByRole('button', { name: '发送重设密码邮件' }));

    await waitFor(() => {
      expect(mockedAuth.resetPasswordForEmail).toHaveBeenCalledWith('reset@grainfolio.app', {
        redirectTo: buildPasswordRecoveryRedirectUrl(),
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/如果该邮箱对应账号，我们已发送重设密码邮件/)).toBeInTheDocument();
      expect(screen.queryByText(/reset@grainfolio\.app/)).not.toBeInTheDocument();
    });
  });

  it('reset password page shows invalid-state notice when no recovery session exists', async () => {
    render(
      <MemoryRouter initialEntries={[AUTH_ROUTES.resetPassword]}>
        <Routes>
          <Route path={AUTH_ROUTES.resetPassword} element={<ResetPasswordView />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('链接已失效或不可用')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '重新获取重设密码邮件' })).toBeInTheDocument();
  });

  it('reset password updates password and logs out when a recovery session is present', async () => {
    mockedAuth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'user-1', email: 'recover@grainfolio.app' } } },
      error: null,
    });
    markPasswordRecoveryIntent('user-1');

    render(
      <MemoryRouter initialEntries={[AUTH_ROUTES.resetPassword]}>
        <Routes>
          <Route path={AUTH_ROUTES.resetPassword} element={<ResetPasswordView />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByLabelText('新密码');
    fireEvent.change(screen.getByLabelText('新密码'), { target: { value: 'Newpassword1' } });
    fireEvent.change(screen.getByLabelText('确认新密码'), { target: { value: 'Newpassword1' } });
    fireEvent.click(screen.getByRole('button', { name: '确认更新密码' }));

    await waitFor(() => {
      expect(mockedAuth.updateUser).toHaveBeenCalledWith({ password: 'Newpassword1' });
      expect(mockUseAuthState.logout).toHaveBeenCalled();
      expect(hasPasswordRecoveryIntent('user-1')).toBe(false);
    });

    await waitFor(() => {
      expect(screen.getByText('密码已更新。请使用新密码重新登录。')).toBeInTheDocument();
    });
  });

  it('reset password rejects weak password before updateUser', async () => {
    mockedAuth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'user-1', email: 'recover@grainfolio.app' } } },
      error: null,
    });
    markPasswordRecoveryIntent('user-1');

    render(
      <MemoryRouter initialEntries={[AUTH_ROUTES.resetPassword]}>
        <Routes>
          <Route path={AUTH_ROUTES.resetPassword} element={<ResetPasswordView />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByLabelText('新密码');
    fireEvent.change(screen.getByLabelText('新密码'), { target: { value: 'weakpass' } });
    fireEvent.change(screen.getByLabelText('确认新密码'), { target: { value: 'weakpass' } });
    fireEvent.click(screen.getByRole('button', { name: '确认更新密码' }));

    await waitFor(() => {
      expect(screen.getByText('密码至少 8 位，且必须包含大写字母、小写字母和数字。')).toBeInTheDocument();
    });

    expect(mockedAuth.updateUser).not.toHaveBeenCalled();
  });

  it('reset password rejects a recovery marker for a different user', async () => {
    mockedAuth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'user-2', email: 'other@grainfolio.app' } } },
      error: null,
    });
    markPasswordRecoveryIntent('user-1');

    render(
      <MemoryRouter initialEntries={[AUTH_ROUTES.resetPassword]}>
        <Routes>
          <Route path={AUTH_ROUTES.resetPassword} element={<ResetPasswordView />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('链接已失效或不可用')).toBeInTheDocument();
    expect(mockedAuth.updateUser).not.toHaveBeenCalled();
    expect(hasPasswordRecoveryIntent('user-1')).toBe(false);
  });

  it('expires the recovery marker after its short client-side window', () => {
    markPasswordRecoveryIntent('user-1');

    expect(hasPasswordRecoveryIntent('user-1', Date.now() + (15 * 60 * 1000) + 1)).toBe(false);
    expect(hasPasswordRecoveryIntent('user-1')).toBe(false);
  });

  it('auth callback exchanges code and redirects to the next path', async () => {
    mockedAuth.exchangeCodeForSession.mockResolvedValue({
      data: { session: { user: { id: 'user-1' } } },
      error: null,
    });
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
    expect(hasPasswordRecoveryIntent('user-1')).toBe(true);
  });

  it('auth callback stores implicit recovery session and routes to reset password', async () => {
    mockedAuth.setSession.mockResolvedValue({
      data: { session: { user: { id: 'user-1' } } },
      error: null,
    });
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
    expect(hasPasswordRecoveryIntent('user-1')).toBe(true);
  });

  it('rejects a recovery callback without a Supabase callback credential', async () => {
    window.history.pushState({}, '', `${AUTH_ROUTES.callback}?auth_intent=recovery`);

    render(
      <BrowserRouter>
        <Routes>
          <Route path={AUTH_ROUTES.callback} element={<AuthCallbackView />} />
        </Routes>
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('认证链接已过期，请重新发起邮箱验证或密码重设流程。')).toBeInTheDocument();
    });
    expect(mockedAuth.getSession).not.toHaveBeenCalled();
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

  it.each([
    'https://evil.example',
    '//evil.example',
    '\\\\evil.example',
    '/auth/reset-password',
  ])('auth callback falls back to login when next path is unsafe: %s', async (nextPath) => {
    window.history.pushState({}, '', `${AUTH_ROUTES.callback}?code=test-code&next=${encodeURIComponent(nextPath)}&auth_intent=oauth`);

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
