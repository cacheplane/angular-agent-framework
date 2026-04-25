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
import type { Agent, Message, ToolCall } from '../../agent';

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
  readonly agent = input.required<Agent>();
  readonly message = input<Message | undefined>(undefined);

  readonly templateRef = contentChild(TemplateRef);

  readonly toolCalls = computed((): ToolCall[] => {
    const msg = this.message();
    if (msg && msg.role === 'assistant' && Array.isArray(msg.content)) {
      const blocks = msg.content.filter((b) => b.type === 'tool_use');
      const all = this.agent().toolCalls();
      return blocks
        .map(b => all.find(tc => tc.id === b.id))
        .filter((x): x is ToolCall => !!x);
    }
    return this.agent().toolCalls();
  });
}
