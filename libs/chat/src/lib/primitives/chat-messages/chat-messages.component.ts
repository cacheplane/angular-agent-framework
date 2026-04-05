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
import type { StreamResourceRef } from '@cacheplane/stream-resource';
import { MessageTemplateDirective } from './message-template.directive';
import type { MessageTemplateType } from '../../chat.types';

/**
 * Maps a LangChain message `_getType()` string to a {@link MessageTemplateType}.
 * Exported as a standalone function so it can be unit-tested without DOM rendering.
 */
export function getMessageType(message: BaseMessage): MessageTemplateType {
  const type = message._getType();
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
  readonly ref = input.required<StreamResourceRef<any, any>>();

  readonly messageTemplates = contentChildren(MessageTemplateDirective);

  readonly messages = computed(() => this.ref().messages());

  readonly getMessageType = getMessageType;

  findTemplate(type: MessageTemplateType): MessageTemplateDirective | undefined {
    return this.messageTemplates().find(t => t.chatMessageTemplate() === type);
  }
}
