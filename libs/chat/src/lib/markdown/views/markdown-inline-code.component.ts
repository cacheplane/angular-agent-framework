// libs/chat/src/lib/markdown/views/markdown-inline-code.component.ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import type { MarkdownInlineCodeNode } from '@cacheplane/partial-markdown';

@Component({
  selector: 'md-inline-code',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<code>{{ node().text }}</code>`,
})
export class MarkdownInlineCodeComponent {
  readonly node = input.required<MarkdownInlineCodeNode>();
}
