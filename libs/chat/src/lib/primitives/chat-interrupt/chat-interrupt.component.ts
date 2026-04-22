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
import type { ChatInterrupt } from '../../agent/chat-interrupt';

/**
 * Retrieves the current interrupt value from a ChatAgent, or undefined when
 * the runtime does not expose interrupts.
 * Exported for unit testing without DOM rendering.
 */
export function getInterrupt(agent: ChatAgent): ChatInterrupt | undefined {
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
  readonly agent = input.required<ChatAgent>();

  readonly templateRef = contentChild(TemplateRef);

  readonly interrupt = computed(() => getInterrupt(this.agent()));
}
