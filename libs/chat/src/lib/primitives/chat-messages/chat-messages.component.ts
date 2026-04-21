// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  Component,
  computed,
  contentChildren,
  input,
  ChangeDetectionStrategy,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import type { BaseMessage } from '@langchain/core/messages';
import type { AgentRef } from '@cacheplane/langgraph';
import { MessageTemplateDirective } from './message-template.directive';
import type { MessageTemplateType } from '../../chat.types';

/**
 * Maps a LangChain message to a {@link MessageTemplateType}.
 * Handles both class instances (with `_getType()`) and plain objects (with `type` property)
 * since SSE stream events deliver plain JSON, not hydrated BaseMessage instances.
 * Exported as a standalone function so it can be unit-tested without DOM rendering.
 */
export function getMessageType(message: BaseMessage): MessageTemplateType {
  // Try class method first, fall back to plain object property
  const type = typeof message._getType === 'function'
    ? message._getType()
    : (message as unknown as Record<string, unknown>)['type'] as string ?? 'ai';
  switch (type) {
    case 'human':
      return 'human';
    case 'ai':
      return 'ai';
    case 'tool':
      return 'tool';
    case 'system':
      return 'system';
    case 'function':
      return 'function';
    default:
      return 'ai';
  }
}

@Component({
  selector: 'chat-messages',
  standalone: true,
  imports: [NgTemplateOutlet, MessageTemplateDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (message of messages(); track $index) {
      @let template = findTemplate(getMessageType(message));
      @if (template) {
        <ng-container
          [ngTemplateOutlet]="template.templateRef"
          [ngTemplateOutletContext]="{ $implicit: message, index: $index }"
        />
      }
    }
  `,
})
export class ChatMessagesComponent {
  readonly ref = input.required<AgentRef<any, any>>();

  readonly messageTemplates = contentChildren(MessageTemplateDirective);

  readonly messages = computed(() => this.ref().messages());

  readonly getMessageType = getMessageType;

  findTemplate(type: MessageTemplateType): MessageTemplateDirective | undefined {
    return this.messageTemplates().find(t => t.chatMessageTemplate() === type);
  }
}
