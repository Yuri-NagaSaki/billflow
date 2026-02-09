import type { Env } from '../types';
import { MIGRATION_0001 } from '../migrations/0001_init';

let migrationPromise: Promise<void> | null = null;

function splitSqlStatements(sql: string) {
  return sql
    .split(';')
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

async function runStatements(env: Env) {
  const statements = splitSqlStatements(MIGRATION_0001);
  for (const statement of statements) {
    try {
      await env.DB.prepare(statement).run();
    } catch (error) {
      if (statement.toUpperCase().startsWith('PRAGMA ')) {
        continue;
      }
      throw error;
    }
  }
}

export async function ensureSchema(env: Env) {
  if (!migrationPromise) {
    migrationPromise = (async () => {
      const exec = (env.DB as unknown as { exec?: (sql: string) => Promise<void> }).exec;
      if (typeof exec === 'function') {
        try {
          await exec.call(env.DB, MIGRATION_0001);
          return;
        } catch {
          // Fall back to per-statement execution.
        }
      }
      await runStatements(env);
    })().catch((error) => {
      migrationPromise = null;
      throw error;
    });
  }
  return migrationPromise;
}
