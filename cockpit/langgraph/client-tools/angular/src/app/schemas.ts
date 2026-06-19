// SPDX-License-Identifier: MIT
/**
 * Shared Zod schemas for the client-tools demo.
 *
 * Exporting them here lets each view/ask component anchor its `ViewProps<typeof
 * schema>` type annotation directly to the schema — so a schema change is a
 * compile error on the component, not a silent runtime mismatch.
 */
import { z } from 'zod/v4';

/** Schema for the `weather_card` view tool. */
export const weatherCardSchema = z.object({
  location: z.string(),
  temperatureF: z.number(),
  conditions: z.string(),
  humidity: z.number(),
  windMph: z.number(),
});

/** Schema for the `confirm_booking` ask tool. */
export const confirmBookingSchema = z.object({ summary: z.string() });
