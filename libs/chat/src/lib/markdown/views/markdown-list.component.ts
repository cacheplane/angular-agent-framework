// libs/chat/src/lib/markdown/views/markdown-list.component.ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import type { MarkdownListNode } from '@cacheplane/partial-markdown';
import { MarkdownChildrenComponent } from '../markdown-children.component';

@Component({
  selector: 'md-list',
  standalone: true,
  imports: [MarkdownChildrenComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (node().ordered) {
      <ol [attr.start]="node().start ?? null"><md-children [parent]="node()" /></ol>
    } @else {
      <ul><md-children [parent]="node()" /></ul>
    }
  `,
})
export class MarkdownListComponent {
  readonly node = input.required<MarkdownListNode>();
}
