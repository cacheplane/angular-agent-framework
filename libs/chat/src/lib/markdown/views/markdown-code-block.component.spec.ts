// libs/chat/src/lib/markdown/views/markdown-code-block.component.spec.ts
// SPDX-License-Identifier: MIT
import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import type { MarkdownCodeBlockNode } from '@cacheplane/partial-markdown';
import { MarkdownCodeBlockComponent } from './markdown-code-block.component';

@Component({
  standalone: true,
  imports: [MarkdownCodeBlockComponent],
  template: `<md-code-block [node]="node()" />`,
})
class HostComponent {
  node = signal<MarkdownCodeBlockNode>({
    id: 0, type: 'code-block', status: 'complete',
    parent: null, index: null,
    variant: 'fenced', language: 'ts', text: 'const x = 1;',
  });
}

describe('MarkdownCodeBlockComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [HostComponent] }));

  it('renders <pre><code> with the text', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const code = fixture.nativeElement.querySelector('pre code') as HTMLElement;
    expect(code.textContent).toBe('const x = 1;');
  });

  it('sets language-XX class when language is provided', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('pre code')?.className).toBe('language-ts');
  });

  it('omits language class when language is empty', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.node.set({
      id: 0, type: 'code-block', status: 'complete',
      parent: null, index: null,
      variant: 'fenced', language: '', text: 'plain',
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('pre code')?.className).toBe('');
  });
});
