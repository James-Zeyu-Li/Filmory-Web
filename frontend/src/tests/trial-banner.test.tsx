import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { TrialBanner } from '../components/TrialBanner';

const mockUseAuthState = {
  isTrial: true,
};

vi.mock('../contexts/useAuth', () => ({
  useAuth: () => mockUseAuthState,
}));

describe('TrialBanner', () => {
  beforeEach(() => {
    mockUseAuthState.isTrial = true;
    window.sessionStorage.clear();
  });

  it('shows the signup CTA with preserved trial intent', () => {
    render(
      <MemoryRouter>
        <TrialBanner />
      </MemoryRouter>
    );

    const cta = screen.getByRole('link', { name: '免费注册并开启云同步' });
    expect(cta).toBeInTheDocument();
    expect(cta).toHaveAttribute('href', '/login?mode=signup&trial=1');
  });

  it('persists dismiss state for the current browser session', () => {
    const { unmount } = render(
      <MemoryRouter>
        <TrialBanner />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: '关闭提示' }));

    expect(window.sessionStorage.getItem('grainfolio_trial_banner_dismissed')).toBe('true');
    expect(screen.queryByText('免费注册并开启云同步')).not.toBeInTheDocument();

    unmount();

    render(
      <MemoryRouter>
        <TrialBanner />
      </MemoryRouter>
    );

    expect(screen.queryByText('免费注册并开启云同步')).not.toBeInTheDocument();
  });

  it('does not render outside trial mode', () => {
    mockUseAuthState.isTrial = false;

    render(
      <MemoryRouter>
        <TrialBanner />
      </MemoryRouter>
    );

    expect(screen.queryByText('免费注册并开启云同步')).not.toBeInTheDocument();
  });
});
