import React, { useEffect, useState } from 'react';
import { ThemeContext, type Theme } from './themeContextCore';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem('filmory-theme') as Theme;
    return saved || 'system';
  });

  const [actualTheme, setActualTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    localStorage.setItem('filmory-theme', theme);
    
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
    <ThemeContext.Provider value={{ theme, setTheme: setThemeState, actualTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
