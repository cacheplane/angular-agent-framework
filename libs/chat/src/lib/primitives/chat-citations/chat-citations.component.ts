// libs/chat/src/lib/primitives/chat-citations/chat-citations.component.ts
// SPDX-License-Identifier: MIT
import {
  ChangeDetectionStrategy, Component, ContentChild, Directive, TemplateRef,
  computed, inject, input, signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import type { Message } from '../../agent/message';
import type { Citation } from '../../agent/citation';
import { ChatCitationsCardComponent } from './chat-citations-card.component';
import { CitationsResolverService, mdDefToCitation } from '../../markdown/citations-resolver.service';
import { deriveMonogram, monogramColor } from '../../agent/citation-display';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';
import { CHAT_CITATIONS_PANEL_STYLES } from '../../styles/chat-citations.styles';

/**
 * ContentChild template directive for custom citation card rendering.
 * Usage: <ng-template chatCitationCard let-citation>...</ng-template>
 */
@Directive({ selector: 'ng-template[chatCitationCard]', standalone: true })
export class ChatCitationCardTemplateDirective {
  readonly tpl = inject<TemplateRef<{ $implicit: Citation }>>(TemplateRef);
}

interface FavEntry { id: string; iconUrl?: string; mono: string; color: string; }

let nextCitationsId = 0;

@Component({
  selector: 'chat-citations',
  standalone: true,
  imports: [NgTemplateOutlet, ChatCitationsCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [CHAT_HOST_TOKENS, CHAT_CITATIONS_PANEL_STYLES],
  template: `
    @if (citations().length > 0) {
      <section class="chat-citations">
        <button
          type="button"
          class="chat-citations__header"
          [attr.aria-expanded]="expanded()"
          [attr.aria-controls]="listId"
          (click)="expanded.set(!expanded())"
        >
          <span class="chat-citations__heading">{{ heading() }}</span>
          <span class="chat-citations__count">{{ citations().length }}</span>
          <span class="chat-citations__favstack" aria-hidden="true">
            @for (f of favstack(); track f.id) {
              @if (f.iconUrl) {
                <img class="chat-citations__fav" [src]="f.iconUrl" alt="" width="16" height="16" />
              } @else {
                <span class="chat-citations__fav chat-citations__fav--mono"
                      [style.background]="f.color">{{ f.mono }}</span>
              }
            }
          </span>
          <svg class="chat-citations__chevron" [class.is-open]="expanded()"
               viewBox="0 0 24 24" aria-hidden="true" width="15" height="15">
            <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" />
          </svg>
        </button>
        @if (expanded()) {
          <ul class="chat-citations__list" [id]="listId">
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
        }
      </section>
    }
  `,
})
export class ChatCitationsComponent {
  readonly message = input.required<Message>();
  readonly heading = input<string>('Sources');

  protected readonly expanded = signal(true);
  protected readonly listId = `chat-citations-list-${nextCitationsId++}`;

  @ContentChild(ChatCitationCardTemplateDirective) cardTpl: ChatCitationCardTemplateDirective | null = null;

  private readonly resolver = inject(CitationsResolverService, { optional: true });

  /**
   * Combined citation list:
   *   1. Message.citations (provider-populated, takes precedence by id)
   *   2. Markdown sidecar defs (Pandoc [^id]: lines), merged for unseen ids.
   * Sorted by index ascending.
   */
  protected readonly citations = computed<Citation[]>(() => {
    const fromMessage = this.message().citations ?? [];
    const seenIds = new Set(fromMessage.map((c) => c.id));
    const fromMarkdown: Citation[] = [];
    const mdDefs = this.resolver?.markdownDefs();
    if (mdDefs) {
      for (const def of mdDefs.values()) {
        if (!seenIds.has(def.id)) fromMarkdown.push(mdDefToCitation(def));
      }
    }
    return [...fromMessage, ...fromMarkdown].sort((a, b) => a.index - b.index);
  });

  /** First 3 sources, mapped to favicon/monogram chips for the header preview. */
  protected readonly favstack = computed<FavEntry[]>(() =>
    this.citations().slice(0, 3).map((c) => ({
      id: c.id, iconUrl: c.iconUrl, mono: deriveMonogram(c), color: monogramColor(c),
    })),
  );
}
