// libs/chat/src/lib/markdown/views/markdown-citation-reference.component.spec.ts
// SPDX-License-Identifier: MIT
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CitationsResolverService } from '../citations-resolver.service';
import { MarkdownCitationReferenceComponent } from './markdown-citation-reference.component';
import type { MarkdownCitationReferenceNode } from '@cacheplane/partial-markdown';

function makeNode(refId: string, index: number, resolved: boolean): MarkdownCitationReferenceNode {
  return {
    id: 1, type: 'citation-reference', status: 'complete',
    parent: null, index, refId, resolved,
  } as MarkdownCitationReferenceNode;
}

@Component({
  standalone: true,
  imports: [MarkdownCitationReferenceComponent],
  providers: [CitationsResolverService],
  template: `<chat-md-citation-reference [node]="node()" />`,
})
class HostComponent {
  node = signal<MarkdownCitationReferenceNode>(makeNode('src1', 1, false));
}

describe('MarkdownCitationReferenceComponent', () => {
  it('renders unresolved marker when no citation found', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const span = fixture.nativeElement.querySelector('span.chat-citation-marker');
    expect(span).toBeTruthy();
    expect(span.classList.contains('chat-citation-marker--unresolved')).toBe(true);
    expect(span.textContent).toContain('1');
  });

  it('renders linked marker when citation found via Message', () => {
    const fixture = TestBed.createComponent(HostComponent);
    const svc = fixture.debugElement.injector.get(CitationsResolverService);
    svc.message.set({
      id: 'm1', role: 'assistant', content: 'x',
      citations: [{ id: 'src1', index: 1, title: 'Source', url: 'https://example.com' }],
    });
    fixture.componentInstance.node.set(makeNode('src1', 1, true));
    fixture.detectChanges();
    const a = fixture.nativeElement.querySelector('a.chat-citation-marker');
    expect(a).toBeTruthy();
    expect(a.getAttribute('href')).toBe('https://example.com');
    expect(a.textContent).toContain('1');
  });

  it('renders <span> (not <a>) when citation has no URL — bug #197 regression', () => {
    // Live Chrome smoke caught: a Pandoc def with bare URL (no <autolink> brackets)
    // produces a Citation with url === undefined. Prior template rendered <a href="">
    // which is a broken link. Fix renders <span class="chat-citation-marker--no-url">.
    const fixture = TestBed.createComponent(HostComponent);
    const svc = fixture.debugElement.injector.get(CitationsResolverService);
    svc.message.set({
      id: 'm1', role: 'assistant', content: 'x',
      citations: [{ id: 'src1', index: 1, title: 'Source title only, no URL' }],
    });
    fixture.componentInstance.node.set(makeNode('src1', 1, true));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('a.chat-citation-marker')).toBeNull();
    const span = fixture.nativeElement.querySelector('span.chat-citation-marker--no-url');
    expect(span).toBeTruthy();
    expect(span.textContent).toContain('1');
  });
});
