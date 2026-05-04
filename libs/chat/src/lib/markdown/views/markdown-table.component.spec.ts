// libs/chat/src/lib/markdown/views/markdown-table.component.spec.ts
// SPDX-License-Identifier: MIT
import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { views } from '@ngaf/render';
import type { MarkdownTableNode } from '@cacheplane/partial-markdown';
import { MarkdownTableComponent } from './markdown-table.component';
import { MarkdownTableRowComponent } from './markdown-table-row.component';
import { MarkdownTableCellComponent } from './markdown-table-cell.component';
import { MARKDOWN_VIEW_REGISTRY } from '../markdown-view-registry';

function makeTableNode(overrides: Partial<MarkdownTableNode> = {}): MarkdownTableNode {
  return {
    id: 1, type: 'table', status: 'complete',
    parent: null, index: null,
    alignments: [],
    children: [],
    ...overrides,
  } as MarkdownTableNode;
}

@Component({
  standalone: true,
  imports: [MarkdownTableComponent],
  template: `<chat-md-table [node]="node()" />`,
})
class HostComponent {
  node = signal<MarkdownTableNode>(makeTableNode());
}

describe('MarkdownTableComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [{
        provide: MARKDOWN_VIEW_REGISTRY,
        useValue: views({
          'table-row': MarkdownTableRowComponent,
          'table-cell': MarkdownTableCellComponent,
        }),
      }],
    });
  });

  it('renders a <table> element', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('table')).toBeTruthy();
  });

  it('applies chat-md-table class', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('table.chat-md-table')).toBeTruthy();
  });

  it('renders <thead> and <tbody> sections', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('thead')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('tbody')).toBeTruthy();
  });
});
