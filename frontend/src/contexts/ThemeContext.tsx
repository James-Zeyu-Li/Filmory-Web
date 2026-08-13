import React, { useEffect, useRef, useState } from 'react';
import { ThemeContext, type Theme } from './themeContextCore';
import {
  getStoredTheme,
  persistThemePreference,
  THEME_SYNC_EVENT,
} from '../services/themePreference';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    return getStoredTheme() ?? 'system';
  });

  const [actualTheme, setActualTheme] = useState<'dark' | 'light'>('dark');
  const themeTransitionTimeoutRef = useRef<number | null>(null);

  const setTheme = (nextTheme: Theme) => {
    const root = document.documentElement;
    root.classList.add('theme-transitioning');
    if (themeTransitionTimeoutRef.current !== null) {
      window.clearTimeout(themeTransitionTimeoutRef.current);
    }
    themeTransitionTimeoutRef.current = window.setTimeout(() => {
      root.classList.remove('theme-transitioning');
      themeTransitionTimeoutRef.current = null;
    }, 240);

    setThemeState(nextTheme);
    persistThemePreference(nextTheme, 'user');
  };

  useEffect(() => () => {
    if (themeTransitionTimeoutRef.current !== null) {
      window.clearTimeout(themeTransitionTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    const handleThemeSync = () => {
      setThemeState(getStoredTheme() ?? 'system');
    };

    window.addEventListener(THEME_SYNC_EVENT, handleThemeSync);
    return () => window.removeEventListener(THEME_SYNC_EVENT, handleThemeSync);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      const resolvedTheme: 'dark' | 'light' = theme === 'system'
        ? (mediaQuery.matches ? 'dark' : 'light')
        : theme;
      
      setActualTheme(resolvedTheme);
      root.setAttribute('data-theme', resolvedTheme);
      // Fallback for color-scheme CSS property
      root.style.colorScheme = resolvedTheme;
    };

    applyTheme();

    // Listen to system changes if in system mode
    const handler = () => {
      if (theme === 'system') applyTheme();
    };
    
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, actualTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
