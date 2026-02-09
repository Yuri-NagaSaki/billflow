import type { Env } from '../types';
import { MIGRATION_0001 } from '../migrations/0001_init';

let migrationPromise: Promise<void> | null = null;

export async function ensureSchema(env: Env) {
  if (!migrationPromise) {
    migrationPromise = (env.DB as unknown as { exec: (sql: string) => Promise<void> }).exec(MIGRATION_0001)
      .catch((error) => {
        migrationPromise = null;
        throw error;
      });
  }
  return migrationPromise;
}
