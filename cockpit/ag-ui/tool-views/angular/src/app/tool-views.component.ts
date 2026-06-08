// SPDX-License-Identifier: MIT
import { Component } from '@angular/core';
import { ChatComponent, views } from '@threadplane/chat';
import { injectAgent } from '@threadplane/ag-ui';
import { ExampleChatLayoutComponent } from '@threadplane/example-layouts';
import { WeatherCardComponent } from './weather-card.component';

/**
 * Tool-views demo — renders a frontend component for a tool call by reusing
 * the chat composition's `views` registry. The agent calls a tool named
 * `weather_card`; the component registered under that key renders inline in
 * the transcript, live from the call's args/result/status. No UI spec is
 * sent from the backend.
 */
@Component({
  selector: 'app-tool-views',
  standalone: true,
  imports: [ChatComponent, ExampleChatLayoutComponent],
  template: `
    <example-chat-layout>
      <chat main [agent]="agent" [views]="views" class="flex-1 min-w-0" />
    </example-chat-layout>
  `,
})
export class ToolViewsComponent {
  protected readonly agent = injectAgent();
  protected readonly views = views({ weather_card: WeatherCardComponent });
}
