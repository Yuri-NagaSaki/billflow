import type { Env } from '../types';

export const ALL_CURRENCY_CODES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CNY', 'TRY', 'HKD'] as const;

export type CurrencyCode = (typeof ALL_CURRENCY_CODES)[number];

const BASE_RATES: Record<string, Record<string, number>> = {
  CNY: {
    CNY: 1.0,
    USD: 0.1538,
    EUR: 0.1308,
    GBP: 0.1154,
    CAD: 0.1923,
    AUD: 0.2077,
    JPY: 16.9231,
    TRY: 4.2,
    HKD: 1.1923
  },
  USD: {
    USD: 1.0,
    CNY: 6.5,
    EUR: 0.85,
    GBP: 0.75,
    CAD: 1.25,
    AUD: 1.35,
    JPY: 110.0,
    TRY: 27.0,
    HKD: 7.8
  },
  EUR: {
    EUR: 1.0,
    USD: 1.1765,
    CNY: 7.6471,
    GBP: 0.8824,
    CAD: 1.4706,
    AUD: 1.5882,
    JPY: 129.4118,
    TRY: 31.7647,
    HKD: 9.1765
  },
  GBP: {
    GBP: 1.0,
    USD: 1.3333,
    CNY: 8.6667,
    EUR: 1.1333,
    CAD: 1.6667,
    AUD: 1.8,
    JPY: 146.6667,
    TRY: 36.0,
    HKD: 10.3333
  },
  CAD: {
    CAD: 1.0,
    USD: 0.8,
    CNY: 5.2,
    EUR: 0.68,
    GBP: 0.6,
    AUD: 1.08,
    JPY: 88.0,
    TRY: 21.6,
    HKD: 6.24
  },
  AUD: {
    AUD: 1.0,
    USD: 0.7407,
    CNY: 4.8148,
    EUR: 0.6296,
    GBP: 0.5556,
    CAD: 0.9259,
    JPY: 81.4815,
    TRY: 20.0,
    HKD: 5.7778
  },
  JPY: {
    JPY: 1.0,
    USD: 0.0091,
    CNY: 0.0591,
    EUR: 0.0077,
    GBP: 0.0068,
    CAD: 0.0114,
    AUD: 0.0123,
    TRY: 0.2455,
    HKD: 0.0667
  },
  TRY: {
    TRY: 1.0,
    USD: 0.037,
    CNY: 0.2381,
    EUR: 0.0315,
    GBP: 0.0278,
    CAD: 0.0463,
    AUD: 0.05,
    JPY: 4.0741,
    HKD: 0.2889
  },
  HKD: {
    HKD: 1.0,
    USD: 0.1282,
    CNY: 0.8387,
    EUR: 0.1089,
    GBP: 0.0965,
    CAD: 0.1603,
    AUD: 0.1731,
    JPY: 14.1026,
    TRY: 3.4615
  }
};

const ALL_CURRENCIES = [
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'TRY', name: 'Turkish Lira', symbol: '₺' },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$' }
];

export function getBaseCurrency(env: Env): string {
  const base = (env.BASE_CURRENCY || 'CNY').toUpperCase();
  if (!ALL_CURRENCY_CODES.includes(base as CurrencyCode)) {
    return 'CNY';
  }
  return base;
}

export function getSupportedCurrencyCodes(env: Env): string[] {
  const base = getBaseCurrency(env);
  return [base, ...ALL_CURRENCY_CODES.filter((code) => code !== base).sort()];
}

export function getSupportedCurrencies(env: Env) {
  const base = getBaseCurrency(env);
  return [
    ALL_CURRENCIES.find((c) => c.code === base)!,
    ...ALL_CURRENCIES.filter((c) => c.code !== base).sort((a, b) => a.code.localeCompare(b.code))
  ];
}

export function isSupportedCurrency(env: Env, code: string) {
  if (!code) return false;
  return getSupportedCurrencyCodes(env).includes(code.toUpperCase());
}

export function getDefaultExchangeRates(env: Env) {
  const base = getBaseCurrency(env);
  const rates = BASE_RATES[base] || BASE_RATES.CNY;
  return Object.entries(rates).map(([to_currency, rate]) => ({
    from_currency: base,
    to_currency,
    rate
  }));
}
