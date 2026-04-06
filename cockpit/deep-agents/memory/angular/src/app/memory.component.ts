// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component, computed } from '@angular/core';
import { ChatDebugComponent } from '@cacheplane/chat';
import { streamResource } from '@cacheplane/stream-resource';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-da-memory',
  standalone: true,
  imports: [ChatDebugComponent],
  template: `
    <div class="flex h-screen">
      <chat-debug [ref]="stream" class="flex-1 min-w-0" />
      @if (memoryEntries().length > 0) {
        <aside class="w-72 shrink-0 border-l overflow-y-auto p-4 space-y-2"
               style="border-color: var(--chat-border, #333); background: var(--chat-bg, #171717); color: var(--chat-text, #e0e0e0);">
          <h3 class="text-xs font-semibold uppercase tracking-wide mb-3"
              style="color: var(--chat-text-muted, #777);">Agent Memory</h3>
          @for (entry of memoryEntries(); track $index) {
            <div class="text-sm py-1">
              <span class="font-semibold" style="color: var(--chat-text-muted, #777);">{{ entry[0] }}:</span>
              <span class="ml-1" style="color: var(--chat-text, #e0e0e0);">{{ entry[1] }}</span>
            </div>
          }
        </aside>
      }
    </div>
  `,
})
export class MemoryComponent {
  protected readonly stream = streamResource({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
  });

  protected readonly memoryEntries = computed(() => {
    const val = this.stream.value() as Record<string, unknown>;
    const mem = val?.['agent_memory'];
    if (!mem || typeof mem !== 'object') return [];
    return Object.entries(mem as Record<string, string>);
  });
}
