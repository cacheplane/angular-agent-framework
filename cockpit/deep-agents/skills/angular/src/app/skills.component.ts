import { Component, computed } from '@angular/core';
import { ChatComponent, views } from '@cacheplane/chat';
import { ExampleChatLayoutComponent } from '@cacheplane/example-layouts';
import { agent } from '@cacheplane/angular';
import { signalStateStore } from '@cacheplane/render';
import { environment } from '../environments/environment';
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
    <example-chat-layout sidebarWidth="w-72">
      <chat main [ref]="stream" [views]="ui" [store]="uiStore" class="flex-1 min-w-0" />
      <div sidebar class="p-4 space-y-3" style="background: var(--chat-bg, #171717); color: var(--chat-text, #e0e0e0);">
        <h3 class="text-xs font-semibold uppercase tracking-wide"
            style="color: var(--chat-text-muted, #777);">Skill Invocations</h3>
        @if (invocations().length === 0) {
          <p class="text-sm italic" style="color: var(--chat-text-muted, #777);">No skills invoked yet</p>
        }
        @for (inv of invocations(); track inv.id) {
          <div class="rounded-lg p-3 space-y-2"
               style="background: var(--chat-input-bg, #262626); border: 1px solid var(--chat-border, #333);">
            <div class="flex items-center gap-2">
              <span class="inline-block rounded-full px-2 py-0.5 text-xs font-semibold"
                    style="background: var(--chat-accent, #6d28d9); color: #fff;">
                {{ inv.name }}
              </span>
            </div>
            <div class="text-xs space-y-1" style="color: var(--chat-text-muted, #777);">
              <p class="font-semibold" style="color: var(--chat-text, #e0e0e0);">Input</p>
              <pre class="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed p-1.5 rounded"
                   style="background: var(--chat-bg, #171717);">{{ formatArgs(inv.args) }}</pre>
            </div>
            @if (inv.result !== undefined) {
              <div class="text-xs space-y-1" style="color: var(--chat-text-muted, #777);">
                <p class="font-semibold" style="color: var(--chat-success, #4ade80);">Output</p>
                <pre class="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed p-1.5 rounded"
                     style="background: var(--chat-bg, #171717);">{{ inv.result }}</pre>
              </div>
            }
          </div>
        }
      </div>
    </example-chat-layout>
  `,
})
export class SkillsComponent {
  readonly ui = views({ 'calculator-result': CalculatorResultComponent, 'word-count-result': WordCountResultComponent });
  readonly uiStore = signalStateStore({});

  protected readonly stream = agent({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
  });

  private readonly SKILL_NAMES = new Set(['calculator', 'word_count', 'summarize']);

  /**
   * Derived signal: extracts skill invocations from the message stream.
   *
   * Scans AI messages for tool_calls matching known skill names, then pairs
   * each with its corresponding tool result message via tool_call_id.
   */
  protected readonly invocations = computed<SkillInvocation[]>(() => {
    const msgs = this.stream.messages();
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
