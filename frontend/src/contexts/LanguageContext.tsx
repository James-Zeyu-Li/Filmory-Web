import React, { useCallback, useEffect, useState } from 'react';
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

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<LanguageCode>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return isLanguageCode(saved) ? saved : detectBrowserLanguage();
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, language);
    document.documentElement.lang = language;
  }, [language]);

  const t = useCallback((key: TranslationKey, values?: Record<string, string | number>) => {
    const template = translations[language][key] ?? translations[DEFAULT_LANGUAGE][key] ?? key;
    return interpolate(template, values);
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage: setLanguageState, t }}>
      {children}
    </LanguageContext.Provider>
  );
};
