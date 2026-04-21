// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// TODO(phase-3): migrate from AgentRef to ChatAgent contract.
import {
  Component,
  computed,
  contentChild,
  input,
  output,
  TemplateRef,
  ChangeDetectionStrategy,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import type { AgentRef, ThreadState } from '@cacheplane/langgraph';

@Component({
  selector: 'chat-timeline',
  standalone: true,
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (state of history(); track $index) {
      @if (templateRef()) {
        <ng-container
          [ngTemplateOutlet]="templateRef()!"
          [ngTemplateOutletContext]="{ $implicit: state, index: $index }"
        />
      }
    }
  `,
})
export class ChatTimelineComponent {
  readonly ref = input.required<AgentRef<any, any>>();

  readonly checkpointSelected = output<ThreadState<any>>();

  readonly templateRef = contentChild(TemplateRef);

  readonly history = computed((): ThreadState<any>[] => this.ref().history());

  selectCheckpoint(state: ThreadState<any>): void {
    this.checkpointSelected.emit(state);
  }
}
