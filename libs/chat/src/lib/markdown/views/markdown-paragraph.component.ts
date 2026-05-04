// libs/chat/src/lib/markdown/views/markdown-paragraph.component.ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import type { MarkdownParagraphNode } from '@cacheplane/partial-markdown';
import { MarkdownChildrenComponent } from '../markdown-children.component';

@Component({
  selector: 'md-paragraph',
  standalone: true,
  imports: [MarkdownChildrenComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<p><md-children [parent]="node()" /></p>`,
})
export class MarkdownParagraphComponent {
  readonly node = input.required<MarkdownParagraphNode>();
}
