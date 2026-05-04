// libs/chat/src/lib/markdown/views/markdown-table-row.component.spec.ts
// SPDX-License-Identifier: MIT
import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { views } from '@ngaf/render';
import type { MarkdownTableRowNode } from '@cacheplane/partial-markdown';
import { MarkdownTableRowComponent } from './markdown-table-row.component';
import { MarkdownTableCellComponent } from './markdown-table-cell.component';
import { MARKDOWN_VIEW_REGISTRY } from '../markdown-view-registry';

function makeRowNode(isHeader: boolean, children: MarkdownTableRowNode['children'] = []): MarkdownTableRowNode {
  return {
    id: 2, type: 'table-row', status: 'complete',
    parent: null, index: null,
    isHeader,
    children,
  } as MarkdownTableRowNode;
}

@Component({
  standalone: true,
  imports: [MarkdownTableRowComponent],
  template: `<chat-md-table-row [node]="node()" />`,
})
class HostComponent {
  node = signal<MarkdownTableRowNode>(makeRowNode(false));
}

describe('MarkdownTableRowComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [{
        provide: MARKDOWN_VIEW_REGISTRY,
        useValue: views({ 'table-cell': MarkdownTableCellComponent }),
      }],
    });
  });

  it('renders a <tr> element', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('tr')).toBeTruthy();
  });

  it('applies chat-md-table-row class', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('tr.chat-md-table-row')).toBeTruthy();
  });

  it('does NOT apply header class for body rows', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const tr = fixture.nativeElement.querySelector('tr');
    expect(tr.classList.contains('chat-md-table-row--header')).toBe(false);
  });

  it('applies header class for header rows', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.node.set(makeRowNode(true));
    fixture.detectChanges();
    const tr = fixture.nativeElement.querySelector('tr');
    expect(tr.classList.contains('chat-md-table-row--header')).toBe(true);
  });
});
