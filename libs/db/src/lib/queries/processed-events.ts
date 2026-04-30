// SPDX-License-Identifier: MIT
import { eq } from 'drizzle-orm';
import type { Db } from '../client.js';
import { processedEvents } from '../schema/processed-events.js';

/**
 * Insert an event id. Returns `true` if this was the first time we saw it,
 * `false` if it was already recorded (Stripe retry).
 */
export async function markEventProcessed(
  db: Db,
  stripeEventId: string,
  eventType: string,
): Promise<boolean> {
  const rows = await db
    .insert(processedEvents)
    .values({ stripeEventId, eventType })
    .onConflictDoNothing({ target: processedEvents.stripeEventId })
    .returning({ id: processedEvents.stripeEventId });
  return rows.length > 0;
}

/**
 * Remove a processed-event marker. Used for compensating deletes when a
 * handler fails after the marker was written.
 */
export async function deleteProcessedEvent(db: Db, stripeEventId: string): Promise<void> {
  await db.delete(processedEvents).where(eq(processedEvents.stripeEventId, stripeEventId));
}
