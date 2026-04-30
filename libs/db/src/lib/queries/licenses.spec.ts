// SPDX-License-Identifier: MIT
import {
  upsertLicense,
  getLicense,
  getLicensesByCustomerEmail,
  revokeLicense,
  updateLicenseToken,
} from './licenses.js';
import { startTestDb, type TestDb } from './test-helpers.js';

const base = {
  stripeCustomerId: 'cus_1',
  stripeSubscriptionId: 'sub_1',
  customerEmail: 'a@example.com',
  tier: 'developer-seat' as const,
  seats: 3,
  expiresAt: new Date('2027-01-01T00:00:00Z'),
  lastToken: 'token-v1',
};

describe('licenses queries', () => {
  let testDb: TestDb;

  beforeAll(async () => {
    testDb = await startTestDb();
  });

  afterAll(async () => {
    await testDb.cleanup();
  });

  describe('upsertLicense', () => {
    it('inserts a new row keyed on stripe_subscription_id', async () => {
      const row = await upsertLicense(testDb.db, { ...base, stripeSubscriptionId: 'sub_insert' });
      expect(row.stripeSubscriptionId).toBe('sub_insert');
      expect(row.seats).toBe(3);
      expect(row.id).toBeDefined();
    });

    it('updates an existing row on repeat sub id', async () => {
      await upsertLicense(testDb.db, { ...base, stripeSubscriptionId: 'sub_update', seats: 2 });
      const updated = await upsertLicense(testDb.db, {
        ...base,
        stripeSubscriptionId: 'sub_update',
        seats: 7,
        lastToken: 'token-v2',
      });
      expect(updated.seats).toBe(7);
      expect(updated.lastToken).toBe('token-v2');
    });
  });

  describe('getLicense', () => {
    it('returns the row when present', async () => {
      await upsertLicense(testDb.db, { ...base, stripeSubscriptionId: 'sub_get' });
      const found = await getLicense(testDb.db, 'sub_get');
      expect(found?.stripeSubscriptionId).toBe('sub_get');
    });

    it('returns null when not found', async () => {
      const found = await getLicense(testDb.db, 'sub_missing');
      expect(found).toBeNull();
    });
  });

  describe('getLicensesByCustomerEmail', () => {
    it('returns all rows matching the email', async () => {
      await upsertLicense(testDb.db, { ...base, stripeSubscriptionId: 'sub_e1', customerEmail: 'multi@example.com' });
      await upsertLicense(testDb.db, { ...base, stripeSubscriptionId: 'sub_e2', customerEmail: 'multi@example.com' });
      const rows = await getLicensesByCustomerEmail(testDb.db, 'multi@example.com');
      expect(rows.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('revokeLicense', () => {
    it('sets revoked_at to now', async () => {
      await upsertLicense(testDb.db, { ...base, stripeSubscriptionId: 'sub_revoke' });
      const revoked = await revokeLicense(testDb.db, 'sub_revoke');
      expect(revoked?.revokedAt).toBeInstanceOf(Date);
    });

    it('returns null for unknown subscription', async () => {
      const result = await revokeLicense(testDb.db, 'sub_missing_revoke');
      expect(result).toBeNull();
    });
  });

  describe('updateLicenseToken', () => {
    it('replaces last_token and bumps issued_at', async () => {
      const inserted = await upsertLicense(testDb.db, { ...base, stripeSubscriptionId: 'sub_token' });
      const before = inserted.issuedAt;
      await new Promise((r) => setTimeout(r, 10));
      const updated = await updateLicenseToken(testDb.db, inserted.id, 'token-v99');
      expect(updated.lastToken).toBe('token-v99');
      expect(updated.issuedAt.getTime()).toBeGreaterThan(before.getTime());
    });
  });
});
