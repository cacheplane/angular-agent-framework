// SPDX-License-Identifier: MIT
import {
  Component, computed, contentChild, input, output,
  TemplateRef, ChangeDetectionStrategy,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import type { AgentWithHistory, AgentCheckpoint } from '../../agent';

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
  readonly agent = input.required<AgentWithHistory>();

  readonly checkpointSelected = output<AgentCheckpoint>();

  readonly templateRef = contentChild(TemplateRef);

  readonly history = computed<AgentCheckpoint[]>(() => this.agent().history());

  selectCheckpoint(cp: AgentCheckpoint): void {
    this.checkpointSelected.emit(cp);
  }
}
