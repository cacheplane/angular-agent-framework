// libs/chat/src/lib/markdown/views/markdown-hard-break.component.ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import type { MarkdownHardBreakNode } from '@cacheplane/partial-markdown';

@Component({
  selector: 'chat-md-hard-break',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<br>`,
})
export class MarkdownHardBreakComponent {
  readonly node = input.required<MarkdownHardBreakNode>();
}
