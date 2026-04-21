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
import type { AgentRef, SubagentStreamRef } from '@cacheplane/langgraph';

@Component({
  selector: 'chat-subagents',
  standalone: true,
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (subagent of activeSubagents(); track $index) {
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
  readonly ref = input.required<AgentRef<any, any>>();

  readonly templateRef = contentChild(TemplateRef);

  readonly activeSubagents = computed((): SubagentStreamRef[] => this.ref().activeSubagents());
}
