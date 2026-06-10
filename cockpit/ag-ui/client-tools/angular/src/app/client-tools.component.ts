// SPDX-License-Identifier: MIT
import { Component } from '@angular/core';
import { ChatComponent, tools, action, view, ask } from '@threadplane/chat';
import { injectAgent } from '@threadplane/ag-ui';
import { ExampleChatLayoutComponent } from '@threadplane/example-layouts';
import { z } from 'zod/v4';
import { WeatherCardComponent } from './weather-card.component';
import { ConfirmBookingComponent } from './confirm-booking.component';

/**
 * Client-tools demo — tools declared in the browser that the model calls and
 * the browser executes. `get_weather` is an async FUNCTION (its return becomes
 * the result); `weather_card` is a VIEW (the model fills its props, rendered
 * inline, auto-acknowledged); `confirm_booking` is an ASK (an interactive
 * component whose emitted value becomes the result). The catalog is shipped to
 * the model via the AG-UI adapter; the backend graph binds the client stubs
 * (no server implementation) and ends the turn so the browser executes them.
 */
const clientTools = tools({
  get_weather: action(
    'Look up the current weather for a location.',
    z.object({ location: z.string() }),
    async ({ location }) => ({ location, temperatureF: 68, conditions: 'Sunny', humidity: 55, windMph: 8 }),
  ),
  weather_card: view(
    'Display a weather card for a location with the given readings.',
    z.object({
      location: z.string(),
      temperatureF: z.number(),
      conditions: z.string(),
      humidity: z.number(),
      windMph: z.number(),
    }),
    WeatherCardComponent,
  ),
  confirm_booking: ask(
    'Ask the user to confirm a booking before finalizing it.',
    z.object({ summary: z.string() }),
    ConfirmBookingComponent,
  ),
});

@Component({
  selector: 'app-client-tools',
  standalone: true,
  imports: [ChatComponent, ExampleChatLayoutComponent],
  template: `
    <example-chat-layout>
      <chat main [agent]="agent" [clientTools]="clientTools" class="flex-1 min-w-0" />
    </example-chat-layout>
  `,
})
export class ClientToolsComponent {
  protected readonly agent = injectAgent();
  protected readonly clientTools = clientTools;
}
