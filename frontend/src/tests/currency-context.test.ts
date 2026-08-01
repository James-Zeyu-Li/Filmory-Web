import { describe, expect, it } from 'vitest';
import { detectBrowserCurrency } from '../contexts/currencyContextCore';

describe('detectBrowserCurrency', () => {
  it('maps supported regional locales to the matching currency', () => {
    expect(detectBrowserCurrency(['en-CA'])).toBe('CAD');
    expect(detectBrowserCurrency(['en-GB'])).toBe('GBP');
    expect(detectBrowserCurrency(['ja-JP'])).toBe('JPY');
    expect(detectBrowserCurrency(['zh-HK'])).toBe('HKD');
    expect(detectBrowserCurrency(['zh-TW'])).toBe('TWD');
    expect(detectBrowserCurrency(['de-DE'])).toBe('EUR');
    expect(detectBrowserCurrency(['zh-CN'])).toBe('CNY');
  });

  it('falls back to USD when the browser locale is outside the supported set', () => {
    expect(detectBrowserCurrency(['en-AU'])).toBe('USD');
    expect(detectBrowserCurrency(['fr-SG'])).toBe('USD');
    expect(detectBrowserCurrency([])).toBe('USD');
  });
});
