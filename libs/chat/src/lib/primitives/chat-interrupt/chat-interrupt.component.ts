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
import type { Interrupt } from '@cacheplane/stream-resource';
import type { StreamResourceRef } from '@cacheplane/stream-resource';

/**
 * Retrieves the current interrupt value from a StreamResourceRef.
 * Exported for unit testing without DOM rendering.
 */
export function getInterrupt(ref: StreamResourceRef<any, any>): Interrupt<any> | undefined {
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
  readonly ref = input.required<StreamResourceRef<any, any>>();

  readonly templateRef = contentChild(TemplateRef);

  readonly interrupt = computed(() => this.ref().interrupt());
}
