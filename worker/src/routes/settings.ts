import { Hono } from 'hono';
import type { HonoEnv } from '../types';
import { SettingsService } from '../services/settingsService';
import { createValidator } from '../utils/validator';
import { handleDbResult, handleQueryResult, validationError, success } from '../utils/response';
import { requireLogin } from '../middleware/requireLogin';

export const settingsRoutes = new Hono<HonoEnv>();
export const protectedSettingsRoutes = new Hono<HonoEnv>();

settingsRoutes.get('/', async (c) => {
  const service = new SettingsService(c.env);
  const settings = await service.getSettings();
  return handleQueryResult(c, settings, 'Settings');
});

protectedSettingsRoutes.use('*', requireLogin);

protectedSettingsRoutes.put('/', async (c) => {
  const payload = await c.req.json();
  const { currency, theme, showOriginalCurrency } = payload || {};

  const validator = createValidator();

  if (currency !== undefined) {
    validator
      .string(currency, 'currency')
      .length(currency, 'currency', 3, 3)
      .custom(currency, 'currency', (value) => new SettingsService(c.env).validateCurrency(String(value)), 'Invalid currency code');
  }

  if (theme !== undefined) {
    validator
      .string(theme, 'theme')
      .custom(theme, 'theme', (value) => new SettingsService(c.env).validateTheme(String(value)), 'Invalid theme value');
  }

  if (showOriginalCurrency !== undefined) {
    validator
      .custom(showOriginalCurrency, 'showOriginalCurrency', (value) => new SettingsService(c.env).validateShowOriginalCurrency(value), 'Invalid showOriginalCurrency value');
  }

  if (validator.hasErrors()) return validationError(c, validator.getErrors());

  if (currency === undefined && theme === undefined && showOriginalCurrency === undefined) {
    return validationError(c, 'No update fields provided');
  }

  const updateData: Record<string, unknown> = {};
  if (currency !== undefined) updateData.currency = String(currency).toUpperCase();
  if (theme !== undefined) updateData.theme = theme;
  if (showOriginalCurrency !== undefined) updateData.show_original_currency = showOriginalCurrency ? 1 : 0;

  const service = new SettingsService(c.env);
  const result = await service.updateSettings(updateData);
  return handleDbResult(c, { changes: result.meta?.changes || 0, lastInsertRowid: result.meta?.last_row_id || null }, 'update', 'Settings');
});

protectedSettingsRoutes.post('/reset', async (c) => {
  const service = new SettingsService(c.env);
  const result = await service.resetSettings();
  return success(c, { id: result.meta?.last_row_id }, 'Settings have been reset to default values');
});

settingsRoutes.get('/currencies', async (c) => {
  const service = new SettingsService(c.env);
  return handleQueryResult(c, service.getSupportedCurrencies(), 'Supported currencies');
});

settingsRoutes.get('/themes', async (c) => {
  const service = new SettingsService(c.env);
  return handleQueryResult(c, service.getSupportedThemes(), 'Supported themes');
});

settingsRoutes.get('/validate/currency/:currency', async (c) => {
  const currency = c.req.param('currency');
  const validator = createValidator();
  validator.required(currency, 'currency').string(currency, 'currency').length(currency, 'currency', 3, 3);
  if (validator.hasErrors()) return validationError(c, validator.getErrors());

  const service = new SettingsService(c.env);
  const isValid = service.validateCurrency(currency);
  return success(c, { currency: currency.toUpperCase(), isValid, message: isValid ? 'Currency is valid' : 'Currency is not supported' });
});

settingsRoutes.get('/validate/theme/:theme', async (c) => {
  const theme = c.req.param('theme');
  const validator = createValidator();
  validator.required(theme, 'theme').string(theme, 'theme');
  if (validator.hasErrors()) return validationError(c, validator.getErrors());

  const service = new SettingsService(c.env);
  const isValid = service.validateTheme(theme);
  return success(c, { theme, isValid, message: isValid ? 'Theme is valid' : 'Theme is not supported' });
});
