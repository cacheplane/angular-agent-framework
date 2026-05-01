// SPDX-License-Identifier: MIT
import { Component } from '@angular/core';
import { ChatDebugComponent } from '@ngaf/chat';
import { agent, toAgent } from '@ngaf/langgraph';
import { ExampleChatLayoutComponent } from '@ngaf/example-layouts';
import { environment } from '../environments/environment';

/**
 * DebugComponent demonstrates the ChatDebugComponent which provides
 * a full debug panel with timeline, state inspector, and diff viewer.
 * Uses ChatDebugComponent instead of the standard ChatComponent.
 */
@Component({
  selector: 'app-debug',
  standalone: true,
  imports: [ChatDebugComponent, ExampleChatLayoutComponent],
  template: `
    <example-chat-layout>
      <chat-debug main [agent]="chatAgent" />
    </example-chat-layout>
  `,
})
export class DebugPageComponent {
  protected readonly stream = agent({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
  });
  protected readonly chatAgent = toAgent(this.stream);
}
