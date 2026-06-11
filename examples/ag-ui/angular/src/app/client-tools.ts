// SPDX-License-Identifier: MIT
import { inject } from '@angular/core';
import { tools, action, view, ask, type ClientToolRegistry } from '@threadplane/chat';
import { z } from 'zod/v4';
import { ItineraryStore } from './itinerary-store';
import { DayCardComponent } from './day-card.component';
import { ClearDayConfirmComponent } from './clear-day-confirm.component';

/** Client tools over the frontend-owned itinerary. Call inside an injection
 *  context (e.g. a field initializer in App). The descriptions are the ONLY
 *  steering the model gets — no system-prompt coaching (by design). */
export function itineraryClientTools(): ClientToolRegistry {
  const store = inject(ItineraryStore);
  return tools({
    get_itinerary: action(
      "Read the user's trip itinerary: every planned stop grouped by day (with ids).",
      z.object({}),
      async () => ({ days: store.days() }),
    ),
    add_stop: action(
      'Add a stop to a day of the trip itinerary.',
      z.object({ day: z.number().int().min(1), place: z.string(), note: z.string().optional() }),
      async ({ day, place, note }) => ({ added: store.add(day, place, note) }),
    ),
    move_stop: action(
      'Move an existing stop (matched by place name) to another day.',
      z.object({ place: z.string(), toDay: z.number().int().min(1) }),
      async ({ place, toDay }) => {
        const moved = store.move(place, toDay);
        return moved
          ? { moved }
          : { error: `No stop named "${place}" — call get_itinerary to see what exists.` };
      },
    ),
    clear_day: ask(
      'Ask the user to confirm clearing every stop on a day, then clear it if they accept.',
      z.object({ day: z.number().int().min(1) }),
      ClearDayConfirmComponent,
    ),
    day_card: view(
      "Show the user a recap card for one itinerary day after you've changed it.",
      z.object({ day: z.number().int().min(1), places: z.array(z.string()) }),
      DayCardComponent,
    ),
  });
}
