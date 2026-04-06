// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component, computed } from '@angular/core';
import { ChatDebugComponent } from '@cacheplane/chat';
import { streamResource } from '@cacheplane/stream-resource';
import { AIMessage } from '@langchain/core/messages';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-filesystem',
  standalone: true,
  imports: [ChatDebugComponent],
  template: `
    <div class="flex h-screen">
      <chat-debug [ref]="stream" class="flex-1 min-w-0" />
      <aside class="w-72 shrink-0 border-l overflow-y-auto p-4 space-y-2"
             style="border-color: var(--chat-border, #333); background: var(--chat-bg, #171717); color: var(--chat-text, #e0e0e0);">
        <h3 class="text-xs font-semibold uppercase tracking-wide mb-3"
            style="color: var(--chat-text-muted, #777);">File Operations</h3>
        @if (fileOps().length === 0) {
          <p class="text-sm italic" style="color: var(--chat-text-muted, #777);">No file operations yet. Ask the agent to read or write a file.</p>
        }
        @for (op of fileOps(); track $index) {
          <div class="flex items-start gap-2 text-sm py-1">
            <span class="shrink-0">{{ op.name === 'read_file' ? '📖' : '✏️' }}</span>
            <span class="font-mono text-xs break-all"
                  style="color: var(--chat-text, #e0e0e0);">{{ op.path }}</span>
          </div>
        }
      </aside>
    </div>
  `,
})
export class FilesystemComponent {
  protected readonly stream = streamResource({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
  });

  protected readonly fileOps = computed(() => {
    const messages = this.stream.messages();
    const ops: { name: string; path: string }[] = [];
    for (const msg of messages) {
      if (!(msg instanceof AIMessage)) continue;
      for (const tc of this.stream.getToolCalls(msg)) {
        if (tc.call.name === 'read_file' || tc.call.name === 'write_file') {
          ops.push({ name: tc.call.name, path: (tc.call.args as Record<string, string>)?.['path'] ?? '' });
        }
      }
    }
    return ops;
  });
}
