// libs/chat/src/lib/markdown/views/markdown-autolink.component.ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import type { MarkdownAutolinkNode } from '@cacheplane/partial-markdown';

@Component({
  selector: 'md-autolink',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<a [href]="node().url">{{ node().url }}</a>`,
})
export class MarkdownAutolinkComponent {
  readonly node = input.required<MarkdownAutolinkNode>();
}
