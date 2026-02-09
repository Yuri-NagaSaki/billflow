import { describe, it, expect, beforeAll } from 'vitest';
import type { ExecutionContext } from '@cloudflare/workers-types';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { DatabaseSync, StatementSync } = require('node:sqlite') as {
  DatabaseSync: any;
  StatementSync: any;
};
import worker from '../worker/src/index';

const migrationSql = fs.readFileSync(path.join(process.cwd(), 'migrations/0001_init.sql'), 'utf8');

type D1ResultMock = {
  results?: unknown[];
  success?: boolean;
  meta?: { changes?: number; last_row_id?: number };
};

class D1PreparedStatementMock {
  private params: unknown[] = [];

  constructor(private stmt: StatementSync) {}

  bind(...params: unknown[]) {
    this.params = params;
    return this;
  }

  all<T>(): D1ResultMock {
    const results = this.stmt.all(...this.params) as T[];
    return { results, success: true };
  }

  first<T>(): T | null {
    const row = this.stmt.get(...this.params) as T | undefined;
    return row ?? null;
  }

  run(): D1ResultMock {
    const info = this.stmt.run(...this.params);
    return {
      results: [],
      success: true,
      meta: {
        changes: info.changes,
        last_row_id: Number(info.lastInsertRowid)
      }
    };
  }
}

class D1DatabaseMock {
  private db: DatabaseSync;

  constructor() {
    this.db = new DatabaseSync(':memory:');
  }

  exec(sql: string) {
    this.db.exec(sql);
  }

  prepare(sql: string) {
    return new D1PreparedStatementMock(this.db.prepare(sql));
  }

  batch(statements: Array<D1PreparedStatementMock>) {
    return statements.map((statement) => statement.run());
  }
}

async function createTestEnv() {
  const db = new D1DatabaseMock();
  await db.exec(migrationSql);

  const env = {
    DB: db,
    ADMIN_PASSWORD: 'Password123',
    TELEGRAM_BOT_TOKEN: '',
    EXCHANGE_RATE_API_KEY: ''
  } as any;

  return { env };
}

function formatDate(date: Date) {
  return date.toISOString().split('T')[0];
}

async function login(env: any, ctx: ExecutionContext) {
  const loginReq = new Request('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'Password123' })
  });

  const loginRes = await worker.fetch(loginReq, env, ctx);
  expect(loginRes.status).toBe(200);
  return loginRes.headers.get('Set-Cookie') || '';
}

async function fetchJson(req: Request, env: any, ctx: any) {
  const res = await worker.fetch(req, env, ctx);
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { res, json, text };
}

