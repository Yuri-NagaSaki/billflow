import type { Env } from '../types';
import { getBaseCurrency, getSupportedCurrencies, isSupportedCurrency } from '../config/currencies';
import { dbFirst, dbRun } from '../utils/db';

export class SettingsService {
  constructor(private env: Env) {}

  async getSettings() {
    const settings = await dbFirst<Record<string, unknown>>(
      this.env.DB,
      'SELECT * FROM settings WHERE id = 1'
    );
    return settings || this.getDefaultSettings();
  }

  async updateSettings(updateData: Record<string, unknown>) {
    const updates: Record<string, unknown> = {};
    if (updateData.currency) updates.currency = String(updateData.currency).toUpperCase();
    if (updateData.theme) updates.theme = updateData.theme;
    if (updateData.show_original_currency !== undefined) updates.show_original_currency = updateData.show_original_currency;
    if (Object.keys(updates).length === 0) throw new Error('No update fields provided');

    updates.updated_at = new Date().toISOString();

    const fields = Object.keys(updates);
    const setClause = fields.map((field) => `${field} = ?`).join(', ');
    const values = fields.map((field) => updates[field]);

    const result = await dbRun(
      this.env.DB,
      `UPDATE settings SET ${setClause} WHERE id = 1`,
      values
    );

    if ((result.meta?.changes || 0) === 0) {
      const defaults = this.getDefaultSettings();
      await dbRun(
        this.env.DB,
        'INSERT INTO settings (id, currency, theme, show_original_currency, language, created_at, updated_at) VALUES (1, ?, ?, ?, ?, ?, ?)',
        [
          updates.currency || defaults.currency,
          updates.theme || defaults.theme,
          updates.show_original_currency ?? defaults.show_original_currency,
          defaults.language,
          defaults.created_at,
          defaults.updated_at
        ]
      );
    }

    return result;
  }

  async resetSettings() {
    await dbRun(this.env.DB, 'DELETE FROM settings WHERE id = 1');
    const defaults = this.getDefaultSettings();
    return dbRun(
      this.env.DB,
      'INSERT INTO settings (id, currency, theme, show_original_currency, language, created_at, updated_at) VALUES (1, ?, ?, ?, ?, ?, ?)',
      [
        defaults.currency,
        defaults.theme,
        defaults.show_original_currency,
        defaults.language,
        defaults.created_at,
        defaults.updated_at
      ]
    );
  }

  validateCurrency(currency: string) {
    return isSupportedCurrency(this.env, currency);
  }

  validateTheme(theme: string) {
    return ['light', 'dark', 'system'].includes(theme);
  }

  validateShowOriginalCurrency(value: unknown) {
    return typeof value === 'boolean' || value === 0 || value === 1;
  }

  getSupportedCurrencies() {
    return getSupportedCurrencies(this.env);
  }

  getSupportedThemes() {
    return [
      { value: 'light', label: 'Light Theme', description: 'Light color scheme' },
      { value: 'dark', label: 'Dark Theme', description: 'Dark color scheme' },
      { value: 'system', label: 'System Default', description: 'Follow system preference' }
    ];
  }

  private getDefaultSettings() {
    return {
      currency: getBaseCurrency(this.env),
      theme: 'system',
      show_original_currency: 1,
      language: 'zh-CN',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }
}
