import { Component, computed } from '@angular/core';
import { ChatComponent, views } from '@threadplane/chat';
import { ExampleChatLayoutComponent } from '@threadplane/example-layouts';
import { injectAgent } from '@threadplane/langgraph';
import { signalStateStore } from '@threadplane/render';
import { CalculatorResultComponent } from './views/calculator-result.component';
import { WordCountResultComponent } from './views/word-count-result.component';

/**
 * Represents a matched skill invocation: tool call paired with its result.
 */
interface SkillInvocation {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result: string | undefined;
}

/**
 * SkillsComponent demonstrates a multi-skill agent with specialized tools.
 *
 * The agent can calculate math expressions, count words, and summarize text
 * by selecting the appropriate skill tool for each user request.
 *
 * The sidebar displays a real-time log of skill invocations derived from
 * `stream.messages()`, matching AI tool_calls with their corresponding
 * tool result messages.
 */
@Component({
  selector: 'app-skills',
  standalone: true,
  imports: [ChatComponent, ExampleChatLayoutComponent],
  template: `
    <example-chat-layout sidebarWidth="18rem">
      <chat main [agent]="agent" [views]="ui" [store]="uiStore" class="flex-1 min-w-0" />
      <aside sidebar class="panel">
        <h3 class="cap">Skill Invocations</h3>
        @if (invocations().length === 0) {
          <p class="empty">No skills invoked yet</p>
        }
        @for (inv of invocations(); track inv.id) {
          <div class="skill-card">
            <div>
              <span class="badge">
                {{ inv.name }}
              </span>
            </div>
            <div class="kv">
              <p class="kv__label">Input</p>
              <pre class="code">{{ formatArgs(inv.args) }}</pre>
            </div>
            @if (inv.result !== undefined) {
              <div class="kv">
                <p class="kv__label kv__label--success">Output</p>
                <pre class="code">{{ inv.result }}</pre>
              </div>
            }
          </div>
        }
      </aside>
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

    .skill-card {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding: 0.75rem;
      border: 1px solid var(--tplane-chat-separator);
      border-radius: var(--tplane-chat-radius-card);
      background: var(--tplane-chat-surface-alt);
    }

    .badge {
      display: inline-flex;
      align-items: center;
      width: fit-content;
      border-radius: var(--tplane-chat-radius-launcher);
      padding: 0.125rem 0.5rem;
      background: var(--tplane-chat-primary);
      color: var(--tplane-chat-on-primary);
      font-size: var(--tplane-chat-font-size-xs);
      font-weight: 700;
    }

    .kv {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      color: var(--tplane-chat-text-muted);
      font-size: var(--tplane-chat-font-size-xs);
    }

    .kv__label {
      margin: 0;
      color: var(--tplane-chat-text);
      font-weight: 700;
    }

    .kv__label--success {
      color: var(--tplane-chat-success);
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
  `],
})
export class SkillsComponent {
  readonly ui = views({ 'calculator-result': CalculatorResultComponent, 'word-count-result': WordCountResultComponent });
  readonly uiStore = signalStateStore({});

  protected readonly agent = injectAgent();

  private readonly SKILL_NAMES = new Set(['calculator', 'word_count', 'summarize']);

  /**
   * Derived signal: extracts skill invocations from the message stream.
   *
   * Scans AI messages for tool_calls matching known skill names, then pairs
   * each with its corresponding tool result message via tool_call_id.
   */
  protected readonly invocations = computed<SkillInvocation[]>(() => {
    const msgs = this.agent.langGraphMessages();
    const resultMap = new Map<string, string>();

    // Build a lookup of tool_call_id -> result content from tool messages
    for (const msg of msgs) {
      const type = typeof msg._getType === 'function'
        ? msg._getType()
        : (msg as unknown as Record<string, string>)['type'] ?? '';
      if (type === 'tool') {
        const toolCallId = (msg as unknown as Record<string, string>)['tool_call_id'];
        const content = typeof msg.content === 'string'
          ? msg.content
          : JSON.stringify(msg.content);
        if (toolCallId) {
          resultMap.set(toolCallId, content);
        }
      }
    }

    // Extract tool_calls from AI messages that match known skill names
    const invocations: SkillInvocation[] = [];
    for (const msg of msgs) {
      const type = typeof msg._getType === 'function'
        ? msg._getType()
        : (msg as unknown as Record<string, string>)['type'] ?? '';
      if (type === 'ai') {
        const toolCalls = (msg as unknown as Record<string, unknown[]>)['tool_calls'];
        if (Array.isArray(toolCalls)) {
          for (const tc of toolCalls) {
            const call = tc as { id: string; name: string; args: Record<string, unknown> };
            if (this.SKILL_NAMES.has(call.name)) {
              invocations.push({
                id: call.id,
                name: call.name,
                args: call.args,
                result: resultMap.get(call.id),
              });
            }
          }
        }
      }
    }

    return invocations;
  });

  protected formatArgs(args: Record<string, unknown>): string {
    return JSON.stringify(args, null, 2);
  }
}
