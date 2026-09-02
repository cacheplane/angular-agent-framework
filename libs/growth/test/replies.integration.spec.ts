import { randomUUID } from 'node:crypto';

import {
  createDatabaseExecutor,
  GoogleReplyReplayError,
  parseGoogleMailboxEvent,
  processGoogleMailboxEvent,
  sha256Base64Url,
  type SqlExecutor,
} from '../src/index.ts';

const testDatabaseUrl = process.env['TEST_DATABASE_URL'];
const databaseIntegrationEnabled =
  process.env['GROWTH_INTEGRATION'] === '1' && Boolean(testDatabaseUrl);

if (!databaseIntegrationEnabled || !testDatabaseUrl) {
  throw new Error(
    'GROWTH_INTEGRATION=1 and TEST_DATABASE_URL are required for integration tests'
  );
}

describe('Google reply nonce real-database rollback boundary', () => {
  it('keeps the nonce claimed when the later database transaction rolls back', async () => {
    const now = new Date('2026-09-01T12:00:00.000Z');
    const jobId = '00000000-0000-4000-8000-000000000001';
    const raw = JSON.stringify({
      kind: 'seed',
      version: 1,
      gmail_message_id: '18cafe123abc',
      rfc_message_id: '<seed.1@threadplane.ai>',
      occurred_at: now.toISOString(),
      from: 'Brian at Threadplane <brian@threadplane.ai>',
      verification: 'gmail_auth_aligned',
      x_threadplane_job_id: jobId,
    });
    const integrationNonce = `nonce_${randomUUID()}`;
    const database = createDatabaseExecutor(testDatabaseUrl);
    const input = {
      event: parseGoogleMailboxEvent(raw),
      nonce: integrationNonce,
      timestamp: String(now.getTime()),
      requestDigest: sha256Base64Url(raw),
      receivedAt: now,
    };
    const rollbackExecutor: SqlExecutor = {
      execute: database.execute,
      transaction: (operation) =>
        database.transaction((transaction) =>
          operation({
            execute: (sql, parameters) => {
              if (sql.includes('growth:insert-google-mailbox-event')) {
                throw new Error('forced downstream rollback');
              }
              return transaction.execute(sql, parameters);
            },
          })
        ),
    };
    try {
      await expect(
        processGoogleMailboxEvent(rollbackExecutor, input)
      ).rejects.toThrow('forced downstream rollback');
      await expect(
        processGoogleMailboxEvent(rollbackExecutor, input)
      ).rejects.toBeInstanceOf(GoogleReplyReplayError);
    } finally {
      await database.execute(
        `delete from growth_activity where event_key = $1`,
        [`google:nonce:${sha256Base64Url(integrationNonce)}`]
      );
      await database.close?.();
    }
  });
});
