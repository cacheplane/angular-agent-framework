// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component } from '@angular/core';
import { ChatComponent, ChatGenerativeUiComponent } from '@cacheplane/chat';
import { agent } from '@cacheplane/angular';
import { environment } from '../environments/environment';

/**
 * GenerativeUiComponent demonstrates dynamic UI generation within
 * chat messages using ChatComponent and ChatGenerativeUiComponent.
 * The agent embeds render specs that are rendered as live components.
 */
@Component({
  selector: 'app-generative-ui',
  standalone: true,
  imports: [ChatComponent, ChatGenerativeUiComponent],
  template: `
    <div class="flex h-screen">
      <chat [ref]="stream" class="flex-1 min-w-0" />
      <aside class="w-80 shrink-0 border-l overflow-y-auto p-4 space-y-4"
             style="border-color: var(--chat-border, #333); background: var(--chat-bg, #171717); color: var(--chat-text, #e0e0e0);">
        <h3 class="text-xs font-semibold uppercase tracking-wide"
            style="color: var(--chat-text-muted, #777);">Generative UI</h3>
        <chat-generative-ui [ref]="stream" />
        <div class="mt-4">
          <h4 class="text-xs font-semibold uppercase tracking-wide mb-2"
              style="color: var(--chat-text-muted, #777);">How It Works</h4>
          <p class="text-xs" style="color: var(--chat-text-muted, #777);">
            The agent embeds JSON render specs in chat messages.
            These specs are detected and rendered as live Angular
            components using the render registry.
          </p>
        </div>
      </aside>
    </div>
  `,
})
export class GenerativeUiComponent {
  protected readonly stream = agent({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
  });
}
