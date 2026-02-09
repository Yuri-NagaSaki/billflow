import type { Env } from '../types';

export type SecretKey = 'telegram_bot_token' | 'exchange_rate_api_key';

export async function getSecret(env: Env, key: SecretKey): Promise<string | null> {
  const row = await env.DB.prepare('SELECT value FROM app_secrets WHERE key = ?')
    .bind(key)
    .first<{ value: string }>();
  return row?.value ?? null;
}

export async function setSecret(env: Env, key: SecretKey, value: string | null | undefined) {
  const trimmed = (value || '').trim();
  if (!trimmed) {
    await env.DB.prepare('DELETE FROM app_secrets WHERE key = ?').bind(key).run();
    return { configured: false };
  }

  await env.DB.prepare(
    `
      INSERT INTO app_secrets (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `
  ).bind(key, trimmed).run();

  return { configured: true };
}
