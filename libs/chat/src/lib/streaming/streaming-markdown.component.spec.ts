// libs/chat/src/lib/streaming/streaming-markdown.component.spec.ts
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
  streaming = signal<boolean>(false);
}

describe('ChatStreamingMdComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [HostComponent] }));

  it('renders a heading from markdown', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.content.set('# Heading\n');
    fixture.componentInstance.streaming.set(false);
    fixture.detectChanges();
    const h1 = fixture.nativeElement.querySelector('h1');
    expect(h1).toBeTruthy();
    expect(h1.textContent?.trim()).toBe('Heading');
  });

  it('renders a paragraph from markdown', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.content.set('Hello world.\n');
    fixture.componentInstance.streaming.set(false);
    fixture.detectChanges();
    const p = fixture.nativeElement.querySelector('p');
    expect(p).toBeTruthy();
    expect(p.textContent?.trim()).toBe('Hello world.');
  });

  it('updates rendered output when content changes (shrink)', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.content.set('# Long heading\n');
    fixture.componentInstance.streaming.set(false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('h1')?.textContent?.trim()).toBe('Long heading');

    // Content shrinks — component resets and re-parses from scratch
    fixture.componentInstance.content.set('# Short\n');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('h1')?.textContent?.trim()).toBe('Short');
  });

  it('renders multiple paragraphs when content extends the prior prefix', () => {
    const fixture = TestBed.createComponent(HostComponent);
    // Start with one paragraph (non-streaming — this is the common finalized state)
    fixture.componentInstance.content.set('First.\n\nSecond.\n\n');
    fixture.componentInstance.streaming.set(false);
    fixture.detectChanges();

    const ps = fixture.nativeElement.querySelectorAll('p');
    expect(ps.length).toBe(2);
    expect(ps[0].textContent?.trim()).toBe('First.');
    expect(ps[1].textContent?.trim()).toBe('Second.');
  });

  it('renders nothing when content is empty', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.content.set('');
    fixture.componentInstance.streaming.set(false);
    fixture.detectChanges();
    // No block-level elements should be present
    expect(fixture.nativeElement.querySelector('p')).toBeNull();
    expect(fixture.nativeElement.querySelector('h1')).toBeNull();
  });
});
