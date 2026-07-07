// libs/chat/src/lib/primitives/chat-citations/chat-citations-card.component.ts
// SPDX-License-Identifier: MIT
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import type { Citation } from '../../agent/citation';
import { deriveDomain, deriveMonogram, monogramColor, citationTypeLabel } from '../../agent/citation-display';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';
import { CHAT_CITATIONS_PANEL_STYLES } from '../../styles/chat-citations.styles';

/**
 * Sources-panel detail card: index badge, favicon/monogram + domain + type,
 * title, one-line snippet. Renders as an <a> (opens the source) when a url is
 * present, otherwise a non-interactive <div>. Shares the panel style module.
 */
@Component({
  selector: 'chat-citations-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet],
  styles: [CHAT_HOST_TOKENS, CHAT_CITATIONS_PANEL_STYLES],
  template: `
    @if (citation().url; as url) {
      <a class="chat-citations-card" [href]="url" target="_blank" rel="noopener noreferrer"
         [attr.aria-label]="'Source ' + citation().index + ': ' + (citation().title ?? url)">
        <ng-container [ngTemplateOutlet]="inner" />
      </a>
    } @else {
      <div class="chat-citations-card">
        <ng-container [ngTemplateOutlet]="inner" />
      </div>
    }

    <ng-template #inner>
      <span class="chat-citations-card__index">{{ citation().index }}</span>
      <span class="chat-citations-card__body">
        <span class="chat-citations-card__top">
          @if (citation().iconUrl; as icon) {
            <img class="chat-citations-card__fav" [src]="icon" alt="" width="14" height="14" />
          } @else {
            <span class="chat-citations-card__fav chat-citations-card__fav--mono"
                  [style.background]="monoColor()">{{ monogram() }}</span>
          }
          @if (domain(); as d) { <span class="chat-citations-card__domain">{{ d }}</span> }
          @if (typeLabel(); as t) { <span class="chat-citations-card__type">{{ t }}</span> }
        </span>
        @if (title(); as t) {
          <span class="chat-citations-card__title">{{ t }}</span>
        }
        @if (citation().snippet; as s) {
          <span class="chat-citations-card__snippet">{{ s }}</span>
        }
      </span>
    </ng-template>
  `,
})
export class ChatCitationsCardComponent {
  readonly citation = input.required<Citation>();

  protected readonly domain = computed(() => deriveDomain(this.citation().url));
  protected readonly title = computed(() => this.citation().title ?? this.citation().url ?? null);
  protected readonly monogram = computed(() => deriveMonogram(this.citation()));
  protected readonly monoColor = computed(() => monogramColor(this.citation()));
  protected readonly typeLabel = computed(() => citationTypeLabel(this.citation()));
}
