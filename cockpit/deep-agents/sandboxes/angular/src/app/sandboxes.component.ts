import { Component, computed } from '@angular/core';
import { ChatComponent, views } from '@cacheplane/chat';
import { signalStateStore } from '@cacheplane/render';
import { agent } from '@cacheplane/angular';
import { environment } from '../environments/environment';
import { CodeExecutionComponent } from './views/code-execution.component';

/**
 * Represents a parsed code execution: the code that was run and its output.
 */
interface CodeExecution {
  id: string;
  code: string;
  stdout: string;
  stderr: string;
  exitStatus: number;
}

/**
 * SandboxesComponent demonstrates a coding agent that executes Python code.
 *
 * The agent writes and runs code snippets to solve problems using a
 * `run_code` tool. The sidebar displays a real-time log of code executions
 * derived from `stream.messages()`, showing the code, stdout, and stderr
 * for each invocation.
 */
@Component({
  selector: 'app-sandboxes',
  standalone: true,
  imports: [ChatComponent],
  template: `
    <div class="flex h-screen">
      <chat [ref]="stream" [views]="ui" [store]="uiStore" class="flex-1 min-w-0" />
      <aside class="w-80 shrink-0 border-l overflow-y-auto p-4 space-y-3"
             style="border-color: var(--chat-border, #333); background: var(--chat-bg, #171717); color: var(--chat-text, #e0e0e0);">
        <h3 class="text-xs font-semibold uppercase tracking-wide"
            style="color: var(--chat-text-muted, #777);">Execution Output</h3>
        @if (executions().length === 0) {
          <p class="text-sm italic" style="color: var(--chat-text-muted, #777);">No code executed yet</p>
        }
        @for (exec of executions(); track exec.id) {
          <div class="rounded-lg p-3 space-y-2"
               style="background: var(--chat-input-bg, #262626); border: 1px solid var(--chat-border, #333);">
            <div class="text-xs font-semibold" style="color: var(--chat-text-muted, #777);">Code</div>
            <pre class="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed p-2 rounded overflow-x-auto"
                 style="background: var(--chat-bg, #171717); color: var(--chat-text, #e0e0e0);">{{ exec.code }}</pre>
            @if (exec.stdout) {
              <div class="text-xs font-semibold" style="color: var(--chat-success, #4ade80);">stdout</div>
              <pre class="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed p-2 rounded"
                   style="background: var(--chat-bg, #171717); color: var(--chat-success, #4ade80);">{{ exec.stdout }}</pre>
            }
            @if (exec.stderr) {
              <div class="text-xs font-semibold" style="color: var(--chat-error-text, #f87171);">stderr</div>
              <pre class="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed p-2 rounded"
                   style="background: var(--chat-bg, #171717); color: var(--chat-error-text, #f87171);">{{ exec.stderr }}</pre>
            }
          </div>
        }
      </aside>
    </div>
  `,
})
export class SandboxesComponent {
  protected readonly stream = agent({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
  });

  readonly ui = views({
    'code-execution': CodeExecutionComponent,
  });

  readonly uiStore = signalStateStore({});

  /**
   * Derived signal: extracts code executions from the message stream.
   *
   * Scans AI messages for tool_calls with name `run_code`, then pairs each
   * with its corresponding tool result message. Tool results are parsed as
   * JSON with {stdout, stderr, exit_status} fields.
   */
  protected readonly executions = computed<CodeExecution[]>(() => {
    const msgs = this.stream.messages();
    const resultMap = new Map<string, { stdout: string; stderr: string; exitStatus: number }>();

    // Build a lookup of tool_call_id -> parsed result from tool messages
    for (const msg of msgs) {
      const type = typeof msg._getType === 'function'
        ? msg._getType()
        : (msg as unknown as Record<string, string>)['type'] ?? '';
      if (type === 'tool') {
        const toolCallId = (msg as unknown as Record<string, string>)['tool_call_id'];
        if (toolCallId) {
          const raw = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
          try {
            const parsed = JSON.parse(raw);
            resultMap.set(toolCallId, {
              stdout: parsed.stdout ?? '',
              stderr: parsed.stderr ?? '',
              exitStatus: parsed.exit_status ?? 0,
            });
          } catch {
            resultMap.set(toolCallId, { stdout: raw, stderr: '', exitStatus: 0 });
          }
        }
      }
    }

    // Extract run_code tool_calls from AI messages
    const executions: CodeExecution[] = [];
    for (const msg of msgs) {
      const type = typeof msg._getType === 'function'
        ? msg._getType()
        : (msg as unknown as Record<string, string>)['type'] ?? '';
      if (type === 'ai') {
        const toolCalls = (msg as unknown as Record<string, unknown[]>)['tool_calls'];
        if (Array.isArray(toolCalls)) {
          for (const tc of toolCalls) {
            const call = tc as { id: string; name: string; args: Record<string, unknown> };
            if (call.name === 'run_code') {
              const result = resultMap.get(call.id);
              executions.push({
                id: call.id,
                code: (call.args['code'] as string) ?? '',
                stdout: result?.stdout ?? '',
                stderr: result?.stderr ?? '',
                exitStatus: result?.exitStatus ?? 0,
              });
            }
          }
        }
      }
    }

    return executions;
  });
}
