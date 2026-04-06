// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component, computed } from '@angular/core';
import { ChatDebugComponent } from '@cacheplane/chat';
import { streamResource } from '@cacheplane/stream-resource';
import { AIMessage } from '@langchain/core/messages';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-subagents',
  standalone: true,
  imports: [ChatDebugComponent],
  template: `
    <div class="flex h-screen">
      <chat-debug [ref]="stream" class="flex-1 min-w-0" />
      <aside class="w-72 shrink-0 border-l overflow-y-auto p-4 space-y-2"
             style="border-color: var(--chat-border, #333); background: var(--chat-bg, #171717); color: var(--chat-text, #e0e0e0);">
        <h3 class="text-xs font-semibold uppercase tracking-wide mb-3"
            style="color: var(--chat-text-muted, #777);">Subagent Delegations</h3>
        @if (delegations().length === 0) {
          <p class="text-sm italic" style="color: var(--chat-text-muted, #777);">No delegations yet. Ask a question to see agent orchestration.</p>
        }
        @for (entry of delegations(); track $index) {
          <div class="flex items-center gap-2 text-sm py-1">
            <span class="shrink-0">🤖</span>
            <span class="font-mono text-xs"
                  style="color: var(--chat-text, #e0e0e0);">{{ entry.name }}</span>
          </div>
        }
      </aside>
    </div>
  `,
})
export class SubagentsComponent {
  protected readonly stream = streamResource({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
  });

  protected readonly delegations = computed(() => {
    const messages = this.stream.messages();
    const entries: { name: string }[] = [];
    for (const msg of messages) {
      if (!(msg instanceof AIMessage)) continue;
      for (const tc of this.stream.getToolCalls(msg)) {
        entries.push({ name: tc.call.name });
      }
    }
    return entries;
  });
}
