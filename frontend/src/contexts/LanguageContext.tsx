import React, { useCallback, useEffect, useRef, useState } from 'react';
import { LanguageContext } from './languageContextCore';
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_OPTIONS,
  detectBrowserLanguage,
  translations,
  type LanguageCode,
  type TranslationKey,
} from '../i18n/translations';

const STORAGE_KEY = 'grainfolio_language';

const isLanguageCode = (value: string | null): value is LanguageCode => (
  LANGUAGE_OPTIONS.some(option => option.code === value)
);

const interpolate = (
  template: string,
  values: Record<string, string | number> = {}
) => {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => (
    values[key] === undefined ? '' : String(values[key])
  ));
};

const LANGUAGE_TRANSITION_CLASS = 'language-transitioning';
// Must match the opacity transition duration for html.language-transitioning in index.css —
// the text swap is deferred until the fade-out finishes, so the dip is fully visible first.
const LANGUAGE_TRANSITION_FADE_MS = 180;
const LANGUAGE_TRANSITION_HOLD_MS = 40;

const prefersReducedMotion = () => (
  window.matchMedia('(prefers-reduced-motion: reduce)').matches
);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<LanguageCode>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return isLanguageCode(saved) ? saved : detectBrowserLanguage();
  });
  const fadeTimeoutRef = useRef<number | null>(null);
  const holdTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, language);
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => () => {
    if (fadeTimeoutRef.current !== null) {
      window.clearTimeout(fadeTimeoutRef.current);
    }
    if (holdTimeoutRef.current !== null) {
      window.clearTimeout(holdTimeoutRef.current);
    }
  }, []);

  const setLanguage = (nextLanguage: LanguageCode) => {
    if (prefersReducedMotion()) {
      setLanguageState(nextLanguage);
      return;
    }

    const root = document.documentElement;
    if (fadeTimeoutRef.current !== null) {
      window.clearTimeout(fadeTimeoutRef.current);
    }
    if (holdTimeoutRef.current !== null) {
      window.clearTimeout(holdTimeoutRef.current);
    }

    // Every visible string swaps at once when the language changes, so a color
    // transition (like the theme switch uses) wouldn't smooth anything — dip the
    // whole page's opacity down, swap the text underneath, then let it recover.
    root.classList.add(LANGUAGE_TRANSITION_CLASS);

    fadeTimeoutRef.current = window.setTimeout(() => {
      setLanguageState(nextLanguage);
      fadeTimeoutRef.current = null;
      holdTimeoutRef.current = window.setTimeout(() => {
        root.classList.remove(LANGUAGE_TRANSITION_CLASS);
        holdTimeoutRef.current = null;
      }, LANGUAGE_TRANSITION_HOLD_MS);
    }, LANGUAGE_TRANSITION_FADE_MS);
  };

  const t = useCallback((key: TranslationKey, values?: Record<string, string | number>) => {
    const template = translations[language][key] ?? translations[DEFAULT_LANGUAGE][key] ?? key;
    return interpolate(template, values);
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};
