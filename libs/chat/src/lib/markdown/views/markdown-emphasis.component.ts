// libs/chat/src/lib/markdown/views/markdown-emphasis.component.ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import type { MarkdownEmphasisNode } from '@cacheplane/partial-markdown';
import { MarkdownChildrenComponent } from '../markdown-children.component';

@Component({
  selector: 'chat-md-emphasis',
  standalone: true,
  imports: [MarkdownChildrenComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<em><chat-md-children [parent]="node()" /></em>`,
})
export class MarkdownEmphasisComponent {
  readonly node = input.required<MarkdownEmphasisNode>();
}
