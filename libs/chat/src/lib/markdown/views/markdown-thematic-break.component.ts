// libs/chat/src/lib/markdown/views/markdown-thematic-break.component.ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import type { MarkdownThematicBreakNode } from '@cacheplane/partial-markdown';

@Component({
  selector: 'chat-md-thematic-break',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<hr>`,
})
export class MarkdownThematicBreakComponent {
  readonly node = input.required<MarkdownThematicBreakNode>();
}
