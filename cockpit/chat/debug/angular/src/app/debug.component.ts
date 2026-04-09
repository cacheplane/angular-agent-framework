// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component } from '@angular/core';
import { ChatDebugComponent } from '@cacheplane/chat';
import { agent } from '@cacheplane/angular';
import { environment } from '../environments/environment';

/**
 * DebugComponent demonstrates the ChatDebugComponent which provides
 * a full debug panel with timeline, state inspector, and diff viewer.
 * Uses ChatDebugComponent instead of the standard ChatComponent.
 */
@Component({
  selector: 'app-debug',
  standalone: true,
  imports: [ChatDebugComponent],
  template: `
    <div class="h-screen">
      <chat-debug [ref]="stream" />
    </div>
  `,
})
export class DebugPageComponent {
  protected readonly stream = agent({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
  });
}
