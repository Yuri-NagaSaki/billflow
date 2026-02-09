type SameSite = 'lax' | 'strict' | 'none';

export interface CookieOptions {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: SameSite;
  maxAge?: number;
  path?: string;
}

export function parseCookies(header?: string | null): Record<string, string> {
  if (!header) return {};
  const cookies: Record<string, string> = {};
  const parts = header.split(';');
  for (const part of parts) {
    const [rawName, ...rest] = part.trim().split('=');
    if (!rawName) continue;
    cookies[rawName] = decodeURIComponent(rest.join('=') || '');
  }
  return cookies;
}

export function serializeCookie(name: string, value: string, options: CookieOptions = {}): string {
  const attrs: string[] = [`${name}=${encodeURIComponent(value)}`];
  if (options.maxAge !== undefined) {
    attrs.push(`Max-Age=${options.maxAge}`);
  }
  attrs.push(`Path=${options.path || '/'}`);
  if (options.httpOnly) attrs.push('HttpOnly');
  if (options.secure) attrs.push('Secure');
  if (options.sameSite) attrs.push(`SameSite=${options.sameSite}`);
  return attrs.join('; ');
}