describe('Billflow Worker API', () => {
  let ctx: ExecutionContext;

  beforeAll(async () => {
    ctx = {
      waitUntil: () => {},
      passThroughOnException: () => {}
    } as ExecutionContext;
  });

  it('auth login and session flow', async () => {
    const { env } = await createTestEnv();
    const setCookie = await login(env, ctx);
    expect(setCookie).toContain('sid=');

    const meReq = new Request('http://localhost/api/auth/me', {
      headers: { Cookie: setCookie || '' }
    });
    const meRes = await worker.fetch(meReq, env, ctx);
    expect(meRes.status).toBe(200);

    const logoutReq = new Request('http://localhost/api/auth/logout', {
      method: 'POST',
      headers: { Cookie: setCookie || '' }
    });
    const logoutRes = await worker.fetch(logoutReq, env, ctx);
    expect(logoutRes.status).toBe(200);
  });

  it('categories and payment methods CRUD', async () => {
    const { env } = await createTestEnv();
    const cookie = await login(env, ctx);

    const categories = await fetchJson(new Request('http://localhost/api/categories', { headers: { Cookie: cookie } }), env, ctx);
    const paymentMethods = await fetchJson(new Request('http://localhost/api/payment-methods', { headers: { Cookie: cookie } }), env, ctx);
    expect(categories.res.status).toBe(200);
    expect(paymentMethods.res.status).toBe(200);

    const createCategory = await fetchJson(
      new Request('http://localhost/api/protected/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ value: 'streaming', label: 'Streaming' })
      }),
      env,
      ctx
    );
    expect(createCategory.res.status).toBe(201);

    const updateCategory = await fetchJson(
      new Request('http://localhost/api/protected/categories/streaming', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ label: 'Streaming Services' })
      }),
      env,
      ctx
    );
    expect(updateCategory.res.status).toBe(200);

    const deleteCategory = await fetchJson(
      new Request('http://localhost/api/protected/categories/streaming', {
        method: 'DELETE',
        headers: { Cookie: cookie }
      }),
      env,
      ctx
    );
    expect(deleteCategory.res.status).toBe(200);

    const createMethod = await fetchJson(
      new Request('http://localhost/api/protected/payment-methods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ value: 'bank', label: 'Bank Transfer' })
      }),
      env,
      ctx
    );
    expect(createMethod.res.status).toBe(201);

    const updateMethod = await fetchJson(
      new Request('http://localhost/api/protected/payment-methods/bank', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ label: 'Bank Transfer (Updated)' })
      }),
      env,
      ctx
    );
    expect(updateMethod.res.status).toBe(200);

    const deleteMethod = await fetchJson(
      new Request('http://localhost/api/protected/payment-methods/bank', {
        method: 'DELETE',
        headers: { Cookie: cookie }
      }),
      env,
      ctx
    );
    expect(deleteMethod.res.status).toBe(200);
  });

  it('subscriptions CRUD and management', async () => {
    const { env } = await createTestEnv();
    const cookie = await login(env, ctx);

    const categories = await fetchJson(new Request('http://localhost/api/categories', { headers: { Cookie: cookie } }), env, ctx);
    const paymentMethods = await fetchJson(new Request('http://localhost/api/payment-methods', { headers: { Cookie: cookie } }), env, ctx);
    const categoryId = categories.json.data[0].id;
    const paymentMethodId = paymentMethods.json.data[0].id;

    const today = new Date();
    const startDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    const nextBilling = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

    const createReq = new Request('http://localhost/api/protected/subscriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        name: 'Netflix',
        plan: 'Premium',
        billing_cycle: 'monthly',
        next_billing_date: formatDate(nextBilling),
        amount: 15.99,
        currency: 'USD',
        payment_method_id: paymentMethodId,
        start_date: formatDate(startDate),
        status: 'active',
        category_id: categoryId,
        renewal_type: 'manual'
      })
    });

    const createRes = await fetchJson(createReq, env, ctx);
    expect(createRes.res.status).toBe(201);
    const subscriptionId = createRes.json.data.id;

    const listRes = await fetchJson(new Request('http://localhost/api/subscriptions', { headers: { Cookie: cookie } }), env, ctx);
    expect(listRes.res.status).toBe(200);
    expect(Array.isArray(listRes.json.data)).toBe(true);
    expect(listRes.json.data.length).toBeGreaterThan(0);

    const manualRenew = await fetchJson(
      new Request(`http://localhost/api/protected/subscriptions/${subscriptionId}/manual-renew`, {
        method: 'POST',
        headers: { Cookie: cookie }
      }),
      env,
      ctx
    );
    expect(manualRenew.res.status).toBe(200);

    const statsRes = await fetchJson(new Request('http://localhost/api/protected/subscriptions/stats', { headers: { Cookie: cookie } }), env, ctx);
    expect(statsRes.res.status).toBe(200);

    const batchRes = await fetchJson(
      new Request('http://localhost/api/protected/subscriptions/batch-process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ processAutoRenewals: true, processExpired: true, dryRun: true })
      }),
      env,
      ctx
    );
    expect(batchRes.res.status).toBe(200);
  });

  it('settings update', async () => {
    const { env } = await createTestEnv();
    const cookie = await login(env, ctx);

    const updateReq = new Request('http://localhost/api/protected/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ currency: 'USD' })
    });

    const updateRes = await fetchJson(updateReq, env, ctx);
    expect(updateRes.res.status).toBe(200);

    const settingsRes = await fetchJson(new Request('http://localhost/api/settings', { headers: { Cookie: cookie } }), env, ctx);
    expect(settingsRes.res.status).toBe(200);
    expect(settingsRes.json.data.currency).toBe('USD');
  });

  it('notifications channel configuration', async () => {
    const { env } = await createTestEnv();
    const cookie = await login(env, ctx);

    const configReq = new Request('http://localhost/api/protected/notifications/channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ channel_type: 'telegram', config: { chat_id: '123456' } })
    });
    const configRes = await fetchJson(configReq, env, ctx);
    expect(configRes.res.status).toBe(200);

    const statusRes = await fetchJson(new Request('http://localhost/api/protected/notifications/telegram/config-status', { headers: { Cookie: cookie } }), env, ctx);
    expect(statusRes.res.status).toBe(200);
    expect(statusRes.json.data.hasToken).toBe(false);
  });

  it('templates endpoints', async () => {
    const { env } = await createTestEnv();
    const cookie = await login(env, ctx);

    const languages = await fetchJson(new Request('http://localhost/api/templates/languages', { headers: { Cookie: cookie } }), env, ctx);
    expect(languages.res.status).toBe(200);
    const types = await fetchJson(new Request('http://localhost/api/templates/types', { headers: { Cookie: cookie } }), env, ctx);
    expect(types.res.status).toBe(200);
    const overview = await fetchJson(new Request('http://localhost/api/templates/overview', { headers: { Cookie: cookie } }), env, ctx);
    expect(overview.res.status).toBe(200);
  });

  it('exchange rate config status', async () => {
    const { env } = await createTestEnv();
    const cookie = await login(env, ctx);
    const result = await fetchJson(new Request('http://localhost/api/exchange-rates/config-status', { headers: { Cookie: cookie } }), env, ctx);
    expect(result.res.status).toBe(200);
    expect(result.json.exchangeRateApiConfigured).toBe(false);
  });

  it('health check requires login', async () => {
    const { env } = await createTestEnv();
    const noAuth = await fetchJson(new Request('http://localhost/api/health'), env, ctx);
    expect(noAuth.res.status).toBe(401);

    const cookie = await login(env, ctx);
    const authed = await fetchJson(new Request('http://localhost/api/health', { headers: { Cookie: cookie } }), env, ctx);
    expect(authed.res.status).toBe(200);
  });
});
