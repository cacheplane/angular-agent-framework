// SPDX-License-Identifier: MIT
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const processedEvents = pgTable('processed_events', {
  stripeEventId: text('stripe_event_id').primaryKey(),
  eventType: text('event_type').notNull(),
  processedAt: timestamp('processed_at', { withTimezone: true }).notNull().defaultNow(),
});

export type ProcessedEvent = typeof processedEvents.$inferSelect;
export type NewProcessedEvent = typeof processedEvents.$inferInsert;
