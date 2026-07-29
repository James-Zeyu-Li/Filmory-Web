import React, { useEffect, useState } from 'react';
import {
  CURRENCY_OPTIONS,
  CurrencyContext,
  type CurrencyCode,
} from './currencyContextCore';

const STORAGE_KEY = 'filmory_currency';
const DEFAULT_CURRENCY: CurrencyCode = 'CNY';

const isCurrencyCode = (value: string | null): value is CurrencyCode => (
  CURRENCY_OPTIONS.some(option => option.code === value)
);

export const CurrencyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currency, setCurrencyState] = useState<CurrencyCode>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return isCurrencyCode(saved) ? saved : DEFAULT_CURRENCY;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, currency);
  }, [currency]);

  const option = CURRENCY_OPTIONS.find(item => item.code === currency) ?? CURRENCY_OPTIONS[0];

  const formatCurrency = (
    amount: number,
    { maximumFractionDigits = 0 }: { maximumFractionDigits?: number } = {}
  ) => new Intl.NumberFormat(option.locale, {
    style: 'currency',
    currency,
    maximumFractionDigits,
  }).format(amount);

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        setCurrency: setCurrencyState,
        currencySymbol: option.symbol,
        formatCurrency,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
};
