// libs/chat/src/lib/markdown/views/markdown-code-block.component.ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import type { MarkdownCodeBlockNode } from '@cacheplane/partial-markdown';

@Component({
  selector: 'md-code-block',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<pre><code [class]="languageClass()">{{ node().text }}</code></pre>`,
})
export class MarkdownCodeBlockComponent {
  readonly node = input.required<MarkdownCodeBlockNode>();
  protected readonly languageClass = computed(() => {
    const lang = this.node().language;
    return lang ? `language-${lang}` : '';
  });
}
