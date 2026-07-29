import { createContext } from 'react';

export type CurrencyCode = 'CNY' | 'USD' | 'CAD' | 'EUR' | 'GBP' | 'JPY' | 'HKD' | 'TWD';

export const CURRENCY_OPTIONS: Array<{ code: CurrencyCode; label: string; symbol: string; locale: string }> = [
  { code: 'CNY', label: '人民币 CNY', symbol: '¥', locale: 'zh-CN' },
  { code: 'USD', label: '美元 USD', symbol: '$', locale: 'en-US' },
  { code: 'CAD', label: '加元 CAD', symbol: 'CA$', locale: 'en-CA' },
  { code: 'EUR', label: '欧元 EUR', symbol: '€', locale: 'de-DE' },
  { code: 'GBP', label: '英镑 GBP', symbol: '£', locale: 'en-GB' },
  { code: 'JPY', label: '日元 JPY', symbol: '¥', locale: 'ja-JP' },
  { code: 'HKD', label: '港币 HKD', symbol: 'HK$', locale: 'zh-HK' },
  { code: 'TWD', label: '新台币 TWD', symbol: 'NT$', locale: 'zh-TW' },
];

export interface CurrencyContextType {
  currency: CurrencyCode;
  setCurrency: (currency: CurrencyCode) => void;
  currencySymbol: string;
  formatCurrency: (amount: number, options?: { maximumFractionDigits?: number }) => string;
}

export const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);
