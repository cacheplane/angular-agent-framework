// libs/chat/src/lib/markdown/views/markdown-list-item.component.ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import type { MarkdownListItemNode } from '@cacheplane/partial-markdown';
import { MarkdownChildrenComponent } from '../markdown-children.component';

@Component({
  selector: 'chat-md-list-item',
  standalone: true,
  imports: [MarkdownChildrenComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <li [class.chat-md-list-item--task]="node().task !== undefined">
      @if (node().task !== undefined) {
        <input type="checkbox" disabled [checked]="node().task!.checked" />
      }
      <chat-md-children [parent]="node()" />
    </li>
  `,
})
export class MarkdownListItemComponent {
  readonly node = input.required<MarkdownListItemNode>();
}
