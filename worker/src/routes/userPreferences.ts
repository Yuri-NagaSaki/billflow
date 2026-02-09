import { Hono } from 'hono';
import type { HonoEnv } from '../types';
import { requireLogin } from '../middleware/requireLogin';
import { getUserPreferences, updateUserPreferences, getUserLanguage, setUserLanguage, getSupportedLanguages, getLanguageName, validateLanguageCode } from '../services/userPreferenceService';
import { validationError, handleQueryResult } from '../utils/response';

export const userPreferencesRoutes = new Hono<HonoEnv>();

userPreferencesRoutes.use('*', requireLogin);

userPreferencesRoutes.get('/', async (c) => {
  const preferences = await getUserPreferences(c.env);
  return handleQueryResult(c, preferences, 'User preferences');
});

userPreferencesRoutes.put('/', async (c) => {
  const payload = await c.req.json();
  if (!payload || typeof payload.preferences !== 'object') {
    return validationError(c, 'Invalid preferences data');
  }
  await updateUserPreferences(c.env, payload.preferences);
  const updated = await getUserPreferences(c.env);
  return c.json({ success: true, message: 'User preferences updated successfully', data: updated });
});

userPreferencesRoutes.get('/language', async (c) => {
  const language = await getUserLanguage(c.env);
  return c.json({ success: true, data: { language, languageName: getLanguageName(language) } });
});

userPreferencesRoutes.put('/language', async (c) => {
  const payload = await c.req.json();
  const { language } = payload || {};
  if (!language) return validationError(c, 'Language code is required');
  if (!validateLanguageCode(language)) {
    return c.json({ success: false, message: 'Unsupported language code', supportedLanguages: getSupportedLanguages() }, 400);
  }
  await setUserLanguage(c.env, language);
  return c.json({ success: true, message: 'Language preference updated successfully', data: { language, languageName: getLanguageName(language) } });
});

userPreferencesRoutes.get('/supported-languages', async (c) => {
  return c.json({ success: true, data: getSupportedLanguages() });
});
