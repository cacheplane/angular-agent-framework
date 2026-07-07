// libs/chat/src/lib/primitives/chat-citations/chat-citation-preview.component.ts
// SPDX-License-Identifier: MIT
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { Citation } from '../../agent/citation';
import {
  deriveDomain, deriveMonogram, monogramColor, citationTypeLabel, formatPublished,
} from '../../agent/citation-display';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';
import { CHAT_CITATION_PREVIEW_STYLES } from '../../styles/chat-citations.styles';

/**
 * Presentational provenance card for a single Citation. Rendered inside the
 * inline marker's connected-overlay pane (hover/tap preview) — self-contained
 * so its encapsulated styles apply even when portaled to the body-level pane.
 */
@Component({
  selector: 'chat-citation-preview',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [CHAT_HOST_TOKENS, CHAT_CITATION_PREVIEW_STYLES],
  template: `
    <div class="chat-citation-preview" role="group" [attr.aria-label]="'Source ' + citation().index">
      <div class="chat-citation-preview__head">
        @if (citation().iconUrl; as icon) {
          <img class="chat-citation-preview__fav" [src]="icon" alt="" width="16" height="16" />
        } @else {
          <span class="chat-citation-preview__fav chat-citation-preview__fav--mono"
                [style.background]="monoColor()">{{ monogram() }}</span>
        }
        @if (domain(); as d) { <span class="chat-citation-preview__domain">{{ d }}</span> }
        @if (typeLabel(); as t) { <span class="chat-citation-preview__type">{{ t }}</span> }
      </div>
      @if (citation().title; as title) {
        <p class="chat-citation-preview__title">{{ title }}</p>
      }
      @if (citation().snippet; as s) {
        <p class="chat-citation-preview__snippet">{{ s }}</p>
      }
      @if (citation().url; as url) {
        <div class="chat-citation-preview__foot">
          <a class="chat-citation-preview__open" [href]="url" target="_blank" rel="noopener noreferrer">
            <svg viewBox="0 0 24 24" aria-hidden="true" width="12" height="12">
              <path d="M7 17L17 7M17 7H8M17 7v9" fill="none" stroke="currentColor" stroke-width="2" />
            </svg>
            Open source
          </a>
          @if (published(); as p) { <span class="chat-citation-preview__meta">{{ p }}</span> }
        </div>
      }
    </div>
  `,
})
export class ChatCitationPreviewComponent {
  readonly citation = input.required<Citation>();

  protected readonly domain = computed(() => deriveDomain(this.citation().url));
  protected readonly monogram = computed(() => deriveMonogram(this.citation()));
  protected readonly monoColor = computed(() => monogramColor(this.citation()));
  protected readonly typeLabel = computed(() => citationTypeLabel(this.citation()));
  protected readonly published = computed(() => formatPublished(this.citation().publishedAt));
}
