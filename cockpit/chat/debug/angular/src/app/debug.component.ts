// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component } from '@angular/core';
import { ChatDebugComponent } from '@cacheplane/chat';
import { agent } from '@cacheplane/angular';
import { ExampleChatLayoutComponent } from '@cacheplane/example-layouts';
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
      <chat-debug main [ref]="stream" />
    </example-chat-layout>
  `,
})
export class DebugPageComponent {
  protected readonly stream = agent({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
  });
}
