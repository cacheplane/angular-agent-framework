// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { eq, sql } from 'drizzle-orm';
import type { Db } from '../client.js';
import { licenses, type License, type NewLicense } from '../schema/licenses.js';

export type UpsertLicenseInput = Omit<NewLicense, 'id' | 'createdAt' | 'updatedAt' | 'issuedAt'> & {
  id?: string;
};

/**
 * Insert a license or update the existing row keyed on stripe_subscription_id.
 * Bumps issued_at and updated_at on every call.
 */
export async function upsertLicense(db: Db, input: UpsertLicenseInput): Promise<License> {
  const now = new Date();
  const rows = await db
    .insert(licenses)
    .values({ ...input, issuedAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: licenses.stripeSubscriptionId,
      set: {
        customerEmail: input.customerEmail,
        tier: input.tier,
        seats: input.seats,
        expiresAt: input.expiresAt,
        lastToken: input.lastToken,
        issuedAt: now,
        updatedAt: now,
      },
    })
    .returning();
  return rows[0];
}

export async function getLicense(db: Db, stripeSubscriptionId: string): Promise<License | null> {
  const rows = await db
    .select()
    .from(licenses)
    .where(eq(licenses.stripeSubscriptionId, stripeSubscriptionId))
    .limit(1);
  return rows[0] ?? null;
}

export async function getLicensesByCustomerEmail(db: Db, email: string): Promise<License[]> {
  return db.select().from(licenses).where(eq(licenses.customerEmail, email));
}

export async function revokeLicense(db: Db, stripeSubscriptionId: string): Promise<License | null> {
  const rows = await db
    .update(licenses)
    .set({ revokedAt: sql`now()`, updatedAt: sql`now()` })
    .where(eq(licenses.stripeSubscriptionId, stripeSubscriptionId))
    .returning();
  return rows[0] ?? null;
}

export async function updateLicenseToken(db: Db, id: string, token: string): Promise<License> {
  const rows = await db
    .update(licenses)
    .set({ lastToken: token, issuedAt: sql`now()`, updatedAt: sql`now()` })
    .where(eq(licenses.id, id))
    .returning();
  if (!rows[0]) throw new Error(`updateLicenseToken: no license with id=${id}`);
  return rows[0];
}
