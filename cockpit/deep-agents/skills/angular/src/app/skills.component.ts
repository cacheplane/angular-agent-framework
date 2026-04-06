// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component, computed } from '@angular/core';
import { ChatDebugComponent } from '@cacheplane/chat';
import { streamResource } from '@cacheplane/stream-resource';
import { environment } from '../environments/environment';

const SKILL_ICONS: Record<string, string> = {
  calculator: '🧮',
  word_count: '🔢',
  summarize: '📝',
};

@Component({
  selector: 'app-skills',
  standalone: true,
  imports: [ChatDebugComponent],
  template: `
    <div class="flex h-screen">
      <chat-debug [ref]="stream" class="flex-1 min-w-0" />
      @if (skillInvocations().length > 0) {
        <aside class="w-72 shrink-0 border-l overflow-y-auto p-4 space-y-2"
               style="border-color: var(--chat-border, #333); background: var(--chat-bg, #171717); color: var(--chat-text, #e0e0e0);">
          <h3 class="text-xs font-semibold uppercase tracking-wide mb-3"
              style="color: var(--chat-text-muted, #777);">Skill Invocations</h3>
          @for (inv of skillInvocations(); track $index) {
            <div class="flex items-center gap-2 text-sm py-1">
              <span class="shrink-0">{{ inv.icon }}</span>
              <span class="font-mono text-xs"
                    style="color: var(--chat-text, #e0e0e0);">{{ inv.name }}</span>
            </div>
          }
        </aside>
      }
    </div>
  `,
})
export class SkillsComponent {
  protected readonly stream = streamResource({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
  });

  protected readonly skillInvocations = computed(() => {
    const messages = this.stream.messages();
    const invocations: { name: string; icon: string }[] = [];
    for (const msg of messages) {
      if ('tool_calls' in msg && Array.isArray((msg as any).tool_calls)) {
        for (const tc of (msg as any).tool_calls) {
          if (tc.name === 'calculator' || tc.name === 'word_count' || tc.name === 'summarize') {
            invocations.push({ name: tc.name, icon: SKILL_ICONS[tc.name] ?? '🔧' });
          }
        }
      }
    }
    return invocations;
  });
}
