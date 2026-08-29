import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../contexts/ThemeContext';
import { useTheme } from '../contexts/useTheme';
import { ensureTrialDefaultTheme } from '../services/themePreference';

const storage = new Map<string, string>();

const ThemeProbe = () => {
  const { theme, actualTheme } = useTheme();
  return (
    <>
      <span data-testid="theme">{theme}</span>
      <span data-testid="actual-theme">{actualTheme}</span>
    </>
  );
};

describe('trial theme default', () => {
  beforeEach(() => {
    storage.clear();
    window.history.replaceState({}, '', '/');

    vi.mocked(localStorage.getItem).mockImplementation((key: string) => storage.get(key) ?? null);
    vi.mocked(localStorage.setItem).mockImplementation((key: string, value: string) => {
      storage.set(key, value);
    });
    vi.mocked(localStorage.removeItem).mockImplementation((key: string) => {
      storage.delete(key);
    });
    vi.mocked(localStorage.clear).mockImplementation(() => {
      storage.clear();
    });
  });

  it('follows the system preference on public auth routes without persisting a user preference', async () => {
    // Landing and Auth are both fully theme-aware (neither has a fixed-dark
    // identity to stay "continuous" with), so a first-time auth visit resolves
    // exactly like any other route: 'system', which jsdom's default
    // matchMedia mock reports as light here.
    window.history.replaceState({}, '', '/auth/login');

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );

    expect(screen.getByTestId('theme')).toHaveTextContent('system');
    await waitFor(() => {
      expect(screen.getByTestId('actual-theme')).toHaveTextContent('light');
      expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    });
    expect(storage.has('grainfolio-theme')).toBe(false);
    expect(storage.has('grainfolio-theme-explicit')).toBe(false);
  });

  it('keeps a saved light theme on public auth routes', async () => {
    storage.set('grainfolio-theme', 'light');
    storage.set('grainfolio-theme-explicit', 'true');
    window.history.replaceState({}, '', '/auth/signup');

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );

    expect(screen.getByTestId('theme')).toHaveTextContent('light');
    await waitFor(() => {
      expect(screen.getByTestId('actual-theme')).toHaveTextContent('light');
      expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    });
  });

  it('switches to dark when trial starts without an existing theme preference', async () => {
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );

    expect(screen.getByTestId('theme')).toHaveTextContent('system');
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');

    ensureTrialDefaultTheme();

    await waitFor(() => {
      expect(screen.getByTestId('theme')).toHaveTextContent('dark');
      expect(screen.getByTestId('actual-theme')).toHaveTextContent('dark');
      expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    });
  });

  it('keeps an existing explicit theme preference when trial starts', async () => {
    storage.set('grainfolio-theme', 'light');
    storage.set('grainfolio-theme-explicit', 'true');

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );

    expect(screen.getByTestId('theme')).toHaveTextContent('light');
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');

    ensureTrialDefaultTheme();

    await waitFor(() => {
      expect(screen.getByTestId('theme')).toHaveTextContent('light');
      expect(screen.getByTestId('actual-theme')).toHaveTextContent('light');
      expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    });
  });
});
