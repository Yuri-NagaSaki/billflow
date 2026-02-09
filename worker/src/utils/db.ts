import type { D1Database, D1Result, D1PreparedStatement } from '@cloudflare/workers-types';

export async function dbAll<T>(db: D1Database, sql: string, params: unknown[] = []): Promise<T[]> {
  const result = await db.prepare(sql).bind(...params).all<T>();
  return result.results || [];
}

export async function dbFirst<T>(db: D1Database, sql: string, params: unknown[] = []): Promise<T | null> {
  const result = await db.prepare(sql).bind(...params).first<T>();
  return result ?? null;
}

export async function dbRun(db: D1Database, sql: string, params: unknown[] = []): Promise<D1Result> {
  return db.prepare(sql).bind(...params).run();
}

export async function dbBatch(db: D1Database, statements: Array<{ sql: string; params?: unknown[] }>): Promise<D1Result[]> {
  const prepared: D1PreparedStatement[] = statements.map((stmt) =>
    db.prepare(stmt.sql).bind(...(stmt.params || []))
  );
  return db.batch(prepared);
}

export function normalizeResult(result: D1Result): { changes: number; lastInsertRowid: number | null } {
  const meta = result.meta || { changes: 0 };
  const lastInsertRowid = typeof meta.last_row_id === 'number' ? meta.last_row_id : null;
  return { changes: meta.changes || 0, lastInsertRowid };
}
