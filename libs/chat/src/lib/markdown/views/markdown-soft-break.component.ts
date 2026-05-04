// libs/chat/src/lib/markdown/views/markdown-soft-break.component.ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import type { MarkdownSoftBreakNode } from '@cacheplane/partial-markdown';

@Component({
  selector: 'md-soft-break',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<br>`,
})
export class MarkdownSoftBreakComponent {
  readonly node = input.required<MarkdownSoftBreakNode>();
}
