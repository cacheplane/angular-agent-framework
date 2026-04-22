// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  Component, computed, contentChild, input, output,
  TemplateRef, ChangeDetectionStrategy,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import type { ChatAgentWithHistory, ChatCheckpoint } from '../../agent';

@Component({
  selector: 'chat-timeline',
  standalone: true,
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (cp of history(); track $index) {
      @if (templateRef()) {
        <ng-container
          [ngTemplateOutlet]="templateRef()!"
          [ngTemplateOutletContext]="{ $implicit: cp, index: $index }"
        />
      }
    }
  `,
})
export class ChatTimelineComponent {
  readonly agent = input.required<ChatAgentWithHistory>();

  readonly checkpointSelected = output<ChatCheckpoint>();

  readonly templateRef = contentChild(TemplateRef);

  readonly history = computed<ChatCheckpoint[]>(() => this.agent().history());

  selectCheckpoint(cp: ChatCheckpoint): void {
    this.checkpointSelected.emit(cp);
  }
}
