// libs/chat/src/lib/markdown/views/markdown-document.component.ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import type { MarkdownDocumentNode } from '@cacheplane/partial-markdown';
import { MarkdownChildrenComponent } from '../markdown-children.component';

@Component({
  selector: 'md-document',
  standalone: true,
  imports: [MarkdownChildrenComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<md-children [parent]="node()" />`,
})
export class MarkdownDocumentComponent {
  readonly node = input.required<MarkdownDocumentNode>();
}
