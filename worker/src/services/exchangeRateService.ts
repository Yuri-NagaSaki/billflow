import type { Env } from '../types';
import { getBaseCurrency, getSupportedCurrencyCodes } from '../config/currencies';
import { dbBatch } from '../utils/db';

interface ExchangeRateApiResponse {
  result: string;
  base_code: string;
  conversion_rates: Record<string, number>;
}

export async function getAllExchangeRates(env: Env) {
  const apiKey = env.EXCHANGE_RATE_API_KEY;
  if (!apiKey) {
    return [] as Array<{ from_currency: string; to_currency: string; rate: number }>;
  }

  const baseCurrency = getBaseCurrency(env);
  const url = `https://v6.exchangerate-api.com/v6/${apiKey}/latest/${baseCurrency}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`ExchangeRate-API request failed: ${response.status}`);
  }

  const data = (await response.json()) as ExchangeRateApiResponse;
  if (!data || data.result !== 'success') {
    throw new Error('ExchangeRate-API response invalid');
  }

  const supported = new Set(getSupportedCurrencyCodes(env));
  const rates: Array<{ from_currency: string; to_currency: string; rate: number }> = [];

  rates.push({ from_currency: baseCurrency, to_currency: baseCurrency, rate: 1.0 });

  for (const [currency, rate] of Object.entries(data.conversion_rates || {})) {
    if (!supported.has(currency)) continue;
    if (currency === baseCurrency) continue;
    rates.push({ from_currency: baseCurrency, to_currency: currency, rate });
  }

  return rates;
}

export async function updateExchangeRates(env: Env) {
  const rates = await getAllExchangeRates(env);
  if (rates.length === 0) {
    return { success: false, message: 'No rates received' };
  }

  const statements = rates.map((rate) => ({
    sql: `
      INSERT INTO exchange_rates (from_currency, to_currency, rate, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(from_currency, to_currency)
      DO UPDATE SET rate = excluded.rate, updated_at = CURRENT_TIMESTAMP
    `,
    params: [rate.from_currency, rate.to_currency, rate.rate]
  }));

  await dbBatch(env.DB, statements);

  return { success: true, message: `Updated ${rates.length} exchange rates`, updatedAt: new Date().toISOString() };
}

export async function validateApiKey(env: Env) {
  try {
    const rates = await getAllExchangeRates(env);
    return rates.length > 0;
  } catch {
    return false;
  }
}
