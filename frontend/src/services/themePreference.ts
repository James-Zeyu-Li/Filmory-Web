import type { Theme } from '../contexts/themeContextCore';

export const THEME_STORAGE_KEY = 'filmory-theme';
export const THEME_EXPLICIT_PREFERENCE_KEY = 'filmory-theme-explicit';
export const THEME_SYNC_EVENT = 'filmory-theme-sync';

export const getStoredTheme = (): Theme | null => {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  return savedTheme === 'dark' || savedTheme === 'light' || savedTheme === 'system'
    ? savedTheme
    : null;
};

export const notifyThemeSync = () => {
  window.dispatchEvent(new Event(THEME_SYNC_EVENT));
};

export const hasExplicitThemePreference = (): boolean => (
  localStorage.getItem(THEME_EXPLICIT_PREFERENCE_KEY) === 'true'
);

export const persistThemePreference = (theme: Theme, source: 'app' | 'user' = 'user') => {
  localStorage.setItem(THEME_STORAGE_KEY, theme);

  if (source === 'user') {
    localStorage.setItem(THEME_EXPLICIT_PREFERENCE_KEY, 'true');
  } else {
    localStorage.removeItem(THEME_EXPLICIT_PREFERENCE_KEY);
  }

  notifyThemeSync();
};

export const ensureTrialDefaultTheme = (): Theme => {
  const savedTheme = getStoredTheme();
  if (hasExplicitThemePreference() && savedTheme) return savedTheme;
  if (savedTheme === 'dark') return savedTheme;

  persistThemePreference('dark', 'app');
  return 'dark';
};
