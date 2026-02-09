import type { Env, SessionUser } from '../types';
import { parseCookies, serializeCookie } from '../utils/cookies';

const SESSION_COOKIE_NAME = 'sid';
const SESSION_DURATION_MS = 1000 * 60 * 60 * 12;

export function getSessionCookieName() {
  return SESSION_COOKIE_NAME;
}

export function getCookieOptions(env: Env, requestUrl: string) {
  const sameSite = (env.SESSION_COOKIE_SAMESITE || 'lax') as 'lax' | 'strict' | 'none';
  const secureConfig = env.SESSION_COOKIE_SECURE || 'auto';

  let secure = false;
  if (secureConfig === 'true') {
    secure = true;
  } else if (secureConfig === 'false') {
    secure = false;
  } else {
    secure = requestUrl.startsWith('https://');
  }

  return {
    httpOnly: true,
    secure,
    sameSite,
    maxAge: Math.floor(SESSION_DURATION_MS / 1000),
    path: '/'
  } as const;
}

export async function createSession(env: Env, user: SessionUser, request: Request) {
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();
  const userAgent = request.headers.get('User-Agent') || '';
  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || '';

  await env.DB.prepare(
    'INSERT INTO sessions (id, user_id, username, role, expires_at, user_agent, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)'
  )
    .bind(sessionId, user.id, user.username, user.role, expiresAt, userAgent, ip)
    .run();

  return { sessionId, expiresAt };
}

export async function destroySession(env: Env, sessionId: string) {
  await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
}

export async function getSessionUser(env: Env, sessionId: string): Promise<SessionUser | null> {
  const session = await env.DB.prepare(
    'SELECT user_id, username, role, expires_at FROM sessions WHERE id = ?'
  )
    .bind(sessionId)
    .first<{ user_id: number; username: string; role: string; expires_at: string }>();

  if (!session) return null;

  if (new Date(session.expires_at).getTime() <= Date.now()) {
    await destroySession(env, sessionId);
    return null;
  }

  return { id: session.user_id, username: session.username, role: session.role };
}

export function readSessionId(request: Request) {
  const cookies = parseCookies(request.headers.get('Cookie'));
  return cookies[SESSION_COOKIE_NAME];
}

export function clearSessionCookie(env: Env, requestUrl: string) {
  const options = getCookieOptions(env, requestUrl);
  return serializeCookie(SESSION_COOKIE_NAME, '', { ...options, maxAge: 0 });
}

export function buildSessionCookie(env: Env, requestUrl: string, sessionId: string) {
  const options = getCookieOptions(env, requestUrl);
  return serializeCookie(SESSION_COOKIE_NAME, sessionId, options);
}
