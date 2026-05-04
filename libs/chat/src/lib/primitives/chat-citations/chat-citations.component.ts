// libs/chat/src/lib/primitives/chat-citations/chat-citations.component.ts
// SPDX-License-Identifier: MIT
import {
  ChangeDetectionStrategy, Component, ContentChild, Directive, TemplateRef,
  computed, inject, input,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import type { Message } from '../../agent/message';
import type { Citation } from '../../agent/citation';
import { ChatCitationsCardComponent } from './chat-citations-card.component';

/**
 * ContentChild template directive for custom citation card rendering.
 * Usage: <ng-template chatCitationCard let-citation>...</ng-template>
 */
@Directive({ selector: 'ng-template[chatCitationCard]', standalone: true })
export class ChatCitationCardTemplateDirective {
  readonly tpl = inject<TemplateRef<{ $implicit: Citation }>>(TemplateRef);
}

@Component({
  selector: 'chat-citations',
  standalone: true,
  imports: [NgTemplateOutlet, ChatCitationsCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (citations().length > 0) {
      <section class="chat-citations">
        <h4 class="chat-citations__heading">{{ heading() }}</h4>
        <ul class="chat-citations__list">
          @for (c of citations(); track c.id) {
            <li class="chat-citations__item">
              @if (cardTpl) {
                <ng-container *ngTemplateOutlet="cardTpl.tpl; context: { $implicit: c }" />
              } @else {
                <chat-citations-card [citation]="c" />
              }
            </li>
          }
        </ul>
      </section>
    }
  `,
})
export class ChatCitationsComponent {
  readonly message = input.required<Message>();
  readonly heading = input<string>('Sources');

  @ContentChild(ChatCitationCardTemplateDirective) cardTpl: ChatCitationCardTemplateDirective | null = null;

  protected readonly citations = computed<Citation[]>(() => {
    const list = this.message().citations ?? [];
    return [...list].sort((a, b) => a.index - b.index);
  });
}
