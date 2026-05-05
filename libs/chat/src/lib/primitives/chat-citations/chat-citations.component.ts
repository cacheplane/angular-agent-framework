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
import { CitationsResolverService, mdDefToCitation } from '../../markdown/citations-resolver.service';

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

  /**
   * Optional resolver — present when chat-citations is rendered inside a
   * chat-message that provides CitationsResolverService (the standard
   * placement). When absent, the panel reads only Message.citations.
   */
  private readonly resolver = inject(CitationsResolverService, { optional: true });

  /**
   * Combined citation list:
   *   1. Message.citations (provider-populated, takes precedence by id)
   *   2. Markdown sidecar defs (Pandoc-formatted [^id]: lines), merged in
   *      for any id not already present.
   *
   * Sorted by index ascending. This guarantees the sources panel surfaces
   * citations whether they come from message metadata, content syntax, or
   * both — matching the same precedence as inline-marker resolution.
   */
  protected readonly citations = computed<Citation[]>(() => {
    const fromMessage = this.message().citations ?? [];
    const seenIds = new Set(fromMessage.map(c => c.id));
    const fromMarkdown: Citation[] = [];
    const mdDefs = this.resolver?.markdownDefs();
    if (mdDefs) {
      for (const def of mdDefs.values()) {
        if (!seenIds.has(def.id)) fromMarkdown.push(mdDefToCitation(def));
      }
    }
    return [...fromMessage, ...fromMarkdown].sort((a, b) => a.index - b.index);
  });
}
