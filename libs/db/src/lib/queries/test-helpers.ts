// SPDX-License-Identifier: MIT
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import * as path from 'node:path';
import * as schema from '../schema/index.js';

export interface TestDb {
  db: ReturnType<typeof drizzle<typeof schema>>;
  cleanup: () => Promise<void>;
}

/**
 * Spin up a disposable Postgres container, run migrations, and return a
 * Drizzle client plus a cleanup function. Call `cleanup` in afterAll.
 */
export async function startTestDb(): Promise<TestDb> {
  // Ryuk (the reaper container) sometimes hangs on macOS; cleanup() handles teardown.
  process.env['TESTCONTAINERS_RYUK_DISABLED'] = 'true';
  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer('postgres:16-alpine').start();
  const sql = postgres(container.getConnectionUri(), { prepare: false });
  const db = drizzle(sql, { schema });

  const migrationsFolder = path.resolve(__dirname, '../../../drizzle');
  await migrate(db, { migrationsFolder });

  return {
    db,
    cleanup: async () => {
      await sql.end();
      await container.stop();
    },
  };
}
