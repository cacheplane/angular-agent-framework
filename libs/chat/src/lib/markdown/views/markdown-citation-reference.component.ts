// libs/chat/src/lib/markdown/views/markdown-citation-reference.component.ts
// SPDX-License-Identifier: MIT
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import type { MarkdownCitationReferenceNode } from '@cacheplane/partial-markdown';
import { CitationsResolverService } from '../citations-resolver.service';

@Component({
  selector: 'chat-md-citation-reference',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (resolved(); as r) {
      <a class="chat-citation-marker"
         [href]="r.citation.url ?? null"
         [attr.title]="r.citation.snippet ?? r.citation.url ?? null"
         target="_blank" rel="noopener noreferrer">
        <sup>[{{ node().index }}]</sup>
      </a>
    } @else {
      <span class="chat-citation-marker chat-citation-marker--unresolved"
            [attr.title]="'No source available'">
        <sup>[{{ node().index }}]</sup>
      </span>
    }
  `,
})
export class MarkdownCitationReferenceComponent {
  readonly node = input.required<MarkdownCitationReferenceNode>();
  private readonly resolver = inject(CitationsResolverService);
  protected readonly resolved = computed(() => {
    const lookup = this.resolver.lookup(this.node().refId);
    return lookup();
  });
}
