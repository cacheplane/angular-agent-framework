// libs/chat/src/lib/markdown/views/markdown-text.component.ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import type { MarkdownTextNode } from '@cacheplane/partial-markdown';

@Component({
  selector: 'chat-md-text',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `{{ node().text }}`,
})
export class MarkdownTextComponent {
  readonly node = input.required<MarkdownTextNode>();
}
