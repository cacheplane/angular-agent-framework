import { Component, computed } from '@angular/core';
import { ChatComponent } from '@cacheplane/chat';
import { streamResource } from '@cacheplane/stream-resource';
import { environment } from '../environments/environment';

interface SkillInvocation {
  skillName: string;
  args: string;
  result?: string;
}

/**
 * SkillsComponent demonstrates a multi-skill agent with specialized tools.
 *
 * The agent can calculate math expressions, count words, and summarize text
 * by selecting the appropriate skill tool for each user request. The sidebar
 * shows each skill invocation as a card with the skill name, input args,
 * and result.
 *
 * Key integration points:
 * - `stream.messages()` contains all messages including tool call data
 * - `computed()` derives skill invocation cards from tool calls in AI messages
 * - Invocations update reactively as the agent calls and receives tool results
 */
@Component({
  selector: 'app-skills',
  standalone: true,
  imports: [ChatComponent],
  template: `
    <cp-chat
      [messages]="stream.messages()"
      [isLoading]="stream.isLoading()"
      [error]="stream.error()"
      (sendMessage)="send($event)">
      <ng-template #sidebar>
        <h3 style="font-size: 0.8rem; font-weight: 600; margin-bottom: 0.75rem; color: #1a1a2e;">Skill Invocations</h3>
        @for (inv of skillInvocations(); track $index) {
          <div style="padding: 8px; margin-bottom: 8px; border: 1px solid #e5e7eb; border-radius: 6px; font-size: 0.8rem;">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
              <span style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; background: #dbeafe; color: #1e40af;">
                {{ inv.skillName }}
              </span>
              @if (inv.result) {
                <span style="font-size: 0.7rem; color: #10b981; font-weight: 600;">done</span>
              } @else {
                <span style="font-size: 0.7rem; color: #004090; font-weight: 600;">running…</span>
              }
            </div>
            <div style="color: #555770; font-family: monospace; font-size: 0.75rem; margin-bottom: 4px; word-break: break-all;">
              {{ inv.args }}
            </div>
            @if (inv.result) {
              <div style="color: #1a1a2e; font-size: 0.75rem; padding-top: 4px; border-top: 1px solid #f3f4f6;">
                {{ inv.result }}
              </div>
            }
          </div>
        }
        @empty {
          <p style="color: #8b8fa3; font-size: 0.8rem;">Ask the agent to calculate, count words, or summarize text.</p>
        }
      </ng-template>
    </cp-chat>
  `,
})
export class SkillsComponent {
  protected readonly stream = streamResource({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
  });

  skillInvocations = computed(() => {
    const msgs = this.stream.messages();
    const invocations: SkillInvocation[] = [];
    for (const m of msgs) {
      if ((m as any).tool_calls) {
        for (const tc of (m as any).tool_calls) {
          invocations.push({
            skillName: tc.name,
            args: JSON.stringify(tc.args),
            result: tc.output,
          });
        }
      }
    }
    return invocations;
  });

  send(text: string): void {
    this.stream.submit({ messages: [{ role: 'human', content: text }] });
  }
}
