// libs/chat/src/lib/markdown/views/markdown-table.component.ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import type { MarkdownTableNode, MarkdownTableRowNode } from '@cacheplane/partial-markdown';
import { MarkdownTableRowComponent } from './markdown-table-row.component';

@Component({
  selector: 'chat-md-table',
  standalone: true,
  imports: [MarkdownTableRowComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <table class="chat-md-table">
      <thead>
        @if (headerRow(); as row) {
          <chat-md-table-row [node]="row" />
        }
      </thead>
      <tbody>
        @for (row of bodyRows(); track $any(row)) {
          <chat-md-table-row [node]="row" />
        }
      </tbody>
    </table>
  `,
})
export class MarkdownTableComponent {
  readonly node = input.required<MarkdownTableNode>();

  protected readonly headerRow = computed<MarkdownTableRowNode | null>(() => {
    const rows = this.node().children;
    return rows.length > 0 && rows[0].isHeader ? rows[0] : null;
  });

  protected readonly bodyRows = computed<MarkdownTableRowNode[]>(() => {
    const rows = this.node().children;
    return rows[0]?.isHeader ? rows.slice(1) : rows;
  });
}
