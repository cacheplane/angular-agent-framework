// libs/chat/src/lib/markdown/views/markdown-blockquote.component.ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import type { MarkdownBlockquoteNode } from '@cacheplane/partial-markdown';
import { MarkdownChildrenComponent } from '../markdown-children.component';

@Component({
  selector: 'chat-md-blockquote',
  standalone: true,
  imports: [MarkdownChildrenComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<blockquote><chat-md-children [parent]="node()" /></blockquote>`,
})
export class MarkdownBlockquoteComponent {
  readonly node = input.required<MarkdownBlockquoteNode>();
}
