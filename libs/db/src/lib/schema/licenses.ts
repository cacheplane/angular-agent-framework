// SPDX-License-Identifier: MIT
import { pgTable, uuid, text, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const licenses = pgTable(
  'licenses',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    stripeCustomerId: text('stripe_customer_id').notNull(),
    stripeSubscriptionId: text('stripe_subscription_id').notNull().unique(),
    customerEmail: text('customer_email').notNull(),
    tier: text('tier').notNull(),
    seats: integer('seats').notNull(),
    issuedAt: timestamp('issued_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    lastToken: text('last_token').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    customerIdx: index('licenses_customer_idx').on(t.stripeCustomerId),
    emailIdx: index('licenses_email_idx').on(t.customerEmail),
  }),
);

export type License = typeof licenses.$inferSelect;
export type NewLicense = typeof licenses.$inferInsert;
