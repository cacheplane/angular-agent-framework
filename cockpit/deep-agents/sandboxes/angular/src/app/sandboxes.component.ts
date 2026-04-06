import { Component, computed } from '@angular/core';
import { LegacyChatComponent } from '@cacheplane/chat';
import { streamResource } from '@cacheplane/stream-resource';
import { environment } from '../environments/environment';

interface ExecutionLog {
  code: string;
  stdout: string;
  exitStatus: number;
}

/**
 * SandboxesComponent demonstrates a coding agent that executes Python code.
 *
 * The agent writes and runs code snippets to solve problems using a
 * `run_code` tool. The sidebar shows execution logs — code input, stdout
 * output, and exit status — for each sandbox execution.
 *
 * Key integration points:
 * - `stream.messages()` contains all messages including tool call results
 * - `computed()` derives execution log entries from tool calls in AI messages
 * - Logs update reactively as the agent writes and runs code
 */
@Component({
  selector: 'app-sandboxes',
  standalone: true,
  imports: [LegacyChatComponent],
  template: `
    <cp-chat
      [messages]="stream.messages()"
      [isLoading]="stream.isLoading()"
      [error]="stream.error()"
      (sendMessage)="send($event)">
      <ng-template #sidebar>
        <h3 style="font-size: 0.8rem; font-weight: 600; margin-bottom: 0.75rem; color: #1a1a2e;">Execution Logs</h3>
        @for (log of executionLogs(); track $index) {
          <div style="padding: 8px; margin-bottom: 8px; border: 1px solid #e5e7eb; border-radius: 6px; font-size: 0.8rem;">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
              <span style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 600; font-family: monospace;"
                    [style.background]="log.exitStatus === 0 ? '#d1fae5' : '#fee2e2'"
                    [style.color]="log.exitStatus === 0 ? '#065f46' : '#991b1b'">
                exit {{ log.exitStatus }}
              </span>
            </div>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 6px; margin-bottom: 6px; font-family: monospace; font-size: 0.75rem; color: #1a1a2e; white-space: pre-wrap; word-break: break-all;">{{ log.code }}</div>
            @if (log.stdout) {
              <div style="font-size: 0.7rem; font-weight: 600; color: #6b7280; margin-bottom: 2px; text-transform: uppercase; letter-spacing: 0.04em;">stdout</div>
              <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 4px; padding: 6px; font-family: monospace; font-size: 0.75rem; color: #166534; white-space: pre-wrap; word-break: break-all;">{{ log.stdout }}</div>
            }
          </div>
        }
        @empty {
          <p style="color: #8b8fa3; font-size: 0.8rem;">Ask the agent to write and run Python code.</p>
        }
      </ng-template>
    </cp-chat>
  `,
})
export class SandboxesComponent {
  protected readonly stream = streamResource({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
  });

  executionLogs = computed(() => {
    const msgs = this.stream.messages();
    const logs: ExecutionLog[] = [];
    for (const m of msgs) {
      if ((m as any).tool_calls) {
        for (const tc of (m as any).tool_calls) {
          if (tc.name === 'run_code' && tc.output) {
            try {
              const parsed = JSON.parse(tc.output);
              logs.push({
                code: tc.args?.code ?? '',
                stdout: parsed.stdout ?? '',
                exitStatus: parsed.exit_status ?? 0,
              });
            } catch {
              logs.push({
                code: tc.args?.code ?? '',
                stdout: tc.output,
                exitStatus: 0,
              });
            }
          }
        }
      }
    }
    return logs;
  });

  send(text: string): void {
    this.stream.submit({ messages: [{ role: 'human', content: text }] });
  }
}
