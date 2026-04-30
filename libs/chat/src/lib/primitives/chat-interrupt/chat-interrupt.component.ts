// SPDX-License-Identifier: MIT
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
import type { AgentInterrupt } from '../../agent/agent-interrupt';

/**
 * Retrieves the current interrupt value from an Agent, or undefined when
 * the runtime does not expose interrupts.
 * Exported for unit testing without DOM rendering.
 */
export function getInterrupt(agent: Agent): AgentInterrupt | undefined {
  return agent.interrupt?.();
}

@Component({
  selector: 'chat-interrupt',
  standalone: true,
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (interrupt(); as currentInterrupt) {
      @if (templateRef()) {
        <ng-container
          [ngTemplateOutlet]="templateRef()!"
          [ngTemplateOutletContext]="{ $implicit: currentInterrupt }"
        />
      }
    }
  `,
})
export class ChatInterruptComponent {
  readonly agent = input.required<Agent>();

  readonly templateRef = contentChild(TemplateRef);

  readonly interrupt = computed(() => getInterrupt(this.agent()));
}
