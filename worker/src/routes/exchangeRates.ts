import { Hono } from 'hono';
import type { HonoEnv } from '../types';
import { getBaseCurrency, isSupportedCurrency } from '../config/currencies';
import { dbAll, dbFirst, dbRun, normalizeResult } from '../utils/db';
import { handleDbResult, handleQueryResult, validationError, error as errorResponse } from '../utils/response';
import { requireLogin } from '../middleware/requireLogin';
import { updateExchangeRates } from '../services/exchangeRateService';
import { getSecret, setSecret } from '../services/secretService';

async function getExchangeRate(env: HonoEnv['Bindings'], fromCurrency: string, toCurrency: string) {
  if (fromCurrency === toCurrency) return 1.0;

  const direct = await dbFirst<{ rate: number }>(
    env.DB,
    'SELECT rate FROM exchange_rates WHERE from_currency = ? AND to_currency = ?',
    [fromCurrency, toCurrency]
  );
  if (direct) return Number(direct.rate);

  const reverse = await dbFirst<{ rate: number }>(
    env.DB,
    'SELECT rate FROM exchange_rates WHERE from_currency = ? AND to_currency = ?',
    [toCurrency, fromCurrency]
  );
  if (reverse) {
    const reverseRate = Number(reverse.rate);
    if (reverseRate !== 0) return 1 / reverseRate;
  }

  const base = getBaseCurrency(env);
  if (fromCurrency !== base && toCurrency !== base) {
    const toBase = await getExchangeRate(env, fromCurrency, base);
    const fromBase = await getExchangeRate(env, base, toCurrency);
    if (toBase !== 1.0 && fromBase !== 1.0) return toBase * fromBase;
  }

  return 1.0;
}

export const exchangeRateRoutes = new Hono<HonoEnv>();
export const protectedExchangeRateRoutes = new Hono<HonoEnv>();

exchangeRateRoutes.get('/', async (c) => {
  const rates = await dbAll<Record<string, unknown>>(c.env.DB, 'SELECT * FROM exchange_rates');
  return handleQueryResult(c, rates, 'Exchange rates');
});

exchangeRateRoutes.get('/currency/:currency', async (c) => {
  const currency = c.req.param('currency').toUpperCase();
  const rates = await dbAll<Record<string, unknown>>(
    c.env.DB,
    'SELECT * FROM exchange_rates WHERE from_currency = ? OR to_currency = ?',
    [currency, currency]
  );
  return handleQueryResult(c, rates, 'Exchange rates for currency');
});

exchangeRateRoutes.get('/:from/:to', async (c) => {
  const from = c.req.param('from').toUpperCase();
  const to = c.req.param('to').toUpperCase();
  const rate = await getExchangeRate(c.env, from, to);
  return handleQueryResult(c, { from_currency: from, to_currency: to, rate }, 'Exchange rate');
});

exchangeRateRoutes.get('/convert', async (c) => {
  const from = String(c.req.query('from') || '').toUpperCase();
  const to = String(c.req.query('to') || '').toUpperCase();
  const amount = Number(c.req.query('amount') || '1');

  if (!from || !to || Number.isNaN(amount)) {
    return validationError(c, 'from, to, and amount are required');
  }

  const rate = await getExchangeRate(c.env, from, to);
  return handleQueryResult(c, { from_currency: from, to_currency: to, rate, amount, converted: amount * rate }, 'Conversion');
});

exchangeRateRoutes.get('/stats', async (c) => {
  const stats = await dbFirst<Record<string, unknown>>(
    c.env.DB,
    'SELECT COUNT(*) as total, MAX(updated_at) as last_updated FROM exchange_rates'
  );
  return handleQueryResult(c, stats, 'Exchange rate stats');
});

exchangeRateRoutes.get('/config-status', async (c) => {
  const storedKey = await getSecret(c.env, 'exchange_rate_api_key');
  const envKey = c.env.EXCHANGE_RATE_API_KEY;
  const configured = !!(storedKey || envKey);
  const source = storedKey ? 'database' : envKey ? 'env' : 'none';
  return c.json({
    exchangeRateApiConfigured: configured,
    provider: 'ExchangeRate-API',
    updateFrequency: 'Daily (Automatic)',
    baseCurrency: getBaseCurrency(c.env),
    source
  });
});

