// libs/chat/src/lib/streaming/streaming-markdown.identity.spec.ts
// SPDX-License-Identifier: MIT
import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { ChatStreamingMdComponent } from './streaming-markdown.component';

@Component({
  standalone: true,
  imports: [ChatStreamingMdComponent],
  template: `<chat-streaming-md [content]="content()" [streaming]="streaming()" />`,
})
class HostComponent {
  content = signal<string>('');
  streaming = signal<boolean>(true);
}

describe('chat-streaming-md — identity preservation', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [HostComponent] }));

  it('keeps the first paragraph DOM stable when a second paragraph is appended', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.content.set('First.\n\n');
    fixture.detectChanges();
    const firstP = fixture.nativeElement.querySelector('p');
    expect(firstP?.textContent?.trim()).toBe('First.');

    fixture.componentInstance.content.set('First.\n\nSecond.\n\n');
    fixture.detectChanges();

    const allPs = fixture.nativeElement.querySelectorAll('p');
    expect(allPs).toHaveLength(2);
    // The first <p> is the same DOM node — Angular preserved it because
    // materialize() returned the same JS reference for the unchanged subtree.
    expect(allPs[0]).toBe(firstP);
  });

  it('keeps the heading DOM stable when subsequent paragraphs stream in', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.content.set('# Title\n\n');
    fixture.detectChanges();
    const h1 = fixture.nativeElement.querySelector('h1');

    fixture.componentInstance.content.set('# Title\n\nA paragraph.\n\n');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('h1')).toBe(h1);
  });
});
