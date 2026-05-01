// libs/chat/src/lib/primitives/chat-tool-calls/chat-tool-calls.component.ts
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
import type { Agent, Message, ToolCall } from '../../agent';
import { ChatToolCallCardComponent, type ToolCallInfo } from '../../compositions/chat-tool-call-card/chat-tool-call-card.component';

@Component({
  selector: 'chat-tool-calls',
  standalone: true,
  imports: [NgTemplateOutlet, ChatToolCallCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (toolCall of toolCalls(); track toolCall.id) {
      @if (templateRef()) {
        <ng-container [ngTemplateOutlet]="templateRef()!" [ngTemplateOutletContext]="{ $implicit: toolCall }" />
      } @else {
        <chat-tool-call-card [toolCall]="toToolCallInfo(toolCall)" />
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
      return blocks.map(b => all.find(tc => tc.id === b.id)).filter((x): x is ToolCall => !!x);
    }
    return this.agent().toolCalls();
  });

  protected toToolCallInfo(tc: ToolCall): ToolCallInfo {
    return {
      id: tc.id,
      name: tc.name,
      args: tc.args,
      result: tc.result,
    };
  }
}
