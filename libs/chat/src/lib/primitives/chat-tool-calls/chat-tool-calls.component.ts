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
import { AIMessage } from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';
import type { AgentRef } from '@cacheplane/langgraph';
import type { ToolCallWithResult } from '@langchain/langgraph-sdk';

@Component({
  selector: 'chat-tool-calls',
  standalone: true,
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (toolCall of toolCalls(); track toolCall.id) {
      @if (templateRef()) {
        <ng-container
          [ngTemplateOutlet]="templateRef()!"
          [ngTemplateOutletContext]="{ $implicit: toolCall }"
        />
      }
    }
  `,
})
export class ChatToolCallsComponent {
  readonly ref = input.required<AgentRef<any, any>>();
  readonly message = input<BaseMessage | undefined>(undefined);

  readonly templateRef = contentChild(TemplateRef);

  readonly toolCalls = computed((): ToolCallWithResult[] => {
    const msg = this.message();
    if (msg instanceof AIMessage) {
      return this.ref().getToolCalls(msg);
    }
    return this.ref().toolCalls();
  });
}
