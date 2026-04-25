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
import type { Agent } from '../../agent';
import type { Subagent } from '../../agent/subagent';

/**
 * Returns the list of currently-active subagents on the agent. "Active" means
 * the subagent status is neither `complete` nor `error`. Returns an empty list
 * when the runtime does not expose a subagents surface.
 * Exported for unit testing without DOM rendering.
 */
export function activeSubagentsFromAgent(agent: Agent): Subagent[] {
  const map = agent.subagents?.();
  if (!map) return [];
  const out: Subagent[] = [];
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
  readonly agent = input.required<Agent>();

  readonly templateRef = contentChild(TemplateRef);

  readonly activeSubagents = computed(() => activeSubagentsFromAgent(this.agent()));
}
