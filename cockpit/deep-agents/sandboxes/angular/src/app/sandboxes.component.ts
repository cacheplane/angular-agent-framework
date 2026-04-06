// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component, computed } from '@angular/core';
import { ChatDebugComponent } from '@cacheplane/chat';
import { streamResource } from '@cacheplane/stream-resource';
import { AIMessage } from '@langchain/core/messages';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-sandboxes',
  standalone: true,
  imports: [ChatDebugComponent],
  template: `
    <div class="flex h-screen">
      <chat-debug [ref]="stream" class="flex-1 min-w-0" />
      <aside class="w-72 shrink-0 border-l overflow-y-auto p-4 space-y-3"
             style="border-color: var(--chat-border, #333); background: var(--chat-bg, #171717); color: var(--chat-text, #e0e0e0);">
        <h3 class="text-xs font-semibold uppercase tracking-wide mb-3"
            style="color: var(--chat-text-muted, #777);">Code Executions</h3>
        @if (execLogs().length === 0) {
          <p class="text-sm italic" style="color: var(--chat-text-muted, #777);">No code executions yet. Ask the agent to write and run code.</p>
        }
        @for (log of execLogs(); track $index) {
          <div class="text-xs space-y-1 pb-2"
               style="border-bottom: 1px solid var(--chat-border, #333);">
            <div class="flex items-center gap-2">
              <span class="px-1.5 py-0.5 rounded text-xs font-mono font-semibold"
                    [style.background]="log.exitStatus === 0 ? 'var(--chat-accent, #4ade80)' : 'var(--chat-error-text, #ef4444)'"
                    style="color: #000;">
                exit {{ log.exitStatus }}
              </span>
            </div>
            @if (log.code) {
              <pre class="font-mono text-xs truncate"
                   style="color: var(--chat-text-muted, #777);">{{ log.code }}</pre>
            }
            @if (log.stdout) {
              <pre class="font-mono text-xs whitespace-pre-wrap break-all"
                   style="color: var(--chat-text, #e0e0e0);">{{ log.stdout }}</pre>
            }
          </div>
        }
      </aside>
    </div>
  `,
})
export class SandboxesComponent {
  protected readonly stream = streamResource({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
  });

  protected readonly execLogs = computed(() => {
    const messages = this.stream.messages();
    const logs: { code: string; stdout: string; exitStatus: number }[] = [];
    for (const msg of messages) {
      if (!(msg instanceof AIMessage)) continue;
      for (const tc of this.stream.getToolCalls(msg)) {
        if (tc.call.name === 'run_code') {
          const resultIdx = messages.indexOf(msg) + 1;
          const resultMsg = messages[resultIdx];
          let stdout = '', exitStatus = 0;
          if (resultMsg && typeof resultMsg.content === 'string') {
            try {
              const parsed = JSON.parse(resultMsg.content);
              stdout = parsed.stdout ?? '';
              exitStatus = parsed.exit_status ?? 0;
            } catch { /* ignore */ }
          }
          logs.push({ code: (tc.call.args as Record<string, string>)?.['code'] ?? '', stdout, exitStatus });
        }
      }
    }
    return logs;
  });
}
