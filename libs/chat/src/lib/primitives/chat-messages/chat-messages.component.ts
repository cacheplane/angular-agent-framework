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
import type { AgentRef } from '@cacheplane/angular';
import type { ViewRegistry } from '@cacheplane/render';
import type { StateStore } from '@json-render/core';
import { RenderSpecComponent, toRenderRegistry } from '@cacheplane/render';
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
  imports: [NgTemplateOutlet, MessageTemplateDirective, RenderSpecComponent],
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

      @if (renderRegistry() && getUiSpec(message); as spec) {
        <div class="ml-10 mt-2">
          <render-spec
            [spec]="$any(spec)"
            [registry]="renderRegistry()!"
            [store]="store()"
          />
        </div>
      }
    }
  `,
})
export class ChatMessagesComponent {
  readonly ref = input.required<AgentRef<any, any>>();
  readonly views = input<ViewRegistry | undefined>(undefined);
  readonly store = input<StateStore | undefined>(undefined);

  readonly messageTemplates = contentChildren(MessageTemplateDirective);

  readonly messages = computed(() => this.ref().messages());

  readonly getMessageType = getMessageType;
  readonly getUiSpec = getUiSpec;

  /** Convert ViewRegistry to AngularRegistry for render-spec */
  readonly renderRegistry = computed(() => {
    const v = this.views();
    return v ? toRenderRegistry(v) : undefined;
  });

  findTemplate(type: MessageTemplateType): MessageTemplateDirective | undefined {
    return this.messageTemplates().find(t => t.chatMessageTemplate() === type);
  }
}

/**
 * Extracts a UI spec from a message if present.
 * Checks the message's `ui` field and `additional_kwargs.ui` field.
 */
export function getUiSpec(message: BaseMessage): unknown | null {
  const msg = message as unknown as Record<string, unknown>;
  if (msg['ui'] && isValidSpec(msg['ui'])) return msg['ui'];
  const kwargs = msg['additional_kwargs'] as Record<string, unknown> | undefined;
  if (kwargs?.['ui'] && isValidSpec(kwargs['ui'])) return kwargs['ui'];
  return null;
}

function isValidSpec(value: unknown): boolean {
  return typeof value === 'object'
    && value !== null
    && 'root' in (value as Record<string, unknown>)
    && 'elements' in (value as Record<string, unknown>);
}
