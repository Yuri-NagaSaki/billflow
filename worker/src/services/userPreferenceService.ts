import type { Env } from '../types';

const SUPPORTED_LANGUAGES = [
  { code: 'zh-CN', name: '简体中文', nativeName: '简体中文' },
  { code: 'en', name: 'English', nativeName: 'English' }
];

export function getSupportedLanguages() {
  return SUPPORTED_LANGUAGES;
}

export function getLanguageName(langCode: string) {
  const language = SUPPORTED_LANGUAGES.find((lang) => lang.code === langCode);
  return language ? language.name : langCode;
}

export function validateLanguageCode(langCode: string) {
  return SUPPORTED_LANGUAGES.some((lang) => lang.code === langCode);
}

export async function getUserLanguage(env: Env) {
  const result = await env.DB.prepare('SELECT language FROM settings WHERE id = 1').first<{ language: string }>();
  return result?.language || 'zh-CN';
}

export async function setUserLanguage(env: Env, language: string) {
  if (!validateLanguageCode(language)) {
    throw new Error(`Unsupported language: ${language}`);
  }

  const result = await env.DB.prepare(
    'UPDATE settings SET language = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1'
  ).bind(language).run();

  if ((result.meta?.changes || 0) === 0) {
    await env.DB.prepare(
      'INSERT OR REPLACE INTO settings (id, language, currency, theme, show_original_currency) VALUES (1, ?, ?, ?, ?)'
    ).bind(language, 'CNY', 'system', 1).run();
  }

  return true;
}

export async function getUserPreferences(env: Env) {
  const result = await env.DB.prepare('SELECT * FROM settings WHERE id = 1').first<Record<string, unknown>>();
  if (!result) {
    return {
      id: 1,
      currency: 'CNY',
      theme: 'system',
      show_original_currency: 1,
      language: 'zh-CN'
    };
  }
  return result;
}

export async function updateUserPreferences(env: Env, preferences: Record<string, unknown>) {
  const allowedFields = ['currency', 'theme', 'show_original_currency', 'language'];
  const updateFields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(preferences)) {
    if (allowedFields.includes(key)) {
      updateFields.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (updateFields.length === 0) {
    throw new Error('No valid fields to update');
  }

  values.push(1);
  await env.DB.prepare(
    `UPDATE settings SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).bind(...values).run();

  return true;
}
