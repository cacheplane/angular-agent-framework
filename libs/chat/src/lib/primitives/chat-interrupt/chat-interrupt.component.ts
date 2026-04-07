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
import type { Interrupt } from '@cacheplane/angular';
import type { AgentRef } from '@cacheplane/angular';

/**
 * Retrieves the current interrupt value from a AgentRef.
 * Exported for unit testing without DOM rendering.
 */
export function getInterrupt(ref: AgentRef<any, any>): Interrupt<any> | undefined {
  return ref.interrupt();
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
  readonly ref = input.required<AgentRef<any, any>>();

  readonly templateRef = contentChild(TemplateRef);

  readonly interrupt = computed(() => this.ref().interrupt());
}
