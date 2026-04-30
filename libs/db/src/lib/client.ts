// SPDX-License-Identifier: MIT
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';

export type Db = ReturnType<typeof drizzle<typeof schema>> & {
  close: () => Promise<void>;
};

/**
 * Create a Drizzle client bound to the given Postgres connection string.
 * Caller is responsible for calling `close()` during shutdown.
 */
export function createDb(connectionString: string): Db {
  if (!connectionString) {
    throw new Error('createDb: connection string is required');
  }
  // prepare: false — required by Vercel Postgres / PgBouncer transaction pooling.
  const sql = postgres(connectionString, { prepare: false });
  const db = drizzle(sql, { schema }) as Db;
  db.close = () => sql.end();
  return db;
}
