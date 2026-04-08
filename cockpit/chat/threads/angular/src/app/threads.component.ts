// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component } from '@angular/core';
import { ChatComponent, ChatThreadListComponent } from '@cacheplane/chat';
import { agent } from '@cacheplane/angular';
import { environment } from '../environments/environment';

/**
 * ThreadsComponent demonstrates multi-thread conversation management
 * with ChatComponent and ChatThreadListComponent in a sidebar.
 */
@Component({
  selector: 'app-threads',
  standalone: true,
  imports: [ChatComponent, ChatThreadListComponent],
  template: `
    <div class="flex h-screen">
      <aside class="w-64 shrink-0 border-r overflow-y-auto p-4 space-y-4"
             style="border-color: var(--chat-border, #333); background: var(--chat-bg, #171717); color: var(--chat-text, #e0e0e0);">
        <h3 class="text-xs font-semibold uppercase tracking-wide"
            style="color: var(--chat-text-muted, #777);">Threads</h3>
        <chat-thread-list [ref]="stream" />
      </aside>
      <chat [ref]="stream" class="flex-1 min-w-0" />
    </div>
  `,
})
export class ThreadsComponent {
  protected readonly stream = agent({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
  });
}
