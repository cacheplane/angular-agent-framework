// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  Component,
  computed,
  contentChildren,
  input,
  ChangeDetectionStrategy,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import type { Agent, Message } from '../../agent';
import { MessageTemplateDirective } from './message-template.directive';
import type { MessageTemplateType } from '../../chat.types';

/**
 * Maps a {@link Message} to a {@link MessageTemplateType}.
 * Exported as a standalone function so it can be unit-tested without DOM rendering.
 */
export function getMessageType(message: Message): MessageTemplateType {
  switch (message.role) {
    case 'user':
      return 'human';
    case 'assistant':
      return 'ai';
    case 'tool':
      return 'tool';
    case 'system':
      return 'system';
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
  readonly agent = input.required<Agent>();

  readonly messageTemplates = contentChildren(MessageTemplateDirective);

  readonly messages = computed(() => this.agent().messages());

  readonly getMessageType = getMessageType;

  findTemplate(type: MessageTemplateType): MessageTemplateDirective | undefined {
    return this.messageTemplates().find(t => t.chatMessageTemplate() === type);
  }
}
