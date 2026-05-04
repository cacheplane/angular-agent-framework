// libs/chat/src/lib/markdown/views/markdown-table-row.component.ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input, computed, inject } from '@angular/core';
import type { MarkdownTableRowNode } from '@cacheplane/partial-markdown';
import { MarkdownChildrenComponent } from '../markdown-children.component';
import { IS_HEADER_ROW } from '../markdown-table-row.token';

@Component({
  selector: 'chat-md-table-row',
  standalone: true,
  imports: [MarkdownChildrenComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tr class="chat-md-table-row" [class.chat-md-table-row--header]="node().isHeader">
      <chat-md-children [parent]="node()" />
    </tr>
  `,
  providers: [
    {
      provide: IS_HEADER_ROW,
      useFactory: () => {
        const comp = inject(MarkdownTableRowComponent);
        return computed(() => comp.node().isHeader);
      },
    },
  ],
})
export class MarkdownTableRowComponent {
  readonly node = input.required<MarkdownTableRowNode>();
}
