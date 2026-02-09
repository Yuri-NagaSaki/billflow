import bcrypt from 'bcryptjs';
import type { Env } from '../types';

export interface AdminUser {
  id: number;
  username: string;
  password_hash: string;
  role: string;
  created_at?: string;
  updated_at?: string;
  last_login_at?: string | null;
}

function resolveAdminUsername(env: Env) {
  return env.ADMIN_USERNAME || 'admin';
}

async function resolveAdminPasswordHash(env: Env) {
  if (env.ADMIN_PASSWORD_HASH) {
    return { passwordHash: env.ADMIN_PASSWORD_HASH, source: 'hash' as const };
  }
  if (env.ADMIN_PASSWORD) {
    const hash = await bcrypt.hash(env.ADMIN_PASSWORD, 12);
    return { passwordHash: hash, source: 'password' as const };
  }
  const hash = await bcrypt.hash('admin', 12);
  return { passwordHash: hash, source: 'default' as const };
}

export async function getAdminUser(env: Env): Promise<AdminUser | null> {
  const username = resolveAdminUsername(env);
  const user = await env.DB.prepare('SELECT * FROM admin_users WHERE username = ?').bind(username).first<AdminUser>();
  return user ?? null;
}

export async function ensureAdminUser(env: Env): Promise<AdminUser> {
  const existing = await getAdminUser(env);
  if (existing) return existing;

  const username = resolveAdminUsername(env);
  const { passwordHash } = await resolveAdminPasswordHash(env);

  const result = await env.DB.prepare(
    'INSERT INTO admin_users (username, password_hash, role) VALUES (?, ?, ?)'
  ).bind(username, passwordHash, 'admin').run();

  const created = await env.DB.prepare('SELECT * FROM admin_users WHERE id = ?').bind(result.meta?.last_row_id).first<AdminUser>();
  if (!created) {
    throw new Error('Failed to seed default admin user');
  }
  return created;
}

export async function updateAdminPassword(env: Env, newHash: string) {
  const username = resolveAdminUsername(env);
  await env.DB.prepare(
    'UPDATE admin_users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE username = ?'
  ).bind(newHash, username).run();
}

export async function recordSuccessfulLogin(env: Env) {
  const username = resolveAdminUsername(env);
  await env.DB.prepare(
    'UPDATE admin_users SET last_login_at = CURRENT_TIMESTAMP WHERE username = ?'
  ).bind(username).run();
}
