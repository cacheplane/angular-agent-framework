import { Component, computed } from '@angular/core';
import { ChatComponent, views } from '@threadplane/chat';
import { ExampleChatLayoutComponent } from '@threadplane/example-layouts';
import { injectAgent } from '@threadplane/langgraph';
import { signalStateStore } from '@threadplane/render';
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
  imports: [ChatComponent, ExampleChatLayoutComponent],
  template: `
    <example-chat-layout sidebarWidth="20rem">
      <chat main [agent]="agent" [views]="ui" [store]="uiStore" class="flex-1 min-w-0" />
      <div sidebar class="panel">
        <h3 class="cap">Execution Output</h3>
        @if (executions().length === 0) {
          <p class="empty">No code executed yet</p>
        }
        @for (exec of executions(); track exec.id) {
          <div class="exec-card">
            <div class="exec-label">Code</div>
            <pre class="code">{{ exec.code }}</pre>
            @if (exec.stdout) {
              <div class="exec-label exec-label--success">stdout</div>
              <pre class="code code--success">{{ exec.stdout }}</pre>
            }
            @if (exec.stderr) {
              <div class="exec-label exec-label--error">stderr</div>
              <pre class="code code--error">{{ exec.stderr }}</pre>
            }
          </div>
        }
      </div>
    </example-chat-layout>
  `,
  styles: [`
    .panel {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      padding: 1rem;
      background: var(--tplane-chat-bg);
      color: var(--tplane-chat-text);
    }

    .cap {
      margin: 0;
      font-size: var(--tplane-chat-font-size-xs);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--tplane-chat-text-muted);
    }

    .empty {
      margin: 0;
      font-size: var(--tplane-chat-font-size-sm);
      font-style: italic;
      color: var(--tplane-chat-text-muted);
    }

    .exec-card {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding: 0.75rem;
      border: 1px solid var(--tplane-chat-separator);
      border-radius: var(--tplane-chat-radius-card);
      background: var(--tplane-chat-surface-alt);
    }

    .exec-label {
      color: var(--tplane-chat-text-muted);
      font-size: var(--tplane-chat-font-size-xs);
      font-weight: 700;
    }

    .exec-label--success {
      color: var(--tplane-chat-success);
    }

    .exec-label--error {
      color: var(--tplane-chat-error-text);
    }

    .code {
      margin: 0;
      padding: 0.5rem;
      overflow-x: auto;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      border-radius: var(--tplane-chat-radius-card);
      background: var(--tplane-chat-surface);
      color: var(--tplane-chat-text);
      font: var(--tplane-chat-font-size-xs) / 1.5 var(--tplane-chat-font-mono);
    }

    .code--success {
      color: var(--tplane-chat-success);
    }

    .code--error {
      color: var(--tplane-chat-error-text);
    }
  `],
})
export class SandboxesComponent {
  readonly ui = views({ 'code-execution': CodeExecutionComponent });
  readonly uiStore = signalStateStore({});

  protected readonly agent = injectAgent();

  /**
   * Derived signal: extracts code executions from the message stream.
   *
   * Scans AI messages for tool_calls with name `run_code`, then pairs each
   * with its corresponding tool result message. Tool results are parsed as
   * JSON with {stdout, stderr, exit_status} fields.
   */
  protected readonly executions = computed<CodeExecution[]>(() => {
    const msgs = this.agent.langGraphMessages();
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
