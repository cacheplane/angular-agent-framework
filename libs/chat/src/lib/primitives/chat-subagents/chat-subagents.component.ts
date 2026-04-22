// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  Component,
  computed,
  contentChild,
  input,
  TemplateRef,
  ChangeDetectionStrategy,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import type { ChatAgent } from '../../agent';
import type { ChatSubagent } from '../../agent/chat-subagent';

/**
 * Returns the list of currently-active subagents on the agent. "Active" means
 * the subagent status is neither `complete` nor `error`. Returns an empty list
 * when the runtime does not expose a subagents surface.
 * Exported for unit testing without DOM rendering.
 */
export function activeSubagentsFromAgent(agent: ChatAgent): ChatSubagent[] {
  const map = agent.subagents?.();
  if (!map) return [];
  const out: ChatSubagent[] = [];
  map.forEach((sa) => {
    const s = sa.status();
    if (s !== 'complete' && s !== 'error') out.push(sa);
  });
  return out;
}

@Component({
  selector: 'chat-subagents',
  standalone: true,
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (subagent of activeSubagents(); track subagent.toolCallId) {
      @if (templateRef()) {
        <ng-container
          [ngTemplateOutlet]="templateRef()!"
          [ngTemplateOutletContext]="{ $implicit: subagent }"
        />
      }
    }
  `,
})
export class ChatSubagentsComponent {
  readonly agent = input.required<ChatAgent>();

  readonly templateRef = contentChild(TemplateRef);

  readonly activeSubagents = computed(() => activeSubagentsFromAgent(this.agent()));
}