protectedExchangeRateRoutes.use('*', requireLogin);

protectedExchangeRateRoutes.post('/', async (c) => {
  const payload = await c.req.json();
  const { from_currency, to_currency, rate } = payload || {};
  if (!from_currency || !to_currency || rate === undefined) {
    return validationError(c, 'from_currency, to_currency, and rate are required');
  }
  const result = await dbRun(
    c.env.DB,
    `
      INSERT INTO exchange_rates (from_currency, to_currency, rate, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(from_currency, to_currency)
      DO UPDATE SET rate = excluded.rate, updated_at = CURRENT_TIMESTAMP
    `,
    [String(from_currency).toUpperCase(), String(to_currency).toUpperCase(), rate]
  );
  return handleDbResult(c, normalizeResult(result), 'create', 'Exchange rate');
});

protectedExchangeRateRoutes.post('/bulk', async (c) => {
  const payload = await c.req.json();
  if (!Array.isArray(payload)) {
    return validationError(c, 'Request body must be an array');
  }

  for (const rate of payload) {
    await dbRun(
      c.env.DB,
      `
        INSERT INTO exchange_rates (from_currency, to_currency, rate, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(from_currency, to_currency)
        DO UPDATE SET rate = excluded.rate, updated_at = CURRENT_TIMESTAMP
      `,
      [String(rate.from_currency).toUpperCase(), String(rate.to_currency).toUpperCase(), rate.rate]
    );
  }

  return c.json({ message: 'Exchange rates updated', count: payload.length });
});

protectedExchangeRateRoutes.delete('/:from/:to', async (c) => {
  const from = c.req.param('from').toUpperCase();
  const to = c.req.param('to').toUpperCase();
  const result = await dbRun(c.env.DB, 'DELETE FROM exchange_rates WHERE from_currency = ? AND to_currency = ?', [from, to]);
  return handleDbResult(c, normalizeResult(result), 'delete', 'Exchange rate');
});

protectedExchangeRateRoutes.post('/validate', async (c) => {
  const payload = await c.req.json();
  const { from_currency, to_currency, rate } = payload || {};
  const errors = [] as string[];
  if (!from_currency || !isSupportedCurrency(c.env, String(from_currency))) {
    errors.push('Invalid from_currency');
  }
  if (!to_currency || !isSupportedCurrency(c.env, String(to_currency))) {
    errors.push('Invalid to_currency');
  }
  if (rate === undefined || Number.isNaN(Number(rate))) {
    errors.push('Invalid rate');
  }
  if (errors.length) return validationError(c, errors);
  return c.json({ message: 'Exchange rate data is valid' });
});

protectedExchangeRateRoutes.post('/api-key', async (c) => {
  const payload = await c.req.json();
  const apiKey = typeof payload?.api_key === 'string' ? payload.api_key.trim() : '';

  if (!apiKey) {
    await setSecret(c.env, 'exchange_rate_api_key', '');
    return c.json({ message: 'Exchange rate API key cleared', configured: false });
  }

  await setSecret(c.env, 'exchange_rate_api_key', apiKey);
  return c.json({ message: 'Exchange rate API key updated', configured: true });
});

protectedExchangeRateRoutes.post('/update', async (c) => {
  try {
    const result = await updateExchangeRates(c.env);
    if (result.success) {
      return c.json({ message: result.message, updatedAt: result.updatedAt });
    }
    return errorResponse(c, result.message || 'Update failed', 500);
  } catch (err) {
    return errorResponse(c, (err as Error).message, 500);
  }
});

protectedExchangeRateRoutes.get('/status', async (c) => {
  return c.json({
    isRunning: true,
    nextRun: null,
    hasApiKey: !!c.env.EXCHANGE_RATE_API_KEY
  });
});
