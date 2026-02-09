export interface Env {
  DB: D1Database;
  ASSETS?: Fetcher;
  SESSION_COOKIE_SECURE?: string;
  SESSION_COOKIE_SAMESITE?: string;
  ADMIN_USERNAME?: string;
  ADMIN_PASSWORD?: string;
  ADMIN_PASSWORD_HASH?: string;
  BASE_CURRENCY?: string;
  TELEGRAM_BOT_TOKEN?: string;
  EXCHANGE_RATE_API_KEY?: string;
}

export interface SessionUser {
  id: number;
  username: string;
  role: string;
}

export type HonoEnv = {
  Bindings: Env;
  Variables: {
    user?: SessionUser;
  };
};
