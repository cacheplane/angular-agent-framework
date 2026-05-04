// libs/chat/src/lib/markdown/views/markdown-strikethrough.component.ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import type { MarkdownStrikethroughNode } from '@cacheplane/partial-markdown';
import { MarkdownChildrenComponent } from '../markdown-children.component';

@Component({
  selector: 'chat-md-strikethrough',
  standalone: true,
  imports: [MarkdownChildrenComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<del><chat-md-children [parent]="node()" /></del>`,
})
export class MarkdownStrikethroughComponent {
  readonly node = input.required<MarkdownStrikethroughNode>();
}
