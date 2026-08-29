import { describe, expect, it } from 'vitest';
import { DEFAULT_LANGUAGE, LANGUAGE_OPTIONS, detectBrowserLanguage, translations } from '../i18n/translations';

describe('i18n translations', () => {
  it('keeps supported language options explicit', () => {
    expect(DEFAULT_LANGUAGE).toBe('zh-CN');
    expect(LANGUAGE_OPTIONS.map(option => option.code)).toEqual(['zh-CN', 'en-US']);
  });

  it('uses Chinese for Chinese browser locales and English for other locales', () => {
    expect(detectBrowserLanguage(['zh-CN', 'en-US'])).toBe('zh-CN');
    expect(detectBrowserLanguage(['zh-HK'])).toBe('zh-CN');
    expect(detectBrowserLanguage(['en-US', 'fr-CA'])).toBe('en-US');
    expect(detectBrowserLanguage(['en-US', 'zh-CN'])).toBe('en-US');
    expect(detectBrowserLanguage([])).toBe('en-US');
  });

  it('keeps English keys aligned with the default Chinese dictionary', () => {
    const defaultKeys = Object.keys(translations['zh-CN']).sort();
    const englishKeys = Object.keys(translations['en-US']).sort();

    expect(englishKeys).toEqual(defaultKeys);
  });

  it('includes core shell translations for the first rollout scope', () => {
    expect(translations['en-US']['nav.dashboard']).toBe('Dashboard');
    expect(translations['en-US']['settings.language']).toBe('Interface language');
    expect(translations['en-US']['landing.tryNow']).toBe('Try it Now');
  });
});
