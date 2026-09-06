import { Pool } from 'pg';
export interface ClaimStatus {
  attemptId: string;
  expiresAt: string;
  settledAt: string | null;
}
export interface ClaimStore {
  rejectExpired(attemptId: string, expiresAt: string): Promise<void>;
  acquire(attemptId: string, expiresAt: string): Promise<boolean>;
  settle(attemptId: string): Promise<void>;
  get(attemptId: string): Promise<ClaimStatus | null>;
}
// Opaque single-use execution fence, never evidence or contact data. No TTL
// deletion: removing a claim could authorize a delayed worker replay.
export const claimSchemaSql = `CREATE TABLE IF NOT EXISTS growth_research_execution_claims (
  attempt_id uuid PRIMARY KEY,
  expires_at timestamptz NOT NULL,
  settled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
)`;
export function createClaimStore(
  connectionString?: string
): ClaimStore & { initialize(): Promise<void>; close(): Promise<void> } {
  let pool: Pool | undefined;
  const db = () => {
    const url = connectionString ?? process.env['DAWN_DATABASE_URL'];
    if (!url) throw new Error('research_database_required');
    return (pool ??= new Pool({
      connectionString: url,
      max: 3,
      connectionTimeoutMillis: 5000,
      statement_timeout: 5000,
    }));
  };
  return {
    async rejectExpired(attemptId, expiresAt) {
      // Record a known non-execution atomically. Never settle or overwrite an
      // existing invocation: an expired replay may race its original writer.
      await db().query(
        `INSERT INTO growth_research_execution_claims (attempt_id, expires_at, settled_at)
         SELECT $1, $2, now() WHERE $2::timestamptz <= now()
         ON CONFLICT DO NOTHING`,
        [attemptId, expiresAt]
      );
    },
    async initialize() {
      await db().query(claimSchemaSql);
    },
    async acquire(attemptId, expiresAt) {
      const result = await db().query(
        'INSERT INTO growth_research_execution_claims (attempt_id, expires_at) SELECT $1, $2 WHERE $2::timestamptz > now() ON CONFLICT DO NOTHING RETURNING attempt_id',
        [attemptId, expiresAt]
      );
      return result.rowCount === 1;
    },
    async settle(attemptId) {
      const result = await db().query(
        'UPDATE growth_research_execution_claims SET settled_at = COALESCE(settled_at, now()) WHERE attempt_id = $1 RETURNING attempt_id',
        [attemptId]
      );
      if (result.rowCount !== 1) throw new Error('claim_missing');
    },
    async get(attemptId) {
      const result = await db().query(
        'SELECT attempt_id, expires_at, settled_at FROM growth_research_execution_claims WHERE attempt_id = $1',
        [attemptId]
      );
      const row = result.rows[0];
      return row
        ? {
            attemptId: row.attempt_id,
            expiresAt: new Date(row.expires_at).toISOString(),
            settledAt: row.settled_at
              ? new Date(row.settled_at).toISOString()
              : null,
          }
        : null;
    },
    async close() {
      await pool?.end();
      pool = undefined;
    },
  };
}
