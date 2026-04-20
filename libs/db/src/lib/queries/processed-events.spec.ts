// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { markEventProcessed, deleteProcessedEvent } from './processed-events.js';
import { startTestDb, type TestDb } from './test-helpers.js';

describe('processed-events queries', () => {
  let testDb: TestDb;

  beforeAll(async () => {
    testDb = await startTestDb();
  });

  afterAll(async () => {
    await testDb.cleanup();
  });

  describe('markEventProcessed', () => {
    it('returns true on first insert of an event id', async () => {
      const result = await markEventProcessed(testDb.db, 'evt_first', 'checkout.session.completed');
      expect(result).toBe(true);
    });

    it('returns false on subsequent inserts of the same event id (idempotent)', async () => {
      await markEventProcessed(testDb.db, 'evt_dup', 'checkout.session.completed');
      const result = await markEventProcessed(testDb.db, 'evt_dup', 'checkout.session.completed');
      expect(result).toBe(false);
    });
  });

  describe('deleteProcessedEvent', () => {
    it('allows an event id to be reprocessed after deletion', async () => {
      await markEventProcessed(testDb.db, 'evt_retry', 'customer.subscription.updated');
      await deleteProcessedEvent(testDb.db, 'evt_retry');
      const result = await markEventProcessed(testDb.db, 'evt_retry', 'customer.subscription.updated');
      expect(result).toBe(true);
    });

    it('is a no-op when the event id does not exist', async () => {
      await expect(deleteProcessedEvent(testDb.db, 'evt_does_not_exist')).resolves.toBeUndefined();
    });
  });
});
