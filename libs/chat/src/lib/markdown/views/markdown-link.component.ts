// libs/chat/src/lib/markdown/views/markdown-link.component.ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import type { MarkdownLinkNode } from '@cacheplane/partial-markdown';
import { MarkdownChildrenComponent } from '../markdown-children.component';

@Component({
  selector: 'md-link',
  standalone: true,
  imports: [MarkdownChildrenComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<a [href]="node().url" [attr.title]="node().title || null"><md-children [parent]="node()" /></a>`,
})
export class MarkdownLinkComponent {
  readonly node = input.required<MarkdownLinkNode>();
}
